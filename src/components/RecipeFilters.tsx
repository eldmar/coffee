import { useEffect, useMemo, useState } from "react";
import { categoryLabel, formatTimeShort } from "../lib/recipes";
import type { CardImage } from "../lib/cardImage";

interface CatalogRecipe {
  slug: string;
  title: string;
  description: string;
  image: CardImage;
  category: string;
  brewMethod: string;
  temperature: string;
  milk: string;
  activeTime: number;
  totalTime: number;
  totalTimeLabel?: string;
  ingredients: string[];
}

interface Props {
  recipes: CatalogRecipe[];
}

const methodOptions = [
  ['any', 'Any method'],
  ['espresso', 'Espresso machine'],
  ['aeropress', 'AeroPress'],
  ['v60', 'V60 / pour over'],
  ['french-press', 'French press'],
  ['moka-pot', 'Moka pot'],
  ['cold-brew', 'Cold brew'],
  ['filter', 'Filter brewer'],
  ['phin', 'Vietnamese phin'],
  ['cezve', 'Cezve'],
] as const;

const selectClass =
  'rounded-md border border-line bg-card px-3.5 py-2.5 text-sm text-ink transition-colors';

const INITIAL_RESULT_COUNT = 12;

export default function RecipeFilters({ recipes }: Props) {
  const [query, setQuery] = useState('');
  const [method, setMethod] = useState('any');
  const [temp, setTemp] = useState('any');
  const [milk, setMilk] = useState('any');
  const [visibleCount, setVisibleCount] = useState(INITIAL_RESULT_COUNT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuery(params.get('q') ?? '');
    const m = params.get('method');
    if (m && methodOptions.some(([value]) => value === m)) setMethod(m);
    const t = params.get('temp');
    if (t === 'hot' || t === 'iced') setTemp(t);
    const mk = params.get('milk');
    if (mk === 'black' || mk === 'milk') setMilk(mk);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams();
    const cleanQuery = query.trim();
    if (cleanQuery) params.set('q', cleanQuery);
    if (method !== 'any') params.set('method', method);
    if (temp !== 'any') params.set('temp', temp);
    if (milk !== 'any') params.set('milk', milk);

    const search = params.toString();
    const href = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', href);
  }, [ready, query, method, temp, milk]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes.filter((r) => {
      if (method !== 'any' && r.brewMethod !== method) return false;
      if (temp !== 'any' && r.temperature !== temp) return false;
      if (milk !== 'any' && r.milk !== milk) return false;
      if (!q) return true;
      const haystack = [r.title, r.description, r.category, r.brewMethod, ...r.ingredients]
        .join(' ')
        .toLowerCase();
      return q.split(/\s+/).every((word) => haystack.includes(word));
    });
  }, [recipes, query, method, temp, milk]);

  const visibleResults = results.slice(0, visibleCount);
  const hasFilters = query.trim() !== '' || method !== 'any' || temp !== 'any' || milk !== 'any';

  function clearFilters() {
    setQuery('');
    setMethod('any');
    setTemp('any');
    setMilk('any');
    setVisibleCount(INITIAL_RESULT_COUNT);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="field-shell flex min-w-56 flex-1 items-center gap-2 rounded-md border border-line bg-card px-3.5 py-2.5 text-sm transition-shadow sm:max-w-xs">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisibleCount(INITIAL_RESULT_COUNT);
            }}
            placeholder="Search recipes"
            className="w-full bg-transparent placeholder:text-ink-soft"
            aria-label="Search recipes"
          />
        </label>
        <select
          className={selectClass}
          value={method}
          onChange={(e) => {
            setMethod(e.target.value);
            setVisibleCount(INITIAL_RESULT_COUNT);
          }}
          aria-label="Brew method"
        >
          {methodOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={temp}
          onChange={(e) => {
            setTemp(e.target.value);
            setVisibleCount(INITIAL_RESULT_COUNT);
          }}
          aria-label="Hot or iced"
        >
          <option value="any">Hot &amp; iced</option>
          <option value="hot">Hot</option>
          <option value="iced">Iced</option>
        </select>
        <select
          className={selectClass}
          value={milk}
          onChange={(e) => {
            setMilk(e.target.value);
            setVisibleCount(INITIAL_RESULT_COUNT);
          }}
          aria-label="Black or with milk"
        >
          <option value="any">Black &amp; milk</option>
          <option value="black">Black</option>
          <option value="milk">With milk</option>
        </select>
      </div>

      <div className="mt-6 flex min-h-8 flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <p className="text-ink-soft" aria-live="polite">
          {results.length > visibleResults.length
            ? `Showing ${visibleResults.length} of ${results.length}${hasFilters ? ' matching' : ''} recipes`
            : hasFilters
              ? `${results.length} matching ${results.length === 1 ? 'recipe' : 'recipes'}`
              : `${results.length} recipes`}
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-8 rounded-md font-medium text-accent hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <div className="mt-4 rounded-lg border border-line bg-card p-8 text-center">
          <p className="text-ink-soft">
            Nothing matches yet — try a different word or loosen a filter.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-4 min-h-11 rounded-md bg-accent px-4 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-dark"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <ul className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visibleResults.map((r) => (
              <li key={r.slug}>
                <a
                  href={`/recipes/${r.slug}/`}
                  className="group flex h-full flex-col overflow-hidden rounded-lg border border-line bg-card transition-shadow hover:shadow-md"
                >
                  <img
                    src={r.image.src}
                    srcSet={r.image.srcset}
                    sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 92vw"
                    alt=""
                    className="aspect-[4/3] w-full object-cover"
                    width={r.image.width}
                    height={r.image.height}
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="flex flex-1 flex-col gap-1.5 p-5">
                    <span className="eyebrow">{categoryLabel(r.category)}</span>
                    <h2 className="font-display text-xl font-medium">{r.title}</h2>
                    <span className="mt-auto flex items-center gap-2 pt-2 text-sm text-ink-soft">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v5l3 2" />
                      </svg>
                      {formatTimeShort(r)}
                      <span className="ml-auto text-accent transition-transform group-hover:translate-x-1" aria-hidden="true">
                        &#8594;
                      </span>
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          {visibleResults.length < results.length && (
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + INITIAL_RESULT_COUNT)}
                className="min-h-11 rounded-md border border-line bg-card px-5 text-sm font-medium transition-colors hover:border-accent"
              >
                Show more recipes
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
