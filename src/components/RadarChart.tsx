interface Props {
  scores: Record<string, number>;
}

const DIMENSIONS = [
  { key: 'originality', label: '독창성' },
  { key: 'feasibility', label: '실현성' },
  { key: 'market_need', label: '시장성' },
  { key: 'monetization_potential', label: '수익화' },
  { key: 'tech_interest', label: '기술흥미' },
  { key: 'learning_value', label: '학습가치' },
  { key: 'open_source_value', label: 'OSS가치' },
  { key: 'distinctness', label: '차별성' },
];

export default function RadarChart({ scores }: Props) {
  const size = 280;
  const center = size / 2;
  const maxRadius = 110;
  const levels = 5;
  const angleSlice = (Math.PI * 2) / DIMENSIONS.length;

  const getPoint = (angle: number, radius: number) => ({
    x: center + radius * Math.cos(angle - Math.PI / 2),
    y: center + radius * Math.sin(angle - Math.PI / 2),
  });

  // Grid circles
  const gridCircles = Array.from({ length: levels }, (_, i) => {
    const r = (maxRadius / levels) * (i + 1);
    return { r, label: ((10 / levels) * (i + 1)).toFixed(0) };
  });

  // Axes
  const axes = DIMENSIONS.map((dim, i) => {
    const angle = angleSlice * i;
    const end = getPoint(angle, maxRadius);
    const labelPos = getPoint(angle, maxRadius + 20);
    return { ...dim, end, labelPos, angle };
  });

  // Data polygon
  const dataPoints = DIMENSIONS.map((dim, i) => {
    const value = scores[dim.key] || 0;
    const r = (value / 10) * maxRadius;
    return getPoint(angleSlice * i, r);
  });

  const polygonPath = dataPoints.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
  ).join(' ') + ' Z';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Grid */}
      {gridCircles.map(({ r }, i) => (
        <circle
          key={i}
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="#334155"
          strokeWidth={0.5}
          strokeDasharray={i === levels - 1 ? 'none' : '3,3'}
        />
      ))}

      {/* Axes */}
      {axes.map((axis, i) => (
        <g key={i}>
          <line
            x1={center}
            y1={center}
            x2={axis.end.x}
            y2={axis.end.y}
            stroke="#334155"
            strokeWidth={0.5}
          />
          <text
            x={axis.labelPos.x}
            y={axis.labelPos.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="10"
            fill="#94a3b8"
          >
            {axis.label}
          </text>
        </g>
      ))}

      {/* Data polygon fill */}
      <path
        d={polygonPath}
        fill="rgba(56, 189, 248, 0.15)"
        stroke="#38bdf8"
        strokeWidth={2}
      />

      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={4}
          fill="#38bdf8"
          stroke="#0f172a"
          strokeWidth={2}
        />
      ))}

      {/* Score labels on points */}
      {dataPoints.map((p, i) => {
        const value = scores[DIMENSIONS[i].key] || 0;
        return (
          <text
            key={`label-${i}`}
            x={p.x}
            y={p.y - 10}
            textAnchor="middle"
            fontSize="9"
            fontWeight="600"
            fill="#38bdf8"
          >
            {value}
          </text>
        );
      })}
    </svg>
  );
}
