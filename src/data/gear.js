// Potions of Healing and basic adventuring gear of the 2024 rules of D&D.
//
// This file includes material from the System Reference Document 5.2.1
// ("SRD 5.2.1") by Wizards of the Coast LLC, available at
// https://www.dndbeyond.com/srd, licensed under the Creative Commons
// Attribution 4.0 International License.
//
// price: gold pieces (1 pp = 0,1 po, 1 pc = 0,01 po); weight: kg.

/**
 * Potions of Healing (SRD 5.2.1). Prices: the Potion of Healing costs 50 GP in
 * the equipment tables; the others follow the value of their rarity (uncommon
 * 400, rare 4.000, very rare 40.000 GP), halved because they are consumables.
 * Which shops stock them is decided in utils/shops.js (supreme ones are never sold).
 */
export const POTIONS = [
  { id: 'healing', name: 'Poción de curación', heal: '2d4+2', rarity: 'común', price: 50, weight: 0.25 },
  { id: 'greaterHealing', name: 'Poción de curación mayor', heal: '4d4+4', rarity: 'infrecuente', price: 200, weight: 0.25 },
  { id: 'superiorHealing', name: 'Poción de curación superior', heal: '8d4+8', rarity: 'rara', price: 2000, weight: 0.25 },
  { id: 'supremeHealing', name: 'Poción de curación suprema', heal: '10d4+20', rarity: 'muy rara', price: 20000, weight: 0.25 }
];

/** Older item names -> potion id (most specific first). */
export const POTION_NAME_HINTS = [
  ['curación suprema', 'supremeHealing'], ['curación superior', 'superiorHealing'],
  ['curación mayor', 'greaterHealing'], ['poción de curación', 'healing'], ['pocion de curacion', 'healing']
];

/**
 * Adventuring gear sold by general stores. `uses`: consumables with charges.
 * `type` is the inventory type the item gets.
 */
export const GEAR = [
  { id: 'backpack', name: 'Mochila', price: 2, weight: 2.5, type: 'gear', desc: 'Lleva hasta 15 kg de equipo' },
  { id: 'bedroll', name: 'Saco de dormir', price: 1, weight: 3.5, type: 'gear', desc: 'Para dormir al raso' },
  { id: 'rope', name: 'Cuerda (15 m)', price: 1, weight: 2.5, type: 'gear', desc: 'Cuerda de cáñamo' },
  { id: 'torches', name: 'Antorchas (10)', price: 0.1, weight: 5, type: 'gear', desc: 'Cada una arde 1 hora' },
  { id: 'rations', name: 'Raciones (5 días)', price: 2.5, weight: 5, type: 'gear', desc: 'Comida seca para el camino' },
  { id: 'waterskin', name: 'Odre', price: 0.2, weight: 2.5, type: 'gear', desc: 'Lleno de agua' },
  { id: 'tinderbox', name: 'Yesquero', price: 0.5, weight: 0.5, type: 'gear', desc: 'Pedernal y yesca para encender fuego' },
  { id: 'lantern', name: 'Linterna sorda', price: 5, weight: 1, type: 'gear', desc: 'Luz brillante en 9 m; se puede tapar' },
  { id: 'oil', name: 'Frasco de aceite', price: 0.1, weight: 0.5, type: 'gear', desc: 'Combustible para lámparas, o arrojadizo' },
  { id: 'crowbar', name: 'Palanca', price: 2, weight: 2.5, type: 'gear', desc: 'Ventaja para forzar cosas' },
  { id: 'grapplingHook', name: 'Garfio de escalada', price: 2, weight: 2, type: 'gear', desc: 'Se ata a una cuerda' },
  { id: 'caltrops', name: 'Abrojos', price: 1, weight: 1, type: 'gear', desc: 'Frenan a quien los pisa' },
  { id: 'chain', name: 'Cadena (3 m)', price: 5, weight: 5, type: 'gear', desc: 'Resistente y pesada' },
  { id: 'manacles', name: 'Grilletes', price: 2, weight: 3, type: 'gear', desc: 'Para atar a un prisionero' },
  { id: 'arrows', name: 'Flechas (20)', price: 1, weight: 0.5, type: 'gear', desc: 'Munición para arcos' },
  { id: 'bolts', name: 'Virotes (20)', price: 1, weight: 0.75, type: 'gear', desc: 'Munición para ballestas' },
  { id: 'healersKit', name: 'Útiles de sanador', price: 5, weight: 1.5, type: 'consumable', uses: 10, effect: 'Venda heridas y estabiliza a los caídos' },
  { id: 'climbersKit', name: 'Equipo de escalada', price: 25, weight: 6, type: 'gear', desc: 'Pitones, botas y arnés' },
  { id: 'thievesTools', name: 'Herramientas de ladrón', price: 25, weight: 0.5, type: 'tool', desc: 'Para abrir cerraduras y desarmar trampas' },
  { id: 'componentPouch', name: 'Saquito de componentes', price: 25, weight: 1, type: 'tool', desc: 'Componentes materiales de conjuros' },
  { id: 'holyWater', name: 'Agua bendita', price: 25, weight: 0.5, type: 'gear', desc: 'Daña a infernales y muertos vivientes' },
  { id: 'antitoxin', name: 'Antitoxina', price: 50, weight: 0, type: 'gear', desc: 'Ventaja contra el veneno durante 1 hora' },
  { id: 'explorersPack', name: 'Equipo de explorador', price: 10, weight: 27.5, type: 'gear', desc: 'Mochila, saco de dormir, raciones, cuerda, yesquero y antorchas' },
  { id: 'dungeoneersPack', name: 'Equipo de dungeon', price: 12, weight: 27.5, type: 'gear', desc: 'Mochila, palanca, martillo, pitones, antorchas, raciones y cuerda' }
];

/** Older item names -> gear id, to know what starting gear is worth and weighs. */
export const GEAR_NAME_HINTS = [
  ['equipo de explorador', 'explorersPack'], ['equipo de dungeon', 'dungeoneersPack'],
  ['herramientas de ladrón', 'thievesTools'], ['útiles de sanador', 'healersKit'], ['palanca', 'crowbar'],
  ['saquito de componentes', 'componentPouch'], ['agua bendita', 'holyWater'], ['antitoxina', 'antitoxin']
];
