#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const IDEAS_DIR = path.resolve(__dirname, '..', 'content', 'idea-bank', 'ideas');
const DATA_DIR = path.resolve(__dirname, '..', 'src', 'data');

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { frontmatter: {}, body: content };

  const fm = {};
  const fmBlock = match[1];
  let inEvaluation = false;
  const evaluation = {};

  for (const line of fmBlock.split('\n')) {
    if (line.trim() === 'evaluation:') { inEvaluation = true; continue; }
    if (inEvaluation && line.trim() === '') continue; // skip blank lines inside evaluation
    if (inEvaluation && /^\s+\w/.test(line)) {
      const ci = line.indexOf(':');
      if (ci !== -1) {
        const key = line.slice(0, ci).trim();
        const val = line.slice(ci + 1).trim();
        evaluation[key] = isNaN(Number(val)) ? val : Number(val);
      }
      continue;
    }
    if (inEvaluation && !/^\s/.test(line)) inEvaluation = false;

    const ci = line.indexOf(':');
    if (ci === -1) continue;
    const key = line.slice(0, ci).trim();
    let val = line.slice(ci + 1).trim();

    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
    }

    fm[key] = val;
  }

  fm.evaluation = evaluation;
  const body = content.slice(match[0].length).trim();
  return { frontmatter: fm, body };
}

function buildIdeasJson() {
  const files = fs.readdirSync(IDEAS_DIR)
    .filter(f => f.endsWith('.md') && f !== 'README.md')
    .sort();

  const ideas = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(IDEAS_DIR, file), 'utf-8');
    const { frontmatter, body } = parseFrontmatter(content);

    const indexMatch = file.match(/^(\d{4})-/);
    const index = indexMatch ? parseInt(indexMatch[1], 10) : 0;

    ideas.push({
      ideaIndex: index,
      filename: file,
      id: frontmatter.id || `idea-${String(index).padStart(4, '0')}`,
      title: frontmatter.title || file.replace(/\.md$/, ''),
      generated: frontmatter.generated || '',
      category: frontmatter.category || 'unknown',
      subcategory: frontmatter.subcategory || '',
      difficulty: frontmatter.difficulty || 'intermediate',
      tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
      estimatedTime: frontmatter.estimated_time || '',
      techStack: Array.isArray(frontmatter.tech_stack) ? frontmatter.tech_stack : [],
      languages: Array.isArray(frontmatter.languages) ? frontmatter.languages : [],
      evaluation: frontmatter.evaluation || {},
      body,
    });
  }

  return ideas;
}

function buildNetworkJson(ideas) {
  const nodes = [];
  const links = [];
  const tagCount = {};

  // Count tags
  for (const idea of ideas) {
    for (const tag of idea.tags) {
      tagCount[tag] = (tagCount[tag] || 0) + 1;
    }
  }

  // Add idea nodes
  for (const idea of ideas) {
    nodes.push({
      id: idea.id,
      type: 'idea',
      label: idea.title,
      category: idea.category,
      score: idea.evaluation.total || 0,
      ideaIndex: idea.ideaIndex,
    });
  }

  // Add tag nodes (only tags appearing in 2+ ideas, or if total ideas < 15 show all)
  const minCount = ideas.length < 15 ? 1 : 2;
  for (const [tag, count] of Object.entries(tagCount)) {
    if (count >= minCount) {
      nodes.push({
        id: `tag:${tag}`,
        type: 'tag',
        label: tag,
        count,
      });
    }
  }

  // Add links (idea → tag)
  const tagNodeIds = new Set(nodes.filter(n => n.type === 'tag').map(n => n.id));
  for (const idea of ideas) {
    for (const tag of idea.tags) {
      const tagId = `tag:${tag}`;
      if (tagNodeIds.has(tagId)) {
        links.push({ source: idea.id, target: tagId });
      }
    }
  }

  return { nodes, links };
}

function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const ideas = buildIdeasJson();
  const network = buildNetworkJson(ideas);

  fs.writeFileSync(
    path.join(DATA_DIR, 'ideas.json'),
    JSON.stringify(ideas, null, 2)
  );

  fs.writeFileSync(
    path.join(DATA_DIR, 'network.json'),
    JSON.stringify(network, null, 2)
  );

  console.log(`Built data: ${ideas.length} ideas, ${network.nodes.length} nodes, ${network.links.length} links`);
}

main();
