// eslint-env node
import { Dataset } from './lib-js/dataset.mjs';
import { IArray } from './lib-js/immutable.mjs';

const file_path = './PatientsHTA.csv';

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
        'specialty_label'
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

