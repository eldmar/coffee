/**
 * Post-build guard.
 *
 * Astro silently falls back to an on-demand image endpoint when sharp is not
 * usable during the build. On a static host those /_image/ URLs 404 and every
 * photo disappears — which is exactly what shipped once. This turns that
 * silent degradation into a failed build, and also catches any asset the HTML
 * references but the build never emitted.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// --warn-only reports problems without failing the build. Used on the host
// while we work out why its environment differs from a clean local build.
const warnOnly = process.argv.includes('--warn-only');
const DIST = 'dist';
const problems = [];

function htmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(path));
    else if (entry.name.endsWith('.html')) out.push(path);
  }
  return out;
}

const pages = htmlFiles(DIST);
if (pages.length === 0) {
  problems.push(
    'no HTML pages in dist/ — the build produced a server bundle rather than a static site',
  );
}
console.log(`Checking ${pages.length} pages in ${DIST}/`);

const missingAssets = new Set();
let onDemandImages = 0;
let recipeSchemas = 0;
let faqSchemas = 0;
const indexableSeo = [];
const recipeGuideLabels = new Set();

function decodeHtml(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/&#32;/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function visibleText(html) {
  return decodeHtml(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function schemasIn(html) {
  return [...html.matchAll(
    /<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  )].flatMap((match) => {
    try {
      return [JSON.parse(match[1])];
    } catch {
      return [];
    }
  });
}

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const label = relative(DIST, page);
  const text = visibleText(html);

  const title = decodeHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim();
  const description = decodeHtml(
    html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ?? '',
  ).trim();
  const canonical = decodeHtml(
    html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1] ?? '',
  ).trim();
  const noindex = /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html);

  if (!title) problems.push(`${label} is missing a title`);
  if (!description) problems.push(`${label} is missing a meta description`);
  if (!/^https:\/\/kavovo\.uk\//.test(canonical)) {
    problems.push(`${label} is missing an absolute kavovo.uk canonical URL`);
  }
  for (const tag of ['og:title', 'og:description', 'og:url', 'og:image']) {
    if (!html.includes(`property="${tag}"`)) problems.push(`${label} is missing ${tag}`);
  }
  for (const tag of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
    if (!html.includes(`name="${tag}"`)) problems.push(`${label} is missing ${tag}`);
  }
  if (!noindex) indexableSeo.push({ label, title, description, canonical });

  const headings = [...html.matchAll(/<h([1-6])\b/gi)].map((match) => Number(match[1]));
  const h1Count = headings.filter((level) => level === 1).length;
  if (h1Count !== 1) {
    problems.push(`${relative(DIST, page)} has ${h1Count} h1 elements; expected exactly one`);
  }
  for (let index = 1; index < headings.length; index += 1) {
    if (headings[index] > headings[index - 1] + 1) {
      problems.push(
        `${relative(DIST, page)} skips heading level h${headings[index - 1]} to h${headings[index]}`,
      );
      break;
    }
  }

  const onDemand = html.match(/\/_image\/\?href=/g);
  if (onDemand) {
    onDemandImages += onDemand.length;
    problems.push(
      `${relative(DIST, page)} references ${onDemand.length} on-demand image URL(s) — sharp did not run during the build`,
    );
  }

  for (const match of html.matchAll(/(?:src|href)="(\/(?:_astro|img)\/[^"?#]+)"/g)) {
    if (!existsSync(join(DIST, match[1]))) missingAssets.add(match[1]);
  }
  for (const match of html.matchAll(/srcset="([^"]+)"/gi)) {
    for (const candidate of match[1].split(',')) {
      const url = candidate.trim().split(/\s+/)[0];
      if (/^\/(?:_astro|img)\//.test(url) && !existsSync(join(DIST, url))) missingAssets.add(url);
    }
  }

  const recipeGuideBlock = html.match(
    /<p\b[^>]*data-recipe-guide-link[^>]*>([\s\S]*?)<\/p>/i,
  );
  if (recipeGuideBlock) {
    const rendered = visibleText(recipeGuideBlock[1]);
    const guideLink = recipeGuideBlock[1].match(
      /<a\b[^>]*href="(\/guides\/([^"]+)\/)"[^>]*>([\s\S]*?)<\/a>/i,
    );
    const guideLabel = visibleText(guideLink?.[3] ?? '');
    const expected = `New to this method? The ${guideLabel} covers the technique behind this recipe.`;

    if (!guideLink) problems.push(`${label} recipe guide link is not clickable`);
    if (rendered !== expected) {
      problems.push(`${label} has malformed recipe guide text: ${rendered}`);
    }
    if (!/The <a\b/i.test(recipeGuideBlock[1]) || !/<\/a> covers/i.test(recipeGuideBlock[1])) {
      problems.push(`${label} recipe guide link is missing physical SSR spaces`);
    }
    if (/The(?:Espresso|V60|AeroPress|French Press|Moka Pot)|guidecovers/.test(rendered)) {
      problems.push(`${label} recipe guide text contains joined words`);
    }
    if (guideLabel) recipeGuideLabels.add(guideLabel);
  }

  for (const match of html.matchAll(
    /<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    let schema;
    try {
      schema = JSON.parse(match[1]);
    } catch {
      problems.push(`${relative(DIST, page)} contains invalid JSON-LD`);
      continue;
    }
    if (schema?.['@type'] === 'FAQPage') {
      faqSchemas += 1;
      if (!Array.isArray(schema.mainEntity) || schema.mainEntity.length === 0) {
        problems.push(`${label} FAQPage schema has no questions`);
        continue;
      }
      for (const [index, item] of schema.mainEntity.entries()) {
        const question = item?.name;
        const answer = item?.acceptedAnswer?.text;
        if (item?.['@type'] !== 'Question' || typeof question !== 'string') {
          problems.push(`${label} FAQ item ${index + 1} is not a named Question`);
          continue;
        }
        if (item?.acceptedAnswer?.['@type'] !== 'Answer' || typeof answer !== 'string') {
          problems.push(`${label} FAQ item ${index + 1} has no accepted Answer`);
          continue;
        }
        if (!text.includes(question) || !text.includes(answer)) {
          problems.push(`${label} FAQ item ${index + 1} is not fully visible on the page`);
        }
      }
      continue;
    }
    if (schema?.['@type'] !== 'Recipe') continue;
    recipeSchemas += 1;
    if (!html.includes('data-recipe-experience')) {
      problems.push(`${label} is missing the interactive recipe experience`);
    }
    if (!html.includes('Tap each step as you brew.')) {
      problems.push(`${label} is missing the step checklist prompt`);
    }
    if (!html.includes('data-open-brew-mode') || !html.includes('data-brew-time')) {
      problems.push(`${label} is missing brew mode or its timer`);
    }
    if (!html.includes('Keep screen awake')) {
      problems.push(`${label} is missing the optional screen wake control`);
    }
    if (typeof schema.keywords !== 'string' || schema.keywords.trim().length === 0) {
      problems.push(`${label} Recipe schema is missing keywords`);
    }
    for (const field of [
      'name',
      'description',
      'image',
      'author',
      'datePublished',
      'dateModified',
      'prepTime',
      'totalTime',
      'recipeYield',
      'recipeCategory',
    ]) {
      if (!schema[field]) problems.push(`${label} Recipe schema is missing ${field}`);
    }
    if (!Array.isArray(schema.recipeIngredient) || schema.recipeIngredient.length === 0) {
      problems.push(`${label} Recipe schema is missing recipeIngredient`);
    }
    if ('aggregateRating' in schema || 'review' in schema || 'nutrition' in schema) {
      problems.push(`${label} Recipe schema contains unsupported rating, review or nutrition data`);
    }
    if (!Array.isArray(schema.recipeInstructions) || schema.recipeInstructions.length === 0) {
      problems.push(`${label} Recipe schema is missing recipeInstructions`);
      continue;
    }
    for (const [index, step] of schema.recipeInstructions.entries()) {
      if (step?.['@type'] !== 'HowToStep') {
        problems.push(`${label} instruction ${index + 1} is not a HowToStep`);
        continue;
      }
      if (typeof step.name !== 'string' || step.name.trim().length === 0) {
        problems.push(`${label} instruction ${index + 1} is missing a descriptive name`);
      }
      if (typeof step.text !== 'string' || step.text.trim().length === 0) {
        problems.push(`${label} instruction ${index + 1} is missing text`);
      }
      const fragment = typeof step.url === 'string' ? step.url.split('#')[1] : '';
      if (!fragment || !html.includes(`id="${fragment}"`)) {
        problems.push(`${label} instruction ${index + 1} URL does not target a rendered step`);
      }
    }
  }
}

for (const guideLabel of [
  'Espresso brew guide',
  'AeroPress brew guide',
  'V60 brew guide',
  'French Press brew guide',
  'Moka Pot brew guide',
]) {
  if (!recipeGuideLabels.has(guideLabel)) {
    problems.push(`shared recipe guide block was not exercised for ${guideLabel}`);
  }
}

for (const [pathSegments, imageName] of [
  [['recipes'], 'recipes.webp'],
  [['guides'], 'brew-guides.webp'],
  [['learn'], 'learn.webp'],
  [['journal'], 'journal.webp'],
  [['recipes', 'filter-coffee'], 'filter-coffee-recipes.webp'],
]) {
  const imagePath = join('public', 'social', imageName);
  const pagePath = join(DIST, ...pathSegments, 'index.html');
  const label = pathSegments.join('/');
  if (!existsSync(imagePath)) {
    problems.push(`${label} is missing social image ${imageName}`);
    continue;
  }
  if (statSync(imagePath).size >= 250 * 1024) {
    problems.push(`${imageName} exceeds the 250 KB social image limit`);
  }
  if (!existsSync(pagePath)) continue;
  const html = readFileSync(pagePath, 'utf8');
  const expectedUrl = `https://kavovo.uk/social/${imageName}`;
  if (!html.includes(`<meta property="og:image" content="${expectedUrl}">`)) {
    problems.push(`${label} does not use ${imageName} for og:image`);
  }
  if (!html.includes(`<meta name="twitter:image" content="${expectedUrl}">`)) {
    problems.push(`${label} does not use ${imageName} for twitter:image`);
  }
}

for (const key of ['title', 'description', 'canonical']) {
  const seen = new Map();
  for (const entry of indexableSeo) {
    const existing = seen.get(entry[key]);
    if (existing) {
      problems.push(`duplicate ${key} on ${existing} and ${entry.label}`);
    } else {
      seen.set(entry[key], entry.label);
    }
  }
}

function checkPageSeo(pathSegments, expected) {
  const page = join(DIST, ...pathSegments, 'index.html');
  const label = pathSegments.join('/');
  if (!existsSync(page)) {
    problems.push(`${label} was not built`);
    return;
  }

  const html = readFileSync(page, 'utf8');
  const title = decodeHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim();
  const description = decodeHtml(
    html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ?? '',
  ).trim();
  const h1 = visibleText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '');

  if (title !== expected.title) problems.push(`${label} has incorrect SEO title: ${title}`);
  if (expected.description && description !== expected.description) {
    problems.push(`${label} has incorrect meta description`);
  }
  if (expected.h1 && h1 !== expected.h1) problems.push(`${label} has incorrect h1: ${h1}`);
  if (/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html)) {
    problems.push(`${label} was accidentally marked noindex`);
  }
}

for (const [pathSegments, expected] of [
  [
    ['recipes', 'iced-americano'],
    {
      title: 'Iced Americano Recipe: Ratio & Optional Milk | KAVOVO',
      description:
        'Make a refreshing Iced Americano with espresso, cold water and ice. Includes the exact ratio, optional milk and simple step-by-step instructions.',
      h1: 'Iced Americano Recipe',
    },
  ],
  [
    ['recipes', 'iced-latte'],
    {
      title: 'Iced Latte Recipe: Espresso, Milk & Ice | KAVOVO',
      description:
        'Learn how to make an Iced Latte with espresso, cold milk and ice. Get the exact ratio, easy steps and variations for a café-style drink at home.',
      h1: 'Iced Latte Recipe',
    },
  ],
  [
    ['recipes', 'irish-coffee'],
    {
      title: 'Irish Coffee Recipe: Ingredients, Whiskey & Cream | KAVOVO',
      description:
        'Make a classic Irish Coffee with hot coffee, Irish whiskey, sugar and softly whipped cream. Includes exact ingredients and tips for floating the cream.',
      h1: 'Classic Irish Coffee Recipe',
    },
  ],
  [
    ['learn', 'coffee-basics', 'coffee-to-water-ratio'],
    {
      title: 'Coffee-to-Water Ratio Calculator & Brew Guide | KAVOVO',
      description:
        'Use our coffee-to-water ratio calculator and brew chart for espresso, French press, AeroPress, pour over, Moka Pot and cold brew.',
      h1: 'Coffee-to-Water Ratio Calculator',
    },
  ],
  [
    ['learn', 'coffee-basics', 'filter-coffee'],
    {
      title: 'How to Make Filter Coffee: Ratio, Grind & Methods | KAVOVO',
      description:
        'Learn how to make filter coffee with the right ratio, grind size and water temperature. Includes V60, drip machine, Chemex and AeroPress methods.',
      h1: 'How to Make Filter Coffee',
    },
  ],
  [
    ['recipes', 'filter-coffee'],
    {
      title: 'Filter Coffee Recipes: V60, AeroPress & French Press | KAVOVO',
      description:
        'Browse filter coffee recipes for V60, AeroPress and French Press. Compare brew time, grind size and cup style, then choose the right method for your routine.',
      h1: 'Filter Coffee Recipes',
    },
  ],
  [
    ['recipes', 'iced-coffee'],
    {
      title: 'Iced Coffee Recipes: Easy Drinks to Make at Home | KAVOVO',
      description:
        'Explore easy iced coffee recipes including Iced Americano, Iced Latte, shaken espresso, Cold Brew, Espresso Tonic and flavoured coffee drinks.',
      h1: 'Iced Coffee Recipes',
    },
  ],
  [
    ['recipes', 'iced-caramel-latte'],
    {
      title: 'Iced Caramel Latte Recipe at Home | KAVOVO',
      description:
        'Make an Iced Caramel Latte with espresso, cold milk, ice and caramel syrup. Includes exact measurements and an easy less-sweet variation.',
    },
  ],
  [
    ['recipes', 'americano'],
    {
      title: 'Americano Recipe: Espresso & Hot Water Ratio | KAVOVO',
      description:
        'Make a hot Americano with double espresso and water. Includes the ideal espresso-to-water ratio and the difference between Americano and Long Black.',
      h1: 'Americano Recipe',
    },
  ],
  [
    ['recipes', 'flat-white'],
    {
      title: 'Flat White Coffee Recipe: Ratio, Size & Milk | KAVOVO',
      description:
        'Make a Flat White with a double espresso and silky microfoam. Learn the correct ratio, cup size and differences from a latte or cappuccino.',
      h1: 'Flat White Coffee Recipe',
    },
  ],
  [['recipes', 'cortado'], { title: 'Cortado Coffee Recipe: Ratio, Size & Milk | KAVOVO' }],
  [['recipes', 'cappuccino'], { title: 'Cappuccino Recipe: Espresso-to-Milk Ratio | KAVOVO' }],
  [['recipes', 'caffe-mocha'], { title: 'Caffè Mocha Recipe: Chocolate, Espresso & Milk | KAVOVO' }],
  [
    ['learn', 'understand-your-beans', 'arabica-vs-robusta'],
    { title: 'Arabica vs Robusta: Taste, Caffeine & Price | KAVOVO' },
  ],
]) {
  checkPageSeo(pathSegments, expected);
}

for (const [slug, expectedFaqs] of [
  ['iced-americano', 5],
  ['iced-latte', 5],
  ['irish-coffee', 6],
  ['americano', 5],
  ['flat-white', 5],
]) {
  const page = join(DIST, 'recipes', slug, 'index.html');
  if (!existsSync(page)) continue;
  const schemas = schemasIn(readFileSync(page, 'utf8'));
  const types = schemas.map((schema) => schema?.['@type']);
  for (const type of ['Recipe', 'FAQPage', 'BreadcrumbList']) {
    if (!types.includes(type)) problems.push(`recipes/${slug} is missing ${type} schema`);
  }
  const faq = schemas.find((schema) => schema?.['@type'] === 'FAQPage');
  if (faq?.mainEntity?.length !== expectedFaqs) {
    problems.push(`recipes/${slug} should expose exactly ${expectedFaqs} visible FAQ items`);
  }
  if (slug === 'irish-coffee') {
    const recipeSchema = schemas.find((schema) => schema?.['@type'] === 'Recipe');
    if (recipeSchema?.recipeInstructions?.length !== 7) {
      problems.push('recipes/irish-coffee should expose exactly seven recipe steps');
    }
  }
}

const filterCoffeePage = join(DIST, 'learn', 'coffee-basics', 'filter-coffee', 'index.html');
if (existsSync(filterCoffeePage)) {
  const html = readFileSync(filterCoffeePage, 'utf8');
  const schemas = schemasIn(html);
  for (const type of ['Article', 'LearningResource', 'FAQPage', 'BreadcrumbList']) {
    if (!schemas.some((schema) => {
      const schemaType = schema?.['@type'];
      return schemaType === type || (Array.isArray(schemaType) && schemaType.includes(type));
    })) {
      problems.push(`filter coffee guide is missing ${type} schema`);
    }
  }
  const faq = schemas.find((schema) => schema?.['@type'] === 'FAQPage');
  if (faq?.mainEntity?.length !== 6) {
    problems.push('filter coffee guide should expose exactly six visible FAQ items');
  }
  for (const marker of [
    'Best Coffee-to-Water Ratio for Filter Coffee',
    'Filter Coffee Methods',
    'Basic Filter Coffee Recipe',
    'Filter Coffee vs Americano',
    'Common Filter Coffee Problems',
  ]) {
    if (!html.includes(marker)) problems.push(`filter coffee guide is missing section: ${marker}`);
  }
  for (const href of [
    '/learn/coffee-basics/coffee-to-water-ratio/',
    '/recipes/aeropress-daily/',
    '/recipes/classic-french-press/',
    '/recipes/americano/',
    '/learn/coffee-basics/grind-size/',
    '/learn/coffee-basics/brewing-temperature/',
    '/learn/understand-your-beans/coffee-freshness-roast-dates/',
    '/recipes/filter-coffee/',
  ]) {
    if (!html.includes(`href="${href}"`)) {
      problems.push(`filter coffee guide is missing internal link: ${href}`);
    }
  }
} else {
  problems.push('Filter Coffee guide was not built');
}

const filterRecipesPage = join(DIST, 'recipes', 'filter-coffee', 'index.html');
if (existsSync(filterRecipesPage)) {
  const html = readFileSync(filterRecipesPage, 'utf8');
  const schemas = schemasIn(html);
  for (const type of ['CollectionPage', 'ItemList', 'FAQPage', 'BreadcrumbList']) {
    if (!schemas.some((schema) => schema?.['@type'] === type)) {
      problems.push(`filter coffee recipe hub is missing ${type} schema`);
    }
  }
  const itemList = schemas.find((schema) => schema?.['@type'] === 'ItemList');
  if (itemList?.numberOfItems !== 3 || itemList?.itemListElement?.length !== 3) {
    problems.push('filter coffee recipe hub should expose exactly three recipes');
  }
  const faq = schemas.find((schema) => schema?.['@type'] === 'FAQPage');
  if (faq?.mainEntity?.length !== 4) {
    problems.push('filter coffee recipe hub should expose exactly four visible FAQ items');
  }
  for (const marker of [
    'Compare Filter Coffee Methods',
    'Clean and bright',
    'Clean to full-bodied',
    'Rich and textured',
    'New to filter coffee?',
  ]) {
    if (!html.includes(marker)) problems.push(`filter coffee recipe hub is missing: ${marker}`);
  }
  if (!html.includes('href="/learn/coffee-basics/filter-coffee/"')) {
    problems.push('filter coffee recipe hub is missing its Learn guide link');
  }
} else {
  problems.push('Filter Coffee recipe hub was not built');
}

const v60GuidePage = join(DIST, 'guides', 'v60', 'index.html');
if (existsSync(v60GuidePage)) {
  const html = readFileSync(v60GuidePage, 'utf8');
  if (!html.includes('href="#quick-start"') || !html.includes('Jump to quick start')) {
    problems.push('guides/v60/index.html is missing the hero quick-start shortcut');
  }
  if (!html.includes('<details id="guide-toc"')) {
    problems.push('guides/v60/index.html is missing the responsive table of contents');
  }
}

for (const [slug, baseCups] of [
  ['v60-pour-over', 1],
  ['aeropress-daily', 1],
  ['classic-french-press', 2],
]) {
  const recipePage = join(DIST, 'recipes', slug, 'index.html');
  if (!existsSync(recipePage)) continue;
  const html = readFileSync(recipePage, 'utf8');
  if (!html.includes(`data-base-cups="${baseCups}"`)) {
    problems.push(`recipes/${slug}/index.html is missing its base cup count`);
  }
  for (const cups of [1, 2, 3]) {
    if (!html.includes(`data-cups="${cups}"`)) {
      problems.push(`recipes/${slug}/index.html is missing the ${cups}-cup option`);
    }
  }
}

const searchPage = join(DIST, 'search', 'index.html');
if (existsSync(searchPage)) {
  const html = readFileSync(searchPage, 'utf8');
  if (!/<meta name="robots" content="noindex, follow">/i.test(html)) {
    problems.push('search/index.html is missing noindex, follow');
  }
  if (!/<link rel="canonical" href="https?:\/\/[^"?]+\/search\/">/i.test(html)) {
    problems.push('search/index.html canonical is not the query-free /search/ URL');
  }
  if (!html.includes('placeholder="Search all KAVOVO"')) {
    problems.push('search/index.html is missing the global search placeholder');
  }
  if (!html.includes('aria-label="Filter search results by content type"')) {
    problems.push('search/index.html is missing content-type search filters');
  }
}

const recipesPage = join(DIST, 'recipes', 'index.html');
if (existsSync(recipesPage)) {
  const html = readFileSync(recipesPage, 'utf8');
  if (!/placeholder="Search \d+ recipes"/.test(html)) {
    problems.push('recipes/index.html is missing its recipe-count search placeholder');
  }
  if (!html.includes('data-brew-widget-reveal="immediate"')) {
    problems.push('recipes/index.html floating brew widget should appear immediately');
  }
  if (!html.includes('bg-line object-cover')) {
    problems.push('recipes/index.html cards are missing image skeleton backgrounds');
  }
  if (!html.includes('Iced Salted Vanilla Cloud Foam')) {
    problems.push('recipes/index.html is missing Iced Salted Vanilla Cloud Foam');
  }
  if (!html.includes('Brown Sugar Shaken Espresso')) {
    problems.push('recipes/index.html is missing Brown Sugar Shaken Espresso');
  }
}

const homepage = join(DIST, 'index.html');
if (existsSync(homepage)) {
  const html = readFileSync(homepage, 'utf8');
  for (const marker of [
    'From the Journal',
    'View all Journal stories',
    'Ice Is an Ingredient: Why Your Iced Coffee Tastes Watery',
    'Why We Built KAVOVO',
  ]) {
    if (!html.includes(marker)) problems.push(`homepage Journal section is missing: ${marker}`);
  }
  if ((html.match(/Read the story/g) ?? []).length !== 2) {
    problems.push('homepage Journal section should show exactly two latest stories');
  }
}

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  if (!html.includes('data-brew-widget')) continue;
  if (
    !html.includes('aria-label="Fix my coffee"') ||
    !html.includes('aria-describedby="brew-widget-tooltip"') ||
    !html.includes('id="brew-widget-tooltip"')
  ) {
    problems.push(`${relative(DIST, page)} is missing the accessible Brew Assistant tooltip`);
  }
}

const cloudFoamPage = join(DIST, 'recipes', 'iced-salted-vanilla-cloud-foam', 'index.html');
if (existsSync(cloudFoamPage)) {
  const html = readFileSync(cloudFoamPage, 'utf8');
  if (!html.includes('<title>Iced Salted Vanilla Cloud Foam Recipe | KAVOVO</title>')) {
    problems.push('cloud foam recipe is missing its exact SEO title');
  }
  if (
    !/<link rel="canonical" href="https:\/\/kavovo\.uk\/recipes\/iced-salted-vanilla-cloud-foam\/">/i.test(
      html,
    )
  ) {
    problems.push('cloud foam recipe canonical URL is incorrect');
  }
  if (
    !/<meta property="og:image" content="https:\/\/kavovo\.uk\/img\/iced-salted-vanilla-cloud-foam\.[^"]+">/i.test(
      html,
    )
  ) {
    problems.push('cloud foam recipe is missing its Open Graph image');
  }

  const recipeScript = [...html.matchAll(
    /<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  )]
    .map((match) => JSON.parse(match[1]))
    .find((schema) => schema?.['@type'] === 'Recipe');
  if (
    recipeScript?.prepTime !== 'PT8M' ||
    recipeScript?.totalTime !== 'PT8M' ||
    recipeScript?.recipeYield !== '1 drink' ||
    recipeScript?.recipeCuisine !== 'International'
  ) {
    problems.push('cloud foam Recipe schema has incorrect time, yield or cuisine');
  }
  for (const keyword of [
    'iced salted vanilla cloud foam',
    'salted vanilla cold foam',
    'iced vanilla coffee',
    'vanilla cold foam recipe',
    'iced espresso recipe',
    'homemade cold foam',
  ]) {
    if (!recipeScript?.keywords?.includes(keyword)) {
      problems.push(`cloud foam Recipe schema is missing keyword: ${keyword}`);
    }
  }

  const relatedSlugs = ['iced-latte', 'iced-caramel-latte', 'vietnamese-iced-coffee'];
  const relatedStart = html.indexOf('Related recipes');
  const relatedPositions = relatedSlugs.map((slug) =>
    html.indexOf(`href="/recipes/${slug}/"`, relatedStart),
  );
  if (
    relatedStart === -1 ||
    relatedPositions.some((position) => position === -1) ||
    relatedPositions.some(
      (position, index) => index > 0 && position <= relatedPositions[index - 1],
    )
  ) {
    problems.push('cloud foam related recipes are missing or out of editorial order');
  }
} else {
  problems.push('Iced Salted Vanilla Cloud Foam recipe page was not built');
}

const shakenEspressoPage = join(DIST, 'recipes', 'brown-sugar-shaken-espresso', 'index.html');
if (existsSync(shakenEspressoPage)) {
  const html = readFileSync(shakenEspressoPage, 'utf8');
  if (!html.includes('<title>Brown Sugar Shaken Espresso Recipe | KAVOVO</title>')) {
    problems.push('brown sugar shaken espresso is missing its exact SEO title');
  }
  if (
    !/<link rel="canonical" href="https:\/\/kavovo\.uk\/recipes\/brown-sugar-shaken-espresso\/">/i.test(
      html,
    )
  ) {
    problems.push('brown sugar shaken espresso canonical URL is incorrect');
  }
  if (
    !/<meta property="og:image" content="https:\/\/kavovo\.uk\/img\/brown-sugar-shaken-espresso\.[^"]+">/i.test(
      html,
    )
  ) {
    problems.push('brown sugar shaken espresso is missing its Open Graph image');
  }
  if (!html.includes('<meta property="og:type" content="article">')) {
    problems.push('brown sugar shaken espresso should use the article Open Graph type');
  }

  const recipeScript = schemasIn(html).find((schema) => schema?.['@type'] === 'Recipe');
  if (
    recipeScript?.prepTime !== 'PT7M' ||
    recipeScript?.totalTime !== 'PT7M' ||
    recipeScript?.recipeYield !== '1 drink' ||
    recipeScript?.recipeCuisine !== 'International' ||
    recipeScript?.recipeInstructions?.length !== 6
  ) {
    problems.push('brown sugar shaken espresso Recipe schema has incorrect core fields');
  }
  for (const keyword of [
    'brown sugar shaken espresso',
    'iced shaken espresso',
    'shaken espresso recipe',
    'brown sugar iced coffee',
    'oat milk shaken espresso',
    'homemade shaken espresso',
  ]) {
    if (!recipeScript?.keywords?.includes(keyword)) {
      problems.push(`brown sugar shaken espresso Recipe schema is missing keyword: ${keyword}`);
    }
  }
  for (const href of [
    '/recipes/iced-latte/',
    '/recipes/iced-americano/',
    '/journal/ice-is-an-ingredient/',
    '/learn/coffee-basics/coffee-to-water-ratio/',
  ]) {
    if (!html.includes(`href="${href}"`)) {
      problems.push(`brown sugar shaken espresso is missing internal link: ${href}`);
    }
  }
  if (!html.includes('Shake safely: Never shake hot espresso')) {
    problems.push('brown sugar shaken espresso is missing its visible safety notice');
  }
} else {
  problems.push('Brown Sugar Shaken Espresso recipe page was not built');
}

const icedRecipesPage = join(DIST, 'recipes', 'iced-coffee', 'index.html');
if (existsSync(icedRecipesPage)) {
  const html = readFileSync(icedRecipesPage, 'utf8');
  const schemas = schemasIn(html);
  const collection = schemas.find((schema) => schema?.['@type'] === 'CollectionPage');
  if (collection?.mainEntity?.['@type'] !== 'ItemList') {
    problems.push('iced-coffee hub is missing its CollectionPage with ItemList');
  }
  if (collection?.mainEntity?.numberOfItems !== 9) {
    problems.push('iced-coffee hub ItemList should contain nine recipes');
  }
  if (schemas.some((schema) => schema?.['@type'] === 'Recipe')) {
    problems.push('iced-coffee hub must not use Recipe schema for the collection');
  }
  if (!schemas.some((schema) => schema?.['@type'] === 'BreadcrumbList')) {
    problems.push('iced-coffee hub is missing BreadcrumbList schema');
  }

  const hubSlugs = [
    'iced-americano',
    'iced-latte',
    'brown-sugar-shaken-espresso',
    'iced-caramel-latte',
    'iced-salted-vanilla-cloud-foam',
    'cold-brew',
    'vietnamese-iced-coffee',
    'freddo-espresso',
    'espresso-tonic',
  ];
  const positions = hubSlugs.map((slug) => html.indexOf(`href="/recipes/${slug}/"`));
  if (
    positions.some((position) => position === -1) ||
    positions.some((position, index) => index > 0 && position <= positions[index - 1])
  ) {
    problems.push('iced-coffee hub recipes are missing or out of editorial order');
  }
  for (const detail of [
    'Beginner',
    'Intermediate',
    'Espresso + cold foam',
    'Cold extraction',
    'Coffee base',
    'Condensed milk',
  ]) {
    if (!html.includes(detail)) problems.push(`iced-coffee hub is missing card detail: ${detail}`);
  }
  if (!html.includes('Compare Iced Coffee Styles') || !html.includes('Main character')) {
    problems.push('iced-coffee hub is missing its comparison table');
  }
  for (const section of [
    'Iced Coffee vs Cold Brew',
    'Iced Coffee vs Iced Latte',
    'How to Stop Iced Coffee Becoming Watery',
    'Best Ice for Coffee',
    'Can Hot Coffee Be Poured Over Ice?',
  ]) {
    if (!html.includes(section)) problems.push(`iced-coffee hub is missing section: ${section}`);
  }
  if (!html.includes('href="/journal/ice-is-an-ingredient/"')) {
    problems.push('iced-coffee hub is missing its Ice Is an Ingredient link');
  }

  for (const slug of hubSlugs) {
    const recipePage = join(DIST, 'recipes', slug, 'index.html');
    if (
      !existsSync(recipePage) ||
      !readFileSync(recipePage, 'utf8').includes('href="/recipes/iced-coffee/"')
    ) {
      problems.push(`recipes/${slug} is missing its return link to the iced-coffee hub`);
    }
  }
} else {
  problems.push('Iced Coffee hub was not built');
}

if (
  existsSync(searchPage) &&
  !readFileSync(searchPage, 'utf8').includes('Iced Salted Vanilla Cloud Foam')
) {
  problems.push('search index is missing Iced Salted Vanilla Cloud Foam');
}
if (
  existsSync(searchPage) &&
  !readFileSync(searchPage, 'utf8').includes('Brown Sugar Shaken Espresso')
) {
  problems.push('search index is missing Brown Sugar Shaken Espresso');
}
if (existsSync(searchPage) && !readFileSync(searchPage, 'utf8').includes('Recipe collection')) {
  problems.push('search index is missing the Iced Coffee recipe collection');
}
if (existsSync(searchPage) && !readFileSync(searchPage, 'utf8').includes('How to Make Filter Coffee')) {
  problems.push('search index is missing the Filter Coffee guide');
}

const ratioPage = join(DIST, 'learn', 'coffee-basics', 'coffee-to-water-ratio', 'index.html');
if (existsSync(ratioPage)) {
  const html = readFileSync(ratioPage, 'utf8');
  const schemas = schemasIn(html);
  if (
    !schemas.some((schema) =>
      Array.isArray(schema?.['@type']) && schema['@type'].includes('Article')
    )
  ) {
    problems.push('coffee ratio lesson is missing Article schema');
  }
  if (!schemas.some((schema) => schema?.['@type'] === 'BreadcrumbList')) {
    problems.push('coffee ratio lesson is missing BreadcrumbList schema');
  }
  for (const control of [
    'data-ratio-calculator',
    'data-ratio-method',
    'data-ratio-coffee',
    'data-ratio-strength',
    'data-ratio-units',
    'data-ratio-unit',
    'data-ratio-result',
    'value="filter-coffee"',
    'value="moka-pot"',
    'value="cold-brew-concentrate"',
  ]) {
    if (!html.includes(control)) problems.push(`coffee ratio calculator is missing ${control}`);
  }
  for (const slug of [
    'espresso',
    'v60-pour-over',
    'classic-french-press',
    'aeropress-daily',
    'moka-pot-classic',
    'cold-brew',
  ]) {
    if (!html.includes(`href="/recipes/${slug}/"`)) {
      problems.push(`coffee ratio lesson is missing recipe link: ${slug}`);
    }
  }
  for (const marker of [
    'Filter Coffee',
    'Why Grind Size Still Matters',
    'Why Water Temperature Matters',
    'Ratio Examples for 1, 2 and 4 Cups',
  ]) {
    if (!html.includes(marker)) problems.push(`coffee ratio lesson is missing section: ${marker}`);
  }
}

const shopPage = join(DIST, 'shop', 'index.html');
if (existsSync(shopPage)) {
  const html = readFileSync(shopPage, 'utf8');
  if (!/<meta name="robots" content="noindex, follow">/i.test(html)) {
    problems.push('shop/index.html is missing noindex, follow while the shop is prelaunch');
  }
}

const homePage = join(DIST, 'index.html');
if (existsSync(homePage)) {
  const html = readFileSync(homePage, 'utf8');
  if (!html.includes('data-brew-widget')) {
    problems.push('index.html is missing the global Fix my coffee widget');
  }
  if (!html.includes('data-brew-widget-reveal="scroll"')) {
    problems.push('index.html floating brew widget must wait for the first scroll');
  }
  if (!/<button[^>]*class="brew-widget-trigger"[^>]*\shidden(?:\s|>)/i.test(html)) {
    problems.push('index.html floating brew widget trigger is not initially hidden');
  }
  if (html.includes('Not sure where to start?')) {
    problems.push('index.html includes the duplicated brew-method chooser');
  }
}

const assistantPage = join(DIST, 'assistant', 'index.html');
if (existsSync(assistantPage)) {
  const html = readFileSync(assistantPage, 'utf8');
  if (html.includes('data-brew-widget')) {
    problems.push('assistant/index.html includes the floating widget beside the full assistant');
  }
  if (!/<link rel="canonical" href="https:\/\/kavovo\.uk\/assistant\/">/i.test(html)) {
    problems.push('assistant/index.html canonical must stay query-free');
  }
}

for (const contentPage of [
  join(DIST, 'recipes', 'index.html'),
  join(DIST, 'guides', 'index.html'),
  join(DIST, 'learn', 'index.html'),
  join(DIST, 'journal', 'index.html'),
]) {
  if (existsSync(contentPage) && /<meta name="robots" content="noindex/i.test(readFileSync(contentPage, 'utf8'))) {
    problems.push(`${relative(DIST, contentPage)} was accidentally marked noindex`);
  }
}

let cloudFoamInSitemap = false;
let filterCoffeeInSitemap = false;
for (const entry of readdirSync(DIST, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.xml')) continue;
  const xml = readFileSync(join(DIST, entry.name), 'utf8');
  if (
    xml.includes(
      '<loc>https://kavovo.uk/recipes/iced-salted-vanilla-cloud-foam/</loc>',
    )
  ) {
    cloudFoamInSitemap = true;
  }
  if (xml.includes('<loc>https://kavovo.uk/learn/coffee-basics/filter-coffee/</loc>')) {
    filterCoffeeInSitemap = true;
  }
  for (const excludedPath of ['/404/', '/search/', '/shop/', '/subscription-confirmed/']) {
    if (xml.includes(`<loc>https://kavovo.uk${excludedPath}</loc>`)) {
      problems.push(`${entry.name} includes excluded page ${excludedPath}`);
    }
  }
}
if (!cloudFoamInSitemap) {
  problems.push('sitemap is missing Iced Salted Vanilla Cloud Foam');
}
if (!filterCoffeeInSitemap) {
  problems.push('sitemap is missing the Filter Coffee guide');
}

for (const asset of missingAssets) problems.push(`referenced but not emitted: ${asset}`);
if (recipeSchemas === 0) problems.push('no Recipe schemas found in the production build');
if (faqSchemas < 3) problems.push(`expected at least 3 FAQPage schemas; found ${faqSchemas}`);

// Internal links. Lessons hand-pick their "put it into practice" links, and a
// typo there is invisible until someone clicks it.
const deadLinks = new Map();
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  for (const match of html.matchAll(/<a\s[^>]*href="(\/[^"]*)"/g)) {
    const href = match[1].split(/[?#]/)[0];
    if (!href || href.startsWith('/api/')) continue;
    if (/\.[a-z0-9]{2,5}$/i.test(href)) continue; // a file, covered by the asset check
    const target = join(DIST, href, 'index.html');
    if (!existsSync(target)) {
      if (!deadLinks.has(href)) deadLinks.set(href, relative(DIST, page));
    }
  }
}
for (const [href, from] of deadLinks) problems.push(`dead internal link ${href} (from ${from})`);

// The Brew Assistant renders its links in the browser, so they never appear in
// the static HTML the check above walks. Read them from the content map instead:
// a renamed lesson should fail the build, not quietly link into nothing.
const contentMap = 'src/lib/brew-assistant/content.ts';
if (existsSync(contentMap)) {
  const source = readFileSync(contentMap, 'utf8');
  for (const match of source.matchAll(/href:\s*'(\/[^']+)'/g)) {
    if (!existsSync(join(DIST, match[1], 'index.html'))) {
      problems.push(`brew assistant links to a page that does not exist: ${match[1]}`);
    }
  }
}

if (problems.length > 0) {
  console.error(`\nBuild check ${warnOnly ? 'WARNING' : 'failed'}:\n`);
  for (const problem of problems.slice(0, 15)) console.error('  •', problem);
  if (problems.length > 15) console.error(`  … and ${problems.length - 15} more`);
  if (onDemandImages > 0) {
    console.error(
      '\n  Photos must come from public/img via the Photo component, never from\n' +
        "  Astro's image pipeline — the host cannot run it. See scripts/build-images.mjs.\n",
    );
  }
  if (!warnOnly) process.exit(1);
}

const variants = existsSync(join(DIST, 'img'))
  ? readdirSync(join(DIST, 'img')).filter((f) => /\.(avif|webp)$/.test(f)).length
  : 0;
if (variants === 0) {
  console.error('\nBuild check: no image variants in dist/img — run `npm run images`.\n');
  if (!warnOnly) process.exit(1);
}
console.log(`Build check passed: ${pages.length} pages, ${variants} image variants served statically.`);
console.log(`Structured data check passed: ${recipeSchemas} Recipe and ${faqSchemas} FAQPage schemas.`);
