import { createContext, useContext } from 'react';
import * as THREE from 'three';

/* ═══════════════════════ Flight context ═══════════════════════ */

export interface FlightState {
  progress: React.MutableRefObject<number>;
  target: React.MutableRefObject<number>;
  velocity: React.MutableRefObject<number>;
}

export const FlightContext = createContext<FlightState | null>(null);

export function useFlightCtx() {
  const ctx = useContext(FlightContext);
  if (!ctx) throw new Error('Missing FlightContext');
  return ctx;
}

/* ═══════════════════════ Flight path ═══════════════════════ */

/**
 * Camera flight path through the void.
 * The camera follows this CatmullRom spline as the user scrolls.
 */
const PATH_POINTS = [
  new THREE.Vector3(0, 0, 20),         // start — looking into the void
  new THREE.Vector3(0.5, 0.3, 12),     // gentle drift forward
  new THREE.Vector3(2, 1.2, 2),        // curving right
  new THREE.Vector3(3.5, 1.5, -5),     // closest to portal 1 (Constellation)
  new THREE.Vector3(2, 0.8, -14),      // past portal 1
  new THREE.Vector3(-0.5, -0.2, -22),  // transitioning left
  new THREE.Vector3(-3, -0.8, -32),    // curving toward portal 2
  new THREE.Vector3(-3.5, -0.5, -40),  // closest to portal 2 (Crystal Lattice)
  new THREE.Vector3(-1.5, 0.3, -48),   // past portal 2
  new THREE.Vector3(1, 1.5, -56),      // transitioning right
  new THREE.Vector3(2.5, 2.2, -64),    // closest to portal 3 (Nebula)
  new THREE.Vector3(1, 1, -74),        // past portal 3
  new THREE.Vector3(0, 0, -85),        // deep void — end
];

export const flightPath = new THREE.CatmullRomCurve3(
  PATH_POINTS,
  false,
  'catmullrom',
  0.5,
);

/** Approximate scroll progress (0–1) where each portal is closest to the camera. */
export const PORTAL_PROGRESS = [0.25, 0.58, 0.83];
