/**
 * Learning paths, shared by the Learn hub, the homepage and search.
 *
 * `id` is the photo manifest key and the anchor on /learn/. `slug` is the URL
 * segment and must match the `path` value in the lessons collection. Only
 * published paths get a landing page; the rest are still being written.
 */
export const LEARN_PATHS = [
  {
    id: 'basics',
    slug: 'coffee-basics',
    title: 'Coffee Basics',
    short: 'Start here. Essential knowledge and simple recipes.',
    description:
      'Essential knowledge and simple recipes: what gear you actually need, how grind size works, and your first great cups.',
    image: '/images/learn-basics.jpg',
    status: 'published',
    seoTitle: "Coffee Basics: A Beginner's Guide — KAVOVO",
    seoDescription:
      'Learn the essentials of better coffee at home: equipment, ratios, grind size, water, temperature, tasting and bean storage.',
    intro: [
      'Better coffee does not begin with expensive equipment. It begins with understanding a few variables and changing them deliberately.',
      'Coffee Basics is a seven-lesson path for anyone who wants a better cup without turning the kitchen into a laboratory. You will learn what equipment matters, how to build a reliable recipe, how grind size and water affect flavour, and how to recognise what is happening in the cup.',
    ],
    outcomes: [
      'choose a practical home coffee setup;',
      'use a repeatable coffee-to-water ratio;',
      'select a sensible grind size for each brewing method;',
      'improve the water you brew with;',
      'adjust brewing temperature with purpose;',
      'taste coffee using clear, ordinary language;',
      'keep roasted coffee fresher for longer.',
    ],
    closing:
      'You do not need previous coffee knowledge. Start with what you already own and improve one thing at a time.',
    secondaryCta: { label: 'Browse coffee recipes', href: '/recipes/' },
  },
  {
    id: 'espresso',
    slug: 'dial-in-espresso',
    title: 'Dial In Espresso',
    short: 'Dial in with confidence and consistency.',
    description:
      'From your first shot to consistent, repeatable espresso: dose, yield, time, and how to taste the difference.',
    image: '/images/learn-espresso.jpg',
    status: 'published',
    seoTitle: 'Dial In Espresso: A Practical Home Guide — KAVOVO',
    seoDescription:
      'Learn to control dose, yield, time, grind and puck preparation, then build consistent espresso and silky milk at home.',
    intro: [
      'Espresso becomes easier when you stop treating every shot as a fresh mystery. A scale, a repeatable recipe and a few deliberate adjustments turn guesswork into a process.',
      'Dial In Espresso is a seven-lesson path for home baristas who want balanced shots, reliable milk texture and a workflow they can repeat the next morning. You will learn what dose, yield and time mean, how grind size changes flow, how to recognise uneven extraction and how to keep the machine clean enough to taste the coffee rather than yesterday\u2019s coffee oils.',
    ],
    outcomes: [
      'build a clear espresso recipe using dose, yield and time;',
      'dial in a new bag of coffee step by step;',
      'distinguish sharp sourness from harsh bitterness;',
      'decide whether to grind finer or coarser;',
      'distribute and tamp consistently while reducing channeling;',
      'steam glossy, pourable microfoam;',
      'follow a practical daily and periodic cleaning routine.',
    ],
    closing:
      'You need an espresso machine, an espresso-capable grinder, a suitable basket, a tamper and a scale reading to 0.1 g. A timer is useful too, but the one built into your scale, machine or phone is enough. Start with lesson 1 and keep a notebook nearby \u2014 espresso remembers every variable you forgot to write down.',
    secondaryCta: { label: 'Open the espresso brew guide', href: '/guides/espresso/' },
  },
  {
    id: 'beans',
    slug: 'understand-your-beans',
    title: 'Understand Your Beans',
    short: 'Origin, processing, roast, and flavour.',
    description:
      'Origin, processing, roast level, and flavour — how to read a bag of coffee and pick beans you will love.',
    image: '/images/learn-beans.jpg',
    status: 'published',
    seoTitle: 'Understand Your Coffee Beans — KAVOVO',
    seoDescription:
      'Learn how coffee species, origin, processing, roast, flavour notes and freshness shape what reaches your cup.',
    intro: [
      'A coffee bag can contain a surprising amount of information: species, country, region, variety, process, altitude, roast date and a list of flavours that may sound more like a fruit salad than breakfast.',
      'Understand Your Beans is a seven-lesson path that turns those details into useful buying and brewing decisions. You will learn what Arabica and Robusta actually mean, why country of origin is only part of the flavour story, how coffee is processed and roasted, and how to judge freshness without treating the roast date like a countdown timer.',
    ],
    outcomes: [
      'explain the practical differences between Arabica and Robusta;',
      'use origin information without relying on stereotypes;',
      'recognise washed, natural and honey processing;',
      'choose a roast level that suits your taste and brewing method;',
      'read the useful information on a coffee bag;',
      'interpret flavour notes as sensory comparisons;',
      'buy, rest and store coffee with a sensible freshness plan.',
    ],
    closing:
      'You do not need to memorise producing regions or identify jasmine from across the kitchen. The aim is simpler: understand which details help you choose coffee you are more likely to enjoy.',
    secondaryCta: { label: 'Browse coffee recipes', href: '/recipes/' },
  },
] as const;

export type LearnPath = (typeof LEARN_PATHS)[number];

export const publishedPaths = () => LEARN_PATHS.filter((p) => p.status === 'published');

export const pathBySlug = (slug: string) => LEARN_PATHS.find((p) => p.slug === slug);

/** Where a path card should point: its landing page, or the hub entry if unwritten. */
export const pathHref = (path: LearnPath) =>
  path.status === 'published' ? `/learn/${path.slug}/` : `/learn/#${path.id}`;

/** "38 minutes" reads better than "38 min" in body copy. */
export const readingMinutes = (minutes: number) =>
  `${minutes} minute${minutes === 1 ? '' : 's'}`;
