import type { Method } from './types';

export type WidgetStep =
  | 'welcome'
  | 'method'
  | 'issue'
  | 'follow-up'
  | 'recommendation'
  | 'feedback';

export type WidgetIssue =
  | 'sour'
  | 'bitter'
  | 'weak'
  | 'dry'
  | 'fast'
  | 'slow'
  | 'crema'
  | 'strong'
  | 'muddy'
  | 'flat'
  | 'not-sure';

export type WidgetQuestionId =
  | 'closest'
  | 'flow'
  | 'sharpness'
  | 'crema-taste'
  | 'steep-length'
  | 'aeropress-cause'
  | 'strong-finish'
  | 'flat-character';

export type WidgetFeedback =
  | 'yes'
  | 'not_yet'
  | 'better'
  | 'same'
  | 'worse'
  | 'not_tried';

export type WidgetAdjustmentType =
  | 'grind-finer'
  | 'grind-coarser'
  | 'change-ratio'
  | 'change-temperature'
  | 'change-time'
  | 'change-technique'
  | 'check-freshness';

export interface WidgetState {
  version: 1;
  step: WidgetStep;
  method?: Method;
  issue?: WidgetIssue;
  answers: Partial<Record<WidgetQuestionId, string>>;
  recommendationId?: string;
  feedback?: WidgetFeedback;
  attemptNumber?: number;
  startedAt?: string;
  updatedAt: string;
}

export interface WidgetHistoryEntry {
  method: Method;
  issue: WidgetIssue;
  answers: Partial<Record<WidgetQuestionId, string>>;
  recommendationId: string;
  adjustmentType: WidgetAdjustmentType;
  createdAt: string;
  feedback?: WidgetFeedback;
}

export interface WidgetQuestion {
  id: WidgetQuestionId;
  prompt: string;
  choices: Array<{ value: string; label: string }>;
}

export interface WidgetRecommendation {
  id: string;
  method: Method;
  issue: WidgetIssue;
  adjustmentType: WidgetAdjustmentType;
  adjustment: string;
  explanation: string[];
  keepUnchanged: string[];
  relatedPath?: string;
  relatedLabel?: string;
  confidence: 'high' | 'medium';
}

export type WidgetOutcome =
  | { kind: 'question'; question: WidgetQuestion }
  | { kind: 'recommendation'; recommendation: WidgetRecommendation }
  | { kind: 'needs-details'; message: string };
