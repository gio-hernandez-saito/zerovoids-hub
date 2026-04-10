import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useFlightCtx } from './useScrollFlight';
import { flightPath } from './useScrollFlight';

const _targetPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();

export default function VoidCamera() {
  const { camera } = useThree();
  const { progress } = useFlightCtx();
  const smoothLookAt = useRef(new THREE.Vector3(0, 0, 15));
  const init = useRef(false);

  useFrame(({ clock, pointer }) => {
    const t = clock.getElapsedTime();
    const p = progress.current;

    // Position on flight path
    flightPath.getPointAt(p, _targetPos);

    // Look ahead on the path
    flightPath.getPointAt(Math.min(p + 0.04, 1), _targetLookAt);

    // Subtle idle float (gentle breathing motion)
    _targetPos.x += Math.sin(t * 0.15) * 0.12;
    _targetPos.y += Math.cos(t * 0.12) * 0.08;

    // Mouse parallax — look direction follows cursor
    _targetLookAt.x += pointer.x * 0.8;
    _targetLookAt.y += pointer.y * 0.5;

    if (!init.current) {
      camera.position.copy(_targetPos);
      smoothLookAt.current.copy(_targetLookAt);
      init.current = true;
    }

    // Smooth camera movement
    camera.position.lerp(_targetPos, 0.06);
    smoothLookAt.current.lerp(_targetLookAt, 0.06);
    camera.lookAt(smoothLookAt.current);
  });

  return null;
}
