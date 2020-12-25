// eslint-env node

const file_path = './PatientsHTA.csv';

const env = ( typeof Deno !== 'undefined' ? 'deno' : typeof module !== 'undefined' && module.exports ? 'node' : 'browser' );

const values = object => {
    const array = [];
    for ( const prop in object ) {
        if ( Object.prototype.hasOwnProperty.call( object, prop ) ) {
            array.push( object[prop] );
        }
    }
    return array;
};

console.log( 'Environment ::', env );

class Dataset {

    constructor ( file_path, options ) {
        const { excluded, encoders, types } = ( options || {} );
        let file_content;
        switch ( env ) {
            case 'deno': {
                const decoder = new TextDecoder( 'utf-8' );
                const fileBuffer = Deno.readFileSync( file_path, { encoding: 'utf-8', flag: 'r' } );
                file_content = decoder.decode( fileBuffer );
                break;
            }
            case 'node': {
                const fs = require( 'fs' );
                file_content = fs.readFileSync( file_path, { encoding: 'utf8', flag: 'r' } );
                break;
            }
            default: {
                break;
            }
        }
        const [header, ...rows] = file_content
            .split( /\n/g )
            .map( row => row.replace( /\r/g, '' ).split( /\,/g ).map( cell => cell.trim() ) )
            .filter( row => row.length > 0 && row.some( item => !!item === true ) );

        this.header = Dataset.parseHeader( header, { types } );

        this.rows = Dataset.parseRows( this.header, rows, { excluded } );
        this.encoders = new Map();
        if ( encoders ) {
            this.encode( ...( typeof encoders === 'string' ? [encoders] : encoders ) );
        }
    }

    static parseHeader( header, options ) {
        const { types } = options || {};
        return new Map( header.map( ( item, index ) => [item, { index, type: Dataset.parseType( types, item ) }] ) );
    }

    static parseType( types, prop ) {
        const to_same = function to_same( value ) { return value === '' ? undefined : value; };

        if ( !types ) {
            return to_same;
        }
        if ( typeof types[prop] === 'function' ) {
            return function to_custom( value ) { return types[prop]( value ); };
        }
        else {
            switch ( types[prop] ) {
                case 'number': {
                    return function to_number( value ) {
                        const new_value = to_same( value );
                        return new_value === undefined ? undefined : isNaN( +new_value ) ? undefined : +new_value;
                    };
                }
                case 'bigint': {
                    return function to_bigint( value ) {
                        return BigInt( to_same( value ) );
                    };
                }
                case 'boolean': {
                    return function to_boolean( value ) {
                        const new_value = to_same( value );
                        return isNaN( +new_value ) ? Boolean( new_value ) : !!( +new_value );
                    };
                }
                case 'object': {
                    return function to_object( value ) {
                        return JSON.parse( to_same( value ) );
                    };
                }
                case 'string': {
                    return function to_string( value ) {
                        return String( to_same( value ) );
                    };
                }
                default: {
                    return to_same;
                }
            }
        }
    }

    static parseRows( header, rows, options ) {
        const { excluded } = options || {};
        const to_exclude = excluded ? typeof excluded === 'string' ? [excluded] : excluded : undefined;
        if ( to_exclude ) {
            for ( const item of to_exclude ) {
                header.delete( item );
            }
        }
        return rows.map( row => {
            const curr = Object.create( null );
            for ( const [column, { index, type }] of header.entries() ) {
                if ( !( to_exclude && to_exclude.includes( column ) ) ) {
                    curr[column] = type( row[index] );
                }
            }
            return curr;
        } );
    }

    sort( columns, options ) {
        const sort_func = ( type ) => {
            if ( typeof type === 'function' ) {
                return type;
            }
            else {
                const to_lower = type.toLowerCase();
                switch ( to_lower ) {
                    case 'd':
                    case 'desc':
                    case 'descending': {
                        return ( a, b ) => b - a;
                    }
                    default: {
                        return ( a, b ) => a - b;
                    }
                }
            }
        };

        const { groupBy } = options || {};

        if ( groupBy ) {
            const groupBy_func = ( map, target, [prop, ...subProps] = [] ) => {
                if ( !( this.header.has( prop ) ) ) {
                    throw new Error( `Parameter ${prop} does not exist.` );
                }
                let items;
                if ( map.has( target[prop] ) ) {
                    items = map.get( target[prop] );
                }
                else {
                    if ( subProps.length > 0 ) {
                        items = new Map();
                    }
                    else {
                        items = [];
                    }
                }
                if ( prop in target ) {
                    if ( subProps.length > 0 ) {
                        groupBy_func( items, target, subProps );
                    }
                    else {
                        items.push( target );
                    }
                    map.set( target[prop], items );
                }
                else {
                    throw new Error( `Target property ${prop} does not exist.` );
                }
            };
            const flat_map_func = ( map, sort_map, [prop, ...subProps] = [] ) => {
                if ( map instanceof Map ) {
                    const to_array = [...map.values()]
                        .map( item => flat_map_func( item, sort_map, subProps ) )
                        .flat( Infinity );
                    return sort_map.has( prop )
                        ? to_array.sort( ( { [prop]: a }, { [prop]: b } ) => sort_func( sort_map.get( prop ) )( a, b ) )
                        : to_array;
                }
                else {
                    return prop
                        ? map.sort( ( { [prop]: a }, { [prop]: b } ) => sort_func( sort_map.get( prop ) )( a, b ) )
                        : map;
                }
            };

            const filtered_map = new Map();

            for ( const row of this.rows ) {
                groupBy_func( filtered_map, row, typeof groupBy === 'string' ? [groupBy] : groupBy );
            }
            const sort_map = new Map( columns );
            this.rows = flat_map_func( filtered_map, sort_map, groupBy );
        }
        else {
            for ( const [column, type] of columns ) {
                this.rows = this.rows.sort( ( { [column]: a }, { [column]: b } ) => sort_func( type )( a, b ) );
            }
        }
    }

    filter( func, options ) {
        const { groupBy, groupFilter } = ( options || {} );

        const filter_func = filter => typeof filter === 'function'
            ? filter
            : value => value;

        if ( groupBy ) {
            const groupBy_array = typeof groupBy === 'string' ? [groupBy] : groupBy;
            const groupBy_func = ( map, target, [prop, ...subProps] ) => {
                if ( !( this.header.has( prop ) ) ) {
                    throw new Error( `Parameter ${prop} does not exist.` );
                }

                const items = map.has( target[prop] )
                    ? map.get( target[prop] )
                    : subProps.length > 0 ? new Map() : [];

                if ( prop in target ) {
                    if ( subProps.length > 0 ) {
                        groupBy_func( items, target, subProps );
                    }
                    else {
                        items.push( target );
                    }
                    map.set( target[prop], items );
                }
                else {
                    throw new Error( `Target property ${prop} does not exist.` );
                }
            };

            const flat_map_func = ( map, [prop, ...props], filters ) => map instanceof Map
                ? [...( map.values() )]
                    .map( item => flat_map_func( item, props, filters ) )
                    .filter( filter_func( filters[prop] ) )
                    .flat( Infinity )
                : map;

            const filtered_map = new Map();

            for ( const row of this.rows ) {
                groupBy_func( filtered_map, row, groupBy_array );
            }

            this.rows = flat_map_func( filtered_map, groupBy_array, groupFilter );
        }
        if ( func ) {
            this.rows = this.rows.filter( filter_func( func ) );
        }
    }

    encode( ...columns ) {
        for ( const column of columns.filter( column => this.header.has( column ) ) ) {
            let encoder;
            if ( this.encoders.has( column ) ) {
                encoder = this.encoders.get( column );
            }
            else {
                encoder = Object.assign( Object.create( null ), {
                    keys: [],
                    values: [],
                    length: 0
                } );
            }
            for ( const row of this.rows ) {
                if ( row[column] !== undefined ) {
                    const indexOf = encoder.keys.indexOf( row[column] );
                    if ( indexOf >= 0 ) {
                        row[column] = encoder.values[indexOf];
                    }
                    else {
                        const code = encoder.length++;
                        encoder.keys.push( row[column] );
                        encoder.values.push( code );
                        row[column] = code;
                    }
                }
            }
            this.encoders.set( column, encoder );
        }
    }

    decode( ...columns ) {
        const work_columns = [];
        if ( columns.length > 0 ) {
            work_columns.push( ...columns.filter( column => this.encoders.has( column ) ) );
        }
        else {
            work_columns.push( ...( this.encoders.keys() ) );
        }
        if ( work_columns.length > 0 ) {
            for ( const column of work_columns ) {
                const { keys, values } = this.encoders.get( column );
                for ( const row of this.rows ) {
                    if ( column in row ) {
                        row[column] = keys[values.indexOf( row[column] )];
                    }
                }
            }
        }
    }

    through_rows( options ) {
        const filterBy_func = ( prop, prop_value, target ) => {
            if ( !( this.header.has( prop ) ) ) {
                throw new Error( `Parameter ${prop} does not exist.` );
            }
            if ( typeof prop_value === 'function' ) {
                return prop_value( target[prop] );
            }
            else if ( prop_value !== undefined || prop_value !== '' ) {
                return prop in target && target[prop] === prop_value;
            }
        };
        const groupBy_func = ( map, target, ...[prop, ...props] ) => {
            if ( !( this.header.has( prop ) ) ) {
                throw new Error( `Parameter ${prop} does not exist.` );
            }
            let items;
            if ( map.has( target[prop] ) ) {
                items = map.get( target[prop] );
            }
            else {
                if ( props.length > 0 ) {
                    items = new Map();
                }
                else {
                    items = [];
                }
            }
            let index = [];
            if ( prop in target ) {
                if ( props.length > 0 ) {
                    index.push( ...groupBy_func( items, target, ...props ) );
                }
                else {
                    items.push( target );
                }
                map.set( target[prop], items );
                index.push( map.size - 1 );
            }
            else {
                throw new Error( `Target property ${prop} does not exist.` );
            }
            return index;
        };
        const deep_map_get = ( map, row, prop, ...props ) => {
            const values = [];
            if ( map instanceof Map ) {
                if ( props.length > 0 ) {
                    values.push( ...deep_map_get( map.get( row[prop] ), row, props ), map );
                }
                else {
                    values.push( map );
                }
            }
            return values.flat( Infinity );
        };

        if ( options ) {
            const { filterBy, groupBy, ignore } = options;
            const groupByArray = typeof groupBy === 'string' ? [groupBy] : groupBy;
            const index_lookup = [];
            const deep_index_lookup = [];
            const filtered_rows = [];
            const filtered_map = new Map();
            let index = 0;
            for ( const row of this.rows ) {
                if ( filterBy ) {
                    if ( filterBy.every( ( [prop, value] ) => filterBy_func( prop, value, row ) ) ) {
                        if ( groupBy ) {
                            deep_index_lookup.push( ...groupBy_func( filtered_map, row, ...groupByArray ) );
                            index_lookup.push( index );
                        }
                        else {
                            index_lookup.push( index );
                            filtered_rows.push( row );
                        }
                    }
                }
                else if ( groupBy ) {
                    deep_index_lookup.push( [...groupBy_func( filtered_map, row, ...groupByArray ), index] );
                    index_lookup.push( index );
                }
                index++;
            }
            if ( groupBy ) {
                let index = 0;
                const _this = this;
                const limit = deep_index_lookup.length;
                return ( {
                    [Symbol.iterator]: () => ( {
                        next: () => ( {
                            value: index < limit ? Object.assign( Object.create( null ), {
                                row: _this.rows[index_lookup[index]],
                                ...( ignore && ignore.includes( 'groups' ) ? {} : {
                                    groups: deep_map_get( filtered_map, _this.rows[index_lookup[index]], ...groupByArray )
                                } ),
                                ...( ignore && ignore.includes( 'indices' ) ? {} : { indices: deep_index_lookup[index] } )
                            } ) : undefined, done: !( index++ < limit )
                        } )
                    } )
                } );
            }
            else if ( filterBy ) {
                let index = 0;
                const _this = this;
                const limit = filtered_rows.length;
                return ( {
                    [Symbol.iterator]: () => ( {
                        next: () => ( {
                            value: index < limit ? Object.assign( Object.create( null ), {
                                row: _this.rows[index_lookup[index]],
                                index: index_lookup[index],
                                filtered_rows: filtered_rows,
                                filtered_index: index,
                            } ) : undefined, done: !( index++ < limit )
                        } )
                    } )
                } );
            }
            else {
                let index = 0;
                const limit = this.rows.length;
                return ( {
                    [Symbol.iterator]: () => ( {
                        next: () => ( { value: index < limit ? [this.rows[index], index, this.rows] : undefined, done: !( index++ < limit ) } )
                    } )
                } );
            }
        }
    }

    add_types( types ) {
        const to_apply = [];
        for ( let prop in types ) {
            if ( types.hasOwnProperty( prop ) ) {
                if ( !( this.header.has( prop ) ) ) {
                    throw new Error( `Parameter ${prop} does not exist.` );
                }
                else {
                    const item = this.header.get( prop );
                    item.type = Dataset.parseType( types, prop );
                    this.header.set( prop, item );
                    to_apply.push( { prop, func: item.type } );

                }
            }
        }
        for ( const row of this.rows ) {
            for ( const { prop, func } of to_apply ) {
                if ( prop in row ) {
                    row[prop] = func( row[prop] );
                }
            }
        }
    }

    drop_column( ...parameters ) {
        for ( const row of this.rows ) {
            for ( const parameter of parameters ) {
                if ( parameter in row ) {
                    delete row[parameter];
                }
            }
        }
        for ( const parameter of parameters ) {
            this.header.delete( parameter );
        }
    }
}

const to_date = date => {
    const [day, month, year] = date.split( /\//g );
    return new Date( year, month - 1, day );
};

const traitement_to_bool = traitement => traitement === 'OUI' ? 0b1 : 0b0;

console.time( 'Dataset processing :' );

const data = new Dataset( file_path, {
    excluded: [
        'Glycemie_der_date',
        'HbA1c_der_date',
        'der_date_poids',
        'der_date_taille',
        'der_date',
        'der_mesure',
        'cip',
        'box',
        'Poids',
        'Taille',
        'Age_now',
        'molecule_label',
        'short_name',
        'long_name',
        'Classe',
        'product_atc',
        'contact_id',
        'first_contact_date'
    ],
    types: {
        'quantity': 'number',
        'duration': 'number',
        'dose_1': 'number',
        'dose_2': 'number',
        'dosage_1': 'number',
        'Pulse': 'number',
        'person_id': 'number',
        'Age_presc': 'number',
        'year_of_birth': 'number',
        'Glycemie_prescription': 'number',
        'Glycemie_der_mesure': 'number',
        'HbA1c_prescription': 'number',
        'HbA1c_der_mesure': 'number',
        'Tension Diastolique': 'number',
        'Tension Systolique': 'number',
        'contact_date': to_date,
        'Traitement_Autres_A10_dep_201701': traitement_to_bool,
        'Traitement_Insulines_dep_201701': traitement_to_bool
    },
    encoders: [
        'gender_code',
        'frequency_label',
        'product_atc_code',
        'specialty_label',
        
    ]

} );

data.sort(
    [
        ['person_id', 'asc'],
        ['contact_date', ( a, b ) => a.getTime() - b.getTime()]
    ],
    { groupBy: ['person_id', 'contact_date'] }
);

data.filter(
    row => !( [...( Object.entries( row ) )].every( cell => cell === undefined ) ),
    {
        groupBy: ['person_id'],
        groupFilter: {
            'person_id': ( { length } ) => length >= 4
        }
    }
);

for ( const { row, indices: [cx, _, tx] } of data.through_rows( { groupBy: ['person_id', 'contact_date'], ignore: ['groups'] } ) ) {
    let wait_time_days = 0;
    let wait_time_weeks = 0;
    if ( cx > 0 ) {
        wait_time_days = Math.floor( ( ( row.contact_date - data.rows[tx - 1].contact_date ) / 1000 ) / ( 3600 * 24 ) );
        wait_time_weeks = Math.floor( wait_time_days / 7 );
    }
    row.wait_time_days = wait_time_days;
    row.wait_time_weeks = wait_time_weeks;
    row.contact_date = row.contact_date.getTime();
}

console.timeEnd( 'Dataset processing :' );
