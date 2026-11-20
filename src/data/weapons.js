// Weapons of the 2024 rules of D&D.
//
// This file includes material from the System Reference Document 5.2.1
// ("SRD 5.2.1") by Wizards of the Coast LLC, available at
// https://www.dndbeyond.com/srd, licensed under the Creative Commons
// Attribution 4.0 International License.
//
// properties: finesse, light, heavy, twoHanded, reach, thrown, ammunition, loading
// versatile: damage die when wielded with two hands
// range: [normal, long] in metres (thrown or ranged)

const W = (id, name, category, kind, damage, type, properties = [], extra = {}) => ({
  id, name, category, kind, damage, type, properties, ...extra
});

export const WEAPONS = [
  // Simple melee
  W('club', 'Garrote', 'simple', 'melee', '1d4', 'contundente', ['light']),
  W('dagger', 'Daga', 'simple', 'melee', '1d4', 'perforante', ['finesse', 'light', 'thrown'], { range: [6, 18] }),
  W('greatclub', 'Gran Garrote', 'simple', 'melee', '1d8', 'contundente', ['twoHanded']),
  W('handaxe', 'Hacha de Mano', 'simple', 'melee', '1d6', 'cortante', ['light', 'thrown'], { range: [6, 18] }),
  W('javelin', 'Jabalina', 'simple', 'melee', '1d6', 'perforante', ['thrown'], { range: [9, 36] }),
  W('lightHammer', 'Martillo Ligero', 'simple', 'melee', '1d4', 'contundente', ['light', 'thrown'], { range: [6, 18] }),
  W('mace', 'Maza', 'simple', 'melee', '1d6', 'contundente'),
  W('quarterstaff', 'Bastón', 'simple', 'melee', '1d6', 'contundente', [], { versatile: '1d8' }),
  W('sickle', 'Hoz', 'simple', 'melee', '1d4', 'cortante', ['light']),
  W('spear', 'Lanza', 'simple', 'melee', '1d6', 'perforante', ['thrown'], { versatile: '1d8', range: [6, 18] }),
  // Simple ranged
  W('dart', 'Dardo', 'simple', 'ranged', '1d4', 'perforante', ['finesse', 'thrown'], { range: [6, 18] }),
  W('lightCrossbow', 'Ballesta Ligera', 'simple', 'ranged', '1d8', 'perforante', ['ammunition', 'loading', 'twoHanded'], { range: [24, 96] }),
  W('shortbow', 'Arco Corto', 'simple', 'ranged', '1d6', 'perforante', ['ammunition', 'twoHanded'], { range: [24, 96] }),
  W('sling', 'Honda', 'simple', 'ranged', '1d4', 'contundente', ['ammunition'], { range: [9, 36] }),
  // Martial melee
  W('battleaxe', 'Hacha de Batalla', 'martial', 'melee', '1d8', 'cortante', [], { versatile: '1d10' }),
  W('flail', 'Mangual', 'martial', 'melee', '1d8', 'contundente'),
  W('glaive', 'Guja', 'martial', 'melee', '1d10', 'cortante', ['heavy', 'reach', 'twoHanded']),
  W('greataxe', 'Gran Hacha', 'martial', 'melee', '1d12', 'cortante', ['heavy', 'twoHanded']),
  W('greatsword', 'Espadón', 'martial', 'melee', '2d6', 'cortante', ['heavy', 'twoHanded']),
  W('halberd', 'Alabarda', 'martial', 'melee', '1d10', 'cortante', ['heavy', 'reach', 'twoHanded']),
  W('lance', 'Lanza de Caballería', 'martial', 'melee', '1d10', 'perforante', ['heavy', 'reach', 'twoHanded']),
  W('longsword', 'Espada Larga', 'martial', 'melee', '1d8', 'cortante', [], { versatile: '1d10' }),
  W('maul', 'Mazo', 'martial', 'melee', '2d6', 'contundente', ['heavy', 'twoHanded']),
  W('morningstar', 'Lucero del Alba', 'martial', 'melee', '1d8', 'perforante'),
  W('pike', 'Pica', 'martial', 'melee', '1d10', 'perforante', ['heavy', 'reach', 'twoHanded']),
  W('rapier', 'Estoque', 'martial', 'melee', '1d8', 'perforante', ['finesse']),
  W('scimitar', 'Cimitarra', 'martial', 'melee', '1d6', 'cortante', ['finesse', 'light']),
  W('shortsword', 'Espada Corta', 'martial', 'melee', '1d6', 'perforante', ['finesse', 'light']),
  W('trident', 'Tridente', 'martial', 'melee', '1d8', 'perforante', ['thrown'], { versatile: '1d10', range: [6, 18] }),
  W('warhammer', 'Martillo de Guerra', 'martial', 'melee', '1d8', 'contundente', [], { versatile: '1d10' }),
  W('warPick', 'Pico de Guerra', 'martial', 'melee', '1d8', 'perforante', [], { versatile: '1d10' }),
  W('whip', 'Látigo', 'martial', 'melee', '1d4', 'cortante', ['finesse', 'reach']),
  // Martial ranged
  W('blowgun', 'Cerbatana', 'martial', 'ranged', '0d4+1', 'perforante', ['ammunition', 'loading'], { range: [7.5, 30] }),
  W('handCrossbow', 'Ballesta de Mano', 'martial', 'ranged', '1d6', 'perforante', ['ammunition', 'light', 'loading'], { range: [9, 36] }),
  W('heavyCrossbow', 'Ballesta Pesada', 'martial', 'ranged', '1d10', 'perforante', ['ammunition', 'heavy', 'loading', 'twoHanded'], { range: [30, 120] }),
  W('longbow', 'Arco Largo', 'martial', 'ranged', '1d8', 'perforante', ['ammunition', 'heavy', 'twoHanded'], { range: [45, 180] })
];

export const PROPERTY_NAMES = {
  finesse: 'sutil', light: 'ligera', heavy: 'pesada', twoHanded: 'a dos manos', reach: 'alcance',
  thrown: 'arrojadiza', ammunition: 'munición', loading: 'recarga'
};

/**
 * Weapon proficiencies by class (2024): every class uses simple weapons;
 * martial: true, false, or a list of properties (monks: light; rogues: finesse or light).
 */
export const WEAPON_PROFICIENCY = {
  barbarian: { martial: true },
  bard: { martial: false },
  cleric: { martial: false },
  druid: { martial: false },
  fighter: { martial: true },
  monk: { martial: ['light'] },
  paladin: { martial: true },
  ranger: { martial: true },
  rogue: { martial: ['finesse', 'light'] },
  sorcerer: { martial: false },
  warlock: { martial: false },
  wizard: { martial: false }
};

/** Attacks per Attack action (Extra Attack) by class and character level. */
export const EXTRA_ATTACK = {
  fighter: { 5: 2, 11: 3, 20: 4 },
  barbarian: { 5: 2 },
  monk: { 5: 2 },
  paladin: { 5: 2 },
  ranger: { 5: 2 }
};

/** Monk Martial Arts die by level. */
export const MARTIAL_ARTS_DIE = { 1: 6, 5: 8, 11: 10, 17: 12 };

/** Barbarian Rage damage bonus by level. */
export const RAGE_DAMAGE = { 1: 2, 9: 3, 16: 4 };

/**
 * Item names of older saves and starting equipment -> weapon id
 * (most specific first). Items made from now on carry a weaponId.
 */
export const WEAPON_NAME_HINTS = [
  ['hacha a dos manos', 'greataxe'], ['gran hacha', 'greataxe'], ['hacha de mano', 'handaxe'], ['hachas de mano', 'handaxe'],
  ['hacha de batalla', 'battleaxe'], ['hacha de guerra', 'battleaxe'],
  ['espada larga', 'longsword'], ['espada corta', 'shortsword'], ['espadón', 'greatsword'],
  ['arco largo', 'longbow'], ['arco corto', 'shortbow'],
  ['ballesta de mano', 'handCrossbow'], ['ballesta pesada', 'heavyCrossbow'], ['ballesta', 'lightCrossbow'],
  ['martillo ligero', 'lightHammer'], ['martillo de guerra', 'warhammer'], ['gran garrote', 'greatclub'],
  ['lanza de caballería', 'lance'], ['lucero', 'morningstar'], ['pico de guerra', 'warPick'],
  ['daga', 'dagger'], ['maza', 'mace'], ['hoz', 'sickle'], ['bastón', 'quarterstaff'], ['mangual', 'flail'],
  ['jabalina', 'javelin'], ['lanza', 'spear'], ['cimitarra', 'scimitar'], ['estoque', 'rapier'],
  ['garrote', 'club'], ['dardo', 'dart'], ['honda', 'sling'], ['guja', 'glaive'], ['alabarda', 'halberd'],
  ['mazo', 'maul'], ['pica', 'pike'], ['tridente', 'trident'], ['látigo', 'whip'], ['cerbatana', 'blowgun']
];
