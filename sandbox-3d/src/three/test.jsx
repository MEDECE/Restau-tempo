import { useState, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import Salle3D from './Salle3D.jsx'
import snapshotBase from '../mock/snapshot.json'

const WS_URL = `ws://${location.hostname}:3001/ws`

const ALERTES_FALLBACK = [
  { tableId: 'T3', visiteId: 'V17', niveau: 'alerte', message: 'Plat en retard', minutes: 22 },
  { tableId: 'T5', visiteId: 'V15', niveau: 'warn',   message: 'Proposer dessert ou addition', minutes: 6 },
]

// ─── Ordre et libellés des étapes ────────────────────────────────────────────
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
  PLAT_RETIRE:    'Plat terminé',
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

// ─── Panneau de détail d'une table ────────────────────────────────────────────
function PanneauDetail({ tableId, snapshot, onFermer }) {
  if (!tableId || !snapshot) return null

  const table  = snapshot.tables?.find(t => t.id === tableId)
  const visite = snapshot.visites?.find(v => v.tableId === tableId)
  const simTime = snapshot.simTime

  if (!table) return null

  // Étapes effectuées par cette visite
  const etapesFaites = visite
    ? ETAPES_ORDRE.filter(e => visite.etapes?.[e] !== undefined)
    : []

  const statutActuel = visite?.statut ?? 'LIBRE'
  const idxActuel    = ETAPES_ORDRE.indexOf(statutActuel)

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: '50%', left: 24,
        transform: 'translateY(-50%)',
        zIndex: 200,
        width: 280,
        background: 'rgba(255,255,255,0.97)',
        borderRadius: 20,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        padding: '20px 20px 16px',
        fontFamily: '"Inter", system-ui, sans-serif',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(0,0,0,0.07)',
      }}
    >
      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <span style={{ fontWeight: 800, fontSize: 18, color: '#111827' }}>
            Table {table.numero}
          </span>
          <span style={{ marginLeft: 8, fontSize: 12, color: '#6B7280', fontWeight: 500 }}>
            {table.forme} · {table.capacite} couverts
          </span>
        </div>
        <button
          onClick={onFermer}
          style={{
            background: '#F3F4F6', border: 'none', borderRadius: '50%',
            width: 28, height: 28, cursor: 'pointer', fontSize: 14,
            color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >✕</button>
      </div>

      {/* Cas table libre */}
      {!visite && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#9CA3AF', fontSize: 14 }}>
          Table libre
        </div>
      )}

      {/* Infos visite */}
      {visite && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <div style={{
              flex: 1, background: '#F9FAFB', borderRadius: 10,
              padding: '8px 12px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>
                {visite.nbPersonnes}
              </div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>personnes</div>
            </div>
            <div style={{
              flex: 2, background: '#F9FAFB', borderRadius: 10,
              padding: '8px 12px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                {formatMinutes(simTime - visite.etapes['ARRIVEE'])}
              </div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>depuis l'arrivée</div>
            </div>
          </div>

          {/* Roadmap des étapes */}
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Parcours
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {ETAPES_ORDRE.filter(e => e !== 'DEPART').map((etape, idx) => {
              const ts      = visite.etapes?.[etape]
              const fait    = ts !== undefined
              const actuel  = etape === statutActuel
              const suivant = !fait && idx === idxActuel + 1

              // Sauter les étapes dessert si pas faites et pas actuelle
              if (!fait && !actuel && !suivant) {
                // N'afficher que si c'est une étape obligatoire ou faite
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
                  padding: '6px 10px',
                  borderRadius: 10,
                  background: actuel ? couleur + '33' : 'transparent',
                  border: actuel ? `1.5px solid ${couleur}` : '1.5px solid transparent',
                  opacity: fait || actuel ? 1 : 0.35,
                }}>
                  {/* Icône / point */}
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: fait ? couleur : actuel ? couleur + '44' : '#F3F4F6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, border: actuel ? `2px solid ${couleur}` : '2px solid transparent',
                  }}>
                    {fait ? (actuel ? ETAPES_ICONE[etape] : '✓') : ETAPES_ICONE[etape]}
                  </div>

                  {/* Libellé + heure */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: actuel ? 700 : 500,
                      fontSize: 13,
                      color: actuel ? '#111827' : fait ? '#374151' : '#9CA3AF',
                    }}>
                      {ETAPES_LIBELLE[etape]}
                    </div>
                    {ts && (
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                        {formatHeure(ts)}{duree ? ` · +${duree}` : ''}
                      </div>
                    )}
                  </div>

                  {/* Badge "en cours" */}
                  {actuel && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, background: couleur,
                      color: '#fff', borderRadius: '999px', padding: '2px 7px',
                      flexShrink: 0,
                    }}>
                      En cours
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  const [snapshot, setSnapshot]       = useState({ ...snapshotBase })
  const [tableSelectionnee, setTable] = useState(null)
  const [connecte, setConnecte]       = useState(false)
  const wsRef = useRef(null)

  useEffect(() => {
    let ws, retryTimer
    function connect() {
      try {
        ws = new WebSocket(WS_URL)
        wsRef.current = ws
        ws.onopen    = () => { setConnecte(true) }
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data)
            if (msg.kind === 'snapshot') setSnapshot(msg)
          } catch {}
        }
        ws.onclose = () => {
          setConnecte(false)
          retryTimer = setTimeout(connect, 2000)
        }
        ws.onerror = () => ws.close()
      } catch { retryTimer = setTimeout(connect, 2000) }
    }
    connect()
    return () => { clearTimeout(retryTimer); ws?.close() }
  }, [])

  useEffect(() => {
    if (connecte) return
    const id = setInterval(() => {
      setSnapshot(s => ({ ...s, simTime: s.simTime + 60_000 }))
    }, 1000)
    return () => clearInterval(id)
  }, [connecte])

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      {/* Badge connexion */}
      <div style={{
        position: 'absolute', top: 12, right: 12, zIndex: 300,
        background: connecte ? '#22C55E' : '#F87171',
        color: '#fff', borderRadius: '999px',
        padding: '4px 12px', fontSize: '11px', fontFamily: 'system-ui',
        fontWeight: 600, boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
        pointerEvents: 'none',
      }}>
        {connecte ? '● Serveur connecté' : '○ Mode démo (mock)'}
      </div>

      {/* Panneau de détail */}
      <PanneauDetail
        tableId={tableSelectionnee}
        snapshot={snapshot}
        onFermer={() => setTable(null)}
      />

      <Salle3D
        snapshot={snapshot}
        alertes={connecte ? [] : ALERTES_FALLBACK}
        tableSelectionnee={tableSelectionnee}
        onSelectTable={(id) => setTable(prev => prev === id ? null : id)}
      />
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
