import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import RetentionRecipeCard, { type RetentionRecipe } from './RetentionRecipeCard';

const recipe: RetentionRecipe = {
  slug: 'flat-white',
  title: 'Flat White Coffee Recipe',
  image: {
    src: '/img/flat-white.jpg',
    srcset: '/img/flat-white.webp 400w',
    width: 400,
    height: 300,
  },
  imageAlt: 'A flat white in a ceramic cup.',
  category: 'milk-drinks',
  activeTime: 5,
  totalTime: 5,
};

describe('retention recipe card', () => {
  it('uses an H2 and exposes the remove action on the Saved page', () => {
    const html = renderToStaticMarkup(
      <RetentionRecipeCard recipe={recipe} headingLevel="h2" onRemove={() => {}} />,
    );

    expect(html).toContain('<h2');
    expect(html).toContain('Flat White Coffee Recipe</h2>');
    expect(html).toContain('Remove from saved');
    expect(html).toContain('aria-label="Remove Flat White Coffee Recipe from saved recipes"');
  });

  it('keeps H3 as the default inside the Recently viewed section', () => {
    const html = renderToStaticMarkup(<RetentionRecipeCard recipe={recipe} />);

    expect(html).toContain('<h3');
    expect(html).toContain('Flat White Coffee Recipe</h3>');
  });
});
