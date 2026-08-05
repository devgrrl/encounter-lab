import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Html, OrbitControls, useAnimations, useGLTF } from '@react-three/drei';
import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  AdditiveBlending,
  type BufferAttribute,
  Color,
  MathUtils,
  Mesh,
  type MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  type Points,
  Spherical,
  Vector3,
  type Group,
} from 'three';
import type { CharacterStateProjection, CombatEvent } from '../types';
import { eventTone } from '../utils/eventPresentation';
import { CameraControls, type CameraAction } from './CameraControls';
import { DamageEffect } from './DamageEffects';
import { DeathResurrection } from './DeathResurrection';
import styles from './EncounterScene.module.css';

// Vendored locally from KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0
// at revision 672074b73ba276876a19e8816ecdc5241817ab47 (see THIRD_PARTY_ASSETS.md).
// Served from this app's own public/ directory so the scene loads with no
// external network access, including behind a corporate firewall.
const knightModelUrl = '/models/Knight.glb';
// Vendored from KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0 at
// revision 15b62b9bad122f72926c10fb14d622c73819fa54 (see THIRD_PARTY_ASSETS.md).
const skeletonWarriorModelUrl = '/models/SkeletonWarrior.glb';

const cameraTarget = new Vector3(0, 1.05, 0);
const defaultCameraPosition = new Vector3(5.8, 4.2, 7.8);
const brivPosition = new Vector3(-1.75, 1.05, .15);
const enemyPosition = new Vector3(1.75, 1.25, -.15);

interface CameraCommand { action: CameraAction; sequence: number; }
interface OrbitControlHandle { target: Vector3; update: () => void; }
type EquipmentProfile = 'knight' | 'barbarian' | 'skeleton';

class SceneErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('The 3D encounter view could not be initialized.', error, info); }
  render() {
    if (this.state.failed) {
      return (
        <div className={styles.fallback} role="status" aria-live="polite">
          <strong>3D view unavailable</strong>
          <span>Combat controls, dice, history, and replay remain usable.</span>
        </div>
      );
    }
    return this.props.children;
  }
}

function hitPointColor(ratio: number) {
  return ratio > .55 ? '#72dfa1' : ratio > .25 ? '#f1d36d' : '#ef6159';
}

function HitPointRing({ ratio }: { ratio: number }) {
  const color = hitPointColor(ratio);
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, .035, 0]}>
      <mesh>
        <ringGeometry args={[.72, .8, 64]} />
        <meshBasicMaterial color="#0a211a" transparent opacity={.96} />
      </mesh>
      {ratio > 0 && (
        <mesh rotation={[0, 0, Math.PI * (1 - ratio)]}>
          <ringGeometry args={[.725, .795, 64, 1, 0, Math.PI * 2 * ratio]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

const equipmentPatterns: Array<{ key: string; pattern: RegExp }> = [
  { key: 'shield', pattern: /shield/i },
  { key: 'sword', pattern: /sword|blade/i },
  { key: 'axe', pattern: /axe|hatchet/i },
  { key: 'bow', pattern: /crossbow|longbow|shortbow|bow/i },
  { key: 'staff', pattern: /staff|wand/i },
  { key: 'dagger', pattern: /dagger|knife/i },
  { key: 'hammer', pattern: /hammer|mace|maul/i },
  { key: 'spear', pattern: /spear|polearm/i },
  { key: 'quiver', pattern: /quiver|arrow/i },
];

function equipmentKey(node: Object3D) {
  return equipmentPatterns.find(({ pattern }) => pattern.test(node.name))?.key ?? null;
}

function equipmentPreference(profile: EquipmentProfile, key: string, name: string) {
  const normalized = name.toLowerCase();
  if (profile === 'knight' && key === 'sword') {
    if (/1h|one.?hand|short/.test(normalized)) return 30;
    if (/2h|two.?hand|great/.test(normalized)) return -20;
  }
  if (profile === 'barbarian' && key === 'axe') {
    if (/2h|two.?hand|battle|great/.test(normalized)) return 30;
    if (/1h|one.?hand|hatchet/.test(normalized)) return 10;
  }
  return 0;
}

function hasEquipmentAncestor(node: Object3D, key: string) {
  for (let current = node.parent; current; current = current.parent) {
    if (equipmentKey(current) === key) return true;
  }
  return false;
}

function sanitizeEquipment(root: Object3D, profile: EquipmentProfile) {
  const allowed = profile === 'knight'
    ? new Set(['sword', 'shield'])
    : profile === 'barbarian'
      ? new Set(['axe'])
      : new Set<string>();
  const candidates: Array<{ key: string; node: Object3D; depth: number }> = [];

  root.traverse((node) => {
    const key = equipmentKey(node);
    if (!key || hasEquipmentAncestor(node, key)) return;

    let depth = 0;
    for (let current = node.parent; current; current = current.parent) depth += 1;
    candidates.push({ key, node, depth });
  });

  // KayKit character files contain multiple accessory loadouts in the same GLB.
  // Hide each top-level equipment assembly, then reveal exactly one deterministic
  // assembly for the intended loadout. Selecting roots rather than child meshes
  // prevents a visible child from remaining trapped under a hidden duplicate root.
  for (const candidate of candidates) candidate.node.visible = false;

  for (const key of allowed) {
    const selected = candidates
      .filter((candidate) => candidate.key === key)
      .sort((left, right) => {
        const scoreDifference = equipmentPreference(profile, key, right.node.name)
          - equipmentPreference(profile, key, left.node.name);
        if (scoreDifference !== 0) return scoreDifference;
        if (left.depth !== right.depth) return left.depth - right.depth;
        return left.node.name.localeCompare(right.node.name);
      })[0];
    if (selected) selected.node.visible = true;
  }
}

function prepareCharacter(root: Object3D, profile: EquipmentProfile) {
  sanitizeEquipment(root, profile);
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.material = Array.isArray(node.material)
      ? node.material.map((material) => material.clone())
      : node.material.clone();
  });
}

// KayKit's character packs share a common rig convention (handslot.l/handslot.r
// attachment bones in the source glTF), so a weapon mesh authored for one
// character file can be grafted onto another character's hand socket without
// re-rigging. Three.js's GLTFLoader strips "." from skinned-mesh joint names
// when constructing THREE.Bone objects (it reserves "." as the property-path
// separator for animation clip targeting), so the bone name to look up at
// runtime is "handslotr", not the "handslot.r" name the glTF source uses.
function attachWeapon(root: Object3D, weaponTemplate: Object3D, boneName: string) {
  const bone = root.getObjectByName(boneName);
  if (!bone) return;
  const weapon = weaponTemplate.clone(true);
  weapon.position.set(0, .06, .02);
  weapon.rotation.set(Math.PI * .06, 0, Math.PI * .04);
  weapon.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.material = Array.isArray(node.material)
      ? node.material.map((material) => material.clone())
      : node.material.clone();
  });
  bone.add(weapon);
}

function setCharacterGlow(root: Object3D, color: string, intensity: number) {
  const glow = new Color(color);
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (material instanceof MeshStandardMaterial) {
        material.emissive.copy(glow);
        material.emissiveIntensity = intensity;
        material.needsUpdate = true;
      }
    }
  });
}

function LicensedCharacterModel({
  url,
  position,
  rotationY,
  scale = 1,
  paused,
  glowColor,
  glowIntensity,
  equipmentProfile,
  weaponTemplate,
  weaponBoneName,
}: {
  url: string;
  position: [number, number, number];
  rotationY: number;
  scale?: number;
  paused: boolean;
  glowColor: string;
  glowIntensity: number;
  equipmentProfile: EquipmentProfile;
  weaponTemplate?: Object3D | null;
  weaponBoneName?: string;
}) {
  const group = useRef<Group>(null);
  const { scene, animations } = useGLTF(url);
  const clonedScene = useMemo(() => {
    const value = cloneSkeleton(scene);
    prepareCharacter(value, equipmentProfile);
    if (weaponTemplate && weaponBoneName) attachWeapon(value, weaponTemplate, weaponBoneName);
    return value;
  }, [equipmentProfile, scene, weaponTemplate, weaponBoneName]);
  const { actions, names, mixer } = useAnimations(animations, group);

  useEffect(() => {
    setCharacterGlow(clonedScene, glowColor, glowIntensity);
  }, [clonedScene, glowColor, glowIntensity]);

  useEffect(() => {
    const idleName = names.find((name: string) => /idle/i.test(name)) ?? names[0];
    const action = idleName ? actions[idleName] : undefined;
    if (!action) return undefined;
    action.reset().fadeIn(.18).play();
    action.paused = paused;
    return () => { action.fadeOut(.18); };
  }, [actions, names]);

  useEffect(() => {
    mixer.timeScale = paused ? 0 : 1;
    for (const action of Object.values(actions) as Array<{ paused: boolean } | null | undefined>) {
      if (action) action.paused = paused;
    }
  }, [actions, mixer, paused]);

  return (
    <group ref={group} position={position} rotation={[0, rotationY, 0]} scale={scale} dispose={null}>
      <primitive object={clonedScene} />
    </group>
  );
}

function BrivModel({ projection, paused, characterName }: { projection: CharacterStateProjection; paused: boolean; characterName: string }) {
  const ratio = projection.currentHitPoints / projection.maximumHitPoints;
  const glowColor = hitPointColor(ratio);
  const glowIntensity = ratio > .55 ? .1 : ratio > .25 ? .2 : .34;
  const knightGroupRef = useRef<Group>(null);
  const [aliveVisualsVisible, setAliveVisualsVisible] = useState(projection.currentHitPoints > 0);

  return (
    <group position={[-1.75, 0, .15]}>
      {aliveVisualsVisible && <HitPointRing ratio={ratio} />}
      <group ref={knightGroupRef}>
        <LicensedCharacterModel
          url={knightModelUrl}
          position={[0, .02, 0]}
          rotationY={Math.PI / 2}
          scale={1.14}
          paused={paused}
          glowColor={glowColor}
          glowIntensity={glowIntensity}
          equipmentProfile="knight"
        />
      </group>
      <DeathResurrection
        hitPoints={projection.currentHitPoints}
        paused={paused}
        knightModelUrl={knightModelUrl}
        knightGroupRef={knightGroupRef}
        characterName={characterName}
        onAliveVisualsVisibleChange={setAliveVisualsVisible}
      />
      {aliveVisualsVisible && (
        <Html center position={[0, 2.5, 0]} distanceFactor={8}>
          <div className={`${styles.nameplate} ${styles.nameplateAlly}`} aria-hidden="true">
            {characterName.toUpperCase()}
            <div className={styles.nameplateHpTrack}>
              <span style={{ width: `${Math.max(0, ratio * 100)}%`, backgroundColor: glowColor }} />
            </div>
          </div>
        </Html>
      )}
      {aliveVisualsVisible && projection.temporaryHitPoints > 0 && (
        <mesh position={[0, 1.05, 0]}>
          <sphereGeometry args={[.92, 32, 20]} />
          <meshPhysicalMaterial color="#7ce7d4" emissive="#2e9e88" emissiveIntensity={.25} transparent opacity={.13} roughness={.12} metalness={.06} transmission={.32} thickness={.4} />
        </mesh>
      )}
    </group>
  );
}

// Deterministic pseudo-random hash (not Math.random — this is presentation-only
// motion for a cosmetic fire/ash effect, and this codebase's guardrails keep
// all randomness, including incidental client-side randomness, off the client).
function deterministicJitter(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

// Native three.js particle system (Points + BufferGeometry): embers that
// spiral upward from the pit and reset once they rise past head height.
function Sparks({ paused }: { paused: boolean }) {
  const pointsRef = useRef<Points>(null);
  const count = 220;
  const seeds = useMemo(() => Array.from({ length: count }, (_, index) => ({
    angle: deterministicJitter(index, 3) * Math.PI * 2,
    speed: .35 + deterministicJitter(index, 7) * .5,
    drift: .12 + deterministicJitter(index, 13) * .3,
    offset: deterministicJitter(index, 19) * 3,
  })), []);
  const positions = useMemo(() => new Float32Array(count * 3), []);

  useFrame(({ clock }) => {
    if (paused) return;
    const attribute = pointsRef.current?.geometry.attributes.position as BufferAttribute | undefined;
    if (!attribute) return;
    const time = clock.getElapsedTime();
    for (let index = 0; index < count; index += 1) {
      const seed = seeds[index];
      const life = (time * seed.speed + seed.offset) % 2.2;
      const rise = life / 2.2;
      const radius = seed.drift * (1 - rise * .4);
      const angle = seed.angle + time * .6;
      attribute.setXYZ(
        index,
        Math.cos(angle) * radius,
        rise * 1.9,
        Math.sin(angle) * radius,
      );
    }
    attribute.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#ffb04a"
        size={.05}
        sizeAttenuation
        transparent
        opacity={.95}
        depthWrite={false}
        toneMapped={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

// Soft rising smoke wisps: dark, low-opacity spheres that climb from the pit
// and fade out well before they'd otherwise reach the treeline.
function SmokeWisps({ paused }: { paused: boolean }) {
  const wisps = useRef<(Mesh | null)[]>([]);
  const smokeCount = 14;
  const seeds = useMemo(() => Array.from({ length: smokeCount }, (_, index) => ({
    angle: (index / smokeCount) * Math.PI * 2 + deterministicJitter(index, 67),
    speed: .16 + deterministicJitter(index, 53) * .08,
    offset: deterministicJitter(index, 59) * 4,
    drift: .16 + deterministicJitter(index, 61) * .26,
  })), []);

  useFrame(({ clock }) => {
    if (paused) return;
    const time = clock.getElapsedTime();
    wisps.current.forEach((wisp, index) => {
      if (!wisp) return;
      const seed = seeds[index];
      const life = (time * seed.speed + seed.offset) % 4;
      const rise = life / 4;
      wisp.position.set(
        Math.cos(seed.angle + time * .15) * seed.drift * (1 + rise),
        .5 + rise * 2.1,
        Math.sin(seed.angle + time * .15) * seed.drift * (1 + rise),
      );
      wisp.scale.setScalar(.5 + rise * .9);
      const material = wisp.material as MeshBasicMaterial;
      material.opacity = .3 * (1 - rise) * (1 - rise);
    });
  });

  return (
    <group>
      {seeds.map((seed, index) => (
        <mesh key={index} ref={(node) => { wisps.current[index] = node; }}>
          <sphereGeometry args={[.24 + (index % 2) * .08, 8, 6]} />
          <meshBasicMaterial color="#221d1a" transparent opacity={0} toneMapped={false} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// Charred ground pit: a dark scorched disc under the Ash Warden with a
// layered glowing rim (several concentric rings at falling opacity, rather
// than one hard-edged ring) so the glow reads as a soft gradient.
function CharredPit({ paused }: { paused: boolean }) {
  const rim = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (paused || !rim.current) return;
    const pulse = .85 + Math.sin(clock.getElapsedTime() * 2.8) * .15;
    rim.current.scale.setScalar(pulse);
  });
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, .015, 0]}>
      <mesh>
        <circleGeometry args={[.95, 40]} />
        <meshStandardMaterial color="#120d0a" roughness={1} />
      </mesh>
      <group ref={rim}>
        {[.62, .72, .82].map((radius, index) => (
          <mesh key={radius} position={[0, 0, .001 * (index + 1)]}>
            <ringGeometry args={[radius, radius + .07, 44]} />
            <meshBasicMaterial color="#ff6a2a" transparent opacity={.42 - index * .12} toneMapped={false} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function EnemyModel({ paused }: { paused: boolean }) {
  const { scene: knightScene } = useGLTF(knightModelUrl);
  const swordTemplate = useMemo(() => knightScene.getObjectByName('1H_Sword') ?? null, [knightScene]);

  return (
    <group position={[1.75, 0, -.15]}>
      <pointLight color="#ff7a33" intensity={1.4} distance={3.2} position={[0, .55, 0]} />
      <CharredPit paused={paused} />
      <Sparks paused={paused} />
      <SmokeWisps paused={paused} />
      <LicensedCharacterModel
        url={skeletonWarriorModelUrl}
        position={[0, .02, 0]}
        rotationY={-Math.PI / 2}
        scale={1.12}
        paused={paused}
        glowColor="#ff5a1f"
        glowIntensity={0}
        equipmentProfile="skeleton"
        weaponTemplate={swordTemplate}
        weaponBoneName="handslotr"
      />
      <Html center position={[0, 2.5, 0]} distanceFactor={8}>
        <div className={`${styles.nameplate} ${styles.nameplateEnemy}`} aria-hidden="true">
          ASH WARDEN
          <div className={styles.nameplateHpTrack}>
            <span style={{ width: '100%', backgroundColor: '#ef6159' }} />
          </div>
        </div>
      </Html>
    </group>
  );
}

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, .65, 0]}>
        <cylinderGeometry args={[.12, .18, 1.3, 7]} />
        <meshStandardMaterial color="#102e22" roughness={.9} />
      </mesh>
      <mesh castShadow position={[0, 1.55, 0]}>
        <coneGeometry args={[.62, 1.7, 8]} />
        <meshStandardMaterial color="#174b36" emissive="#0b2c20" emissiveIntensity={.18} roughness={.82} />
      </mesh>
      <mesh castShadow position={[0, 2.15, 0]}>
        <coneGeometry args={[.45, 1.35, 8]} />
        <meshStandardMaterial color="#216348" emissive="#0d3828" emissiveIntensity={.2} roughness={.8} />
      </mesh>
    </group>
  );
}

function ForestSet() {
  return (
    <group>
      <Tree position={[-5, 0, -3.4]} scale={1.2} />
      <Tree position={[-4.5, 0, 3.5]} scale={.9} />
      <Tree position={[4.8, 0, -3.6]} scale={1.1} />
      <Tree position={[5.2, 0, 3.1]} scale={1.25} />
      <Tree position={[0, 0, -5]} scale={.85} />
      {[
        [-3.7, .3, -1.9], [3.8, .28, 1.8], [-2.8, .24, 3], [2.9, .26, -2.8],
      ].map((position, index) => (
        <mesh key={index} position={position as [number, number, number]} rotation={[0, index * .7, .12]}>
          <octahedronGeometry args={[.28 + index * .03, 0]} />
          <meshPhysicalMaterial color="#a6f3e4" emissive="#2d9b83" emissiveIntensity={.6} transparent opacity={.56} transmission={.35} roughness={.08} metalness={.05} />
        </mesh>
      ))}
    </group>
  );
}

function CombatEffect({ event, paused }: { event: CombatEvent | null; paused: boolean }) {
  const heal = useRef<Group>(null);
  const shield = useRef<Group>(null);
  const elapsed = useRef(0);
  const tone = event ? eventTone(event) : 'neutral';

  useEffect(() => {
    elapsed.current = 0;
    for (const ref of [heal, shield]) {
      if (ref.current) ref.current.visible = false;
    }
  }, [event?.id]);

  useFrame((_, delta) => {
    if (paused || !event) return;

    elapsed.current += Math.min(delta, .1);
    const age = elapsed.current;
    if (heal.current) {
      heal.current.visible = tone === 'healing' && age < 1.45;
      heal.current.position.y = .25 + age * .82;
      heal.current.scale.setScalar(.72 + age * .52);
      heal.current.rotation.y = age * 1.4;
    }
    if (shield.current) {
      shield.current.visible = tone === 'shield' && age < 1.25;
      shield.current.scale.setScalar(.75 + Math.sin(Math.min(age, 1) * Math.PI) * .34);
      shield.current.rotation.y = age * 1.2;
    }
  });

  if (!event) return null;

  return (
    <>
      {tone === 'damage' && event.details.damageType && (
        <DamageEffect
          key={event.id}
          type={event.details.damageType}
          source={enemyPosition}
          target={brivPosition}
          paused={paused}
        />
      )}
      <group ref={heal} visible={false} position={[brivPosition.x, .25, brivPosition.z]}>
        <pointLight color="#72dfa1" intensity={3.6} distance={4} />
        {[0, .24, .48].map((height) => (
          <mesh key={height} rotation={[Math.PI / 2, 0, 0]} position={[0, height, 0]}>
            <torusGeometry args={[.36 + height * .45, .035, 10, 40]} />
            <meshBasicMaterial color="#72dfa1" transparent opacity={.82 - height * .5} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <group ref={shield} visible={false} position={[brivPosition.x, brivPosition.y, brivPosition.z]}>
        <pointLight color="#91f5e1" intensity={3.8} distance={4} />
        <mesh>
          <icosahedronGeometry args={[.86, 2]} />
          <meshBasicMaterial color="#91f5e1" wireframe transparent opacity={.62} toneMapped={false} />
        </mesh>
      </group>
    </>
  );
}

function CameraRig({ command, paused }: { command: CameraCommand | null; paused: boolean }) {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlHandle | null>(null);

  useEffect(() => {
    if (!command) return;
    if (command.action === 'reset') {
      camera.position.copy(defaultCameraPosition);
    } else {
      const offset = camera.position.clone().sub(cameraTarget);
      const spherical = new Spherical().setFromVector3(offset);
      switch (command.action) {
        case 'rotate-left': spherical.theta -= Math.PI / 12; break;
        case 'rotate-right': spherical.theta += Math.PI / 12; break;
        case 'tilt-up': spherical.phi = MathUtils.clamp(spherical.phi - Math.PI / 18, .35, Math.PI / 2.1); break;
        case 'tilt-down': spherical.phi = MathUtils.clamp(spherical.phi + Math.PI / 18, .35, Math.PI / 2.1); break;
        case 'zoom-in': spherical.radius = MathUtils.clamp(spherical.radius * .84, 5.2, 14); break;
        case 'zoom-out': spherical.radius = MathUtils.clamp(spherical.radius * 1.18, 5.2, 14); break;
        default: break;
      }
      camera.position.copy(cameraTarget.clone().add(new Vector3().setFromSpherical(spherical)));
    }
    camera.lookAt(cameraTarget);
    controlsRef.current?.target.copy(cameraTarget);
    controlsRef.current?.update();
  }, [camera, command]);

  return (
    <OrbitControls
      ref={(value: unknown) => { controlsRef.current = value as OrbitControlHandle | null; }}
      makeDefault
      target={[cameraTarget.x, cameraTarget.y, cameraTarget.z]}
      minDistance={5.2}
      maxDistance={14}
      maxPolarAngle={Math.PI / 2.1}
      enablePan={false}
      enableDamping={!paused}
    />
  );
}

function SceneContent({ projection, event, paused, cameraCommand, characterName }: { projection: CharacterStateProjection; event: CombatEvent | null; paused: boolean; cameraCommand: CameraCommand | null; characterName: string; }) {
  return (
    <>
      <color attach="background" args={['#03100d']} />
      <fog attach="fog" args={['#03100d', 9, 23]} />
      <ambientLight intensity={.82} />
      <hemisphereLight args={['#c9fff1', '#02100b', 1.15]} />
      <directionalLight position={[4, 8, 5]} color="#d9fff6" intensity={1.75} castShadow shadow-mapSize={[2048, 2048]} />
      <pointLight position={[-4, 2.5, 1]} color="#48b98c" intensity={4.8} distance={8} />
      <pointLight position={[4, 2.4, -1]} color="#a43c34" intensity={3.8} distance={7} />
      <pointLight position={[0, 4, 3]} color="#d5b45a" intensity={2.1} distance={9} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[16, 16]} />
        <meshStandardMaterial color="#09251a" roughness={.94} metalness={.03} />
      </mesh>
      <gridHelper args={[16, 16, '#5abca1', '#153b30']} position={[0, .012, 0]} />
      <ForestSet />
      <Suspense fallback={<Html center><div className={styles.modelLoading}>Loading models</div></Html>}>
        <BrivModel projection={projection} paused={paused} characterName={characterName} />
        <EnemyModel paused={paused} />
      </Suspense>
      <CombatEffect event={event} paused={paused} />
      <ContactShadows position={[0, .02, 0]} opacity={.58} scale={12} blur={2} far={5} />
      <CameraRig command={cameraCommand} paused={paused} />
    </>
  );
}

export function EncounterScene({ projection, event, reducedMotion, simplified = false, characterName = 'Briv' }: { projection: CharacterStateProjection; event: CombatEvent | null; reducedMotion: boolean; simplified?: boolean; characterName?: string }) {
  const sequence = useRef(0);
  const [cameraCommand, setCameraCommand] = useState<CameraCommand | null>(null);
  const controlCamera = (action: CameraAction) => {
    sequence.current += 1;
    setCameraCommand({ action, sequence: sequence.current });
  };

  const handleKeyboardCamera = (keyboardEvent: KeyboardEvent<HTMLDivElement>) => {
    const keyMap: Record<string, CameraAction | undefined> = {
      ArrowLeft: 'rotate-left',
      ArrowRight: 'rotate-right',
      ArrowUp: 'tilt-up',
      ArrowDown: 'tilt-down',
      '+': 'zoom-in',
      '=': 'zoom-in',
      '-': 'zoom-out',
      _: 'zoom-out',
      Home: 'reset',
    };
    const action = keyMap[keyboardEvent.key];
    if (!action) return;
    keyboardEvent.preventDefault();
    controlCamera(action);
  };

  return (
    <section className={styles.scene} aria-labelledby="scene-heading" aria-describedby="scene-description">
      <h2 id="scene-heading" className={styles.srOnly}>Encounter battlefield</h2>
      <p id="scene-description" className={styles.srOnly}>
        {simplified
          ? 'A text summary of Briv and the Ash Warden.'
          : 'A three-dimensional forest battlefield. Focus the battlefield to use arrow keys, plus, minus, and Home for the camera. All combat information is also available as text.'}
      </p>
      {simplified ? (
        <div className={styles.simplified} data-testid="simplified-scene">
          <div aria-hidden="true" className={styles.simplifiedMark}>B</div>
          <dl>
            <div><dt>HP</dt><dd>{projection.currentHitPoints} / {projection.maximumHitPoints}</dd></div>
            <div><dt>Temp HP</dt><dd>{projection.temporaryHitPoints}</dd></div>
            <div><dt>Event</dt><dd>{event?.summary ?? 'None'}</dd></div>
          </dl>
        </div>
      ) : (
        <div
          className={styles.viewport}
          tabIndex={0}
          role="region"
          aria-label="3D battlefield camera"
          aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown + - Home"
          onKeyDown={handleKeyboardCamera}
        >
          <SceneErrorBoundary>
            <Canvas aria-hidden="true" tabIndex={-1} shadows camera={{ position: [defaultCameraPosition.x, defaultCameraPosition.y, defaultCameraPosition.z], fov: 38 }} dpr={[1, 1.5]}>
              <SceneContent projection={projection} event={event} paused={reducedMotion} cameraCommand={cameraCommand} characterName={characterName} />
            </Canvas>
          </SceneErrorBoundary>
          <CameraControls onAction={controlCamera} />
        </div>
      )}
    </section>
  );
}
