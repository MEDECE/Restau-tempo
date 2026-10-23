import { useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, RoundedBox, ContactShadows, Html } from '@react-three/drei'

// ─── Constantes de dimensions ───────────────────────────────────────────────
const SALLE_LX = 12
const SALLE_LZ = 8
const MURET_H  = 0.35
const MURET_EP = 0.18

// ─── Couleurs parquet ────────────────────────────────────────────────────────
const LAMES_BOIS = [
  '#A07842', '#87612A', '#B08848', '#6E4A1A',
  '#98703A', '#7D5525', '#A88040', '#5E3A12',
]
const COULEUR_JOINT   = '#3A2008'
const COULEUR_TRANCHE = '#3D2008'
const COULEUR_MURET   = '#E8E0D5'
const COULEUR_PIED    = '#5C3A14'
const COULEUR_CHAISE  = '#D6C8B0'  // beige clair neutre
const COULEUR_TAPIS   = '#2E1A08'

// ─── Palette chrono (30 min vert → 10 min orange → rouge) ────────────────────
const COULEUR_LIBRE   = '#D1D5DB'  // gris — table vide
const COULEUR_VERT    = '#22C55E'  // vert  — 0 à 30 min depuis dernière étape
const COULEUR_ORANGE  = '#F97316'  // orange — 30 à 40 min
const COULEUR_ROUGE   = '#EF4444'  // rouge  — > 40 min

const SEUIL_ORANGE = 30  // minutes simulées
const SEUIL_ROUGE  = 40

// Libellés français des statuts
const LIBELLE_STATUT = {
  LIBRE:          'Libre',
  INSTALLATION:   'Installés',
  COMMANDE:       'Commande prise',
  PLAT_SERVI:     'Plat servi',
  PLAT_RETIRE:    'Plat terminé',
  DESSERT_SERVI:  'Dessert servi',
  DESSERT_RETIRE: 'Dessert terminé',
  ADDITION:       'Addition',
}

// ─── Seuils d'alerte (section 9 du contexte) ─────────────────────────────────
const SEUILS = {
  INSTALLATION:   8,
  COMMANDE:       20,
  PLAT_RETIRE:    7,
  DESSERT_RETIRE: 5,
  ADDITION:       8,
}

// ─── Calcul chrono depuis la dernière étape ───────────────────────────────────
// Retourne { minutes, niveau: 'ok'|'warn'|'alerte' } (niveau conservé pour HaloAlerte)
function calcUrgence(visite, simTime) {
  if (!visite || !simTime) return { niveau: 'ok', minutes: 0 }
  const ts = visite.etapes[visite.statut]
  if (!ts) return { niveau: 'ok', minutes: 0 }
  const minutes = Math.floor((simTime - ts) / 60000)
  return {
    minutes,
    niveau: minutes >= SEUIL_ROUGE ? 'alerte' : minutes >= SEUIL_ORANGE ? 'warn' : 'ok',
  }
}

// ─── Couleur principale d'une table ──────────────────────────────────────────
function couleurTable(statut, urgence) {
  if (statut === 'LIBRE') return COULEUR_LIBRE
  if (urgence.minutes >= SEUIL_ROUGE)  return COULEUR_ROUGE
  if (urgence.minutes >= SEUIL_ORANGE) return COULEUR_ORANGE
  return COULEUR_VERT
}

// ─── Parquet en lames ────────────────────────────────────────────────────────
function Parquet() {
  const SOCLE_H = 0.30, SOCLE_Y = -0.15
  const LAME_EP = 0.035, LAME_Y = LAME_EP / 2
  const largeurLame = 0.48, largeurJoint = 0.022
  const pas = largeurLame + largeurJoint
  const elements = []

  for (let i = 0; i < Math.ceil(SALLE_LZ / pas) + 2; i++) {
    const zCentre = -SALLE_LZ / 2 + i * pas + largeurLame / 2
    if (zCentre > SALLE_LZ / 2 + pas) break
    elements.push(
      <mesh key={`l${i}`} position={[0, LAME_Y, zCentre]} receiveShadow>
        <boxGeometry args={[SALLE_LX - 0.10, LAME_EP, largeurLame]} />
        <meshStandardMaterial color={LAMES_BOIS[i % LAMES_BOIS.length]} roughness={0.82} metalness={0.02} />
      </mesh>
    )
    const zJoint = zCentre + largeurLame / 2 + largeurJoint / 2
    if (zJoint < SALLE_LZ / 2) {
      elements.push(
        <mesh key={`j${i}`} position={[0, LAME_Y * 0.4, zJoint]} receiveShadow>
          <boxGeometry args={[SALLE_LX - 0.10, LAME_EP * 0.5, largeurJoint]} />
          <meshStandardMaterial color={COULEUR_JOINT} roughness={0.95} />
        </mesh>
      )
    }
  }

  return (
    <group>
      <RoundedBox args={[SALLE_LX, SOCLE_H, SALLE_LZ]} radius={0.12} smoothness={4}
        position={[0, SOCLE_Y, 0]} receiveShadow>
        <meshStandardMaterial color={COULEUR_TRANCHE} roughness={0.9} />
      </RoundedBox>
      {elements}
    </group>
  )
}

// ─── Murets ───────────────────────────────────────────────────────────────────
function Murets() {
  const ep = MURET_EP, h = MURET_H, lx = SALLE_LX, lz = SALLE_LZ
  const y = h / 2, ouv = 1.5, moitie = (lz - ouv) / 2
  return (
    <group>
      <RoundedBox args={[ep, h, lz + ep * 2]} radius={0.05} smoothness={3} position={[lx / 2, y, 0]} castShadow>
        <meshStandardMaterial color={COULEUR_MURET} roughness={0.9} />
      </RoundedBox>
      <RoundedBox args={[ep, h, moitie]} radius={0.05} smoothness={3} position={[-lx / 2, y, -(ouv / 2 + moitie / 2)]} castShadow>
        <meshStandardMaterial color={COULEUR_MURET} roughness={0.9} />
      </RoundedBox>
      <RoundedBox args={[ep, h, moitie]} radius={0.05} smoothness={3} position={[-lx / 2, y, (ouv / 2 + moitie / 2)]} castShadow>
        <meshStandardMaterial color={COULEUR_MURET} roughness={0.9} />
      </RoundedBox>
      <RoundedBox args={[lx, h, ep]} radius={0.05} smoothness={3} position={[0, y, lz / 2]} castShadow>
        <meshStandardMaterial color={COULEUR_MURET} roughness={0.9} />
      </RoundedBox>
      <RoundedBox args={[lx, h, ep]} radius={0.05} smoothness={3} position={[0, y, -lz / 2]} castShadow>
        <meshStandardMaterial color={COULEUR_MURET} roughness={0.9} />
      </RoundedBox>
    </group>
  )
}

// ─── Tapis entrée ─────────────────────────────────────────────────────────────
function Entree() {
  return (
    <group position={[-5.8, 0.04, 0]}>
      <RoundedBox args={[0.8, 0.02, 1.4]} radius={0.2} smoothness={3}>
        <meshStandardMaterial color={COULEUR_TAPIS} roughness={0.95} />
      </RoundedBox>
    </group>
  )
}

// ─── Positions des chaises ────────────────────────────────────────────────────
function getChaises(forme, capacite) {
  if (forme === 'ronde') {
    const r = capacite <= 2 ? 0.65 : 0.75
    return Array.from({ length: capacite }, (_, i) => {
      const a = (i / capacite) * Math.PI * 2
      return { px: Math.sin(a) * r, pz: Math.cos(a) * r }
    })
  }
  if (forme === 'carree') {
    return [
      { px: 0, pz: -0.72 }, { px: 0, pz: 0.72 },
      { px: -0.72, pz: 0 }, { px: 0.72, pz: 0 },
    ].slice(0, Math.min(capacite, 4))
  }
  return [
    { px: -1.15, pz: 0 },   { px: 1.15, pz: 0 },
    { px: -0.42, pz: -0.72 }, { px: 0.42, pz: -0.72 },
    { px: -0.42, pz: 0.72 },  { px: 0.42, pz: 0.72 },
  ].slice(0, capacite)
}

// ─── Chaise ───────────────────────────────────────────────────────────────────
function Chaise({ px, pz, couleur }) {
  return (
    <group position={[px, 0, pz]}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.4, 8]} />
        <meshStandardMaterial color={COULEUR_PIED} roughness={0.8} />
      </mesh>
      <RoundedBox args={[0.38, 0.07, 0.38]} radius={0.07} smoothness={3}
        position={[0, 0.42, 0]} castShadow>
        <meshStandardMaterial color={couleur} roughness={0.9} />
      </RoundedBox>
    </group>
  )
}

// ─── Client animé ─────────────────────────────────────────────────────────────
// - Apparition : grandit depuis 0 à l'arrivée
// - Vie : léger balancement haut/bas (personne assise qui bouge)
// - Phase aléatoire par index pour que tous ne bougent pas en même temps
function Client({ px, pz, couleur, index = 0 }) {
  const groupRef = useRef()
  const meshRef  = useRef()
  // Phase aléatoire fixe par client (basée sur index)
  const phase = (index * 1.37) % (Math.PI * 2)

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()

    // Apparition : scale 0 → 1
    const s = groupRef.current.scale.x
    if (s < 0.99) {
      groupRef.current.scale.setScalar(s + (1 - s) * 0.1)
    } else {
      groupRef.current.scale.setScalar(1)
    }

    // Balancement haut/bas très subtil (±0.04 m) une fois apparu
    if (s > 0.5 && meshRef.current) {
      meshRef.current.position.y = 0.75 + Math.sin(t * 1.2 + phase) * 0.03
      // Légère inclinaison latérale
      meshRef.current.rotation.z = Math.sin(t * 0.8 + phase) * 0.04
    }
  })

  return (
    <group ref={groupRef} position={[px, 0, pz]} scale={0.01}>
      <mesh ref={meshRef} position={[0, 0.75, 0]} castShadow>
        <capsuleGeometry args={[0.12, 0.28, 4, 8]} />
        <meshStandardMaterial color={couleur} roughness={0.85} />
      </mesh>
    </group>
  )
}

// ─── Client en file d'attente animé ───────────────────────────────────────────
// Tourne lentement sur lui-même (impatient qui regarde autour)
function ClientFile({ position, couleur, index = 0 }) {
  const groupRef = useRef()
  const phase = (index * 2.1) % (Math.PI * 2)

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    // Rotation lente irrégulière
    groupRef.current.rotation.y = Math.sin(t * 0.4 + phase) * 0.6
    // Léger balancement
    groupRef.current.position.y = Math.sin(t * 1.1 + phase) * 0.02
    // Apparition
    const s = groupRef.current.scale.x
    if (s < 0.99) groupRef.current.scale.setScalar(s + (1 - s) * 0.08)
  })

  return (
    <group ref={groupRef} position={position} scale={0.01}>
      <mesh position={[0, 0.72, 0]} castShadow>
        <capsuleGeometry args={[0.12, 0.28, 4, 8]} />
        <meshStandardMaterial color={couleur} roughness={0.85} />
      </mesh>
    </group>
  )
}

// ─── Étiquette flottante au-dessus d'une table ───────────────────────────────
function Etiquette({ numero, statut, urgence, couleur }) {
  const libelle = LIBELLE_STATUT[statut] ?? statut
  const minutes = urgence.minutes
  const estAlerte = urgence.niveau === 'alerte'
  const estWarn   = urgence.niveau === 'warn'

  // Style de la pilule
  const borderColor = estAlerte ? '#EF4444' : estWarn ? '#F59E0B' : 'transparent'
  const bgColor     = estAlerte ? '#FEF2F2' : estWarn ? '#FFFBEB' : 'rgba(255,255,255,0.92)'
  const textColor   = estAlerte ? '#B91C1C' : estWarn ? '#92400E' : '#1F2328'

  return (
    <Html
      position={[0, 1.55, 0]}
      center
      distanceFactor={8}
      zIndexRange={[10, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <div style={{
        fontFamily: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif',
        background: bgColor,
        border: `2px solid ${borderColor}`,
        borderRadius: '999px',
        padding: '5px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.13)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}>
        {/* Numéro de table */}
        <span style={{ fontWeight: 700, fontSize: '13px', color: textColor }}>
          T{numero}
        </span>
        {/* Pastille couleur statut */}
        <span style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: couleur, flexShrink: 0,
          border: '1.5px solid rgba(0,0,0,0.08)',
        }} />
        {/* Libellé statut */}
        <span style={{ fontSize: '11px', color: textColor, opacity: 0.85 }}>
          {libelle}
        </span>
        {/* Chrono — seulement si la table est occupée et qu'un seuil existe */}
        {minutes > 0 && (
          <span style={{
            fontSize: '12px',
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 600,
            color: estAlerte ? '#EF4444' : estWarn ? '#F59E0B' : '#57606A',
            marginLeft: '2px',
          }}>
            {minutes} min
          </span>
        )}
      </div>
    </Html>
  )
}

// ─── Halo pulsant pour les alertes ────────────────────────────────────────────
function HaloAlerte() {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (!ref.current) return
    const s = 1 + 0.08 * Math.sin(clock.getElapsedTime() * 3.5)
    ref.current.scale.set(s, 1, s)
    ref.current.material.opacity = 0.35 + 0.2 * Math.sin(clock.getElapsedTime() * 3.5)
  })
  return (
    <mesh ref={ref} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.05, 1.35, 48]} />
      <meshStandardMaterial color="#EF4444" transparent opacity={0.45} roughness={1} />
    </mesh>
  )
}

// ─── Une table ────────────────────────────────────────────────────────────────
function Table({ table, visite, simTime, estSelectionnee, onSelectTable }) {
  const { forme, capacite, x, z } = table
  const statut      = visite?.statut ?? 'LIBRE'
  const nbPersonnes = visite?.nbPersonnes ?? 0

  // Calcul urgence en temps réel avec simTime
  const urgence = calcUrgence(visite, simTime)
  const couleur = couleurTable(statut, urgence)

  // Survol
  const [survol, setSurvol] = useState(false)
  const groupRef = useRef()

  // Interpolation douce de la hauteur (survol ou sélection = soulevé)
  useFrame(() => {
    if (!groupRef.current) return
    const cible = (survol || estSelectionnee) ? 0.18 : 0
    groupRef.current.position.y += (cible - groupRef.current.position.y) * 0.12
  })

  // Dimensions plateau
  let plW, plD
  if (forme === 'ronde')       { plW = capacite <= 2 ? 0.78 : 0.95; plD = plW }
  else if (forme === 'carree') { plW = 0.88; plD = 0.88 }
  else                         { plW = 1.75; plD = 0.88 }

  const plateauY = 0.74
  const chaises  = getChaises(forme, capacite)

  return (
    <group position={[x, 0, z]}>
      {/* Disque au sol — reste au sol, pas affecté par le soulèvement */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.1, 40]} />
        <meshStandardMaterial color={couleur} roughness={0.9} transparent opacity={0.4} />
      </mesh>

      {/* Contour sélection — anneau noir fin */}
      {estSelectionnee && (
        <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.12, 1.22, 48]} />
          <meshStandardMaterial color="#111827" transparent opacity={0.7} roughness={1} />
        </mesh>
      )}

      {/* Halo rouge pulsant si alerte */}
      {urgence.niveau === 'alerte' && <HaloAlerte />}

      {/* Groupe soulevable (table + chaises + clients + étiquette) */}
      <group ref={groupRef}
        onPointerOver={(e) => { e.stopPropagation(); setSurvol(true); document.body.style.cursor = 'pointer' }}
        onPointerOut={(e)  => { e.stopPropagation(); setSurvol(false); document.body.style.cursor = 'auto' }}
        onClick={(e)       => { e.stopPropagation(); onSelectTable(table.id) }}
      >
        {/* Pied */}
        <mesh position={[0, plateauY / 2, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.06, plateauY, 8]} />
          <meshStandardMaterial color={COULEUR_PIED} roughness={0.75} />
        </mesh>
        {/* Base */}
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.08, 16]} />
          <meshStandardMaterial color={COULEUR_PIED} roughness={0.75} />
        </mesh>

        {/* Plateau coloré selon statut/urgence */}
        {forme === 'ronde' ? (
          <mesh position={[0, plateauY, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[plW / 2, plW / 2, 0.06, 32]} />
            <meshStandardMaterial color={couleur} roughness={0.75} />
          </mesh>
        ) : (
          <RoundedBox args={[plW, 0.06, plD]} radius={0.05} smoothness={4}
            position={[0, plateauY, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={couleur} roughness={0.75} />
          </RoundedBox>
        )}

        {/* Chaises */}
        {chaises.map((c, i) => (
          <Chaise key={i} px={c.px} pz={c.pz} couleur={statut === 'LIBRE' ? COULEUR_CHAISE : couleur} />
        ))}

        {/* Clients assis — index pour phase d'animation décalée */}
        {chaises.slice(0, nbPersonnes).map((c, i) => (
          <Client key={i} px={c.px} pz={c.pz} couleur={couleur} index={i} />
        ))}

        {/* Étiquette flottante */}
        <Etiquette
          numero={table.numero}
          statut={statut}
          urgence={urgence}
          couleur={couleur}
        />
      </group>
    </group>
  )
}

// ─── File d'attente à l'entrée ────────────────────────────────────────────────
// Groupes alignés près de l'entrée, chaque personne tourne lentement (impatiente)
// ─── Décor extérieur (trottoir + rue devant le restaurant) ────────────────────
function Exterieur() {
  return (
    <group>
      {/* Trottoir béton clair devant le mur gauche */}
      <mesh position={[-9.5, -0.02, 0]} receiveShadow>
        <boxGeometry args={[7, 0.06, 14]} />
        <meshStandardMaterial color="#D1D5DB" roughness={0.95} />
      </mesh>

      {/* Bande de rue plus foncée (asphalte) au-delà */}
      <mesh position={[-14, -0.04, 0]}>
        <boxGeometry args={[5, 0.04, 20]} />
        <meshStandardMaterial color="#9CA3AF" roughness={0.98} />
      </mesh>

      {/* Ligne jaune centrale de la route */}
      <mesh position={[-14, -0.02, 0]}>
        <boxGeometry args={[0.12, 0.01, 18]} />
        <meshStandardMaterial color="#FCD34D" roughness={0.9} />
      </mesh>

      {/* Bordure de trottoir */}
      <mesh position={[-6.9, 0.04, 0]}>
        <boxGeometry args={[0.18, 0.12, 14]} />
        <meshStandardMaterial color="#E5E7EB" roughness={0.9} />
      </mesh>

      {/* Lampadaires (2) */}
      {[-2.5, 2.5].map((z, i) => (
        <group key={i} position={[-8.5, 0, z]}>
          {/* Poteau */}
          <mesh position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.05, 0.07, 2.4, 8]} />
            <meshStandardMaterial color="#6B7280" roughness={0.7} metalness={0.4} />
          </mesh>
          {/* Bras horizontal */}
          <mesh position={[0.3, 2.3, 0]} rotation={[0, 0, -0.3]}>
            <cylinderGeometry args={[0.03, 0.03, 0.7, 6]} />
            <meshStandardMaterial color="#6B7280" roughness={0.7} metalness={0.4} />
          </mesh>
          {/* Ampoule */}
          <mesh position={[0.55, 2.15, 0]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshStandardMaterial color="#FEF9C3" roughness={0.3} emissive="#FEF08A" emissiveIntensity={0.6} />
          </mesh>
        </group>
      ))}

      {/* Pot de fleur décoratif (x2, de chaque côté de l'entrée) */}
      {[-1.2, 1.2].map((z, i) => (
        <group key={i} position={[-6.6, 0, z]}>
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.18, 0.12, 0.3, 12]} />
            <meshStandardMaterial color="#A16207" roughness={0.85} />
          </mesh>
          {/* Plante */}
          <mesh position={[0, 0.45, 0]}>
            <sphereGeometry args={[0.22, 8, 8]} />
            <meshStandardMaterial color="#16A34A" roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Enseigne au-dessus de l'entrée */}
      <group position={[-6.3, 1.8, 0]}>
        <RoundedBox args={[0.12, 0.6, 2.2]} radius={0.06} smoothness={3}>
          <meshStandardMaterial color="#1E293B" roughness={0.8} />
        </RoundedBox>
        {/* Petite lumière enseigne */}
        <mesh position={[0.1, 0, 0]}>
          <boxGeometry args={[0.04, 0.5, 2.0]} />
          <meshStandardMaterial color="#FEF9C3" emissive="#FEF08A" emissiveIntensity={0.4} roughness={0.5} />
        </mesh>
      </group>
    </group>
  )
}

// ─── File d'attente EXTÉRIEURE (serpentin sur le trottoir) ────────────────────
function FileAttente({ visites }) {
  const enAttente = visites.filter(v => v.tableId === null)
  if (enAttente.length === 0) return null

  const COULEURS_FILE = ['#C7D2FE', '#BFDBFE', '#DDD6FE', '#E0F2FE', '#D1FAE5']

  // Serpentin sur le trottoir, x négatif (extérieur)
  // Couloir 0 : part de l'entrée (z=0) vers z=-3.5, x=-7.5
  // Couloir 1 : revient de z=-3.5 vers z=+3.5,       x=-8.2
  // Couloir 2 : repart vers z=-3.5,                   x=-8.9
  const LARGEUR_COULOIR = 0.7
  const PAS             = 0.45
  const Z_MIN = -3.5, Z_MAX = 0.5   // premier couloir part de l'entrée (z≈0)
  const LONGUEUR = Z_MAX - Z_MIN

  const tousLesGens = []
  for (const visite of enAttente) {
    const couleur = COULEURS_FILE[enAttente.indexOf(visite) % COULEURS_FILE.length]
    for (let pi = 0; pi < visite.nbPersonnes; pi++) {
      tousLesGens.push({ visiteId: visite.id, pi, couleur })
    }
  }

  const positions = tousLesGens.map((_, i) => {
    const dist        = i * PAS
    const couloir     = Math.floor(dist / LONGUEUR)
    const posInCouloir = dist % LONGUEUR
    const x = -7.5 - couloir * LARGEUR_COULOIR
    const z = couloir % 2 === 0
      ? Z_MAX - posInCouloir   // pair : du haut vers le bas
      : Z_MIN + posInCouloir   // impair : du bas vers le haut
    return { x, z }
  })

  return (
    <group>
      {/* Personnes en serpentin sur le trottoir */}
      {tousLesGens.map((g, i) => (
        <ClientFile
          key={`${g.visiteId}-${g.pi}`}
          position={[positions[i].x, 0, positions[i].z]}
          couleur={g.couleur}
          index={i}
        />
      ))}
    </group>
  )
}

// ─── Lumières ─────────────────────────────────────────────────────────────────
function Lumieres() {
  return (
    <>
      <hemisphereLight args={['#FFFFFF', '#D1D5DB', 1.2]} />
      <directionalLight position={[6, 12, 5]} intensity={1.5} castShadow
        shadow-mapSize-width={1024} shadow-mapSize-height={1024}
        shadow-camera-near={0.5} shadow-camera-far={40}
        shadow-camera-left={-12} shadow-camera-right={12}
        shadow-camera-top={10} shadow-camera-bottom={-10}
      />
      <directionalLight position={[-5, 7, -4]} intensity={0.5} />
    </>
  )
}

// ─── Scène ────────────────────────────────────────────────────────────────────
function Scene({ snapshot, alertes, tableSelectionnee, onSelectTable }) {
  const tables  = snapshot?.tables  ?? []
  const visites = snapshot?.visites ?? []
  const simTime = snapshot?.simTime ?? null

  const visiteParTable = {}
  for (const v of visites) {
    if (v.tableId) visiteParTable[v.tableId] = v
  }

  return (
    <>
      <Lumieres />
      <Exterieur />
      <Parquet />
      <Murets />
      <Entree />
      {tables.map(t => (
        <Table
          key={t.id}
          table={t}
          visite={visiteParTable[t.id] ?? null}
          simTime={simTime}
          estSelectionnee={tableSelectionnee === t.id}
          onSelectTable={onSelectTable}
        />
      ))}
      <FileAttente visites={visites} />
      <ContactShadows position={[0, 0.05, 0]} opacity={0.22} scale={22} blur={2.5} far={2} resolution={256} />
    </>
  )
}

// ─── Composant exporté ────────────────────────────────────────────────────────
export default function Salle3D({
  snapshot,
  alertes = [],
  tableSelectionnee = null,
  onSelectTable = () => {},
}) {
  return (
    <Canvas
      dpr={[1, 2]}
      shadows
      camera={{ fov: 40, position: [2, 11, 13], near: 0.1, far: 100 }}
      style={{ width: '100%', height: '100%', display: 'block', background: '#F5F6F8' }}
    >
      <Scene
        snapshot={snapshot}
        alertes={alertes}
        tableSelectionnee={tableSelectionnee}
        onSelectTable={onSelectTable}
      />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08}
        minPolarAngle={0.15} maxPolarAngle={Math.PI / 2.1}
        minDistance={6} maxDistance={28} enablePan={false} target={[0, 0, 0]}
      />
    </Canvas>
  )
}
