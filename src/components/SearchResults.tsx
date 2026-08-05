import { useEffect, useMemo, useState } from 'react';

export interface SearchDoc {
  type: 'recipe' | 'guide' | 'learn' | 'journal';
  title: string;
  description: string;
  url: string;
  meta?: string;
  /** Lower-cased haystack built at build time. */
  text: string;
}

interface Props {
  docs: SearchDoc[];
}

const GROUPS: { type: SearchDoc['type']; label: string }[] = [
  { type: 'recipe', label: 'Recipes' },
  { type: 'guide', label: 'Brew guides' },
  { type: 'learn', label: 'Learn' },
  { type: 'journal', label: 'Journal' },
];

export default function SearchResults({ docs }: Props) {
  const [query, setQuery] = useState('');
  const [ready, setReady] = useState(false);

  // Seed from the URL so a shared link reproduces the same results.
  useEffect(() => {
    setQuery(new URLSearchParams(window.location.search).get('q') ?? '');
    setReady(true);
  }, []);

  // Keep the query in the URL without adding history entries per keystroke.
  useEffect(() => {
    if (!ready) return;
    const url = new URL(window.location.href);
    if (query.trim()) url.searchParams.set('q', query.trim());
    else url.searchParams.delete('q');
    window.history.replaceState({}, '', url);
  }, [query, ready]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const words = q.split(/\s+/);
    return docs
      .map((doc) => {
        if (!words.every((w) => doc.text.includes(w))) return null;
        // Title matches rank above body matches.
        const title = doc.title.toLowerCase();
        const score = words.reduce((acc, w) => acc + (title.includes(w) ? 2 : 0), 0);
        return { doc, score };
      })
      .filter((r): r is { doc: SearchDoc; score: number } => r !== null)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.doc);
  }, [docs, query]);

  const grouped = GROUPS.map((g) => ({
    ...g,
    items: results.filter((r) => r.type === g.type),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      <form role="search" onSubmit={(e) => e.preventDefault()} className="max-w-xl">
        <label
          htmlFor="site-search"
          className="flex items-center gap-2 rounded-md border border-line bg-card px-4 py-3 focus-within:border-accent"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            id="site-search"
            type="search"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search KAVOVO"
            aria-label="Search recipes, guides, learning paths and journal articles"
            className="w-full bg-transparent text-base outline-none placeholder:text-ink-soft/70"
          />
        </label>
      </form>

      <p className="mt-6 text-sm text-ink-soft" aria-live="polite">
        {!query.trim()
          ? `Search ${docs.length} recipes, guides and articles.`
          : results.length === 0
            ? 'No matches.'
            : `${results.length} ${results.length === 1 ? 'result' : 'results'} for “${query.trim()}”`}
      </p>

      {query.trim() && results.length === 0 && (
        <p className="mt-6 rounded-lg border border-line bg-card p-8 text-center text-ink-soft">
          Nothing matched that. Try a drink name, a brew method or an ingredient — or{' '}
          <a href="/recipes/" className="font-medium text-accent hover:underline">
            browse all recipes
          </a>
          .
        </p>
      )}

      <div className="mt-8 flex flex-col gap-10">
        {grouped.map((group) => (
          <section key={group.type}>
            <h2 className="eyebrow">
              {group.label} ({group.items.length})
            </h2>
            <ul className="mt-3 flex flex-col divide-y divide-line border-t border-line">
              {group.items.map((doc) => (
                <li key={doc.url}>
                  <a href={doc.url} className="group block py-4">
                    <span className="flex items-baseline gap-3">
                      <span className="font-display text-lg font-medium group-hover:text-accent">
                        {doc.title}
                      </span>
                      {doc.meta && <span className="text-xs text-ink-soft">{doc.meta}</span>}
                    </span>
                    <span className="mt-1 block text-sm text-ink-soft">{doc.description}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
