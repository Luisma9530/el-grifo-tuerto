// Monsters for the 2024 rules of D&D.
//
// This file includes material from the System Reference Document 5.2.1
// ("SRD 5.2.1") by Wizards of the Coast LLC, available at
// https://www.dndbeyond.com/srd, licensed under the Creative Commons
// Attribution 4.0 International License.
//
// Names are in Spanish and trait descriptions are our own one-line summaries.
// Numbers (AC, HP, initiative, attacks, saves, CR and XP) follow the SRD stat blocks.
// speed is the walking speed in metres. Attack and save actions only cover damage:
// conditions, spells and special abilities are narrated by the Dungeon Master from `traits`.
// `extra`/`extraType`: a second damage of a different type dealt by the same hit.

export const MONSTERS = [
  {
    id: 'commoner',
    name: 'Plebeyo',
    type: 'humanoide',
    size: 'Mediano',
    cr: 0,
    xp: 10,
    ac: 10,
    hp: 4,
    hitDice: '1d8',
    initiative: 0,
    speed: 9,
    stats: { fue: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 },
    saves: {},
    actions: [
      { id: 'club', name: 'Garrote', kind: 'melee', bonus: 2, damage: '1d4', type: 'contundente' }
    ],
    traits: [
      { name: 'Oficio', desc: 'Sabe hacer bien un trabajo cotidiano.' }
    ],
    fearless: false,
    tags: ['taberna', 'ciudad']
  },
  {
    id: 'bandit',
    name: 'Bandido',
    type: 'humanoide',
    size: 'Mediano',
    cr: 0.125,
    xp: 25,
    ac: 12,
    hp: 11,
    hitDice: '2d8+2',
    initiative: 1,
    speed: 9,
    stats: { fue: 11, des: 12, con: 12, int: 10, sab: 10, car: 10 },
    saves: {},
    actions: [
      { id: 'scimitar', name: 'Cimitarra', kind: 'melee', bonus: 3, damage: '1d6+1', type: 'cortante' },
      { id: 'lightCrossbow', name: 'Ballesta Ligera', kind: 'ranged', bonus: 3, damage: '1d8+1', type: 'perforante' }
    ],
    traits: [],
    fearless: false,
    tags: ['bosque', 'ciudad', 'montaña', 'costa']
  },
  {
    id: 'cultist',
    name: 'Sectario',
    type: 'humanoide',
    size: 'Mediano',
    cr: 0.125,
    xp: 25,
    ac: 12,
    hp: 9,
    hitDice: '2d8',
    initiative: 1,
    speed: 9,
    stats: { fue: 11, des: 12, con: 10, int: 10, sab: 11, car: 10 },
    saves: { sab: 2 },
    actions: [
      { id: 'ritualSickle', name: 'Hoz Ritual', kind: 'melee', bonus: 3, damage: '1d4+1', type: 'cortante' }
    ],
    traits: [
      { name: 'Devoto', desc: 'Sirve fanáticamente a una entidad oscura.' }
    ],
    fearless: false,
    tags: ['ciudad', 'subterráneo', 'ruinas']
  },
  {
    id: 'guard',
    name: 'Guardia',
    type: 'humanoide',
    size: 'Mediano',
    cr: 0.125,
    xp: 25,
    ac: 16,
    hp: 11,
    hitDice: '2d8+2',
    initiative: 1,
    speed: 9,
    stats: { fue: 13, des: 12, con: 12, int: 10, sab: 11, car: 10 },
    saves: {},
    actions: [
      { id: 'spear', name: 'Lanza', kind: 'melee', bonus: 3, damage: '1d6+1', type: 'perforante' }
    ],
    traits: [],
    fearless: false,
    tags: ['ciudad', 'taberna']
  },
  {
    id: 'koboldWarrior',
    name: 'Guerrero Kobold',
    type: 'dragón',
    size: 'Pequeño',
    cr: 0.125,
    xp: 25,
    ac: 14,
    hp: 7,
    hitDice: '3d6',
    initiative: 2,
    speed: 9,
    stats: { fue: 7, des: 15, con: 9, int: 8, sab: 7, car: 8 },
    saves: {},
    actions: [
      { id: 'dagger', name: 'Daga', kind: 'melee', bonus: 4, damage: '1d4+2', type: 'perforante' }
    ],
    traits: [
      { name: 'Tácticas de Manada', desc: 'Ataca con ventaja si un aliado está junto a su objetivo.' },
      { name: 'Sensibilidad a la Luz Solar', desc: 'Bajo la luz del sol ataca y percibe peor.' }
    ],
    fearless: false,
    tags: ['subterráneo', 'montaña', 'ruinas']
  },
  {
    id: 'stirge',
    name: 'Estirge',
    type: 'monstruosidad',
    size: 'Diminuto',
    cr: 0.125,
    xp: 25,
    ac: 13,
    hp: 5,
    hitDice: '2d4',
    initiative: 3,
    speed: 3,
    stats: { fue: 4, des: 16, con: 11, int: 2, sab: 8, car: 6 },
    saves: {},
    actions: [
      { id: 'proboscis', name: 'Probóscide', kind: 'melee', bonus: 5, damage: '1d6+3', type: 'perforante' }
    ],
    traits: [
      { name: 'Chupasangre', desc: 'Se queda pegada a su víctima y le sorbe la sangre cada turno.' }
    ],
    fearless: false,
    tags: ['bosque', 'pantano', 'subterráneo']
  },
  {
    id: 'warriorInfantry',
    name: 'Soldado de Infantería',
    type: 'humanoide',
    size: 'Mediano',
    cr: 0.125,
    xp: 25,
    ac: 13,
    hp: 9,
    hitDice: '2d8',
    initiative: 0,
    speed: 9,
    stats: { fue: 13, des: 11, con: 11, int: 8, sab: 11, car: 8 },
    saves: {},
    actions: [
      { id: 'spear', name: 'Lanza', kind: 'melee', bonus: 3, damage: '1d6+1', type: 'perforante' }
    ],
    traits: [
      { name: 'Tácticas de Manada', desc: 'Ataca con ventaja si un aliado está junto a su objetivo.' }
    ],
    fearless: false,
    tags: ['ciudad', 'bosque']
  },
  {
    id: 'goblinMinion',
    name: 'Secuaz Goblin',
    type: 'feérico',
    size: 'Pequeño',
    cr: 0.125,
    xp: 25,
    ac: 12,
    hp: 7,
    hitDice: '2d6',
    initiative: 2,
    speed: 9,
    stats: { fue: 8, des: 15, con: 10, int: 10, sab: 8, car: 8 },
    saves: {},
    actions: [
      { id: 'dagger', name: 'Daga', kind: 'melee', bonus: 4, damage: '1d4+2', type: 'perforante' }
    ],
    traits: [
      { name: 'Huida Ágil', desc: 'Puede retirarse o esconderse como acción adicional.' }
    ],
    fearless: false,
    tags: ['bosque', 'subterráneo', 'ruinas']
  },
  {
    id: 'goblinWarrior',
    name: 'Guerrero Goblin',
    type: 'feérico',
    size: 'Pequeño',
    cr: 0.25,
    xp: 50,
    ac: 15,
    hp: 10,
    hitDice: '3d6',
    initiative: 2,
    speed: 9,
    stats: { fue: 8, des: 15, con: 10, int: 10, sab: 8, car: 8 },
    saves: {},
    actions: [
      { id: 'scimitar', name: 'Cimitarra', kind: 'melee', bonus: 4, damage: '1d6+2', type: 'cortante' },
      { id: 'shortbow', name: 'Arco Corto', kind: 'ranged', bonus: 4, damage: '1d6+2', type: 'perforante' }
    ],
    traits: [
      { name: 'Huida Ágil', desc: 'Puede retirarse o esconderse como acción adicional.' },
      { name: 'Golpe Oportunista', desc: 'Hace más daño cuando ataca con ventaja.' }
    ],
    fearless: false,
    tags: ['bosque', 'subterráneo', 'ruinas']
  },
  {
    id: 'skeleton',
    name: 'Esqueleto',
    type: 'muerto viviente',
    size: 'Mediano',
    cr: 0.25,
    xp: 50,
    ac: 14,
    hp: 13,
    hitDice: '2d8+4',
    initiative: 3,
    speed: 9,
    stats: { fue: 10, des: 16, con: 15, int: 6, sab: 8, car: 5 },
    saves: {},
    actions: [
      { id: 'shortsword', name: 'Espada Corta', kind: 'melee', bonus: 5, damage: '1d6+3', type: 'perforante' },
      { id: 'shortbow', name: 'Arco Corto', kind: 'ranged', bonus: 5, damage: '1d6+3', type: 'perforante' }
    ],
    traits: [
      { name: 'No Muerto', desc: 'No respira, no come y no siente cansancio ni veneno.' }
    ],
    fearless: true,
    tags: ['ruinas', 'subterráneo']
  },
  {
    id: 'zombie',
    name: 'Zombi',
    type: 'muerto viviente',
    size: 'Mediano',
    cr: 0.25,
    xp: 50,
    ac: 8,
    hp: 15,
    hitDice: '2d8+6',
    initiative: -2,
    speed: 6,
    stats: { fue: 13, des: 6, con: 16, int: 3, sab: 6, car: 5 },
    saves: { sab: 0 },
    actions: [
      { id: 'slam', name: 'Golpe', kind: 'melee', bonus: 3, damage: '1d8+1', type: 'contundente' }
    ],
    traits: [
      { name: 'Fortaleza de No Muerto', desc: 'A veces se vuelve a levantar con 1 PG cuando debería caer.' }
    ],
    fearless: true,
    tags: ['ruinas', 'pantano', 'subterráneo']
  },
  {
    id: 'wolf',
    name: 'Lobo',
    type: 'bestia',
    size: 'Mediano',
    cr: 0.25,
    xp: 50,
    ac: 12,
    hp: 11,
    hitDice: '2d8+2',
    initiative: 2,
    speed: 12,
    stats: { fue: 14, des: 15, con: 12, int: 3, sab: 12, car: 6 },
    saves: {},
    actions: [
      { id: 'bite', name: 'Mordisco', kind: 'melee', bonus: 4, damage: '1d6+2', type: 'perforante' }
    ],
    traits: [
      { name: 'Tácticas de Manada', desc: 'Ataca con ventaja si un aliado está junto a su objetivo.' }
    ],
    fearless: false,
    tags: ['bosque', 'montaña', 'ártico']
  },
  {
    id: 'giantWolfSpider',
    name: 'Araña Lobo Gigante',
    type: 'bestia',
    size: 'Mediano',
    cr: 0.25,
    xp: 50,
    ac: 13,
    hp: 11,
    hitDice: '2d8+2',
    initiative: 3,
    speed: 12,
    stats: { fue: 12, des: 16, con: 13, int: 3, sab: 12, car: 4 },
    saves: {},
    actions: [
      { id: 'bite', name: 'Mordisco', kind: 'melee', bonus: 5, damage: '1d4+3', type: 'perforante', extra: '2d4', extraType: 'veneno' }
    ],
    traits: [
      { name: 'Trepar como Arácnido', desc: 'Camina por paredes y techos sin esfuerzo.' }
    ],
    fearless: false,
    tags: ['bosque', 'subterráneo', 'desierto']
  },
  {
    id: 'priestAcolyte',
    name: 'Acólito',
    type: 'humanoide',
    size: 'Mediano',
    cr: 0.25,
    xp: 50,
    ac: 13,
    hp: 11,
    hitDice: '2d8+2',
    initiative: 0,
    speed: 9,
    stats: { fue: 14, des: 10, con: 12, int: 10, sab: 14, car: 11 },
    saves: {},
    actions: [
      { id: 'mace', name: 'Maza', kind: 'melee', bonus: 4, damage: '1d6+2', type: 'contundente', extra: '1d4', extraType: 'radiante' },
      { id: 'radiantFlame', name: 'Llama Radiante', kind: 'ranged', bonus: 4, damage: '2d6', type: 'radiante' }
    ],
    traits: [
      { name: 'Ayuda Divina', desc: 'Una vez al día cura o protege a un aliado.' },
      { name: 'Lanzamiento de Conjuros', desc: 'Puede lanzar varios conjuros además de sus ataques.' }
    ],
    fearless: false,
    tags: ['ciudad', 'taberna', 'ruinas']
  },
  {
    id: 'boar',
    name: 'Jabalí',
    type: 'bestia',
    size: 'Mediano',
    cr: 0.25,
    xp: 50,
    ac: 11,
    hp: 13,
    hitDice: '2d8+4',
    initiative: 0,
    speed: 12,
    stats: { fue: 13, des: 11, con: 14, int: 2, sab: 9, car: 5 },
    saves: {},
    actions: [
      { id: 'gore', name: 'Cornada', kind: 'melee', bonus: 3, damage: '1d6+1', type: 'perforante' }
    ],
    traits: [
      { name: 'Furia Herida', desc: 'Ataca con ventaja cuando está malherido.' },
      { name: 'Carga', desc: 'Si embiste tras correr, puede derribar a su objetivo.' }
    ],
    fearless: false,
    tags: ['bosque', 'montaña']
  },
  {
    id: 'dretch',
    name: 'Dretch',
    type: 'infernal',
    size: 'Pequeño',
    cr: 0.25,
    xp: 50,
    ac: 11,
    hp: 18,
    hitDice: '4d6+4',
    initiative: 0,
    speed: 6,
    stats: { fue: 12, des: 11, con: 12, int: 5, sab: 8, car: 3 },
    saves: {},
    actions: [
      { id: 'rend', name: 'Desgarrar', kind: 'melee', bonus: 3, damage: '1d6+1', type: 'cortante' }
    ],
    traits: [
      { name: 'Nube Fétida', desc: 'Una vez al día suelta un gas que marea a quien lo respira.' }
    ],
    fearless: false,
    tags: ['planos', 'subterráneo']
  },
  {
    id: 'gnollWarrior',
    name: 'Guerrero Gnoll',
    type: 'infernal',
    size: 'Mediano',
    cr: 0.5,
    xp: 100,
    ac: 15,
    hp: 27,
    hitDice: '6d8',
    initiative: 1,
    speed: 9,
    stats: { fue: 14, des: 12, con: 11, int: 6, sab: 10, car: 7 },
    saves: {},
    actions: [
      { id: 'rend', name: 'Desgarrar', kind: 'melee', bonus: 4, damage: '1d6+2', type: 'perforante' },
      { id: 'boneBow', name: 'Arco de Hueso', kind: 'ranged', bonus: 3, damage: '1d10+1', type: 'perforante' }
    ],
    traits: [
      { name: 'Arrasar', desc: 'Tras herir a alguien puede moverse y morder de nuevo.' }
    ],
    fearless: false,
    tags: ['desierto', 'bosque', 'montaña']
  },
  {
    id: 'hobgoblinWarrior',
    name: 'Guerrero Hobgoblin',
    type: 'feérico',
    size: 'Mediano',
    cr: 0.5,
    xp: 100,
    ac: 18,
    hp: 11,
    hitDice: '2d8+2',
    initiative: 3,
    speed: 9,
    stats: { fue: 13, des: 12, con: 12, int: 10, sab: 10, car: 9 },
    saves: {},
    actions: [
      { id: 'longsword', name: 'Espada Larga', kind: 'melee', bonus: 3, damage: '2d10+1', type: 'cortante' },
      { id: 'longbow', name: 'Arco Largo', kind: 'ranged', bonus: 3, damage: '1d8+1', type: 'perforante', extra: '3d4', extraType: 'veneno' }
    ],
    traits: [
      { name: 'Tácticas de Manada', desc: 'Ataca con ventaja si un aliado está junto a su objetivo.' }
    ],
    fearless: false,
    tags: ['montaña', 'bosque', 'ruinas']
  },
  {
    id: 'scout',
    name: 'Explorador',
    type: 'humanoide',
    size: 'Mediano',
    cr: 0.5,
    xp: 100,
    ac: 13,
    hp: 16,
    hitDice: '3d8+3',
    initiative: 2,
    speed: 9,
    stats: { fue: 11, des: 14, con: 12, int: 11, sab: 13, car: 11 },
    saves: {},
    actions: [
      { id: 'shortsword', name: 'Espada Corta', kind: 'melee', bonus: 4, damage: '1d6+2', type: 'perforante' },
      { id: 'longbow', name: 'Arco Largo', kind: 'ranged', bonus: 4, damage: '1d8+2', type: 'perforante' }
    ],
    multiattack: ['shortsword', 'shortsword'],
    traits: [
      { name: 'Ojo Avizor', desc: 'Rara vez lo pillan por sorpresa.' }
    ],
    fearless: false,
    tags: ['bosque', 'montaña', 'costa']
  },
  {
    id: 'shadow',
    name: 'Sombra',
    type: 'muerto viviente',
    size: 'Mediano',
    cr: 0.5,
    xp: 100,
    ac: 12,
    hp: 27,
    hitDice: '5d8+5',
    initiative: 2,
    speed: 12,
    stats: { fue: 6, des: 14, con: 13, int: 6, sab: 10, car: 8 },
    saves: {},
    actions: [
      { id: 'drainingSwipe', name: 'Zarpazo Drenante', kind: 'melee', bonus: 4, damage: '1d6+2', type: 'necrótico' }
    ],
    traits: [
      { name: 'Amorfa', desc: 'Se cuela por rendijas de una pulgada.' },
      { name: 'Debilidad a la Luz', desc: 'Bajo la luz del sol actúa con desventaja.' },
      { name: 'Sigilo Sombrío', desc: 'En la penumbra se esconde como acción adicional.' }
    ],
    fearless: true,
    tags: ['ruinas', 'subterráneo']
  },
  {
    id: 'worg',
    name: 'Huargo',
    type: 'feérico',
    size: 'Grande',
    cr: 0.5,
    xp: 100,
    ac: 13,
    hp: 26,
    hitDice: '4d10+4',
    initiative: 1,
    speed: 15,
    stats: { fue: 16, des: 13, con: 13, int: 7, sab: 11, car: 8 },
    saves: {},
    actions: [
      { id: 'bite', name: 'Mordisco', kind: 'melee', bonus: 5, damage: '1d8+3', type: 'perforante' }
    ],
    traits: [
      { name: 'Montura Malvada', desc: 'Los goblins y hobgoblins lo usan como montura.' }
    ],
    fearless: false,
    tags: ['bosque', 'montaña']
  },
  {
    id: 'blackBear',
    name: 'Oso Negro',
    type: 'bestia',
    size: 'Mediano',
    cr: 0.5,
    xp: 100,
    ac: 11,
    hp: 19,
    hitDice: '3d8+6',
    initiative: 1,
    speed: 9,
    stats: { fue: 15, des: 12, con: 14, int: 2, sab: 12, car: 7 },
    saves: {},
    actions: [
      { id: 'rend', name: 'Desgarrar', kind: 'melee', bonus: 4, damage: '1d6+2', type: 'cortante' }
    ],
    multiattack: ['rend', 'rend'],
    traits: [],
    fearless: false,
    tags: ['bosque', 'montaña']
  },
  {
    id: 'sahuaginWarrior',
    name: 'Guerrero Sahuagin',
    type: 'infernal',
    size: 'Mediano',
    cr: 0.5,
    xp: 100,
    ac: 12,
    hp: 22,
    hitDice: '4d8+4',
    initiative: 0,
    speed: 9,
    stats: { fue: 13, des: 11, con: 12, int: 12, sab: 13, car: 9 },
    saves: {},
    actions: [
      { id: 'claw', name: 'Garra', kind: 'melee', bonus: 3, damage: '1d6+1', type: 'cortante' }
    ],
    multiattack: ['claw', 'claw'],
    traits: [
      { name: 'Frenesí de Sangre', desc: 'Ataca con ventaja a quien ya está herido.' },
      { name: 'Telepatía con Tiburones', desc: 'Puede dar órdenes a los tiburones cercanos.' }
    ],
    fearless: false,
    tags: ['mar', 'costa']
  },
  {
    id: 'grayOoze',
    name: 'Cieno Gris',
    type: 'cieno',
    size: 'Mediano',
    cr: 0.5,
    xp: 100,
    ac: 9,
    hp: 22,
    hitDice: '3d8+9',
    initiative: -2,
    speed: 3,
    stats: { fue: 12, des: 6, con: 16, int: 1, sab: 6, car: 2 },
    saves: {},
    actions: [
      { id: 'pseudopod', name: 'Seudópodo', kind: 'melee', bonus: 3, damage: '2d8+1', type: 'ácido' }
    ],
    traits: [
      { name: 'Forma Corrosiva', desc: 'Corroe el metal que lo toca o lo golpea.' },
      { name: 'Amorfo', desc: 'Se cuela por rendijas estrechas.' }
    ],
    fearless: true,
    tags: ['subterráneo', 'ruinas', 'pantano']
  },
  {
    id: 'bugbearWarrior',
    name: 'Guerrero Osgo',
    type: 'feérico',
    size: 'Mediano',
    cr: 1,
    xp: 200,
    ac: 14,
    hp: 33,
    hitDice: '6d8+6',
    initiative: 2,
    speed: 9,
    stats: { fue: 15, des: 14, con: 13, int: 8, sab: 11, car: 9 },
    saves: {},
    actions: [
      { id: 'grab', name: 'Agarrón', kind: 'melee', bonus: 4, damage: '2d6+2', type: 'contundente' },
      { id: 'lightHammer', name: 'Martillo Ligero', kind: 'melee', bonus: 4, damage: '3d4+2', type: 'contundente' }
    ],
    traits: [
      { name: 'Raptor', desc: 'Puede cargar con una víctima agarrada sin frenarse.' },
      { name: 'Brazos Largos', desc: 'Su alcance es mayor del habitual.' }
    ],
    fearless: false,
    tags: ['bosque', 'subterráneo', 'montaña']
  },
  {
    id: 'ghoul',
    name: 'Necrófago',
    type: 'muerto viviente',
    size: 'Mediano',
    cr: 1,
    xp: 200,
    ac: 12,
    hp: 22,
    hitDice: '5d8',
    initiative: 2,
    speed: 9,
    stats: { fue: 13, des: 15, con: 10, int: 7, sab: 10, car: 6 },
    saves: {},
    actions: [
      { id: 'bite', name: 'Mordisco', kind: 'melee', bonus: 4, damage: '1d6+2', type: 'perforante', extra: '1d6', extraType: 'necrótico' },
      { id: 'claw', name: 'Garra', kind: 'melee', bonus: 4, damage: '1d4+2', type: 'cortante' }
    ],
    multiattack: ['bite', 'bite'],
    traits: [
      { name: 'Garras Paralizantes', desc: 'Sus zarpazos pueden dejar paralizada a la víctima.' }
    ],
    fearless: true,
    tags: ['ruinas', 'subterráneo', 'pantano']
  },
  {
    id: 'goblinBoss',
    name: 'Jefe Goblin',
    type: 'feérico',
    size: 'Pequeño',
    cr: 1,
    xp: 200,
    ac: 17,
    hp: 21,
    hitDice: '6d6',
    initiative: 2,
    speed: 9,
    stats: { fue: 10, des: 15, con: 10, int: 10, sab: 8, car: 10 },
    saves: {},
    actions: [
      { id: 'scimitar', name: 'Cimitarra', kind: 'melee', bonus: 4, damage: '1d6+2', type: 'cortante' },
      { id: 'shortbow', name: 'Arco Corto', kind: 'ranged', bonus: 4, damage: '1d6+2', type: 'perforante' }
    ],
    multiattack: ['scimitar', 'scimitar'],
    traits: [
      { name: 'Huida Ágil', desc: 'Puede retirarse o esconderse como acción adicional.' },
      { name: 'Redirigir Ataque', desc: 'Hace que un goblin cercano reciba un golpe en su lugar.' }
    ],
    fearless: false,
    tags: ['bosque', 'subterráneo', 'ruinas']
  },
  {
    id: 'harpy',
    name: 'Arpía',
    type: 'monstruosidad',
    size: 'Mediano',
    cr: 1,
    xp: 200,
    ac: 11,
    hp: 38,
    hitDice: '7d8+7',
    initiative: 1,
    speed: 6,
    stats: { fue: 12, des: 13, con: 12, int: 7, sab: 10, car: 13 },
    saves: {},
    actions: [
      { id: 'claw', name: 'Garra', kind: 'melee', bonus: 3, damage: '2d4+1', type: 'cortante' }
    ],
    traits: [
      { name: 'Canto Seductor', desc: 'Su canción atrae a los humanoides hacia ella.' }
    ],
    fearless: false,
    tags: ['costa', 'montaña', 'bosque']
  },
  {
    id: 'imp',
    name: 'Diablillo',
    type: 'infernal',
    size: 'Diminuto',
    cr: 1,
    xp: 200,
    ac: 13,
    hp: 21,
    hitDice: '6d4+6',
    initiative: 3,
    speed: 6,
    stats: { fue: 6, des: 17, con: 13, int: 11, sab: 12, car: 14 },
    saves: {},
    actions: [
      { id: 'sting', name: 'Aguijón', kind: 'melee', bonus: 5, damage: '1d6+3', type: 'perforante', extra: '2d6', extraType: 'veneno' }
    ],
    traits: [
      { name: 'Resistencia Mágica', desc: 'Tiene ventaja en las salvaciones contra conjuros y efectos mágicos.' },
      { name: 'Invisibilidad', desc: 'Puede volverse invisible a voluntad.' },
      { name: 'Cambiar de Forma', desc: 'Se transforma en rata, cuervo o araña.' }
    ],
    fearless: false,
    tags: ['planos', 'ciudad', 'subterráneo']
  },
  {
    id: 'specter',
    name: 'Espectro',
    type: 'muerto viviente',
    size: 'Mediano',
    cr: 1,
    xp: 200,
    ac: 12,
    hp: 22,
    hitDice: '5d8',
    initiative: 2,
    speed: 9,
    stats: { fue: 1, des: 14, con: 11, int: 10, sab: 10, car: 11 },
    saves: {},
    actions: [
      { id: 'lifeDrain', name: 'Drenar Vida', kind: 'melee', bonus: 4, damage: '2d6', type: 'necrótico' }
    ],
    traits: [
      { name: 'Movimiento Incorpóreo', desc: 'Atraviesa criaturas y objetos como si fueran terreno difícil.' },
      { name: 'Sensibilidad a la Luz Solar', desc: 'Bajo la luz del sol ataca y percibe peor.' },
      { name: 'Drenar Vida', desc: 'Su toque reduce los puntos de golpe máximos.' }
    ],
    fearless: true,
    tags: ['ruinas', 'subterráneo']
  },
  {
    id: 'spy',
    name: 'Espía',
    type: 'humanoide',
    size: 'Mediano',
    cr: 1,
    xp: 200,
    ac: 12,
    hp: 27,
    hitDice: '6d8',
    initiative: 4,
    speed: 9,
    stats: { fue: 10, des: 15, con: 10, int: 12, sab: 14, car: 16 },
    saves: {},
    actions: [
      { id: 'shortsword', name: 'Espada Corta', kind: 'melee', bonus: 4, damage: '1d6+2', type: 'perforante', extra: '2d6', extraType: 'veneno' },
      { id: 'handCrossbow', name: 'Ballesta de Mano', kind: 'ranged', bonus: 4, damage: '1d6+2', type: 'perforante', extra: '2d6', extraType: 'veneno' }
    ],
    traits: [
      { name: 'Acción Astuta', desc: 'Corre, se retira o se esconde como acción adicional.' }
    ],
    fearless: false,
    tags: ['ciudad', 'taberna']
  },
  {
    id: 'brownBear',
    name: 'Oso Pardo',
    type: 'bestia',
    size: 'Grande',
    cr: 1,
    xp: 200,
    ac: 11,
    hp: 22,
    hitDice: '3d10+6',
    initiative: 1,
    speed: 12,
    stats: { fue: 17, des: 12, con: 15, int: 2, sab: 13, car: 7 },
    saves: {},
    actions: [
      { id: 'bite', name: 'Mordisco', kind: 'melee', bonus: 5, damage: '1d8+3', type: 'perforante' },
      { id: 'claw', name: 'Garra', kind: 'melee', bonus: 5, damage: '1d4+3', type: 'cortante' }
    ],
    multiattack: ['bite', 'claw'],
    traits: [],
    fearless: false,
    tags: ['bosque', 'montaña']
  },
  {
    id: 'direWolf',
    name: 'Lobo Terrible',
    type: 'bestia',
    size: 'Grande',
    cr: 1,
    xp: 200,
    ac: 14,
    hp: 22,
    hitDice: '3d10+6',
    initiative: 2,
    speed: 15,
    stats: { fue: 17, des: 15, con: 15, int: 3, sab: 12, car: 7 },
    saves: {},
    actions: [
      { id: 'bite', name: 'Mordisco', kind: 'melee', bonus: 5, damage: '1d10+3', type: 'perforante' }
    ],
    traits: [
      { name: 'Tácticas de Manada', desc: 'Ataca con ventaja si un aliado está junto a su objetivo.' }
    ],
    fearless: false,
    tags: ['bosque', 'montaña', 'ártico']
  },
  {
    id: 'animatedArmor',
    name: 'Armadura Animada',
    type: 'constructo',
    size: 'Mediano',
    cr: 1,
    xp: 200,
    ac: 18,
    hp: 33,
    hitDice: '6d8+6',
    initiative: 2,
    speed: 7.5,
    stats: { fue: 14, des: 11, con: 13, int: 1, sab: 3, car: 1 },
    saves: {},
    actions: [
      { id: 'slam', name: 'Golpe', kind: 'melee', bonus: 4, damage: '1d6+2', type: 'contundente' }
    ],
    multiattack: ['slam', 'slam'],
    traits: [
      { name: 'Constructo', desc: 'No respira, no duerme y no siente miedo.' }
    ],
    fearless: true,
    tags: ['ruinas', 'subterráneo']
  },
  {
    id: 'pirate',
    name: 'Pirata',
    type: 'humanoide',
    size: 'Mediano',
    cr: 1,
    xp: 200,
    ac: 14,
    hp: 33,
    hitDice: '6d8+6',
    initiative: 5,
    speed: 9,
    stats: { fue: 10, des: 16, con: 12, int: 8, sab: 12, car: 14 },
    saves: { des: 5, car: 4 },
    actions: [
      { id: 'dagger', name: 'Daga', kind: 'melee', bonus: 5, damage: '1d4+3', type: 'perforante' }
    ],
    multiattack: ['dagger', 'dagger'],
    traits: [
      { name: 'Encanto Arrollador', desc: 'Su descaro puede dejar hechizado a un rival.' }
    ],
    fearless: false,
    tags: ['mar', 'costa', 'taberna']
  },
  {
    id: 'banditCaptain',
    name: 'Capitán Bandido',
    type: 'humanoide',
    size: 'Mediano',
    cr: 2,
    xp: 450,
    ac: 15,
    hp: 52,
    hitDice: '8d8+16',
    initiative: 3,
    speed: 9,
    stats: { fue: 15, des: 16, con: 14, int: 14, sab: 11, car: 14 },
    saves: { fue: 4, des: 5, sab: 2 },
    actions: [
      { id: 'scimitar', name: 'Cimitarra', kind: 'melee', bonus: 5, damage: '1d6+3', type: 'cortante' },
      { id: 'pistol', name: 'Pistola', kind: 'ranged', bonus: 5, damage: '1d10+3', type: 'perforante' }
    ],
    multiattack: ['scimitar', 'scimitar'],
    traits: [
      { name: 'Parada', desc: 'Como reacción, suma a su CA para desviar un ataque cuerpo a cuerpo.' }
    ],
    fearless: false,
    tags: ['bosque', 'ciudad', 'montaña', 'costa']
  },
  {
    id: 'berserker',
    name: 'Berserker',
    type: 'humanoide',
    size: 'Mediano',
    cr: 2,
    xp: 450,
    ac: 13,
    hp: 67,
    hitDice: '9d8+27',
    initiative: 1,
    speed: 9,
    stats: { fue: 16, des: 12, con: 17, int: 9, sab: 11, car: 9 },
    saves: {},
    actions: [
      { id: 'greataxe', name: 'Gran Hacha', kind: 'melee', bonus: 5, damage: '1d12+3', type: 'cortante' }
    ],
    traits: [
      { name: 'Frenesí Sangriento', desc: 'Ataca con ventaja cuando está malherido.' }
    ],
    fearless: false,
    tags: ['montaña', 'ártico', 'bosque']
  },
  {
    id: 'cultistFanatic',
    name: 'Sectario Fanático',
    type: 'humanoide',
    size: 'Mediano',
    cr: 2,
    xp: 450,
    ac: 13,
    hp: 44,
    hitDice: '8d8+8',
    initiative: 2,
    speed: 9,
    stats: { fue: 11, des: 14, con: 12, int: 10, sab: 14, car: 13 },
    saves: { sab: 4 },
    actions: [
      { id: 'pactBlade', name: 'Hoja del Pacto', kind: 'melee', bonus: 4, damage: '1d8+2', type: 'cortante', extra: '2d6', extraType: 'necrótico' }
    ],
    traits: [
      { name: 'Lanzamiento de Conjuros', desc: 'Puede lanzar varios conjuros además de sus ataques.' },
      { name: 'Arma Espiritual', desc: 'Invoca un arma espectral que golpea a sus enemigos.' }
    ],
    fearless: false,
    tags: ['ciudad', 'subterráneo', 'ruinas']
  },
  {
    id: 'gargoyle',
    name: 'Gárgola',
    type: 'elemental',
    size: 'Mediano',
    cr: 2,
    xp: 450,
    ac: 15,
    hp: 67,
    hitDice: '9d8+27',
    initiative: 2,
    speed: 9,
    stats: { fue: 15, des: 11, con: 16, int: 6, sab: 11, car: 7 },
    saves: {},
    actions: [
      { id: 'claw', name: 'Garra', kind: 'melee', bonus: 4, damage: '2d4+2', type: 'cortante' }
    ],
    multiattack: ['claw', 'claw'],
    traits: [
      { name: 'Apariencia Pétrea', desc: 'Inmóvil, parece una estatua corriente.' },
      { name: 'Vuelo Rasante', desc: 'Vuela sin provocar ataques de oportunidad.' }
    ],
    fearless: false,
    tags: ['ruinas', 'ciudad', 'montaña']
  },
  {
    id: 'gelatinousCube',
    name: 'Cubo Gelatinoso',
    type: 'cieno',
    size: 'Grande',
    cr: 2,
    xp: 450,
    ac: 6,
    hp: 63,
    hitDice: '6d10+30',
    initiative: -4,
    speed: 4.5,
    stats: { fue: 14, des: 3, con: 20, int: 1, sab: 6, car: 1 },
    saves: {},
    actions: [
      { id: 'pseudopod', name: 'Seudópodo', kind: 'melee', bonus: 4, damage: '3d6+2', type: 'ácido' }
    ],
    traits: [
      { name: 'Transparente', desc: 'Es casi invisible hasta que se mueve.' },
      { name: 'Engullir', desc: 'Avanza sobre sus víctimas y las disuelve dentro de su cuerpo.' }
    ],
    fearless: true,
    tags: ['subterráneo', 'ruinas']
  },
  {
    id: 'ghast',
    name: 'Ghast',
    type: 'muerto viviente',
    size: 'Mediano',
    cr: 2,
    xp: 450,
    ac: 13,
    hp: 36,
    hitDice: '8d8',
    initiative: 3,
    speed: 9,
    stats: { fue: 16, des: 17, con: 10, int: 11, sab: 10, car: 8 },
    saves: { sab: 2 },
    actions: [
      { id: 'bite', name: 'Mordisco', kind: 'melee', bonus: 5, damage: '1d8+3', type: 'perforante', extra: '2d8', extraType: 'necrótico' },
      { id: 'claw', name: 'Garra', kind: 'melee', bonus: 5, damage: '2d6+3', type: 'cortante' }
    ],
    traits: [
      { name: 'Hedor', desc: 'Su olor nauseabundo envenena a quien está cerca.' },
      { name: 'Garras Paralizantes', desc: 'Sus zarpazos pueden dejar paralizada a la víctima.' }
    ],
    fearless: true,
    tags: ['ruinas', 'subterráneo', 'pantano']
  },
  {
    id: 'ogre',
    name: 'Ogro',
    type: 'gigante',
    size: 'Grande',
    cr: 2,
    xp: 450,
    ac: 11,
    hp: 68,
    hitDice: '8d10+24',
    initiative: -1,
    speed: 12,
    stats: { fue: 19, des: 8, con: 16, int: 5, sab: 7, car: 7 },
    saves: {},
    actions: [
      { id: 'greatclub', name: 'Gran Garrote', kind: 'melee', bonus: 6, damage: '2d8+4', type: 'contundente' },
      { id: 'javelin', name: 'Jabalina', kind: 'melee', bonus: 6, damage: '2d6+4', type: 'perforante' }
    ],
    traits: [],
    fearless: false,
    tags: ['montaña', 'bosque', 'pantano']
  },
  {
    id: 'priest',
    name: 'Sacerdote',
    type: 'humanoide',
    size: 'Mediano',
    cr: 2,
    xp: 450,
    ac: 13,
    hp: 38,
    hitDice: '7d8+7',
    initiative: 0,
    speed: 9,
    stats: { fue: 16, des: 10, con: 12, int: 13, sab: 16, car: 13 },
    saves: {},
    actions: [
      { id: 'mace', name: 'Maza', kind: 'melee', bonus: 5, damage: '1d6+3', type: 'contundente', extra: '2d4', extraType: 'radiante' },
      { id: 'radiantFlame', name: 'Llama Radiante', kind: 'ranged', bonus: 5, damage: '2d10', type: 'radiante' }
    ],
    multiattack: ['mace', 'mace'],
    traits: [
      { name: 'Ayuda Divina', desc: 'Varias veces al día cura o protege a un aliado.' },
      { name: 'Lanzamiento de Conjuros', desc: 'Puede lanzar varios conjuros además de sus ataques.' }
    ],
    fearless: false,
    tags: ['ciudad', 'ruinas']
  },
  {
    id: 'mimic',
    name: 'Mímico',
    type: 'monstruosidad',
    size: 'Mediano',
    cr: 2,
    xp: 450,
    ac: 12,
    hp: 58,
    hitDice: '9d8+18',
    initiative: 3,
    speed: 6,
    stats: { fue: 17, des: 12, con: 15, int: 5, sab: 13, car: 8 },
    saves: {},
    actions: [
      { id: 'bite', name: 'Mordisco', kind: 'melee', bonus: 5, damage: '1d8+3', type: 'perforante' },
      { id: 'pseudopod', name: 'Seudópodo', kind: 'melee', bonus: 5, damage: '1d8+3', type: 'contundente', extra: '1d8', extraType: 'ácido' }
    ],
    traits: [
      { name: 'Cambiar de Forma', desc: 'Se hace pasar por un cofre, una puerta u otro objeto.' },
      { name: 'Adhesivo', desc: 'Lo que toca se queda pegado a su cuerpo.' }
    ],
    fearless: false,
    tags: ['subterráneo', 'ruinas', 'taberna']
  },
  {
    id: 'griffon',
    name: 'Grifo',
    type: 'monstruosidad',
    size: 'Grande',
    cr: 2,
    xp: 450,
    ac: 12,
    hp: 59,
    hitDice: '7d10+21',
    initiative: 2,
    speed: 9,
    stats: { fue: 18, des: 15, con: 16, int: 2, sab: 13, car: 8 },
    saves: {},
    actions: [
      { id: 'rend', name: 'Desgarrar', kind: 'melee', bonus: 6, damage: '1d8+4', type: 'perforante' }
    ],
    multiattack: ['rend', 'rend'],
    traits: [
      { name: 'Vuelo', desc: 'Ataca desde el aire a gran velocidad.' }
    ],
    fearless: false,
    tags: ['montaña', 'costa']
  },
  {
    id: 'basilisk',
    name: 'Basilisco',
    type: 'monstruosidad',
    size: 'Mediano',
    cr: 3,
    xp: 700,
    ac: 15,
    hp: 52,
    hitDice: '8d8+16',
    initiative: -1,
    speed: 6,
    stats: { fue: 16, des: 8, con: 15, int: 2, sab: 8, car: 7 },
    saves: {},
    actions: [
      { id: 'bite', name: 'Mordisco', kind: 'melee', bonus: 5, damage: '2d6+3', type: 'perforante', extra: '2d6', extraType: 'veneno' }
    ],
    traits: [
      { name: 'Mirada Petrificante', desc: 'Su mirada puede convertir en piedra a quien la cruza.' }
    ],
    fearless: false,
    tags: ['subterráneo', 'montaña', 'desierto']
  },
  {
    id: 'beardedDevil',
    name: 'Diablo Barbudo',
    type: 'infernal',
    size: 'Mediano',
    cr: 3,
    xp: 700,
    ac: 13,
    hp: 58,
    hitDice: '9d8+18',
    initiative: 2,
    speed: 9,
    stats: { fue: 16, des: 15, con: 15, int: 9, sab: 11, car: 14 },
    saves: { fue: 5, con: 4, car: 4 },
    actions: [
      { id: 'beard', name: 'Barba', kind: 'melee', bonus: 5, damage: '1d8+3', type: 'perforante' },
      { id: 'infernalGlaive', name: 'Guja Infernal', kind: 'melee', bonus: 5, damage: '1d10+3', type: 'cortante' }
    ],
    multiattack: ['beard', 'infernalGlaive'],
    traits: [
      { name: 'Resistencia Mágica', desc: 'Tiene ventaja en las salvaciones contra conjuros y efectos mágicos.' },
      { name: 'Guja Infernal', desc: 'Sus heridas siguen sangrando hasta que alguien las cura.' }
    ],
    fearless: true,
    tags: ['planos']
  },
  {
    id: 'doppelganger',
    name: 'Doppelganger',
    type: 'monstruosidad',
    size: 'Mediano',
    cr: 3,
    xp: 700,
    ac: 14,
    hp: 52,
    hitDice: '8d8+16',
    initiative: 4,
    speed: 9,
    stats: { fue: 11, des: 18, con: 14, int: 11, sab: 12, car: 14 },
    saves: {},
    actions: [
      { id: 'slam', name: 'Golpe', kind: 'melee', bonus: 6, damage: '2d6+4', type: 'contundente' }
    ],
    multiattack: ['slam', 'slam'],
    traits: [
      { name: 'Cambiar de Forma', desc: 'Adopta el aspecto de cualquier humanoide.' },
      { name: 'Leer Pensamientos', desc: 'Lee la mente superficial de quien tiene cerca.' }
    ],
    fearless: false,
    tags: ['ciudad', 'taberna']
  },
  {
    id: 'greenHag',
    name: 'Saga Verde',
    type: 'feérico',
    size: 'Mediano',
    cr: 3,
    xp: 700,
    ac: 17,
    hp: 82,
    hitDice: '11d8+33',
    initiative: 1,
    speed: 9,
    stats: { fue: 18, des: 12, con: 16, int: 13, sab: 14, car: 14 },
    saves: {},
    actions: [
      { id: 'claw', name: 'Garra', kind: 'melee', bonus: 6, damage: '1d8+4', type: 'cortante', extra: '1d6', extraType: 'veneno' }
    ],
    multiattack: ['claw', 'claw'],
    traits: [
      { name: 'Anfibio', desc: 'Respira tanto en el aire como bajo el agua.' },
      { name: 'Mimetismo', desc: 'Imita voces y sonidos de animales.' },
      { name: 'Lanzamiento de Conjuros', desc: 'Puede lanzar varios conjuros además de sus ataques.' }
    ],
    fearless: false,
    tags: ['pantano', 'bosque']
  },
  {
    id: 'hellHound',
    name: 'Perro del Infierno',
    type: 'infernal',
    size: 'Mediano',
    cr: 3,
    xp: 700,
    ac: 15,
    hp: 58,
    hitDice: '9d8+18',
    initiative: 1,
    speed: 15,
    stats: { fue: 17, des: 12, con: 14, int: 6, sab: 13, car: 6 },
    saves: {},
    actions: [
      { id: 'bite', name: 'Mordisco', kind: 'melee', bonus: 5, damage: '1d8+3', type: 'perforante', extra: '1d6', extraType: 'fuego' },
      { id: 'fireBreath', name: 'Aliento de Fuego', kind: 'save', save: 'des', dc: 12, damage: '5d6', type: 'fuego', half: true, recharge: [5, 6] }
    ],
    multiattack: ['bite', 'bite'],
    traits: [
      { name: 'Tácticas de Manada', desc: 'Ataca con ventaja si un aliado está junto a su objetivo.' },
      { name: 'Aliento de Fuego', desc: 'Escupe un cono de llamas cada pocos turnos.' }
    ],
    fearless: false,
    tags: ['planos', 'montaña']
  },
  {
    id: 'hobgoblinCaptain',
    name: 'Capitán Hobgoblin',
    type: 'feérico',
    size: 'Mediano',
    cr: 3,
    xp: 700,
    ac: 17,
    hp: 58,
    hitDice: '9d8+18',
    initiative: 4,
    speed: 9,
    stats: { fue: 15, des: 14, con: 14, int: 12, sab: 10, car: 13 },
    saves: {},
    actions: [
      { id: 'greatsword', name: 'Mandoble', kind: 'melee', bonus: 4, damage: '2d6+2', type: 'cortante', extra: '1d6', extraType: 'veneno' },
      { id: 'longbow', name: 'Arco Largo', kind: 'ranged', bonus: 4, damage: '1d8+2', type: 'perforante', extra: '2d4', extraType: 'veneno' }
    ],
    multiattack: ['greatsword', 'greatsword'],
    traits: [
      { name: 'Aura de Autoridad', desc: 'Sus aliados cercanos resisten mejor el miedo y el hechizo.' }
    ],
    fearless: false,
    tags: ['montaña', 'bosque', 'ruinas']
  },
  {
    id: 'knight',
    name: 'Caballero',
    type: 'humanoide',
    size: 'Mediano',
    cr: 3,
    xp: 700,
    ac: 18,
    hp: 52,
    hitDice: '8d8+16',
    initiative: 0,
    speed: 9,
    stats: { fue: 16, des: 11, con: 14, int: 11, sab: 11, car: 15 },
    saves: { con: 4, sab: 2 },
    actions: [
      { id: 'greatsword', name: 'Mandoble', kind: 'melee', bonus: 5, damage: '2d6+3', type: 'cortante', extra: '1d8', extraType: 'radiante' },
      { id: 'heavyCrossbow', name: 'Ballesta Pesada', kind: 'ranged', bonus: 2, damage: '2d10', type: 'perforante', extra: '1d8', extraType: 'radiante' }
    ],
    multiattack: ['greatsword', 'greatsword'],
    traits: [
      { name: 'Parada', desc: 'Como reacción, suma a su CA para desviar un ataque cuerpo a cuerpo.' },
      { name: 'Valiente', desc: 'Nunca se deja asustar.' }
    ],
    fearless: true,
    tags: ['ciudad', 'bosque']
  },
  {
    id: 'manticore',
    name: 'Mantícora',
    type: 'monstruosidad',
    size: 'Grande',
    cr: 3,
    xp: 700,
    ac: 14,
    hp: 68,
    hitDice: '8d10+24',
    initiative: 3,
    speed: 9,
    stats: { fue: 17, des: 16, con: 17, int: 7, sab: 12, car: 8 },
    saves: {},
    actions: [
      { id: 'rend', name: 'Desgarrar', kind: 'melee', bonus: 5, damage: '1d8+3', type: 'cortante' },
      { id: 'tailSpike', name: 'Púa de la Cola', kind: 'ranged', bonus: 5, damage: '1d8+3', type: 'perforante' }
    ],
    multiattack: ['rend', 'rend', 'rend'],
    traits: [
      { name: 'Púas de la Cola', desc: 'Dispara púas desde la cola a distancia.' }
    ],
    fearless: false,
    tags: ['montaña', 'desierto']
  },
  {
    id: 'minotaurOfBaphomet',
    name: 'Minotauro de Baphomet',
    type: 'monstruosidad',
    size: 'Grande',
    cr: 3,
    xp: 700,
    ac: 14,
    hp: 85,
    hitDice: '10d10+30',
    initiative: 0,
    speed: 12,
    stats: { fue: 18, des: 11, con: 16, int: 6, sab: 16, car: 9 },
    saves: {},
    actions: [
      { id: 'abyssalGlaive', name: 'Guja Abisal', kind: 'melee', bonus: 6, damage: '1d12+4', type: 'cortante', extra: '3d6', extraType: 'necrótico' },
      { id: 'gore', name: 'Cornada', kind: 'melee', bonus: 6, damage: '4d6+4', type: 'perforante' }
    ],
    traits: [
      { name: 'Embestida', desc: 'Si carga antes de cornear, derriba a su objetivo.' }
    ],
    fearless: false,
    tags: ['subterráneo', 'ruinas']
  },
  {
    id: 'mummy',
    name: 'Momia',
    type: 'muerto viviente',
    size: 'Mediano',
    cr: 3,
    xp: 700,
    ac: 11,
    hp: 58,
    hitDice: '9d8+18',
    initiative: -1,
    speed: 6,
    stats: { fue: 16, des: 8, con: 15, int: 6, sab: 12, car: 12 },
    saves: { sab: 3 },
    actions: [
      { id: 'rottingFist', name: 'Puño Putrefacto', kind: 'melee', bonus: 5, damage: '1d10+3', type: 'contundente', extra: '3d6', extraType: 'necrótico' }
    ],
    multiattack: ['rottingFist', 'rottingFist'],
    traits: [
      { name: 'Mirada Aterradora', desc: 'Su mirada paraliza de miedo.' },
      { name: 'Podredumbre', desc: 'Sus golpes transmiten una maldición que pudre la carne.' }
    ],
    fearless: true,
    tags: ['desierto', 'ruinas']
  },
  {
    id: 'owlbear',
    name: 'Oso Lechuza',
    type: 'monstruosidad',
    size: 'Grande',
    cr: 3,
    xp: 700,
    ac: 13,
    hp: 59,
    hitDice: '7d10+21',
    initiative: 1,
    speed: 12,
    stats: { fue: 20, des: 12, con: 17, int: 3, sab: 12, car: 7 },
    saves: {},
    actions: [
      { id: 'rend', name: 'Desgarrar', kind: 'melee', bonus: 7, damage: '2d8+5', type: 'cortante' }
    ],
    multiattack: ['rend', 'rend'],
    traits: [],
    fearless: false,
    tags: ['bosque', 'montaña']
  },
  {
    id: 'warriorVeteran',
    name: 'Guerrero Veterano',
    type: 'humanoide',
    size: 'Mediano',
    cr: 3,
    xp: 700,
    ac: 17,
    hp: 65,
    hitDice: '10d8+20',
    initiative: 3,
    speed: 9,
    stats: { fue: 16, des: 13, con: 14, int: 10, sab: 11, car: 10 },
    saves: {},
    actions: [
      { id: 'greatsword', name: 'Mandoble', kind: 'melee', bonus: 5, damage: '2d6+3', type: 'cortante' },
      { id: 'heavyCrossbow', name: 'Ballesta Pesada', kind: 'ranged', bonus: 3, damage: '2d10+1', type: 'perforante' }
    ],
    multiattack: ['greatsword', 'greatsword'],
    traits: [
      { name: 'Parada', desc: 'Como reacción, suma a su CA para desviar un ataque cuerpo a cuerpo.' }
    ],
    fearless: false,
    tags: ['ciudad', 'taberna', 'bosque']
  },
  {
    id: 'wight',
    name: 'Tumulario',
    type: 'muerto viviente',
    size: 'Mediano',
    cr: 3,
    xp: 700,
    ac: 14,
    hp: 82,
    hitDice: '11d8+33',
    initiative: 4,
    speed: 9,
    stats: { fue: 15, des: 14, con: 16, int: 10, sab: 13, car: 15 },
    saves: {},
    actions: [
      { id: 'necroticSword', name: 'Espada Necrótica', kind: 'melee', bonus: 4, damage: '1d8+2', type: 'cortante', extra: '1d8', extraType: 'necrótico' },
      { id: 'necroticBow', name: 'Arco Necrótico', kind: 'ranged', bonus: 4, damage: '1d8+2', type: 'perforante', extra: '1d8', extraType: 'necrótico' },
      { id: 'lifeDrain', name: 'Drenar Vida', kind: 'save', save: 'con', dc: 13, damage: '1d8+2', type: 'necrótico' }
    ],
    multiattack: ['necroticSword', 'necroticSword'],
    traits: [
      { name: 'Sensibilidad a la Luz Solar', desc: 'Bajo la luz del sol ataca y percibe peor.' },
      { name: 'Drenar Vida', desc: 'Su toque reduce los puntos de golpe máximos y alza a los muertos.' }
    ],
    fearless: true,
    tags: ['ruinas', 'pantano']
  },
  {
    id: 'werewolf',
    name: 'Hombre Lobo',
    type: 'monstruosidad',
    size: 'Mediano',
    cr: 3,
    xp: 700,
    ac: 15,
    hp: 71,
    hitDice: '11d8+22',
    initiative: 4,
    speed: 9,
    stats: { fue: 16, des: 14, con: 14, int: 10, sab: 11, car: 10 },
    saves: {},
    actions: [
      { id: 'bite', name: 'Mordisco', kind: 'melee', bonus: 5, damage: '2d8+3', type: 'perforante' },
      { id: 'scratch', name: 'Arañazo', kind: 'melee', bonus: 5, damage: '2d6+3', type: 'cortante' },
      { id: 'longbow', name: 'Arco Largo', kind: 'ranged', bonus: 4, damage: '2d8+2', type: 'perforante' }
    ],
    multiattack: ['scratch', 'scratch'],
    traits: [
      { name: 'Tácticas de Manada', desc: 'Ataca con ventaja si un aliado está junto a su objetivo.' },
      { name: 'Cambiar de Forma', desc: 'Alterna entre humano, lobo e híbrido.' },
      { name: 'Licantropía', desc: 'Su mordisco puede contagiar la maldición.' }
    ],
    fearless: false,
    tags: ['bosque', 'montaña']
  },
  {
    id: 'blackPudding',
    name: 'Pudin Negro',
    type: 'cieno',
    size: 'Grande',
    cr: 4,
    xp: 1100,
    ac: 7,
    hp: 68,
    hitDice: '8d10+24',
    initiative: -3,
    speed: 6,
    stats: { fue: 16, des: 5, con: 16, int: 1, sab: 6, car: 1 },
    saves: {},
    actions: [
      { id: 'dissolvingPseudopod', name: 'Seudópodo Disolvente', kind: 'melee', bonus: 5, damage: '4d6+3', type: 'ácido' }
    ],
    traits: [
      { name: 'Forma Corrosiva', desc: 'Disuelve el metal y la madera que lo tocan.' },
      { name: 'Dividirse', desc: 'Al recibir un tajo se parte en dos.' }
    ],
    fearless: true,
    tags: ['subterráneo', 'ruinas']
  },
  {
    id: 'chuul',
    name: 'Chuul',
    type: 'aberración',
    size: 'Grande',
    cr: 4,
    xp: 1100,
    ac: 16,
    hp: 76,
    hitDice: '9d10+27',
    initiative: 0,
    speed: 9,
    stats: { fue: 19, des: 10, con: 16, int: 5, sab: 11, car: 5 },
    saves: {},
    actions: [
      { id: 'pincer', name: 'Pinza', kind: 'melee', bonus: 6, damage: '1d10+4', type: 'contundente' }
    ],
    multiattack: ['pincer', 'pincer'],
    traits: [
      { name: 'Anfibio', desc: 'Respira tanto en el aire como bajo el agua.' },
      { name: 'Percibir Magia', desc: 'Siente la magia a su alrededor.' },
      { name: 'Tentáculos Paralizantes', desc: 'Envenena y paraliza a quien tiene agarrado.' }
    ],
    fearless: false,
    tags: ['pantano', 'subterráneo', 'costa']
  },
  {
    id: 'ettin',
    name: 'Ettin',
    type: 'gigante',
    size: 'Grande',
    cr: 4,
    xp: 1100,
    ac: 12,
    hp: 85,
    hitDice: '10d10+30',
    initiative: -1,
    speed: 12,
    stats: { fue: 21, des: 8, con: 17, int: 6, sab: 10, car: 8 },
    saves: {},
    actions: [
      { id: 'battleaxe', name: 'Hacha de Batalla', kind: 'melee', bonus: 7, damage: '2d8+5', type: 'cortante' },
      { id: 'morningstar', name: 'Lucero del Alba', kind: 'melee', bonus: 7, damage: '2d8+5', type: 'perforante' }
    ],
    multiattack: ['battleaxe', 'morningstar'],
    traits: [
      { name: 'Dos Cabezas', desc: 'Siempre hay una cabeza vigilando: es difícil sorprenderlo.' }
    ],
    fearless: true,
    tags: ['montaña', 'subterráneo']
  },
  {
    id: 'ghost',
    name: 'Fantasma',
    type: 'muerto viviente',
    size: 'Mediano',
    cr: 4,
    xp: 1100,
    ac: 11,
    hp: 45,
    hitDice: '10d8',
    initiative: 1,
    speed: 1.5,
    stats: { fue: 7, des: 13, con: 10, int: 10, sab: 12, car: 17 },
    saves: {},
    actions: [
      { id: 'witheringTouch', name: 'Toque Marchitador', kind: 'melee', bonus: 5, damage: '3d10+3', type: 'necrótico' },
      { id: 'horrificVisage', name: 'Rostro Horripilante', kind: 'save', save: 'sab', dc: 13, damage: '2d6+3', type: 'psíquico' }
    ],
    multiattack: ['witheringTouch', 'witheringTouch'],
    traits: [
      { name: 'Movimiento Incorpóreo', desc: 'Atraviesa criaturas y objetos como si fueran terreno difícil.' },
      { name: 'Rostro Horripilante', desc: 'Su aspecto aterroriza a quien lo mira.' },
      { name: 'Posesión', desc: 'Puede apoderarse del cuerpo de un humanoide.' }
    ],
    fearless: true,
    tags: ['ruinas', 'ciudad']
  },
  {
    id: 'guardCaptain',
    name: 'Capitán de la Guardia',
    type: 'humanoide',
    size: 'Mediano',
    cr: 4,
    xp: 1100,
    ac: 18,
    hp: 75,
    hitDice: '10d8+30',
    initiative: 4,
    speed: 9,
    stats: { fue: 18, des: 14, con: 16, int: 12, sab: 14, car: 13 },
    saves: {},
    actions: [
      { id: 'javelin', name: 'Jabalina', kind: 'melee', bonus: 6, damage: '3d6+4', type: 'perforante' },
      { id: 'longsword', name: 'Espada Larga', kind: 'melee', bonus: 6, damage: '2d10+4', type: 'cortante' }
    ],
    multiattack: ['javelin', 'javelin'],
    traits: [],
    fearless: false,
    tags: ['ciudad']
  },
  {
    id: 'succubus',
    name: 'Súcubo',
    type: 'infernal',
    size: 'Mediano',
    cr: 4,
    xp: 1100,
    ac: 15,
    hp: 71,
    hitDice: '13d8+13',
    initiative: 3,
    speed: 9,
    stats: { fue: 8, des: 17, con: 13, int: 15, sab: 12, car: 20 },
    saves: {},
    actions: [
      { id: 'fiendishTouch', name: 'Toque Infernal', kind: 'melee', bonus: 7, damage: '2d10+5', type: 'psíquico' },
      { id: 'drainingKiss', name: 'Beso Drenante', kind: 'save', save: 'con', dc: 15, damage: '3d8', type: 'psíquico', half: true }
    ],
    multiattack: ['fiendishTouch'],
    traits: [
      { name: 'Hechizar', desc: 'Domina la voluntad de un humanoide.' },
      { name: 'Beso Drenante', desc: 'Su beso roba la vida de quien está hechizado.' },
      { name: 'Cambiar de Forma', desc: 'Adopta forma humanoide.' }
    ],
    fearless: false,
    tags: ['planos', 'ciudad']
  },
  {
    id: 'redDragonWyrmling',
    name: 'Cría de Dragón Rojo',
    type: 'dragón',
    size: 'Mediano',
    cr: 4,
    xp: 1100,
    ac: 17,
    hp: 75,
    hitDice: '10d8+30',
    initiative: 2,
    speed: 9,
    stats: { fue: 19, des: 10, con: 17, int: 12, sab: 11, car: 15 },
    saves: { des: 2, sab: 2 },
    actions: [
      { id: 'rend', name: 'Desgarrar', kind: 'melee', bonus: 6, damage: '1d10+4', type: 'cortante', extra: '1d6', extraType: 'fuego' },
      { id: 'fireBreath', name: 'Aliento de Fuego', kind: 'save', save: 'des', dc: 13, damage: '7d6', type: 'fuego', half: true, recharge: [5, 6] }
    ],
    multiattack: ['rend', 'rend'],
    traits: [
      { name: 'Aliento', desc: 'Escupe un cono de fuego cada pocos turnos.' }
    ],
    fearless: false,
    tags: ['montaña', 'subterráneo']
  },
  {
    id: 'airElemental',
    name: 'Elemental del Aire',
    type: 'elemental',
    size: 'Grande',
    cr: 5,
    xp: 1800,
    ac: 15,
    hp: 90,
    hitDice: '12d10+24',
    initiative: 5,
    speed: 3,
    stats: { fue: 14, des: 20, con: 14, int: 6, sab: 10, car: 6 },
    saves: {},
    actions: [
      { id: 'thunderousSlam', name: 'Golpe Atronador', kind: 'melee', bonus: 8, damage: '2d8+5', type: 'trueno' },
      { id: 'whirlwind', name: 'Torbellino', kind: 'save', save: 'fue', dc: 13, damage: '4d10+2', type: 'trueno', half: true, recharge: [4, 5, 6] }
    ],
    multiattack: ['thunderousSlam', 'thunderousSlam'],
    traits: [
      { name: 'Forma de Aire', desc: 'Se cuela por cualquier rendija y atraviesa a las criaturas.' },
      { name: 'Torbellino', desc: 'Arrastra y golpea a quienes atrapa en su remolino.' }
    ],
    fearless: false,
    tags: ['planos', 'montaña']
  },
  {
    id: 'earthElemental',
    name: 'Elemental de Tierra',
    type: 'elemental',
    size: 'Grande',
    cr: 5,
    xp: 1800,
    ac: 17,
    hp: 147,
    hitDice: '14d10+70',
    initiative: -1,
    speed: 9,
    stats: { fue: 20, des: 8, con: 20, int: 5, sab: 10, car: 5 },
    saves: {},
    actions: [
      { id: 'slam', name: 'Golpe', kind: 'melee', bonus: 8, damage: '2d8+5', type: 'contundente' },
      { id: 'rockLaunch', name: 'Lanzar Roca', kind: 'ranged', bonus: 8, damage: '1d6+5', type: 'contundente' }
    ],
    multiattack: ['slam', 'slam'],
    traits: [
      { name: 'Deslizarse por la Tierra', desc: 'Atraviesa roca y tierra sin dejar rastro.' },
      { name: 'Monstruo de Asedio', desc: 'Hace el doble de daño a objetos y estructuras.' }
    ],
    fearless: false,
    tags: ['planos', 'subterráneo', 'montaña']
  },
  {
    id: 'fireElemental',
    name: 'Elemental de Fuego',
    type: 'elemental',
    size: 'Grande',
    cr: 5,
    xp: 1800,
    ac: 13,
    hp: 93,
    hitDice: '11d10+33',
    initiative: 3,
    speed: 15,
    stats: { fue: 10, des: 17, con: 16, int: 6, sab: 10, car: 7 },
    saves: {},
    actions: [
      { id: 'burn', name: 'Quemadura', kind: 'melee', bonus: 6, damage: '2d6+3', type: 'fuego' }
    ],
    multiattack: ['burn', 'burn'],
    traits: [
      { name: 'Aura de Fuego', desc: 'Quema a quien está a su lado.' },
      { name: 'Forma de Fuego', desc: 'Prende fuego a lo que toca y lo atraviesa.' },
      { name: 'Debilidad al Agua', desc: 'El agua le hace daño.' }
    ],
    fearless: false,
    tags: ['planos', 'montaña', 'desierto']
  },
  {
    id: 'waterElemental',
    name: 'Elemental de Agua',
    type: 'elemental',
    size: 'Grande',
    cr: 5,
    xp: 1800,
    ac: 14,
    hp: 114,
    hitDice: '12d10+48',
    initiative: 2,
    speed: 9,
    stats: { fue: 18, des: 14, con: 18, int: 5, sab: 10, car: 8 },
    saves: {},
    actions: [
      { id: 'slam', name: 'Golpe', kind: 'melee', bonus: 7, damage: '2d8+4', type: 'contundente' },
      { id: 'whelm', name: 'Abrumar', kind: 'save', save: 'fue', dc: 15, damage: '6d8+4', type: 'contundente', half: true, recharge: [4, 5, 6] }
    ],
    multiattack: ['slam', 'slam'],
    traits: [
      { name: 'Forma de Agua', desc: 'Se cuela por rendijas y atraviesa a las criaturas.' },
      { name: 'Congelación', desc: 'El frío lo ralentiza.' }
    ],
    fearless: false,
    tags: ['planos', 'mar', 'costa']
  },
  {
    id: 'fleshGolem',
    name: 'Gólem de Carne',
    type: 'constructo',
    size: 'Mediano',
    cr: 5,
    xp: 1800,
    ac: 9,
    hp: 127,
    hitDice: '15d8+60',
    initiative: -1,
    speed: 9,
    stats: { fue: 19, des: 9, con: 18, int: 6, sab: 10, car: 5 },
    saves: {},
    actions: [
      { id: 'slam', name: 'Golpe', kind: 'melee', bonus: 7, damage: '2d8+4', type: 'contundente', extra: '1d8', extraType: 'relámpago' }
    ],
    multiattack: ['slam', 'slam'],
    traits: [
      { name: 'Aversión al Fuego', desc: 'Las llamas lo hacen vacilar.' },
      { name: 'Absorber Relámpago', desc: 'Los relámpagos lo curan en lugar de herirlo.' },
      { name: 'Resistencia Mágica', desc: 'Tiene ventaja en las salvaciones contra conjuros y efectos mágicos.' },
      { name: 'Furia', desc: 'Herido, puede perder el control y atacar a cualquiera.' }
    ],
    fearless: true,
    tags: ['ruinas', 'subterráneo']
  },
  {
    id: 'gladiator',
    name: 'Gladiador',
    type: 'humanoide',
    size: 'Mediano',
    cr: 5,
    xp: 1800,
    ac: 16,
    hp: 112,
    hitDice: '15d8+45',
    initiative: 5,
    speed: 9,
    stats: { fue: 18, des: 15, con: 16, int: 10, sab: 12, car: 15 },
    saves: { fue: 7, des: 5, con: 6, sab: 4 },
    actions: [
      { id: 'spear', name: 'Lanza', kind: 'melee', bonus: 7, damage: '2d6+4', type: 'perforante' },
      { id: 'shieldBash', name: 'Golpe de Escudo', kind: 'save', save: 'fue', dc: 15, damage: '2d4+4', type: 'contundente' }
    ],
    multiattack: ['spear', 'spear', 'spear'],
    traits: [
      { name: 'Parada', desc: 'Como reacción, suma a su CA para desviar un ataque cuerpo a cuerpo.' },
      { name: 'Golpe de Escudo', desc: 'Derriba o empuja con el escudo.' }
    ],
    fearless: false,
    tags: ['ciudad']
  },
  {
    id: 'hillGiant',
    name: 'Gigante de las Colinas',
    type: 'gigante',
    size: 'Enorme',
    cr: 5,
    xp: 1800,
    ac: 13,
    hp: 105,
    hitDice: '10d12+40',
    initiative: 2,
    speed: 12,
    stats: { fue: 21, des: 8, con: 19, int: 5, sab: 9, car: 6 },
    saves: {},
    actions: [
      { id: 'treeClub', name: 'Garrote de Árbol', kind: 'melee', bonus: 8, damage: '3d8+5', type: 'contundente' },
      { id: 'trashLob', name: 'Lanzar Basura', kind: 'ranged', bonus: 8, damage: '2d10+5', type: 'contundente' }
    ],
    multiattack: ['treeClub', 'treeClub'],
    traits: [],
    fearless: false,
    tags: ['montaña', 'bosque']
  },
  {
    id: 'nightHag',
    name: 'Saga Nocturna',
    type: 'infernal',
    size: 'Mediano',
    cr: 5,
    xp: 1800,
    ac: 17,
    hp: 112,
    hitDice: '15d8+45',
    initiative: 5,
    speed: 9,
    stats: { fue: 18, des: 15, con: 16, int: 16, sab: 14, car: 16 },
    saves: {},
    actions: [
      { id: 'claw', name: 'Garra', kind: 'melee', bonus: 7, damage: '2d8+4', type: 'cortante' }
    ],
    multiattack: ['claw', 'claw'],
    traits: [
      { name: 'Resistencia Mágica', desc: 'Tiene ventaja en las salvaciones contra conjuros y efectos mágicos.' },
      { name: 'Bolsa de Almas', desc: 'Atrapa las almas de quienes mueren en sus pesadillas.' },
      { name: 'Cambiar de Forma', desc: 'Adopta el aspecto de un humanoide.' },
      { name: 'Lanzamiento de Conjuros', desc: 'Puede lanzar varios conjuros además de sus ataques.' }
    ],
    fearless: false,
    tags: ['planos', 'pantano']
  },
  {
    id: 'troll',
    name: 'Trol',
    type: 'gigante',
    size: 'Grande',
    cr: 5,
    xp: 1800,
    ac: 15,
    hp: 94,
    hitDice: '9d10+45',
    initiative: 1,
    speed: 9,
    stats: { fue: 18, des: 13, con: 20, int: 7, sab: 9, car: 7 },
    saves: {},
    actions: [
      { id: 'rend', name: 'Desgarrar', kind: 'melee', bonus: 7, damage: '2d6+4', type: 'cortante' }
    ],
    multiattack: ['rend', 'rend', 'rend'],
    traits: [
      { name: 'Regeneración', desc: 'Se cura cada turno salvo que lo dañen con fuego o ácido.' },
      { name: 'Miembros Repulsivos', desc: 'Sus miembros cortados siguen luchando.' }
    ],
    fearless: false,
    tags: ['montaña', 'pantano', 'bosque']
  },
  {
    id: 'vampireSpawn',
    name: 'Engendro Vampírico',
    type: 'muerto viviente',
    size: 'Mediano',
    cr: 5,
    xp: 1800,
    ac: 16,
    hp: 90,
    hitDice: '12d8+36',
    initiative: 3,
    speed: 9,
    stats: { fue: 16, des: 16, con: 16, int: 11, sab: 10, car: 12 },
    saves: { des: 6, sab: 3 },
    actions: [
      { id: 'claw', name: 'Garra', kind: 'melee', bonus: 6, damage: '2d4+3', type: 'cortante' },
      { id: 'bite', name: 'Mordisco', kind: 'save', save: 'con', dc: 14, damage: '1d4+3', type: 'perforante', extra: '3d6', extraType: 'necrótico' }
    ],
    multiattack: ['claw', 'claw', 'bite'],
    traits: [
      { name: 'Trepar como Arácnido', desc: 'Camina por paredes y techos.' },
      { name: 'Debilidades Vampíricas', desc: 'La luz solar y el agua corriente le hacen daño.' },
      { name: 'Agilidad Imperecedera', desc: 'Corre o se retira como acción adicional.' }
    ],
    fearless: true,
    tags: ['ruinas', 'ciudad']
  },
  {
    id: 'wraith',
    name: 'Aparición',
    type: 'muerto viviente',
    size: 'Mediano',
    cr: 5,
    xp: 1800,
    ac: 13,
    hp: 67,
    hitDice: '9d8+27',
    initiative: 3,
    speed: 1.5,
    stats: { fue: 6, des: 16, con: 16, int: 12, sab: 14, car: 15 },
    saves: {},
    actions: [
      { id: 'lifeDrain', name: 'Drenar Vida', kind: 'melee', bonus: 6, damage: '4d8+3', type: 'necrótico' }
    ],
    traits: [
      { name: 'Movimiento Incorpóreo', desc: 'Atraviesa criaturas y objetos como si fueran terreno difícil.' },
      { name: 'Sensibilidad a la Luz Solar', desc: 'Bajo la luz del sol ataca y percibe peor.' },
      { name: 'Crear Espectro', desc: 'Alza como espectro a un humanoide recién muerto.' }
    ],
    fearless: true,
    tags: ['ruinas', 'subterráneo']
  },
  {
    id: 'werebear',
    name: 'Hombre Oso',
    type: 'monstruosidad',
    size: 'Mediano',
    cr: 5,
    xp: 1800,
    ac: 15,
    hp: 135,
    hitDice: '18d8+54',
    initiative: 3,
    speed: 9,
    stats: { fue: 19, des: 10, con: 17, int: 11, sab: 12, car: 12 },
    saves: {},
    actions: [
      { id: 'bite', name: 'Mordisco', kind: 'melee', bonus: 7, damage: '2d12+4', type: 'perforante' },
      { id: 'handaxe', name: 'Hacha de Mano', kind: 'melee', bonus: 7, damage: '3d6+4', type: 'cortante' },
      { id: 'rend', name: 'Desgarrar', kind: 'melee', bonus: 7, damage: '2d8+4', type: 'cortante' }
    ],
    multiattack: ['rend', 'rend'],
    traits: [
      { name: 'Cambiar de Forma', desc: 'Alterna entre humano, oso e híbrido.' },
      { name: 'Licantropía', desc: 'Su mordisco puede contagiar la maldición.' }
    ],
    fearless: false,
    tags: ['bosque', 'montaña', 'ártico']
  },
  {
    id: 'chimera',
    name: 'Quimera',
    type: 'monstruosidad',
    size: 'Grande',
    cr: 6,
    xp: 2300,
    ac: 14,
    hp: 114,
    hitDice: '12d10+48',
    initiative: 0,
    speed: 9,
    stats: { fue: 19, des: 11, con: 19, int: 3, sab: 14, car: 10 },
    saves: {},
    actions: [
      { id: 'bite', name: 'Mordisco', kind: 'melee', bonus: 7, damage: '2d6+4', type: 'perforante' },
      { id: 'claw', name: 'Garra', kind: 'melee', bonus: 7, damage: '1d6+4', type: 'cortante' },
      { id: 'ram', name: 'Embestida', kind: 'melee', bonus: 7, damage: '1d12+4', type: 'contundente' },
      { id: 'fireBreath', name: 'Aliento de Fuego', kind: 'save', save: 'des', dc: 15, damage: '7d8', type: 'fuego', half: true, recharge: [5, 6] }
    ],
    multiattack: ['ram', 'bite', 'claw'],
    traits: [
      { name: 'Tres Cabezas', desc: 'Ataca con cabeza de león, de cabra y de dragón.' },
      { name: 'Aliento de Fuego', desc: 'La cabeza de dragón escupe llamas.' }
    ],
    fearless: false,
    tags: ['montaña', 'desierto']
  },
  {
    id: 'drider',
    name: 'Drider',
    type: 'monstruosidad',
    size: 'Grande',
    cr: 6,
    xp: 2300,
    ac: 19,
    hp: 123,
    hitDice: '13d10+52',
    initiative: 4,
    speed: 9,
    stats: { fue: 16, des: 19, con: 18, int: 13, sab: 16, car: 12 },
    saves: {},
    actions: [
      { id: 'foreleg', name: 'Pata Delantera', kind: 'melee', bonus: 7, damage: '2d8+4', type: 'perforante' },
      { id: 'poisonBurst', name: 'Estallido Venenoso', kind: 'ranged', bonus: 6, damage: '3d6+3', type: 'veneno' }
    ],
    multiattack: ['foreleg', 'foreleg', 'foreleg'],
    traits: [
      { name: 'Trepar como Arácnido', desc: 'Camina por paredes y techos.' },
      { name: 'Sensibilidad a la Luz Solar', desc: 'Bajo la luz del sol ataca y percibe peor.' },
      { name: 'Caminante de Telarañas', desc: 'Se mueve por las telarañas sin quedar atrapado.' },
      { name: 'Magia de la Reina Araña', desc: 'Lanza conjuros de oscuridad y telarañas.' }
    ],
    fearless: false,
    tags: ['subterráneo']
  },
  {
    id: 'mage',
    name: 'Mago',
    type: 'humanoide',
    size: 'Mediano',
    cr: 6,
    xp: 2300,
    ac: 15,
    hp: 81,
    hitDice: '18d8',
    initiative: 2,
    speed: 9,
    stats: { fue: 9, des: 14, con: 11, int: 17, sab: 12, car: 11 },
    saves: { int: 6, sab: 4 },
    actions: [
      { id: 'arcaneBurst', name: 'Estallido Arcano', kind: 'melee', bonus: 6, damage: '3d8+3', type: 'fuerza' }
    ],
    multiattack: ['arcaneBurst', 'arcaneBurst', 'arcaneBurst'],
    traits: [
      { name: 'Lanzamiento de Conjuros', desc: 'Puede lanzar varios conjuros además de sus ataques.' },
      { name: 'Paso Brumoso', desc: 'Se teletransporta una distancia corta.' },
      { name: 'Magia Protectora', desc: 'Responde con Escudo o Contraconjuro.' }
    ],
    fearless: false,
    tags: ['ciudad', 'ruinas', 'taberna']
  },
  {
    id: 'medusa',
    name: 'Medusa',
    type: 'monstruosidad',
    size: 'Mediano',
    cr: 6,
    xp: 2300,
    ac: 15,
    hp: 127,
    hitDice: '17d8+51',
    initiative: 6,
    speed: 9,
    stats: { fue: 10, des: 17, con: 16, int: 12, sab: 13, car: 15 },
    saves: { sab: 4 },
    actions: [
      { id: 'claw', name: 'Garra', kind: 'melee', bonus: 6, damage: '2d6+3', type: 'cortante' },
      { id: 'snakeHair', name: 'Cabellera de Serpientes', kind: 'melee', bonus: 6, damage: '1d4+3', type: 'perforante', extra: '4d6', extraType: 'veneno' },
      { id: 'poisonRay', name: 'Rayo Venenoso', kind: 'ranged', bonus: 5, damage: '2d8+2', type: 'veneno' }
    ],
    multiattack: ['claw', 'claw', 'snakeHair'],
    traits: [
      { name: 'Mirada Petrificante', desc: 'Su mirada convierte en piedra a quien la cruza.' },
      { name: 'Cabellera de Serpientes', desc: 'Sus serpientes muerden con veneno.' }
    ],
    fearless: false,
    tags: ['ruinas', 'desierto', 'costa']
  },
  {
    id: 'wyvern',
    name: 'Guiverno',
    type: 'dragón',
    size: 'Grande',
    cr: 6,
    xp: 2300,
    ac: 14,
    hp: 127,
    hitDice: '15d10+45',
    initiative: 0,
    speed: 9,
    stats: { fue: 19, des: 10, con: 16, int: 5, sab: 12, car: 6 },
    saves: {},
    actions: [
      { id: 'bite', name: 'Mordisco', kind: 'melee', bonus: 7, damage: '2d8+4', type: 'perforante' },
      { id: 'sting', name: 'Aguijón', kind: 'melee', bonus: 7, damage: '2d6+4', type: 'perforante', extra: '7d6', extraType: 'veneno' }
    ],
    multiattack: ['bite', 'sting'],
    traits: [
      { name: 'Aguijón Venenoso', desc: 'Su cola inyecta un veneno terrible.' }
    ],
    fearless: false,
    tags: ['montaña', 'bosque', 'costa']
  },
  {
    id: 'oni',
    name: 'Oni',
    type: 'infernal',
    size: 'Grande',
    cr: 7,
    xp: 2900,
    ac: 17,
    hp: 119,
    hitDice: '14d10+42',
    initiative: 0,
    speed: 9,
    stats: { fue: 19, des: 11, con: 16, int: 14, sab: 12, car: 15 },
    saves: { des: 3, con: 6, sab: 4, car: 5 },
    actions: [
      { id: 'claw', name: 'Garra', kind: 'melee', bonus: 7, damage: '1d12+4', type: 'cortante', extra: '2d8', extraType: 'necrótico' },
      { id: 'nightmareRay', name: 'Rayo de Pesadilla', kind: 'ranged', bonus: 5, damage: '2d6+2', type: 'psíquico' }
    ],
    multiattack: ['claw', 'claw'],
    traits: [
      { name: 'Regeneración', desc: 'Se cura un poco cada turno.' },
      { name: 'Invisibilidad', desc: 'Puede volverse invisible.' },
      { name: 'Cambiar de Forma', desc: 'Adopta el aspecto de un humanoide.' },
      { name: 'Lanzamiento de Conjuros', desc: 'Puede lanzar varios conjuros además de sus ataques.' }
    ],
    fearless: false,
    tags: ['montaña', 'bosque', 'ciudad']
  },
  {
    id: 'stoneGiant',
    name: 'Gigante de Piedra',
    type: 'gigante',
    size: 'Enorme',
    cr: 7,
    xp: 2900,
    ac: 17,
    hp: 126,
    hitDice: '11d12+55',
    initiative: 5,
    speed: 12,
    stats: { fue: 23, des: 15, con: 20, int: 10, sab: 12, car: 9 },
    saves: { des: 5, con: 8, sab: 4 },
    actions: [
      { id: 'stoneClub', name: 'Garrote de Piedra', kind: 'melee', bonus: 9, damage: '3d10+6', type: 'contundente' },
      { id: 'boulder', name: 'Roca', kind: 'ranged', bonus: 9, damage: '2d8+6', type: 'contundente' }
    ],
    multiattack: ['stoneClub', 'stoneClub'],
    traits: [
      { name: 'Desviar Proyectil', desc: 'Atrapa y devuelve rocas y proyectiles.' }
    ],
    fearless: false,
    tags: ['montaña', 'subterráneo']
  },
  {
    id: 'youngBlackDragon',
    name: 'Dragón Negro Joven',
    type: 'dragón',
    size: 'Grande',
    cr: 7,
    xp: 2900,
    ac: 18,
    hp: 127,
    hitDice: '15d10+45',
    initiative: 5,
    speed: 12,
    stats: { fue: 19, des: 14, con: 17, int: 12, sab: 11, car: 15 },
    saves: { des: 5, sab: 3 },
    actions: [
      { id: 'rend', name: 'Desgarrar', kind: 'melee', bonus: 7, damage: '2d4+4', type: 'cortante', extra: '1d6', extraType: 'ácido' },
      { id: 'acidBreath', name: 'Aliento de Ácido', kind: 'save', save: 'des', dc: 14, damage: '14d6', type: 'ácido', half: true, recharge: [5, 6] }
    ],
    multiattack: ['rend', 'rend', 'rend'],
    traits: [
      { name: 'Anfibio', desc: 'Respira tanto en el aire como bajo el agua.' },
      { name: 'Aliento de Ácido', desc: 'Escupe una línea de ácido cada pocos turnos.' }
    ],
    fearless: false,
    tags: ['pantano', 'ruinas']
  },
  {
    id: 'assassin',
    name: 'Asesino',
    type: 'humanoide',
    size: 'Mediano',
    cr: 8,
    xp: 3900,
    ac: 16,
    hp: 97,
    hitDice: '15d8+30',
    initiative: 10,
    speed: 9,
    stats: { fue: 11, des: 18, con: 14, int: 16, sab: 11, car: 10 },
    saves: { des: 7, int: 6 },
    actions: [
      { id: 'shortsword', name: 'Espada Corta', kind: 'melee', bonus: 7, damage: '1d6+4', type: 'perforante', extra: '5d6', extraType: 'veneno' },
      { id: 'lightCrossbow', name: 'Ballesta Ligera', kind: 'ranged', bonus: 7, damage: '1d8+4', type: 'perforante', extra: '6d6', extraType: 'veneno' }
    ],
    multiattack: ['shortsword', 'shortsword', 'shortsword'],
    traits: [
      { name: 'Evasión', desc: 'Esquiva casi por completo las explosiones y alientos.' },
      { name: 'Acción Astuta', desc: 'Corre, se retira o se esconde como acción adicional.' },
      { name: 'Hojas Envenenadas', desc: 'Sus armas llevan un veneno mortal.' }
    ],
    fearless: false,
    tags: ['ciudad', 'taberna']
  },
  {
    id: 'frostGiant',
    name: 'Gigante de Escarcha',
    type: 'gigante',
    size: 'Enorme',
    cr: 8,
    xp: 3900,
    ac: 15,
    hp: 149,
    hitDice: '13d12+65',
    initiative: 2,
    speed: 12,
    stats: { fue: 23, des: 9, con: 21, int: 9, sab: 10, car: 12 },
    saves: { con: 8, sab: 3, car: 4 },
    actions: [
      { id: 'frostAxe', name: 'Hacha de Escarcha', kind: 'melee', bonus: 9, damage: '2d12+6', type: 'cortante', extra: '2d8', extraType: 'frío' },
      { id: 'greatBow', name: 'Gran Arco', kind: 'ranged', bonus: 9, damage: '2d10+6', type: 'perforante', extra: '2d6', extraType: 'frío' }
    ],
    multiattack: ['frostAxe', 'frostAxe'],
    traits: [
      { name: 'Grito de Guerra', desc: 'Su grito anima a sus aliados y asusta a sus enemigos.' }
    ],
    fearless: false,
    tags: ['ártico', 'montaña']
  },
  {
    id: 'youngGreenDragon',
    name: 'Dragón Verde Joven',
    type: 'dragón',
    size: 'Grande',
    cr: 8,
    xp: 3900,
    ac: 18,
    hp: 136,
    hitDice: '16d10+48',
    initiative: 4,
    speed: 12,
    stats: { fue: 19, des: 12, con: 17, int: 16, sab: 13, car: 15 },
    saves: { des: 4, sab: 4 },
    actions: [
      { id: 'rend', name: 'Desgarrar', kind: 'melee', bonus: 7, damage: '2d6+4', type: 'cortante', extra: '2d6', extraType: 'veneno' },
      { id: 'poisonBreath', name: 'Aliento Venenoso', kind: 'save', save: 'con', dc: 14, damage: '12d6', type: 'veneno', half: true, recharge: [5, 6] }
    ],
    multiattack: ['rend', 'rend', 'rend'],
    traits: [
      { name: 'Anfibio', desc: 'Respira tanto en el aire como bajo el agua.' },
      { name: 'Aliento Venenoso', desc: 'Exhala una nube de veneno cada pocos turnos.' }
    ],
    fearless: false,
    tags: ['bosque', 'pantano']
  },
  {
    id: 'hydra',
    name: 'Hidra',
    type: 'monstruosidad',
    size: 'Enorme',
    cr: 8,
    xp: 3900,
    ac: 15,
    hp: 184,
    hitDice: '16d12+80',
    initiative: 4,
    speed: 12,
    stats: { fue: 20, des: 12, con: 20, int: 2, sab: 10, car: 7 },
    saves: {},
    actions: [
      { id: 'bite', name: 'Mordisco', kind: 'melee', bonus: 8, damage: '1d10+5', type: 'perforante' }
    ],
    multiattack: ['bite', 'bite', 'bite', 'bite', 'bite'],
    traits: [
      { name: 'Múltiples Cabezas', desc: 'Por cada cabeza cortada pueden crecerle dos, salvo que se queme el muñón.' },
      { name: 'Cabezas Atentas', desc: 'Muerde una vez por cabeza y apenas puede ser sorprendida.' }
    ],
    fearless: true,
    tags: ['pantano', 'costa', 'mar']
  },
  {
    id: 'tyrannosaurusRex',
    name: 'Tiranosaurio Rex',
    type: 'bestia',
    size: 'Enorme',
    cr: 8,
    xp: 3900,
    ac: 13,
    hp: 136,
    hitDice: '13d12+52',
    initiative: 3,
    speed: 15,
    stats: { fue: 25, des: 10, con: 19, int: 2, sab: 12, car: 9 },
    saves: { fue: 10, sab: 4 },
    actions: [
      { id: 'bite', name: 'Mordisco', kind: 'melee', bonus: 10, damage: '4d12+7', type: 'perforante' },
      { id: 'tail', name: 'Cola', kind: 'melee', bonus: 10, damage: '4d8+7', type: 'contundente' }
    ],
    multiattack: ['bite', 'tail'],
    traits: [
      { name: 'Fauces Colosales', desc: 'Puede atrapar a una presa entre sus dientes.' }
    ],
    fearless: false,
    tags: ['bosque', 'pantano']
  },
  {
    id: 'cloudGiant',
    name: 'Gigante de las Nubes',
    type: 'gigante',
    size: 'Enorme',
    cr: 9,
    xp: 5000,
    ac: 14,
    hp: 200,
    hitDice: '16d12+96',
    initiative: 4,
    speed: 12,
    stats: { fue: 27, des: 10, con: 22, int: 12, sab: 16, car: 16 },
    saves: { con: 10, sab: 7 },
    actions: [
      { id: 'thunderousMace', name: 'Maza Atronadora', kind: 'melee', bonus: 12, damage: '3d8+8', type: 'contundente', extra: '2d6', extraType: 'trueno' },
      { id: 'thundercloud', name: 'Nube de Truenos', kind: 'ranged', bonus: 12, damage: '3d6+8', type: 'trueno' }
    ],
    multiattack: ['thunderousMace', 'thunderousMace'],
    traits: [
      { name: 'Paso Brumoso', desc: 'Se teletransporta una distancia corta.' },
      { name: 'Lanzamiento de Conjuros', desc: 'Puede lanzar varios conjuros además de sus ataques.' }
    ],
    fearless: false,
    tags: ['montaña', 'planos']
  },
  {
    id: 'fireGiant',
    name: 'Gigante de Fuego',
    type: 'gigante',
    size: 'Enorme',
    cr: 9,
    xp: 5000,
    ac: 18,
    hp: 162,
    hitDice: '13d12+78',
    initiative: 3,
    speed: 9,
    stats: { fue: 25, des: 9, con: 23, int: 10, sab: 14, car: 13 },
    saves: { des: 3, con: 10, car: 5 },
    actions: [
      { id: 'flameSword', name: 'Espada Llameante', kind: 'melee', bonus: 11, damage: '4d6+7', type: 'cortante', extra: '3d6', extraType: 'fuego' },
      { id: 'hammerThrow', name: 'Lanzamiento de Martillo', kind: 'ranged', bonus: 11, damage: '3d10+7', type: 'contundente', extra: '1d8', extraType: 'fuego' }
    ],
    multiattack: ['flameSword', 'flameSword'],
    traits: [
      { name: 'Herrero Colosal', desc: 'Sus armas forjadas arden al golpear.' }
    ],
    fearless: false,
    tags: ['montaña', 'subterráneo']
  },
  {
    id: 'boneDevil',
    name: 'Diablo Óseo',
    type: 'infernal',
    size: 'Grande',
    cr: 9,
    xp: 5000,
    ac: 16,
    hp: 161,
    hitDice: '17d10+68',
    initiative: 7,
    speed: 12,
    stats: { fue: 18, des: 16, con: 18, int: 13, sab: 14, car: 16 },
    saves: { fue: 8, int: 5, sab: 6, car: 7 },
    actions: [
      { id: 'claw', name: 'Garra', kind: 'melee', bonus: 8, damage: '2d8+4', type: 'cortante' },
      { id: 'infernalSting', name: 'Aguijón Infernal', kind: 'melee', bonus: 8, damage: '2d10+4', type: 'perforante', extra: '4d8', extraType: 'veneno' }
    ],
    multiattack: ['claw', 'claw', 'infernalSting'],
    traits: [
      { name: 'Resistencia Mágica', desc: 'Tiene ventaja en las salvaciones contra conjuros y efectos mágicos.' },
      { name: 'Restauración Diabólica', desc: 'Si muere fuera de los Nueve Infiernos, su cuerpo se deshace y renace allí.' },
      { name: 'Aguijón Infernal', desc: 'Su cola envenena y debilita.' }
    ],
    fearless: false,
    tags: ['planos']
  },
  {
    id: 'treant',
    name: 'Ent',
    type: 'planta',
    size: 'Enorme',
    cr: 9,
    xp: 5000,
    ac: 16,
    hp: 138,
    hitDice: '12d12+60',
    initiative: 3,
    speed: 9,
    stats: { fue: 23, des: 8, con: 21, int: 12, sab: 16, car: 12 },
    saves: {},
    actions: [
      { id: 'slam', name: 'Golpe', kind: 'melee', bonus: 10, damage: '3d6+6', type: 'contundente' },
      { id: 'hailOfBark', name: 'Lluvia de Corteza', kind: 'ranged', bonus: 10, damage: '4d10+6', type: 'perforante' }
    ],
    multiattack: ['slam', 'slam'],
    traits: [
      { name: 'Monstruo de Asedio', desc: 'Hace el doble de daño a objetos y estructuras.' },
      { name: 'Animar Árboles', desc: 'Despierta a los árboles cercanos para que luchen.' }
    ],
    fearless: false,
    tags: ['bosque']
  },
  {
    id: 'youngBlueDragon',
    name: 'Dragón Azul Joven',
    type: 'dragón',
    size: 'Grande',
    cr: 9,
    xp: 5000,
    ac: 18,
    hp: 152,
    hitDice: '16d10+64',
    initiative: 4,
    speed: 12,
    stats: { fue: 21, des: 10, con: 19, int: 14, sab: 13, car: 17 },
    saves: { des: 4, sab: 5 },
    actions: [
      { id: 'rend', name: 'Desgarrar', kind: 'melee', bonus: 9, damage: '2d6+5', type: 'cortante', extra: '1d10', extraType: 'relámpago' },
      { id: 'lightningBreath', name: 'Aliento de Relámpago', kind: 'save', save: 'des', dc: 16, damage: '10d10', type: 'relámpago', half: true, recharge: [5, 6] }
    ],
    multiattack: ['rend', 'rend', 'rend'],
    traits: [
      { name: 'Aliento de Relámpago', desc: 'Escupe una línea de relámpagos cada pocos turnos.' }
    ],
    fearless: false,
    tags: ['desierto', 'costa']
  },
  {
    id: 'aboleth',
    name: 'Aboleth',
    type: 'aberración',
    size: 'Grande',
    cr: 10,
    xp: 5900,
    ac: 17,
    hp: 150,
    hitDice: '20d10+40',
    initiative: 7,
    speed: 3,
    stats: { fue: 21, des: 9, con: 15, int: 18, sab: 15, car: 18 },
    saves: { des: 3, con: 6, int: 8, sab: 6 },
    actions: [
      { id: 'tentacle', name: 'Tentáculo', kind: 'melee', bonus: 9, damage: '2d6+5', type: 'contundente' },
      { id: 'consumeMemories', name: 'Devorar Recuerdos', kind: 'save', save: 'int', dc: 16, damage: '3d6', type: 'psíquico' }
    ],
    multiattack: ['tentacle', 'tentacle', 'consumeMemories'],
    traits: [
      { name: 'Resistencia Legendaria', desc: 'Varias veces al día puede superar una salvación que haya fallado.' },
      { name: 'Anfibio', desc: 'Respira tanto en el aire como bajo el agua.' },
      { name: 'Nube de Mucosidad', desc: 'Su moco obliga a respirar bajo el agua.' },
      { name: 'Dominar Mente', desc: 'Esclaviza la mente de sus víctimas.' }
    ],
    fearless: false,
    tags: ['mar', 'subterráneo']
  },
  {
    id: 'deva',
    name: 'Deva',
    type: 'celestial',
    size: 'Mediano',
    cr: 10,
    xp: 5900,
    ac: 17,
    hp: 229,
    hitDice: '27d8+108',
    initiative: 4,
    speed: 9,
    stats: { fue: 18, des: 18, con: 18, int: 17, sab: 20, car: 20 },
    saves: { sab: 9, car: 9 },
    actions: [
      { id: 'holyMace', name: 'Maza Sagrada', kind: 'melee', bonus: 8, damage: '1d6+4', type: 'contundente', extra: '4d8', extraType: 'radiante' }
    ],
    multiattack: ['holyMace', 'holyMace'],
    traits: [
      { name: 'Resistencia Mágica', desc: 'Tiene ventaja en las salvaciones contra conjuros y efectos mágicos.' },
      { name: 'Ayuda Divina', desc: 'Cura o protege a sus aliados.' },
      { name: 'Lanzamiento de Conjuros', desc: 'Puede lanzar varios conjuros además de sus ataques.' }
    ],
    fearless: true,
    tags: ['planos']
  },
  {
    id: 'youngRedDragon',
    name: 'Dragón Rojo Joven',
    type: 'dragón',
    size: 'Grande',
    cr: 10,
    xp: 5900,
    ac: 18,
    hp: 178,
    hitDice: '17d10+85',
    initiative: 4,
    speed: 12,
    stats: { fue: 23, des: 10, con: 21, int: 14, sab: 11, car: 19 },
    saves: { des: 4, sab: 4 },
    actions: [
      { id: 'rend', name: 'Desgarrar', kind: 'melee', bonus: 10, damage: '2d6+6', type: 'cortante', extra: '1d6', extraType: 'fuego' },
      { id: 'fireBreath', name: 'Aliento de Fuego', kind: 'save', save: 'des', dc: 17, damage: '16d6', type: 'fuego', half: true, recharge: [5, 6] }
    ],
    multiattack: ['rend', 'rend', 'rend'],
    traits: [
      { name: 'Aliento de Fuego', desc: 'Escupe un cono de fuego cada pocos turnos.' }
    ],
    fearless: false,
    tags: ['montaña', 'subterráneo']
  },
  {
    id: 'stoneGolem',
    name: 'Gólem de Piedra',
    type: 'constructo',
    size: 'Grande',
    cr: 10,
    xp: 5900,
    ac: 18,
    hp: 220,
    hitDice: '21d10+105',
    initiative: 3,
    speed: 9,
    stats: { fue: 22, des: 9, con: 20, int: 3, sab: 11, car: 1 },
    saves: {},
    actions: [
      { id: 'slam', name: 'Golpe', kind: 'melee', bonus: 10, damage: '2d8+6', type: 'contundente', extra: '2d8', extraType: 'fuerza' },
      { id: 'forceBolt', name: 'Proyectil de Fuerza', kind: 'ranged', bonus: 9, damage: '4d10', type: 'fuerza' }
    ],
    multiattack: ['slam', 'slam'],
    traits: [
      { name: 'Resistencia Mágica', desc: 'Tiene ventaja en las salvaciones contra conjuros y efectos mágicos.' },
      { name: 'Forma Inmutable', desc: 'Nada puede cambiar su forma.' },
      { name: 'Ralentizar', desc: 'Vuelve lentos a quienes lo rodean.' }
    ],
    fearless: true,
    tags: ['ruinas', 'subterráneo']
  },
  {
    id: 'behir',
    name: 'Behir',
    type: 'monstruosidad',
    size: 'Enorme',
    cr: 11,
    xp: 7200,
    ac: 17,
    hp: 168,
    hitDice: '16d12+64',
    initiative: 3,
    speed: 15,
    stats: { fue: 23, des: 16, con: 18, int: 7, sab: 14, car: 12 },
    saves: {},
    actions: [
      { id: 'bite', name: 'Mordisco', kind: 'melee', bonus: 10, damage: '2d12+6', type: 'perforante', extra: '2d10', extraType: 'relámpago' },
      { id: 'constrict', name: 'Constreñir', kind: 'save', save: 'fue', dc: 18, damage: '5d8+6', type: 'contundente' },
      { id: 'lightningBreath', name: 'Aliento de Relámpago', kind: 'save', save: 'des', dc: 16, damage: '12d10', type: 'relámpago', half: true, recharge: [5, 6] }
    ],
    multiattack: ['bite', 'constrict'],
    traits: [
      { name: 'Constreñir', desc: 'Se enrosca en su presa y la aplasta.' },
      { name: 'Engullir', desc: 'Se traga entera a una criatura.' },
      { name: 'Aliento de Relámpago', desc: 'Escupe una línea de relámpagos.' }
    ],
    fearless: false,
    tags: ['subterráneo', 'montaña']
  },
  {
    id: 'djinni',
    name: 'Djinn',
    type: 'elemental',
    size: 'Grande',
    cr: 11,
    xp: 7200,
    ac: 17,
    hp: 218,
    hitDice: '19d10+114',
    initiative: 2,
    speed: 9,
    stats: { fue: 21, des: 15, con: 22, int: 15, sab: 16, car: 20 },
    saves: { des: 6, sab: 7 },
    actions: [
      { id: 'stormBlade', name: 'Hoja de Tormenta', kind: 'melee', bonus: 9, damage: '2d6+5', type: 'cortante', extra: '2d6', extraType: 'relámpago' },
      { id: 'stormBolt', name: 'Rayo de Tormenta', kind: 'ranged', bonus: 9, damage: '3d8', type: 'trueno' }
    ],
    multiattack: ['stormBlade', 'stormBlade', 'stormBlade'],
    traits: [
      { name: 'Resistencia Mágica', desc: 'Tiene ventaja en las salvaciones contra conjuros y efectos mágicos.' },
      { name: 'Deseos', desc: 'Puede conceder deseos a quien lo libera.' },
      { name: 'Crear Torbellino', desc: 'Invoca un remolino de viento.' },
      { name: 'Lanzamiento de Conjuros', desc: 'Puede lanzar varios conjuros además de sus ataques.' }
    ],
    fearless: false,
    tags: ['planos', 'desierto']
  },
  {
    id: 'efreeti',
    name: 'Efrit',
    type: 'elemental',
    size: 'Grande',
    cr: 11,
    xp: 7200,
    ac: 17,
    hp: 212,
    hitDice: '17d10+119',
    initiative: 1,
    speed: 12,
    stats: { fue: 22, des: 12, con: 24, int: 16, sab: 15, car: 19 },
    saves: { sab: 6, car: 8 },
    actions: [
      { id: 'heatedBlade', name: 'Hoja Candente', kind: 'melee', bonus: 10, damage: '2d6+6', type: 'cortante', extra: '2d12', extraType: 'fuego' },
      { id: 'hurlFlame', name: 'Arrojar Llamas', kind: 'ranged', bonus: 8, damage: '7d6', type: 'fuego' }
    ],
    multiattack: ['heatedBlade', 'heatedBlade', 'heatedBlade'],
    traits: [
      { name: 'Resistencia Mágica', desc: 'Tiene ventaja en las salvaciones contra conjuros y efectos mágicos.' },
      { name: 'Deseos', desc: 'Puede conceder deseos a quien lo somete.' },
      { name: 'Lanzamiento de Conjuros', desc: 'Puede lanzar varios conjuros además de sus ataques.' }
    ],
    fearless: false,
    tags: ['planos', 'desierto']
  },
  {
    id: 'hornedDevil',
    name: 'Diablo Astado',
    type: 'infernal',
    size: 'Grande',
    cr: 11,
    xp: 7200,
    ac: 18,
    hp: 199,
    hitDice: '19d10+95',
    initiative: 7,
    speed: 9,
    stats: { fue: 22, des: 17, con: 21, int: 12, sab: 16, car: 18 },
    saves: { fue: 10, des: 7, sab: 7, car: 8 },
    actions: [
      { id: 'searingFork', name: 'Horca Abrasadora', kind: 'melee', bonus: 10, damage: '2d8+6', type: 'perforante', extra: '2d8', extraType: 'fuego' },
      { id: 'hurlFlame', name: 'Arrojar Llamas', kind: 'ranged', bonus: 8, damage: '5d8+4', type: 'fuego' },
      { id: 'infernalTail', name: 'Cola Infernal', kind: 'save', save: 'des', dc: 17, damage: '1d8+6', type: 'necrótico' }
    ],
    multiattack: ['searingFork', 'searingFork', 'searingFork'],
    traits: [
      { name: 'Resistencia Mágica', desc: 'Tiene ventaja en las salvaciones contra conjuros y efectos mágicos.' },
      { name: 'Restauración Diabólica', desc: 'Si muere fuera de los Nueve Infiernos, su cuerpo se deshace y renace allí.' },
      { name: 'Cola Infernal', desc: 'Su cola abre heridas que no dejan de sangrar.' }
    ],
    fearless: false,
    tags: ['planos']
  },
  {
    id: 'archmage',
    name: 'Archimago',
    type: 'humanoide',
    size: 'Mediano',
    cr: 12,
    xp: 8400,
    ac: 17,
    hp: 170,
    hitDice: '31d8+31',
    initiative: 7,
    speed: 9,
    stats: { fue: 10, des: 14, con: 12, int: 20, sab: 15, car: 16 },
    saves: { int: 9, sab: 6 },
    actions: [
      { id: 'arcaneBurst', name: 'Estallido Arcano', kind: 'melee', bonus: 9, damage: '4d10+5', type: 'fuerza' }
    ],
    multiattack: ['arcaneBurst', 'arcaneBurst', 'arcaneBurst', 'arcaneBurst'],
    traits: [
      { name: 'Resistencia Mágica', desc: 'Tiene ventaja en las salvaciones contra conjuros y efectos mágicos.' },
      { name: 'Lanzamiento de Conjuros', desc: 'Puede lanzar varios conjuros además de sus ataques.' },
      { name: 'Paso Brumoso', desc: 'Se teletransporta una distancia corta.' },
      { name: 'Magia Protectora', desc: 'Responde con Escudo o Contraconjuro.' }
    ],
    fearless: false,
    tags: ['ciudad', 'ruinas', 'planos']
  },
  {
    id: 'erinyes',
    name: 'Erinia',
    type: 'infernal',
    size: 'Mediano',
    cr: 12,
    xp: 8400,
    ac: 18,
    hp: 178,
    hitDice: '21d8+84',
    initiative: 7,
    speed: 9,
    stats: { fue: 18, des: 16, con: 18, int: 14, sab: 14, car: 18 },
    saves: { des: 7, con: 8, car: 8 },
    actions: [
      { id: 'witheringSword', name: 'Espada Marchitadora', kind: 'melee', bonus: 8, damage: '2d8+4', type: 'cortante', extra: '2d10', extraType: 'necrótico' },
      { id: 'entanglingRope', name: 'Cuerda Enredadora', kind: 'save', save: 'fue', dc: 16, damage: '4d6', type: 'fuerza' }
    ],
    multiattack: ['witheringSword', 'witheringSword', 'witheringSword'],
    traits: [
      { name: 'Resistencia Mágica', desc: 'Tiene ventaja en las salvaciones contra conjuros y efectos mágicos.' },
      { name: 'Restauración Diabólica', desc: 'Si muere fuera de los Nueve Infiernos, su cuerpo se deshace y renace allí.' },
      { name: 'Parada', desc: 'Como reacción, suma a su CA para desviar un ataque cuerpo a cuerpo.' },
      { name: 'Cuerda Mágica', desc: 'Enreda y arrastra a sus enemigos.' }
    ],
    fearless: false,
    tags: ['planos']
  },
  {
    id: 'vampire',
    name: 'Vampiro',
    type: 'muerto viviente',
    size: 'Mediano',
    cr: 13,
    xp: 10000,
    ac: 16,
    hp: 195,
    hitDice: '23d8+92',
    initiative: 14,
    speed: 12,
    stats: { fue: 18, des: 18, con: 18, int: 17, sab: 15, car: 18 },
    saves: { des: 9, con: 9, sab: 7, car: 9 },
    actions: [
      { id: 'graveStrike', name: 'Golpe Sepulcral', kind: 'melee', bonus: 9, damage: '1d8+4', type: 'contundente', extra: '2d6', extraType: 'necrótico' },
      { id: 'bite', name: 'Mordisco', kind: 'save', save: 'con', dc: 17, damage: '1d4+4', type: 'perforante', extra: '3d8', extraType: 'necrótico' }
    ],
    multiattack: ['graveStrike', 'graveStrike', 'bite'],
    traits: [
      { name: 'Resistencia Legendaria', desc: 'Varias veces al día puede superar una salvación que haya fallado.' },
      { name: 'Huida en Niebla', desc: 'Al caer se convierte en niebla y huye a su ataúd.' },
      { name: 'Debilidades Vampíricas', desc: 'La luz solar y el agua corriente le hacen daño.' },
      { name: 'Hechizar', desc: 'Su mirada domina a los humanoides.' }
    ],
    fearless: true,
    tags: ['ruinas', 'ciudad']
  },
  {
    id: 'stormGiant',
    name: 'Gigante de las Tormentas',
    type: 'gigante',
    size: 'Enorme',
    cr: 13,
    xp: 10000,
    ac: 16,
    hp: 230,
    hitDice: '20d12+100',
    initiative: 7,
    speed: 15,
    stats: { fue: 29, des: 14, con: 20, int: 16, sab: 20, car: 18 },
    saves: { fue: 14, con: 10, sab: 10, car: 9 },
    actions: [
      { id: 'stormSword', name: 'Espada de Tormenta', kind: 'melee', bonus: 14, damage: '4d6+9', type: 'cortante', extra: '3d8', extraType: 'relámpago' },
      { id: 'thunderbolt', name: 'Rayo', kind: 'ranged', bonus: 14, damage: '2d12+9', type: 'relámpago' },
      { id: 'lightningStorm', name: 'Tormenta de Relámpagos', kind: 'save', save: 'des', dc: 18, damage: '10d10', type: 'relámpago', half: true, recharge: [5, 6] }
    ],
    multiattack: ['stormSword', 'stormSword'],
    traits: [
      { name: 'Anfibio', desc: 'Respira tanto en el aire como bajo el agua.' },
      { name: 'Tormenta de Relámpagos', desc: 'Invoca rayos sobre sus enemigos.' },
      { name: 'Lanzamiento de Conjuros', desc: 'Puede lanzar varios conjuros además de sus ataques.' }
    ],
    fearless: false,
    tags: ['mar', 'costa', 'montaña']
  },
  {
    id: 'rakshasa',
    name: 'Rakshasa',
    type: 'infernal',
    size: 'Mediano',
    cr: 13,
    xp: 10000,
    ac: 17,
    hp: 221,
    hitDice: '26d8+104',
    initiative: 8,
    speed: 12,
    stats: { fue: 14, des: 17, con: 18, int: 13, sab: 16, car: 20 },
    saves: {},
    actions: [
      { id: 'cursedTouch', name: 'Toque Maldito', kind: 'melee', bonus: 10, damage: '2d6+5', type: 'cortante', extra: '3d12', extraType: 'necrótico' },
      { id: 'balefulCommand', name: 'Orden Funesta', kind: 'save', save: 'sab', dc: 18, damage: '8d6', type: 'psíquico', recharge: [5, 6] }
    ],
    multiattack: ['cursedTouch', 'cursedTouch', 'cursedTouch'],
    traits: [
      { name: 'Gran Resistencia Mágica', desc: 'Los conjuros apenas le afectan.' },
      { name: 'Restauración Infernal', desc: 'Si muere, renace en los Nueve Infiernos.' },
      { name: 'Lanzamiento de Conjuros', desc: 'Puede lanzar varios conjuros además de sus ataques.' }
    ],
    fearless: true,
    tags: ['ciudad', 'planos']
  },
  {
    id: 'adultWhiteDragon',
    name: 'Dragón Blanco Adulto',
    type: 'dragón',
    size: 'Enorme',
    cr: 13,
    xp: 10000,
    ac: 18,
    hp: 200,
    hitDice: '16d12+96',
    initiative: 10,
    speed: 12,
    stats: { fue: 22, des: 10, con: 22, int: 8, sab: 12, car: 12 },
    saves: { des: 5, sab: 6 },
    actions: [
      { id: 'rend', name: 'Desgarrar', kind: 'melee', bonus: 11, damage: '2d6+6', type: 'cortante', extra: '1d8', extraType: 'frío' },
      { id: 'coldBreath', name: 'Aliento de Frío', kind: 'save', save: 'con', dc: 19, damage: '12d8', type: 'frío', half: true, recharge: [5, 6] }
    ],
    multiattack: ['rend', 'rend', 'rend'],
    traits: [
      { name: 'Resistencia Legendaria', desc: 'Varias veces al día puede superar una salvación que haya fallado.' },
      { name: 'Aliento', desc: 'Exhala un cono de frío glacial cada pocos turnos.' },
      { name: 'Andar sobre el Hielo', desc: 'Se mueve por el hielo sin resbalar.' },
      { name: 'Acciones Legendarias', desc: 'Tras el turno de otra criatura puede atacar o lanzar un conjuro.' }
    ],
    fearless: false,
    tags: ['ártico', 'montaña']
  },
  {
    id: 'adultBlackDragon',
    name: 'Dragón Negro Adulto',
    type: 'dragón',
    size: 'Enorme',
    cr: 14,
    xp: 11500,
    ac: 19,
    hp: 195,
    hitDice: '17d12+85',
    initiative: 12,
    speed: 12,
    stats: { fue: 23, des: 14, con: 21, int: 14, sab: 13, car: 19 },
    saves: { des: 7, sab: 6 },
    actions: [
      { id: 'rend', name: 'Desgarrar', kind: 'melee', bonus: 11, damage: '2d6+6', type: 'cortante', extra: '1d8', extraType: 'ácido' },
      { id: 'acidBreath', name: 'Aliento de Ácido', kind: 'save', save: 'des', dc: 18, damage: '12d8', type: 'ácido', half: true, recharge: [5, 6] }
    ],
    multiattack: ['rend', 'rend', 'rend'],
    traits: [
      { name: 'Resistencia Legendaria', desc: 'Varias veces al día puede superar una salvación que haya fallado.' },
      { name: 'Aliento', desc: 'Escupe una línea de ácido cada pocos turnos.' },
      { name: 'Anfibio', desc: 'Respira tanto en el aire como bajo el agua.' },
      { name: 'Acciones Legendarias', desc: 'Tras el turno de otra criatura puede atacar o lanzar un conjuro.' }
    ],
    fearless: false,
    tags: ['pantano', 'ruinas']
  },
  {
    id: 'adultGreenDragon',
    name: 'Dragón Verde Adulto',
    type: 'dragón',
    size: 'Enorme',
    cr: 15,
    xp: 13000,
    ac: 19,
    hp: 207,
    hitDice: '18d12+90',
    initiative: 11,
    speed: 12,
    stats: { fue: 23, des: 12, con: 21, int: 18, sab: 15, car: 18 },
    saves: { des: 6, sab: 7 },
    actions: [
      { id: 'rend', name: 'Desgarrar', kind: 'melee', bonus: 11, damage: '2d8+6', type: 'cortante', extra: '2d6', extraType: 'veneno' },
      { id: 'poisonBreath', name: 'Aliento Venenoso', kind: 'save', save: 'con', dc: 18, damage: '16d6', type: 'veneno', half: true, recharge: [5, 6] }
    ],
    multiattack: ['rend', 'rend', 'rend'],
    traits: [
      { name: 'Resistencia Legendaria', desc: 'Varias veces al día puede superar una salvación que haya fallado.' },
      { name: 'Aliento', desc: 'Exhala una nube de veneno cada pocos turnos.' },
      { name: 'Anfibio', desc: 'Respira tanto en el aire como bajo el agua.' },
      { name: 'Acciones Legendarias', desc: 'Tras el turno de otra criatura puede atacar o lanzar un conjuro.' }
    ],
    fearless: false,
    tags: ['bosque', 'pantano']
  },
  {
    id: 'mummyLord',
    name: 'Señor de las Momias',
    type: 'muerto viviente',
    size: 'Mediano',
    cr: 15,
    xp: 13000,
    ac: 17,
    hp: 187,
    hitDice: '25d8+75',
    initiative: 10,
    speed: 9,
    stats: { fue: 18, des: 10, con: 17, int: 11, sab: 19, car: 16 },
    saves: { int: 5, sab: 9 },
    actions: [
      { id: 'rottingFist', name: 'Puño Putrefacto', kind: 'melee', bonus: 9, damage: '2d10+4', type: 'contundente', extra: '3d6', extraType: 'necrótico' },
      { id: 'channelNegativeEnergy', name: 'Energía Negativa', kind: 'ranged', bonus: 9, damage: '6d6+4', type: 'necrótico' },
      { id: 'dreadfulGlare', name: 'Mirada Aterradora', kind: 'save', save: 'sab', dc: 17, damage: '6d6+4', type: 'psíquico' }
    ],
    multiattack: ['rottingFist', 'dreadfulGlare'],
    traits: [
      { name: 'Resistencia Legendaria', desc: 'Varias veces al día puede superar una salvación que haya fallado.' },
      { name: 'Resistencia Mágica', desc: 'Tiene ventaja en las salvaciones contra conjuros y efectos mágicos.' },
      { name: 'Restauración No Muerta', desc: 'Si destruyen su cuerpo, renace mientras su corazón exista.' },
      { name: 'Torbellino de Arena', desc: 'Se envuelve en arena para esquivar un ataque.' }
    ],
    fearless: true,
    tags: ['desierto', 'ruinas']
  },
  {
    id: 'purpleWorm',
    name: 'Gusano Púrpura',
    type: 'monstruosidad',
    size: 'Gargantuesco',
    cr: 15,
    xp: 13000,
    ac: 18,
    hp: 247,
    hitDice: '15d20+90',
    initiative: 3,
    speed: 15,
    stats: { fue: 28, des: 7, con: 22, int: 1, sab: 8, car: 4 },
    saves: { con: 11, sab: 4 },
    actions: [
      { id: 'bite', name: 'Mordisco', kind: 'melee', bonus: 14, damage: '3d8+9', type: 'perforante' },
      { id: 'tailStinger', name: 'Aguijón de la Cola', kind: 'melee', bonus: 14, damage: '2d6+9', type: 'perforante', extra: '10d6', extraType: 'veneno' }
    ],
    multiattack: ['bite', 'tailStinger'],
    traits: [
      { name: 'Excavador', desc: 'Atraviesa roca sólida dejando un túnel.' },
      { name: 'Engullir', desc: 'Se traga entera a una criatura.' }
    ],
    fearless: false,
    tags: ['subterráneo', 'desierto']
  },
  {
    id: 'adultBlueDragon',
    name: 'Dragón Azul Adulto',
    type: 'dragón',
    size: 'Enorme',
    cr: 16,
    xp: 15000,
    ac: 19,
    hp: 212,
    hitDice: '17d12+102',
    initiative: 10,
    speed: 12,
    stats: { fue: 25, des: 10, con: 23, int: 16, sab: 15, car: 20 },
    saves: { des: 5, sab: 7 },
    actions: [
      { id: 'rend', name: 'Desgarrar', kind: 'melee', bonus: 12, damage: '2d8+7', type: 'cortante', extra: '1d10', extraType: 'relámpago' },
      { id: 'lightningBreath', name: 'Aliento de Relámpago', kind: 'save', save: 'des', dc: 19, damage: '11d10', type: 'relámpago', half: true, recharge: [5, 6] }
    ],
    multiattack: ['rend', 'rend', 'rend'],
    traits: [
      { name: 'Resistencia Legendaria', desc: 'Varias veces al día puede superar una salvación que haya fallado.' },
      { name: 'Aliento', desc: 'Escupe una línea de relámpagos cada pocos turnos.' },
      { name: 'Acciones Legendarias', desc: 'Tras el turno de otra criatura puede atacar o lanzar un conjuro.' }
    ],
    fearless: false,
    tags: ['desierto', 'costa']
  },
  {
    id: 'ironGolem',
    name: 'Gólem de Hierro',
    type: 'constructo',
    size: 'Grande',
    cr: 16,
    xp: 15000,
    ac: 20,
    hp: 252,
    hitDice: '24d10+120',
    initiative: 9,
    speed: 9,
    stats: { fue: 24, des: 9, con: 20, int: 3, sab: 11, car: 1 },
    saves: {},
    actions: [
      { id: 'bladedArm', name: 'Brazo Afilado', kind: 'melee', bonus: 12, damage: '3d8+7', type: 'cortante', extra: '3d6', extraType: 'fuego' },
      { id: 'fieryBolt', name: 'Proyectil Ígneo', kind: 'ranged', bonus: 10, damage: '8d8', type: 'fuego' },
      { id: 'poisonBreath', name: 'Aliento Venenoso', kind: 'save', save: 'con', dc: 18, damage: '10d10', type: 'veneno', half: true, recharge: [6] }
    ],
    multiattack: ['bladedArm', 'bladedArm'],
    traits: [
      { name: 'Resistencia Mágica', desc: 'Tiene ventaja en las salvaciones contra conjuros y efectos mágicos.' },
      { name: 'Absorber Fuego', desc: 'El fuego lo cura en lugar de herirlo.' },
      { name: 'Forma Inmutable', desc: 'Nada puede cambiar su forma.' },
      { name: 'Aliento Venenoso', desc: 'Exhala una nube de gas tóxico.' }
    ],
    fearless: true,
    tags: ['ruinas', 'subterráneo']
  },
  {
    id: 'marilith',
    name: 'Marilith',
    type: 'infernal',
    size: 'Grande',
    cr: 16,
    xp: 15000,
    ac: 16,
    hp: 220,
    hitDice: '21d10+105',
    initiative: 10,
    speed: 12,
    stats: { fue: 18, des: 20, con: 20, int: 18, sab: 16, car: 20 },
    saves: { fue: 9, con: 10, sab: 8, car: 10 },
    actions: [
      { id: 'pactBlade', name: 'Hoja del Pacto', kind: 'melee', bonus: 10, damage: '1d10+5', type: 'cortante', extra: '2d6', extraType: 'necrótico' },
      { id: 'constrict', name: 'Constreñir', kind: 'save', save: 'fue', dc: 17, damage: '2d10+4', type: 'contundente' }
    ],
    multiattack: ['pactBlade', 'pactBlade', 'pactBlade', 'pactBlade', 'pactBlade', 'pactBlade', 'constrict'],
    traits: [
      { name: 'Resistencia Mágica', desc: 'Tiene ventaja en las salvaciones contra conjuros y efectos mágicos.' },
      { name: 'Seis Espadas', desc: 'Ataca con seis brazos a la vez.' },
      { name: 'Parada', desc: 'Como reacción, suma a su CA para desviar un ataque cuerpo a cuerpo.' },
      { name: 'Teletransporte', desc: 'Se teletransporta una distancia corta.' }
    ],
    fearless: false,
    tags: ['planos']
  },
  {
    id: 'adultRedDragon',
    name: 'Dragón Rojo Adulto',
    type: 'dragón',
    size: 'Enorme',
    cr: 17,
    xp: 18000,
    ac: 19,
    hp: 256,
    hitDice: '19d12+133',
    initiative: 12,
    speed: 12,
    stats: { fue: 27, des: 10, con: 25, int: 16, sab: 13, car: 23 },
    saves: { des: 6, sab: 7 },
    actions: [
      { id: 'rend', name: 'Desgarrar', kind: 'melee', bonus: 14, damage: '1d10+8', type: 'cortante', extra: '2d4', extraType: 'fuego' },
      { id: 'fireBreath', name: 'Aliento de Fuego', kind: 'save', save: 'des', dc: 21, damage: '17d6', type: 'fuego', half: true, recharge: [5, 6] }
    ],
    multiattack: ['rend', 'rend', 'rend'],
    traits: [
      { name: 'Resistencia Legendaria', desc: 'Varias veces al día puede superar una salvación que haya fallado.' },
      { name: 'Aliento', desc: 'Escupe un cono de fuego cada pocos turnos.' },
      { name: 'Acciones Legendarias', desc: 'Tras el turno de otra criatura puede atacar o lanzar un conjuro.' }
    ],
    fearless: false,
    tags: ['montaña', 'subterráneo']
  },
  {
    id: 'adultGoldDragon',
    name: 'Dragón Dorado Adulto',
    type: 'dragón',
    size: 'Enorme',
    cr: 17,
    xp: 18000,
    ac: 19,
    hp: 243,
    hitDice: '18d12+126',
    initiative: 14,
    speed: 12,
    stats: { fue: 27, des: 14, con: 25, int: 16, sab: 15, car: 24 },
    saves: { des: 8, sab: 8 },
    actions: [
      { id: 'rend', name: 'Desgarrar', kind: 'melee', bonus: 14, damage: '2d8+8', type: 'cortante', extra: '1d8', extraType: 'fuego' },
      { id: 'fireBreath', name: 'Aliento de Fuego', kind: 'save', save: 'des', dc: 21, damage: '12d10', type: 'fuego', half: true, recharge: [5, 6] }
    ],
    multiattack: ['rend', 'rend', 'rend'],
    traits: [
      { name: 'Resistencia Legendaria', desc: 'Varias veces al día puede superar una salvación que haya fallado.' },
      { name: 'Aliento', desc: 'Exhala fuego o un aliento que debilita.' },
      { name: 'Anfibio', desc: 'Respira tanto en el aire como bajo el agua.' },
      { name: 'Acciones Legendarias', desc: 'Tras el turno de otra criatura puede atacar o lanzar un conjuro.' }
    ],
    fearless: false,
    tags: ['montaña', 'costa', 'planos']
  },
  {
    id: 'balor',
    name: 'Balor',
    type: 'infernal',
    size: 'Enorme',
    cr: 19,
    xp: 22000,
    ac: 19,
    hp: 287,
    hitDice: '23d12+138',
    initiative: 14,
    speed: 12,
    stats: { fue: 26, des: 15, con: 22, int: 20, sab: 16, car: 22 },
    saves: { con: 12, sab: 9 },
    actions: [
      { id: 'flameWhip', name: 'Látigo de Llamas', kind: 'melee', bonus: 14, damage: '3d6+8', type: 'fuerza', extra: '5d6', extraType: 'fuego' },
      { id: 'lightningBlade', name: 'Espada Relampagueante', kind: 'melee', bonus: 14, damage: '3d8+8', type: 'fuerza', extra: '4d10', extraType: 'relámpago' }
    ],
    multiattack: ['flameWhip', 'lightningBlade'],
    traits: [
      { name: 'Resistencia Mágica', desc: 'Tiene ventaja en las salvaciones contra conjuros y efectos mágicos.' },
      { name: 'Resistencia Legendaria', desc: 'Varias veces al día puede superar una salvación que haya fallado.' },
      { name: 'Aura de Fuego', desc: 'Quema a quien está a su lado.' },
      { name: 'Estertores', desc: 'Al morir estalla en una explosión de fuego.' }
    ],
    fearless: true,
    tags: ['planos', 'subterráneo']
  },
  {
    id: 'pitFiend',
    name: 'Diablo de la Sima',
    type: 'infernal',
    size: 'Grande',
    cr: 20,
    xp: 25000,
    ac: 21,
    hp: 337,
    hitDice: '27d10+189',
    initiative: 14,
    speed: 9,
    stats: { fue: 26, des: 14, con: 24, int: 22, sab: 18, car: 24 },
    saves: { des: 8, sab: 10 },
    actions: [
      { id: 'bite', name: 'Mordisco', kind: 'melee', bonus: 14, damage: '3d6+8', type: 'perforante' },
      { id: 'devilishClaw', name: 'Garra Diabólica', kind: 'melee', bonus: 14, damage: '4d8+8', type: 'necrótico' },
      { id: 'fieryMace', name: 'Maza Ígnea', kind: 'melee', bonus: 14, damage: '4d6+8', type: 'fuerza', extra: '6d6', extraType: 'fuego' }
    ],
    multiattack: ['bite', 'devilishClaw', 'devilishClaw', 'fieryMace'],
    traits: [
      { name: 'Resistencia Mágica', desc: 'Tiene ventaja en las salvaciones contra conjuros y efectos mágicos.' },
      { name: 'Resistencia Legendaria', desc: 'Varias veces al día puede superar una salvación que haya fallado.' },
      { name: 'Aura de Miedo', desc: 'Aterroriza a los enemigos cercanos.' },
      { name: 'Fuego Infernal', desc: 'Lanza conjuros devastadores de fuego.' }
    ],
    fearless: false,
    tags: ['planos']
  },
  {
    id: 'lich',
    name: 'Liche',
    type: 'muerto viviente',
    size: 'Mediano',
    cr: 21,
    xp: 33000,
    ac: 20,
    hp: 315,
    hitDice: '42d8+126',
    initiative: 17,
    speed: 9,
    stats: { fue: 11, des: 16, con: 16, int: 21, sab: 14, car: 16 },
    saves: { des: 10, con: 10, int: 12, sab: 9 },
    actions: [
      { id: 'eldritchBurst', name: 'Estallido Sobrenatural', kind: 'melee', bonus: 12, damage: '4d12+5', type: 'fuerza' },
      { id: 'paralyzingTouch', name: 'Toque Paralizante', kind: 'melee', bonus: 12, damage: '3d6+5', type: 'frío' }
    ],
    multiattack: ['eldritchBurst', 'eldritchBurst', 'eldritchBurst'],
    traits: [
      { name: 'Resistencia Legendaria', desc: 'Varias veces al día puede superar una salvación que haya fallado.' },
      { name: 'Filacteria', desc: 'Si lo destruyen, renace junto a su filacteria.' },
      { name: 'Lanzamiento de Conjuros', desc: 'Puede lanzar varios conjuros además de sus ataques.' },
      { name: 'Magia Protectora', desc: 'Responde con Escudo o Contraconjuro.' }
    ],
    fearless: true,
    tags: ['ruinas', 'subterráneo', 'planos']
  },
  {
    id: 'ancientBlackDragon',
    name: 'Dragón Negro Anciano',
    type: 'dragón',
    size: 'Gargantuesco',
    cr: 21,
    xp: 33000,
    ac: 22,
    hp: 367,
    hitDice: '21d20+147',
    initiative: 16,
    speed: 12,
    stats: { fue: 27, des: 14, con: 25, int: 16, sab: 15, car: 22 },
    saves: { des: 9, sab: 9 },
    actions: [
      { id: 'rend', name: 'Desgarrar', kind: 'melee', bonus: 15, damage: '2d8+8', type: 'cortante', extra: '2d8', extraType: 'ácido' },
      { id: 'acidBreath', name: 'Aliento de Ácido', kind: 'save', save: 'des', dc: 22, damage: '15d8', type: 'ácido', half: true, recharge: [5, 6] }
    ],
    multiattack: ['rend', 'rend', 'rend'],
    traits: [
      { name: 'Resistencia Legendaria', desc: 'Varias veces al día puede superar una salvación que haya fallado.' },
      { name: 'Aliento', desc: 'Escupe una línea de ácido devastadora cada pocos turnos.' },
      { name: 'Anfibio', desc: 'Respira tanto en el aire como bajo el agua.' },
      { name: 'Acciones Legendarias', desc: 'Tras el turno de otra criatura puede atacar o lanzar un conjuro.' }
    ],
    fearless: false,
    tags: ['pantano', 'ruinas']
  },
  {
    id: 'ancientGreenDragon',
    name: 'Dragón Verde Anciano',
    type: 'dragón',
    size: 'Gargantuesco',
    cr: 22,
    xp: 41000,
    ac: 21,
    hp: 402,
    hitDice: '23d20+161',
    initiative: 15,
    speed: 12,
    stats: { fue: 27, des: 12, con: 25, int: 20, sab: 17, car: 22 },
    saves: { des: 8, sab: 10 },
    actions: [
      { id: 'rend', name: 'Desgarrar', kind: 'melee', bonus: 15, damage: '2d8+8', type: 'cortante', extra: '3d6', extraType: 'veneno' },
      { id: 'poisonBreath', name: 'Aliento Venenoso', kind: 'save', save: 'con', dc: 22, damage: '22d6', type: 'veneno', half: true, recharge: [5, 6] }
    ],
    multiattack: ['rend', 'rend', 'rend'],
    traits: [
      { name: 'Resistencia Legendaria', desc: 'Varias veces al día puede superar una salvación que haya fallado.' },
      { name: 'Aliento', desc: 'Exhala una enorme nube de veneno cada pocos turnos.' },
      { name: 'Anfibio', desc: 'Respira tanto en el aire como bajo el agua.' },
      { name: 'Acciones Legendarias', desc: 'Tras el turno de otra criatura puede atacar o lanzar un conjuro.' }
    ],
    fearless: false,
    tags: ['bosque', 'pantano']
  },
  {
    id: 'kraken',
    name: 'Kraken',
    type: 'monstruosidad',
    size: 'Gargantuesco',
    cr: 23,
    xp: 50000,
    ac: 18,
    hp: 481,
    hitDice: '26d20+208',
    initiative: 14,
    speed: 9,
    stats: { fue: 30, des: 11, con: 26, int: 22, sab: 18, car: 20 },
    saves: { fue: 17, des: 7, con: 15, sab: 11 },
    actions: [
      { id: 'tentacle', name: 'Tentáculo', kind: 'melee', bonus: 17, damage: '4d6+10', type: 'contundente' },
      { id: 'lightningStrike', name: 'Descarga de Relámpago', kind: 'save', save: 'des', dc: 23, damage: '6d10', type: 'relámpago', half: true },
      { id: 'swallow', name: 'Engullir', kind: 'save', save: 'des', dc: 25, damage: '3d8+10', type: 'perforante', extra: '7d6', extraType: 'ácido' }
    ],
    multiattack: ['tentacle', 'tentacle', 'lightningStrike'],
    traits: [
      { name: 'Resistencia Legendaria', desc: 'Varias veces al día puede superar una salvación que haya fallado.' },
      { name: 'Anfibio', desc: 'Respira tanto en el aire como bajo el agua.' },
      { name: 'Monstruo de Asedio', desc: 'Destroza barcos y estructuras.' },
      { name: 'Engullir', desc: 'Se traga a sus presas enteras.' }
    ],
    fearless: true,
    tags: ['mar', 'costa']
  },
  {
    id: 'ancientBlueDragon',
    name: 'Dragón Azul Anciano',
    type: 'dragón',
    size: 'Gargantuesco',
    cr: 23,
    xp: 50000,
    ac: 22,
    hp: 481,
    hitDice: '26d20+208',
    initiative: 14,
    speed: 12,
    stats: { fue: 29, des: 10, con: 27, int: 18, sab: 17, car: 25 },
    saves: { des: 7, sab: 10 },
    actions: [
      { id: 'rend', name: 'Desgarrar', kind: 'melee', bonus: 16, damage: '2d8+9', type: 'cortante', extra: '2d10', extraType: 'relámpago' },
      { id: 'lightningBreath', name: 'Aliento de Relámpago', kind: 'save', save: 'des', dc: 23, damage: '16d10', type: 'relámpago', half: true, recharge: [5, 6] }
    ],
    multiattack: ['rend', 'rend', 'rend'],
    traits: [
      { name: 'Resistencia Legendaria', desc: 'Varias veces al día puede superar una salvación que haya fallado.' },
      { name: 'Aliento', desc: 'Escupe una enorme línea de relámpagos cada pocos turnos.' },
      { name: 'Acciones Legendarias', desc: 'Tras el turno de otra criatura puede atacar o lanzar un conjuro.' }
    ],
    fearless: false,
    tags: ['desierto', 'costa']
  },
  {
    id: 'ancientRedDragon',
    name: 'Dragón Rojo Anciano',
    type: 'dragón',
    size: 'Gargantuesco',
    cr: 24,
    xp: 62000,
    ac: 22,
    hp: 507,
    hitDice: '26d20+234',
    initiative: 14,
    speed: 12,
    stats: { fue: 30, des: 10, con: 29, int: 18, sab: 15, car: 27 },
    saves: { des: 7, sab: 9 },
    actions: [
      { id: 'rend', name: 'Desgarrar', kind: 'melee', bonus: 17, damage: '2d8+10', type: 'cortante', extra: '3d6', extraType: 'fuego' },
      { id: 'fireBreath', name: 'Aliento de Fuego', kind: 'save', save: 'des', dc: 24, damage: '26d6', type: 'fuego', half: true, recharge: [5, 6] }
    ],
    multiattack: ['rend', 'rend', 'rend'],
    traits: [
      { name: 'Resistencia Legendaria', desc: 'Varias veces al día puede superar una salvación que haya fallado.' },
      { name: 'Aliento', desc: 'Escupe un cono de fuego devastador cada pocos turnos.' },
      { name: 'Acciones Legendarias', desc: 'Tras el turno de otra criatura puede atacar o lanzar un conjuro.' }
    ],
    fearless: false,
    tags: ['montaña', 'subterráneo']
  }
];
