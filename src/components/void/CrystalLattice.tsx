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
}

function WireframeSolid({
  geometry,
  color,
  rotationAxis,
  rotationSpeed,
  brightness,
}: {
  geometry: THREE.BufferGeometry;
  color: string;
  rotationAxis: 'x' | 'y' | 'z';
  rotationSpeed: number;
  brightness: number;
}) {
  const ref = useRef<THREE.LineSegments>(null);

  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);
  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [color],
  );

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.rotation[rotationAxis] = t * rotationSpeed;
    material.opacity = 0.5 * brightness + 0.3;
  });

  return <lineSegments ref={ref} geometry={edgesGeo} material={material} />;
}

export default function CrystalLattice({ position, hovered, dimmed, onHover, onClick, isTransitioning }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const currentScale = useRef(1.0);
  const currentBrightness = useRef(1.0);

  const targetScale = isTransitioning ? 0.01 : hovered ? 1.15 : 1.0;
  const targetBrightness = hovered ? 2.5 : dimmed ? 0.6 : 1.0;

  const tetraGeo = useMemo(() => new THREE.TetrahedronGeometry(0.6), []);
  const octaGeo = useMemo(() => new THREE.OctahedronGeometry(1.0), []);
  const icoGeo = useMemo(() => new THREE.IcosahedronGeometry(1.4), []);

  useFrame(() => {
    if (!groupRef.current) return;
    currentScale.current += (targetScale - currentScale.current) * 0.08;
    currentBrightness.current += (targetBrightness - currentBrightness.current) * 0.08;
    groupRef.current.scale.setScalar(currentScale.current);
  });

  return (
    <group ref={groupRef} position={position}>
      <WireframeSolid
        geometry={tetraGeo}
        color="#ff6b6b"
        rotationAxis="x"
        rotationSpeed={0.3}
        brightness={currentBrightness.current}
      />
      <WireframeSolid
        geometry={octaGeo}
        color="#ff8e53"
        rotationAxis="y"
        rotationSpeed={-0.2}
        brightness={currentBrightness.current}
      />
      <WireframeSolid
        geometry={icoGeo}
        color="#ffd93d"
        rotationAxis="z"
        rotationSpeed={0.15}
        brightness={currentBrightness.current}
      />

      {/* Invisible hit target */}
      <mesh
        visible={false}
        onPointerOver={() => onHover(true)}
        onPointerOut={() => onHover(false)}
        onClick={onClick}
      >
        <sphereGeometry args={[1.2, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}
