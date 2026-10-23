/**
 * index.js — point d'entrée du serveur TableFlow
 *
 * HTTP  : port 3001
 *   GET  /api/snapshot      → snapshot courant
 *   POST /api/conseils      → conseils IA IBM
 *
 * WebSocket : /ws
 *   Serveur → web : { kind:"snapshot", ... }  toutes les secondes + après chaque événement
 *                   { kind:"event", event }    à chaque événement
 *   Web → serveur : { kind:"event", event }    action serveur
 *                   { kind:"scenario", nom }   changer le scénario
 *                   { kind:"vitesse", valeur } changer la vitesse
 */

require('dotenv').config();

const express   = require('express');
const http      = require('http');
const { WebSocketServer } = require('ws');
const { snapshot, appliquerEvenement } = require('./moteur');
const simulateur = require('./simulateur');
const { genererConseils } = require('./conseils');

// Étapes qui nécessitent une action du serveur humain (pas automatisées)
// DESSERT_SERVI est déclenché par le web → B programme DESSERT_RETIRE automatiquement
const ETAPES_SERVEUR = new Set(['COMMANDE', 'DESSERT_SERVI', 'ADDITION']);

const PORT = process.env.PORT || 3001;

// ─── Express ─────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// CORS permissif pour le dev (Vite sur :5173, téléphone sur le même Wi-Fi)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// GET /api/snapshot
app.get('/api/snapshot', (req, res) => {
  res.json(snapshot(simulateur.getSimTime(), simulateur.getVitesse()));
});

// POST /api/conseils
app.post('/api/conseils', (req, res) => {
  const { simTime, tables, visites } = req.body;
  const conseils = genererConseils({ simTime, tables, visites });
  res.json({ conseils });
});

// ─── Serveur HTTP + WebSocket ─────────────────────────────────────────────────
const server = http.createServer(app);
const wss    = new WebSocketServer({ server, path: '/ws' });

/** Diffuse un message à tous les clients connectés. */
function diffuser(message) {
  const json = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === 1 /* OPEN */) {
      client.send(json);
    }
  }
}

// ─── Callbacks du simulateur ──────────────────────────────────────────────────
simulateur.demarrer({
  onEvenement: (evt) => {
    diffuser({ kind: 'event', event: evt });
  },
  onSnapshot: () => {
    diffuser(snapshot(simulateur.getSimTime(), simulateur.getVitesse()));
  },
});

// ─── Messages WebSocket entrants ──────────────────────────────────────────────
wss.on('connection', (ws) => {
  console.log('[WS] Client connecté');

  // Envoyer le snapshot immédiatement à la connexion
  ws.send(JSON.stringify(snapshot(simulateur.getSimTime(), simulateur.getVitesse())));

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    switch (msg.kind) {
      case 'event': {
        // Action manuelle du serveur (COMMANDE ou ADDITION)
        const evt = appliquerEvenement(
          { ...msg.event, source: 'serveur' },
          simulateur.getSimTime()
        );
        diffuser({ kind: 'event', event: evt });
        // Si c'est une étape serveur, on programme la suite caméra
        if (evt.visiteId && ETAPES_SERVEUR.has(msg.event.type)) {
          simulateur.reprendreApresActionServeur(evt.visiteId, msg.event.type);
        }
        diffuser(snapshot(simulateur.getSimTime(), simulateur.getVitesse()));
        break;
      }
      case 'scenario':
        simulateur.changerScenario(msg.nom);
        diffuser(snapshot(simulateur.getSimTime(), simulateur.getVitesse()));
        break;

      case 'vitesse':
        simulateur.changerVitesse(msg.valeur);
        diffuser(snapshot(simulateur.getSimTime(), simulateur.getVitesse()));
        break;

      default:
        console.warn('[WS] Message inconnu :', msg.kind);
    }
  });

  ws.on('close', () => console.log('[WS] Client déconnecté'));
});

// ─── Lancement ────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`[TableFlow] Serveur sur http://localhost:${PORT}`);
  console.log(`[TableFlow] WebSocket sur ws://localhost:${PORT}/ws`);
});
