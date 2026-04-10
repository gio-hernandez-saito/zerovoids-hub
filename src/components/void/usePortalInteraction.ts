import { useState, useCallback, useRef, useEffect } from 'react';

export type PortalId = 'ideas' | 'patterns' | 'gallery';

export interface PortalConfig {
  id: PortalId;
  label: string;
  subtitle: string;
  color: string;
  url: string;
  position: [number, number, number];
  disabled?: boolean;
  description: string;
}

export const PORTALS: PortalConfig[] = [
  {
    id: 'ideas',
    label: 'CONSTELLATION',
    subtitle: '18 ideas mapped',
    color: '#4ecdc4',
    url: '/ideas/',
    position: [6, 2, -8],
    description: 'Navigate a living constellation of ideas. Each node is a concept, each edge a connection — explore the network and discover unexpected links.',
  },
  {
    id: 'patterns',
    label: 'CRYSTAL LATTICE',
    subtitle: '23 design patterns',
    color: '#ff6b6b',
    url: '/patterns/',
    position: [-7, -1, -38],
    description: '23 GoF design patterns crystallized in TypeScript. Compare implementations across React, Vue, and Svelte frameworks.',
  },
  {
    id: 'gallery',
    label: 'NEBULA',
    subtitle: 'coming soon',
    color: '#6c5ce7',
    url: '/gallery/',
    position: [5, 3, -68],
    disabled: true,
    description: 'A nebula of visual experiments and creative artifacts. This void is still forming — check back soon.',
  },
];

export function usePortalInteraction() {
  const [hoveredPortal, setHoveredPortal] = useState<PortalId | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeTransitionColor, setActiveTransitionColor] = useState<string | null>(null);
  const navigateRef = useRef<string | null>(null);

  // Reset transition state when restored from bfcache (browser back)
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setIsTransitioning(false);
        setActiveTransitionColor(null);
        setHoveredPortal(null);
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const handleHover = useCallback((id: PortalId | null) => {
    if (!isTransitioning) {
      setHoveredPortal(id);
    }
  }, [isTransitioning]);

  const handleClick = useCallback((id: PortalId) => {
    if (isTransitioning) return;
    const portal = PORTALS.find((p) => p.id === id);
    if (!portal || portal.disabled) return;

    setIsTransitioning(true);
    setActiveTransitionColor(portal.color);
    navigateRef.current = portal.url;

    setTimeout(() => {
      window.location.href = portal.url;
    }, 900);
  }, [isTransitioning]);

  return {
    hoveredPortal,
    isTransitioning,
    activeTransitionColor,
    handleHover,
    handleClick,
  };
}
