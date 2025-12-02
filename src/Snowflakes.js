import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, extend, useThree } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';

// Custom shader for circular glowing particles
const CircleParticleMaterial = shaderMaterial(
  { opacity: 1.0 },
  // Vertex shader
  `
    attribute float size;
    attribute vec3 color;
    attribute float opacity;
    varying vec3 vColor;
    varying float vOpacity;

    void main() {
      vColor = color;
      vOpacity = opacity;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (300.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  // Fragment shader - creates soft circular glow
  `
    varying vec3 vColor;
    varying float vOpacity;

    void main() {
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);

      // Soft circular falloff
      float alpha = 1.0 - smoothstep(0.0, 0.5, dist);

      // Add glow effect
      float glow = exp(-dist * 3.0) * 0.5;
      alpha = alpha + glow;

      if (alpha < 0.01) discard;

      gl_FragColor = vec4(vColor, alpha * vOpacity);
    }
  `
);

extend({ CircleParticleMaterial });

// Custom shader for background stars with twinkle - BRIGHT version
const StarParticleMaterial = shaderMaterial(
  { time: 0 },
  // Vertex shader
  `
    attribute float size;
    attribute vec3 color;
    varying vec3 vColor;
    varying float vSize;

    void main() {
      vColor = color;
      vSize = size;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (400.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  // Fragment shader - creates bright star-like points
  `
    varying vec3 vColor;
    varying float vSize;

    void main() {
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);

      // Bright sharp center with strong glow
      float core = 1.0 - smoothstep(0.0, 0.1, dist);
      float glow = exp(-dist * 3.0) * 0.8;
      float outerGlow = exp(-dist * 1.5) * 0.3;
      float alpha = core + glow + outerGlow;

      if (alpha < 0.01) discard;

      // Boost brightness significantly
      vec3 brightColor = vColor * (1.5 + core * 1.0);
      
      gl_FragColor = vec4(brightColor, alpha);
    }
  `
);

extend({ StarParticleMaterial });

// Interstellar-style thin accretion disk
const GargantuaDiskMaterial = shaderMaterial(
  { time: 0 },
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  `
    uniform float time;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float fbm(vec2 p) {
      float sum = 0.0;
      float amp = 0.5;
      for(int i = 0; i < 4; i++) {
        sum += amp * noise(p);
        p *= 2.0;
        amp *= 0.5;
      }
      return sum;
    }

    void main() {
      vec2 center = vUv - 0.5;
      float dist = length(center);
      float angle = atan(center.y, center.x);

      // Inner radius matches event horizon (2.2 on 22-unit plane = 0.1 in UV)
      float innerRadius = 0.10;
      float outerRadius = 0.5;

      if (dist < innerRadius || dist > outerRadius) discard;

      // Thin bright ring - concentrated material right outside event horizon
      float ringCenter = 0.12;
      float ringWidth = 0.06;
      float ringFactor = exp(-pow((dist - ringCenter) / ringWidth, 2.0) * 3.0);

      // Secondary wider disk
      float diskFactor = smoothstep(outerRadius, innerRadius + 0.05, dist) * 0.4;

      // Kepler rotation
      float rotSpeed = 1.5 / sqrt(dist);
      float rotAngle = angle + time * rotSpeed * 0.15;

      // Fine structure
      float structure = fbm(vec2(rotAngle * 6.0, dist * 25.0));
      float detail = fbm(vec2(rotAngle * 15.0 + time * 0.3, dist * 40.0));

      // Temperature gradient
      float temp = smoothstep(outerRadius, innerRadius, dist);

      // Interstellar colors - warm white to orange to deep red
      vec3 hotColor = vec3(1.0, 0.97, 0.95);
      vec3 warmColor = vec3(1.0, 0.75, 0.45);
      vec3 coolColor = vec3(0.9, 0.4, 0.15);

      vec3 col = mix(coolColor, warmColor, temp);
      col = mix(col, hotColor, pow(temp, 2.0));

      float brightness = 0.5 + 0.5 * structure;
      brightness *= 0.85 + 0.15 * detail;
      brightness *= ringFactor + diskFactor;

      // Doppler beaming
      float doppler = 0.4 + 0.6 * cos(angle + 1.5);
      brightness *= 0.5 + doppler;

      // Color shift from doppler
      col = mix(col * vec3(1.15, 0.95, 0.85), col * vec3(0.9, 0.95, 1.05), doppler * 0.4);

      float edgeFade = smoothstep(innerRadius, innerRadius + 0.02, dist);
      edgeFade *= smoothstep(outerRadius, outerRadius - 0.04, dist);

      float alpha = brightness * edgeFade;

      gl_FragColor = vec4(col * brightness * 1.2, alpha * 0.95);
    }
  `
);

extend({ GargantuaDiskMaterial });

// Gravitationally lensed ring - hugs the event horizon tightly
const LensedRingMaterial = shaderMaterial(
  { time: 0, isTop: 1.0 },
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  `
    uniform float time;
    uniform float isTop;
    varying vec2 vUv;

    float noise(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec2 center = vUv - 0.5;
      float dist = length(center);
      float angle = atan(center.y, center.x);

      // Ring sits right at the event horizon edge (0.22 matches 2.2 radius on 10x10 plane)
      float ringRadius = 0.225;  // Slightly outside event horizon
      float ringThickness = 0.012;

      float ring = exp(-pow((dist - ringRadius) / ringThickness, 2.0));

      // Show top or bottom arc
      float arcMask = isTop > 0.5
        ? smoothstep(-0.05, 0.15, center.y)
        : smoothstep(0.05, -0.15, center.y);
      ring *= arcMask;

      if (ring < 0.01) discard;

      float variation = noise(vec2(angle * 10.0 + time * 0.2, dist * 25.0));

      vec3 col = vec3(1.0, 0.92, 0.75) * (0.8 + 0.2 * variation);

      float doppler = 0.5 + 0.5 * cos(angle + 1.5);
      col *= 0.7 + 0.3 * doppler;

      float alpha = ring * (0.9 + 0.1 * variation);

      gl_FragColor = vec4(col * 1.8, alpha * 0.9);
    }
  `
);

extend({ LensedRingMaterial });

// Photon sphere - bright ring hugging the event horizon
const PhotonSphereMaterial = shaderMaterial(
  { time: 0 },
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  `
    uniform float time;
    varying vec2 vUv;

    void main() {
      vec2 center = vUv - 0.5;
      float dist = length(center);

      // Event horizon edge (matches the 2.2 radius sphere scaled to UV space)
      // For a 10x10 plane, 2.2 radius = 0.22 in UV (0-0.5 range)
      float eventHorizonRadius = 0.22;

      // Main photon ring - RIGHT at the edge of event horizon
      float ring1 = exp(-pow((dist - eventHorizonRadius) * 80.0, 2.0));

      // Thin bright edge glow
      float edgeGlow = smoothstep(eventHorizonRadius + 0.02, eventHorizonRadius, dist) * 0.8;

      float ring = ring1 + edgeGlow;

      if (ring < 0.01) discard;

      // Warm bright white
      vec3 col = vec3(1.0, 0.95, 0.85);

      gl_FragColor = vec4(col * ring * 2.0, ring);
    }
  `
);

extend({ PhotonSphereMaterial });

// Main accretion disk
function AccretionDisk() {
  const meshRef = useRef();

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.material.time = state.clock.elapsedTime;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[Math.PI * 0.5, 0, 0]}>
      <planeGeometry args={[22, 22, 1, 1]} />
      <gargantuaDiskMaterial
        transparent
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

// Lensed ring above the black hole - billboarded to always face camera
function LensedRing({ isTop = true }) {
  const meshRef = useRef();
  const { camera } = useThree();

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.material.time = state.clock.elapsedTime;
      // Make the plane always face the camera
      meshRef.current.quaternion.copy(camera.quaternion);
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[10, 10]} />
      <lensedRingMaterial
        transparent
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        isTop={isTop ? 1.0 : 0.0}
      />
    </mesh>
  );
}

// Photon sphere - billboarded to always face camera
function PhotonSphere() {
  const meshRef = useRef();
  const { camera } = useThree();

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.material.time = state.clock.elapsedTime;
      // Make the plane always face the camera
      meshRef.current.quaternion.copy(camera.quaternion);
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[10, 10]} />
      <photonSphereMaterial
        transparent
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

// Pure black event horizon
function EventHorizon() {
  return (
    <mesh>
      <sphereGeometry args={[2.2, 128, 128]} />
      <meshBasicMaterial color="#000000" />
    </mesh>
  );
}

// Misty spiraling particles that orbit and get pulled into the black hole
function SpirallingMist({ maxCount = 600 }) {
  const meshRef = useRef();
  const spawnTimerRef = useRef(0);
  const activeCountRef = useRef(300);

  const MAX_SPAWN_RADIUS = 25;
  const MIN_SPAWN_RADIUS = 5;

  // Track individual particle ages for spiral decay
  const [positions, velocities, colors, sizes, activeFlags, ages, initialRadii] = useMemo(() => {
    const pos = new Float32Array(maxCount * 3);
    const vel = new Float32Array(maxCount * 3);
    const col = new Float32Array(maxCount * 3);
    const siz = new Float32Array(maxCount);
    const active = new Float32Array(maxCount);
    const age = new Float32Array(maxCount); // Track how long particle has been alive
    const initRadius = new Float32Array(maxCount); // Starting radius

    for (let i = 0; i < maxCount; i++) {
      const orbitRadius = MIN_SPAWN_RADIUS + Math.random() * (MAX_SPAWN_RADIUS - MIN_SPAWN_RADIUS);
      const angle = Math.random() * Math.PI * 2;
      const height = (Math.random() - 0.5) * 2;

      pos[i * 3] = Math.cos(angle) * orbitRadius;
      pos[i * 3 + 1] = height;
      pos[i * 3 + 2] = Math.sin(angle) * orbitRadius;

      // Initial orbital velocity (tangent to circle)
      const orbitalSpeed = 0.08;
      vel[i * 3] = -Math.sin(angle) * orbitalSpeed;
      vel[i * 3 + 1] = 0;
      vel[i * 3 + 2] = Math.cos(angle) * orbitalSpeed;

      // Misty white/blue colors - softer
      col[i * 3] = 0.7 + Math.random() * 0.3;
      col[i * 3 + 1] = 0.75 + Math.random() * 0.25;
      col[i * 3 + 2] = 0.85 + Math.random() * 0.15;

      // Larger, softer particles for misty look
      siz[i] = 0.08 + Math.random() * 0.15;
      active[i] = i < 300 ? 1.0 : 0.0;
      age[i] = Math.random() * 10; // Random starting ages
      initRadius[i] = orbitRadius;
    }

    return [pos, vel, col, siz, active, age, initRadius];
  }, [maxCount]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    const posAttr = meshRef.current.geometry.attributes.position;
    const colAttr = meshRef.current.geometry.attributes.color;
    const sizeAttr = meshRef.current.geometry.attributes.size;
    const opacityAttr = meshRef.current.geometry.attributes.opacity;

    // Spawn new particles
    spawnTimerRef.current += delta;
    if (spawnTimerRef.current > 0.08 && activeCountRef.current < maxCount) {
      const spawnCount = Math.min(3, maxCount - activeCountRef.current);
      for (let j = 0; j < spawnCount; j++) {
        const i = activeCountRef.current;
        if (i < maxCount) {
          const spawnRadius = MAX_SPAWN_RADIUS - Math.random() * 3;
          const angle = Math.random() * Math.PI * 2;
          const height = (Math.random() - 0.5) * 1.5;

          posAttr.array[i * 3] = Math.cos(angle) * spawnRadius;
          posAttr.array[i * 3 + 1] = height;
          posAttr.array[i * 3 + 2] = Math.sin(angle) * spawnRadius;

          velocities[i * 3] = -Math.sin(angle) * 0.06;
          velocities[i * 3 + 1] = 0;
          velocities[i * 3 + 2] = Math.cos(angle) * 0.06;

          colAttr.array[i * 3] = 0.7 + Math.random() * 0.3;
          colAttr.array[i * 3 + 1] = 0.75 + Math.random() * 0.25;
          colAttr.array[i * 3 + 2] = 0.85 + Math.random() * 0.15;

          sizeAttr.array[i] = 0.08 + Math.random() * 0.15;
          opacityAttr.array[i] = 0.3 + Math.random() * 0.3;
          activeFlags[i] = 1.0;
          ages[i] = 0;
          initialRadii[i] = spawnRadius;

          activeCountRef.current++;
        }
      }
      spawnTimerRef.current = 0;
    }

    // Update all particles
    for (let i = 0; i < activeCountRef.current; i++) {
      if (activeFlags[i] < 0.5) continue;

      // Age the particle
      ages[i] += delta;

      let x = posAttr.array[i * 3];
      let y = posAttr.array[i * 3 + 1];
      let z = posAttr.array[i * 3 + 2];

      const distXZ = Math.sqrt(x * x + z * z);
      const dist = Math.sqrt(x * x + y * y + z * z);

      // STRONG inward spiral - key change!
      // The longer a particle exists, the stronger it gets pulled in
      const ageDecay = 0.015 + ages[i] * 0.003; // Increases over time
      const inwardPull = ageDecay / (dist + 0.5);

      // Orbital motion (tangent)
      const tangentX = -z / (distXZ + 0.1);
      const tangentZ = x / (distXZ + 0.1);
      const orbitalSpeed = 0.15 / Math.sqrt(distXZ + 1); // Faster closer in (Kepler)

      // Update velocity - strong inward component
      velocities[i * 3] += tangentX * orbitalSpeed * delta;
      velocities[i * 3 + 2] += tangentZ * orbitalSpeed * delta;

      // Inward pull - THIS IS THE KEY SPIRAL EFFECT
      velocities[i * 3] -= (x / dist) * inwardPull * delta * 8;
      velocities[i * 3 + 1] -= y * 0.02 * delta; // Flatten to disk
      velocities[i * 3 + 2] -= (z / dist) * inwardPull * delta * 8;

      // Drag to prevent too fast speeds but allow spiral
      const drag = 0.995;
      velocities[i * 3] *= drag;
      velocities[i * 3 + 1] *= drag;
      velocities[i * 3 + 2] *= drag;

      // Update position
      posAttr.array[i * 3] += velocities[i * 3];
      posAttr.array[i * 3 + 1] += velocities[i * 3 + 1];
      posAttr.array[i * 3 + 2] += velocities[i * 3 + 2];

      // Color transition: white/blue -> yellow -> orange -> red as approaching
      const heatFactor = Math.max(0, 1 - dist / 12);
      const spiralProgress = 1 - (dist / initialRadii[i]); // How far into spiral

      if (dist > 8) {
        // Far: misty white/blue
        colAttr.array[i * 3] = 0.7 + Math.random() * 0.1;
        colAttr.array[i * 3 + 1] = 0.75 + Math.random() * 0.1;
        colAttr.array[i * 3 + 2] = 0.85 + Math.random() * 0.1;
      } else if (dist > 5) {
        // Mid: warming to yellow/orange
        colAttr.array[i * 3] = 0.9 + heatFactor * 0.1;
        colAttr.array[i * 3 + 1] = 0.7 - heatFactor * 0.2;
        colAttr.array[i * 3 + 2] = 0.5 - heatFactor * 0.3;
      } else {
        // Close: hot orange/red
        colAttr.array[i * 3] = 1.0;
        colAttr.array[i * 3 + 1] = 0.4 - heatFactor * 0.3;
        colAttr.array[i * 3 + 2] = 0.1;
      }

      // Size: grows slightly as gets closer, then shrinks right before consumption
      if (dist > 4) {
        sizeAttr.array[i] = (0.1 + Math.random() * 0.05) * (1 + heatFactor * 0.5);
      } else {
        sizeAttr.array[i] = 0.15 * (dist / 4); // Shrink as consumed
      }

      // Opacity: fade in, then fade out as consumed
      opacityAttr.array[i] = Math.min(0.5, ages[i] * 0.1) * Math.min(1, dist / 3);

      // Respawn if consumed
      if (dist < 2.8) {
        const spawnRadius = MAX_SPAWN_RADIUS - Math.random() * 5;
        const angle = Math.random() * Math.PI * 2;
        const height = (Math.random() - 0.5) * 1.5;

        posAttr.array[i * 3] = Math.cos(angle) * spawnRadius;
        posAttr.array[i * 3 + 1] = height;
        posAttr.array[i * 3 + 2] = Math.sin(angle) * spawnRadius;

        velocities[i * 3] = -Math.sin(angle) * 0.06;
        velocities[i * 3 + 1] = 0;
        velocities[i * 3 + 2] = Math.cos(angle) * 0.06;

        colAttr.array[i * 3] = 0.7 + Math.random() * 0.3;
        colAttr.array[i * 3 + 1] = 0.75 + Math.random() * 0.25;
        colAttr.array[i * 3 + 2] = 0.85 + Math.random() * 0.15;

        sizeAttr.array[i] = 0.08 + Math.random() * 0.15;
        opacityAttr.array[i] = 0.1;
        ages[i] = 0;
        initialRadii[i] = spawnRadius;
      }
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    opacityAttr.needsUpdate = true;
  });

  // Create opacity array
  const opacities = useMemo(() => {
    const op = new Float32Array(maxCount);
    for (let i = 0; i < maxCount; i++) {
      op[i] = 0.3 + Math.random() * 0.3;
    }
    return op;
  }, [maxCount]);

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={maxCount}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={maxCount}
          array={colors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={maxCount}
          array={sizes}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-opacity"
          count={maxCount}
          array={opacities}
          itemSize={1}
        />
      </bufferGeometry>
      <circleParticleMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// No bloom for transparent overlay - bloom breaks alpha channel

// Static background stars - BIGGER and BRIGHTER for visibility
function BackgroundStars({ count = 350 }) {
  const meshRef = useRef();

  const [positions, colors, sizes] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Spread stars in a sphere around the scene
      const radius = 25 + Math.random() * 60;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.5;
      pos[i * 3 + 2] = radius * Math.cos(phi);

      // Star colors - bright white with some variation
      const colorType = Math.random();
      if (colorType < 0.5) {
        // Bright white stars
        col[i * 3] = 1.0;
        col[i * 3 + 1] = 1.0;
        col[i * 3 + 2] = 1.0;
      } else if (colorType < 0.75) {
        // Warm yellow/orange stars
        col[i * 3] = 1.0;
        col[i * 3 + 1] = 0.9 + Math.random() * 0.1;
        col[i * 3 + 2] = 0.7 + Math.random() * 0.2;
      } else {
        // Blue-white stars
        col[i * 3] = 0.85 + Math.random() * 0.15;
        col[i * 3 + 1] = 0.9 + Math.random() * 0.1;
        col[i * 3 + 2] = 1.0;
      }

      // BIGGER sizes for visibility
      siz[i] = 0.08 + Math.random() * 0.15;
    }

    return [pos, col, siz];
  }, [count]);

  // Subtle twinkling effect
  useFrame((state) => {
    if (!meshRef.current) return;
    const sizeAttr = meshRef.current.geometry.attributes.size;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      // Each star twinkles at its own rate
      const twinkle = 0.8 + 0.2 * Math.sin(time * (1 + i * 0.1) + i);
      sizeAttr.array[i] = sizes[i] * twinkle;
    }
    sizeAttr.needsUpdate = true;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <starParticleMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// Slow majestic camera movement
function CameraRig() {
  const { camera } = useThree();

  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.03;
    const radius = 18;

    camera.position.x = Math.sin(t) * radius;
    camera.position.z = Math.cos(t) * radius;
    camera.position.y = Math.sin(t * 0.5) * 4 + 3;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

// Main scene - no background color for transparency
function BlackHoleScene() {
  return (
    <>
      {/* No background - fully transparent */}

      <CameraRig />

      {/* Static background stars for ambiance */}
      <BackgroundStars count={250} />

      {/* Spiraling particles being consumed */}
      <SpirallingMist maxCount={600} />

      <EventHorizon />
      <PhotonSphere />
      <LensedRing isTop={true} />
      <LensedRing isTop={false} />
      <AccretionDisk />

      {/* No bloom - it breaks transparency */}
    </>
  );
}

// Component to set clear color to transparent
function TransparentBackground() {
  const { gl } = useThree();

  React.useEffect(() => {
    gl.setClearColor(0x000000, 0); // Fully transparent
  }, [gl]);

  return null;
}

// Main component - transparent overlay for streams
const BlackHole = () => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'transparent',
      pointerEvents: 'none'
    }}>
      <Canvas
        camera={{ position: [0, 4, 18], fov: 45 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          premultipliedAlpha: false
        }}
        dpr={[1, 2]}
        style={{ background: 'transparent' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <TransparentBackground />
        <BlackHoleScene />
      </Canvas>
    </div>
  );
};

export default BlackHole;