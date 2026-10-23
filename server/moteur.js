/**
 * moteur.js — applique un événement à l'état en mémoire
 *
 * État global :
 *   tables   : tableau de Table (immuable, chargé au démarrage)
 *   visites  : Map<id, Visite> — visites en cours (file d'attente comprise)
 *   historique : Visite[] — 50 dernières visites terminées
 *   compteurs : { visiteCpt, eventCpt }
 */

const TABLES_INITIALES = [
  { id: 'T1', numero: 1, capacite: 2, forme: 'ronde',     x: -3,  z: -2 },
  { id: 'T2', numero: 2, capacite: 2, forme: 'ronde',     x: -3,  z:  2 },
  { id: 'T3', numero: 3, capacite: 4, forme: 'carree',    x:  0.5, z: -2 },
  { id: 'T4', numero: 4, capacite: 4, forme: 'carree',    x:  0.5, z:  2 },
  { id: 'T5', numero: 5, capacite: 6, forme: 'rectangle', x:  4,  z: -2 },
  { id: 'T6', numero: 6, capacite: 4, forme: 'carree',    x:  4,  z:  2 },
];

let etat = creerEtatInitial();

function creerEtatInitial() {
  return {
    tables: TABLES_INITIALES,
    visites: new Map(),
    historique: [],
    compteurs: { visiteCpt: 0, eventCpt: 0 },
  };
}

function reset() {
  etat = creerEtatInitial();
}

/** Renvoie un snapshot sérialisable (les Maps → tableaux). */
function snapshot(simTime, vitesse) {
  return {
    kind: 'snapshot',
    simTime,
    vitesse,
    tables: etat.tables,
    visites: Array.from(etat.visites.values()),
    historique: etat.historique,
  };
}

/**
 * Applique un événement brut (id / visiteId / ts complétés ici si absents).
 * Renvoie l'événement enrichi.
 */
function appliquerEvenement(evt, simTime) {
  etat.compteurs.eventCpt += 1;
  const id  = evt.id  || `E${etat.compteurs.eventCpt}`;
  const ts  = evt.ts  || simTime;
  const type = evt.type;

  const evenement = { id, type, tableId: evt.tableId ?? null, visiteId: null, ts, source: evt.source || 'simulateur' };

  if (type === 'ARRIVEE') {
    etat.compteurs.visiteCpt += 1;
    const visiteId = `V${etat.compteurs.visiteCpt}`;
    const visite = {
      id: visiteId,
      tableId: null,
      nbPersonnes: evt.nbPersonnes || 2,
      statut: 'ARRIVEE',
      etapes: { ARRIVEE: ts },
    };
    etat.visites.set(visiteId, visite);
    evenement.visiteId = visiteId;
    return evenement;
  }

  // Pour tous les autres types, on retrouve la visite via tableId ou visiteId
  let visite = null;
  if (evt.visiteId) {
    visite = etat.visites.get(evt.visiteId);
  } else if (evt.tableId) {
    visite = Array.from(etat.visites.values()).find(v => v.tableId === evt.tableId);
  }

  if (!visite) return evenement; // événement orphelin, on l'ignore silencieusement

  evenement.visiteId = visite.id;

  if (type === 'INSTALLATION') {
    visite.tableId = evt.tableId;
    visite.statut  = 'INSTALLATION';
    visite.etapes.INSTALLATION = ts;
  } else if (type === 'DEPART') {
    visite.statut = 'DEPART';
    visite.etapes.DEPART = ts;
    // Déplacer dans l'historique
    etat.visites.delete(visite.id);
    etat.historique.unshift(visite);
    if (etat.historique.length > 50) etat.historique.length = 50;
  } else {
    // COMMANDE, PLAT_SERVI, PLAT_RETIRE, DESSERT_SERVI, DESSERT_RETIRE, ADDITION
    visite.statut = type;
    visite.etapes[type] = ts;
  }

  return evenement;
}

/** Renvoie la visite en cours sur une table (ou null). */
function visiteParTable(tableId) {
  return Array.from(etat.visites.values()).find(v => v.tableId === tableId) || null;
}

/** Renvoie les visites de la file d'attente (tableId === null). */
function fileAttente() {
  return Array.from(etat.visites.values()).filter(v => v.tableId === null);
}

/** Renvoie les tables libres avec capacite >= nbPersonnes. */
function tablesLibres(nbPersonnes = 1) {
  const tablesOccupees = new Set(
    Array.from(etat.visites.values()).filter(v => v.tableId).map(v => v.tableId)
  );
  return etat.tables.filter(t => !tablesOccupees.has(t.id) && t.capacite >= nbPersonnes);
}

module.exports = { snapshot, appliquerEvenement, visiteParTable, fileAttente, tablesLibres, reset, etat: () => etat };
