import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  highlightSearchText,
  rankSearchDocs,
  searchTextMatches,
  type SearchDoc,
} from '../lib/search';

interface Props {
  docs: SearchDoc[];
}

const INITIAL_RESULT_COUNT = 20;

const TYPE_LABELS: Record<SearchDoc['type'], string> = {
  recipe: 'Recipe',
  guide: 'Guide',
  learn: 'Learn',
  journal: 'Journal',
};

function Highlight({ text, query }: { text: string; query: string }) {
  return highlightSearchText(text, query).map((part, index) =>
    part.match ? (
      <mark key={`${part.text}-${index}`} className="rounded-sm bg-accent/10 text-inherit">
        {part.text}
      </mark>
    ) : (
      <Fragment key={`${part.text}-${index}`}>{part.text}</Fragment>
    ),
  );
}

function resultSummary(doc: SearchDoc, query: string): string {
  if (searchTextMatches(doc.description, query)) return doc.description;
  if (doc.summary && searchTextMatches(doc.summary, query)) return doc.summary;
  return doc.description;
}

export default function SearchResults({ docs }: Props) {
  const [query, setQuery] = useState('');
  const [ready, setReady] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_RESULT_COUNT);
  const inputRef = useRef<HTMLInputElement>(null);

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
    setVisibleCount(INITIAL_RESULT_COUNT);
  }, [query, ready]);

  const results = useMemo(() => rankSearchDocs(docs, query), [docs, query]);
  const visibleResults = results.slice(0, visibleCount);

  const clearSearch = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery((value) => value.trim());
        }}
        className="max-w-xl"
      >
        <label
          htmlFor="site-search"
          className="field-shell flex items-center gap-2 rounded-md border border-line bg-card px-4 py-3 transition-shadow"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            id="site-search"
            type="search"
            value={query}
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search KAVOVO"
            aria-label="Search recipes, guides, learning paths and journal articles"
            className="w-full bg-transparent text-base placeholder:text-ink-soft/70"
          />
        </label>
      </form>

      <p className="mt-6 text-sm text-ink-soft" aria-live="polite">
        {!query.trim()
          ? `Search ${docs.length} recipes, guides and articles.`
          : results.length === 0
            ? 'No results.'
            : `${results.length} ${results.length === 1 ? 'result' : 'results'} for “${query.trim()}”`}
      </p>

      {query.trim() && results.length === 0 && (
        <div className="mt-6 border-y border-line py-8 text-center">
          <p className="text-ink-soft">Nothing matched that. Try a drink name, brew method or ingredient.</p>
          <button
            type="button"
            onClick={clearSearch}
            className="mt-4 min-h-11 rounded-md border border-line px-4 text-sm font-medium text-accent transition-colors hover:border-accent"
          >
            Clear search
          </button>
        </div>
      )}

      {visibleResults.length > 0 && (
        <ul className="mt-8 flex flex-col divide-y divide-line border-y border-line">
          {visibleResults.map(({ doc }) => (
            <li key={doc.url}>
              <a href={doc.url} className="group block py-5">
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="eyebrow">{TYPE_LABELS[doc.type]}</span>
                  {doc.meta && <span className="text-xs text-ink-soft">{doc.meta}</span>}
                </span>
                <h2 className="mt-1 font-display text-xl font-medium group-hover:text-accent">
                  <Highlight text={doc.title} query={query} />
                </h2>
                <p className="mt-1 text-sm text-ink-soft">
                  <Highlight text={resultSummary(doc, query)} query={query} />
                </p>
              </a>
            </li>
          ))}
        </ul>
      )}

      {visibleCount < results.length && (
        <button
          type="button"
          onClick={() => setVisibleCount((count) => count + INITIAL_RESULT_COUNT)}
          className="mt-6 min-h-11 rounded-md border border-line px-5 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
        >
          Show more
        </button>
      )}
    </div>
  );
}
