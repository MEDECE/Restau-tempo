/**
 * Gerant.jsx — vue grand écran du gérant
 *
 * Clic sur une table 3D → panneau latéral (design de A) avec :
 *   - Historique des étapes (parcours)
 *   - Boutons d'action en bas (selon le statut)
 *   - Bouton "Attendre encore 10 min"
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

// ─── Étapes (repris du design de A) ──────────────────────────────────────────
const ETAPES_ORDRE = [
  'ARRIVEE', 'INSTALLATION', 'COMMANDE',
  'PLAT_SERVI', 'PLAT_RETIRE',
  'DESSERT_SERVI', 'DESSERT_RETIRE',
  'ADDITION', 'DEPART',
]
const ETAPES_LIBELLE = {
  ARRIVEE:        'Arrivée',
  INSTALLATION:   'Installés',
  COMMANDE:       'Commande prise',
  PLAT_SERVI:     'Plat servi',
  PLAT_RETIRE:    'Plat déservi',
  DESSERT_SERVI:  'Dessert servi',
  DESSERT_RETIRE: 'Dessert terminé',
  ADDITION:       'Addition',
  DEPART:         'Départ',
}
const ETAPES_ICONE = {
  ARRIVEE:        '🚪',
  INSTALLATION:   '🪑',
  COMMANDE:       '📋',
  PLAT_SERVI:     '🍽️',
  PLAT_RETIRE:    '✅',
  DESSERT_SERVI:  '🍮',
  DESSERT_RETIRE: '✅',
  ADDITION:       '💳',
  DEPART:         '👋',
}
const COULEUR_ETAPE = {
  ARRIVEE:        '#94A3B8',
  INSTALLATION:   '#93C5FD',
  COMMANDE:       '#FCD34D',
  PLAT_SERVI:     '#6EE7B7',
  PLAT_RETIRE:    '#5EEAD4',
  DESSERT_SERVI:  '#4ADE80',
  DESSERT_RETIRE: '#F9A8D4',
  ADDITION:       '#FDBA74',
  DEPART:         '#CBD5E1',
}

function formatMinutes(ms) {
  const m = Math.floor(ms / 60000)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}
function formatHeure(ts) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`
}

// ─── Actions disponibles selon le statut ─────────────────────────────────────
const ACTIONS = {
  INSTALLATION: [
    { type: 'COMMANDE',      label: '✓ Commande prise',         couleur: '#3B82F6' },
  ],
  PLAT_RETIRE: [
    { type: 'DESSERT_SERVI', label: '🍮 Commander le dessert',   couleur: '#A855F7' },
    { type: 'ADDITION',      label: '💳 Addition (sans dessert)', couleur: '#F97316' },
  ],
  DESSERT_RETIRE: [
    { type: 'ADDITION',      label: '💳 Régler et libérer',       couleur: '#F97316' },
  ],
}

// ─── Panneau latéral (design A + boutons C) ───────────────────────────────────
function PanneauDetail({ tableId, snapshot, onAction, onAttendre, onFermer }) {
  if (!tableId || !snapshot) return null

  const table   = snapshot.tables?.find(t => t.id === tableId)
  const visite  = snapshot.visites?.find(v => v.tableId === tableId)
  const simTime = snapshot.simTime

  if (!table) return null

  const statutActuel = visite?.statut ?? 'LIBRE'
  const idxActuel    = ETAPES_ORDRE.indexOf(statutActuel)
  const etapesFaites = visite ? ETAPES_ORDRE.filter(e => visite.etapes?.[e] !== undefined) : []
  const actions      = ACTIONS[statutActuel] || []

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 16, bottom: 16, right: 24,
        zIndex: 200,
        width: 290,
        background: 'rgba(255,255,255,0.97)',
        borderRadius: 20,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        padding: '20px 20px 16px',
        fontFamily: '"Inter", system-ui, sans-serif',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(0,0,0,0.07)',
        overflowY: 'auto',
        boxSizing: 'border-box',
      }}
    >
      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <span style={{ fontWeight: 800, fontSize: 18, color: '#111827' }}>Table {table.numero}</span>
          <span style={{ marginLeft: 8, fontSize: 12, color: '#6B7280', fontWeight: 500 }}>
            {table.forme} · {table.capacite} cvts
          </span>
        </div>
        <button onClick={onFermer} style={{
          background: '#F3F4F6', border: 'none', borderRadius: '50%',
          width: 28, height: 28, cursor: 'pointer', fontSize: 14,
          color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>
      </div>

      {/* Table libre */}
      {!visite && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#9CA3AF', fontSize: 14 }}>
          Table libre
        </div>
      )}

      {/* Visite en cours */}
      {visite && (
        <>
          {/* Métriques rapides */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <div style={{ flex: 1, background: '#F9FAFB', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{visite.nbPersonnes}</div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>personnes</div>
            </div>
            <div style={{ flex: 2, background: '#F9FAFB', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                {formatMinutes(simTime - visite.etapes['ARRIVEE'])}
              </div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>depuis l'arrivée</div>
            </div>
          </div>

          {/* Parcours */}
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Parcours
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 16 }}>
            {ETAPES_ORDRE.filter(e => e !== 'DEPART').map((etape, idx) => {
              const ts      = visite.etapes?.[etape]
              const fait    = ts !== undefined
              const actuel  = etape === statutActuel
              const suivant = !fait && idx === idxActuel + 1

              if (!fait && !actuel && !suivant) {
                const obligatoires = ['ARRIVEE','INSTALLATION','COMMANDE','PLAT_SERVI','PLAT_RETIRE','ADDITION']
                if (!obligatoires.includes(etape)) return null
              }

              const couleur = COULEUR_ETAPE[etape] ?? '#E5E7EB'
              const duree   = fait && idx > 0
                ? (() => {
                    const etapePrev = etapesFaites[etapesFaites.indexOf(etape) - 1]
                    if (!etapePrev) return null
                    return formatMinutes(ts - visite.etapes[etapePrev])
                  })()
                : null

              return (
                <div key={etape} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 10px', borderRadius: 10,
                  background: actuel ? couleur + '33' : 'transparent',
                  border: actuel ? `1.5px solid ${couleur}` : '1.5px solid transparent',
                  opacity: fait || actuel ? 1 : 0.35,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: fait ? couleur : actuel ? couleur + '44' : '#F3F4F6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, border: actuel ? `2px solid ${couleur}` : '2px solid transparent',
                  }}>
                    {fait ? (actuel ? ETAPES_ICONE[etape] : '✓') : ETAPES_ICONE[etape]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: actuel ? 700 : 500, fontSize: 13, color: actuel ? '#111827' : fait ? '#374151' : '#9CA3AF' }}>
                      {ETAPES_LIBELLE[etape]}
                    </div>
                    {ts && (
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                        {formatHeure(ts)}{duree ? ` · +${duree}` : ''}
                      </div>
                    )}
                  </div>
                  {actuel && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: couleur, color: '#fff', borderRadius: '999px', padding: '2px 7px', flexShrink: 0 }}>
                      En cours
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Boutons d'action (ajout C) ── */}
          {actions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
              {actions.map(a => (
                <button
                  key={a.type}
                  onClick={() => onAction(a.type, table.id)}
                  style={{
                    width: '100%', padding: '12px 16px',
                    borderRadius: 12, border: 'none', cursor: 'pointer',
                    fontWeight: 700, fontSize: 14,
                    background: a.couleur, color: '#fff', textAlign: 'left',
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}

          {/* Attendre encore 10 min */}
          <button
            onClick={() => onAttendre({ id: table.id, statut: statutActuel })}
            style={{
              width: '100%', padding: '11px 16px',
              borderRadius: 12, border: '2px solid #E5E7EB', cursor: 'pointer',
              fontWeight: 600, fontSize: 13,
              background: 'transparent', color: '#22C55E', textAlign: 'left',
            }}
          >
            ↺ Attendre encore 10 min
          </button>
        </>
      )}
    </div>
  )
}

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
  sectionControles: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' },
  btnGroupe: { display: 'flex', gap: '6px', alignItems: 'center' },
  btnLabel:  { fontSize: '0.8rem', color: '#9ca3af', marginRight: '4px' },
  btn: (actif) => ({
    padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
    fontWeight: 600, fontSize: '0.82rem',
    background: actif ? '#3b82f6' : '#374151',
    color: actif ? '#fff' : '#d1d5db',
  }),
  zone3D: {
    position: 'relative',
    borderRadius: '14px',
    overflow: 'hidden',
    marginBottom: '16px',
    height: '65vh',
    minHeight: '420px',
    background: '#F5F6F8',
  },
  sectionFile:  { background: '#1f2937', borderRadius: '12px', padding: '12px', marginBottom: '16px' },
  sectionTitre: { fontWeight: 600, marginBottom: '8px', fontSize: '0.95rem' },
  fileItem: {
    display: 'flex', justifyContent: 'space-between',
    padding: '4px 0', fontSize: '0.85rem', borderBottom: '1px solid #374151',
  },
  sectionIndicateurs: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '10px', marginBottom: '16px',
  },
  indicateur: { background: '#1f2937', borderRadius: '10px', padding: '10px 14px' },
  indLabel:   { fontSize: '0.72rem', color: '#9ca3af' },
  indValeur:  { fontSize: '1.2rem', fontWeight: 700 },
};

const SCENARIOS       = ['normal', 'rush', 'cuisine_lente', 'reset'];
const SCENARIO_LABELS = { normal: 'Normal', rush: 'Rush', cuisine_lente: 'Cuisine lente', reset: 'Reset' };
const VITESSES        = [30, 60, 120];

// ─── Composant principal ──────────────────────────────────────────────────────
export default function Gerant({ snapshot, envoyer, connecte }) {
  const [tableSelectionnee, setTableSelectionnee] = useState(null);

  const tables      = enrichirTables(snapshot);
  const moyennes    = calculerMoyennes(snapshot.historique);
  const indicateurs = calculerIndicateursDirec(snapshot.tables, snapshot.visites);
  const fileAttente = snapshot.visites.filter(v => v.tableId === null);
  const alertes     = calculerAlertes(snapshot.visites, snapshot.simTime);

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

      {/* En-tête */}
      <div style={S.header}>
        <h1 style={S.titre}>Restau-Tempo</h1>
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

      {/* Zone 3D + panneau latéral superposé */}
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
            onSelectTable={(id) => setTableSelectionnee(prev => prev === id ? null : id)}
          />
          {/* Panneau de détail de A + boutons d'action de C — flotte sur la 3D */}
          <PanneauDetail
            tableId={tableSelectionnee}
            snapshot={snapshot}
            onAction={declarer}
            onAttendre={attendre}
            onFermer={() => setTableSelectionnee(null)}
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
