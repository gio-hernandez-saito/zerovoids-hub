import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* ═══════════════════════ Shaders ═══════════════════════ */

const dustVertexShader = `
  attribute float aSize;
  attribute float aOpacity;
  varying float vOpacity;
  void main() {
    vOpacity = aOpacity;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (150.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const dustFragmentShader = `
  varying float vOpacity;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.2, d) * vOpacity;
    gl_FragColor = vec4(vec3(0.08, 0.08, 0.14), alpha);
  }
`;

const starVertexShader = `
  attribute float aSize;
  attribute float aOpacity;
  attribute float aFlicker;
  attribute vec3 aColor;
  uniform float uTime;
  varying float vOpacity;
  varying vec3 vColor;
  void main() {
    float flick = 1.0 + 0.25 * sin(uTime * aFlicker + aFlicker * 100.0);
    vOpacity = aOpacity * flick;
    vColor = aColor;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (120.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

// Sharp core + subtle glow — looks like real stars
const starFragmentShader = `
  varying float vOpacity;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    // Bright sharp core
    float core = exp(-d * d * 80.0);
    // Soft dim glow
    float glow = exp(-d * d * 8.0) * 0.15;
    float alpha = (core + glow) * vOpacity;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

// Bright feature stars with cross spikes
const brightStarVertexShader = `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  varying float vOpacity;
  varying vec3 vColor;
  void main() {
    float pulse = 0.85 + 0.15 * sin(uTime * 0.8 + aPhase);
    vOpacity = pulse;
    vColor = aColor;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * pulse * (200.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const brightStarFragmentShader = `
  varying float vOpacity;
  varying vec3 vColor;
  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;

    // Sharp core
    float core = exp(-d * d * 120.0);

    // Cross spikes (horizontal + vertical)
    float spikeH = exp(-uv.y * uv.y * 200.0) * exp(-uv.x * uv.x * 8.0);
    float spikeV = exp(-uv.x * uv.x * 200.0) * exp(-uv.y * uv.y * 8.0);
    float spikes = (spikeH + spikeV) * 0.3;

    // Soft glow
    float glow = exp(-d * d * 6.0) * 0.1;

    float alpha = (core + spikes + glow) * vOpacity;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

/* ═══════════════════════ Star color temperatures ═══════════════════════ */

// Realistic star colors: blue-white, white, yellow-white, orange, red
const STAR_COLORS = [
  [0.75, 0.85, 1.0],   // blue-white (hot)
  [0.85, 0.9, 1.0],    // blue-tinted white
  [1.0, 1.0, 1.0],     // pure white
  [1.0, 1.0, 0.9],     // warm white
  [1.0, 0.95, 0.8],    // yellow-white
  [1.0, 0.85, 0.6],    // orange (rare)
  [1.0, 0.7, 0.5],     // deep orange (rare)
];

function pickStarColor(): [number, number, number] {
  const r = Math.random();
  // Weighted: most stars are white-ish, few are colored
  if (r < 0.15) return STAR_COLORS[0] as [number, number, number];
  if (r < 0.3) return STAR_COLORS[1] as [number, number, number];
  if (r < 0.55) return STAR_COLORS[2] as [number, number, number];
  if (r < 0.7) return STAR_COLORS[3] as [number, number, number];
  if (r < 0.85) return STAR_COLORS[4] as [number, number, number];
  if (r < 0.95) return STAR_COLORS[5] as [number, number, number];
  return STAR_COLORS[6] as [number, number, number];
}

/* ═══════════════════════ Dust — subtle space haze ═══════════════════════ */

const DUST_COUNT = 3000;

function DustParticles() {
  const ref = useRef<THREE.Points>(null);
  const velocities = useRef<Float32Array>(null);

  const { positions, sizes, opacities } = useMemo(() => {
    const pos = new Float32Array(DUST_COUNT * 3);
    const sz = new Float32Array(DUST_COUNT);
    const op = new Float32Array(DUST_COUNT);
    const vel = new Float32Array(DUST_COUNT * 3);

    for (let i = 0; i < DUST_COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 2] = 30 - Math.random() * 130;
      sz[i] = 0.6 + Math.random() * 1.2;
      op[i] = 0.04 + Math.random() * 0.08;
      vel[i * 3] = (Math.random() - 0.5) * 0.001;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.001;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.001;
    }
    velocities.current = vel;
    return { positions: pos, sizes: sz, opacities: op };
  }, []);

  useFrame(() => {
    if (!ref.current || !velocities.current) return;
    const posAttr = ref.current.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const vel = velocities.current;
    for (let i = 0; i < DUST_COUNT; i++) {
      vel[i * 3] += (Math.random() - 0.5) * 0.0002;
      vel[i * 3 + 1] += (Math.random() - 0.5) * 0.0002;
      vel[i * 3 + 2] += (Math.random() - 0.5) * 0.0002;
      vel[i * 3] *= 0.99;
      vel[i * 3 + 1] *= 0.99;
      vel[i * 3 + 2] *= 0.99;
      arr[i * 3] += vel[i * 3];
      arr[i * 3 + 1] += vel[i * 3 + 1];
      arr[i * 3 + 2] += vel[i * 3 + 2];
    }
    posAttr.needsUpdate = true;
  });

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: dustVertexShader,
        fragmentShader: dustFragmentShader,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );

  return (
    <points ref={ref} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={DUST_COUNT} itemSize={3} />
        <bufferAttribute attach="attributes-aSize" array={sizes} count={DUST_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aOpacity" array={opacities} count={DUST_COUNT} itemSize={1} />
      </bufferGeometry>
    </points>
  );
}

/* ═══════════════════════ Stars — sharp pinpoints on a sky sphere ═══════════════════════ */

const STAR_COUNT = 4000;

function StarParticles() {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const { positions, sizes, opacities, flickers, colors } = useMemo(() => {
    const pos = new Float32Array(STAR_COUNT * 3);
    const sz = new Float32Array(STAR_COUNT);
    const op = new Float32Array(STAR_COUNT);
    const fl = new Float32Array(STAR_COUNT);
    const col = new Float32Array(STAR_COUNT * 3);

    for (let i = 0; i < STAR_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      // Two layers: dense inner shell + sparse outer shell
      const r = Math.random() < 0.7
        ? 25 + Math.random() * 15   // inner: 25–40 (denser, brighter)
        : 40 + Math.random() * 25;  // outer: 40–65 (sparser, dimmer)
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      // Size: mostly tiny pinpoints
      const sizeRoll = Math.random();
      sz[i] = sizeRoll < 0.6 ? 0.3 + Math.random() * 0.3
            : sizeRoll < 0.9 ? 0.5 + Math.random() * 0.5
            : 0.8 + Math.random() * 0.8;

      // Brightness: realistic distribution — many visible, few very bright
      const brightRoll = Math.random();
      op[i] = brightRoll < 0.3 ? 0.15 + Math.random() * 0.15  // dim but visible
            : brightRoll < 0.7 ? 0.25 + Math.random() * 0.25  // medium
            : brightRoll < 0.9 ? 0.4 + Math.random() * 0.3    // bright
            : 0.6 + Math.random() * 0.4;                       // very bright (rare)

      fl[i] = Math.random() * 3 + 0.5;

      const c = pickStarColor();
      col[i * 3] = c[0];
      col[i * 3 + 1] = c[1];
      col[i * 3 + 2] = c[2];
    }
    return { positions: pos, sizes: sz, opacities: op, flickers: fl, colors: col };
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: starVertexShader,
        fragmentShader: starFragmentShader,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
        },
      }),
    [],
  );

  useFrame(({ clock, camera }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
    if (groupRef.current) {
      groupRef.current.position.copy(camera.position);
    }
  });

  return (
    <group ref={groupRef}>
      <points material={material}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" array={positions} count={STAR_COUNT} itemSize={3} />
          <bufferAttribute attach="attributes-aSize" array={sizes} count={STAR_COUNT} itemSize={1} />
          <bufferAttribute attach="attributes-aOpacity" array={opacities} count={STAR_COUNT} itemSize={1} />
          <bufferAttribute attach="attributes-aFlicker" array={flickers} count={STAR_COUNT} itemSize={1} />
          <bufferAttribute attach="attributes-aColor" array={colors} count={STAR_COUNT} itemSize={3} />
        </bufferGeometry>
        <primitive object={material} ref={materialRef} />
      </points>
    </group>
  );
}

/* ═══════════════════════ Bright feature stars — cross spike glow ═══════════════════════ */

const BRIGHT_COUNT = 60;

function BrightStars() {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const { positions, sizes, phases, colors } = useMemo(() => {
    const pos = new Float32Array(BRIGHT_COUNT * 3);
    const sz = new Float32Array(BRIGHT_COUNT);
    const ph = new Float32Array(BRIGHT_COUNT);
    const col = new Float32Array(BRIGHT_COUNT * 3);

    for (let i = 0; i < BRIGHT_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 28 + Math.random() * 30;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      sz[i] = 1.5 + Math.random() * 2.5;
      ph[i] = Math.random() * Math.PI * 2;

      const c = pickStarColor();
      col[i * 3] = c[0];
      col[i * 3 + 1] = c[1];
      col[i * 3 + 2] = c[2];
    }
    return { positions: pos, sizes: sz, phases: ph, colors: col };
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: brightStarVertexShader,
        fragmentShader: brightStarFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
        },
      }),
    [],
  );

  useFrame(({ clock, camera }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
    if (groupRef.current) {
      groupRef.current.position.copy(camera.position);
    }
  });

  return (
    <group ref={groupRef}>
      <points material={material}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" array={positions} count={BRIGHT_COUNT} itemSize={3} />
          <bufferAttribute attach="attributes-aSize" array={sizes} count={BRIGHT_COUNT} itemSize={1} />
          <bufferAttribute attach="attributes-aPhase" array={phases} count={BRIGHT_COUNT} itemSize={1} />
          <bufferAttribute attach="attributes-aColor" array={colors} count={BRIGHT_COUNT} itemSize={3} />
        </bufferGeometry>
        <primitive object={material} ref={materialRef} />
      </points>
    </group>
  );
}

/* ═══════════════════════ Export ═══════════════════════ */

export default function VoidParticles() {
  return (
    <>
      <DustParticles />
      <StarParticles />
      <BrightStars />
    </>
  );
}
