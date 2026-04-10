import type { PortalConfig } from './usePortalInteraction';

/* ═══════════════════════ Inline preview SVGs ═══════════════════════ */

function ConstellationPreview() {
  return (
    <svg viewBox="0 0 260 130" xmlns="http://www.w3.org/2000/svg" className="card-preview-svg">
      {/* Faint grid */}
      <g stroke="#4ecdc4" strokeWidth="0.3" opacity="0.06">
        {[26, 52, 78, 104].map(y => <line key={y} x1="0" y1={y} x2="260" y2={y} />)}
        {[52, 104, 156, 208].map(x => <line key={x} x1={x} y1="0" x2={x} y2="130" />)}
      </g>
      {/* Network edges */}
      <g stroke="#4ecdc4" strokeWidth="0.8" opacity="0.2">
        <line x1="55" y1="35" x2="130" y2="60" />
        <line x1="130" y1="60" x2="195" y2="28" />
        <line x1="130" y1="60" x2="90" y2="95" />
        <line x1="90" y1="95" x2="170" y2="108" />
        <line x1="195" y1="28" x2="230" y2="72" />
        <line x1="230" y1="72" x2="170" y2="108" />
        <line x1="55" y1="35" x2="35" y2="80" />
        <line x1="35" y1="80" x2="90" y2="95" />
        <line x1="130" y1="60" x2="170" y2="108" />
      </g>
      {/* Glow on hub node */}
      <circle cx="130" cy="60" r="18" fill="#4ecdc4" opacity="0.04" />
      <circle cx="130" cy="60" r="10" fill="#4ecdc4" opacity="0.06" />
      {/* Nodes */}
      <circle cx="55" cy="35" r="3.5" fill="#4ecdc4" opacity="0.8" />
      <circle cx="130" cy="60" r="5" fill="#4ecdc4" />
      <circle cx="195" cy="28" r="3" fill="#4ecdc4" opacity="0.7" />
      <circle cx="90" cy="95" r="3.5" fill="#4ecdc4" opacity="0.8" />
      <circle cx="170" cy="108" r="2.5" fill="#4ecdc4" opacity="0.6" />
      <circle cx="230" cy="72" r="4" fill="#4ecdc4" opacity="0.75" />
      <circle cx="35" cy="80" r="2.5" fill="#4ecdc4" opacity="0.5" />
      {/* Pulse ring on hub */}
      <circle cx="130" cy="60" r="8" fill="none" stroke="#4ecdc4" strokeWidth="0.5" opacity="0.3">
        <animate attributeName="r" values="8;16;8" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0;0.3" dur="3s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function CrystalPreview() {
  return (
    <svg viewBox="0 0 260 130" xmlns="http://www.w3.org/2000/svg" className="card-preview-svg">
      {/* Hexagonal grid */}
      <defs>
        <pattern id="hex" width="30" height="26" patternUnits="userSpaceOnUse">
          <path d="M15 0 L30 7.5 L30 18.5 L15 26 L0 18.5 L0 7.5 Z"
            fill="none" stroke="#ff6b6b" strokeWidth="0.2" opacity="0.08" />
        </pattern>
      </defs>
      <rect width="260" height="130" fill="url(#hex)" />
      {/* Outer icosahedron */}
      <g transform="translate(130, 65)" fill="none" strokeLinejoin="round">
        <polygon points="0,-48 42,24 -42,24" stroke="#ffd93d" strokeWidth="0.6" opacity="0.2" />
        <polygon points="0,48 42,-24 -42,-24" stroke="#ffd93d" strokeWidth="0.6" opacity="0.2" />
      </g>
      {/* Octahedron (center) */}
      <g transform="translate(130, 65)" fill="none" strokeLinejoin="round">
        <polygon points="0,-34 30,0 0,34 -30,0" stroke="#ff6b6b" strokeWidth="1" opacity="0.6" />
        <line x1="0" y1="-34" x2="0" y2="34" stroke="#ff6b6b" strokeWidth="0.6" opacity="0.3" />
        <line x1="-30" y1="0" x2="30" y2="0" stroke="#ff6b6b" strokeWidth="0.6" opacity="0.3" />
      </g>
      {/* Inner tetrahedron */}
      <g transform="translate(130, 65)" fill="none">
        <polygon points="0,-18 15.6,9 -15.6,9" stroke="#ff8e53" strokeWidth="0.8" opacity="0.45" />
        <line x1="0" y1="-18" x2="0" y2="18" stroke="#ff8e53" strokeWidth="0.5" opacity="0.2" />
      </g>
      {/* Vertex highlights */}
      <circle cx="130" cy="31" r="2" fill="#ff6b6b" opacity="0.7" />
      <circle cx="160" cy="65" r="2" fill="#ff6b6b" opacity="0.7" />
      <circle cx="100" cy="65" r="2" fill="#ff6b6b" opacity="0.7" />
      <circle cx="130" cy="99" r="2" fill="#ff6b6b" opacity="0.7" />
      {/* Rotation hint — slow pulse */}
      <g transform="translate(130, 65)">
        <circle r="44" fill="none" stroke="#ff6b6b" strokeWidth="0.3" opacity="0.15" strokeDasharray="4 8">
          <animateTransform attributeName="transform" type="rotate" values="0;360" dur="20s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  );
}

function NebulaPreview() {
  // Generate deterministic "random" particle positions
  const particles: { cx: number; cy: number; r: number; o: number }[] = [];
  for (let i = 0; i < 60; i++) {
    const seed = i * 7.31 + 2.17;
    particles.push({
      cx: ((seed * 131.7) % 240) + 10,
      cy: ((seed * 97.3) % 110) + 10,
      r: 0.5 + (seed % 2),
      o: 0.1 + ((seed * 3.7) % 0.3),
    });
  }

  return (
    <svg viewBox="0 0 260 130" xmlns="http://www.w3.org/2000/svg" className="card-preview-svg">
      {/* Particles */}
      <g>
        {particles.map((p, i) => (
          <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill="#6c5ce7" opacity={p.o} />
        ))}
      </g>
      {/* Central glow */}
      <circle cx="130" cy="65" r="40" fill="#6c5ce7" opacity="0.04" />
      <circle cx="130" cy="65" r="25" fill="#a29bfe" opacity="0.03" />
      {/* SEALED overlay */}
      <rect x="80" y="48" width="100" height="34" rx="2" fill="none"
        stroke="#6c5ce7" strokeWidth="1" opacity="0.25" strokeDasharray="3 3" />
      <text x="130" y="70" textAnchor="middle" fontFamily="'JetBrains Mono', monospace"
        fontSize="10" letterSpacing="0.3em" fill="#6c5ce7" opacity="0.4">
        SEALED
      </text>
    </svg>
  );
}

/* ═══════════════════════ Card component ═══════════════════════ */

const PREVIEWS: Record<string, () => JSX.Element> = {
  ideas: ConstellationPreview,
  patterns: CrystalPreview,
  gallery: NebulaPreview,
};

interface Props {
  portal: PortalConfig | null;
  visible: boolean;
  onClick: () => void;
}

export default function PortalCard({ portal, visible, onClick }: Props) {
  if (!portal) return null;

  const Preview = PREVIEWS[portal.id];
  const color = portal.color;
  const dimColor = portal.disabled ? '#333' : color;

  return (
    <div
      data-portal-card
      className={`portal-card portal-card--${portal.id} ${visible ? 'portal-card--visible' : ''}`}
      style={{ '--pc': color, '--pc-dim': dimColor } as React.CSSProperties}
    >
      {/* Scanlines overlay */}
      <div className="card-scanlines" />

      {/* Corner brackets */}
      <svg className="card-corners" viewBox="0 0 260 300" preserveAspectRatio="none">
        {/* TL */}
        <polyline points="0,20 0,0 20,0" fill="none" stroke={dimColor} strokeWidth="1" opacity="0.5" />
        {/* TR */}
        <polyline points="240,0 260,0 260,20" fill="none" stroke={dimColor} strokeWidth="1" opacity="0.5" />
        {/* BL */}
        <polyline points="0,280 0,300 20,300" fill="none" stroke={dimColor} strokeWidth="1" opacity="0.5" />
        {/* BR */}
        <polyline points="240,300 260,300 260,280" fill="none" stroke={dimColor} strokeWidth="1" opacity="0.5" />
      </svg>

      {/* Header */}
      <div className="card-header">
        <span className="card-status" />
        <span className="card-label">{portal.label}</span>
      </div>

      <div className="card-subtitle">{portal.subtitle}</div>

      {/* Divider */}
      <div className="card-divider" />

      {/* Preview */}
      <div className="card-preview">
        {Preview && <Preview />}
      </div>

      {/* Description */}
      <p className="card-desc">{portal.description}</p>

      {/* CTA */}
      {!portal.disabled ? (
        <button className="card-cta" onClick={onClick}>
          <span className="cta-text">ENTER VOID</span>
          <span className="cta-arrow">&#8594;</span>
        </button>
      ) : (
        <div className="card-sealed">AWAITING FORMATION</div>
      )}
    </div>
  );
}
