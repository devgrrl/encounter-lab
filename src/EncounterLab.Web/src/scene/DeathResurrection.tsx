import { Html, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
} from 'three';
import styles from './EncounterScene.module.css';

const gravestoneUrl = '/models/halloween/gravestone.gltf';
const skullUrl = '/models/halloween/skull.gltf';

const groundY = 0;
const sinkDepth = -1.65;
const ghostFloatHeight = 1.3;

type Phase = 'alive' | 'sinking' | 'ghostRising' | 'dead' | 'ghostDescending' | 'rising';

const phaseDuration: Record<Phase, number> = {
  alive: 0,
  sinking: 1,
  ghostRising: 1.6,
  dead: 0,
  ghostDescending: 1.6,
  rising: 1.1,
};

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function easeInCubic(t: number) {
  return t ** 3;
}

function collectMaterials(root: Object3D): MeshStandardMaterial[] {
  const materials: MeshStandardMaterial[] = [];
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const owned = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of owned) {
      if (material instanceof MeshStandardMaterial) materials.push(material);
    }
  });
  return materials;
}

function makeTranslucent(root: Object3D, tint: string) {
  const glow = new Color(tint);
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const source = Array.isArray(node.material) ? node.material[0] : node.material;
    const cloned = source instanceof MeshStandardMaterial
      ? source.clone()
      : new MeshStandardMaterial({ color: tint });
    cloned.transparent = true;
    cloned.depthWrite = false;
    cloned.emissive = glow;
    cloned.emissiveIntensity = .55;
    node.material = cloned;
    node.castShadow = false;
    node.receiveShadow = false;
  });
}

function setOpacity(materials: MeshStandardMaterial[], opacity: number) {
  for (const material of materials) material.opacity = opacity;
}

/**
 * Tracks the alive -> dead -> alive state machine driven purely by committed
 * server HP (hitPoints), and drives the sink/rise/ghost/gravestone
 * choreography. `knightGroupRef` is the live character model's own group;
 * this component positions and hides it directly rather than duplicating
 * Briv's mesh for the "buried" states.
 */
export function DeathResurrection({
  hitPoints,
  paused,
  knightModelUrl,
  knightGroupRef,
  characterName,
  onAliveVisualsVisibleChange,
}: {
  hitPoints: number;
  paused: boolean;
  knightModelUrl: string;
  knightGroupRef: React.RefObject<Group | null>;
  characterName: string;
  onAliveVisualsVisibleChange?: (visible: boolean) => void;
}) {
  const isAlive = hitPoints > 0;
  const [phase, setPhase] = useState<Phase>(isAlive ? 'alive' : 'dead');
  const wasAlive = useRef(isAlive);
  const elapsed = useRef(0);

  useEffect(() => {
    if (isAlive && !wasAlive.current) {
      setPhase('ghostDescending');
      elapsed.current = 0;
    } else if (!isAlive && wasAlive.current) {
      setPhase('sinking');
      elapsed.current = 0;
    }
    wasAlive.current = isAlive;
  }, [isAlive]);

  const graveGroup = useRef<Group>(null);
  const ghostGroup = useRef<Group>(null);
  const duskRing = useRef<Group>(null);

  const { scene: knightScene } = useGLTF(knightModelUrl);
  const ghostScene = useMemo(() => {
    const value = cloneSkeleton(knightScene);
    makeTranslucent(value, '#bfeaff');
    value.rotation.y = Math.PI / 2;
    value.scale.setScalar(1.14);
    value.position.set(0, .02, 0);
    return value;
  }, [knightScene]);
  const ghostMaterials = useMemo(() => collectMaterials(ghostScene), [ghostScene]);

  const { scene: gravestoneScene } = useGLTF(gravestoneUrl);
  const clonedGravestone = useMemo(() => {
    const value = cloneSkeleton(gravestoneScene);
    value.scale.set(.62, 1.08, .62);
    value.position.set(0, 0, -.15);
    value.rotation.y = Math.PI / 5;
    value.traverse((node) => { if (node instanceof Mesh) { node.castShadow = true; node.receiveShadow = true; } });
    return value;
  }, [gravestoneScene]);
  const gravestoneMaterials = useMemo(() => {
    const materials: MeshStandardMaterial[] = [];
    clonedGravestone.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      const source = Array.isArray(node.material) ? node.material[0] : node.material;
      const cloned = source instanceof MeshStandardMaterial ? source.clone() : new MeshStandardMaterial();
      cloned.transparent = true;
      node.material = cloned;
      materials.push(cloned);
    });
    return materials;
  }, [clonedGravestone]);

  const { scene: skullScene } = useGLTF(skullUrl);
  const clonedSkull = useMemo(() => {
    const value = cloneSkeleton(skullScene);
    value.scale.setScalar(.6);
    value.position.set(.85, .1, .95);
    value.rotation.set(.18, -Math.PI / 4, Math.PI / 2.3);
    value.traverse((node) => { if (node instanceof Mesh) { node.castShadow = true; node.receiveShadow = true; } });
    return value;
  }, [skullScene]);
  const skullMaterials = useMemo(() => {
    const materials: MeshStandardMaterial[] = [];
    clonedSkull.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      const source = Array.isArray(node.material) ? node.material[0] : node.material;
      const cloned = source instanceof MeshStandardMaterial ? source.clone() : new MeshStandardMaterial();
      cloned.transparent = true;
      node.material = cloned;
      materials.push(cloned);
    });
    return materials;
  }, [clonedSkull]);

  useFrame((_, delta) => {
    if (paused) return;
    const knight = knightGroupRef.current;
    if (!knight) return;

    if (phase === 'alive') {
      knight.visible = true;
      knight.position.y = groundY;
      knight.scale.setScalar(1);
      if (graveGroup.current) graveGroup.current.visible = false;
      if (ghostGroup.current) ghostGroup.current.visible = false;
      onAliveVisualsVisibleChange?.(true);
      return;
    }

    if (phase === 'dead') {
      knight.visible = false;
      if (graveGroup.current) {
        graveGroup.current.visible = true;
        setOpacity(gravestoneMaterials, 1);
        setOpacity(skullMaterials, 1);
      }
      if (ghostGroup.current) ghostGroup.current.visible = false;
      onAliveVisualsVisibleChange?.(false);
      return;
    }

    elapsed.current += Math.min(delta, .1);
    const duration = phaseDuration[phase];
    const progress = Math.min(1, elapsed.current / duration);

    switch (phase) {
      case 'sinking': {
        onAliveVisualsVisibleChange?.(false);
        knight.visible = true;
        const eased = easeInCubic(progress);
        knight.position.y = groundY + sinkDepth * eased;
        knight.scale.setScalar(1 - eased * .18);
        if (duskRing.current) {
          duskRing.current.visible = progress < .6;
          duskRing.current.scale.setScalar(.3 + progress * 1.6);
        }
        if (graveGroup.current) {
          graveGroup.current.visible = true;
          graveGroup.current.position.y = 0;
          const fadeIn = Math.min(1, progress * 1.6);
          setOpacity(gravestoneMaterials, fadeIn);
          setOpacity(skullMaterials, fadeIn);
        }
        if (progress >= 1) { setPhase('ghostRising'); elapsed.current = 0; }
        break;
      }
      case 'ghostRising': {
        knight.visible = false;
        if (ghostGroup.current) {
          ghostGroup.current.visible = true;
          const riseProgress = Math.min(1, progress / .65);
          const height = easeOutCubic(riseProgress) * ghostFloatHeight;
          ghostGroup.current.position.set(0, groundY + height, 0);
          ghostGroup.current.rotation.y += delta * .35;
          const bob = Math.sin(elapsed.current * 1.8) * .08;
          ghostGroup.current.position.y += bob;
          const fadeOutStart = .65;
          const opacity = progress < fadeOutStart
            ? Math.min(1, progress / .2)
            : 1 - (progress - fadeOutStart) / (1 - fadeOutStart);
          setOpacity(ghostMaterials, Math.max(0, opacity) * .85);
        }
        if (progress >= 1) { setPhase('dead'); elapsed.current = 0; }
        break;
      }
      case 'ghostDescending': {
        knight.visible = false;
        if (graveGroup.current) {
          graveGroup.current.visible = true;
          setOpacity(gravestoneMaterials, 1);
          setOpacity(skullMaterials, 1);
        }
        if (ghostGroup.current) {
          ghostGroup.current.visible = true;
          const descendStart = .3;
          const fadeInOpacity = Math.min(1, progress / .25);
          let height = ghostFloatHeight;
          if (progress > descendStart) {
            const descendProgress = Math.min(1, (progress - descendStart) / (1 - descendStart));
            height = ghostFloatHeight * (1 - easeInCubic(descendProgress));
          }
          const bob = progress < descendStart ? Math.sin(elapsed.current * 1.8) * .08 : 0;
          ghostGroup.current.position.set(0, groundY + height + bob, 0);
          ghostGroup.current.rotation.y += delta * .35;
          const fadeOutOpacity = progress > .78 ? 1 - (progress - .78) / .22 : 1;
          setOpacity(ghostMaterials, Math.max(0, Math.min(fadeInOpacity, fadeOutOpacity)) * .85);
        }
        if (progress >= 1) { setPhase('rising'); elapsed.current = 0; }
        break;
      }
      case 'rising': {
        if (ghostGroup.current) ghostGroup.current.visible = false;
        knight.visible = true;
        const eased = easeOutCubic(progress);
        knight.position.y = groundY + sinkDepth * (1 - eased);
        knight.scale.setScalar(.82 + eased * .18);
        onAliveVisualsVisibleChange?.(progress > .5);
        if (graveGroup.current) {
          graveGroup.current.visible = progress < 1;
          const fadeOut = Math.max(0, 1 - progress * 1.3);
          setOpacity(gravestoneMaterials, fadeOut);
          setOpacity(skullMaterials, fadeOut);
          graveGroup.current.position.y = -Math.min(1, progress * 1.3) * .4;
        }
        if (progress >= 1) { setPhase('alive'); elapsed.current = 0; }
        break;
      }
      default:
        break;
    }
  });

  return (
    <>
      <group ref={graveGroup} visible={false}>
        <pointLight color="#5fd9c7" intensity={.85} distance={3.4} position={[0, .55, 0]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .022, 0]}>
          <ringGeometry args={[.12, 1.4, 48]} />
          <meshBasicMaterial color="#173832" transparent opacity={.4} toneMapped={false} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .024, 0]}>
          <ringGeometry args={[.12, .55, 48]} />
          <meshBasicMaterial color="#5fd9c7" transparent opacity={.16} toneMapped={false} />
        </mesh>
        <primitive object={clonedGravestone} />
        <primitive object={clonedSkull} />
        {phase !== 'alive' && (
          <Html center position={[0, .82, .28]} distanceFactor={5} rotation={[0, Math.PI / 5, 0]}>
            <div className={styles.gravestoneLabel} aria-hidden="true">{characterName.toUpperCase()}</div>
          </Html>
        )}
      </group>
      <group ref={ghostGroup} visible={false}>
        <pointLight color="#bfeaff" intensity={2.4} distance={4} />
        <primitive object={ghostScene} />
      </group>
      <group ref={duskRing} visible={false} rotation={[-Math.PI / 2, 0, 0]} position={[0, .03, 0]}>
        <mesh>
          <ringGeometry args={[.2, .95, 32]} />
          <meshBasicMaterial color="#241a12" transparent opacity={.55} toneMapped={false} />
        </mesh>
      </group>
    </>
  );
}

useGLTF.preload(gravestoneUrl);
useGLTF.preload(skullUrl);
