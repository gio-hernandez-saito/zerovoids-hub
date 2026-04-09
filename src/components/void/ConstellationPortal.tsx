import { useRef, useMemo, useState } from 'react';
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

// Pre-computed constellation node positions (force-directed-ish layout)
function generateNodes(count: number): THREE.Vector3[] {
  const nodes: THREE.Vector3[] = [];
  const phi = (1 + Math.sqrt(5)) / 2;
  for (let i = 0; i < count; i++) {
    const theta = 2 * Math.PI * i / phi;
    const r = 0.3 + 0.7 * Math.sqrt(i / count);
    const y = (i / (count - 1)) * 1.4 - 0.7;
    nodes.push(new THREE.Vector3(
      Math.cos(theta) * r,
      y,
      Math.sin(theta) * r,
    ));
  }
  return nodes;
}

function generateEdges(nodes: THREE.Vector3[], maxDist: number): [number, number][] {
  const edges: [number, number][] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodes[i].distanceTo(nodes[j]) < maxDist) {
        edges.push([i, j]);
      }
    }
  }
  return edges;
}

export default function ConstellationPortal({ position, hovered, dimmed, onHover, onClick, isTransitioning }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const pulseRef = useRef<THREE.Mesh>(null);
  const [pulseEdge, setPulseEdge] = useState(0);
  const pulseProgress = useRef(0);
  const lastPulseTime = useRef(0);

  const { nodes, edges, linePositions } = useMemo(() => {
    const n = generateNodes(14);
    const e = generateEdges(n, 0.9);
    const lp = new Float32Array(e.length * 6);
    e.forEach(([a, b], i) => {
      lp[i * 6] = n[a].x;
      lp[i * 6 + 1] = n[a].y;
      lp[i * 6 + 2] = n[a].z;
      lp[i * 6 + 3] = n[b].x;
      lp[i * 6 + 4] = n[b].y;
      lp[i * 6 + 5] = n[b].z;
    });
    return { nodes: n, edges: e, linePositions: lp };
  }, []);

  const targetScale = isTransitioning ? 0.01 : hovered ? 1.15 : 1.0;
  const targetBrightness = hovered ? 2.5 : dimmed ? 0.6 : 1.0;
  const currentScale = useRef(1.0);
  const currentBrightness = useRef(1.0);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();

    // Smooth scale/brightness
    currentScale.current += (targetScale - currentScale.current) * 0.08;
    currentBrightness.current += (targetBrightness - currentBrightness.current) * 0.08;
    groupRef.current.scale.setScalar(currentScale.current);

    // Rotate
    groupRef.current.rotation.y = t * 0.1;

    // Pulse along edge
    if (t - lastPulseTime.current > 2.5) {
      lastPulseTime.current = t;
      setPulseEdge(Math.floor(Math.random() * edges.length));
      pulseProgress.current = 0;
    }
    pulseProgress.current += 0.015;
    if (pulseRef.current && edges.length > 0) {
      const [a, b] = edges[pulseEdge] || edges[0];
      const p = Math.min(pulseProgress.current, 1);
      pulseRef.current.position.lerpVectors(nodes[a], nodes[b], p);
      pulseRef.current.visible = p < 1;
    }
  });

  const nodeMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color('#4ecdc4'),
    toneMapped: false,
  }), []);

  const lineMaterial = useMemo(() => new THREE.LineBasicMaterial({
    color: new THREE.Color('#4ecdc4'),
    transparent: true,
    opacity: 0.15,
  }), []);

  const pulseMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color('#7fffd4'),
    toneMapped: false,
  }), []);

  return (
    <group ref={groupRef} position={position}>
      {/* Node points */}
      {nodes.map((n, i) => (
        <mesh key={i} position={[n.x, n.y, n.z]} material={nodeMaterial}>
          <icosahedronGeometry args={[0.04, 1]} />
        </mesh>
      ))}

      {/* Connecting lines */}
      <lineSegments material={lineMaterial}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={linePositions}
            count={edges.length * 2}
            itemSize={3}
          />
        </bufferGeometry>
      </lineSegments>

      {/* Pulse dot */}
      <mesh ref={pulseRef} material={pulseMaterial}>
        <sphereGeometry args={[0.05, 8, 8]} />
      </mesh>

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
