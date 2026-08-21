import type { CardImage } from '../../lib/cardImage';
import { categoryLabel, formatTimeShort } from '../../lib/recipes';

export interface RetentionRecipe {
  slug: string;
  title: string;
  image: CardImage;
  imageAlt: string;
  category: string;
  activeTime: number;
  totalTime: number;
  totalTimeLabel?: string;
}

interface Props {
  recipe: RetentionRecipe;
  onOpen?: () => void;
  onRemove?: () => void;
}

export default function RetentionRecipeCard({ recipe, onOpen, onRemove }: Props) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-line bg-card transition-shadow hover:shadow-md">
      <a href={`/recipes/${recipe.slug}/`} onClick={onOpen} className="group flex flex-1 flex-col">
        <img
          src={recipe.image.src}
          srcSet={recipe.image.srcset}
          sizes="(min-width: 1024px) 270px, (min-width: 640px) 45vw, 92vw"
          alt={recipe.imageAlt}
          className="aspect-[4/3] w-full bg-line object-cover"
          width={recipe.image.width}
          height={recipe.image.height}
          loading="lazy"
          decoding="async"
        />
        <span className="flex flex-1 flex-col gap-1.5 p-5">
          <span className="eyebrow">{categoryLabel(recipe.category)}</span>
          <h3 className="font-display text-xl font-medium">{recipe.title}</h3>
          <span className="mt-auto flex items-center gap-2 pt-2 text-sm text-ink-soft">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            {formatTimeShort(recipe)}
            <span className="ml-auto text-accent transition-transform group-hover:translate-x-1" aria-hidden="true">
              &#8594;
            </span>
          </span>
        </span>
      </a>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="min-h-11 border-t border-line px-5 text-left text-sm font-medium text-ink-soft transition-colors hover:bg-ivory hover:text-ink"
          aria-label={`Remove ${recipe.title} from saved recipes`}
        >
          Remove from saved
        </button>
      )}
    </article>
  );
}
