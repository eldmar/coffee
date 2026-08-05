import { useState } from 'react';

export interface FinderRecipe {
  slug: string;
  title: string;
  image: string;
  category: string;
  brewMethod: string;
  temperature: string;
  milk: string;
  time: number;
  difficulty: string;
}

interface Props {
  recipes: FinderRecipe[];
}

const methodOptions = [
  ['any', 'Any method'],
  ['espresso', 'Espresso machine'],
  ['aeropress', 'AeroPress'],
  ['v60', 'V60 / pour over'],
  ['french-press', 'French press'],
  ['moka-pot', 'Moka pot'],
  ['cold-brew', 'Cold brew'],
] as const;

const tempOptions = [
  ['any', 'Any'],
  ['hot', 'Hot'],
  ['iced', 'Iced'],
] as const;

const milkOptions = [
  ['any', 'Any'],
  ['black', 'Black'],
  ['milk', 'With milk'],
] as const;

const selectClass =
  'w-full appearance-none rounded-md border border-line bg-card px-3.5 py-2.5 pr-9 text-sm text-ink outline-none transition-colors focus:border-accent';

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex-1">
      <span className="mb-2 flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </span>
      <span className="relative block">
        {children}
        <svg
          className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-ink-soft"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </label>
  );
}

export default function RecipeFinder({ recipes }: Props) {
  const [method, setMethod] = useState('any');
  const [temp, setTemp] = useState('any');
  const [milk, setMilk] = useState('any');
  const [results, setResults] = useState<FinderRecipe[] | null>(null);

  function search(e: React.FormEvent) {
    e.preventDefault();
    setResults(
      recipes.filter(
        (r) =>
          (method === 'any' || r.brewMethod === method) &&
          (temp === 'any' || r.temperature === temp) &&
          (milk === 'any' || r.milk === milk),
      ),
    );
  }

  return (
    <div className="rounded-xl border border-line bg-card p-6 shadow-sm md:p-8">
      <h2 className="font-display text-2xl font-medium">What do you want to make?</h2>
      <form onSubmit={search} className="mt-5 flex flex-col gap-4 md:flex-row md:items-end">
        <Field
          label="Brew method"
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M7 3h10l-1.5 6h-7L7 3Z" />
              <path d="M10 9v4m4-4v4m-5 8a3 3 0 0 1 6 0Z" />
            </svg>
          }
        >
          <select className={selectClass} value={method} onChange={(e) => setMethod(e.target.value)}>
            {methodOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Hot or iced"
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M10 4a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0V4Z" />
            </svg>
          }
        >
          <select className={selectClass} value={temp} onChange={(e) => setTemp(e.target.value)}>
            {tempOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Black or with milk"
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M4 8h12v7a5 5 0 0 1-10 0V8Z" />
              <path d="M16 9h2a2.5 2.5 0 0 1 0 5h-2" />
            </svg>
          }
        >
          <select className={selectClass} value={milk} onChange={(e) => setMilk(e.target.value)}>
            {milkOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <button
          type="submit"
          className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium whitespace-nowrap text-accent-ink transition-colors hover:bg-accent-dark"
        >
          Show me recipes
        </button>
      </form>

      {results && (
        <div className="mt-6 border-t border-line pt-6">
          {results.length === 0 ? (
            <p className="text-sm text-ink-soft">
              No exact match yet — try loosening one filter, or{' '}
              <a href="/recipes/" className="font-medium text-accent hover:underline">
                browse all recipes
              </a>
              .
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((r) => (
                <li key={r.slug}>
                  <a
                    href={`/recipes/${r.slug}/`}
                    className="group flex items-center gap-3 rounded-lg border border-line p-3 transition-colors hover:border-accent"
                  >
                    <img src={r.image} alt="" className="h-12 w-12 rounded-md object-cover" width="48" height="48" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{r.title}</span>
                      <span className="block text-xs text-ink-soft">
                        {r.time} min · {r.difficulty}
                      </span>
                    </span>
                    <span className="ml-auto text-accent transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                      &#8594;
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
