import type { Behaviour, Method, Taste } from './types';

export interface AssistantSeed {
  method: Method | null;
  group: 'filter' | null;
  taste: Taste | null;
  behaviour: Behaviour | null;
  fresh: boolean;
  entry: string | null;
}

const METHODS = new Set<Method>(['espresso', 'v60', 'aeropress', 'french-press']);
const TASTES = new Set<Taste>([
  'sour',
  'bitter',
  'weak',
  'strong',
  'dry',
  'hollow',
  'muddy',
  'unsure',
]);

const METHOD_BEHAVIOURS: Record<Method, Set<Behaviour>> = {
  espresso: new Set([
    'espresso-fast',
    'espresso-slow',
    'espresso-spraying',
    'espresso-low-crema',
    'none',
  ]),
  v60: new Set(['v60-stalled', 'v60-fast', 'v60-uneven', 'none']),
  aeropress: new Set(['aeropress-easy', 'aeropress-hard', 'none']),
  'french-press': new Set(['french-press-sediment', 'french-press-hard', 'none']),
};

function genericBehaviour(method: Method | null, issue: string | null): Behaviour | null {
  if (method === 'espresso' && issue === 'fast') return 'espresso-fast';
  if (method === 'espresso' && issue === 'slow') return 'espresso-slow';
  if (method === 'espresso' && issue === 'crema') return 'espresso-low-crema';
  if (method === 'v60' && issue === 'fast') return 'v60-fast';
  if (method === 'v60' && issue === 'slow') return 'v60-stalled';
  return null;
}

/** Parse only the small handoff contract. Recipe values and unknown IDs are ignored. */
export function parseAssistantParams(search: string): AssistantSeed {
  const params = new URLSearchParams(search);
  const rawMethod = params.get('method') ?? params.get('mode');
  const method = METHODS.has(rawMethod as Method) ? (rawMethod as Method) : null;
  const issue = params.get('issue');
  const mappedTaste = issue === 'flat' ? 'hollow' : issue === 'not-sure' ? 'unsure' : issue;
  const taste = TASTES.has(mappedTaste as Taste) ? (mappedTaste as Taste) : null;
  const explicitBehaviour =
    method && METHOD_BEHAVIOURS[method].has(issue as Behaviour) ? (issue as Behaviour) : null;

  return {
    method,
    group: params.get('group') === 'filter' ? 'filter' : null,
    taste,
    behaviour: explicitBehaviour ?? genericBehaviour(method, issue),
    fresh: params.get('new') === '1',
    entry: params.get('entry'),
  };
}

export const isAssistantMethod = (value: string): value is Method => METHODS.has(value as Method);
