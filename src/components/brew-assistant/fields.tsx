import type { ReactNode } from 'react';

/**
 * Shared controls for the wizard. Selected state is carried by aria-pressed or
 * a checked input, never by colour alone.
 */

export function ChoiceGroup({
  legend,
  hint,
  children,
  columns = 2,
}: {
  legend: string;
  hint?: string;
  children: ReactNode;
  columns?: 2 | 3;
}) {
  return (
    <fieldset>
      <legend className="font-medium">{legend}</legend>
      {hint && <p className="mt-1 text-sm text-ink-soft">{hint}</p>}
      <div
        className={`mt-3 grid gap-2 ${columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} grid-cols-2`}
      >
        {children}
      </div>
    </fieldset>
  );
}

export function ChoiceButton({
  selected,
  onClick,
  children,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-11 items-center gap-2 rounded-md border px-4 py-2.5 text-left text-sm transition-colors ${
        selected
          ? 'border-accent bg-accent/8 font-medium'
          : 'border-line bg-card hover:border-ink/30'
      } ${disabled ? 'cursor-not-allowed text-ink-soft' : ''}`}
    >
      <span
        aria-hidden="true"
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          selected ? 'border-accent bg-accent text-accent-ink' : 'border-line'
        }`}
      >
        {selected && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
            <path d="m5 13 4 4L19 7" />
          </svg>
        )}
      </span>
      {children}
    </button>
  );
}

export function NumberField({
  id,
  label,
  unit,
  value,
  onChange,
  issue,
  autoFocus,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (next: string) => void;
  issue?: { severity: 'error' | 'warning'; message: string };
  autoFocus?: boolean;
}) {
  const describedBy = issue ? `${id}-issue` : undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={issue?.severity === 'error' || undefined}
          aria-describedby={describedBy}
          className="w-full min-w-0 rounded-md border border-line bg-card px-3.5 py-2.5 text-sm"
        />
        <span className="shrink-0 text-sm text-ink-soft" aria-hidden="true">
          {unit}
        </span>
      </div>
      {issue && (
        <p
          id={describedBy}
          className={`mt-1.5 text-sm ${issue.severity === 'error' ? 'text-accent' : 'text-ink-soft'}`}
        >
          {issue.severity === 'error' ? 'Error: ' : 'Note: '}
          {issue.message}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-md border border-line bg-card px-3.5 py-2.5 text-sm"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
