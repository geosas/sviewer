Fichier texte répertoriant toutes les modifications apportées au sviewer (correspondant à la fusion de time et retrodata).

L'objectif de cet add-ons est de combiner ces deux outils avec simfen, à appeler selon url/?c=simfen .

etc/customConfig_simfen.js
======================
Fichier de configuration résultant de la fusion de celui de retrodata, time et du fichier de configuration du sviewer de GeoSAS.
La déclaration de la langue est important pour lire le fichier etc/i18n.js.
Pour l'ajout de tuiles, penser à intégrer dans js/sviewer.js les informations nécessaires pour leur utilisation (ex : matrixIdsIGN).

index.html
======================
Dans ce fichier, pour conserver l'onglet permettant de faire des retours qui sera utilisé dans le cadre du projet SIMFEN, un nouvel
onglet contenant les outils du WPS SIMFEN est créé (attributs à renseigner, tableau de bord, graphique).

Ajout d'un element dans la balise <div> id="panelcontrols" </div> => Dashboard.

Ajout des élements qui vont être présent dans l'onglet Dashboard (Dashboard panel) en anglais dans le fichier index.html et ajout de la traduction fr dans
etc/i18n.js

Ajout de panel Dashboard dans le fichier de style (pour régler la localisation dans l'interface, la taille).