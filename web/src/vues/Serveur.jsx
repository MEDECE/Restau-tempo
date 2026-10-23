/**
 * Serveur.jsx — vue mobile du serveur
 *
 * Tap sur une carte → modale avec 2 choix :
 *   1. Action principale (COMMANDE / DESSERT_SERVI+ADDITION / ADDITION)
 *   2. ↺ Repasser en vert (reset chrono — renvoie le même statut avec ts=maintenant)
 *
 * Chrono visuel : vert < 30 min · orange 30–40 min · rouge > 40 min
 * Conseils IA rafraîchis toutes les 15 s et sur bouton.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  enrichirTables,
  calculerMoyennes,
  LIBELLES,
  minutesDepuisEtape,
} from '../lib/etat';

const SERVER_HTTP = import.meta.env.VITE_SERVER_URL || `http://${location.hostname}:3001`;

const CHRONO_HEX = {
  vert:   '#22C55E',
  orange: '#F97316',
  rouge:  '#EF4444',
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100vh',
    background: '#111827',
    color: '#f9fafb',
    fontFamily: 'system-ui, sans-serif',
    padding: '12px',
    maxWidth: '480px',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  titre: { margin: 0, fontSize: '1.2rem', fontWeight: 700 },
  badge: (connecte) => ({
    fontSize: '0.72rem',
    padding: '2px 8px',
    borderRadius: '999px',
    background: connecte ? '#166534' : '#7f1d1d',
    color: connecte ? '#bbf7d0' : '#fecaca',
  }),
  carte: (chronoCouleur) => ({
    background: '#1f2937',
    border: `2px solid ${CHRONO_HEX[chronoCouleur] || '#374151'}`,
    borderRadius: '12px',
    padding: '14px',
    marginBottom: '10px',
    cursor: 'pointer',
    boxShadow: chronoCouleur === 'rouge' ? `0 0 14px ${CHRONO_HEX.rouge}99` : 'none',
    transition: 'border-color 0.4s, box-shadow 0.4s',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
  }),
  carteEntete: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '4px',
  },
  carteGauche: { display: 'flex', alignItems: 'center', gap: '8px' },
  puce: (couleur) => ({
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    background: couleur,
    flexShrink: 0,
  }),
  numTable:  { fontWeight: 700, fontSize: '1.1rem' },
  pers:      { fontSize: '0.8rem', color: '#9ca3af' },
  chronoVal: (chronoCouleur) => ({
    fontSize: '1.2rem',
    fontWeight: 700,
    color: CHRONO_HEX[chronoCouleur] || '#f9fafb',
  }),
  libelle:   { fontSize: '0.82rem', color: '#9ca3af', marginTop: '2px' },
  alerteMsg: { fontSize: '0.75rem', color: '#fca5a5', marginTop: '4px' },
  tapHint:   { fontSize: '0.7rem', color: '#4b5563', marginTop: '6px', textAlign: 'right' },

  // File d'attente
  fileBlock: {
    background: '#292524',
    borderRadius: '10px',
    padding: '10px 12px',
    marginBottom: '12px',
    borderLeft: '4px solid #f59e0b',
  },
  fileTitre: { fontWeight: 600, marginBottom: '4px', fontSize: '0.9rem' },

  // ─── Modale ──────────────────────────────────────────────────────────────
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modale: {
    background: '#1f2937',
    borderRadius: '20px 20px 0 0',
    padding: '24px 20px 32px',
    width: '100%',
    maxWidth: '480px',
    boxSizing: 'border-box',
  },
  modaleTitre: {
    fontWeight: 700,
    fontSize: '1.1rem',
    marginBottom: '4px',
  },
  modaleStatut: {
    fontSize: '0.85rem',
    color: '#9ca3af',
    marginBottom: '20px',
  },
  modaleBtn: (couleur) => ({
    display: 'block',
    width: '100%',
    padding: '16px',
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '1rem',
    background: couleur,
    color: '#fff',
    marginBottom: '10px',
    textAlign: 'left',
  }),
  modaleBtnVert: {
    display: 'block',
    width: '100%',
    padding: '14px 16px',
    borderRadius: '12px',
    border: '2px solid #374151',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.9rem',
    background: 'transparent',
    color: '#22C55E',
    marginBottom: '10px',
    textAlign: 'left',
  },
  modaleBtnAnnuler: {
    display: 'block',
    width: '100%',
    padding: '12px',
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.9rem',
    background: '#374151',
    color: '#9ca3af',
    textAlign: 'center',
  },

  // Conseils
  sectionConseils: {
    background: '#1f2937',
    borderRadius: '12px',
    padding: '12px',
    marginTop: '16px',
  },
  conseilsEntete: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  conseilsTitre: { fontWeight: 600, fontSize: '0.95rem' },
  badgeSource: (source) => ({
    fontSize: '0.7rem',
    padding: '2px 8px',
    borderRadius: '999px',
    background: source === 'ibm-granite' ? '#1e3a5f' : '#3f3f46',
    color:      source === 'ibm-granite' ? '#93c5fd' : '#a1a1aa',
  }),
  btnConseils: {
    padding: '5px 12px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.78rem',
    background: '#374151',
    color: '#d1d5db',
    fontWeight: 600,
  },
  conseilItem: {
    display: 'flex',
    gap: '8px',
    padding: '6px 0',
    borderBottom: '1px solid #374151',
    fontSize: '0.85rem',
  },
  prioriteBadge: (p) => ({
    minWidth: '20px',
    height: '20px',
    borderRadius: '50%',
    background: p === 1 ? '#EF4444' : p === 2 ? '#f97316' : '#374151',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.7rem',
    fontWeight: 700,
    flexShrink: 0,
  }),
};

// ─── Score d'urgence pour tri ─────────────────────────────────────────────────
function scoreUrgence(t) {
  if (!t.chronoCouleur) return 0;
  if (t.chronoCouleur === 'rouge')   return 3;
  if (t.alerte?.niveau === 'alerte') return 2;
  if (t.chronoCouleur === 'orange')  return 2;
  if (t.alerte?.niveau === 'warn')   return 1;
  return 0;
}

// ─── Modale d'action ─────────────────────────────────────────────────────────
function Modale({ table, onAction, onResetVert, onFermer }) {
  const { statut, numero, visite, minutes, chronoCouleur } = table;

  return (
    <div style={S.overlay} onClick={onFermer}>
      <div style={S.modale} onClick={e => e.stopPropagation()}>

        <div style={S.modaleTitre}>
          Table {numero}
          {visite && <span style={{ fontWeight: 400, color: '#9ca3af' }}> · {visite.nbPersonnes} pers.</span>}
        </div>
        <div style={S.modaleStatut}>
          {LIBELLES[statut]} — <span style={{ color: CHRONO_HEX[chronoCouleur] }}>{minutes} min</span>
        </div>

        {/* Actions principales selon le statut */}
        {statut === 'INSTALLATION' && (
          <button style={S.modaleBtn('#3B82F6')} onClick={() => onAction('COMMANDE', table.id)}>
            ✓ Commande prise — entrée + plat
          </button>
        )}

        {statut === 'PLAT_RETIRE' && (
          <>
            <button style={S.modaleBtn('#A855F7')} onClick={() => onAction('DESSERT_SERVI', table.id)}>
              🍮 Commander le dessert
            </button>
            <button style={S.modaleBtn('#F97316')} onClick={() => onAction('ADDITION', table.id)}>
              💳 Addition directe (sans dessert)
            </button>
          </>
        )}

        {statut === 'DESSERT_RETIRE' && (
          <button style={S.modaleBtn('#F97316')} onClick={() => onAction('ADDITION', table.id)}>
            💳 Régler et libérer la table
          </button>
        )}

        {/* Bouton reset chrono — toujours disponible */}
        <button style={S.modaleBtnVert} onClick={() => onResetVert(table)}>
          ↺ Repasser en vert — encore 30 min
        </button>

        <button style={S.modaleBtnAnnuler} onClick={onFermer}>
          Annuler
        </button>
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function Serveur({ snapshot, envoyer, connecte }) {
  const [tableSelectionnee, setTableSelectionnee] = useState(null);
  const [conseils,          setConseils]          = useState([]);
  const [sourceConseils,    setSourceConseils]    = useState(null);
  const [chargement,        setChargement]        = useState(false);

  const tablesEnrichies = enrichirTables(snapshot);
  const moyennes        = calculerMoyennes(snapshot.historique);
  const fileAttente     = snapshot.visites.filter(v => v.tableId === null);

  const tablesActives = tablesEnrichies
    .filter(t => t.statut !== 'LIBRE')
    .sort((a, b) => scoreUrgence(b) - scoreUrgence(a));

  // Table sélectionnée mise à jour depuis le nouveau snapshot (pour que la modale
  // reflète le statut courant si un event arrive pendant qu'elle est ouverte)
  const tableModal = tableSelectionnee
    ? tablesActives.find(t => t.id === tableSelectionnee) || null
    : null;

  // ─── Actions ────────────────────────────────────────────────────────────
  function declarer(type, tableId) {
    envoyer({ kind: 'event', event: { type, tableId, source: 'serveur' } });
    setTableSelectionnee(null);
  }

  function resetVert(table) {
    // Renvoyer le même statut avec un nouveau ts = simTime → remet le chrono à 0
    envoyer({ kind: 'event', event: { type: table.statut, tableId: table.id, source: 'serveur' } });
    setTableSelectionnee(null);
  }

  // ─── Conseils IA ────────────────────────────────────────────────────────
  const fetchConseils = useCallback(async () => {
    if (chargement) return;
    setChargement(true);
    try {
      const tablesPayload = snapshot.visites
        .filter(v => v.tableId)
        .map(v => {
          const table = snapshot.tables.find(t => t.id === v.tableId);
          return {
            tableId:            v.tableId,
            numero:             table?.numero,
            statut:             v.statut,
            nbPersonnes:        v.nbPersonnes,
            minutesDepuisEtape: minutesDepuisEtape(v, snapshot.simTime),
          };
        });

      const filePayload = fileAttente.map(v => ({
        visiteId:    v.id,
        nbPersonnes: v.nbPersonnes,
        minutes:     Math.floor((snapshot.simTime - v.etapes.ARRIVEE) / 60000),
      }));

      const res = await fetch(`${SERVER_HTTP}/api/conseils`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simTime:     snapshot.simTime,
          tables:      tablesPayload,
          fileAttente: filePayload,
          moyennes: {
            cuisine:     moyennes.cuisine,
            dureeTotale: moyennes.dureeTotale,
          },
        }),
      });
      const data = await res.json();
      setConseils(data.conseils || []);
      setSourceConseils(data.source || null);
    } catch { /* silencieux */ }
    finally { setChargement(false); }
  }, [snapshot, moyennes, fileAttente, chargement]);

  useEffect(() => {
    fetchConseils();
    const id = setInterval(fetchConseils, 15000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={S.page}>

      {/* Modale */}
      {tableModal && (
        <Modale
          table={tableModal}
          onAction={declarer}
          onResetVert={resetVert}
          onFermer={() => setTableSelectionnee(null)}
        />
      )}

      {/* En-tête */}
      <div style={S.header}>
        <h1 style={S.titre}>TableFlow — Serveur</h1>
        <span style={S.badge(connecte)}>{connecte ? '● Live' : '○ Hors ligne'}</span>
      </div>

      {/* File d'attente */}
      {fileAttente.length > 0 && (
        <div style={S.fileBlock}>
          <div style={S.fileTitre}>
            Entrée — {fileAttente.length} groupe{fileAttente.length > 1 ? 's' : ''} en attente
          </div>
          {fileAttente.map(v => {
            const min = Math.floor((snapshot.simTime - v.etapes.ARRIVEE) / 60000);
            return (
              <div key={v.id} style={{ fontSize: '0.82rem', color: min >= 10 ? '#fca5a5' : '#d1d5db' }}>
                {v.nbPersonnes} pers. — {min} min d'attente
              </div>
            );
          })}
        </div>
      )}

      {/* Cartes tables */}
      {tablesActives.length === 0 && (
        <div style={{ color: '#6b7280', textAlign: 'center', marginTop: '32px' }}>
          Aucune table occupée
        </div>
      )}

      {tablesActives.map(t => (
        <div
          key={t.id}
          style={S.carte(t.chronoCouleur)}
          onClick={() => setTableSelectionnee(t.id)}
        >
          <div style={S.carteEntete}>
            <div style={S.carteGauche}>
              <span style={S.puce(t.couleur)} />
              <span style={S.numTable}>Table {t.numero}</span>
              <span style={S.pers}>({t.visite?.nbPersonnes} pers.)</span>
            </div>
            <span style={S.chronoVal(t.chronoCouleur)}>{t.minutes} min</span>
          </div>
          <div style={S.libelle}>{LIBELLES[t.statut]}</div>
          {t.alerte && <div style={S.alerteMsg}>⚠ {t.alerte.message}</div>}
          <div style={S.tapHint}>Appuyer pour agir →</div>
        </div>
      ))}

      {/* Conseils IA */}
      <div style={S.sectionConseils}>
        <div style={S.conseilsEntete}>
          <span style={S.conseilsTitre}>Conseils</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {sourceConseils && (
              <span style={S.badgeSource(sourceConseils)}>
                {sourceConseils === 'ibm-granite' ? 'IBM Granite' : 'Règles (secours)'}
              </span>
            )}
            <button style={S.btnConseils} onClick={fetchConseils} disabled={chargement}>
              {chargement ? '…' : '↻'}
            </button>
          </div>
        </div>

        {conseils.length === 0 && !chargement && (
          <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>Aucun conseil pour le moment.</div>
        )}

        {conseils.map((c, i) => (
          <div key={i} style={S.conseilItem}>
            <div style={S.prioriteBadge(c.priorite)}>{c.priorite}</div>
            <div>
              <div style={{ fontWeight: 600 }}>
                {c.tableId
                  ? `Table ${snapshot.tables.find(t => t.id === c.tableId)?.numero ?? c.tableId} — `
                  : ''}
                {c.action}
              </div>
              {c.raison && (
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>{c.raison}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
