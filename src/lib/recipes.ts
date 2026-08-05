/**
 * Shared recipe taxonomy and formatting. Categories, labels and time display
 * live here so cards, filters, category pages and structured data agree.
 */

export const CATEGORIES = [
  {
    id: 'espresso-drinks',
    label: 'Espresso drinks',
    slug: 'espresso-drinks',
    title: 'Espresso drink recipes',
    description:
      'Short, concentrated coffee served on its own or lengthened with water — espresso, americano and the rest.',
  },
  {
    id: 'milk-drinks',
    label: 'Milk drinks',
    slug: 'milk-drinks',
    title: 'Milk coffee recipes',
    description:
      'Espresso and steamed milk in every ratio, from a 1:1 cortado to a milk-forward latte.',
  },
  {
    id: 'filter-coffee',
    label: 'Filter coffee',
    slug: 'filter-coffee',
    title: 'Filter coffee recipes',
    description:
      'Pour over, immersion and press brewing — clean cups that show what your beans can do.',
  },
  {
    id: 'iced-coffee',
    label: 'Iced coffee',
    slug: 'iced-coffee',
    title: 'Iced coffee recipes',
    description: 'Cold coffee that stays strong: iced lattes, cold brew and sparkling espresso tonic.',
  },
  {
    id: 'brewing-methods',
    label: 'Brewing methods',
    slug: 'brewing-methods',
    title: 'Brewing method recipes',
    description:
      'Recipes defined by the brewer itself, where the method matters more than the drink it makes.',
  },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

const byId = new Map(CATEGORIES.map((c) => [c.id, c]));

export function categoryLabel(id: string): string {
  return byId.get(id as CategoryId)?.label ?? id;
}

export function categoryPath(id: string): string {
  return `/recipes/${id}/`;
}

export interface RecipeTimes {
  activeTime: number;
  totalTime: number;
  totalTimeLabel?: string;
}

/** Human duration: 45 -> "45 min", 90 -> "1 hr 30 min", 960 -> "16 hr". */
export function humanDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

/**
 * What a card or fact block shows. When brewing runs far longer than the
 * hands-on work — cold brew — both numbers are shown so nobody is ambushed
 * by a twelve-hour steep.
 */
export function formatTime({ activeTime, totalTime, totalTimeLabel }: RecipeTimes): string {
  const needsBoth = totalTimeLabel !== undefined || totalTime >= activeTime + 60;
  if (!needsBoth) return humanDuration(totalTime);
  return `${humanDuration(activeTime)} active · ${totalTimeLabel ?? humanDuration(totalTime)} total`;
}

/** Compact variant for recipe cards. */
export function formatTimeShort({ activeTime, totalTime, totalTimeLabel }: RecipeTimes): string {
  const needsBoth = totalTimeLabel !== undefined || totalTime >= activeTime + 60;
  if (!needsBoth) return humanDuration(totalTime);
  return `${humanDuration(activeTime)} active`;
}

/**
 * Pull the numbered steps out of a recipe body so structured data and the
 * rendered page never drift apart. Reads the ordered list under "## Steps".
 */
export function extractSteps(body: string): string[] {
  const start = body.indexOf('## Steps');
  if (start === -1) return [];
  const rest = body.slice(start + '## Steps'.length);
  const end = rest.indexOf('\n## ');
  const section = end === -1 ? rest : rest.slice(0, end);
  return section
    .split('\n')
    .map((line) => line.match(/^\d+\.\s+(.*\S)\s*$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => m[1].replace(/\*\*(.+?)\*\*/g, '$1'));
}

/** ISO 8601 duration for schema.org, e.g. 965 -> "PT16H5M". */
export function isoDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `PT${hours ? `${hours}H` : ''}${rest || !hours ? `${rest}M` : ''}`;
}
