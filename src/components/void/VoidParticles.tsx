import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* ── Shaders ────────────────────────────────────────────────── */

const dustVertexShader = `
  attribute float aSize;
  attribute float aOpacity;
  varying float vOpacity;
  void main() {
    vOpacity = aOpacity;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (200.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const dustFragmentShader = `
  varying float vOpacity;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.1, d) * vOpacity;
    gl_FragColor = vec4(vec3(0.1, 0.1, 0.18), alpha);
  }
`;

const starVertexShader = `
  attribute float aSize;
  attribute float aOpacity;
  attribute float aFlicker;
  uniform float uTime;
  varying float vOpacity;
  void main() {
    float flick = 1.0 + 0.3 * sin(uTime * aFlicker + aFlicker * 100.0);
    vOpacity = aOpacity * flick;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (150.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const starFragmentShader = `
  varying float vOpacity;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.0, d) * vOpacity;
    gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
  }
`;

/* ── Dust particles — distributed along the flight corridor ── */

const DUST_COUNT = 4000;

function DustParticles() {
  const ref = useRef<THREE.Points>(null);
  const velocities = useRef<Float32Array>(null);

  const { positions, sizes, opacities } = useMemo(() => {
    const pos = new Float32Array(DUST_COUNT * 3);
    const sz = new Float32Array(DUST_COUNT);
    const op = new Float32Array(DUST_COUNT);
    const vel = new Float32Array(DUST_COUNT * 3);

    for (let i = 0; i < DUST_COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;      // x: -20 … 20
      pos[i * 3 + 1] = (Math.random() - 0.5) * 30;  // y: -15 … 15
      pos[i * 3 + 2] = 30 - Math.random() * 130;     // z:  30 … -100
      sz[i] = 1 + Math.random() * 2.5;
      op[i] = 0.1 + Math.random() * 0.2;
      vel[i * 3] = (Math.random() - 0.5) * 0.002;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.002;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.002;
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
      // Brownian drift
      vel[i * 3] += (Math.random() - 0.5) * 0.0003;
      vel[i * 3 + 1] += (Math.random() - 0.5) * 0.0003;
      vel[i * 3 + 2] += (Math.random() - 0.5) * 0.0003;
      // Damping
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

/* ── Stars — spherical shell that follows the camera ── */

const STAR_COUNT = 1500;

function StarParticles() {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const { positions, sizes, opacities, flickers } = useMemo(() => {
    const pos = new Float32Array(STAR_COUNT * 3);
    const sz = new Float32Array(STAR_COUNT);
    const op = new Float32Array(STAR_COUNT);
    const fl = new Float32Array(STAR_COUNT);

    for (let i = 0; i < STAR_COUNT; i++) {
      // Distribute on a spherical shell around origin
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 30 + Math.random() * 25; // radius 30–55
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      sz[i] = 0.5 + Math.random() * 1.2;
      op[i] = 0.12 + Math.random() * 0.25;
      fl[i] = Math.random() * 3 + 0.5;
    }
    return { positions: pos, sizes: sz, opacities: op, flickers: fl };
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
    // Stars follow the camera — always surround the viewer
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
        </bufferGeometry>
        <primitive object={material} ref={materialRef} />
      </points>
    </group>
  );
}

/* ── Export ── */

export default function VoidParticles() {
  return (
    <>
      <DustParticles />
      <StarParticles />
    </>
  );
}
