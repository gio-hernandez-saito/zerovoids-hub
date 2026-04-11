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
  new THREE.Vector3(0, 0, -85),        // entering constellation stretch
  // Constellation stretch — camera drifts past 3 figures (chester → lincecum → me)
  new THREE.Vector3(0.6, 0.3, -93),
  new THREE.Vector3(-0.6, 0.4, -103),
  new THREE.Vector3(0.4, 0.2, -113),
  new THREE.Vector3(0, 0, -125),       // final viewing position
];

export const flightPath = new THREE.CatmullRomCurve3(
  PATH_POINTS,
  false,
  'catmullrom',
  0.5,
);

/** Scroll progress (0–1) — slightly before closest approach so the portal is visible ahead.
 *  Recomputed after extending the flight path with the constellation stretch (old ÷ new total). */
export const PORTAL_PROGRESS = [0.175, 0.400, 0.620];

/** Scroll progress for each constellation figure's reveal moment. */
export const CONSTELLATION_PROGRESS = [0.74, 0.86, 0.97];
