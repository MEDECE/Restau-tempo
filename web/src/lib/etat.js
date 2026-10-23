/**
 * etat.js — fonctions pures de calcul à partir d'un snapshot
 *
 * Règle d'or : jamais Date.now(). Toujours simTime.
 */

// ─── Couleurs par statut ──────────────────────────────────────────────────────
export const COULEURS = {
  LIBRE:          '#9CA3AF',
  ARRIVEE:        '#9CA3AF',
  INSTALLATION:   '#3B82F6',
  COMMANDE:       '#EAB308',
  PLAT_SERVI:     '#22C55E',
  PLAT_RETIRE:    '#14B8A6',
  DESSERT_SERVI:  '#A855F7',
  DESSERT_RETIRE: '#EC4899',
  ADDITION:       '#F97316',
  DEPART:         '#9CA3AF',
};

// ─── Libellés français ────────────────────────────────────────────────────────
export const LIBELLES = {
  LIBRE:          'Libre',
  ARRIVEE:        'En attente d\'une table',
  INSTALLATION:   'Installés',
  COMMANDE:       'Commande prise',
  PLAT_SERVI:     'Plat servi',
  PLAT_RETIRE:    'Plat déservi',
  DESSERT_SERVI:  'Dessert servi',
  DESSERT_RETIRE: 'Dessert terminé',
  ADDITION:       'Addition',
  DEPART:         'Parti',
};

// ─── Seuils d'alerte (minutes simulées) ──────────────────────────────────────
const SEUILS = {
  ARRIVEE:        10,
  INSTALLATION:   8,
  COMMANDE:       20,
  PLAT_RETIRE:    7,
  DESSERT_RETIRE: 5,
  ADDITION:       8,
};

// ─── Chrono visuel (indépendant des seuils d'alerte) ─────────────────────────
// Délai depuis la dernière étape :
//   < 30 min → vert   (service en cours, normal)
//   30–40 min → orange (attente longue)
//   > 40 min → rouge  (B prend le relais automatiquement)
export const CHRONO_SEUIL_ORANGE = 30; // minutes simulées
export const CHRONO_SEUIL_ROUGE  = 40; // minutes simulées

/**
 * Retourne la couleur du chrono pour une table.
 * 'vert' | 'orange' | 'rouge'
 */
export function couleurChrono(minutes) {
  if (minutes >= CHRONO_SEUIL_ROUGE)  return 'rouge';
  if (minutes >= CHRONO_SEUIL_ORANGE) return 'orange';
  return 'vert';
}

// ─── Chrono ───────────────────────────────────────────────────────────────────
/** Retourne les minutes simulées écoulées depuis la dernière étape d'une visite. */
export function minutesDepuisEtape(visite, simTime) {
  const ts = visite.etapes[visite.statut];
  if (!ts) return 0;
  return Math.floor((simTime - ts) / 60000);
}

/** Retourne les minutes simulées écoulées depuis l'arrivée d'une visite. */
export function minutesDepuisArrivee(visite, simTime) {
  const ts = visite.etapes['ARRIVEE'];
  if (!ts) return 0;
  return Math.floor((simTime - ts) / 60000);
}

// ─── Alertes ──────────────────────────────────────────────────────────────────
/**
 * Calcule l'alerte pour une visite.
 * Retourne null si pas de seuil pour ce statut.
 * Retourne { tableId, visiteId, niveau, message, minutes }
 */
export function calculerAlerte(visite, simTime) {
  const seuil = SEUILS[visite.statut];
  if (!seuil) return null;

  const minutes = minutesDepuisEtape(visite, simTime);
  const ratio   = minutes / seuil;

  if (ratio < 0.75) return null;

  const niveau = ratio >= 1 ? 'alerte' : 'warn';

  const messages = {
    ARRIVEE:        'Groupe en attente d\'une table',
    INSTALLATION:   'Prendre la commande',
    COMMANDE:       'Plat en retard, relancer la cuisine',
    PLAT_RETIRE:    'Proposer dessert ou addition',
    DESSERT_RETIRE: 'Apporter l\'addition',
    ADDITION:       'Encaisser',
  };

  return {
    tableId:  visite.tableId,
    visiteId: visite.id,
    niveau,
    message:  messages[visite.statut],
    minutes,
  };
}

/**
 * Retourne toutes les alertes actives (warn + alerte) pour toutes les visites en cours.
 */
export function calculerAlertes(visites, simTime) {
  return visites
    .map(v => calculerAlerte(v, simTime))
    .filter(Boolean);
}

// ─── Estimation de libération ─────────────────────────────────────────────────
/**
 * Retourne "libre dans ~X min" basé sur durée totale moyenne − temps écoulé.
 * Minimum 1 min.
 */
export function estimationLiberation(visite, simTime, moyenneDureeTotale) {
  if (!moyenneDureeTotale) return null;
  const ecoule  = minutesDepuisArrivee(visite, simTime);
  const restant = Math.max(1, Math.round(moyenneDureeTotale - ecoule));
  return restant;
}

// ─── Indicateurs (calculés sur l'historique) ─────────────────────────────────
/**
 * Calcule les moyennes en minutes sur un tableau de visites terminées.
 */
export function calculerMoyennes(historique) {
  function moyenne(arr) {
    const vals = arr.filter(v => v != null && v > 0);
    if (!vals.length) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  const attentTable      = [];
  const priseCommande    = [];
  const cuisine          = [];
  const apresPlat        = [];
  const encaissement     = [];
  const dureeTotale      = [];

  for (const v of historique) {
    const e = v.etapes;
    if (e.ARRIVEE && e.INSTALLATION)  attentTable.push((e.INSTALLATION - e.ARRIVEE)   / 60000);
    if (e.INSTALLATION && e.COMMANDE) priseCommande.push((e.COMMANDE - e.INSTALLATION) / 60000);
    if (e.COMMANDE && e.PLAT_SERVI)   cuisine.push((e.PLAT_SERVI - e.COMMANDE)         / 60000);
    if (e.PLAT_RETIRE) {
      const fin = e.DESSERT_SERVI || e.ADDITION;
      if (fin) apresPlat.push((fin - e.PLAT_RETIRE) / 60000);
    }
    if (e.ADDITION && e.DEPART)       encaissement.push((e.DEPART - e.ADDITION)        / 60000);
    if (e.ARRIVEE && e.DEPART)        dureeTotale.push((e.DEPART - e.ARRIVEE)           / 60000);
  }

  return {
    attentTable:   moyenne(attentTable),
    priseCommande: moyenne(priseCommande),
    cuisine:       moyenne(cuisine),
    apresPlat:     moyenne(apresPlat),
    encaissement:  moyenne(encaissement),
    dureeTotale:   moyenne(dureeTotale),
  };
}

// ─── Indicateurs en direct ────────────────────────────────────────────────────
export function calculerIndicateursDirec(tables, visites) {
  const visitesActives = visites.filter(v => v.tableId !== null);
  const tablesOccupees = new Set(visitesActives.map(v => v.tableId));
  const fileAttente    = visites.filter(v => v.tableId === null);

  return {
    tablesOccupees:  tablesOccupees.size,
    totalTables:     tables.length,
    couvertsEnSalle: visitesActives.reduce((sum, v) => sum + v.nbPersonnes, 0),
    groupesEnAttente: fileAttente.length,
  };
}

// ─── Vue enrichie par table ───────────────────────────────────────────────────
/**
 * Retourne pour chaque table son statut, couleur, visite, alerte, estimation.
 */
export function enrichirTables(snapshot) {
  const { tables, visites, historique, simTime } = snapshot;
  const moyennes = calculerMoyennes(historique);
  const alertesMap = {};
  calculerAlertes(visites, simTime).forEach(a => {
    if (a.tableId) alertesMap[a.tableId] = a;
  });

  return tables.map(table => {
    const visite = visites.find(v => v.tableId === table.id) || null;
    const statut = visite ? visite.statut : 'LIBRE';
    const alerte = alertesMap[table.id] || null;
    const minutes = visite ? minutesDepuisEtape(visite, simTime) : 0;
    const estimation = visite && moyennes.dureeTotale
      ? estimationLiberation(visite, simTime, moyennes.dureeTotale)
      : null;

    return {
      ...table,
      visite,
      statut,
      couleur:       COULEURS[statut],
      libelle:       LIBELLES[statut],
      alerte,
      minutes,
      chronoCouleur: visite ? couleurChrono(minutes) : null,
      estimation,
    };
  });
}
