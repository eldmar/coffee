/**
 * One dictionary of equipment names, so the same tool is never called two
 * things in two recipes. Recipes pick a set; anything beyond the essentials
 * is listed per recipe as optional.
 *
 * Cups and glasses deliberately do not appear here — that is what the
 * recommended vessel is for.
 */

const ESPRESSO = ['Espresso machine', 'Portafilter and basket', 'Tamper', 'Grinder', 'Scale'];

export const EQUIPMENT_SETS = {
  espresso: ESPRESSO,
  milk: [...ESPRESSO, 'Milk pitcher'],
  americano: [...ESPRESSO, 'Kettle'],
  aeropress: ['AeroPress', 'Paper filter', 'Grinder', 'Scale', 'Kettle', 'Timer', 'Stirrer'],
  'french-press': ['French press', 'Grinder', 'Scale', 'Kettle', 'Timer', 'Spoon'],
  'pour-over': ['Dripper', 'Paper filter', 'Grinder', 'Scale', 'Gooseneck kettle', 'Timer'],
  'moka-pot': ['Moka pot', 'Grinder', 'Scale', 'Heat source'],
  'cold-brew': ['Jar or pitcher', 'Grinder', 'Scale', 'Filter', 'Refrigerator'],
} as const;

export type EquipmentSet = keyof typeof EQUIPMENT_SETS;

export function equipmentFor(set: EquipmentSet): readonly string[] {
  return EQUIPMENT_SETS[set];
}
