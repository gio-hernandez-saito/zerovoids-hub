import {
  Suspense,
  useCallback,
  createContext,
  useContext,
  useRef,
  useMemo,
  useEffect,
  useState,
  type MutableRefObject,
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Vignette,
} from '@react-three/postprocessing';
import * as THREE from 'three';

import VoidCamera from './VoidCamera';
import VoidParticles from './VoidParticles';
import ConstellationPortal from './ConstellationPortal';
import CrystalLattice from './CrystalLattice';
import NebulaCloud from './NebulaCloud';
import PortalLabels from './PortalLabels';
import TransitionOverlay from './TransitionOverlay';
import {
  usePortalInteraction,
  PORTALS,
  type PortalId,
} from './usePortalInteraction';
import { PORTAL_PROGRESS, FlightContext, useFlightCtx, type FlightState } from './useScrollFlight';

/* ═══════════════════════ Contexts ═══════════════════════ */

type PortalInteraction = ReturnType<typeof usePortalInteraction>;
const PortalContext = createContext<PortalInteraction | null>(null);

export function usePortalCtx() {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error('Missing PortalContext');
  return ctx;
}

/* ═══════════════════════ Flight controller ═══════════════════════ */

/** Runs inside Canvas — lerps scroll progress toward target each frame. */
function FlightController() {
  const { progress, target, velocity } = useFlightCtx();
  useFrame(() => {
    const prev = progress.current;
    progress.current += (target.current - progress.current) * 0.05;
    velocity.current = progress.current - prev;
  });
  return null;
}

/* ═══════════════════════ Space rings (decoration) ═══════════════════════ */

const RINGS = [
  { pos: [1, 0.5, 6] as const, rot: [0.3, 0.5, 0] as const, size: 2.5, color: '#4ecdc4' },
  { pos: [-2, -0.5, -18] as const, rot: [0.8, 0.2, 0.4] as const, size: 3.5, color: '#ff6b6b' },
  { pos: [0.5, 1, -50] as const, rot: [0.1, 0.7, 0.3] as const, size: 3, color: '#6c5ce7' },
  { pos: [-1, 0, -72] as const, rot: [0.5, 0.3, 0.7] as const, size: 2, color: '#4ecdc4' },
];

function SpaceRing({
  pos,
  rot,
  size,
  color,
}: {
  pos: readonly [number, number, number];
  rot: readonly [number, number, number];
  size: number;
  color: string;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.06,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [color],
  );

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.z = clock.getElapsedTime() * 0.04;
    }
  });

  return (
    <mesh
      ref={ref}
      position={[pos[0], pos[1], pos[2]]}
      rotation={[rot[0], rot[1], rot[2]]}
      material={material}
    >
      <torusGeometry args={[size, 0.015, 16, 64]} />
    </mesh>
  );
}

function SpaceRings() {
  return (
    <>
      {RINGS.map((r, i) => (
        <SpaceRing key={i} {...r} />
      ))}
    </>
  );
}

/* ═══════════════════════ Scene (inside Canvas) ═══════════════════════ */

function Scene() {
  const { hoveredPortal, isTransitioning, handleHover, handleClick } =
    usePortalCtx();

  const makeHover = useCallback(
    (id: PortalId) => (state: boolean) => handleHover(state ? id : null),
    [handleHover],
  );
  const makeClick = useCallback(
    (id: PortalId) => () => handleClick(id),
    [handleClick],
  );

  return (
    <>
      <FlightController />
      <VoidCamera />
      <VoidParticles />
      <SpaceRings />

      <ConstellationPortal
        position={PORTALS[0].position}
        hovered={hoveredPortal === 'ideas'}
        dimmed={hoveredPortal !== null && hoveredPortal !== 'ideas'}
        onHover={makeHover('ideas')}
        onClick={makeClick('ideas')}
        isTransitioning={isTransitioning}
      />
      <CrystalLattice
        position={PORTALS[1].position}
        hovered={hoveredPortal === 'patterns'}
        dimmed={hoveredPortal !== null && hoveredPortal !== 'patterns'}
        onHover={makeHover('patterns')}
        onClick={makeClick('patterns')}
        isTransitioning={isTransitioning}
      />
      <NebulaCloud
        position={PORTALS[2].position}
        hovered={hoveredPortal === 'gallery'}
        dimmed={hoveredPortal !== null && hoveredPortal !== 'gallery'}
        onHover={makeHover('gallery')}
        onClick={makeClick('gallery')}
        isTransitioning={isTransitioning}
        disabled={PORTALS[2].disabled}
      />

      <PortalLabels hoveredPortal={hoveredPortal} />

      <EffectComposer>
        <Bloom
          intensity={0.5}
          luminanceThreshold={0.5}
          luminanceSmoothing={0.9}
          radius={0.8}
        />
        <ChromaticAberration
          offset={new THREE.Vector2(0.0008, 0.0008) as any}
        />
        <Vignette darkness={0.7} offset={0.3} />
      </EffectComposer>
    </>
  );
}

/* ═══════════════════════ Scroll indicator ═══════════════════════ */

function ScrollIndicator({ flight }: { flight: FlightState }) {
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf: number;
    const update = () => {
      if (dotRef.current) {
        dotRef.current.style.top = `${flight.progress.current * 100}%`;
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [flight]);

  return (
    <div className="scroll-indicator">
      <div className="scroll-track">
        {PORTAL_PROGRESS.map((pos, i) => (
          <div
            key={PORTALS[i].id}
            className="scroll-waypoint"
            style={{ top: `${pos * 100}%` }}
          >
            <div
              className="waypoint-dot"
              style={{
                background: PORTALS[i].disabled ? '#555' : PORTALS[i].color,
              }}
            />
            <span
              className="waypoint-label"
              style={{
                color: PORTALS[i].disabled ? '#555' : PORTALS[i].color,
              }}
            >
              {PORTALS[i].label}
            </span>
          </div>
        ))}
        <div ref={dotRef} className="scroll-current" />
      </div>
    </div>
  );
}

/* ═══════════════════════ Main export ═══════════════════════ */

export default function VoidScene() {
  const interaction = usePortalInteraction();
  const progress = useRef(0);
  const target = useRef(0);
  const velocity = useRef(0);
  const flight = useMemo<FlightState>(
    () => ({ progress, target, velocity }),
    [],
  );

  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    let hasScrolled = false;

    const hideHint = () => {
      if (!hasScrolled) {
        hasScrolled = true;
        setShowHint(false);
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 40;
      if (e.deltaMode === 2) delta *= 800;
      target.current = Math.max(
        0,
        Math.min(1, target.current + delta * 0.0004),
      );
      hideHint();
    };

    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const dy = touchY - e.touches[0].clientY;
      touchY = e.touches[0].clientY;
      target.current = Math.max(
        0,
        Math.min(1, target.current + dy * 0.002),
      );
      hideHint();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        target.current = Math.min(1, target.current + 0.03);
        hideHint();
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        target.current = Math.max(0, target.current - 0.03);
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <FlightContext.Provider value={flight}>
      <PortalContext.Provider value={interaction}>
        <div style={{ position: 'fixed', inset: 0, background: '#050508' }}>
          <Canvas
            camera={{ position: [0, 0, 20], fov: 60 }}
            gl={{ antialias: true, alpha: false }}
            dpr={[1, 2]}
            onCreated={({ scene }) => {
              scene.background = new THREE.Color('#050508');
            }}
            style={{ width: '100%', height: '100%' }}
          >
            <Suspense fallback={null}>
              <Scene />
            </Suspense>
          </Canvas>

          {/* HTML portal labels */}
          {PORTALS.map((portal) => (
            <div
              key={portal.id}
              data-portal={portal.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                opacity: 0,
                transition: 'opacity 0.3s ease',
                pointerEvents: 'none',
                textAlign: 'center',
                fontFamily: "'JetBrains Mono', monospace",
                zIndex: 10,
              }}
            >
              <div
                style={{
                  fontSize: '0.75rem',
                  letterSpacing: '0.3em',
                  textTransform: 'uppercase' as const,
                  color: portal.disabled ? '#555' : portal.color,
                  marginBottom: '0.25rem',
                }}
              >
                {portal.label}
              </div>
              <div
                style={{
                  fontSize: '0.6rem',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase' as const,
                  color: portal.disabled ? '#444' : portal.color,
                  opacity: 0.6,
                }}
              >
                {portal.subtitle}
              </div>
            </div>
          ))}

          <TransitionOverlay
            active={interaction.isTransitioning}
            color={interaction.activeTransitionColor}
          />

          {/* Scroll hint */}
          <div
            className="scroll-hint"
            style={{
              opacity: showHint ? 1 : 0,
              pointerEvents: 'none',
              transition: 'opacity 1.5s ease',
            }}
          >
            <div className="scroll-hint-mouse" />
            <span className="scroll-hint-text">SCROLL TO EXPLORE</span>
          </div>

          <ScrollIndicator flight={flight} />
        </div>
      </PortalContext.Provider>
    </FlightContext.Provider>
  );
}
