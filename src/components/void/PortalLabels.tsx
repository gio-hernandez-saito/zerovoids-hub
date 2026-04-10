import { useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PORTALS, type PortalId } from './usePortalInteraction';

interface Props {
  hoveredPortal: PortalId | null;
}

/**
 * Projects portal 3D positions to screen-space and drives the
 * HTML label overlays via direct DOM manipulation.
 *
 * Labels appear on hover OR when the camera is within proximity.
 */
export default function PortalLabels({ hoveredPortal }: Props) {
  const { camera, size } = useThree();
  const vec = useRef(new THREE.Vector3());

  useFrame(() => {
    for (const portal of PORTALS) {
      const el = document.querySelector(`[data-portal="${portal.id}"]`) as HTMLElement | null;
      if (!el) continue;

      vec.current.set(...portal.position);

      // Distance from camera to portal (before projection)
      const dist = vec.current.distanceTo(camera.position);

      // Project to screen
      vec.current.project(camera);

      // Behind camera check
      const isBehind = vec.current.z > 1;

      const x = (vec.current.x * 0.5 + 0.5) * size.width;
      const y = (-vec.current.y * 0.5 + 0.5) * size.height + 50;

      el.style.transform = `translate(-50%, 0) translate(${x}px, ${y}px)`;

      if (isBehind) {
        el.style.opacity = '0';
      } else if (hoveredPortal === portal.id) {
        // Hovered — full visibility
        el.style.opacity = portal.disabled ? '0.4' : '1';
      } else if (dist < 14) {
        // Proximity-based fade: full at dist≤6, zero at dist≥14
        const fade = 1 - Math.max(0, dist - 6) / 8;
        const maxOpacity = portal.disabled ? 0.4 : 0.7;
        el.style.opacity = String(Math.max(0, fade * maxOpacity).toFixed(3));
      } else {
        el.style.opacity = '0';
      }
    }
  });

  return null;
}
