import { linksFor } from './content';
import { diagnose } from './rules';
import { isAssistantMethod } from './query';
import type { BrewDiagnosis, BrewInput, Method } from './types';
import type {
  WidgetAdjustmentType,
  WidgetIssue,
  WidgetOutcome,
  WidgetQuestion,
  WidgetRecommendation,
  WidgetState,
} from './widget-types';

export const WIDGET_METHODS: Array<{ value: Method; label: string }> = [
  { value: 'espresso', label: 'Espresso' },
  { value: 'v60', label: 'V60' },
  { value: 'aeropress', label: 'AeroPress' },
  { value: 'french-press', label: 'French Press' },
];

export const WIDGET_ISSUES: Record<Method, Array<{ value: WidgetIssue; label: string }>> = {
  espresso: [
    { value: 'sour', label: 'Sour' },
    { value: 'bitter', label: 'Bitter' },
    { value: 'weak', label: 'Weak or watery' },
    { value: 'dry', label: 'Dry or astringent' },
    { value: 'fast', label: 'Running too fast' },
    { value: 'slow', label: 'Running too slowly' },
    { value: 'crema', label: 'Little or no crema' },
    { value: 'not-sure', label: 'Not sure' },
  ],
  v60: [
    { value: 'sour', label: 'Sour or sharp' },
    { value: 'bitter', label: 'Bitter' },
    { value: 'weak', label: 'Weak or watery' },
    { value: 'dry', label: 'Dry or astringent' },
    { value: 'fast', label: 'Drawdown too fast' },
    { value: 'slow', label: 'Drawdown too slow' },
    { value: 'flat', label: 'Flat or dull' },
    { value: 'not-sure', label: 'Not sure' },
  ],
  aeropress: [
    { value: 'sour', label: 'Sour or sharp' },
    { value: 'bitter', label: 'Bitter' },
    { value: 'weak', label: 'Weak or watery' },
    { value: 'strong', label: 'Too strong' },
    { value: 'dry', label: 'Dry or astringent' },
    { value: 'muddy', label: 'Muddy' },
    { value: 'not-sure', label: 'Not sure' },
  ],
  'french-press': [
    { value: 'sour', label: 'Sour or sharp' },
    { value: 'bitter', label: 'Bitter' },
    { value: 'weak', label: 'Weak or watery' },
    { value: 'strong', label: 'Too strong' },
    { value: 'dry', label: 'Dry or astringent' },
    { value: 'muddy', label: 'Muddy or silty' },
    { value: 'not-sure', label: 'Not sure' },
  ],
};

const CLOSEST: WidgetQuestion = {
  id: 'closest',
  prompt: 'Which description is closest?',
  choices: [
    { value: 'sharp', label: 'Sharp' },
    { value: 'harsh', label: 'Harsh' },
    { value: 'thin', label: 'Thin' },
    { value: 'dry', label: 'Dry' },
    { value: 'flat', label: 'Flat' },
  ],
};

const FLOW: WidgetQuestion = {
  id: 'flow',
  prompt: 'How did the brew run?',
  choices: [
    { value: 'fast', label: 'Faster than expected' },
    { value: 'slow', label: 'Slower than expected' },
    { value: 'expected', label: 'About as expected' },
    { value: 'not-sure', label: 'Not sure' },
  ],
};

const SHARPNESS: WidgetQuestion = {
  id: 'sharpness',
  prompt: 'Did it also taste sharp or sour?',
  choices: [
    { value: 'yes', label: 'Yes, sharp or sour' },
    { value: 'no', label: 'No, just weak' },
    { value: 'not-sure', label: 'Not sure' },
  ],
};

const CREMA_TASTE: WidgetQuestion = {
  id: 'crema-taste',
  prompt: 'Does the espresso otherwise taste good?',
  choices: [
    { value: 'good', label: 'Yes, it tastes good' },
    { value: 'off', label: 'No, the taste is off too' },
    { value: 'not-sure', label: 'Not sure' },
  ],
};

const STEEP_LENGTH: WidgetQuestion = {
  id: 'steep-length',
  prompt: 'How long was the steep?',
  choices: [
    { value: 'short', label: 'Under 2 minutes' },
    { value: 'normal', label: 'About 2-4 minutes' },
    { value: 'long', label: 'Over 4 minutes' },
    { value: 'not-sure', label: 'Not sure' },
  ],
};

const AEROPRESS_CAUSE: WidgetQuestion = {
  id: 'aeropress-cause',
  prompt: 'Which detail is closest?',
  choices: [
    { value: 'long', label: 'Steeped over 4 minutes' },
    { value: 'hard', label: 'Hard to press' },
    { value: 'neither', label: 'Neither' },
    { value: 'not-sure', label: 'Not sure' },
  ],
};

const STRONG_FINISH: WidgetQuestion = {
  id: 'strong-finish',
  prompt: 'Does it also taste bitter or dry?',
  choices: [
    { value: 'yes', label: 'Yes, bitter or dry' },
    { value: 'no', label: 'No, just too strong' },
    { value: 'not-sure', label: 'Not sure' },
  ],
};

const FLAT_CHARACTER: WidgetQuestion = {
  id: 'flat-character',
  prompt: 'Which is closer?',
  choices: [
    { value: 'sharp', label: 'Flat, thin and a little sharp' },
    { value: 'balanced', label: 'Balanced, but muted' },
    { value: 'not-sure', label: 'Not sure' },
  ],
};

const CLOSEST_TO_ISSUE: Record<string, WidgetIssue> = {
  sharp: 'sour',
  harsh: 'bitter',
  thin: 'weak',
  dry: 'dry',
  flat: 'flat',
};

export function resolvedWidgetIssue(
  issue: WidgetIssue,
  answers: WidgetState['answers'],
): WidgetIssue | null {
  if (issue !== 'not-sure') return issue;
  return CLOSEST_TO_ISSUE[answers.closest ?? ''] ?? null;
}

export function nextWidgetQuestion(
  method: Method,
  issue: WidgetIssue,
  answers: WidgetState['answers'],
): WidgetQuestion | null {
  if (issue === 'not-sure' && !answers.closest) return CLOSEST;
  const resolved = resolvedWidgetIssue(issue, answers);
  if (!resolved || Object.keys(answers).length >= 2) return null;

  if ((method === 'espresso' || method === 'v60') && ['sour', 'bitter', 'dry'].includes(resolved)) {
    return answers.flow ? null : FLOW;
  }
  if (resolved === 'weak') return answers.sharpness ? null : SHARPNESS;
  if (method === 'espresso' && resolved === 'crema') {
    return answers['crema-taste'] ? null : CREMA_TASTE;
  }
  if ((method === 'aeropress' || method === 'french-press') && resolved === 'sour') {
    return answers['steep-length'] ? null : STEEP_LENGTH;
  }
  if (method === 'aeropress' && (resolved === 'bitter' || resolved === 'dry')) {
    return answers['aeropress-cause'] ? null : AEROPRESS_CAUSE;
  }
  if ((method === 'aeropress' || method === 'french-press') && resolved === 'strong') {
    return answers['strong-finish'] ? null : STRONG_FINISH;
  }
  if (method === 'v60' && resolved === 'flat') {
    return answers['flat-character'] ? null : FLAT_CHARACTER;
  }
  return null;
}

const baseline = (method: Method): BrewInput => {
  if (method === 'espresso') {
    return {
      method,
      dose: 18,
      yieldOut: 38,
      time: 29,
      roast: 'medium',
      tastes: [],
      behaviour: 'none',
    };
  }
  return {
    method,
    dose: 15,
    water: 250,
    time: method === 'v60' ? 180 : method === 'aeropress' ? 180 : 300,
    roast: 'medium',
    tastes: [],
    behaviour: 'none',
  };
};

function quickInput(
  method: Method,
  issue: WidgetIssue,
  answers: WidgetState['answers'],
): BrewInput | null {
  const input = baseline(method);
  const flow = answers.flow;

  if (issue === 'sour') input.tastes = ['sour'];
  if (issue === 'bitter') input.tastes = ['bitter'];
  if (issue === 'dry') input.tastes = ['dry'];

  if (issue === 'weak') {
    if (answers.sharpness === 'not-sure') return null;
    input.tastes = answers.sharpness === 'yes' ? ['weak', 'sour'] : ['weak'];
    if (answers.sharpness === 'no') {
      if (method === 'espresso') input.yieldOut = 50;
      else input.water = 300;
    }
  }

  if (issue === 'strong') {
    if (answers['strong-finish'] === 'not-sure') return null;
    input.tastes =
      answers['strong-finish'] === 'yes' ? ['strong', 'bitter', 'dry'] : ['strong'];
    input.dose = method === 'espresso' ? 18 : 20;
  }

  if (issue === 'muddy') {
    input.tastes = ['muddy'];
    if (method === 'french-press') input.behaviour = 'french-press-sediment';
  }

  if (issue === 'flat') {
    if (answers['flat-character'] !== 'sharp') return null;
    input.tastes = ['hollow'];
  }

  if (issue === 'crema') {
    if (answers['crema-taste'] !== 'good') return null;
    input.behaviour = 'espresso-low-crema';
  }

  if (issue === 'fast') {
    input.tastes = ['sour', 'weak'];
    if (method === 'espresso') input.behaviour = 'espresso-fast';
    if (method === 'v60') input.behaviour = 'v60-fast';
  }

  if (issue === 'slow') {
    input.tastes = ['bitter', 'dry'];
    if (method === 'espresso') input.behaviour = 'espresso-slow';
    if (method === 'v60') input.behaviour = 'v60-stalled';
  }

  if (method === 'espresso' && flow === 'fast') input.behaviour = 'espresso-fast';
  if (method === 'espresso' && flow === 'slow') input.behaviour = 'espresso-slow';
  if (method === 'v60' && flow === 'fast') input.behaviour = 'v60-fast';
  if (method === 'v60' && flow === 'slow') input.behaviour = 'v60-stalled';

  if (method === 'aeropress') {
    if (answers['steep-length'] === 'short') input.time = 60;
    if (answers['steep-length'] === 'long') input.time = 300;
    if (answers['aeropress-cause'] === 'long') input.time = 300;
    if (answers['aeropress-cause'] === 'hard') input.behaviour = 'aeropress-hard';
  }

  if (method === 'french-press') {
    if (answers['steep-length'] === 'short') input.time = 180;
    if (answers['steep-length'] === 'long') input.time = 420;
  }

  return input;
}

function adjustmentType(diagnosis: BrewDiagnosis): WidgetAdjustmentType {
  const { variable, direction } = diagnosis.adjustment;
  if (variable === 'grind') return direction === 'finer' ? 'grind-finer' : 'grind-coarser';
  if (variable === 'dose' || variable === 'yield' || variable === 'water') return 'change-ratio';
  if (variable === 'temperature') return 'change-temperature';
  if (variable === 'time') return 'change-time';
  if (variable === 'freshness') return 'check-freshness';
  return 'change-technique';
}

function toWidgetRecommendation(
  diagnosis: BrewDiagnosis,
  issue: WidgetIssue,
  answerCount: number,
): WidgetRecommendation {
  const related = linksFor(diagnosis.relatedContent)[0];
  return {
    id: diagnosis.ruleId,
    method: diagnosis.method,
    issue,
    adjustmentType: adjustmentType(diagnosis),
    adjustment: diagnosis.adjustment.title,
    explanation: diagnosis.reasons.slice(0, 2),
    keepUnchanged: diagnosis.keepConstant,
    relatedPath: related?.href,
    relatedLabel: related?.label,
    confidence: answerCount > 0 || ['fast', 'slow', 'muddy'].includes(issue) ? 'high' : 'medium',
  };
}

export function diagnoseWidget(state: WidgetState): WidgetOutcome {
  if (!state.method || !state.issue) {
    return { kind: 'needs-details', message: 'Choose a brew method and problem first.' };
  }
  const question = nextWidgetQuestion(state.method, state.issue, state.answers);
  if (question) return { kind: 'question', question };

  const issue = resolvedWidgetIssue(state.issue, state.answers);
  if (!issue) {
    return {
      kind: 'needs-details',
      message: 'I need a few recipe details to make a useful recommendation.',
    };
  }

  const flow = state.answers.flow;
  const conflictingFlow =
    (issue === 'sour' && flow === 'slow') ||
    ((issue === 'bitter' || issue === 'dry') && flow === 'fast');
  const input = conflictingFlow ? null : quickInput(state.method, issue, state.answers);
  if (!input) {
    return {
      kind: 'needs-details',
      message: 'I need a few recipe details to make a useful recommendation.',
    };
  }

  const diagnosis = diagnose(input);
  if (diagnosis.needsClarification) {
    return {
      kind: 'needs-details',
      message: 'I need a few recipe details to make a useful recommendation.',
    };
  }

  return {
    kind: 'recommendation',
    recommendation: toWidgetRecommendation(diagnosis, issue, Object.keys(state.answers).length),
  };
}

const WIDGET_ISSUE_VALUES = new Set<WidgetIssue>([
  'sour',
  'bitter',
  'weak',
  'dry',
  'fast',
  'slow',
  'crema',
  'strong',
  'muddy',
  'flat',
  'not-sure',
]);

export function buildFullAssistantHref(method?: string, issue?: string): string {
  const params = new URLSearchParams();
  if (method && isAssistantMethod(method)) params.set('method', method);
  if (issue && WIDGET_ISSUE_VALUES.has(issue as WidgetIssue)) params.set('issue', issue);
  params.set('entry', 'widget');
  return `/assistant/?${params.toString()}`;
}

export function methodLabel(method: Method): string {
  return WIDGET_METHODS.find((option) => option.value === method)?.label ?? method;
}

export function issueLabel(method: Method, issue: WidgetIssue): string {
  return WIDGET_ISSUES[method].find((option) => option.value === issue)?.label ?? issue;
}

export function adjustmentLabel(type: WidgetAdjustmentType): string {
  const labels: Record<WidgetAdjustmentType, string> = {
    'grind-finer': 'Grind finer',
    'grind-coarser': 'Grind coarser',
    'change-ratio': 'Adjust strength',
    'change-temperature': 'Adjust temperature',
    'change-time': 'Adjust brew time',
    'change-technique': 'Adjust technique',
    'check-freshness': 'Check freshness',
  };
  return labels[type];
}
