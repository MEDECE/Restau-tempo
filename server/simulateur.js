/**
 * simulateur.js — horloge simulée, arrivées automatiques, scénarios
 *
 * Vitesse par défaut ×60 : 1 s réelle = 1 min simulée.
 * L'horloge avance en continu ; à chaque tick on vérifie les événements programmés.
 *
 * Qui déclenche quoi :
 *   Simulateur (caméra) : ARRIVEE, INSTALLATION, PLAT_SERVI, PLAT_RETIRE,
 *                         DESSERT_SERVI, DESSERT_RETIRE, DEPART
 *   Serveur humain (app mobile) : COMMANDE, ADDITION
 *
 * Le simulateur attend donc le serveur sur ces deux étapes.
 * Quand le serveur saisit COMMANDE ou ADDITION, index.js appelle
 * reprendreApresActionServeur() pour programmer la suite caméra.
 */

const moteur = require('./moteur');

// ─── Constantes de durées simulées (en ms simulées) ────────────────────────
// Format : [min, max] en minutes → converties en ms
function ms(min, max) {
  const m = max === undefined ? min : min + Math.random() * (max - min);
  return Math.round(m * 60 * 1000);
}

const DUREES = {
  normal: {
    arriveeIntervalle:  [3, 8],   // min entre deux groupes
    installation:       [1, 3],
    commande:           [5, 10],
    cuisine:            [12, 18],
    platRetireAddition: [8, 15],
    dessertChance:      0.4,
    dessert:            [10, 20],
    dessertRetireAdd:   [5, 10],
    addition:           [5, 10],
  },
  rush: {
    arriveeIntervalle:  [1, 3],
    installation:       [1, 2],
    commande:           [3, 6],
    cuisine:            [18, 28],
    platRetireAddition: [6, 12],
    dessertChance:      0.3,
    dessert:            [8, 15],
    dessertRetireAdd:   [4, 8],
    addition:           [4, 8],
  },
  cuisine_lente: {
    arriveeIntervalle:  [3, 7],
    installation:       [1, 3],
    commande:           [5, 10],
    cuisine:            [28, 40],  // cuisine très lente → alertes garanties
    platRetireAddition: [8, 15],
    dessertChance:      0.4,
    dessert:            [10, 20],
    dessertRetireAdd:   [5, 10],
    addition:           [5, 10],
  },
};

// ─── État du simulateur ─────────────────────────────────────────────────────
let simTime       = Date.now() * 60;   // temps simulé initial (×60)
let vitesse       = 60;                // facteur de vitesse
let scenario      = 'normal';
let actif         = false;
let intervalId    = null;
let prochaineArrivee = 0;             // simTime de la prochaine arrivée

// File de callbacks pour diffuser les événements
let onEvenement   = null;   // (evt) => void
let onSnapshot    = null;   // () => void

const TICK_REEL_MS = 1000; // toutes les secondes réelles

// ─── Horloge ────────────────────────────────────────────────────────────────
function tick() {
  simTime += vitesse * TICK_REEL_MS; // avance le temps simulé

  // Vérifier les événements programmés
  traiterEvenementsAttendus();

  // Vérifier si un groupe peut être installé
  installerGroupesEnAttente();

  // Prochaine arrivée ?
  if (simTime >= prochaineArrivee) {
    planifierArrivee();
  }

  if (onSnapshot) onSnapshot();
}

// ─── Arrivée d'un groupe ─────────────────────────────────────────────────────
function planifierArrivee() {
  const d = DUREES[scenario];
  const [min, max] = d.arriveeIntervalle;
  prochaineArrivee = simTime + ms(min, max);
  const nbPersonnes = Math.floor(Math.random() * 5) + 2; // 2 à 6
  const evt = moteur.appliquerEvenement({ type: 'ARRIVEE', nbPersonnes, source: 'simulateur' }, simTime);
  if (onEvenement) onEvenement(evt);
}

// ─── Installation d'un groupe en file ───────────────────────────────────────
function installerGroupesEnAttente() {
  const file = moteur.fileAttente();
  for (const visite of file) {
    const libres = moteur.tablesLibres(visite.nbPersonnes);
    if (libres.length === 0) continue;

    // Choisir la table la plus petite qui convient (minimiser le gaspillage)
    libres.sort((a, b) => a.capacite - b.capacite);
    const table = libres[0];

    const evt = moteur.appliquerEvenement(
      { type: 'INSTALLATION', tableId: table.id, visiteId: visite.id, source: 'simulateur' },
      simTime
    );
    if (onEvenement) onEvenement(evt);
    // Programmer la suite
    programmerSuite(visite.id, 'INSTALLATION');
  }
}

// ─── Événements programmés ──────────────────────────────────────────────────
// Map<visiteId, { type, ts }>
const agenda = new Map();

/**
 * Programme le prochain événement CAMÉRA après une étape donnée.
 * COMMANDE et ADDITION sont des étapes serveur humain : pas programmées automatiquement.
 * Elles sont déclenchées par reprendreApresActionServeur() quand le serveur agit.
 */
function programmerSuite(visiteId, etapeActuelle) {
  const d = DUREES[scenario];

  switch (etapeActuelle) {
    // Après INSTALLATION : on attend que le serveur prenne la commande
    case 'INSTALLATION':
      return;

    // Après COMMANDE (saisie serveur) : la cuisine prépare → PLAT_SERVI auto
    case 'COMMANDE':
      agenda.set(visiteId, { type: 'PLAT_SERVI', ts: simTime + ms(...d.cuisine) });
      break;

    // Après PLAT_SERVI : les clients mangent → PLAT_RETIRE auto
    case 'PLAT_SERVI':
      agenda.set(visiteId, { type: 'PLAT_RETIRE', ts: simTime + ms(...d.platRetireAddition) });
      break;

    // Après PLAT_RETIRE : on attend que le serveur propose dessert ou addition
    case 'PLAT_RETIRE':
      return;

    // Après DESSERT_SERVI : les clients mangent → DESSERT_RETIRE auto
    case 'DESSERT_SERVI':
      agenda.set(visiteId, { type: 'DESSERT_RETIRE', ts: simTime + ms(...d.dessertRetireAdd) });
      break;

    // Après DESSERT_RETIRE : on attend que le serveur apporte l'addition
    case 'DESSERT_RETIRE':
      return;

    // Après ADDITION (saisie serveur) : les clients paient et partent → DEPART auto
    case 'ADDITION':
      agenda.set(visiteId, { type: 'DEPART', ts: simTime + ms(...d.addition) });
      break;

    default:
      return;
  }
}

/**
 * Appelé par index.js quand le serveur humain saisit COMMANDE ou ADDITION.
 * Programme les événements caméra qui suivent.
 */
function reprendreApresActionServeur(visiteId, typeAction) {
  programmerSuite(visiteId, typeAction);
}

function traiterEvenementsAttendus() {
  for (const [visiteId, entree] of agenda.entries()) {
    if (simTime >= entree.ts) {
      agenda.delete(visiteId);
      // Retrouver la visite pour connaître la tableId
      const etatCourant = moteur.etat();
      const visite = etatCourant.visites.get(visiteId);
      if (!visite) continue; // déjà partie

      const evt = moteur.appliquerEvenement(
        { type: entree.type, tableId: visite.tableId, visiteId, source: 'simulateur' },
        simTime
      );
      if (onEvenement) onEvenement(evt);
      if (entree.type !== 'DEPART') {
        programmerSuite(visiteId, entree.type);
      }
    }
  }
}

// ─── API publique ────────────────────────────────────────────────────────────
function demarrer(callbacks) {
  onEvenement = callbacks.onEvenement;
  onSnapshot  = callbacks.onSnapshot;

  simTime = Date.now() * vitesse; // partir du "maintenant" en accéléré
  prochaineArrivee = simTime + ms(1, 3); // première arrivée dans 1-3 min simulées

  actif = true;
  intervalId = setInterval(tick, TICK_REEL_MS);
}

function arreter() {
  if (intervalId) clearInterval(intervalId);
  actif = false;
}

function changerVitesse(v) {
  vitesse = v;
}

function changerScenario(nom) {
  if (nom === 'reset') {
    agenda.clear();
    moteur.reset();
    simTime = Date.now() * vitesse;
    prochaineArrivee = simTime + ms(1, 3);
    scenario = 'normal';
    return;
  }
  if (DUREES[nom]) scenario = nom;
}

function getSimTime()  { return simTime; }
function getVitesse()  { return vitesse; }

module.exports = { demarrer, arreter, changerVitesse, changerScenario, getSimTime, getVitesse, reprendreApresActionServeur };
