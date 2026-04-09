import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

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

function DustParticles() {
  const ref = useRef<THREE.Points>(null);
  const velocities = useRef<Float32Array>(null);

  const { positions, sizes, opacities } = useMemo(() => {
    const count = 2000;
    const pos = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    const op = new Float32Array(count);
    const vel = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 30;
      sz[i] = 1 + Math.random() * 2;
      op[i] = 0.15 + Math.random() * 0.25;
      vel[i * 3] = (Math.random() - 0.5) * 0.003;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.003;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.003;
    }
    velocities.current = vel;
    return { positions: pos, sizes: sz, opacities: op };
  }, []);

  useFrame(() => {
    if (!ref.current || !velocities.current) return;
    const posAttr = ref.current.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const vel = velocities.current;
    for (let i = 0; i < 2000; i++) {
      // Brownian drift
      vel[i * 3] += (Math.random() - 0.5) * 0.0004;
      vel[i * 3 + 1] += (Math.random() - 0.5) * 0.0004;
      vel[i * 3 + 2] += (Math.random() - 0.5) * 0.0004;
      // Damping
      vel[i * 3] *= 0.99;
      vel[i * 3 + 1] *= 0.99;
      vel[i * 3 + 2] *= 0.99;

      arr[i * 3] += vel[i * 3];
      arr[i * 3 + 1] += vel[i * 3 + 1];
      arr[i * 3 + 2] += vel[i * 3 + 2];

      // Wrap around
      for (let j = 0; j < 3; j++) {
        const limit = j === 2 ? 15 : 20;
        if (arr[i * 3 + j] > limit) arr[i * 3 + j] = -limit;
        if (arr[i * 3 + j] < -limit) arr[i * 3 + j] = limit;
      }
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
        <bufferAttribute attach="attributes-position" array={positions} count={2000} itemSize={3} />
        <bufferAttribute attach="attributes-aSize" array={sizes} count={2000} itemSize={1} />
        <bufferAttribute attach="attributes-aOpacity" array={opacities} count={2000} itemSize={1} />
      </bufferGeometry>
    </points>
  );
}

function StarParticles() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const { positions, sizes, opacities, flickers } = useMemo(() => {
    const count = 800;
    const pos = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    const op = new Float32Array(count);
    const fl = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 50;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 50;
      pos[i * 3 + 2] = -10 - Math.random() * 20;
      sz[i] = 0.5 + Math.random() * 1.0;
      op[i] = 0.1 + Math.random() * 0.2;
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

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <points material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={800} itemSize={3} />
        <bufferAttribute attach="attributes-aSize" array={sizes} count={800} itemSize={1} />
        <bufferAttribute attach="attributes-aOpacity" array={opacities} count={800} itemSize={1} />
        <bufferAttribute attach="attributes-aFlicker" array={flickers} count={800} itemSize={1} />
      </bufferGeometry>
      <primitive object={material} ref={materialRef} />
    </points>
  );
}

export default function VoidParticles() {
  return (
    <>
      <DustParticles />
      <StarParticles />
    </>
  );
}
