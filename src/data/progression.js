// Level progression (levels 1 to 5) for the 2024 rules of D&D.
//
// This file includes material from the System Reference Document 5.2.1
// ("SRD 5.2.1") by Wizards of the Coast LLC, available at
// https://www.dndbeyond.com/srd, licensed under the Creative Commons
// Attribution 4.0 International License.

/** The game covers the first five levels. */
export const MAX_LEVEL = 5;

/** Total experience points needed to reach each level. */
export const XP_FOR_LEVEL = { 1: 0, 2: 300, 3: 900, 4: 2700, 5: 6500 };

export const PROFICIENCY_BY_LEVEL = { 1: 2, 2: 2, 3: 2, 4: 2, 5: 3 };

/** At this level every class gains an Ability Score Improvement. */
export const ASI_LEVELS = [4];

/** Cantrips roll one more damage die from this level on. */
export const CANTRIP_UPGRADE_LEVEL = 5;

/** Level at which every class chooses its subclass (the SRD offers one per class). */
export const SUBCLASS_LEVEL = 3;

export const SUBCLASSES = {
  barbarian: { name: 'Senda del Berserker', desc: 'Tu furia se convierte en un frenesí que multiplica el daño.' },
  bard: { name: 'Colegio del Saber', desc: 'Más habilidades y palabras cortantes que estropean las tiradas enemigas.' },
  cleric: { name: 'Dominio de la Vida', desc: 'Tus conjuros de curación son más potentes.' },
  druid: { name: 'Círculo de la Tierra', desc: 'La tierra que elijas te concede conjuros adicionales.' },
  fighter: { name: 'Campeón', desc: 'Tus ataques son críticos con un 19 o un 20.' },
  monk: { name: 'Guerrero de la Mano Abierta', desc: 'Tus golpes derriban, empujan y desequilibran.' },
  paladin: { name: 'Juramento de Devoción', desc: 'Armas sagradas y la protección de los más altos ideales.' },
  ranger: { name: 'Cazador', desc: 'Conoces las debilidades de tu presa y la castigas.' },
  rogue: { name: 'Ladrón', desc: 'Manos rápidas, trepar como nadie y usar objetos en un suspiro.' },
  sorcerer: { name: 'Hechicería Dracónica', desc: 'Sangre de dragón: más resistente y con conjuros dracónicos.' },
  warlock: { name: 'Patrón Infernal', desc: 'Un pacto con un señor de los Planos Inferiores.' },
  wizard: { name: 'Evocador', desc: 'Maestro de los conjuros de daño, que puedes moldear para no herir a tus aliados.' }
};

/** Class features gained at each level after the first (the subclass and the ASI are added automatically). */
export const CLASS_FEATURES = {
  barbarian: { 2: ['Ataque Temerario', 'Sentido del Peligro'], 3: ['Conocimiento Primigenio'], 5: ['Ataque Adicional', 'Movimiento Rápido'] },
  bard: { 2: ['Pericia', 'Aprendiz de Todo'], 5: ['Fuente de Inspiración'] },
  cleric: { 2: ['Canalizar Divinidad'], 5: ['Abrasar Muertos Vivientes'] },
  druid: { 2: ['Forma Salvaje', 'Compañero Salvaje'], 5: ['Resurgir Salvaje'] },
  fighter: { 2: ['Oleada de Acción', 'Mente Táctica'], 5: ['Ataque Adicional', 'Reposicionamiento Táctico'] },
  monk: { 2: ['Concentración del Monje', 'Movimiento sin Armadura', 'Metabolismo Asombroso'], 3: ['Desviar Ataques'], 4: ['Caída Lenta'], 5: ['Ataque Adicional', 'Golpe Aturdidor'] },
  paladin: { 2: ['Estilo de Combate', 'Castigo del Paladín'], 3: ['Canalizar Divinidad'], 5: ['Ataque Adicional', 'Corcel Fiel'] },
  ranger: { 2: ['Explorador Diestro', 'Estilo de Combate'], 5: ['Ataque Adicional'] },
  rogue: { 2: ['Acción Astuta'], 3: ['Puntería Firme'], 5: ['Golpe Astuto', 'Esquiva Asombrosa'] },
  sorcerer: { 2: ['Fuente de Magia', 'Metamagia'], 5: ['Restauración Hechicera'] },
  warlock: { 2: ['Astucia Mágica'], 5: ['Invocaciones adicionales'] },
  wizard: { 2: ['Erudito'], 5: ['Memorizar Conjuro'] }
};

// --- Spell slots -------------------------------------------------------------
// { characterLevel: { spellLevel: slots } }

const FULL_CASTER = {
  1: { 1: 2 },
  2: { 1: 3 },
  3: { 1: 4, 2: 2 },
  4: { 1: 4, 2: 3 },
  5: { 1: 4, 2: 3, 3: 2 }
};

const HALF_CASTER = {
  1: { 1: 2 },
  2: { 1: 2 },
  3: { 1: 3 },
  4: { 1: 3 },
  5: { 1: 4, 2: 2 }
};

// Pact Magic: few slots, all of the same level, back on a short rest
const PACT_MAGIC = {
  1: { 1: 1 },
  2: { 1: 2 },
  3: { 2: 2 },
  4: { 2: 2 },
  5: { 3: 2 }
};

/**
 * Spellcasting of each class by level:
 * slots table, when slots return, and cantrips / prepared spells known at each level.
 * Wizards also grow a spellbook (`spellbook`), from which they prepare.
 */
export const SPELL_PROGRESSION = {
  bard: { slots: FULL_CASTER, recovery: 'long', cantrips: [2, 2, 2, 3, 3], prepared: [4, 5, 6, 7, 9] },
  cleric: { slots: FULL_CASTER, recovery: 'long', cantrips: [3, 3, 3, 4, 4], prepared: [4, 5, 6, 7, 9] },
  druid: { slots: FULL_CASTER, recovery: 'long', cantrips: [2, 2, 2, 3, 3], prepared: [4, 5, 6, 7, 9] },
  sorcerer: { slots: FULL_CASTER, recovery: 'long', cantrips: [4, 4, 4, 5, 5], prepared: [2, 4, 6, 7, 9] },
  wizard: { slots: FULL_CASTER, recovery: 'long', cantrips: [3, 3, 3, 4, 4], prepared: [4, 5, 6, 7, 9], spellbook: [6, 8, 10, 12, 14] },
  paladin: { slots: HALF_CASTER, recovery: 'long', cantrips: [0, 0, 0, 0, 0], prepared: [2, 3, 4, 5, 6] },
  ranger: { slots: HALF_CASTER, recovery: 'long', cantrips: [0, 0, 0, 0, 0], prepared: [2, 3, 4, 5, 6] },
  warlock: { slots: PACT_MAGIC, recovery: 'short', cantrips: [2, 2, 2, 3, 3], prepared: [2, 3, 4, 5, 6] }
};
