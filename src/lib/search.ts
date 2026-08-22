export type SearchContentType = 'recipe' | 'guide' | 'learn' | 'journal';

export interface SearchDoc {
  type: SearchContentType;
  title: string;
  description: string;
  summary?: string;
  url: string;
  meta?: string;
  /** Method, category, tags, or other compact classification terms. */
  keywords: string;
  /** Long-form content with the lowest relevance weight. */
  body: string;
}

export interface RankedSearchResult {
  doc: SearchDoc;
  score: number;
}

export type SearchTypeFilter = 'all' | SearchContentType;

export function isSearchTypeFilter(value: string | null): value is SearchTypeFilter {
  return (
    value === 'all' ||
    value === 'recipe' ||
    value === 'guide' ||
    value === 'learn' ||
    value === 'journal'
  );
}

export function filterSearchResults(
  results: RankedSearchResult[],
  type: SearchTypeFilter,
): RankedSearchResult[] {
  return type === 'all' ? results : results.filter(({ doc }) => doc.type === type);
}

const TYPE_ORDER: Record<SearchContentType, number> = {
  recipe: 0,
  guide: 1,
  learn: 2,
  journal: 3,
};

const SEARCH_STOP_WORDS = new Set(['vs', 'and', 'or', 'the']);

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function stem(token: string): string {
  if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.length > 5 && /(?:s|x|z|ch|sh)es$/u.test(token)) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

function normalizedTerms(value: string): string[] {
  return normalizeSearchText(value)
    .split(/\s+/u)
    .filter((token) => token && !SEARCH_STOP_WORDS.has(token));
}

function tokens(value: string): string[] {
  return normalizedTerms(value).map(stem);
}

function tokenMatches(fieldToken: string, queryToken: string): boolean {
  return fieldToken === queryToken || fieldToken.startsWith(queryToken);
}

function fieldMatches(field: string, queryTokens: string[]): boolean {
  const fieldTokens = tokens(field);
  return queryTokens.every((queryToken) =>
    fieldTokens.some((fieldToken) => tokenMatches(fieldToken, queryToken)),
  );
}

function tokenWeight(doc: SearchDoc, queryToken: string): number {
  if (fieldMatches(doc.title, [queryToken])) return 60;
  if (fieldMatches(doc.keywords, [queryToken])) return 40;
  if (fieldMatches(`${doc.description} ${doc.summary ?? ''}`, [queryToken])) return 20;
  if (fieldMatches(doc.body, [queryToken])) return 5;
  return 0;
}

function scoreDocument(doc: SearchDoc, rawQuery: string): number {
  const normalizedQuery = normalizeSearchText(rawQuery);
  const queryTokens = tokens(rawQuery);
  if (!normalizedQuery || queryTokens.length === 0) return 0;

  const title = normalizeSearchText(doc.title);
  const stemmedTitle = tokens(doc.title).join(' ');
  const stemmedQuery = queryTokens.join(' ');

  if (title === normalizedQuery || stemmedTitle === stemmedQuery) return 120;
  if (title.startsWith(normalizedQuery) || stemmedTitle.startsWith(stemmedQuery)) return 100;
  if (fieldMatches(doc.title, queryTokens)) return 80;
  if (fieldMatches(doc.keywords, queryTokens)) return 40;
  if (fieldMatches(`${doc.description} ${doc.summary ?? ''}`, queryTokens)) return 20;
  if (fieldMatches(doc.body, queryTokens)) return 5;

  // Multi-word queries may span fields. The least relevant matching term sets
  // the score, so a body-only word cannot ride above a strong title match.
  const weights = queryTokens.map((queryToken) => tokenWeight(doc, queryToken));
  return weights.every((weight) => weight > 0) ? Math.min(...weights) : 0;
}

export function searchTextMatches(value: string, query: string): boolean {
  const queryTokens = tokens(query);
  return queryTokens.length > 0 && fieldMatches(value, queryTokens);
}

export interface HighlightPart {
  text: string;
  match: boolean;
}

function normalizedWithSourceMap(value: string): {
  value: string;
  starts: number[];
  ends: number[];
} {
  let normalized = '';
  const starts: number[] = [];
  const ends: number[] = [];

  for (let index = 0; index < value.length; ) {
    const codePoint = value.codePointAt(index);
    if (codePoint === undefined) break;
    const character = String.fromCodePoint(codePoint);
    const nextIndex = index + character.length;
    const comparable = character
      .normalize('NFKD')
      .replace(/\p{M}+/gu, '')
      .toLocaleLowerCase('en');

    for (const part of comparable) {
      normalized += /[\p{L}\p{N}]/u.test(part) ? part : ' ';
      starts.push(index);
      ends.push(nextIndex);
    }
    index = nextIndex;
  }

  return { value: normalized, starts, ends };
}

export function highlightSearchText(text: string, query: string): HighlightPart[] {
  const mapped = normalizedWithSourceMap(text);
  const queryTerms = normalizedTerms(query);
  const terms = [...new Set(queryTerms.flatMap((term) => [term, stem(term)]))].filter(Boolean);
  const ranges: Array<{ start: number; end: number }> = [];

  for (const term of terms) {
    let offset = 0;
    while (offset < mapped.value.length) {
      const matchAt = mapped.value.indexOf(term, offset);
      if (matchAt === -1) break;
      const start = mapped.starts[matchAt];
      const end = mapped.ends[matchAt + term.length - 1];
      if (start !== undefined && end !== undefined) ranges.push({ start, end });
      offset = matchAt + Math.max(term.length, 1);
    }
  }

  if (ranges.length === 0) return [{ text, match: false }];
  ranges.sort((a, b) => a.start - b.start || b.end - a.end);

  const merged: Array<{ start: number; end: number }> = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
  }

  const parts: HighlightPart[] = [];
  let cursor = 0;
  for (const range of merged) {
    if (range.start > cursor) parts.push({ text: text.slice(cursor, range.start), match: false });
    parts.push({ text: text.slice(range.start, range.end), match: true });
    cursor = range.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
  return parts;
}

export function rankSearchDocs(docs: SearchDoc[], query: string): RankedSearchResult[] {
  if (!query.trim()) return [];

  const scored = docs
    .map((doc) => ({ doc, score: scoreDocument(doc, query) }))
    .filter((result) => result.score > 0);
  const significantQueryTokens = tokens(query);
  const hasStrongTitleMatch =
    significantQueryTokens.length > 1 && scored.some((result) => result.score >= 80);

  return scored
    // When a multi-word title clearly matches the intent, body-only mentions
    // are noise. Cross-field matches remain available when no title matches.
    .filter((result) => !hasStrongTitleMatch || result.score >= 20)
    .sort(
      (a, b) =>
        b.score - a.score ||
        TYPE_ORDER[a.doc.type] - TYPE_ORDER[b.doc.type] ||
        a.doc.title.localeCompare(b.doc.title, 'en'),
    );
}
