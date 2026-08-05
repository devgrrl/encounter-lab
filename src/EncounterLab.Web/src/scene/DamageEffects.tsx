import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, type BufferAttribute, MathUtils, Vector3, type Group, type Mesh, type Points, type PointLight } from 'three';
import type { DamageType } from '../types';

export function damageEffectColor(type?: DamageType | null): string {
  switch (type) {
    case 'BLUDGEONING': return '#b8a488';
    case 'PIERCING': return '#e7eef4';
    case 'SLASHING': return '#f2b8ab';
    case 'FIRE': return '#ff6b3e';
    case 'COLD': return '#8de8ff';
    case 'ACID': return '#8ddd5d';
    case 'THUNDER': return '#cfe3ff';
    case 'LIGHTNING': return '#eaffff';
    case 'POISON': return '#7bd17a';
    case 'RADIANT': return '#fff2a6';
    case 'NECROTIC': return '#8a5fc9';
    case 'PSYCHIC': return '#c77dff';
    case 'FORCE': return '#b2fff0';
    default: return '#ef6159';
  }
}

function damageEffectAccentColor(type?: DamageType | null): string {
  switch (type) {
    case 'BLUDGEONING': return '#5c4f3d';
    case 'PIERCING': return '#9fb7c9';
    case 'SLASHING': return '#8a2e22';
    case 'FIRE': return '#ffcf6b';
    case 'COLD': return '#e7fbff';
    case 'ACID': return '#355e19';
    case 'THUNDER': return '#7fa8ff';
    case 'LIGHTNING': return '#7fc7ff';
    case 'POISON': return '#3d1f52';
    case 'RADIANT': return '#ffffff';
    case 'NECROTIC': return '#1c0e2b';
    case 'PSYCHIC': return '#5a1f8a';
    case 'FORCE': return '#6fe0ff';
    default: return '#ffd9d4';
  }
}

// Approach travel time before impact (skipped entirely for LIGHTNING, which
// is instantaneous). Impact duration varies per type so quick, sharp damage
// (piercing, force) clears faster than lingering damage (poison, necrotic).
const approachDuration = 0.5;
const impactDuration: Record<DamageType, number> = {
  BLUDGEONING: .85,
  PIERCING: .55,
  SLASHING: .6,
  FIRE: 1,
  COLD: 1.05,
  ACID: 1.1,
  THUNDER: .6,
  LIGHTNING: .45,
  POISON: 1.6,
  RADIANT: .95,
  NECROTIC: 1.2,
  PSYCHIC: 1,
  FORCE: .65,
};

function totalDuration(type: DamageType): number {
  return (type === 'LIGHTNING' ? 0 : approachDuration) + impactDuration[type];
}

// Deterministic pseudo-random hash (not Math.random — this is presentation-only
// jaggedness for a cosmetic bolt shape, and this codebase's guardrails keep all
// randomness, including incidental client-side randomness, off the client).
function deterministicJitter(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

// Deterministic golden-angle spread so burst/shard directions look organic
// without needing a random seed per event.
function spreadDirection(index: number, count: number, verticalBias = .4): Vector3 {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const angle = index * goldenAngle;
  const radius = Math.sqrt((index + .5) / count);
  return new Vector3(
    Math.cos(angle) * radius,
    verticalBias + Math.sin(index * 1.7) * .3,
    Math.sin(angle) * radius,
  ).normalize();
}

interface RefBag {
  approach: Group | null;
  approachTrail: (Mesh | null)[];
  parts: Record<string, (Group | Mesh | null)[]>;
  points: Record<string, Points | null>;
}

// Deterministic burst directions for a Points particle system, spread across
// a cone around +Y so bursts read as "flying up and out" rather than a flat
// disc. Reuses the same golden-angle technique as spreadDirection, just
// vectorized into a position buffer up front instead of per-object meshes.
function burstPositions(count: number, salt: number, spread = 1): Float32Array {
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const direction = spreadDirection(index, count, .5 + deterministicJitter(index, salt) * .3);
    const radius = spread * (.3 + deterministicJitter(index, salt + 1) * .7);
    positions[index * 3] = direction.x * radius;
    positions[index * 3 + 1] = Math.abs(direction.y) * radius;
    positions[index * 3 + 2] = direction.z * radius;
  }
  return positions;
}

export function DamageEffect({ type, source, target, paused }: { type: DamageType; source: Vector3; target: Vector3; paused: boolean }) {
  const color = damageEffectColor(type);
  const accent = damageEffectAccentColor(type);
  const elapsed = useRef(0);
  const bag = useRef<RefBag>({ approach: null, approachTrail: [], parts: {}, points: {} });
  const boltFlash = useRef<PointLight>(null);

  const shardCount = type === 'COLD' ? 6 : type === 'FORCE' ? 4 : 5;
  const shardDirections = useMemo(
    () => Array.from({ length: shardCount }, (_, index) => spreadDirection(index, shardCount)),
    [shardCount],
  );
  const puffCount = type === 'POISON' ? 5 : 0;
  const puffOffsets = useMemo(
    () => Array.from({ length: puffCount }, (_, index) => spreadDirection(index, puffCount, .15)),
    [puffCount],
  );
  // Packed per-spark seed for the slash's grit-off-the-blade burst: x = a
  // stable per-spark magnitude factor, y = height factor, z = angular
  // spread offset from the blade's current tip angle (radians).
  const slashSparkCount = type === 'SLASHING' ? 14 : 0;
  const slashSparkSeeds = useMemo(() => {
    const seeds = new Float32Array(slashSparkCount * 3);
    for (let index = 0; index < slashSparkCount; index += 1) {
      seeds[index * 3] = .3 + deterministicJitter(index, 71) * .7;
      seeds[index * 3 + 1] = (deterministicJitter(index, 73) - .5) * .6;
      seeds[index * 3 + 2] = (deterministicJitter(index, 79) - .5) * .7;
    }
    return seeds;
  }, [slashSparkCount]);
  const fireEmberSeeds = useMemo(() => (type === 'FIRE' ? burstPositions(28, 83, .9) : new Float32Array(0)), [type]);
  const frostMistSeeds = useMemo(() => (type === 'COLD' ? burstPositions(22, 97, .85) : new Float32Array(0)), [type]);
  const boltSegments = useMemo(() => {
    if (type !== 'LIGHTNING') return [];
    const segmentCount = 6;
    const points: Vector3[] = [];
    for (let index = 0; index <= segmentCount; index += 1) {
      const t = index / segmentCount;
      const base = new Vector3().lerpVectors(source, target, t);
      const jitter = index === 0 || index === segmentCount ? 0 : (deterministicJitter(index, 1) - .5) * .55;
      base.y += jitter;
      base.x += (deterministicJitter(index, 2) - .5) * .25;
      points.push(base);
    }
    return points;
  }, [type, source, target]);

  const registerPart = (group: string, index: number) => (node: Group | Mesh | null) => {
    if (!bag.current.parts[group]) bag.current.parts[group] = [];
    bag.current.parts[group][index] = node;
  };
  const part = (group: string, index: number) => bag.current.parts[group]?.[index] ?? null;
  const registerPoints = (name: string) => (node: Points | null) => { bag.current.points[name] = node; };
  const points = (name: string) => bag.current.points[name] ?? null;

  // Expands a Points burst outward from local (0,0,0) using each particle's
  // own resting position (baked into the buffer by burstPositions) as the
  // direction/distance to travel toward, fading out near the end of local.
  const animateBurst = (name: string, local: number, riseBoost = 0) => {
    const cloud = points(name);
    if (!cloud) return;
    const rest = (cloud.userData.rest ?? cloud.geometry.attributes.position.array) as Float32Array;
    if (!cloud.userData.rest) cloud.userData.rest = new Float32Array(rest);
    const attribute = cloud.geometry.attributes.position as BufferAttribute;
    const travel = 1 - (1 - Math.min(1, local * 1.6)) ** 2;
    for (let index = 0; index < rest.length / 3; index += 1) {
      attribute.setXYZ(
        index,
        rest[index * 3] * travel,
        rest[index * 3 + 1] * travel + riseBoost * local,
        rest[index * 3 + 2] * travel,
      );
    }
    attribute.needsUpdate = true;
    cloud.visible = local > 0 && local < 1;
    const material = cloud.material as import('three').PointsMaterial;
    material.opacity = local < .15 ? local / .15 : 1 - (local - .15) / .85;
  };

  useFrame((_, delta) => {
    if (paused) return;
    elapsed.current += Math.min(delta, .1);
    const age = elapsed.current;
    const hasApproach = type !== 'LIGHTNING';
    const impactAge = hasApproach ? age - approachDuration : age;
    const impacting = impactAge >= 0;
    const impactProgress = MathUtils.clamp(impactAge / impactDuration[type], 0, 1);

    if (hasApproach && bag.current.approach) {
      const progress = MathUtils.clamp(age / approachDuration, 0, 1);
      const eased = 1 - (1 - progress) ** 3;
      bag.current.approach.visible = !impacting;
      bag.current.approach.position.lerpVectors(source, target, eased);
      bag.current.approach.scale.setScalar(.75 + Math.sin(progress * Math.PI) * .4);
      bag.current.approachTrail.forEach((mesh, index) => {
        if (!mesh) return;
        const trailProgress = MathUtils.clamp(progress - (index + 1) * .06, 0, 1);
        const trailEased = 1 - (1 - trailProgress) ** 3;
        mesh.position.lerpVectors(source, target, trailEased);
        mesh.scale.setScalar(Math.max(.05, (.7 - index * .12) * (trailProgress > 0 ? 1 : 0)));
      });
      if (type === 'FIRE') {
        for (let index = 0; index < 3; index += 1) {
          const tongue = part('corona', index);
          if (!tongue) continue;
          const orbitAngle = age * 9 + (index / 3) * Math.PI * 2;
          tongue.position.set(Math.cos(orbitAngle) * .17, Math.sin(age * 13 + index) * .06, Math.sin(orbitAngle) * .17);
          tongue.rotation.z = orbitAngle;
        }
      }
    }

    if (!impacting) return;

    switch (type) {
      case 'BLUDGEONING': {
        const crush = part('crush', 0);
        if (crush) {
          crush.visible = impactProgress < .5;
          const squash = 1 - Math.sin(impactProgress * Math.PI) * .55;
          crush.scale.set(1 + (1 - squash) * .5, squash, 1 + (1 - squash) * .5);
        }
        const ring = part('ring', 0);
        if (ring) {
          ring.visible = impactProgress < .9;
          ring.scale.setScalar(.3 + impactProgress * 2.6);
        }
        for (let index = 0; index < 4; index += 1) {
          const debris = part('debris', index);
          if (!debris) continue;
          debris.visible = impactProgress < .85;
          const direction = shardDirections[index % shardDirections.length];
          const travel = Math.sin(impactProgress * Math.PI * .8) * .8;
          debris.position.set(direction.x * travel, Math.max(0, direction.y * travel * .6 - impactProgress * .4), direction.z * travel);
          debris.rotation.set(impactProgress * 6, impactProgress * 4, 0);
        }
        break;
      }
      case 'PIERCING': {
        const needle = part('needle', 0);
        if (needle) {
          needle.visible = impactProgress < .4;
          needle.scale.set(1, 1, 1 - impactProgress * 1.5);
        }
        const flash = part('flash', 0);
        if (flash) {
          flash.visible = impactProgress < .5;
          flash.scale.setScalar(.5 + impactProgress * .6);
        }
        for (let index = 0; index < 3; index += 1) {
          const crack = part('crack', index);
          if (!crack) continue;
          crack.visible = impactProgress > .1 && impactProgress < .8;
          crack.scale.set(1, MathUtils.clamp((impactProgress - .1) * 2.2, 0, 1), 1);
        }
        break;
      }
      case 'SLASHING': {
        // A slash reads as a swipe when the bright leading edge arrives
        // first and a wider, dimmer trailing edge follows a beat behind -
        // two arcs sweeping the same path at slightly different speeds,
        // rather than one shape fading in place.
        const sweepStart = -Math.PI * .4;
        const sweepEnd = Math.PI * .55;
        const leadProgress = MathUtils.clamp(impactProgress * 1.9, 0, 1);
        const trailProgress = MathUtils.clamp(impactProgress * 1.9 - .22, 0, 1);
        const edge = part('edge', 0);
        if (edge) {
          edge.visible = leadProgress > 0 && leadProgress < .92;
          edge.rotation.z = sweepStart + leadProgress * (sweepEnd - sweepStart);
        }
        const wake = part('wake', 0);
        if (wake) {
          wake.visible = trailProgress > 0 && trailProgress < 1;
          wake.rotation.z = sweepStart + trailProgress * (sweepEnd - sweepStart);
        }
        // Sparks release right at the leading edge's current position and
        // fly off tangent to the swing, like grit kicked off a blade.
        const tipAngle = sweepStart + leadProgress * (sweepEnd - sweepStart);
        const sparks = points('slash');
        if (sparks) {
          const local = MathUtils.clamp(impactProgress * 1.3, 0, 1);
          const attribute = sparks.geometry.attributes.position as BufferAttribute;
          const rest = (sparks.userData.rest ?? attribute.array) as Float32Array;
          if (!sparks.userData.rest) sparks.userData.rest = new Float32Array(rest);
          const travel = 1 - (1 - Math.min(1, local * 1.7)) ** 2;
          for (let index = 0; index < rest.length / 3; index += 1) {
            const spread = rest[index * 3 + 2];
            const angle = tipAngle + spread * .6;
            const radius = .5 + travel * (.35 + Math.abs(rest[index * 3]) * .6);
            attribute.setXYZ(index, Math.cos(angle) * radius, rest[index * 3 + 1] * (.4 + travel), Math.sin(angle) * radius);
          }
          attribute.needsUpdate = true;
          sparks.visible = local > 0 && local < .95;
          const material = sparks.material as import('three').PointsMaterial;
          material.opacity = local < .5 ? 1 : 1 - (local - .5) / .45;
        }
        break;
      }
      case 'FIRE': {
        for (let index = 0; index < 3; index += 1) {
          const cone = part('flame', index);
          if (!cone) continue;
          const local = MathUtils.clamp(impactProgress * 1.4 - index * .12, 0, 1);
          cone.visible = local > 0 && local < .95;
          cone.scale.set(1 - local * .25, .3 + local * 1.5, 1 - local * .25);
          cone.position.y = local * .35;
        }
        animateBurst('fireEmbers', MathUtils.clamp(impactProgress * 1.2, 0, 1), 1.1);
        break;
      }
      case 'COLD': {
        const block = part('block', 0);
        const shatterStart = .55;
        if (block) {
          const grow = MathUtils.clamp(impactProgress / shatterStart, 0, 1);
          block.visible = impactProgress < shatterStart + .05;
          block.scale.setScalar(.15 + grow * .95);
        }
        shardDirections.forEach((direction, index) => {
          const shard = part('shard', index);
          if (!shard) return;
          const local = MathUtils.clamp((impactProgress - shatterStart) / (1 - shatterStart), 0, 1);
          shard.visible = local > 0;
          const travel = local * 1.4;
          shard.position.set(direction.x * travel, .3 + direction.y * travel, direction.z * travel);
          shard.rotation.set(local * 5, local * 4, local * 3);
          shard.scale.setScalar(Math.max(.05, .3 * (1 - local * .5)));
        });
        animateBurst('frostMist', MathUtils.clamp((impactProgress - shatterStart) / (1 - shatterStart), 0, 1), .5);
        break;
      }
      case 'ACID': {
        const puddle = part('puddle', 0);
        if (puddle) {
          puddle.visible = true;
          puddle.scale.setScalar(.5 + impactProgress * .9 + Math.sin(impactProgress * Math.PI * 6) * .04);
        }
        shardDirections.forEach((direction, index) => {
          const droplet = part('droplet', index);
          if (!droplet) return;
          const local = MathUtils.clamp(impactProgress * 1.3 - index * .05, 0, 1);
          droplet.visible = local > 0 && local < .95;
          const travel = Math.sin(local * Math.PI * .9) * .9;
          droplet.position.set(direction.x * travel, Math.max(0, .5 * Math.sin(local * Math.PI)), direction.z * travel);
        });
        break;
      }
      case 'THUNDER': {
        for (let index = 0; index < 2; index += 1) {
          const ring = part('shock', index);
          if (!ring) continue;
          const local = MathUtils.clamp(impactProgress * 1.6 - index * .28, 0, 1);
          ring.visible = local > 0 && local < 1;
          ring.scale.setScalar(.2 + local * 3.4);
        }
        break;
      }
      case 'LIGHTNING': {
        const bolt = part('bolt', 0);
        if (bolt) {
          bolt.visible = impactProgress < .55;
          bolt.scale.setScalar(1 - impactProgress * .1);
        }
        if (boltFlash.current) {
          const boltFlashVisible = impactProgress < .35;
          boltFlash.current.visible = boltFlashVisible;
          boltFlash.current.intensity = boltFlashVisible ? 6 * (1 - impactProgress / .35) : 0;
        }
        break;
      }
      case 'POISON': {
        puffOffsets.forEach((direction, index) => {
          const puff = part('puff', index);
          if (!puff) return;
          const local = MathUtils.clamp(impactProgress - index * .08, 0, 1);
          puff.visible = local > 0;
          puff.position.set(direction.x * (.4 + local * .5), .2 + local * 1.1, direction.z * (.4 + local * .5));
          puff.scale.setScalar(.32 + local * .5);
        });
        for (let index = 0; index < 3; index += 1) {
          const bubble = part('bubble', index);
          if (!bubble) continue;
          const local = MathUtils.clamp((impactProgress - index * .18) % 1, 0, 1);
          bubble.visible = impactProgress > index * .18;
          bubble.position.y = local * 1.4;
          bubble.scale.setScalar(.08 * (1 - local * .5));
        }
        break;
      }
      case 'RADIANT': {
        const beam = part('beam', 0);
        if (beam) {
          beam.visible = impactProgress < .85;
          beam.scale.set(1, MathUtils.clamp(impactProgress * 2.4, 0, 1) * 2.6, 1);
        }
        for (let index = 0; index < 5; index += 1) {
          const ray = part('ray', index);
          if (!ray) continue;
          ray.visible = impactProgress > .1 && impactProgress < .8;
          ray.rotation.y = (index / 5) * Math.PI * 2 + impactProgress * .6;
          ray.scale.set(1, 1, .4 + impactProgress * 1.1);
        }
        const flash = part('flash', 0);
        if (flash) {
          flash.visible = impactProgress < .3;
          flash.scale.setScalar(.4 + impactProgress * 1.8);
        }
        break;
      }
      case 'NECROTIC': {
        for (let index = 0; index < 4; index += 1) {
          const tendril = part('tendril', index);
          if (!tendril) continue;
          const local = MathUtils.clamp(impactProgress * 1.3 - index * .1, 0, 1);
          tendril.visible = local > 0;
          tendril.scale.set(1, local * 1.3, 1);
        }
        const pulse = part('pulse', 0);
        if (pulse) {
          pulse.visible = impactProgress < .9;
          pulse.scale.setScalar(.5 + Math.sin(impactProgress * Math.PI) * .5);
        }
        break;
      }
      case 'PSYCHIC': {
        for (let index = 0; index < 3; index += 1) {
          const ring = part('warp', index);
          if (!ring) continue;
          const local = MathUtils.clamp(impactProgress * 1.2 - index * .15, 0, 1);
          ring.visible = local > 0 && local < .95;
          const wobble = Math.sin(age * 9 + index) * .18;
          ring.scale.set(.3 + local * 1.6 + wobble, .3 + local * 1.6 - wobble, 1);
        }
        break;
      }
      case 'FORCE': {
        const core = part('core', 0);
        if (core) {
          core.visible = impactProgress < .45;
          core.rotation.set(impactProgress * 8, impactProgress * 6, 0);
          core.scale.setScalar(.5 + impactProgress * .8);
        }
        shardDirections.forEach((direction, index) => {
          const shard = part('shard', index);
          if (!shard) return;
          const local = MathUtils.clamp((impactProgress - .35) / .65, 0, 1);
          shard.visible = local > 0;
          const travel = local * 1.6;
          shard.position.set(direction.x * travel, direction.y * travel + .3, direction.z * travel);
          shard.rotation.set(local * 7, local * 5, local * 3);
        });
        break;
      }
      default:
        break;
    }
  });

  return (
    <>
      {type !== 'LIGHTNING' && (
        <group ref={(node) => { bag.current.approach = node; }} position={[source.x, source.y, source.z]} visible={false}>
          <pointLight color={color} intensity={4.2} distance={4} />
          <mesh>
            <icosahedronGeometry args={[.16, 1]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
          <mesh scale={1.8}>
            <sphereGeometry args={[.16, 16, 12]} />
            <meshBasicMaterial color={color} transparent opacity={.18} toneMapped={false} />
          </mesh>
          {[0, 1, 2, 3, 4].map((index) => (
            <mesh
              key={index}
              ref={(node) => { bag.current.approachTrail[index] = node; }}
              scale={0}
            >
              <sphereGeometry args={[.11, 10, 8]} />
              <meshBasicMaterial
                color={index < 2 ? color : accent}
                transparent
                opacity={.42 - index * .07}
                toneMapped={false}
                blending={AdditiveBlending}
              />
            </mesh>
          ))}
          {type === 'FIRE' && [0, 1, 2].map((index) => (
            <mesh key={index} ref={registerPart('corona', index)} rotation={[0, 0, (index / 3) * Math.PI * 2]}>
              <coneGeometry args={[.05, .22, 6]} />
              <meshBasicMaterial color={index % 2 === 0 ? '#ffe2a6' : accent} transparent opacity={.85} toneMapped={false} blending={AdditiveBlending} />
            </mesh>
          ))}
        </group>
      )}

      <group position={[target.x, target.y, target.z]}>
        {type === 'BLUDGEONING' && (
          <>
            <mesh ref={registerPart('crush', 0)} visible={false}>
              <icosahedronGeometry args={[.32, 0]} />
              <meshStandardMaterial color={color} emissive={accent} emissiveIntensity={.5} roughness={.7} />
            </mesh>
            <mesh ref={registerPart('ring', 0)} visible={false} rotation={[-Math.PI / 2, 0, 0]} position={[0, -.9, 0]}>
              <ringGeometry args={[.3, .42, 32]} />
              <meshBasicMaterial color={accent} transparent opacity={.7} toneMapped={false} />
            </mesh>
            {[0, 1, 2, 3].map((index) => (
              <mesh key={index} ref={registerPart('debris', index)} visible={false}>
                <boxGeometry args={[.09, .09, .09]} />
                <meshStandardMaterial color={accent} roughness={.9} />
              </mesh>
            ))}
          </>
        )}

        {type === 'PIERCING' && (
          <>
            <mesh ref={registerPart('needle', 0)} visible={false} rotation={[0, 0, Math.PI / 2]}>
              <coneGeometry args={[.09, .95, 10]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
            <mesh ref={registerPart('flash', 0)} visible={false}>
              <sphereGeometry args={[.13, 12, 10]} />
              <meshBasicMaterial color={accent} toneMapped={false} blending={AdditiveBlending} />
            </mesh>
            {[0, 1, 2].map((index) => (
              <mesh key={index} ref={registerPart('crack', index)} visible={false} rotation={[0, 0, (index / 3) * Math.PI * 2]}>
                <planeGeometry args={[.05, .5]} />
                <meshBasicMaterial color={color} transparent opacity={.85} toneMapped={false} blending={AdditiveBlending} />
              </mesh>
            ))}
          </>
        )}

        {type === 'SLASHING' && (
          <>
            <mesh ref={registerPart('edge', 0)} visible={false} rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[.46, .53, 40, 1, 0, Math.PI * .3]} />
              <meshBasicMaterial color="#fff3ee" transparent opacity={.95} side={2} toneMapped={false} blending={AdditiveBlending} />
            </mesh>
            <mesh ref={registerPart('wake', 0)} visible={false} rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[.38, .58, 40, 1, 0, Math.PI * .55]} />
              <meshBasicMaterial color={color} transparent opacity={.5} side={2} toneMapped={false} />
            </mesh>
            <points ref={registerPoints('slash')}>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[slashSparkSeeds, 3]} />
              </bufferGeometry>
              <pointsMaterial color="#fff3ee" size={.045} sizeAttenuation transparent opacity={0} depthWrite={false} toneMapped={false} blending={AdditiveBlending} />
            </points>
          </>
        )}

        {type === 'FIRE' && (
          <>
            {[0, 1, 2].map((index) => (
              <mesh key={index} ref={registerPart('flame', index)} visible={false}>
                <coneGeometry args={[.32 - index * .08, .75, 10]} />
                <meshStandardMaterial color={index === 0 ? accent : color} emissive={color} emissiveIntensity={.9} transparent opacity={.85} toneMapped={false} />
              </mesh>
            ))}
            <points ref={registerPoints('fireEmbers')} visible={false}>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[fireEmberSeeds, 3]} />
              </bufferGeometry>
              <pointsMaterial color="#ffb04a" size={.055} sizeAttenuation transparent opacity={0} depthWrite={false} toneMapped={false} blending={AdditiveBlending} />
            </points>
          </>
        )}

        {type === 'COLD' && (
          <>
            <mesh ref={registerPart('block', 0)} visible={false}>
              <icosahedronGeometry args={[.68, 0]} />
              <meshPhysicalMaterial color={color} transparent opacity={.48} roughness={.04} transmission={.6} thickness={.7} ior={1.31} clearcoat={.6} />
            </mesh>
            {shardDirections.map((_, index) => (
              <mesh key={index} ref={registerPart('shard', index)} visible={false}>
                <tetrahedronGeometry args={[.22, 0]} />
                <meshPhysicalMaterial color={color} emissive={accent} emissiveIntensity={.3} transparent opacity={.85} roughness={.1} transmission={.3} ior={1.31} />
              </mesh>
            ))}
            <points ref={registerPoints('frostMist')} visible={false}>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[frostMistSeeds, 3]} />
              </bufferGeometry>
              <pointsMaterial color="#eefeff" size={.05} sizeAttenuation transparent opacity={0} depthWrite={false} toneMapped={false} blending={AdditiveBlending} />
            </points>
          </>
        )}

        {type === 'ACID' && (
          <>
            <mesh ref={registerPart('puddle', 0)} visible={false} rotation={[-Math.PI / 2, 0, 0]} position={[0, -.9, 0]}>
              <ringGeometry args={[.05, .5, 24]} />
              <meshBasicMaterial color={color} transparent opacity={.65} toneMapped={false} />
            </mesh>
            {shardDirections.map((_, index) => (
              <mesh key={index} ref={registerPart('droplet', index)} visible={false}>
                <sphereGeometry args={[.09, 8, 6]} />
                <meshStandardMaterial color={color} emissive={accent} emissiveIntensity={.4} roughness={.3} />
              </mesh>
            ))}
          </>
        )}

        {type === 'THUNDER' && (
          <>
            {[0, 1].map((index) => (
              <mesh key={index} ref={registerPart('shock', index)} visible={false} rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[.5, .58, 40]} />
                <meshBasicMaterial color={index === 0 ? color : accent} transparent opacity={.55} toneMapped={false} blending={AdditiveBlending} />
              </mesh>
            ))}
          </>
        )}

        {type === 'LIGHTNING' && (
          <>
            <group ref={registerPart('bolt', 0)} visible={false}>
              {boltSegments.slice(0, -1).map((point, index) => {
                const next = boltSegments[index + 1];
                const mid = new Vector3().addVectors(point, next).multiplyScalar(.5).sub(target);
                const length = point.distanceTo(next);
                const direction = new Vector3().subVectors(next, point);
                const rotationY = Math.atan2(direction.x, direction.z);
                const rotationX = Math.atan2(direction.y, Math.hypot(direction.x, direction.z));
                return (
                  <mesh key={index} position={[mid.x, mid.y, mid.z]} rotation={[Math.PI / 2 - rotationX, rotationY, 0]}>
                    <cylinderGeometry args={[.03, .03, length, 5]} />
                    <meshBasicMaterial color={color} toneMapped={false} blending={AdditiveBlending} />
                  </mesh>
                );
              })}
            </group>
            <pointLight ref={boltFlash} color={accent} intensity={0} distance={5} visible={false} />
          </>
        )}

        {type === 'POISON' && (
          <>
            {puffOffsets.map((_, index) => (
              <mesh key={index} ref={registerPart('puff', index)} visible={false}>
                <sphereGeometry args={[.3, 10, 8]} />
                <meshBasicMaterial color={index % 2 === 0 ? color : accent} transparent opacity={.4} toneMapped={false} />
              </mesh>
            ))}
            {[0, 1, 2].map((index) => (
              <mesh key={index} ref={registerPart('bubble', index)} visible={false} position={[(index - 1) * .18, 0, 0]}>
                <sphereGeometry args={[.06, 8, 6]} />
                <meshBasicMaterial color={color} transparent opacity={.75} toneMapped={false} />
              </mesh>
            ))}
          </>
        )}

        {type === 'RADIANT' && (
          <>
            <mesh ref={registerPart('beam', 0)} visible={false} position={[0, -.9, 0]}>
              <cylinderGeometry args={[.16, .3, 1, 16, 1, true]} />
              <meshBasicMaterial color={color} transparent opacity={.55} side={2} toneMapped={false} blending={AdditiveBlending} />
            </mesh>
            {[0, 1, 2, 3, 4].map((index) => (
              <mesh key={index} ref={registerPart('ray', index)} visible={false}>
                <planeGeometry args={[.06, 1.1]} />
                <meshBasicMaterial color={color} transparent opacity={.5} side={2} toneMapped={false} blending={AdditiveBlending} />
              </mesh>
            ))}
            <mesh ref={registerPart('flash', 0)} visible={false}>
              <sphereGeometry args={[.2, 12, 10]} />
              <meshBasicMaterial color="#ffffff" toneMapped={false} blending={AdditiveBlending} />
            </mesh>
          </>
        )}

        {type === 'NECROTIC' && (
          <>
            {[0, 1, 2, 3].map((index) => (
              <mesh
                key={index}
                ref={registerPart('tendril', index)}
                visible={false}
                position={[Math.cos((index / 4) * Math.PI * 2) * .3, -.9, Math.sin((index / 4) * Math.PI * 2) * .3]}
                rotation={[0, 0, Math.cos((index / 4) * Math.PI * 2) * .3]}
              >
                <coneGeometry args={[.07, 1.1, 6]} />
                <meshStandardMaterial color={accent} emissive={color} emissiveIntensity={.6} roughness={.6} />
              </mesh>
            ))}
            <mesh ref={registerPart('pulse', 0)} visible={false}>
              <sphereGeometry args={[.7, 16, 12]} />
              <meshBasicMaterial color={accent} transparent opacity={.28} toneMapped={false} />
            </mesh>
          </>
        )}

        {type === 'PSYCHIC' && (
          <>
            {[0, 1, 2].map((index) => (
              <mesh key={index} ref={registerPart('warp', index)} visible={false} rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[.35, .42, 32]} />
                <meshBasicMaterial color={index % 2 === 0 ? color : accent} transparent opacity={.7} toneMapped={false} blending={AdditiveBlending} />
              </mesh>
            ))}
          </>
        )}

        {type === 'FORCE' && (
          <>
            <mesh ref={registerPart('core', 0)} visible={false}>
              <icosahedronGeometry args={[.35, 0]} />
              <meshStandardMaterial color={color} emissive={accent} emissiveIntensity={.6} wireframe />
            </mesh>
            {shardDirections.map((_, index) => (
              <mesh key={index} ref={registerPart('shard', index)} visible={false}>
                <octahedronGeometry args={[.14, 0]} />
                <meshBasicMaterial color={color} toneMapped={false} blending={AdditiveBlending} />
              </mesh>
            ))}
          </>
        )}
      </group>
    </>
  );
}

export { totalDuration as damageEffectDuration };
