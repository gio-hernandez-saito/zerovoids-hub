import { useRef, useState, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PORTALS, type PortalId } from './usePortalInteraction';

interface Props {
  hoveredPortal: PortalId | null;
}

interface LabelData {
  x: number;
  y: number;
}

/**
 * Renders inside <Canvas> but projects portal positions to a callback
 * that updates the external HTML labels via DOM manipulation.
 */
export default function PortalLabels({ hoveredPortal }: Props) {
  const { camera, size } = useThree();
  const vec = useRef(new THREE.Vector3());

  useFrame(() => {
    for (const portal of PORTALS) {
      const el = document.querySelector(`[data-portal="${portal.id}"]`) as HTMLElement | null;
      if (!el) continue;

      vec.current.set(...portal.position);
      vec.current.project(camera);

      const x = (vec.current.x * 0.5 + 0.5) * size.width;
      const y = (-vec.current.y * 0.5 + 0.5) * size.height + 70;

      el.style.transform = `translate(-50%, 0) translate(${x}px, ${y}px)`;

      if (hoveredPortal === portal.id) {
        el.style.opacity = '1';
        el.style.pointerEvents = 'none';
      } else {
        el.style.opacity = '0';
      }
    }
  });

  return null;
}
