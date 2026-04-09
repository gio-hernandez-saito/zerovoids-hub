import { Suspense, useCallback, createContext, useContext } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

import VoidCamera from './VoidCamera';
import VoidParticles from './VoidParticles';
import ConstellationPortal from './ConstellationPortal';
import CrystalLattice from './CrystalLattice';
import NebulaCloud from './NebulaCloud';
import PortalLabels from './PortalLabels';
import TransitionOverlay from './TransitionOverlay';
import { usePortalInteraction, PORTALS, type PortalId } from './usePortalInteraction';

type PortalInteraction = ReturnType<typeof usePortalInteraction>;

const PortalContext = createContext<PortalInteraction | null>(null);

function usePortalCtx() {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error('Missing PortalContext');
  return ctx;
}

function Scene() {
  const { hoveredPortal, isTransitioning, handleHover, handleClick } = usePortalCtx();

  const ideas = PORTALS[0];
  const patterns = PORTALS[1];
  const gallery = PORTALS[2];

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
      <VoidCamera />
      <VoidParticles />

      <ConstellationPortal
        position={ideas.position}
        hovered={hoveredPortal === 'ideas'}
        dimmed={hoveredPortal !== null && hoveredPortal !== 'ideas'}
        onHover={makeHover('ideas')}
        onClick={makeClick('ideas')}
        isTransitioning={isTransitioning}
      />
      <CrystalLattice
        position={patterns.position}
        hovered={hoveredPortal === 'patterns'}
        dimmed={hoveredPortal !== null && hoveredPortal !== 'patterns'}
        onHover={makeHover('patterns')}
        onClick={makeClick('patterns')}
        isTransitioning={isTransitioning}
      />
      <NebulaCloud
        position={gallery.position}
        hovered={hoveredPortal === 'gallery'}
        dimmed={hoveredPortal !== null && hoveredPortal !== 'gallery'}
        onHover={makeHover('gallery')}
        onClick={makeClick('gallery')}
        isTransitioning={isTransitioning}
      />

      <PortalLabels hoveredPortal={hoveredPortal} />

      <EffectComposer>
        <Bloom
          intensity={0.4}
          luminanceThreshold={0.6}
          luminanceSmoothing={0.9}
          radius={0.8}
        />
        <ChromaticAberration
          offset={new THREE.Vector2(0.0008, 0.0008) as any}
        />
        <Vignette
          darkness={0.7}
          offset={0.3}
        />
      </EffectComposer>
    </>
  );
}

export default function VoidScene() {
  const interaction = usePortalInteraction();

  return (
    <PortalContext.Provider value={interaction}>
      <div style={{ position: 'fixed', inset: 0, background: '#050508' }}>
        <Canvas
          camera={{ position: [0, 0, 12], fov: 60 }}
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

        {/* HTML labels overlay */}
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
                color: portal.color,
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
                color: portal.color,
                opacity: 0.6,
              }}
            >
              {portal.subtitle}
            </div>
          </div>
        ))}

        <TransitionOverlay active={interaction.isTransitioning} color={interaction.activeTransitionColor} />
      </div>
    </PortalContext.Provider>
  );
}
