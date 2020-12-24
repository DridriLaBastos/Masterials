// eslint-env node

const file_path = './PatientsHTA.csv';

class Dataset {

    constructor ( file_path, options ) {
        const { excludedParameters, encoders, types } = options || {};
        const fs = require( 'fs' );
        const file_content = fs.readFileSync( file_path, { encoding: 'utf8', flag: 'r' } );
        const [header, ...rows] = file_content
            .split( /\n/g )
            .map( row => row.replace( '\r', '' ).split( /\,/g ).map( cell => cell.trim() ) )
            .filter( row => row.length > 0 && row.some( item => !!item === true ) );

        this.header = Dataset.parseHeader( header, { types } );
        this.rows = Dataset.parseRows( this.header, rows, { excludedParameters } );
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
        const classic = value => value === '' ? undefined : value;
        if ( !types ) {
            return classic;
        }
        if ( typeof types[prop] === 'function' ) {
            return value => types[prop]( value );
        }
        else {
            switch ( types[prop] ) {
                case 'number': {
                    return value => Number( value );
                }
                case 'bigint': {
                    return value => BigInt( value );
                }
                case 'boolean': {
                    return value => isNaN( +value ) ? Boolean( value ) : !!( +value );
                }
                case 'object': {
                    return value => JSON.parse( value );
                }
                default: {
                    return classic;
                }
            }
        }

    }

    static parseRows( header, rows, options ) {
        const { excludedParameters } = options || {};
        const ex_params = excludedParameters ? typeof excludedParameters === 'string' ? [excludedParameters] : excludedParameters : undefined;
        if ( ex_params ) {
            for ( const ex_param of ex_params ) {
                header.delete( ex_param );
            }
        }
        return rows.map( row => {
            const curr = Object.create( null );
            for ( const [column, { index, type }] of header.entries() ) {
                if ( !( ex_params && ex_params.includes( column ) ) ) {
                    curr[column] = type( row[index] );
                }
            }
            return curr;
        } );
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

    throughRows( options ) {
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
        const groupBy_func = ( map, target, ...props ) => {
            const [prop, ...subProps] = props;
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
                    groupBy_func( items, target, ...subProps );
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
        if ( options ) {
            const { filterBy, groupBy } = options;
            const index_lookup = [];
            const filtered_rows = [];
            const filtered_map = new Map();
            for ( let index = 0, length = this.rows.length; index < length; index++ ) {
                if ( filterBy ) {
                    if ( filterBy.every( ( [prop, value] ) => filterBy_func( prop, value, this.rows[index] ) ) ) {
                        if ( groupBy ) {
                            groupBy_func( filtered_map, this.rows[index], ...( typeof groupBy === 'string' ? [groupBy] : groupBy ) );
                            index_lookup.push( index );
                        }
                        else {
                            index_lookup.push( index );
                            filtered_rows.push( this.rows[index] );
                        }
                    }
                }
                else if ( groupBy ) {
                    groupBy_func( filtered_map, this.rows[index], ...( typeof groupBy === 'string' ? [groupBy] : groupBy ) );
                }
            }
            if ( groupBy ) {
                const entries = [...( filtered_map.entries() )];
                let index = -1;
                const limit = entries.length;
                return ( {
                    [Symbol.iterator]: () => {
                        return ( {
                            next: () => {
                                return ++index < limit ? { value: entries[index], done: false } : { done: true };
                            }
                        } );
                    }
                } );
            }
            else if ( filterBy ) {
                let index = -1;
                const limit = filtered_rows.length;
                return ( {
                    [Symbol.iterator]: () => {
                        return ( {
                            next: () => {
                                return ++index < limit ? { value: [filtered_rows[index], [index, index_lookup[index]], [filtered_rows, this.rows]], done: false } : { done: true };
                            }
                        } );
                    }
                } );
            }
        }
        else {
            let index = -1;
            const limit = this.rows.length;
            return ( {
                [Symbol.iterator]: () => {
                    return ( {
                        next: () => {
                            return ++index < limit ? { value: [this.rows[index], index, this.rows], done: false } : { done: true };
                        }
                    } );
                }
            } );
        }
    }

    setTypes( types ) {
        const typeToApply = [];
        for ( let prop in types ) {
            if ( types.hasOwnProperty( prop ) ) {
                if ( !( this.header.has( prop ) ) ) {
                    throw new Error( `Parameter ${prop} does not exist.` );
                }
                else {
                    const item = this.header.get( prop );
                    item.type = Dataset.parseType( types, prop );
                    this.header.set( prop, item );
                    typeToApply.push( { prop, func: item.type } );

                }
            }
        }
        for ( const row of this.rows ) {
            for ( const { prop, func } of typeToApply ) {
                if ( prop in row ) {
                    row[prop] = func( row[prop] );
                }
            }
        }
    }

    removeParameters( ...parameters ) {
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

const toDate = date => {
    const [day, month, year] = date.split( /\//g );
    return new Date( year, month - 1, day );
};

const data = new Dataset( file_path, {
    excludedParameters: [
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
        'contact_id'
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
        'Tension Diastolique': 'number',
        'Tension Systolique': 'number',
        'contact_date': toDate,
        'first_contact_date': toDate
    },
    encoders: [
        'gender_code',
        'frequency_label',
        'product_atc_code',
        'specialty_label',
    ]

} );

for ( const [_, person_id_entries] of [...data.throughRows( {
    filterBy: [
        ['product_atc_code', x => x],
        ['Age_presc', x => x > 45]
    ],
    groupBy: ['person_id', 'contact_date']
} )].slice( 0, 1 ) ) {
    console.log( person_id_entries );
}