# CONTEXTE PROJET — TableFlow (nom provisoire)

> Fichier partagé par toute l'équipe. **Collez-le en entier au début de chaque conversation avec Claude.**
> Il est la seule source de vérité : modèle de données, messages, couleurs, seuils.
> Après T+0:15, on ne modifie plus les sections 6 à 10 sans prévenir les trois membres.

---

## 1. Le projet en une phrase

Un CRM de pilotage de salle de restaurant en temps réel. Une caméra (simulée) détecte les étapes du repas à chaque table. Le gérant voit sa salle en 3D avec un chrono par table. Le serveur reçoit sur son téléphone les tables à traiter en priorité, avec des conseils générés par l'IA IBM (watsonx / Granite). Objectif : **aucune table n'attend trop longtemps**.

## 2. Utilisateurs

| Utilisateur | Écran | Ce qu'il fait |
|---|---|---|
| Gérant | Ordinateur (grand écran) | Voit la salle en 3D, les indicateurs moyens, les alertes, la file d'attente |
| Serveur | **Téléphone** | Voit ses tables triées par urgence, les conseils IA, déclare une étape d'un tap (« Commande prise »…) |

Pas la cuisine. Pas de fiche client.

## 3. Périmètre

**Dans le projet :** 6 tables, cycle complet d'une visite, file d'attente à l'entrée, chronos, alertes d'attente, indicateurs moyens, estimation de libération des tables, conseils IA IBM, simulateur temps réel, vue mobile serveur.

**Hors projet :** réservation, carte et menu, stock, paiement, cuisine, fiche client, authentification, vraie caméra, reconnaissance faciale.

## 4. Grille d'évaluation (4 × 5 points) et ce qu'on y répond

| Critère | Notre réponse |
|---|---|
| 01 Pertinence | Le besoin réel : en plein service, personne ne voit depuis combien de temps chaque table attend |
| 02 Innovation et **IA IBM** | Vision (simulée) pour détecter les étapes + **IBM Granite** qui transforme les chronos en actions priorisées |
| 03 Technique et UX, **prototype mobile** | Temps réel WebSocket, vue serveur mobile, 3D gérant, démo live qui ne plante pas |
| 04 Équipe et pitch | Contrat de données d'abord, 3 rôles parallèles, chacun présente sa partie |

## 5. Stack et structure

- `server/` : Node.js 20, `express`, `ws`, `dotenv`. Port **3001**. WebSocket sur `/ws`, HTTP sur `/api/...`. Tout en mémoire, pas de base de données.
- `web/` : React + Vite, **JavaScript (pas TypeScript)**, `three`, `@react-three/fiber`, `@react-three/drei`. Lancer avec `npm run dev -- --host` pour que le téléphone y accède sur le même Wi-Fi.
- Pas de react-router : la vue se choisit avec l'URL `?vue=gerant` (défaut) ou `?vue=serveur`.

```
/CONTEXT.md
/server/                 → B
  index.js               express + ws, routes
  moteur.js              applique un événement à l'état
  simulateur.js          horloge simulée, arrivées, durées, scénarios
  ibm.js                 appel watsonx + secours par règles
  .env                   (jamais commité)
/web/                    → C (crée le projet au kickoff)
  test3d.html            → A (page de test de la 3D)
  src/App.jsx            choisit la vue
  src/lib/useSalle.js    connexion WebSocket
  src/lib/etat.js        chronos, alertes, indicateurs, estimations
  src/vues/Gerant.jsx
  src/vues/Serveur.jsx
  src/mock/snapshot.json données factices (section 11)
  src/three/             → A
    Salle3D.jsx          composant exporté
    test.jsx             point d'entrée de test3d.html
```

**Règle d'or : chacun ne modifie que ses fichiers.** A ne touche que `web/src/three/` et `web/test3d.html`. B ne touche que `server/`. C possède le reste de `web/`.

URL du serveur côté web : `const SERVER = import.meta.env.VITE_SERVER_URL || \`http://${location.hostname}:3001\``

## 6. Le temps

- Toutes les heures sont en **temps simulé**, en millisecondes epoch.
- Chaque snapshot contient `simTime` = « maintenant ». **Les chronos se calculent toujours avec `simTime - horodatage`, jamais avec `Date.now()` côté web.**
- Vitesse par défaut **×60** : 1 seconde réelle = 1 minute simulée. Un repas complet (≈ 75 min) se joue en ≈ 75 s.
- Les durées affichées sont en minutes simulées, arrondies (« 12 min »).

## 7. Modèle de données

**Table**
```json
{ "id": "T3", "numero": 3, "capacite": 4, "forme": "carree", "x": 0.5, "z": -2 }
```
- `forme` : `"ronde"` | `"carree"` | `"rectangle"`
- `x`, `z` en mètres. Salle de 12 m (x de -6 à 6) × 8 m (z de -4 à 4). **Entrée** au point `x: -6, z: 0` (milieu du mur gauche).

**Visite** (un groupe de clients, de l'entrée au départ)
```json
{ "id": "V17", "tableId": "T3", "nbPersonnes": 4, "statut": "COMMANDE",
  "etapes": { "ARRIVEE": 1792749480000, "INSTALLATION": 1792749540000, "COMMANDE": 1792750080000 } }
```
- `statut` = **type du dernier événement reçu**. Pas d'autre liste de statuts.
- `tableId` vaut `null` tant que le groupe est dans la file d'attente (statut `ARRIVEE`).
- Une table sans visite en cours est **LIBRE**.

**Événement**
```json
{ "id": "E57", "type": "COMMANDE", "tableId": "T3", "visiteId": "V17",
  "ts": 1792750080000, "source": "serveur" }
```
- `source` : `"camera"` | `"serveur"` | `"simulateur"`
- `ARRIVEE` contient en plus `"nbPersonnes"` et `tableId: null`.
- `INSTALLATION` porte le `tableId` attribué.

## 8. Cycle d'une visite

| Ordre | Type | Source simulée | Sens | Couleur |
|---|---|---|---|---|
| — | (LIBRE) | — | Table vide | `#9CA3AF` gris |
| 1 | `ARRIVEE` | camera | Groupe entré, attend une table (file d'attente) | — (affiché à l'entrée) |
| 2 | `INSTALLATION` | camera | Assis, attend de commander | `#3B82F6` bleu |
| 3 | `COMMANDE` | serveur | Commande prise, attend son plat | `#EAB308` jaune |
| 4 | `PLAT_SERVI` | camera | Mange | `#22C55E` vert |
| 5 | `PLAT_RETIRE` | camera | Assiettes retirées, attend dessert ou addition | `#14B8A6` turquoise |
| 6 | `DESSERT_SERVI` | camera | Mange le dessert (facultatif) | `#A855F7` violet |
| 7 | `DESSERT_RETIRE` | camera | Dessert retiré, attend l'addition | `#EC4899` rose |
| 8 | `ADDITION` | serveur | Addition apportée, paie | `#F97316` orange |
| 9 | `DEPART` | camera | Parti → visite dans l'historique, table LIBRE | — |

- `DESSERT_SERVI` et `DESSERT_RETIRE` sont facultatifs : une visite peut passer de `PLAT_RETIRE` directement à `ADDITION`.
- Couleur d'alerte : `#EF4444` rouge (halo ou contour, la couleur de statut reste visible).

Libellés français à afficher :
`ARRIVEE` « En attente d'une table » · `INSTALLATION` « Installés » · `COMMANDE` « Commande prise » · `PLAT_SERVI` « Plat servi » · `PLAT_RETIRE` « Plat terminé » · `DESSERT_SERVI` « Dessert servi » · `DESSERT_RETIRE` « Dessert terminé » · `ADDITION` « Addition » · LIBRE « Libre »

## 9. Alertes d'attente

Minutes simulées écoulées depuis la dernière étape (`simTime - etapes[statut]`) :

| Statut | Seuil | Message |
|---|---|---|
| `ARRIVEE` | 10 min | Groupe en attente d'une table |
| `INSTALLATION` | 8 min | Prendre la commande |
| `COMMANDE` | 20 min | Plat en retard, relancer la cuisine |
| `PLAT_RETIRE` | 7 min | Proposer dessert ou addition |
| `DESSERT_RETIRE` | 5 min | Apporter l'addition |
| `ADDITION` | 8 min | Encaisser |

- Niveau `"warn"` à partir de 75 % du seuil, `"alerte"` à partir de 100 %.
- Format calculé par C dans `etat.js` et passé à la 3D :
```json
{ "tableId": "T3", "visiteId": "V17", "niveau": "alerte", "message": "Plat en retard, relancer la cuisine", "minutes": 22 }
```
(pour la file d'attente, `tableId` vaut `null`)

## 10. Messages temps réel (WebSocket `/ws`)

**Serveur → web**
- `{"kind":"snapshot", "simTime", "vitesse", "tables", "visites", "historique"}` : toutes les secondes réelles et juste après chaque événement. `visites` = visites en cours (file d'attente comprise). `historique` = 50 dernières visites terminées.
- `{"kind":"event", "event": Evenement}` : à chaque événement (fil d'activité, animations).

**Web → serveur**
- `{"kind":"event", "event": {"type":"PLAT_SERVI", "tableId":"T3", "source":"serveur"}}` : le serveur complète `id`, `visiteId`, `ts`, applique, reprogramme la suite de cette visite et diffuse.
- `{"kind":"scenario", "nom": "normal" | "rush" | "cuisine_lente" | "reset"}`
- `{"kind":"vitesse", "valeur": 30 | 60 | 120}`

**HTTP**
- `GET /api/snapshot` → le snapshot courant (utile pour tester).
- `POST /api/conseils` → conseils IA (section 12).

## 11. Données factices (à copier dans `web/src/mock/snapshot.json`)

Il est 12h30. T1 libre (trop petite pour le groupe de 5 qui attend à l'entrée). T3 est **en alerte** (plat attendu depuis 22 min). T5 est en **warn** (assiettes retirées depuis 6 min).

```json
{
  "kind": "snapshot",
  "simTime": 1792751400000,
  "vitesse": 60,
  "tables": [
    {"id": "T1", "numero": 1, "capacite": 2, "forme": "ronde", "x": -3, "z": -2},
    {"id": "T2", "numero": 2, "capacite": 2, "forme": "ronde", "x": -3, "z": 2},
    {"id": "T3", "numero": 3, "capacite": 4, "forme": "carree", "x": 0.5, "z": -2},
    {"id": "T4", "numero": 4, "capacite": 4, "forme": "carree", "x": 0.5, "z": 2},
    {"id": "T5", "numero": 5, "capacite": 6, "forme": "rectangle", "x": 4, "z": -2},
    {"id": "T6", "numero": 6, "capacite": 4, "forme": "carree", "x": 4, "z": 2}
  ],
  "visites": [
    {"id": "V21", "tableId": "T2", "nbPersonnes": 2, "statut": "INSTALLATION", "etapes": {"ARRIVEE": 1792751100000, "INSTALLATION": 1792751160000}},
    {"id": "V17", "tableId": "T3", "nbPersonnes": 4, "statut": "COMMANDE", "etapes": {"ARRIVEE": 1792749480000, "INSTALLATION": 1792749540000, "COMMANDE": 1792750080000}},
    {"id": "V18", "tableId": "T4", "nbPersonnes": 3, "statut": "PLAT_SERVI", "etapes": {"ARRIVEE": 1792749000000, "INSTALLATION": 1792749060000, "COMMANDE": 1792749420000, "PLAT_SERVI": 1792750680000}},
    {"id": "V15", "tableId": "T5", "nbPersonnes": 6, "statut": "PLAT_RETIRE", "etapes": {"ARRIVEE": 1792747680000, "INSTALLATION": 1792747740000, "COMMANDE": 1792748160000, "PLAT_SERVI": 1792749120000, "PLAT_RETIRE": 1792751040000}},
    {"id": "V14", "tableId": "T6", "nbPersonnes": 4, "statut": "DESSERT_SERVI", "etapes": {"ARRIVEE": 1792747200000, "INSTALLATION": 1792747260000, "COMMANDE": 1792747620000, "PLAT_SERVI": 1792748580000, "PLAT_RETIRE": 1792750380000, "DESSERT_SERVI": 1792751100000}},
    {"id": "V22", "tableId": null, "nbPersonnes": 5, "statut": "ARRIVEE", "etapes": {"ARRIVEE": 1792751220000}}
  ],
  "historique": [
    {"id": "V12", "tableId": "T1", "nbPersonnes": 2, "statut": "DEPART", "etapes": {"ARRIVEE": 1792745700000, "INSTALLATION": 1792745760000, "COMMANDE": 1792746120000, "PLAT_SERVI": 1792747080000, "PLAT_RETIRE": 1792748700000, "ADDITION": 1792749000000, "DEPART": 1792749300000}},
    {"id": "V11", "tableId": "T3", "nbPersonnes": 4, "statut": "DEPART", "etapes": {"ARRIVEE": 1792744800000, "INSTALLATION": 1792744860000, "COMMANDE": 1792745280000, "PLAT_SERVI": 1792746300000, "PLAT_RETIRE": 1792747800000, "DESSERT_SERVI": 1792748280000, "DESSERT_RETIRE": 1792748940000, "ADDITION": 1792749180000, "DEPART": 1792749420000}},
    {"id": "V10", "tableId": "T6", "nbPersonnes": 3, "statut": "DEPART", "etapes": {"ARRIVEE": 1792744200000, "INSTALLATION": 1792744440000, "COMMANDE": 1792744800000, "PLAT_SERVI": 1792745640000, "PLAT_RETIRE": 1792747200000, "DESSERT_SERVI": 1792747680000, "DESSERT_RETIRE": 1792748340000, "ADDITION": 1792748640000, "DEPART": 1792748940000}}
  ]
}
```

## 12. IA IBM — conseils au serveur

`POST /api/conseils` (implémenté par B, appelé par C toutes les 15 s réelles et sur bouton).

Requête envoyée par le web :
```json
{ "simTime": 1792751400000,
  "tables": [ { "tableId": "T3", "numero": 3, "statut": "COMMANDE", "nbPersonnes": 4, "minutesDepuisEtape": 22, "seuil": 20 } ],
  "fileAttente": [ { "visiteId": "V22", "nbPersonnes": 5, "minutes": 3 } ],
  "moyennes": { "cuisine": 15, "dureeTotale": 72 } }
```

Réponse :
```json
{ "source": "ibm-granite",
  "conseils": [ { "tableId": "T3", "priorite": 1, "action": "Relancer la cuisine", "raison": "Plat attendu depuis 22 min, moyenne 15 min" } ] }
```
- 5 conseils maximum, `priorite` 1 = le plus urgent, `action` courte (6 mots max), `raison` courte (15 mots max).
- Si IBM ne répond pas ou renvoie un JSON invalide : mêmes conseils calculés par règles et `"source": "regles"`. Le web affiche un badge « IBM Granite » ou « Règles (secours) ».
- La clé IBM reste **côté serveur** dans `server/.env`, jamais dans le web ni dans Git.

## 13. Indicateurs (calculés par C dans `etat.js`)

Moyennes sur l'historique, en minutes :
- Attente d'une table : `ARRIVEE → INSTALLATION`
- Prise de commande : `INSTALLATION → COMMANDE`
- Cuisine : `COMMANDE → PLAT_SERVI`
- Après le plat : `PLAT_RETIRE → DESSERT_SERVI` ou `ADDITION`
- Encaissement : `ADDITION → DEPART`
- Durée totale : `ARRIVEE → DEPART`

En direct : tables occupées / 6, couverts en salle, groupes en file d'attente, alertes actives.

**Estimation de libération** d'une table : durée totale moyenne − temps écoulé depuis `ARRIVEE` (minimum 1 min). Affichée « libre dans ~X min ». C'est une estimation statistique, on la présente comme telle.

## 14. Planning (T = début des 4 h)

| Quand | Qui | Quoi |
|---|---|---|
| T+0:00 → 0:15 | Tous | Lire ce fichier, créer le dépôt Git. C crée `web/` et pousse. B crée `server/` et **teste l'accès IBM tout de suite** |
| T+0:15 → 1:30 | Chacun | A : salle et tables en 3D sur données factices. B : serveur, moteur, simulateur. C : `etat.js`, `useSalle.js`, vue gérant en 2D |
| T+1:30 | Tous | Point de 5 min : chacun montre ce qui tourne |
| T+1:30 → 2:15 | Chacun | A : étiquettes, chronos, alertes. B : messages entrants, scénarios, IBM. C : vue serveur mobile |
| T+2:15 → 2:35 | Tous | **Branchement complet** : 3D dans la vue gérant, vrai serveur, téléphone sur le Wi-Fi |
| T+2:35 → 3:15 | Chacun | Finitions, conseils IA visibles. A passe sur le pitch dès que la 3D est stable |
| **T+3:15** | Tous | **Plus aucune nouvelle fonctionnalité** |
| T+3:15 → 3:40 | Tous | Bugs, scénario de démo joué 2 fois en entier |
| T+3:40 → 4:00 | Tous | Répétition du pitch chronométrée |

Plan B si la 3D bloque à T+2:15 : la vue gérant garde la grille 2D de C (couleurs et chronos identiques).

## 15. Scénario de démo live

1. Écran gérant, vitesse ×60, salle calme : expliquer couleurs et chronos.
2. Bouton **Rush** : la salle se remplit, un groupe attend à l'entrée, les estimations « libre dans ~X min » apparaissent.
3. Bouton **Cuisine lente** : une table passe en rouge, le conseil IBM arrive sur le téléphone.
4. **Moment fort** : sur le téléphone, le serveur tape « Plat servi » → la table change de couleur en direct sur la 3D.
5. Indicateurs : temps moyens par étape, ce que le gérant apprend sur son service.

## 16. Conventions

- Noms de variables et commentaires en français, cohérents avec ce fichier (`tableId`, `visiteId`, `etapes`, `simTime`).
- Commits petits et fréquents, `git pull` avant chaque `push`.
- Ne jamais laisser `main` cassé : on pousse seulement ce qui tourne.
