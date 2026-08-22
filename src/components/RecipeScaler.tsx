import { useEffect, useMemo, useState } from 'react';
import { trackRetentionEvent } from '../lib/analytics';
import {
  espressoShotInstruction,
  espressoShotPlan,
  formatIngredients,
  formatQuantity,
  parseRecipeSettings,
  type EspressoRecipe,
  type RecipeSettings,
  type RecipeSettingsEventDetail,
  type StructuredIngredient,
} from '../lib/recipe-scaling';
import {
  RETENTION_KEYS,
  getPreferences,
  setUnitPreference,
  subscribeRetentionKey,
} from '../lib/retention/storage';

interface Props {
  recipeSlug: string;
  ingredients: StructuredIngredient[];
  espresso?: EspressoRecipe;
  servingNote?: string;
}

const servingsOptions = [1, 2, 3] as const;

export default function RecipeScaler({ recipeSlug, ingredients, espresso, servingNote }: Props) {
  const [settings, setSettings] = useState<RecipeSettings>({
    servings: 1,
    units: 'metric',
    ...(espresso ? { dose: espresso.dose } : {}),
  });
  const [hydrated, setHydrated] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    setSettings(parseRecipeSettings(window.location.search, getPreferences().units, espresso));
    setHydrated(true);
    return subscribeRetentionKey(RETENTION_KEYS.preferences, () => {
      setSettings((current) => ({ ...current, units: getPreferences().units }));
    });
  }, [espresso]);

  const ingredientLines = useMemo(
    () => formatIngredients(ingredients, settings, espresso),
    [espresso, ingredients, settings],
  );
  const shotPlan =
    espresso && settings.dose !== undefined ? espressoShotPlan(settings, espresso) : undefined;
  const doseLabel =
    shotPlan
      ? formatQuantity(shotPlan.perShotDose, 'g', settings.units, 'coffee-dose')
      : undefined;
  const yieldLabel =
    shotPlan
      ? formatQuantity(shotPlan.perShotYield, 'g', settings.units, 'espresso-yield')
      : undefined;
  const totalDoseLabel = shotPlan
    ? formatQuantity(shotPlan.totalDose, 'g', settings.units, 'coffee-dose')
    : undefined;
  const totalYieldLabel = shotPlan
    ? formatQuantity(shotPlan.totalYield, 'g', settings.units, 'espresso-yield')
    : undefined;
  const shotInstruction =
    espresso && settings.servings > 1 ? espressoShotInstruction(settings, espresso) : undefined;

  useEffect(() => {
    if (!hydrated) return;
    const detail: RecipeSettingsEventDetail = {
      ...settings,
      ingredientLines,
      ...(doseLabel ? { doseLabel } : {}),
      ...(yieldLabel ? { yieldLabel } : {}),
      ...(totalDoseLabel ? { totalDoseLabel } : {}),
      ...(totalYieldLabel ? { totalYieldLabel } : {}),
      ...(shotInstruction ? { shotInstruction } : {}),
    };
    window.dispatchEvent(new CustomEvent('kavovo:recipe-settings', { detail }));
  }, [
    doseLabel,
    hydrated,
    ingredientLines,
    settings,
    shotInstruction,
    totalDoseLabel,
    totalYieldLabel,
    yieldLabel,
  ]);

  function changeServings(servings: 1 | 2 | 3) {
    setSettings((current) => ({ ...current, servings }));
    setAnnouncement(`Ingredients updated for ${servings}× servings.`);
    trackRetentionEvent('recipe_servings_changed', {
      recipe_slug: recipeSlug,
      servings,
    });
  }

  function changeUnits(units: 'metric' | 'us') {
    setSettings((current) => ({ ...current, units }));
    setUnitPreference(units);
    setAnnouncement(`Units changed to ${units === 'metric' ? 'Metric' : 'US customary'}.`);
    trackRetentionEvent('recipe_units_changed', { recipe_slug: recipeSlug, units });
  }

  function changeDose(value: number, track = false) {
    if (!espresso || !Number.isFinite(value)) return;
    const dose = Math.min(60, Math.max(5, Math.round(value * 10) / 10));
    setSettings((current) => ({ ...current, dose }));
    setAnnouncement(`Coffee dose updated to ${dose.toFixed(1)} grams.`);
    if (track) trackRetentionEvent('espresso_dose_changed', { recipe_slug: recipeSlug });
  }

  return (
    <section
      className="recipe-block"
      data-recipe-scaler
      data-servings={settings.servings}
      data-units={settings.units}
      data-dose={settings.dose}
    >
      <h2 className="font-display text-xl font-medium">Ingredients</h2>
      <div className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-4 print:hidden">
        <fieldset>
          <legend className="text-xs font-medium text-ink-soft">Servings</legend>
          <div className="mt-1 inline-grid grid-cols-3 overflow-hidden rounded-md border border-line bg-card">
            {servingsOptions.map((servings) => (
              <button
                key={servings}
                type="button"
                data-servings-option={servings}
                onClick={() => changeServings(servings)}
                aria-pressed={settings.servings === servings}
                className="min-h-11 min-w-14 border-l border-line px-3 text-sm font-semibold first:border-l-0 aria-pressed:bg-accent aria-pressed:text-accent-ink"
              >
                {servings}×
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs font-medium text-ink-soft">Units</legend>
          <div className="mt-1 inline-grid grid-cols-2 overflow-hidden rounded-md border border-line bg-card">
            <button
              type="button"
              data-units-option="metric"
              onClick={() => changeUnits('metric')}
              aria-pressed={settings.units === 'metric'}
              className="min-h-11 border-r border-line px-3 text-sm font-semibold aria-pressed:bg-accent aria-pressed:text-accent-ink"
            >
              Metric
            </button>
            <button
              type="button"
              data-units-option="us"
              onClick={() => changeUnits('us')}
              aria-pressed={settings.units === 'us'}
              className="min-h-11 px-3 text-sm font-semibold aria-pressed:bg-accent aria-pressed:text-accent-ink"
            >
              US customary
            </button>
          </div>
        </fieldset>
      </div>

      {espresso && settings.dose !== undefined && (
        <div className="mt-5 border-y border-line py-4">
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-sm font-medium">
              Coffee dose
              <span className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min="5"
                  max="60"
                  step="0.1"
                  value={settings.dose}
                  onChange={(event) => changeDose(event.currentTarget.valueAsNumber)}
                  onBlur={(event) => changeDose(event.currentTarget.valueAsNumber, true)}
                  className="h-11 w-24 rounded-md border border-line bg-card px-3 font-mono text-sm"
                />
                <span className="text-ink-soft">g</span>
              </span>
            </label>
            <p className="pb-2 text-sm text-ink-soft">Ratio 1:{espresso.ratio}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2" aria-label="Espresso shot plan">
            <div className="rounded-md border border-line bg-card p-3">
              <p className="text-xs font-medium text-ink-soft">Per shot</p>
              <p className="mt-1 font-mono text-sm font-semibold text-ink">
                {doseLabel} in <span aria-hidden="true">&#8594;</span> {yieldLabel} out
              </p>
            </div>
            {settings.servings > 1 && (
              <div className="rounded-md border border-line bg-card p-3">
                <p className="text-xs font-medium text-ink-soft">
                  Total for {settings.servings} servings
                </p>
                <p className="mt-1 font-mono text-sm font-semibold text-ink">
                  {totalDoseLabel} coffee <span aria-hidden="true">&#8594;</span>{' '}
                  {totalYieldLabel} espresso
                </p>
              </div>
            )}
          </div>
          {shotInstruction && (
            <p className="mt-3 text-sm font-medium leading-relaxed text-ink">{shotInstruction}</p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-ink-soft">
            Keep the same target time and adjust the grind if needed.
          </p>
        </div>
      )}

      {servingNote && settings.servings > 1 && (
        <p className="mt-4 text-xs leading-relaxed text-ink-soft">{servingNote}</p>
      )}

      <p className="mt-3 hidden text-xs text-ink-soft print:block">
        {settings.servings}× · {settings.units === 'metric' ? 'Metric' : 'US customary'}
        {settings.dose !== undefined ? ` · ${settings.dose.toFixed(1)} g coffee dose` : ''}
      </p>
      <ul className="mt-4 flex flex-col gap-2 text-sm text-ink-soft" data-recipe-ingredients>
        {ingredientLines.map((item, index) => (
          <li key={`${index}-${ingredients[index]?.name}`} className="border-b border-line pb-2">
            {item}
          </li>
        ))}
      </ul>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
