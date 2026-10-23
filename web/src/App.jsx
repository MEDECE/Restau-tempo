/**
 * App.jsx — point d'entrée React
 *
 * Routing par URL : ?vue=gerant (défaut) | ?vue=serveur
 */

import useSalle from './lib/useSalle';
import Gerant  from './vues/Gerant';
import Serveur from './vues/Serveur';

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const vue    = params.get('vue') || 'gerant';

  const { snapshot, dernierEvent, envoyer, connecte } = useSalle();

  if (!snapshot) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#6b7280' }}>
        Connexion au serveur…
      </div>
    );
  }

  if (vue === 'serveur') {
    return <Serveur snapshot={snapshot} dernierEvent={dernierEvent} envoyer={envoyer} connecte={connecte} />;
  }

  return <Gerant snapshot={snapshot} dernierEvent={dernierEvent} envoyer={envoyer} connecte={connecte} />;
}
