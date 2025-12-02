import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, extend, useThree } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';

// Custom shader for circular glowing particles - FLASHY VERSION
const CircleParticleMaterial = shaderMaterial(
  { opacity: 1.0, time: 0 },
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
      gl_PointSize = size * (400.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  // Fragment shader - creates intense glowing particles
  `
    varying vec3 vColor;
    varying float vOpacity;

    void main() {
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);

      // DISCARD corners to make circular - this is key!
      if (dist > 0.5) discard;

      // Soft circular glow with bright center
      float circle = 1.0 - smoothstep(0.0, 0.5, dist);
      float core = 1.0 - smoothstep(0.0, 0.2, dist);
      float glow = exp(-dist * 4.0) * 0.8;

      float alpha = circle * (0.6 + core * 0.4 + glow * 0.3);

      if (alpha < 0.01) discard;

      // Boost brightness for flashy effect
      vec3 boostedColor = vColor * (1.2 + core * 1.5);

      gl_FragColor = vec4(boostedColor, alpha * vOpacity);
    }
  `
);

extend({ CircleParticleMaterial });

// Nebula shader material - volumetric cosmic clouds
const NebulaMaterial = shaderMaterial(
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

    // Simplex-like noise
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
      float freq = 1.0;
      for(int i = 0; i < 6; i++) {
        sum += amp * noise(p * freq);
        freq *= 2.0;
        amp *= 0.5;
      }
      return sum;
    }

    void main() {
      vec2 uv = vUv - 0.5;
      float dist = length(uv);

      // Avoid drawing over the black hole center
      if (dist < 0.08) discard;

      // Moving nebula coordinates
      vec2 nebUv = uv * 2.0;
      float t = time * 0.02;

      // Multiple layers of nebula with different colors
      float n1 = fbm(nebUv * 3.0 + vec2(t, t * 0.5));
      float n2 = fbm(nebUv * 2.0 - vec2(t * 0.7, t * 0.3) + 100.0);
      float n3 = fbm(nebUv * 4.0 + vec2(t * 0.4, -t * 0.6) + 200.0);
      float n4 = fbm(nebUv * 1.5 + vec2(-t * 0.3, t * 0.8) + 300.0);

      // Purple/magenta nebula
      vec3 purple = vec3(0.6, 0.2, 0.8) * n1 * 1.5;

      // Cyan/teal nebula
      vec3 cyan = vec3(0.1, 0.7, 0.9) * n2 * 1.2;

      // Pink/rose nebula
      vec3 pink = vec3(1.0, 0.4, 0.6) * n3 * 1.0;

      // Golden/orange wisps
      vec3 gold = vec3(1.0, 0.7, 0.2) * n4 * 0.8;

      // Combine nebula colors
      vec3 nebula = purple + cyan * 0.7 + pink * 0.5 + gold * 0.4;

      // Add some bright star-like sparkles
      float sparkle = pow(noise(nebUv * 20.0 + t * 0.5), 8.0) * 2.0;
      nebula += vec3(1.0, 0.9, 0.95) * sparkle;

      // Fade based on distance from center - more visible further out
      float fade = smoothstep(0.08, 0.15, dist) * smoothstep(0.7, 0.4, dist);

      // Pulse effect
      float pulse = 0.8 + 0.2 * sin(time * 0.5 + dist * 5.0);
      nebula *= pulse;

      float alpha = (n1 + n2 * 0.7 + n3 * 0.5) * fade * 0.6;

      gl_FragColor = vec4(nebula, alpha);
    }
  `
);

extend({ NebulaMaterial });

// Lens flare / light ray shader
const LensFlareMaterial = shaderMaterial(
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
      float angle = atan(center.y, center.x);

      // Create radiating rays
      float rays = pow(abs(sin(angle * 8.0 + time * 0.3)), 20.0);
      rays += pow(abs(sin(angle * 12.0 - time * 0.2)), 25.0) * 0.5;
      rays += pow(abs(sin(angle * 6.0 + time * 0.15)), 15.0) * 0.3;

      // Fade rays with distance
      float rayIntensity = rays * exp(-dist * 4.0) * smoothstep(0.0, 0.05, dist);

      // Central glow
      float glow = exp(-dist * 8.0) * 0.5;

      // Ring flares
      float ring1 = exp(-pow((dist - 0.15) * 30.0, 2.0)) * 0.3;
      float ring2 = exp(-pow((dist - 0.25) * 40.0, 2.0)) * 0.2;

      float intensity = rayIntensity + glow + ring1 + ring2;

      // Colorful lens flare
      vec3 col = vec3(1.0, 0.9, 0.8) * glow;
      col += vec3(1.0, 0.6, 0.3) * rayIntensity;
      col += vec3(0.5, 0.8, 1.0) * ring1;
      col += vec3(1.0, 0.5, 0.8) * ring2;

      // Pulse
      col *= 0.9 + 0.1 * sin(time * 2.0);

      if (intensity < 0.01) discard;

      gl_FragColor = vec4(col, intensity * 0.8);
    }
  `
);

extend({ LensFlareMaterial });

// Energy jet shader
const EnergyJetMaterial = shaderMaterial(
  { time: 0, direction: 1.0 },
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  `
    uniform float time;
    uniform float direction;
    varying vec2 vUv;

    float noise(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;

      // Jet flows along Y axis
      float y = uv.y;
      float x = uv.x - 0.5;

      // Jet shape - narrow cone
      float width = 0.05 + y * 0.15;
      float jetShape = smoothstep(width, width * 0.3, abs(x));

      // Noise for turbulence
      float n = noise(vec2(x * 10.0, y * 5.0 - time * direction * 2.0));
      float n2 = noise(vec2(x * 20.0, y * 10.0 - time * direction * 3.0));

      // Intensity fades along jet
      float intensity = jetShape * (1.0 - y * 0.7);
      intensity *= 0.7 + 0.3 * n;

      // Color - hot blue/white core, purple edges
      vec3 core = vec3(0.7, 0.85, 1.0);
      vec3 edge = vec3(0.6, 0.3, 1.0);
      vec3 col = mix(edge, core, jetShape);

      // Add sparkles
      float sparkle = pow(n2, 5.0) * jetShape * 2.0;
      col += vec3(1.0) * sparkle;

      // Pulse
      intensity *= 0.8 + 0.2 * sin(time * 3.0 + y * 10.0);

      if (intensity < 0.01) discard;

      gl_FragColor = vec4(col * 1.5, intensity * 0.7);
    }
  `
);

extend({ EnergyJetMaterial });

// Custom shader for background stars with twinkle - ULTRA BRIGHT FLASHY version
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
      gl_PointSize = size * (600.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  // Fragment shader - creates ultra bright star-like points with color
  `
    varying vec3 vColor;
    varying float vSize;

    void main() {
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);

      // DISCARD corners to make circular
      if (dist > 0.5) discard;

      // Bright sharp center with circular glow
      float circle = 1.0 - smoothstep(0.3, 0.5, dist);
      float core = 1.0 - smoothstep(0.0, 0.1, dist);
      float innerGlow = exp(-dist * 6.0) * 0.9;
      float midGlow = exp(-dist * 3.0) * 0.5;

      // Subtle cross/spike pattern (within circle)
      float spike = max(
        exp(-abs(center.x) * 20.0) * exp(-abs(center.y) * 5.0),
        exp(-abs(center.y) * 20.0) * exp(-abs(center.x) * 5.0)
      ) * 0.3 * circle;

      float alpha = (core + innerGlow + midGlow + spike) * circle;
      alpha = max(alpha, circle * 0.3);

      if (alpha < 0.01) discard;

      // Boost brightness
      vec3 brightColor = vColor * (1.8 + core * 2.0);

      gl_FragColor = vec4(brightColor, alpha);
    }
  `
);

extend({ StarParticleMaterial });

// Interstellar-style thin accretion disk - ULTRA FLASHY
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
      for(int i = 0; i < 5; i++) {
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

      float innerRadius = 0.10;
      float outerRadius = 0.5;

      if (dist < innerRadius || dist > outerRadius) discard;

      // Multiple bright rings for flashy effect
      float ring1 = exp(-pow((dist - 0.12) / 0.04, 2.0) * 2.0);
      float ring2 = exp(-pow((dist - 0.18) / 0.05, 2.0) * 2.0) * 0.7;
      float ring3 = exp(-pow((dist - 0.25) / 0.06, 2.0) * 2.0) * 0.5;
      float ringFactor = ring1 + ring2 + ring3;

      float diskFactor = smoothstep(outerRadius, innerRadius + 0.05, dist) * 0.3;

      // Fast Kepler rotation
      float rotSpeed = 2.0 / sqrt(dist);
      float rotAngle = angle + time * rotSpeed * 0.2;

      // More dramatic structure
      float structure = fbm(vec2(rotAngle * 8.0, dist * 30.0));
      float detail = fbm(vec2(rotAngle * 20.0 + time * 0.5, dist * 50.0));
      float streaks = pow(fbm(vec2(rotAngle * 30.0, dist * 10.0 + time * 0.3)), 2.0);

      float temp = smoothstep(outerRadius, innerRadius, dist);

      // More vibrant colors
      vec3 hotColor = vec3(1.0, 1.0, 0.95);
      vec3 warmColor = vec3(1.0, 0.6, 0.2);
      vec3 coolColor = vec3(0.95, 0.3, 0.1);
      vec3 blueHot = vec3(0.6, 0.8, 1.0);

      vec3 col = mix(coolColor, warmColor, temp);
      col = mix(col, hotColor, pow(temp, 1.5));
      col = mix(col, blueHot, pow(temp, 4.0) * 0.3);

      float brightness = 0.6 + 0.4 * structure;
      brightness *= 0.8 + 0.2 * detail;
      brightness *= ringFactor + diskFactor;
      brightness += streaks * 0.4;

      // Enhanced Doppler beaming
      float doppler = 0.3 + 0.7 * cos(angle + 1.5);
      brightness *= 0.4 + doppler * 0.8;

      // Color shift from doppler - more dramatic
      col = mix(col * vec3(1.3, 0.9, 0.7), col * vec3(0.8, 0.95, 1.2), doppler * 0.5);

      // Pulsing effect
      float pulse = 0.9 + 0.1 * sin(time * 2.0 + dist * 20.0);
      brightness *= pulse;

      float edgeFade = smoothstep(innerRadius, innerRadius + 0.02, dist);
      edgeFade *= smoothstep(outerRadius, outerRadius - 0.04, dist);

      float alpha = brightness * edgeFade;

      gl_FragColor = vec4(col * brightness * 1.8, alpha * 0.95);
    }
  `
);

extend({ GargantuaDiskMaterial });

// Gravitationally lensed ring - FLASHY with rainbow shimmer
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

    vec3 rainbow(float t) {
      return vec3(
        0.5 + 0.5 * sin(t * 6.28 + 0.0),
        0.5 + 0.5 * sin(t * 6.28 + 2.09),
        0.5 + 0.5 * sin(t * 6.28 + 4.19)
      );
    }

    void main() {
      vec2 center = vUv - 0.5;
      float dist = length(center);
      float angle = atan(center.y, center.x);

      float ringRadius = 0.225;
      float ringThickness = 0.015;

      float ring = exp(-pow((dist - ringRadius) / ringThickness, 2.0));

      // Show top or bottom arc
      float arcMask = isTop > 0.5
        ? smoothstep(-0.05, 0.15, center.y)
        : smoothstep(0.05, -0.15, center.y);
      ring *= arcMask;

      if (ring < 0.01) discard;

      float variation = noise(vec2(angle * 10.0 + time * 0.3, dist * 25.0));

      // Base warm color with rainbow shimmer
      vec3 baseCol = vec3(1.0, 0.92, 0.75);
      vec3 shimmer = rainbow(angle * 0.5 + time * 0.2) * 0.3;
      vec3 col = baseCol + shimmer;

      float doppler = 0.5 + 0.5 * cos(angle + 1.5);
      col *= 0.6 + 0.4 * doppler;

      // Sparkle effect
      float sparkle = pow(noise(vec2(angle * 30.0 + time, dist * 50.0)), 6.0) * 2.0;
      col += vec3(1.0) * sparkle;

      // Pulse
      float pulse = 0.9 + 0.1 * sin(time * 3.0 + angle * 5.0);
      col *= pulse;

      float alpha = ring * (0.95 + 0.05 * variation);

      gl_FragColor = vec4(col * 2.2, alpha * 0.95);
    }
  `
);

extend({ LensedRingMaterial });

// Photon sphere - ULTRA bright with pulse
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
      float angle = atan(center.y, center.x);

      float eventHorizonRadius = 0.22;

      // Multiple photon rings
      float ring1 = exp(-pow((dist - eventHorizonRadius) * 80.0, 2.0));
      float ring2 = exp(-pow((dist - eventHorizonRadius - 0.01) * 60.0, 2.0)) * 0.5;

      // Edge glow
      float edgeGlow = smoothstep(eventHorizonRadius + 0.025, eventHorizonRadius, dist) * 0.9;

      float ring = ring1 + ring2 + edgeGlow;

      if (ring < 0.01) discard;

      // Rotating sparkles
      float sparkle = pow(sin(angle * 20.0 + time * 2.0), 8.0) * ring1 * 0.5;

      // Warm bright white with subtle color variation
      vec3 col = vec3(1.0, 0.95, 0.85);
      col += vec3(0.2, 0.1, 0.0) * sparkle;

      // Intense pulse
      float pulse = 0.85 + 0.15 * sin(time * 4.0);

      gl_FragColor = vec4(col * ring * 2.5 * pulse, ring);
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

      // Colorful initial colors - cyan, purple, pink mix
      const colorChoice = i % 3;
      if (colorChoice === 0) {
        col[i * 3] = 0.4 + Math.random() * 0.2;
        col[i * 3 + 1] = 0.8 + Math.random() * 0.2;
        col[i * 3 + 2] = 1.0;
      } else if (colorChoice === 1) {
        col[i * 3] = 0.7 + Math.random() * 0.2;
        col[i * 3 + 1] = 0.4 + Math.random() * 0.2;
        col[i * 3 + 2] = 1.0;
      } else {
        col[i * 3] = 1.0;
        col[i * 3 + 1] = 0.5 + Math.random() * 0.2;
        col[i * 3 + 2] = 0.8 + Math.random() * 0.2;
      }

      // Larger particles for more presence
      siz[i] = 0.1 + Math.random() * 0.18;
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

          // Colorful spawn colors
          const colorChoice = Math.floor(Math.random() * 3);
          if (colorChoice === 0) {
            colAttr.array[i * 3] = 0.4 + Math.random() * 0.2;
            colAttr.array[i * 3 + 1] = 0.8 + Math.random() * 0.2;
            colAttr.array[i * 3 + 2] = 1.0;
          } else if (colorChoice === 1) {
            colAttr.array[i * 3] = 0.7 + Math.random() * 0.2;
            colAttr.array[i * 3 + 1] = 0.4 + Math.random() * 0.2;
            colAttr.array[i * 3 + 2] = 1.0;
          } else {
            colAttr.array[i * 3] = 1.0;
            colAttr.array[i * 3 + 1] = 0.5 + Math.random() * 0.2;
            colAttr.array[i * 3 + 2] = 0.8 + Math.random() * 0.2;
          }

          sizeAttr.array[i] = 0.1 + Math.random() * 0.15;
          opacityAttr.array[i] = 0.4 + Math.random() * 0.3;
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

      // Color transition: FLASHY rainbow -> yellow -> orange -> red/magenta as approaching
      const heatFactor = Math.max(0, 1 - dist / 12);

      if (dist > 10) {
        // Far: colorful mix - cyan, purple, pink
        const colorChoice = (i % 3);
        if (colorChoice === 0) {
          colAttr.array[i * 3] = 0.4 + Math.random() * 0.2;
          colAttr.array[i * 3 + 1] = 0.8 + Math.random() * 0.2;
          colAttr.array[i * 3 + 2] = 1.0;
        } else if (colorChoice === 1) {
          colAttr.array[i * 3] = 0.7 + Math.random() * 0.2;
          colAttr.array[i * 3 + 1] = 0.4 + Math.random() * 0.2;
          colAttr.array[i * 3 + 2] = 1.0;
        } else {
          colAttr.array[i * 3] = 1.0;
          colAttr.array[i * 3 + 1] = 0.5 + Math.random() * 0.2;
          colAttr.array[i * 3 + 2] = 0.8 + Math.random() * 0.2;
        }
      } else if (dist > 6) {
        // Mid: warming to gold/orange
        colAttr.array[i * 3] = 1.0;
        colAttr.array[i * 3 + 1] = 0.7 - heatFactor * 0.3;
        colAttr.array[i * 3 + 2] = 0.3 - heatFactor * 0.2;
      } else if (dist > 4) {
        // Close: hot orange/red with magenta
        colAttr.array[i * 3] = 1.0;
        colAttr.array[i * 3 + 1] = 0.3 - heatFactor * 0.2;
        colAttr.array[i * 3 + 2] = 0.2 + heatFactor * 0.3;
      } else {
        // Very close: intense white-hot
        colAttr.array[i * 3] = 1.0;
        colAttr.array[i * 3 + 1] = 0.9 + Math.random() * 0.1;
        colAttr.array[i * 3 + 2] = 0.8 + Math.random() * 0.2;
      }

      // Size: grows as gets closer, then shrinks right before consumption
      if (dist > 4) {
        sizeAttr.array[i] = (0.12 + Math.random() * 0.08) * (1 + heatFactor * 0.8);
      } else {
        sizeAttr.array[i] = 0.2 * (dist / 4);
      }

      // Opacity: brighter overall
      opacityAttr.array[i] = Math.min(0.7, ages[i] * 0.15) * Math.min(1, dist / 3);

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

        // Colorful respawn colors
        const colorChoice = Math.floor(Math.random() * 3);
        if (colorChoice === 0) {
          colAttr.array[i * 3] = 0.4 + Math.random() * 0.2;
          colAttr.array[i * 3 + 1] = 0.8 + Math.random() * 0.2;
          colAttr.array[i * 3 + 2] = 1.0;
        } else if (colorChoice === 1) {
          colAttr.array[i * 3] = 0.7 + Math.random() * 0.2;
          colAttr.array[i * 3 + 1] = 0.4 + Math.random() * 0.2;
          colAttr.array[i * 3 + 2] = 1.0;
        } else {
          colAttr.array[i * 3] = 1.0;
          colAttr.array[i * 3 + 1] = 0.5 + Math.random() * 0.2;
          colAttr.array[i * 3 + 2] = 0.8 + Math.random() * 0.2;
        }

        sizeAttr.array[i] = 0.1 + Math.random() * 0.15;
        opacityAttr.array[i] = 0.2;
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

// Static background stars - ULTRA FLASHY with more colors
function BackgroundStars({ count = 500 }) {
  const meshRef = useRef();

  const [positions, colors, sizes] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Spread stars in a sphere around the scene
      const radius = 25 + Math.random() * 80;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.6;
      pos[i * 3 + 2] = radius * Math.cos(phi);

      // More colorful stars
      const colorType = Math.random();
      if (colorType < 0.3) {
        // Bright white stars
        col[i * 3] = 1.0;
        col[i * 3 + 1] = 1.0;
        col[i * 3 + 2] = 1.0;
      } else if (colorType < 0.45) {
        // Warm yellow/orange stars
        col[i * 3] = 1.0;
        col[i * 3 + 1] = 0.85 + Math.random() * 0.15;
        col[i * 3 + 2] = 0.5 + Math.random() * 0.3;
      } else if (colorType < 0.6) {
        // Blue-white stars
        col[i * 3] = 0.7 + Math.random() * 0.2;
        col[i * 3 + 1] = 0.85 + Math.random() * 0.15;
        col[i * 3 + 2] = 1.0;
      } else if (colorType < 0.75) {
        // Pink/magenta stars
        col[i * 3] = 1.0;
        col[i * 3 + 1] = 0.5 + Math.random() * 0.3;
        col[i * 3 + 2] = 0.9 + Math.random() * 0.1;
      } else if (colorType < 0.85) {
        // Cyan stars
        col[i * 3] = 0.4 + Math.random() * 0.3;
        col[i * 3 + 1] = 0.9 + Math.random() * 0.1;
        col[i * 3 + 2] = 1.0;
      } else {
        // Purple stars
        col[i * 3] = 0.7 + Math.random() * 0.2;
        col[i * 3 + 1] = 0.4 + Math.random() * 0.2;
        col[i * 3 + 2] = 1.0;
      }

      // Varied sizes - some really big bright ones
      const sizeRandom = Math.random();
      if (sizeRandom < 0.1) {
        siz[i] = 0.25 + Math.random() * 0.15; // Big bright stars
      } else {
        siz[i] = 0.08 + Math.random() * 0.12;
      }
    }

    return [pos, col, siz];
  }, [count]);

  // Dynamic twinkling effect
  useFrame((state) => {
    if (!meshRef.current) return;
    const sizeAttr = meshRef.current.geometry.attributes.size;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      // Each star twinkles at its own rate - more dramatic
      const twinkle = 0.7 + 0.3 * Math.sin(time * (2 + i * 0.15) + i);
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

// Cosmic nebula background - billboarded
function CosmicNebula() {
  const meshRef = useRef();
  const { camera } = useThree();

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.material.time = state.clock.elapsedTime;
      meshRef.current.quaternion.copy(camera.quaternion);
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -5]}>
      <planeGeometry args={[80, 80]} />
      <nebulaMaterial
        transparent
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

// Lens flare effect - billboarded
function LensFlare() {
  const meshRef = useRef();
  const { camera } = useThree();

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.material.time = state.clock.elapsedTime;
      meshRef.current.quaternion.copy(camera.quaternion);
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[15, 15]} />
      <lensFlareMaterial
        transparent
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

// Energy jets shooting from the poles
function EnergyJet({ direction = 1 }) {
  const meshRef = useRef();

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.material.time = state.clock.elapsedTime;
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[0, direction * 4, 0]}
      rotation={[direction > 0 ? 0 : Math.PI, 0, 0]}
    >
      <planeGeometry args={[3, 8]} />
      <energyJetMaterial
        transparent
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        direction={direction}
      />
    </mesh>
  );
}

// Slow majestic camera movement
function CameraRig() {
  const { camera } = useThree();

  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.035;
    const radius = 18;

    camera.position.x = Math.sin(t) * radius;
    camera.position.z = Math.cos(t) * radius;
    camera.position.y = Math.sin(t * 0.5) * 5 + 4;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

// Main scene - ULTRA FLASHY with nebula
function BlackHoleScene() {
  return (
    <>
      {/* No background - fully transparent */}

      <CameraRig />

      {/* Cosmic nebula background */}
      <CosmicNebula />

      {/* Static background stars for ambiance - more of them */}
      <BackgroundStars count={500} />

      {/* Lens flare effect */}
      <LensFlare />

      {/* Energy jets from the poles */}
      <EnergyJet direction={1} />
      <EnergyJet direction={-1} />

      {/* Spiraling particles being consumed - more of them */}
      <SpirallingMist maxCount={800} />

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