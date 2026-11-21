// Armor of the 2024 rules of D&D.
//
// This file includes material from the System Reference Document 5.2.1
// ("SRD 5.2.1") by Wizards of the Coast LLC, available at
// https://www.dndbeyond.com/srd, licensed under the Creative Commons
// Attribution 4.0 International License.
//
// category: light | medium | heavy | shield
// ac:       base Armor Class (shield: bonus)
// dexCap:   null = full Dexterity modifier, 2 = up to +2, 0 = Dexterity not added
// strength: minimum Strength score (heavy armor); below it, speed drops by 3 m (10 ft)
// stealth:  true = Disadvantage on Dexterity (Stealth) checks
// price:    gold pieces; weight: kg (the Spanish books halve the pounds)

const A = (id, name, category, ac, dexCap, price, weight, extra = {}) => ({
  id, name, category, ac, dexCap, price, weight, strength: null, stealth: false, ...extra
});

export const ARMORS = [
  // Light armor (1 minute to don, 1 to doff)
  A('padded', 'Armadura acolchada', 'light', 11, null, 5, 4, { stealth: true }),
  A('leather', 'Armadura de cuero', 'light', 11, null, 10, 5),
  A('studdedLeather', 'Armadura de cuero tachonado', 'light', 12, null, 45, 6.5),
  // Medium armor (5 minutes to don, 1 to doff)
  A('hide', 'Armadura de pieles', 'medium', 12, 2, 10, 6),
  A('chainShirt', 'Camisote de mallas', 'medium', 13, 2, 50, 10),
  A('scaleMail', 'Cota de escamas', 'medium', 14, 2, 50, 22.5, { stealth: true }),
  A('breastplate', 'Coraza', 'medium', 14, 2, 400, 10),
  A('halfPlate', 'Semiplacas', 'medium', 15, 2, 750, 20, { stealth: true }),
  // Heavy armor (10 minutes to don, 5 to doff)
  A('ringMail', 'Cota de anillas', 'heavy', 14, 0, 30, 20, { stealth: true }),
  A('chainMail', 'Cota de mallas', 'heavy', 16, 0, 75, 27.5, { strength: 13, stealth: true }),
  A('splint', 'Armadura de bandas', 'heavy', 17, 0, 200, 30, { strength: 15, stealth: true }),
  A('plate', 'Armadura de placas', 'heavy', 18, 0, 1500, 32.5, { strength: 15, stealth: true }),
  // Shield (utilize action to don or doff)
  A('shield', 'Escudo', 'shield', 2, null, 10, 3)
];

export const ARMOR_CATEGORY_NAMES = { light: 'ligera', medium: 'intermedia', heavy: 'pesada', shield: 'escudo' };

/**
 * Armor training by class (2024). Unknown classes (preset heroes, older saves)
 * are treated as trained in everything so nothing changes for them.
 */
export const ARMOR_PROFICIENCY = {
  barbarian: ['light', 'medium', 'shield'],
  bard: ['light'],
  cleric: ['light', 'medium', 'shield'],
  druid: ['light', 'shield'],
  fighter: ['light', 'medium', 'heavy', 'shield'],
  monk: [],
  paladin: ['light', 'medium', 'heavy', 'shield'],
  ranger: ['light', 'medium', 'shield'],
  rogue: ['light'],
  sorcerer: [],
  warlock: ['light'],
  wizard: []
};

/**
 * Unarmored Defense: 10 + Dexterity + this ability while wearing no armor.
 * The monk's also needs no shield in hand.
 */
export const UNARMORED_DEFENSE = {
  barbarian: { ability: 'con', shieldAllowed: true },
  monk: { ability: 'sab', shieldAllowed: false }
};

/** Speed lost (in feet, like `speed` on the sheet) wearing heavy armor without the Strength it needs. */
export const HEAVY_ARMOR_SPEED_PENALTY = 10;

/** Item names of older saves and starting equipment -> armor id (most specific first). */
export const ARMOR_NAME_HINTS = [
  ['cuero tachonado', 'studdedLeather'], ['acolchad', 'padded'], ['cuero', 'leather'],
  ['pieles', 'hide'], ['camisote', 'chainShirt'], ['escamas', 'scaleMail'], ['coraza', 'breastplate'],
  ['semiplacas', 'halfPlate'], ['media armadura', 'halfPlate'], ['anillas', 'ringMail'],
  ['cota de malla', 'chainMail'], ['bandas', 'splint'], ['placas', 'plate'], ['escudo', 'shield']
];
