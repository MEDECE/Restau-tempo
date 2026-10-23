/**
 * Gerant.jsx — vue grand écran du gérant
 *
 * La vue principale est la 3D de A (Salle3D).
 * Clic sur une table 3D → modale avec 2 choix :
 *   1. Passer à l'étape suivante
 *   2. Attendre encore 10 min (reset chrono)
 */

import { useState, Suspense, lazy } from 'react';
import {
  enrichirTables,
  calculerMoyennes,
  calculerIndicateursDirec,
  calculerAlertes,
  LIBELLES,
} from '../lib/etat';

const Salle3D = lazy(() => import('../three/Salle3D.jsx'));

const CHRONO_HEX = { vert: '#22C55E', orange: '#F97316', rouge: '#EF4444' };

// ─── Actions de la modale selon le statut ─────────────────────────────────────
const ACTIONS_MODALE = {
  INSTALLATION: {
    principale: { type: 'COMMANDE',      label: '✓ Commande prise — entrée + plat', couleur: '#3B82F6' },
  },
  PLAT_RETIRE: {
    principale: { type: 'DESSERT_SERVI', label: '🍮 Commander le dessert',            couleur: '#A855F7' },
    alt:        { type: 'ADDITION',      label: '💳 Addition directe (sans dessert)', couleur: '#F97316' },
  },
  DESSERT_RETIRE: {
    principale: { type: 'ADDITION', label: '💳 Régler et libérer la table', couleur: '#F97316' },
  },
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100vh',
    background: '#111827',
    color: '#f9fafb',
    fontFamily: 'system-ui, sans-serif',
    padding: '16px',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '12px', flexWrap: 'wrap', gap: '8px',
  },
  titre: { margin: 0, fontSize: '1.4rem', fontWeight: 700 },
  badge: (ok) => ({
    fontSize: '0.75rem', padding: '2px 10px', borderRadius: '999px',
    background: ok ? '#166534' : '#7f1d1d', color: ok ? '#bbf7d0' : '#fecaca',
  }),

  // Contrôles
  sectionControles: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' },
  btnGroupe: { display: 'flex', gap: '6px', alignItems: 'center' },
  btnLabel:  { fontSize: '0.8rem', color: '#9ca3af', marginRight: '4px' },
  btn: (actif) => ({
    padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
    fontWeight: 600, fontSize: '0.82rem',
    background: actif ? '#3b82f6' : '#374151',
    color: actif ? '#fff' : '#d1d5db',
  }),

  // Zone 3D — grande, prend la majorité de l'écran
  zone3D: {
    borderRadius: '14px',
    overflow: 'hidden',
    marginBottom: '16px',
    height: '65vh',
    minHeight: '420px',
    background: '#F5F6F8',
  },

  // File d'attente
  sectionFile:  { background: '#1f2937', borderRadius: '12px', padding: '12px', marginBottom: '16px' },
  sectionTitre: { fontWeight: 600, marginBottom: '8px', fontSize: '0.95rem' },
  fileItem: {
    display: 'flex', justifyContent: 'space-between',
    padding: '4px 0', fontSize: '0.85rem', borderBottom: '1px solid #374151',
  },

  // Indicateurs
  sectionIndicateurs: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '10px', marginBottom: '16px',
  },
  indicateur: { background: '#1f2937', borderRadius: '10px', padding: '10px 14px' },
  indLabel:   { fontSize: '0.72rem', color: '#9ca3af' },
  indValeur:  { fontSize: '1.2rem', fontWeight: 700 },

  // ─── Modale ──────────────────────────────────────────────────────────────
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modale: {
    background: '#1f2937', borderRadius: '16px',
    padding: '24px', width: '340px', maxWidth: '90vw', boxSizing: 'border-box',
  },
  modaleTitre:  { fontWeight: 700, fontSize: '1.15rem', marginBottom: '4px' },
  modaleStatut: { fontSize: '0.85rem', color: '#9ca3af', marginBottom: '20px' },
  modaleBtn: (couleur) => ({
    display: 'block', width: '100%', padding: '14px 16px',
    borderRadius: '10px', border: 'none', cursor: 'pointer',
    fontWeight: 700, fontSize: '0.95rem',
    background: couleur, color: '#fff',
    marginBottom: '10px', textAlign: 'left',
  }),
  modaleBtnAttendre: {
    display: 'block', width: '100%', padding: '13px 16px',
    borderRadius: '10px', border: '2px solid #374151', cursor: 'pointer',
    fontWeight: 600, fontSize: '0.9rem',
    background: 'transparent', color: '#22C55E',
    marginBottom: '10px', textAlign: 'left',
  },
  modaleBtnAnnuler: {
    display: 'block', width: '100%', padding: '11px',
    borderRadius: '10px', border: 'none', cursor: 'pointer',
    fontWeight: 600, fontSize: '0.88rem',
    background: '#374151', color: '#9ca3af', textAlign: 'center',
  },
};

const SCENARIOS       = ['normal', 'rush', 'cuisine_lente', 'reset'];
const SCENARIO_LABELS = { normal: 'Normal', rush: 'Rush', cuisine_lente: 'Cuisine lente', reset: 'Reset' };
const VITESSES        = [30, 60, 120];

// ─── Modale ────────────────────────────────────────────────────────────────────
function Modale({ table, onAction, onAttendre, onFermer }) {
  const { statut, numero, visite, minutes, chronoCouleur } = table;
  const actions    = ACTIONS_MODALE[statut] || {};
  const principale = actions.principale;
  const alt        = actions.alt;

  return (
    <div style={S.overlay} onClick={onFermer}>
      <div style={S.modale} onClick={e => e.stopPropagation()}>

        <div style={S.modaleTitre}>
          Table {numero}
          {visite && <span style={{ fontWeight: 400, color: '#9ca3af' }}> · {visite.nbPersonnes} pers.</span>}
        </div>
        <div style={S.modaleStatut}>
          {LIBELLES[statut]} —{' '}
          <span style={{ color: CHRONO_HEX[chronoCouleur] || '#f9fafb' }}>{minutes} min</span>
        </div>

        {principale && (
          <button style={S.modaleBtn(principale.couleur)} onClick={() => onAction(principale.type, table.id)}>
            {principale.label}
          </button>
        )}
        {alt && (
          <button style={S.modaleBtn(alt.couleur)} onClick={() => onAction(alt.type, table.id)}>
            {alt.label}
          </button>
        )}

        <button style={S.modaleBtnAttendre} onClick={() => onAttendre(table)}>
          ↺ Attendre encore 10 min
        </button>
        <button style={S.modaleBtnAnnuler} onClick={onFermer}>
          Annuler
        </button>
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function Gerant({ snapshot, envoyer, connecte }) {
  const [tableSelectionnee, setTableSelectionnee] = useState(null);

  const tables      = enrichirTables(snapshot);
  const moyennes    = calculerMoyennes(snapshot.historique);
  const indicateurs = calculerIndicateursDirec(snapshot.tables, snapshot.visites);
  const fileAttente = snapshot.visites.filter(v => v.tableId === null);

  // Alertes au format attendu par Salle3D : tableau de { tableId, niveau, ... }
  const alertes = calculerAlertes(snapshot.visites, snapshot.simTime);

  // Table sélectionnée toujours fraîche depuis le snapshot courant
  const tableModal = tableSelectionnee
    ? tables.find(t => t.id === tableSelectionnee) || null
    : null;

  function declarer(type, tableId) {
    envoyer({ kind: 'event', event: { type, tableId, source: 'serveur' } });
    setTableSelectionnee(null);
  }

  function attendre(table) {
    envoyer({ kind: 'event', event: { type: table.statut, tableId: table.id, source: 'serveur' } });
    setTableSelectionnee(null);
  }

  return (
    <div style={S.page}>

      {/* Modale */}
      {tableModal && tableModal.statut !== 'LIBRE' && (
        <Modale
          table={tableModal}
          onAction={declarer}
          onAttendre={attendre}
          onFermer={() => setTableSelectionnee(null)}
        />
      )}

      {/* En-tête */}
      <div style={S.header}>
        <h1 style={S.titre}>TableFlow — Gérant</h1>
        <span style={S.badge(connecte)}>{connecte ? '● En direct' : '○ Hors ligne'}</span>
      </div>

      {/* Contrôles */}
      <div style={S.sectionControles}>
        <div style={S.btnGroupe}>
          <span style={S.btnLabel}>Scénario :</span>
          {SCENARIOS.map(s => (
            <button key={s} style={S.btn(false)} onClick={() => envoyer({ kind: 'scenario', nom: s })}>
              {SCENARIO_LABELS[s]}
            </button>
          ))}
        </div>
        <div style={S.btnGroupe}>
          <span style={S.btnLabel}>Vitesse :</span>
          {VITESSES.map(v => (
            <button key={v} style={S.btn(v === snapshot.vitesse)} onClick={() => envoyer({ kind: 'vitesse', valeur: v })}>
              ×{v}
            </button>
          ))}
        </div>
      </div>

      {/* ── VUE 3D de A ── */}
      <Suspense fallback={
        <div style={{ ...S.zone3D, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', background: '#1f2937' }}>
          Chargement 3D…
        </div>
      }>
        <div style={S.zone3D}>
          <Salle3D
            snapshot={snapshot}
            alertes={alertes}
            tableSelectionnee={tableSelectionnee}
            onSelectTable={setTableSelectionnee}
          />
        </div>
      </Suspense>

      {/* File d'attente */}
      <div style={S.sectionFile}>
        <div style={S.sectionTitre}>
          Entrée — file d'attente ({fileAttente.length} groupe{fileAttente.length !== 1 ? 's' : ''})
        </div>
        {fileAttente.length === 0 ? (
          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Aucun groupe en attente</div>
        ) : (
          fileAttente.map(v => {
            const min = Math.floor((snapshot.simTime - v.etapes.ARRIVEE) / 60000);
            return (
              <div key={v.id} style={S.fileItem}>
                <span>{v.nbPersonnes} personnes</span>
                <span style={{ color: min >= 10 ? '#fca5a5' : '#9ca3af' }}>{min} min d'attente</span>
              </div>
            );
          })
        )}
      </div>

      {/* Indicateurs */}
      <div style={S.sectionIndicateurs}>
        <div style={S.indicateur}><div style={S.indLabel}>Tables occupées</div><div style={S.indValeur}>{indicateurs.tablesOccupees} / {indicateurs.totalTables}</div></div>
        <div style={S.indicateur}><div style={S.indLabel}>Couverts en salle</div><div style={S.indValeur}>{indicateurs.couvertsEnSalle}</div></div>
        <div style={S.indicateur}><div style={S.indLabel}>Groupes en attente</div><div style={S.indValeur}>{indicateurs.groupesEnAttente}</div></div>
        {moyennes.cuisine       != null && <div style={S.indicateur}><div style={S.indLabel}>Moy. cuisine</div><div style={S.indValeur}>{moyennes.cuisine} min</div></div>}
        {moyennes.dureeTotale   != null && <div style={S.indicateur}><div style={S.indLabel}>Moy. repas total</div><div style={S.indValeur}>{moyennes.dureeTotale} min</div></div>}
        {moyennes.attentTable   != null && <div style={S.indicateur}><div style={S.indLabel}>Moy. attente table</div><div style={S.indValeur}>{moyennes.attentTable} min</div></div>}
        {moyennes.priseCommande != null && <div style={S.indicateur}><div style={S.indLabel}>Moy. prise commande</div><div style={S.indValeur}>{moyennes.priseCommande} min</div></div>}
        {moyennes.encaissement  != null && <div style={S.indicateur}><div style={S.indLabel}>Moy. encaissement</div><div style={S.indValeur}>{moyennes.encaissement} min</div></div>}
      </div>

    </div>
  );
}
