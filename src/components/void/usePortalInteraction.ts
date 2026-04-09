import { useState, useCallback, useRef } from 'react';

export type PortalId = 'ideas' | 'patterns' | 'gallery';

export interface PortalConfig {
  id: PortalId;
  label: string;
  subtitle: string;
  color: string;
  url: string;
  position: [number, number, number];
}

export const PORTALS: PortalConfig[] = [
  {
    id: 'ideas',
    label: 'CONSTELLATION',
    subtitle: '18 ideas mapped',
    color: '#4ecdc4',
    url: '/ideas/',
    position: [-3.5, 2, 0],
  },
  {
    id: 'patterns',
    label: 'CRYSTAL LATTICE',
    subtitle: '23 design patterns',
    color: '#ff6b6b',
    url: '/patterns/',
    position: [3.5, 2, 0],
  },
  {
    id: 'gallery',
    label: 'NEBULA',
    subtitle: 'emotional gallery',
    color: '#6c5ce7',
    url: '/gallery/',
    position: [0, -3.5, 0],
  },
];

export function usePortalInteraction() {
  const [hoveredPortal, setHoveredPortal] = useState<PortalId | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeTransitionColor, setActiveTransitionColor] = useState<string | null>(null);
  const navigateRef = useRef<string | null>(null);

  const handleHover = useCallback((id: PortalId | null) => {
    if (!isTransitioning) {
      setHoveredPortal(id);
    }
  }, [isTransitioning]);

  const handleClick = useCallback((id: PortalId) => {
    if (isTransitioning) return;
    const portal = PORTALS.find((p) => p.id === id);
    if (!portal) return;

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
