/**
 * conseils.js — génère les notifications pour le serveur
 * en fonction du statut et du temps d'attente de chaque table.
 *
 * Renvoie jusqu'à 5 conseils triés par urgence décroissante.
 * { tableId, numero, priorite, action, minutesDepuisEtape, seuil }
 */

// Seuils en minutes simulées (source : section 9 du contexte)
const REGLES = [
  { statut: 'INSTALLATION',   seuil: 8,  action: 'Prendre la commande' },
  { statut: 'COMMANDE',       seuil: 20, action: 'Relancer la cuisine' },
  { statut: 'PLAT_RETIRE',    seuil: 7,  action: 'Proposer dessert ou addition' },
  { statut: 'DESSERT_RETIRE', seuil: 5,  action: 'Apporter l\'addition' },
  { statut: 'ADDITION',       seuil: 8,  action: 'Encaisser' },
  { statut: 'ARRIVEE',        seuil: 10, action: 'Placer le groupe en salle' },
];

const SEUIL_PAR_STATUT = Object.fromEntries(REGLES.map(r => [r.statut, r]));

/**
 * @param {object} payload
 *   payload.simTime      — temps simulé courant (ms)
 *   payload.tables       — tableau de Table  (id, numero, capacite…)
 *   payload.visites      — visites en cours (tableId peut être null = file)
 */
function genererConseils({ simTime, tables, visites }) {
  const tableParId = Object.fromEntries(tables.map(t => [t.id, t]));
  const candidats = [];

  for (const visite of visites) {
    const regle = SEUIL_PAR_STATUT[visite.statut];
    if (!regle) continue; // PLAT_SERVI, DESSERT_SERVI, DEPART → pas d'action attendue

    const tsEtape = visite.etapes[visite.statut];
    if (!tsEtape) continue;

    const minutesDepuisEtape = Math.floor((simTime - tsEtape) / 60000);
    const ratio = minutesDepuisEtape / regle.seuil;

    // On notifie à partir de 75 % du seuil (warn) ou 100 % (alerte)
    if (ratio < 0.75) continue;

    const table = visite.tableId ? tableParId[visite.tableId] : null;
    const niveau = ratio >= 1 ? 'alerte' : 'warn';

    candidats.push({
      tableId: visite.tableId,
      visiteId: visite.id,
      numero: table ? table.numero : null,   // null = file d'attente
      action: regle.action,
      niveau,
      minutesDepuisEtape,
      seuil: regle.seuil,
      _ratio: ratio,                          // utilisé pour le tri, non exposé
    });
  }

  // Tri : alertes avant warns, puis par ratio décroissant
  candidats.sort((a, b) => {
    if (a.niveau !== b.niveau) return a.niveau === 'alerte' ? -1 : 1;
    return b._ratio - a._ratio;
  });

  return candidats.slice(0, 5).map((c, i) => {
    const { _ratio, ...conseil } = c;
    conseil.priorite = i + 1;
    return conseil;
  });
}

module.exports = { genererConseils };
