// Shiki 하이라이터를 싱글턴으로 캐싱하여 빌드 시 메모리 문제를 방지한다.
import { createHighlighter, type Highlighter } from 'shiki';

let highlighter: Highlighter | null = null;

export async function getHighlighter(): Promise<Highlighter> {
  if (!highlighter) {
    highlighter = await createHighlighter({
      themes: ['github-dark'],
      langs: ['typescript', 'tsx', 'vue', 'svelte'],
    });
  }
  return highlighter;
}

export async function highlight(code: string, lang: string): Promise<string> {
  const hl = await getHighlighter();
  return hl.codeToHtml(code, { lang, theme: 'github-dark' });
}
