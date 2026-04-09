import { useState } from 'react';

interface Idea {
  index: number;
  id: string;
  title: string;
  category: string;
  tags: string[];
  evaluation: Record<string, number>;
  estimatedTime: string;
  difficulty: string;
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
  ideas: Idea[];
}

export default function IdeaList({ ideas }: Props) {
  const [search, setSearch] = useState('');

  const filtered = ideas.filter(idea => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      idea.title.toLowerCase().includes(q) ||
      idea.tags.some(t => t.includes(q)) ||
      idea.category.includes(q)
    );
  });

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="Search ideas by title, tag, or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '0.6rem 1rem',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '8px',
            color: '#e2e8f0',
            fontSize: '0.9rem',
            fontFamily: 'Inter, sans-serif',
            outline: 'none',
          }}
        />
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '1rem',
      }}>
        {filtered.map(idea => (
          <a
            key={idea.id}
            href={`/ideas/${String((idea as any).ideaIndex).padStart(4, '0')}/`}
            style={{
              display: 'block',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '1.25rem',
              textDecoration: 'none',
              transition: 'all 0.15s',
              borderLeft: `3px solid ${CATEGORY_COLORS[idea.category] || '#64748b'}`,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#334155'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#1e293b'; }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <span style={{ color: '#64748b', fontSize: '0.75rem', fontFamily: 'Fira Code, monospace' }}>
                #{String((idea as any).ideaIndex).padStart(4, '0')}
              </span>
              <span style={{
                fontSize: '0.7rem',
                background: `${CATEGORY_COLORS[idea.category] || '#64748b'}22`,
                color: CATEGORY_COLORS[idea.category] || '#64748b',
                padding: '0.15rem 0.5rem',
                borderRadius: '10px',
              }}>
                {idea.category}
              </span>
            </div>
            <h3 style={{ fontSize: '1rem', color: '#f1f5f9', fontWeight: 600, marginBottom: '0.5rem', lineHeight: 1.4 }}>
              {idea.title}
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              {idea.tags.slice(0, 4).map(tag => (
                <span key={tag} style={{
                  fontSize: '0.7rem',
                  background: '#0f172a',
                  color: '#94a3b8',
                  padding: '0.15rem 0.4rem',
                  borderRadius: '4px',
                }}>
                  {tag}
                </span>
              ))}
              {idea.tags.length > 4 && (
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>+{idea.tags.length - 4}</span>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#64748b' }}>
              <span>Score: {idea.evaluation.total?.toFixed(1) || 'N/A'}</span>
              <span>{idea.estimatedTime}</span>
            </div>
          </a>
        ))}
      </div>
      {filtered.length === 0 && (
        <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
          No ideas match your search.
        </p>
      )}
    </div>
  );
}
