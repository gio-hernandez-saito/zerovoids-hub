import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface NetworkNode {
  id: string;
  type: 'idea' | 'tag';
  label: string;
  category?: string;
  score?: number;
  count?: number;
  index?: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface NetworkLink {
  source: string | NetworkNode;
  target: string | NetworkNode;
}

interface NetworkData {
  nodes: NetworkNode[];
  links: NetworkLink[];
}

const CATEGORY_COLORS: Record<string, string> = {
  automation: '#10b981',
  visualization: '#3b82f6',
  frontend: '#8b5cf6',
  'developer-tool': '#f59e0b',
  gaming: '#ef4444',
  creative: '#ec4899',
  utility: '#06b6d4',
  experimental: '#f97316',
  data: '#14b8a6',
  infrastructure: '#6366f1',
  learning: '#84cc16',
  entertainment: '#e879f9',
  unknown: '#64748b',
};

interface Props {
  data: NetworkData;
}

/**
 * Orthogonal path generator — creates cable-tidy vertical/horizontal routes
 * from source node to target node with a single midpoint bend.
 */
function orthogonalPath(sx: number, sy: number, tx: number, ty: number): string {
  const midY = (sy + ty) / 2;
  return `M ${sx} ${sy} L ${sx} ${midY} L ${tx} ${midY} L ${tx} ${ty}`;
}

export default function NetworkGraph({ data }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Defs for glow filter and gradients
    const defs = svg.append('defs');

    // Glow filter for idea nodes
    const glow = defs.append('filter').attr('id', 'glow');
    glow.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
    glow.append('feMerge').selectAll('feMergeNode')
      .data(['blur', 'SourceGraphic'])
      .join('feMergeNode')
      .attr('in', (d) => d);

    // Subtle glow for links on hover
    const linkGlow = defs.append('filter').attr('id', 'link-glow');
    linkGlow.append('feGaussianBlur').attr('stdDeviation', '2').attr('result', 'blur');
    linkGlow.append('feMerge').selectAll('feMergeNode')
      .data(['blur', 'SourceGraphic'])
      .join('feMergeNode')
      .attr('in', (d) => d);

    const g = svg.append('g');

    // Zoom + pan
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);

    // Clone data
    const nodes: NetworkNode[] = data.nodes.map(d => ({ ...d }));
    const links: NetworkLink[] = data.links.map(d => ({ ...d }));

    // Force simulation — stronger repulsion + collision for clean spacing
    const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(links as d3.SimulationLinkDatum<d3.SimulationNodeDatum>[])
        .id((d: any) => d.id)
        .distance((d: any) => {
          const s = d.source as NetworkNode;
          const t = d.target as NetworkNode;
          if (s.type === 'idea' && t.type === 'tag') return 120;
          return 80;
        })
        .strength(0.3)
      )
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d: any) =>
        d.type === 'idea' ? 40 : 25
      ))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05))
      .alphaDecay(0.02)
      .velocityDecay(0.4);

    // --- Links: orthogonal paths ---
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('path')
      .data(links)
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', '#334155')
      .attr('stroke-opacity', 0.35)
      .attr('stroke-width', 1.5)
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round');

    // --- Nodes ---
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(d3.drag<SVGGElement, NetworkNode>()
        .on('start', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d: any) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }) as any
      );

    // Idea nodes: rounded rect with glow
    node.filter((d) => d.type === 'idea')
      .append('rect')
      .attr('width', 36)
      .attr('height', 36)
      .attr('x', -18)
      .attr('y', -18)
      .attr('rx', 8)
      .attr('ry', 8)
      .attr('fill', (d) => CATEGORY_COLORS[d.category || 'unknown'] || '#64748b')
      .attr('stroke', (d) => {
        const color = CATEGORY_COLORS[d.category || 'unknown'] || '#64748b';
        return d3.color(color)?.brighter(0.5)?.formatHex() || color;
      })
      .attr('stroke-width', 2)
      .attr('filter', 'url(#glow)')
      .attr('opacity', 0.95);

    // Tag nodes: small circles
    node.filter((d) => d.type === 'tag')
      .append('circle')
      .attr('r', (d) => 6 + (d.count || 1) * 2)
      .attr('fill', '#1e293b')
      .attr('stroke', '#475569')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.9);

    // Tag count badge
    node.filter((d) => d.type === 'tag' && (d.count || 0) > 1)
      .append('text')
      .text((d) => String(d.count))
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '9px')
      .attr('fill', '#94a3b8')
      .attr('font-weight', '600')
      .attr('font-family', 'Fira Code, monospace')
      .attr('pointer-events', 'none');

    // Idea index label inside rect
    node.filter((d) => d.type === 'idea')
      .append('text')
      .text((d) => `#${String(d.ideaIndex).padStart(4, '0')}`)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '8px')
      .attr('fill', '#fff')
      .attr('font-weight', '700')
      .attr('font-family', 'Fira Code, monospace')
      .attr('pointer-events', 'none');

    // Labels below nodes
    node.append('text')
      .text((d) => {
        if (d.type === 'tag') return d.label;
        const label = d.label || '';
        return label.length > 14 ? label.slice(0, 14) + '\u2026' : label;
      })
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => d.type === 'idea' ? 32 : (6 + (d.count || 1) * 2) + 14)
      .attr('font-size', (d) => d.type === 'idea' ? '10px' : '9px')
      .attr('fill', (d) => d.type === 'idea' ? '#e2e8f0' : '#64748b')
      .attr('font-family', 'Inter, sans-serif')
      .attr('font-weight', (d) => d.type === 'idea' ? '500' : '400')
      .attr('pointer-events', 'none');

    // === Interactions ===

    // Hover: highlight connected nodes + links
    node.on('mouseenter', (event, d) => {
      const connected = new Set<string>();
      connected.add(d.id);
      links.forEach((l: any) => {
        const src = typeof l.source === 'object' ? l.source.id : l.source;
        const tgt = typeof l.target === 'object' ? l.target.id : l.target;
        if (src === d.id) connected.add(tgt);
        if (tgt === d.id) connected.add(src);
      });

      // Dim non-connected
      node.select('rect').attr('opacity', (n) => connected.has(n.id) ? 1 : 0.15);
      node.select('circle').attr('opacity', (n) => connected.has(n.id) ? 1 : 0.15);
      node.selectAll('text').attr('opacity', (n: any) => connected.has(n.id) ? 1 : 0.1);

      // Highlight connected links
      link
        .attr('stroke', (l: any) => {
          const src = typeof l.source === 'object' ? l.source.id : l.source;
          const tgt = typeof l.target === 'object' ? l.target.id : l.target;
          if (connected.has(src) && connected.has(tgt)) {
            // Color link by the idea node's category
            const ideaNode = [l.source, l.target].find((n: any) =>
              (typeof n === 'object' ? n.type : '') === 'idea'
            ) as NetworkNode | undefined;
            return CATEGORY_COLORS[ideaNode?.category || 'unknown'] || '#38bdf8';
          }
          return '#334155';
        })
        .attr('stroke-opacity', (l: any) => {
          const src = typeof l.source === 'object' ? l.source.id : l.source;
          const tgt = typeof l.target === 'object' ? l.target.id : l.target;
          return connected.has(src) && connected.has(tgt) ? 0.8 : 0.05;
        })
        .attr('stroke-width', (l: any) => {
          const src = typeof l.source === 'object' ? l.source.id : l.source;
          const tgt = typeof l.target === 'object' ? l.target.id : l.target;
          return connected.has(src) && connected.has(tgt) ? 2.5 : 1.5;
        })
        .attr('filter', (l: any) => {
          const src = typeof l.source === 'object' ? l.source.id : l.source;
          const tgt = typeof l.target === 'object' ? l.target.id : l.target;
          return connected.has(src) && connected.has(tgt) ? 'url(#link-glow)' : 'none';
        });

      // Tooltip
      const rect = svgRef.current!.getBoundingClientRect();
      const text = d.type === 'idea'
        ? `${d.label}\nScore: ${d.score?.toFixed(1) || 'N/A'}\nCategory: ${d.category}`
        : `#${d.label} (${d.count} ideas)`;
      setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top - 15, text });
    });

    node.on('mouseleave', () => {
      // Reset all
      node.select('rect').attr('opacity', 0.95);
      node.select('circle').attr('opacity', 0.9);
      node.selectAll('text').attr('opacity', 1);
      link
        .attr('stroke', '#334155')
        .attr('stroke-opacity', 0.35)
        .attr('stroke-width', 1.5)
        .attr('filter', 'none');
      setTooltip(null);
    });

    // Click: navigate to idea detail page
    node.on('click', (event, d) => {
      event.stopPropagation();
      if (d.type === 'idea') {
        window.location.href = `/ideas/${String(d.ideaIndex).padStart(4, '0')}/`;
      }
    });

    // Double-click background to reset zoom
    svg.on('dblclick.zoom', null);
    svg.on('dblclick', () => {
      svg.transition().duration(500).call(
        zoom.transform,
        d3.zoomIdentity.translate(width / 2, height / 2).scale(1).translate(-width / 2, -height / 2)
      );
    });

    // === Tick: update positions with orthogonal paths ===
    simulation.on('tick', () => {
      link.attr('d', (d: any) =>
        orthogonalPath(d.source.x, d.source.y, d.target.x, d.target.y)
      );
      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    // Run simulation for a bit then cool down for cleaner initial layout
    simulation.alpha(1).restart();

    return () => { simulation.stop(); };
  }, [data]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '600px' }}>
      <svg
        ref={svgRef}
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #0f172a 0%, #0c1222 100%)',
          borderRadius: '12px',
          border: '1px solid #1e293b',
        }}
      />
      {tooltip && (
        <div style={{
          position: 'absolute',
          left: tooltip.x,
          top: tooltip.y,
          transform: 'translate(-50%, -100%)',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid #475569',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '12px',
          color: '#e2e8f0',
          whiteSpace: 'pre-line',
          pointerEvents: 'none',
          zIndex: 10,
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          {tooltip.text}
        </div>
      )}
      <div style={{
        position: 'absolute',
        bottom: '12px',
        right: '12px',
        display: 'flex',
        gap: '8px',
        fontSize: '10px',
        color: '#64748b',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#38bdf8', display: 'inline-block' }} />
          idea
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#475569', border: '1px solid #64748b', display: 'inline-block' }} />
          tag
        </span>
        <span>hover to explore · click idea to open · dbl-click to reset</span>
      </div>
    </div>
  );
}
