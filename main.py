#%%
import pandas as pd

from matplotlib import pyplot as plt
#%%
dateColumnNames = ['contact_date','Glycemie_der_date','HbA1c_der_date','der_date_poids','der_date_taille','first_contact_date']

dfView = pd.read_csv('PatientsHTA.zip',engine='c',nrows=1,parse_dates=dateColumnNames)
df = pd.read_csv('PatientsHTA.zip',engine='c',parse_dates=dateColumnNames)
# %%
dropColumnNames = ['person_id','contact_id']
# Recherche des collonnes a enlever
dfGroupedByMoleculeLabel = df.groupby('molecule_label')[['short_name','long_name','Classe','product_atc_code','product_atc']].count()
dfGroupedByMoleculeLabel
# Ces colonnes représentent toutes la meme données donc nous pouvons les enlever. Nous garderons juste product_atc_code
dropColumnNames.append(['molecule_label','short_name','long_name','Classe','product_atc'])
#%%
# Nous vérifions que le cip est bien identique partout
dfGroupByCIP = df.groupby('cip')[['person_id']].count()
dfGroupByCIP

# Il y a plusieurs valeur de cip, donc on choisit de le garder ici, à voit si pour le peu de valeur différentes ça vaut vraiment le coup
# %%
dfGroupByFrequencyLabel = df.groupby('frequency_label')[['person_id']].count()
dfGroupByFrequencyLabel

#Les valeurs pour Mois et Semaine sont très faible (1 et 11 respectivement), nous ne les garderons donc pas pour le training
#%% [markedown]
# # Quelques graphiques
dfMedecinSpecialityCount = df.groupby(df.specialty_label)[['person_id']].count()
dfMedecinSpecialityCount.reset_index(inplace=True)

plt.bar(dfMedecinSpecialityCount['specialty_label'],dfMedecinSpecialityCount['person_id'])
plt.xlabel('specialty label')
plt.ylabel('count')
plt.xticks(rotation=33)
plt.show()
# On voit qu'il y a quand meme beaucoup médecin généraliste, a voir si ça ne vaut pas le cout de ne garder que ceux là pour l'apprentissage
# %%
dfShortName = df.groupby(df.short_name)[['person_id']].count()
dfShortName.reset_index(inplace=True)

plt.bar(dfShortName['short_name'],dfShortName['person_id'])
plt.xlabel('short_name')
plt.ylabel('count')
plt.xticks(rotation=90)
plt.show()

# Il y a plein de données avec de petite valeur, peut etre ne garder que les données avec une valeur minimale car les valeur trop petites risqueraient d'ajouter du bruit
# %%
