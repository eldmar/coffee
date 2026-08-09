/**
 * Every rule points at one to three KAVOVO pages that explain the reasoning.
 *
 * The URLs are checked at build time by scripts/check-build.mjs: if a lesson or
 * guide is renamed or unpublished, the build fails rather than the assistant
 * quietly linking into nothing.
 */
export interface ContentLink {
  label: string;
  href: string;
}

export const CONTENT: Record<string, ContentLink> = {
  sourVsBitter: {
    label: 'Sour vs Bitter Espresso',
    href: '/learn/dial-in-espresso/sour-vs-bitter-espresso/',
  },
  grindFinerOrCoarser: {
    label: 'Grind Finer or Coarser? A Simple Guide',
    href: '/learn/dial-in-espresso/grind-finer-or-coarser/',
  },
  channeling: {
    label: 'Distribution, Tamping and Channeling',
    href: '/learn/dial-in-espresso/distribution-tamping-channeling/',
  },
  doseYieldTime: {
    label: 'Espresso Basics: Dose, Yield and Time',
    href: '/learn/dial-in-espresso/espresso-basics-dose-yield-time/',
  },
  dialIn: {
    label: 'How to Dial In Espresso, Step by Step',
    href: '/learn/dial-in-espresso/dial-in-espresso-step-by-step/',
  },
  grindSize: {
    label: 'Grind Size: From Espresso to French Press',
    href: '/learn/coffee-basics/grind-size/',
  },
  temperature: {
    label: 'Coffee Brewing Temperature, Explained',
    href: '/learn/coffee-basics/brewing-temperature/',
  },
  ratio: {
    label: 'Coffee-to-Water Ratio, Explained',
    href: '/learn/coffee-basics/coffee-to-water-ratio/',
  },
  tasting: {
    label: 'How to Taste Coffee Without Overcomplicating It',
    href: '/learn/coffee-basics/how-to-taste-coffee/',
  },
  espressoGuide: { label: 'Espresso brew guide', href: '/guides/espresso/' },
  v60Guide: { label: 'V60 brew guide', href: '/guides/v60/' },
  aeropressGuide: { label: 'AeroPress brew guide', href: '/guides/aeropress/' },
  frenchPressGuide: { label: 'French Press brew guide', href: '/guides/french-press/' },
};

export const linksFor = (keys: string[]): ContentLink[] =>
  keys.map((key) => CONTENT[key]).filter((link): link is ContentLink => Boolean(link));
