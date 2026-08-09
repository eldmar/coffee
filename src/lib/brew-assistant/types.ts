/** Shared types for the Brew Assistant. No DOM access anywhere in this folder. */

export type Method = 'espresso' | 'v60' | 'aeropress' | 'french-press';

export type Roast = 'light' | 'medium' | 'dark' | 'unknown';

/** Taste descriptors. `unsure` never combines with another. */
export type Taste =
  | 'sour'
  | 'bitter'
  | 'weak'
  | 'strong'
  | 'dry'
  | 'hollow'
  | 'muddy'
  | 'unsure';

/** What the brew did, as opposed to how it tasted. Method-specific. */
export type Behaviour =
  | 'espresso-fast'
  | 'espresso-slow'
  | 'espresso-spraying'
  | 'v60-stalled'
  | 'v60-fast'
  | 'v60-uneven'
  | 'aeropress-easy'
  | 'aeropress-hard'
  | 'french-press-sediment'
  | 'french-press-hard'
  | 'none';

export interface BrewInput {
  method: Method;
  /** Grams of dry coffee. */
  dose: number;
  /** Espresso: grams in the cup. */
  yieldOut?: number;
  /** Filter methods: grams or millilitres of brewing water. */
  water?: number;
  /** Seconds, however the method counts them. */
  time: number;
  roast: Roast;
  /** °C, if the person knows it. */
  temperature?: number;
  tastes: Taste[];
  behaviour: Behaviour;
  /** Optional free text. Never the sole basis of a diagnosis. */
  notes?: string;
}

export interface BrewDiagnosis {
  method: Method;
  diagnosis: string;
  adjustment: {
    variable: 'grind' | 'dose' | 'yield' | 'time' | 'temperature' | 'technique';
    direction: 'increase' | 'decrease' | 'finer' | 'coarser' | 'improve';
    title: string;
  };
  keepConstant: string[];
  nextTarget: {
    dose?: number;
    yieldOut?: number;
    water?: number;
    timeMin?: number;
    timeMax?: number;
    temperature?: number;
  };
  reasons: string[];
  relatedContent: string[];
  ruleId: string;
  needsClarification: boolean;
  clarificationQuestion?: string;
}

/** A single recorded brew plus whatever the assistant suggested afterwards. */
export interface BrewAttempt {
  input: BrewInput;
  diagnosis: BrewDiagnosis;
  at: string;
  helpful?: 'yes' | 'not_yet';
}

export interface BrewSession {
  id: string;
  schemaVersion: 1;
  method: Method;
  attempts: BrewAttempt[];
  createdAt: string;
  updatedAt: string;
}
