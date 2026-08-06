/**
 * One dictionary of equipment names, so the same tool is never called two
 * things in two recipes. Recipes pick a set; anything beyond the essentials
 * is listed per recipe as optional.
 *
 * Cups and glasses deliberately do not appear here — that is what the
 * recommended vessel is for.
 */

const ESPRESSO = [
  'Espresso machine',
  'Portafilter and basket',
  'Coffee grinder',
  'Tamper',
  'Digital scale',
  'Timer',
];

export const EQUIPMENT_SETS = {
  espresso: ESPRESSO,
  milk: [...ESPRESSO, 'Milk pitcher'],
  americano: [...ESPRESSO, 'Kettle'],
  aeropress: ['AeroPress', 'Paper filter', 'Coffee grinder', 'Digital scale', 'Kettle', 'Timer', 'Stirrer'],
  'french-press': ['French press', 'Coffee grinder', 'Digital scale', 'Kettle', 'Timer', 'Spoon'],
  'pour-over': ['Dripper', 'Paper filter', 'Coffee grinder', 'Digital scale', 'Gooseneck kettle', 'Timer'],
  'moka-pot': ['Moka pot', 'Coffee grinder', 'Digital scale', 'Heat source'],
  'cold-brew': ['Jar or pitcher', 'Coffee grinder', 'Digital scale', 'Filter', 'Refrigerator'],
  filter: [
    'Filter coffee brewer',
    'Compatible filter',
    'Coffee grinder',
    'Digital scale',
    'Kettle',
    'Timer',
  ],
  phin: ['Vietnamese phin filter', 'Coffee grinder', 'Digital scale', 'Kettle', 'Timer'],
  cezve: ['Cezve', 'Coffee grinder', 'Digital scale', 'Low heat source'],
} as const;

export type EquipmentSet = keyof typeof EQUIPMENT_SETS;

export function equipmentFor(set: EquipmentSet): readonly string[] {
  return EQUIPMENT_SETS[set];
}
