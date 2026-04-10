import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Props {
  position: [number, number, number];
  hovered: boolean;
  dimmed: boolean;
  onHover: (state: boolean) => void;
  onClick: () => void;
  isTransitioning: boolean;
  disabled?: boolean;
}

const nebulaVertexShader = `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aPhase;
  attribute vec3 aOrbitAxis;
  attribute float aOrbitSpeed;
  attribute float aRadius;
  uniform float uTime;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;

  // Rodrigues rotation
  vec3 rotateAround(vec3 v, vec3 axis, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
  }

  void main() {
    float angle = uTime * aOrbitSpeed + aPhase;
    vec3 basePos = vec3(aRadius, 0.0, 0.0);
    vec3 pos = rotateAround(basePos, normalize(aOrbitAxis), angle);
    pos *= uScale;

    float sizeOsc = 1.0 + 0.3 * sin(uTime * 2.0 + aPhase);
    vColor = aColor;
    vAlpha = 0.6 + 0.2 * sin(uTime * 1.5 + aPhase);

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * sizeOsc * (200.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const nebulaFragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.05, d) * vAlpha;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

const COLORS = [
  new THREE.Color('#6c5ce7'),
  new THREE.Color('#a29bfe'),
  new THREE.Color('#fd79a8'),
];

const DISABLED_COLORS = [
  new THREE.Color('#3a3a3a'),
  new THREE.Color('#4a4a4a'),
  new THREE.Color('#333333'),
];

export default function NebulaCloud({ position, hovered, dimmed, onHover, onClick, isTransitioning, disabled }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const currentScale = useRef(1.0);
  const currentBrightness = useRef(1.0);

  const targetScale = isTransitioning ? 0.01 : (!disabled && hovered) ? 1.15 : disabled ? 0.85 : 1.0;
  const targetBrightness = disabled ? 0.3 : hovered ? 2.5 : dimmed ? 0.6 : 1.0;

  const { positions, sizes, colors, phases, orbitAxes, orbitSpeeds, radii } = useMemo(() => {
    const count = 400;
    const pos = new Float32Array(count * 3); // dummy, computed in shader
    const sz = new Float32Array(count);
    const col = new Float32Array(count * 3);
    const ph = new Float32Array(count);
    const axes = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    const rad = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      pos[i * 3] = 0;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = 0;

      sz[i] = 2 + Math.random() * 4;
      ph[i] = Math.random() * Math.PI * 2;
      spd[i] = 0.2 + Math.random() * 0.4;
      rad[i] = Math.random() * 0.8;

      // Random orbit axis
      const ax = Math.random() - 0.5;
      const ay = Math.random() - 0.5;
      const az = Math.random() - 0.5;
      const len = Math.sqrt(ax * ax + ay * ay + az * az);
      axes[i * 3] = ax / len;
      axes[i * 3 + 1] = ay / len;
      axes[i * 3 + 2] = az / len;

      const palette = disabled ? DISABLED_COLORS : COLORS;
      const c = palette[Math.floor(Math.random() * palette.length)];
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return { positions: pos, sizes: sz, colors: col, phases: ph, orbitAxes: axes, orbitSpeeds: spd, radii: rad };
  }, [disabled]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: nebulaVertexShader,
        fragmentShader: nebulaFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uScale: { value: 1 },
        },
      }),
    [],
  );

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();

    currentScale.current += (targetScale - currentScale.current) * 0.08;
    currentBrightness.current += (targetBrightness - currentBrightness.current) * 0.08;
    groupRef.current.scale.setScalar(currentScale.current);

    // Breathing
    const breathe = 0.95 + 0.1 * (0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 6)));
    material.uniforms.uTime.value = t;
    material.uniforms.uScale.value = breathe;
  });

  return (
    <group ref={groupRef} position={position}>
      <points material={material}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" array={positions} count={400} itemSize={3} />
          <bufferAttribute attach="attributes-aSize" array={sizes} count={400} itemSize={1} />
          <bufferAttribute attach="attributes-aColor" array={colors} count={400} itemSize={3} />
          <bufferAttribute attach="attributes-aPhase" array={phases} count={400} itemSize={1} />
          <bufferAttribute attach="attributes-aOrbitAxis" array={orbitAxes} count={400} itemSize={3} />
          <bufferAttribute attach="attributes-aOrbitSpeed" array={orbitSpeeds} count={400} itemSize={1} />
          <bufferAttribute attach="attributes-aRadius" array={radii} count={400} itemSize={1} />
        </bufferGeometry>
        <primitive object={material} ref={materialRef} />
      </points>

      {/* Invisible hit target */}
      <mesh
        visible={false}
        onPointerOver={disabled ? undefined : () => onHover(true)}
        onPointerOut={disabled ? undefined : () => onHover(false)}
        onClick={disabled ? undefined : onClick}
        raycast={disabled ? () => {} : undefined}
      >
        <sphereGeometry args={[1.2, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}
