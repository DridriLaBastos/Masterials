// eslint-env node

const file_path = './PatientsHTA.csv';

class Dataset {
    constructor ( file_path, options ) {
        const { excludedParameters } = options || {};
        const fs = require( 'fs' );
        const file_content = fs.readFileSync( file_path, { encoding: 'utf8', flag: 'r' } );
        const [header, ...rows] = file_content
            .split( /\n/g )
            .map( row => row.replace( '\r', '' ).split( /\,/g ).map( cell => cell.trim() ) )
            .filter( row => row.length > 0 && row.some( item => !!item === true ) );
        
        this.header = Dataset.parseHeader( header );
        this.rows = Dataset.parseRows( this.header, rows, excludedParameters ); 
    }
    static parseHeader( header ) {
        return new Map( header.map( ( item, index ) => [item, index] ) )
    }
    static parseRows( header, rows, excludedParameters ) {
        const ex_params = excludedParameters ? typeof excludedParameters === 'string' ? [excludedParameters] : excludedParameters : undefined;
        if ( ex_params ) {
            for ( const ex_param of ex_params ) {
                header.delete( ex_param );
            }
        }
        return rows.map( row => {
            const curr = Object.create( null );
            for ( const [column, index] of header.entries() ) {
                if ( !(ex_params && ex_params.includes( column )) ) {
                    curr[column] = row[index] === '' ? undefined : row[index];   
                }
            }
            return curr;
        } );
    }
    throughRows( options ) {
        const filterBy_func = ( prop, prop_value, target ) => {
            if ( !(this.header.has( prop )) ) {
                throw new Error( `Parameter ${prop} does not exist.` );
            }
            if ( typeof prop_value === 'function' ) {
                return prop_value( target[prop] );
            }
            else {
                return prop in target && target[prop] == prop_value;
            }
        };
        const groupBy_func = ( map, target, ...props ) => {
            const [prop, ...subProps] = props;
            if ( !(this.header.has( prop )) ) {
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
        }

        if ( options ) {
            const { filterBy, groupBy } = options;
            const index_lookup = [];
            const filtered_rows = [];
            const filtered_map = new Map();
            for ( let index = 0, length = this.rows.length; index < length; index++ ) {
                if ( filterBy ) {
                    for ( let prop in filterBy ) {
                        if ( filterBy.hasOwnProperty( prop ) ) {
                            if ( filterBy_func( prop, filterBy[prop], this.rows[index]) ) {
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
                                return ++index < limit ? { value: entries[index], done: false } :  { done: true };
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
    removeParameters( ...parameters ) {
        for ( const [row] of this.throughRows() ) {
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


const data = new Dataset( file_path, {
    excludedParameters: [
        'Glycemie_der_date',
        'HbA1c_der_date',
        'der_date_poids',
        'der_date_taille',
        'der_date',
        'der_mesure',
        'Poids',
        'cip',
        'Taille',
        'Age_now',
        'molecule_label',
        'short_name',
        'long_name',
        'Classe',
        'product_atc',
        'contact_id'
    ]
} );

for ( const [code, person_id_entries] of data.throughRows( { filterBy: { Age_presc: _ => _ && +_ > 45 }, groupBy: ['product_atc_code', 'person_id'] } ) ) {
    const list = [...person_id_entries.keys()].map( person_id => +person_id );
    const length = list.length;
    console.log( code, '<==', list, '::', length );
}

data.removeParameters( 'cip' );

console.log( [...data.throughRows()].map( ( [e] ) => e ).slice( 0, 100 ) );


// const parseFunction = ( column, value ) => {
//     let func;
//     switch ( column ) {
//         case 'contact_date':
//         case 'first_contact_date': {
//             func = value => {
//                 const [day, month, year] = value.split( /\//g ).map( e => +e );
//                 return new Date( year, month - 1, day );
//             };
//             break;
//         }
//         default: {
//             func = e => e;
//             break;
//         }
//     }
//     return func( value );
// };