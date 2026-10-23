/**
 * useSalle.js — connexion WebSocket au serveur TableFlow
 *
 * Expose : { snapshot, dernierEvent, envoyer, connecte }
 *
 * Mode live   : WebSocket ws://...:3001/ws — snapshot mis à jour à chaque message.
 * Mode mock   : si le serveur n'est pas joignable dans 2 s, charge snapshot.json
 *               et fait avancer simTime localement (×60 par défaut) pour que les
 *               chronos défilent. Les actions du serveur (envoyer) mettent à jour
 *               l'état local immédiatement.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import mockSnapshot from '../mock/snapshot.json';

const SERVER_URL = import.meta.env.VITE_SERVER_URL
  ? import.meta.env.VITE_SERVER_URL.replace(/^http/, 'ws') + '/ws'
  : `ws://${location.hostname}:3001/ws`;

// ─── Helpers mock ─────────────────────────────────────────────────────────────
/**
 * Applique un événement serveur sur un snapshot mock (côté web uniquement).
 * Retourne un nouveau snapshot avec la visite mise à jour.
 */
function appliquerEventMock(snap, type, tableId) {
  const visites = snap.visites.map(v => {
    if (v.tableId !== tableId) return v;
    return {
      ...v,
      statut: type,
      etapes: { ...v.etapes, [type]: snap.simTime },
    };
  });
  return { ...snap, visites };
}

export default function useSalle() {
  const [snapshot,     setSnapshot]     = useState(null);
  const [dernierEvent, setDernierEvent] = useState(null);
  const [connecte,     setConnecte]     = useState(false);

  const wsRef          = useRef(null);
  const fallbackTimer  = useRef(null);
  const mockMode       = useRef(false);
  const tickRef        = useRef(null);
  // Référence mutable pour que le tick puisse lire le dernier snapshot
  const snapshotRef    = useRef(null);

  // Garde snapshotRef synchronisé
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  // ─── Tick mock : avance simTime localement ────────────────────────────────
  function demarrerTickMock(vitesse = 60) {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setSnapshot(prev => {
        if (!prev) return prev;
        return { ...prev, simTime: prev.simTime + (prev.vitesse || vitesse) * 1000 };
      });
    }, 1000);
  }

  // ─── envoyer ──────────────────────────────────────────────────────────────
  const envoyer = useCallback((message) => {
    // Mode live — on envoie au WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return;
    }

    // Mode mock — on applique localement
    if (mockMode.current && message.kind === 'event') {
      const { type, tableId } = message.event;
      setSnapshot(prev => {
        if (!prev) return prev;
        const updated = appliquerEventMock(prev, type, tableId);
        const evt = { id: `Emock`, type, tableId, visiteId: null, ts: prev.simTime, source: 'serveur' };
        setDernierEvent(evt);
        return updated;
      });
    }

    if (mockMode.current && message.kind === 'vitesse') {
      setSnapshot(prev => prev ? { ...prev, vitesse: message.valeur } : prev);
      // Redémarre le tick avec la nouvelle vitesse
      demarrerTickMock(message.valeur);
    }
  }, []);

  // ─── Connexion WebSocket ──────────────────────────────────────────────────
  useEffect(() => {
    let actif = true;

    // Fallback mock si pas de connexion dans 2 s
    fallbackTimer.current = setTimeout(() => {
      if (!connecte && actif) {
        console.warn('[useSalle] Serveur non joignable — mode mock activé');
        mockMode.current = true;
        setSnapshot(mockSnapshot);
        demarrerTickMock(mockSnapshot.vitesse || 60);
      }
    }, 2000);

    function connecter() {
      const ws = new WebSocket(SERVER_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!actif) return;
        clearTimeout(fallbackTimer.current);
        // On sort du mode mock si on y était
        mockMode.current = false;
        if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
        setConnecte(true);
      };

      ws.onmessage = (e) => {
        if (!actif) return;
        try {
          const msg = JSON.parse(e.data);
          if (msg.kind === 'snapshot') {
            setSnapshot(msg);
          } else if (msg.kind === 'event') {
            setDernierEvent(msg.event);
          }
        } catch {/* ignore */ }
      };

      ws.onclose = () => {
        if (!actif) return;
        setConnecte(false);
        // Tentative de reconnexion toutes les 3 s
        setTimeout(connecter, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connecter();

    return () => {
      actif = false;
      clearTimeout(fallbackTimer.current);
      if (tickRef.current) clearInterval(tickRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { snapshot, dernierEvent, envoyer, connecte };
}
