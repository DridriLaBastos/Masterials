/* eslint-env browser */
import { ExtendedWorker } from './aemijs/module/multithread.js';

const csvPath = window.location.href + 'PatientsHTA.csv';

const WorkerOptions = {
    promise: true,
    name: 'TensorFlow Worker',
    localImports: [
        '/aemijs/browser/multithread-worker.js',
        '/aemijs/browser/dataset.js',
        '/tensorflow/tf.min.js',
    ]
};

const worker = new ExtendedWorker( function () {
    /* eslint-env worker */
    globalThis.tf_data = {};
    const { listeners } = globalThis;

    tf.setBackend( 'cpu' );

    listeners.addTypeListener( 'eval', string => {
        const func = eval( string );
        if ( typeof func !== 'function' ) {
            throw new TypeError( `This is not a function: ${string}` );
        }
        return func( { tf, data: globalThis.tf_data, scope: globalThis } );
    }, { propertyAccessor: 'data' } );

    listeners.addTypeListener( 'prepare-url', string => {
        globalThis.tf_data.__csv_url__ = string;
        return globalThis.tf_data.__csv_url__;
    }, { propertyAccessor: 'url' } );

}, WorkerOptions );

worker.postMessage( { type: 'prepare-url', url: window.location.origin + '/PatientsHTA.csv' } ).then( csvPath_ => {
    if ( csvPath_ === csvPath ) {
        worker.postMessage( {
            type: 'eval', data: ( async ( { tf, data, scope } ) => {

                const { __csv_url__: csvPath } = data;

                tf.setBackend( 'cpu' );

                console.group( 'Informations' );
                {
                    console.log( 'Resource Path', csvPath );
                    console.log( 'Tensorflow', tf );
                    console.log( 'TensorFlow Backend', tf.getBackend() );
                    console.log( 'TensorFlow Versions', tf.version );
                    console.log( 'TensorFlow Data', data );
                    console.log( 'Worker Global Scope', scope );
                }
                console.groupEnd( 'Informations' );

                const to_date = function ( date ) {
                    const [day, month, year] = date.split( /\//g );
                    return ( new Date( year, month - 1, day ) ).getTime();
                };

                const visit_thresold = 6;

                console.time( 'Dataset processing :' );

                const _dset = await Dataset.load( csvPath, {
                    excluded: [
                        'Glycemie_der_date', 'HbA1c_der_date',
                        'der_date_poids', 'der_date_taille',
                        'der_date', 'der_mesure',
                        'duration', 'quantity',
                        'cip', 'box',
                        'Poids', 'Taille',
                        'Age_now',
                        'molecule_label',
                        'short_name', 'long_name',
                        'Classe', 'product_atc',
                        'contact_id',
                        'frequency_label', 'first_contact_date',
                        'Glycemie_prescription', 'Glycemie_der_mesure',
                        'HbA1c_prescription', 'HbA1c_der_mesure',
                        'Traitement_Autres_A10_dep_201701', 'Traitement_Insulines_dep_201701',
                        'dose_1', 'dose_2',
                        'dosage_1'
                    ],
                    types: {
                        'Pulse': 'number',
                        'person_id': 'number',
                        'Age_presc': 'number',
                        'year_of_birth': 'number',
                        'Tension Diastolique': 'number',
                        'Tension Systolique': 'number',
                        'contact_date': to_date
                    },
                    encoders: [
                        'gender_code',
                        'specialty_label'
                    ]
                } );
                {
                    _dset.sortBy( ['person_id', 'contact_date'] );
                }
                {
                    _dset.filter( [
                        ['person_id'],
                        ['contact_date'],
                        ['product_atc_code']
                    ],
                        [['person_id', item => item.length >= visit_thresold]]
                    );
                }
                {
                    _dset.encodeColumn( 'product_atc_code' );
                }
                {
                    const cdi = _dset.header.getColumnIndexByColumnKey( 'contact_date' );
                    _dset.map( row => {
                        const time = row[cdi];
                        const date = new Date( time );
                        const month = date.getMonth();
                        const row_ = [...row, month];
                        return row_;
                    } );
                    _dset.header.addColumn( 'contact_date_month', 'number' );
                }
                {
                    const x = _dset.header.getColumnIndexByColumnKey( 'contact_date' );
                    for ( const visits of _dset.groupBy( ['person_id'] ).values() ) {
                        for ( let i = 0, l = visits.length; i < l; i++ ) {
                            let milliseconds;
                            if ( i === 0 ) {
                                milliseconds = 0;
                            }
                            else {
                                milliseconds = visits[i][x] - visits[i - 1][x];
                            }
                            const seconds = milliseconds / 1000;
                            const minutes = seconds / 60;
                            const hours = minutes / 60;
                            const days = hours / 24;
                            const weeks = days / 7;
                            const months = weeks / 4;
                            visits[i].push( Math.round( days ), Math.round( weeks ), Math.round( months > 4 ? 5 : months ) );
                        }
                    }
                    _dset.header.addColumn( 'wait_time_days', 'number' );
                    _dset.header.addColumn( 'wait_time_weeks', 'number' );
                    _dset.header.addColumn( 'wait_time_months', 'number' );
                }
                {
                    _dset.encodeColumn( 'wait_time_months' );
                }
                {
                    const oneHotColumns = ['specialty_label', 'product_atc_code', 'gender_code', 'wait_time_months'];
                    const oneHotMap = oneHotColumns.map( key => {
                        const { index, encoder } = _dset.header.getColumnByKey( key );
                        return [index, encoder];
                    } );
                    _dset.mapAsync( row => {
                        const row_ = [...row];
                        for ( const [index, encoder] of oneHotMap ) {
                            row_[index] = encoder.getOneHotEncodedByIndex( row_[index] );
                        }
                        return row_;
                    } );
                }
                console.timeEnd( 'Dataset processing :' );

                let xList_d;
                let yList_d;

                {
                    const yCn = ['product_atc_code'];
                    const yCnX = yCn.map( k => _dset.header.getColumnIndexByColumnKey( k ) );
                    const floor = visit_thresold;
                    let xList = [];
                    let yList = [];
                    for ( const visits of _dset.groupBy( ['person_id'] ).values() ) {
                        const { length: l } = visits;
                        for ( let i = 0, limit = l - floor + 1; i < limit; i += 1 ) {
                            const j = i + floor - 1;
                            const timeSerie = visits.slice( i, j );
                            xList.push( timeSerie );
                            yList.push( yCnX.map( x => visits[j][x] ) );
                        }
                    }
                    xList_d = xList;
                    yList_d = yList;
                }

                /**
                 * Tensorflow Part
                 */
                console.time( 'Tensorflow Conversion :' );
                data.xData = tf.data.array( xList_d );
                data.yData = tf.data.array( yList_d );
                console.timeEnd( 'Tensorflow Conversion :' );

                return data;

            } ).toString()
        } ).then( data => {
            console.log( data );
        } );
    }
} );
