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
}

export const PORTALS: PortalConfig[] = [
  {
    id: 'ideas',
    label: 'CONSTELLATION',
    subtitle: '18 ideas mapped',
    color: '#4ecdc4',
    url: '/ideas/',
    position: [6, 2, -8],
  },
  {
    id: 'patterns',
    label: 'CRYSTAL LATTICE',
    subtitle: '23 design patterns',
    color: '#ff6b6b',
    url: '/patterns/',
    position: [-7, -1, -38],
  },
  {
    id: 'gallery',
    label: 'NEBULA',
    subtitle: 'coming soon',
    color: '#6c5ce7',
    url: '/gallery/',
    position: [5, 3, -68],
    disabled: true,
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
