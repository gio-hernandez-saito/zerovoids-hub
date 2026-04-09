import { useEffect, useState } from 'react';

interface Props {
  active: boolean;
  color: string | null;
}

export default function TransitionOverlay({ active, color }: Props) {
  const [phase, setPhase] = useState<'idle' | 'color' | 'white'>('idle');

  useEffect(() => {
    if (!active || !color) {
      setPhase('idle');
      return;
    }
    setPhase('color');
    const timer = setTimeout(() => setPhase('white'), 500);
    return () => clearTimeout(timer);
  }, [active, color]);

  if (phase === 'idle') return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        pointerEvents: 'none',
        backgroundColor: phase === 'white' ? '#ffffff' : (color || '#000000'),
        opacity: phase === 'idle' ? 0 : 1,
        transition: 'background-color 0.4s ease, opacity 0.2s ease',
      }}
    />
  );
}
