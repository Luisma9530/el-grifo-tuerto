// Character creation data for the 2024 rules of D&D (fifth edition, "5.5e").
//
// This file includes material from the System Reference Document 5.2.1
// ("SRD 5.2.1") by Wizards of the Coast LLC, available at
// https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative
// Commons Attribution 4.0 International License
// (https://creativecommons.org/licenses/by/4.0/legalcode).
//
// Names are given in Spanish and descriptions are our own short summaries.
// Backgrounds marked `source: 'original'` are homebrew for El Grifo Tuerto,
// built with the same structure the rules use for backgrounds (three ability
// scores, an origin feat, two skills, a tool and equipment).

export const ABILITIES = [
  { id: 'fue', name: 'Fuerza', short: 'FUE', desc: 'Potencia física: golpear, empujar, cargar.' },
  { id: 'des', name: 'Destreza', short: 'DES', desc: 'Agilidad, reflejos y puntería.' },
  { id: 'con', name: 'Constitución', short: 'CON', desc: 'Aguante y salud: determina tus puntos de golpe.' },
  { id: 'int', name: 'Inteligencia', short: 'INT', desc: 'Memoria, lógica y saber.' },
  { id: 'sab', name: 'Sabiduría', short: 'SAB', desc: 'Percepción, intuición y temple.' },
  { id: 'car', name: 'Carisma', short: 'CAR', desc: 'Presencia, labia y fuerza de voluntad.' }
];

export const SKILLS = [
  { id: 'acrobatics', name: 'Acrobacias', ability: 'des' },
  { id: 'arcana', name: 'Arcanos', ability: 'int' },
  { id: 'athletics', name: 'Atletismo', ability: 'fue' },
  { id: 'deception', name: 'Engaño', ability: 'car' },
  { id: 'history', name: 'Historia', ability: 'int' },
  { id: 'performance', name: 'Interpretación', ability: 'car' },
  { id: 'intimidation', name: 'Intimidación', ability: 'car' },
  { id: 'investigation', name: 'Investigación', ability: 'int' },
  { id: 'sleightOfHand', name: 'Juego de Manos', ability: 'des' },
  { id: 'medicine', name: 'Medicina', ability: 'sab' },
  { id: 'nature', name: 'Naturaleza', ability: 'int' },
  { id: 'perception', name: 'Percepción', ability: 'sab' },
  { id: 'insight', name: 'Perspicacia', ability: 'sab' },
  { id: 'persuasion', name: 'Persuasión', ability: 'car' },
  { id: 'religion', name: 'Religión', ability: 'int' },
  { id: 'stealth', name: 'Sigilo', ability: 'des' },
  { id: 'survival', name: 'Supervivencia', ability: 'sab' },
  { id: 'animalHandling', name: 'Trato con Animales', ability: 'sab' }
];

export const ALL_SKILL_IDS = SKILLS.map(s => s.id);

// Ability score generation
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export const MAX_ABILITY_SCORE = 20;
export const LEVEL_1_PROFICIENCY_BONUS = 2;

// Origin feats available in the SRD 5.2
export const FEATS = [
  { id: 'alert', name: 'Alerta', desc: 'Siempre en guardia: sumas tu bonificador de competencia a la iniciativa y puedes intercambiarla con un aliado.' },
  { id: 'magicInitiateCleric', name: 'Iniciado en la Magia (Clérigo)', desc: 'Aprendes dos trucos y un conjuro de nivel 1 de la lista de clérigo.' },
  { id: 'magicInitiateDruid', name: 'Iniciado en la Magia (Druida)', desc: 'Aprendes dos trucos y un conjuro de nivel 1 de la lista de druida.' },
  { id: 'magicInitiateWizard', name: 'Iniciado en la Magia (Mago)', desc: 'Aprendes dos trucos y un conjuro de nivel 1 de la lista de mago.' },
  { id: 'savageAttacker', name: 'Atacante Salvaje', desc: 'Una vez por turno, tiras dos veces el daño de tu arma y te quedas con el mejor resultado.' },
  { id: 'skilled', name: 'Habilidoso', desc: 'Ganas competencia en tres habilidades o herramientas a tu elección.' }
];

/**
 * Classes. `armor` describes the Armor Class given by the starting equipment:
 *   base + Dexterity modifier (capped by dexCap; 0 = Dexterity not added)
 *   + 2 with a shield + the `unarmored` ability modifier (Unarmored Defense).
 * `suggestedArray` is the standard array assignment the rules suggest for the class.
 */
export const CLASSES = [
  {
    id: 'barbarian', name: 'Bárbaro', icon: '🪓', hitDie: 12, primary: ['fue'],
    tagline: 'Guerrero feroz que entra en furia en combate.',
    desc: 'Aguanta más golpes que nadie y los devuelve con una rabia primigenia. Sencillo y demoledor.',
    savingThrows: ['fue', 'con'],
    skillChoices: { count: 2, from: ['animalHandling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'] },
    features: ['Furia', 'Defensa sin Armadura', 'Maestría con Armas'],
    armor: { base: 10, dexCap: null, shield: false, unarmored: 'con' },
    equipment: [
      { name: 'Hacha a dos manos', type: 'weapon', desc: '1d12 cortante · pesada, a dos manos' },
      { name: 'Hachas de mano (4)', type: 'weapon', desc: '1d6 cortante · ligera, arrojadiza' },
      { name: 'Equipo de explorador', type: 'gear', desc: 'Mochila, saco de dormir, raciones, cuerda, yesquero y antorchas' }
    ],
    gold: 15,
    suggestedArray: { fue: 15, des: 13, con: 14, int: 10, sab: 12, car: 8 }
  },
  {
    id: 'bard', name: 'Bardo', icon: '🎻', hitDie: 8, primary: ['car'],
    tagline: 'Artista cuya música y palabras son magia.',
    desc: 'Inspira a sus aliados, embauca a sus enemigos y sabe un poco de todo. Muy versátil.',
    savingThrows: ['des', 'car'],
    skillChoices: { count: 3, from: 'any' },
    features: ['Inspiración de Bardo', 'Lanzamiento de Conjuros'],
    armor: { base: 11, dexCap: null, shield: false, unarmored: null },
    equipment: [
      { name: 'Armadura de cuero', type: 'armor', desc: 'CA 11 + Destreza' },
      { name: 'Dagas (2)', type: 'weapon', desc: '1d4 perforante · sutil, ligera, arrojadiza' },
      { name: 'Instrumento musical', type: 'tool', desc: 'Tu foco para lanzar conjuros' },
      { name: 'Equipo de artista', type: 'gear', desc: 'Mochila, disfraces, velas, raciones y un espejo' }
    ],
    gold: 19,
    suggestedArray: { fue: 8, des: 14, con: 12, int: 13, sab: 10, car: 15 }
  },
  {
    id: 'cleric', name: 'Clérigo', icon: '⛪', hitDie: 8, primary: ['sab'],
    tagline: 'Campeón divino que canaliza el poder de los dioses.',
    desc: 'Sana, protege y castiga en nombre de su fe. El mejor apoyo de cualquier grupo.',
    savingThrows: ['sab', 'car'],
    skillChoices: { count: 2, from: ['history', 'insight', 'medicine', 'persuasion', 'religion'] },
    features: ['Lanzamiento de Conjuros', 'Orden Divina'],
    armor: { base: 13, dexCap: 2, shield: true, unarmored: null },
    equipment: [
      { name: 'Camisote de mallas', type: 'armor', desc: 'CA 13 + Destreza (máx. 2)' },
      { name: 'Escudo', type: 'armor', desc: '+2 a la CA' },
      { name: 'Maza', type: 'weapon', desc: '1d6 contundente' },
      { name: 'Símbolo sagrado', type: 'tool', desc: 'Tu foco para lanzar conjuros' },
      { name: 'Equipo de sacerdote', type: 'gear', desc: 'Mochila, manta, agua bendita, raciones y yesquero' }
    ],
    gold: 7,
    suggestedArray: { fue: 14, des: 8, con: 13, int: 10, sab: 15, car: 12 }
  },
  {
    id: 'druid', name: 'Druida', icon: '🌿', hitDie: 8, primary: ['sab'],
    tagline: 'Guardián de la naturaleza y sus fuerzas primordiales.',
    desc: 'Habla con las bestias, invoca tormentas y defiende el equilibrio del mundo salvaje.',
    savingThrows: ['int', 'sab'],
    skillChoices: { count: 2, from: ['arcana', 'animalHandling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'] },
    features: ['Lanzamiento de Conjuros', 'Druídico', 'Orden Primigenia'],
    armor: { base: 11, dexCap: null, shield: true, unarmored: null },
    equipment: [
      { name: 'Armadura de cuero', type: 'armor', desc: 'CA 11 + Destreza' },
      { name: 'Escudo', type: 'armor', desc: '+2 a la CA' },
      { name: 'Hoz', type: 'weapon', desc: '1d4 cortante · ligera' },
      { name: 'Bastón druídico', type: 'weapon', desc: '1d6 contundente · tu foco druídico' },
      { name: 'Útiles de herborista', type: 'tool', desc: 'Para preparar remedios y antídotos' },
      { name: 'Equipo de explorador', type: 'gear', desc: 'Mochila, saco de dormir, raciones, cuerda, yesquero y antorchas' }
    ],
    gold: 9,
    suggestedArray: { fue: 8, des: 12, con: 14, int: 13, sab: 15, car: 10 }
  },
  {
    id: 'fighter', name: 'Guerrero', icon: '⚔️', hitDie: 10, primary: ['fue', 'des'],
    tagline: 'Maestro de las armas y la armadura.',
    desc: 'El combatiente por excelencia: duro, fiable y letal con cualquier arma. Ideal para empezar.',
    savingThrows: ['fue', 'con'],
    skillChoices: { count: 2, from: ['acrobatics', 'animalHandling', 'athletics', 'history', 'insight', 'intimidation', 'persuasion', 'perception', 'survival'] },
    features: ['Estilo de Combate', 'Tomar Aliento', 'Maestría con Armas'],
    armor: { base: 16, dexCap: 0, shield: false, unarmored: null },
    equipment: [
      { name: 'Cota de mallas', type: 'armor', desc: 'CA 16 · desventaja en Sigilo' },
      { name: 'Espadón', type: 'weapon', desc: '2d6 cortante · pesada, a dos manos' },
      { name: 'Mangual', type: 'weapon', desc: '1d8 contundente' },
      { name: 'Jabalinas (8)', type: 'weapon', desc: '1d6 perforante · arrojadiza' },
      { name: 'Equipo de dungeon', type: 'gear', desc: 'Mochila, palanca, martillo, pitones, antorchas, raciones y cuerda' }
    ],
    gold: 4,
    suggestedArray: { fue: 15, des: 14, con: 13, int: 8, sab: 10, car: 12 }
  },
  {
    id: 'monk', name: 'Monje', icon: '👊', hitDie: 8, primary: ['des', 'sab'],
    tagline: 'Artista marcial que domina cuerpo y mente.',
    desc: 'Rápido como un rayo, pelea sin armadura y convierte sus puños en armas.',
    savingThrows: ['fue', 'des'],
    skillChoices: { count: 2, from: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'] },
    features: ['Artes Marciales', 'Defensa sin Armadura'],
    armor: { base: 10, dexCap: null, shield: false, unarmored: 'sab' },
    equipment: [
      { name: 'Lanza', type: 'weapon', desc: '1d6 perforante · arrojadiza, versátil (1d8)' },
      { name: 'Dagas (5)', type: 'weapon', desc: '1d4 perforante · sutil, ligera, arrojadiza' },
      { name: 'Herramientas de artesano', type: 'tool', desc: 'El oficio que aprendiste en el monasterio' },
      { name: 'Equipo de explorador', type: 'gear', desc: 'Mochila, saco de dormir, raciones, cuerda, yesquero y antorchas' }
    ],
    gold: 11,
    suggestedArray: { fue: 12, des: 15, con: 13, int: 10, sab: 14, car: 8 }
  },
  {
    id: 'paladin', name: 'Paladín', icon: '🛡️', hitDie: 10, primary: ['fue', 'car'],
    tagline: 'Guerrero sagrado ligado a un juramento.',
    desc: 'Combina acero y fe: protege a los suyos, sana con sus manos y castiga el mal.',
    savingThrows: ['sab', 'car'],
    skillChoices: { count: 2, from: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'] },
    features: ['Imposición de Manos', 'Lanzamiento de Conjuros', 'Maestría con Armas'],
    armor: { base: 16, dexCap: 0, shield: true, unarmored: null },
    equipment: [
      { name: 'Cota de mallas', type: 'armor', desc: 'CA 16 · desventaja en Sigilo' },
      { name: 'Escudo', type: 'armor', desc: '+2 a la CA' },
      { name: 'Espada larga', type: 'weapon', desc: '1d8 cortante · versátil (1d10)' },
      { name: 'Jabalinas (6)', type: 'weapon', desc: '1d6 perforante · arrojadiza' },
      { name: 'Símbolo sagrado', type: 'tool', desc: 'Tu foco para lanzar conjuros' },
      { name: 'Equipo de sacerdote', type: 'gear', desc: 'Mochila, manta, agua bendita, raciones y yesquero' }
    ],
    gold: 9,
    suggestedArray: { fue: 15, des: 10, con: 13, int: 8, sab: 12, car: 14 }
  },
  {
    id: 'ranger', name: 'Explorador', icon: '🏹', hitDie: 10, primary: ['des', 'sab'],
    tagline: 'Cazador y rastreador de las tierras salvajes.',
    desc: 'Letal con el arco, experto en supervivencia y con un toque de magia natural.',
    savingThrows: ['fue', 'des'],
    skillChoices: { count: 3, from: ['animalHandling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'] },
    features: ['Lanzamiento de Conjuros', 'Enemigo Predilecto', 'Maestría con Armas'],
    armor: { base: 12, dexCap: null, shield: false, unarmored: null },
    equipment: [
      { name: 'Armadura de cuero tachonado', type: 'armor', desc: 'CA 12 + Destreza' },
      { name: 'Cimitarra', type: 'weapon', desc: '1d6 cortante · sutil, ligera' },
      { name: 'Espada corta', type: 'weapon', desc: '1d6 perforante · sutil, ligera' },
      { name: 'Arco largo y 20 flechas', type: 'weapon', desc: '1d8 perforante · alcance 45/180 m' },
      { name: 'Ramita de muérdago', type: 'tool', desc: 'Tu foco druídico' },
      { name: 'Equipo de explorador', type: 'gear', desc: 'Mochila, saco de dormir, raciones, cuerda, yesquero y antorchas' }
    ],
    gold: 7,
    suggestedArray: { fue: 12, des: 15, con: 13, int: 8, sab: 14, car: 10 }
  },
  {
    id: 'rogue', name: 'Pícaro', icon: '🗡️', hitDie: 8, primary: ['des'],
    tagline: 'Experto en sigilo, trampas y golpes certeros.',
    desc: 'Entra donde nadie puede, golpea donde más duele y sale sin ser visto. El más hábil.',
    savingThrows: ['des', 'int'],
    skillChoices: { count: 4, from: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'persuasion', 'sleightOfHand', 'stealth'] },
    features: ['Pericia', 'Ataque Furtivo', 'Jerga de Ladrones', 'Maestría con Armas'],
    armor: { base: 11, dexCap: null, shield: false, unarmored: null },
    equipment: [
      { name: 'Armadura de cuero', type: 'armor', desc: 'CA 11 + Destreza' },
      { name: 'Dagas (2)', type: 'weapon', desc: '1d4 perforante · sutil, ligera, arrojadiza' },
      { name: 'Espada corta', type: 'weapon', desc: '1d6 perforante · sutil, ligera' },
      { name: 'Arco corto y 20 flechas', type: 'weapon', desc: '1d6 perforante · alcance 24/96 m' },
      { name: 'Herramientas de ladrón', type: 'tool', desc: 'Para abrir cerraduras y desarmar trampas' },
      { name: 'Equipo de ladrón', type: 'gear', desc: 'Mochila, bolas de metal, campana, velas, palanca, linterna y cuerda' }
    ],
    gold: 8,
    suggestedArray: { fue: 12, des: 15, con: 13, int: 14, sab: 10, car: 8 }
  },
  {
    id: 'sorcerer', name: 'Hechicero', icon: '✨', hitDie: 6, primary: ['car'],
    tagline: 'Lanzador de conjuros con magia innata en la sangre.',
    desc: 'No estudió la magia: nació con ella. Frágil, pero capaz de desatar un poder enorme.',
    savingThrows: ['con', 'car'],
    skillChoices: { count: 2, from: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'] },
    features: ['Lanzamiento de Conjuros', 'Hechicería Innata'],
    armor: { base: 10, dexCap: null, shield: false, unarmored: null },
    equipment: [
      { name: 'Lanza', type: 'weapon', desc: '1d6 perforante · arrojadiza, versátil (1d8)' },
      { name: 'Dagas (2)', type: 'weapon', desc: '1d4 perforante · sutil, ligera, arrojadiza' },
      { name: 'Cristal arcano', type: 'tool', desc: 'Tu foco para lanzar conjuros' },
      { name: 'Equipo de dungeon', type: 'gear', desc: 'Mochila, palanca, martillo, pitones, antorchas, raciones y cuerda' }
    ],
    gold: 28,
    suggestedArray: { fue: 10, des: 13, con: 14, int: 8, sab: 12, car: 15 }
  },
  {
    id: 'warlock', name: 'Brujo', icon: '🔮', hitDie: 8, primary: ['car'],
    tagline: 'Hizo un pacto con un ser de otro mundo.',
    desc: 'Su poder viene de un patrón misterioso. Pocos conjuros, pero potentes y siempre disponibles.',
    savingThrows: ['sab', 'car'],
    skillChoices: { count: 2, from: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'] },
    features: ['Invocaciones Sobrenaturales', 'Magia de Pacto'],
    armor: { base: 11, dexCap: null, shield: false, unarmored: null },
    equipment: [
      { name: 'Armadura de cuero', type: 'armor', desc: 'CA 11 + Destreza' },
      { name: 'Hoz', type: 'weapon', desc: '1d4 cortante · ligera' },
      { name: 'Dagas (2)', type: 'weapon', desc: '1d4 perforante · sutil, ligera, arrojadiza' },
      { name: 'Orbe arcano', type: 'tool', desc: 'Tu foco para lanzar conjuros' },
      { name: 'Libro de saber oculto', type: 'gear', desc: 'Apuntes sobre tu patrón y sus secretos' },
      { name: 'Equipo de erudito', type: 'gear', desc: 'Mochila, libro, tinta, pluma, lámpara, aceite y pergamino' }
    ],
    gold: 15,
    suggestedArray: { fue: 8, des: 14, con: 13, int: 12, sab: 10, car: 15 }
  },
  {
    id: 'wizard', name: 'Mago', icon: '📘', hitDie: 6, primary: ['int'],
    tagline: 'Estudioso de la magia arcana y sus secretos.',
    desc: 'Su libro de conjuros es su mayor tesoro. El lanzador más versátil, y también el más frágil.',
    savingThrows: ['int', 'sab'],
    skillChoices: { count: 2, from: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'nature', 'religion'] },
    features: ['Lanzamiento de Conjuros', 'Adepto en Rituales', 'Recuperación Arcana'],
    armor: { base: 10, dexCap: null, shield: false, unarmored: null },
    equipment: [
      { name: 'Dagas (2)', type: 'weapon', desc: '1d4 perforante · sutil, ligera, arrojadiza' },
      { name: 'Bastón arcano', type: 'weapon', desc: '1d6 contundente · tu foco arcano' },
      { name: 'Túnica', type: 'gear', desc: 'Ropa de estudioso' },
      { name: 'Libro de conjuros', type: 'tool', desc: 'Donde anotas tus conjuros' },
      { name: 'Equipo de erudito', type: 'gear', desc: 'Mochila, libro, tinta, pluma, lámpara, aceite y pergamino' }
    ],
    gold: 5,
    suggestedArray: { fue: 8, des: 12, con: 13, int: 15, sab: 14, car: 10 }
  }
];

/**
 * Backgrounds ("origen"). Each one raises three ability scores (+2/+1 or +1/+1/+1),
 * and grants an origin feat, two skills, a tool and equipment.
 */
export const BACKGROUNDS = [
  {
    id: 'acolyte', name: 'Acólito', icon: '🕯️', source: 'srd',
    desc: 'Te criaste al servicio de un templo, entre rezos, ritos y estudio de lo sagrado.',
    abilities: ['int', 'sab', 'car'], feat: 'magicInitiateCleric', skills: ['insight', 'religion'],
    tool: 'Útiles de calígrafo',
    equipment: [
      { name: 'Útiles de calígrafo', type: 'tool', desc: 'Tinta, plumas y pergamino fino' },
      { name: 'Libro de oraciones', type: 'gear', desc: 'Los rezos de tu fe' },
      { name: 'Símbolo sagrado', type: 'tool', desc: 'El emblema de tu deidad' },
      { name: 'Túnica y pergaminos', type: 'gear', desc: 'Hábito de templo y diez hojas de pergamino' }
    ],
    gold: 8
  },
  {
    id: 'criminal', name: 'Criminal', icon: '🎭', source: 'srd',
    desc: 'Sobreviviste en callejones y tugurios, robando carteras o trabajando para una banda.',
    abilities: ['des', 'con', 'int'], feat: 'alert', skills: ['sleightOfHand', 'stealth'],
    tool: 'Herramientas de ladrón',
    equipment: [
      { name: 'Dagas (2)', type: 'weapon', desc: '1d4 perforante · sutil, ligera, arrojadiza' },
      { name: 'Herramientas de ladrón', type: 'tool', desc: 'Para abrir cerraduras y desarmar trampas' },
      { name: 'Palanca', type: 'gear', desc: 'Ventaja para forzar puertas y cofres' },
      { name: 'Ropa de viaje y dos bolsas', type: 'gear', desc: 'Discreta y con bolsillos de sobra' }
    ],
    gold: 16
  },
  {
    id: 'sage', name: 'Sabio', icon: '📜', source: 'srd',
    desc: 'Pasaste tus años de formación entre libros y pergaminos, de biblioteca en biblioteca.',
    abilities: ['con', 'int', 'sab'], feat: 'magicInitiateWizard', skills: ['arcana', 'history'],
    tool: 'Útiles de calígrafo',
    equipment: [
      { name: 'Bastón', type: 'weapon', desc: '1d6 contundente · versátil (1d8)' },
      { name: 'Útiles de calígrafo', type: 'tool', desc: 'Tinta, plumas y pergamino fino' },
      { name: 'Libro de historia', type: 'gear', desc: 'Tu tomo de cabecera' },
      { name: 'Túnica y pergaminos', type: 'gear', desc: 'Ropa de estudioso y ocho hojas de pergamino' }
    ],
    gold: 8
  },
  {
    id: 'soldier', name: 'Soldado', icon: '🎖️', source: 'srd',
    desc: 'Te entrenaste para la guerra desde joven; la disciplina y la batalla son tu segunda piel.',
    abilities: ['fue', 'des', 'con'], feat: 'savageAttacker', skills: ['athletics', 'intimidation'],
    tool: 'Juego de dados',
    equipment: [
      { name: 'Lanza', type: 'weapon', desc: '1d6 perforante · arrojadiza, versátil (1d8)' },
      { name: 'Arco corto y 20 flechas', type: 'weapon', desc: '1d6 perforante · alcance 24/96 m' },
      { name: 'Útiles de sanador', type: 'consumable', effect: 'Venda heridas y estabiliza a los caídos', uses: 10 },
      { name: 'Juego de dados y ropa de viaje', type: 'gear', desc: 'Para matar el tiempo entre guardias' }
    ],
    gold: 14
  },
  {
    id: 'innkeeper', name: 'Tabernero', icon: '🍺', source: 'original',
    desc: 'Creciste tras una barra, sirviendo jarras y escuchando los secretos de medio reino.',
    abilities: ['con', 'sab', 'car'], feat: 'skilled', skills: ['insight', 'persuasion'],
    tool: 'Utensilios de cocinero',
    equipment: [
      { name: 'Utensilios de cocinero', type: 'tool', desc: 'Cazo, cuchillos y especias' },
      { name: 'Garrote de barra', type: 'weapon', desc: '1d4 contundente · ligera' },
      { name: 'Barrilete de cerveza', type: 'gear', desc: 'Abre conversaciones mejor que cualquier llave' },
      { name: 'Delantal y ropa de viaje', type: 'gear', desc: 'Con manchas que es mejor no analizar' }
    ],
    gold: 14
  },
  {
    id: 'poacher', name: 'Cazador Furtivo', icon: '🦌', source: 'original',
    desc: 'Aprendiste a moverte por bosques ajenos sin dejar rastro, viviendo de lo que cazabas.',
    abilities: ['des', 'con', 'sab'], feat: 'alert', skills: ['stealth', 'survival'],
    tool: 'Útiles de peletero',
    equipment: [
      { name: 'Arco corto y 20 flechas', type: 'weapon', desc: '1d6 perforante · alcance 24/96 m' },
      { name: 'Útiles de peletero', type: 'tool', desc: 'Para curtir y trabajar pieles' },
      { name: 'Trampa de caza', type: 'gear', desc: 'Cepo de hierro para presas medianas' },
      { name: 'Ropa de viaje', type: 'gear', desc: 'Capa parda que se confunde con el follaje' }
    ],
    gold: 12
  },
  {
    id: 'minstrel', name: 'Juglar Errante', icon: '🪕', source: 'original',
    desc: 'Fuiste de aldea en aldea cantando gestas antiguas a cambio de cama y cena.',
    abilities: ['des', 'int', 'car'], feat: 'skilled', skills: ['history', 'performance'],
    tool: 'Laúd',
    equipment: [
      { name: 'Laúd', type: 'tool', desc: 'Algo desafinado, pero con historia' },
      { name: 'Daga', type: 'weapon', desc: '1d4 perforante · sutil, ligera, arrojadiza' },
      { name: 'Cuaderno de romances', type: 'gear', desc: 'Leyendas y cotilleos de cien posadas' },
      { name: 'Ropa de artista', type: 'gear', desc: 'Colorida, para que te vean llegar' }
    ],
    gold: 11
  },
  {
    id: 'smith', name: 'Aprendiz de Herrero', icon: '⚒️', source: 'original',
    desc: 'Te forjaste junto a un yunque, entre chispas, aprendiendo a leer el metal.',
    abilities: ['fue', 'con', 'int'], feat: 'savageAttacker', skills: ['athletics', 'investigation'],
    tool: 'Herramientas de herrero',
    equipment: [
      { name: 'Herramientas de herrero', type: 'tool', desc: 'Martillo, tenazas y lima' },
      { name: 'Martillo ligero', type: 'weapon', desc: '1d4 contundente · ligera, arrojadiza' },
      { name: 'Piedra de afilar', type: 'gear', desc: 'Ningún filo se te resiste' },
      { name: 'Mandil de cuero y ropa de viaje', type: 'gear', desc: 'Con quemaduras de oficio' }
    ],
    gold: 10
  }
];

/**
 * Species. `options` is a sub-choice some species make (lineage, ancestry...);
 * an option may override speed or darkvision. `skillChoice` grants a skill.
 */
export const SPECIES = [
  {
    id: 'dragonborn', name: 'Dracónido', icon: '🐉', size: 'Mediano', speed: 30, darkvision: 60,
    desc: 'Descendientes de dragones, orgullosos y de aliento devastador.',
    traits: [
      { name: 'Arma de Aliento', desc: 'Exhalas energía de tu linaje dracónico (1d10 de daño).' },
      { name: 'Resistencia al Daño', desc: 'Resistes el tipo de daño de tu linaje.' },
      { name: 'Visión en la Oscuridad', desc: 'Ves en la oscuridad hasta 18 m.' }
    ],
    options: {
      label: 'Linaje dracónico',
      choices: [
        { id: 'black', name: 'Negro', desc: 'Ácido' },
        { id: 'blue', name: 'Azul', desc: 'Relámpago' },
        { id: 'brass', name: 'Latón', desc: 'Fuego' },
        { id: 'bronze', name: 'Bronce', desc: 'Relámpago' },
        { id: 'copper', name: 'Cobre', desc: 'Ácido' },
        { id: 'gold', name: 'Oro', desc: 'Fuego' },
        { id: 'green', name: 'Verde', desc: 'Veneno' },
        { id: 'red', name: 'Rojo', desc: 'Fuego' },
        { id: 'silver', name: 'Plata', desc: 'Frío' },
        { id: 'white', name: 'Blanco', desc: 'Frío' }
      ]
    }
  },
  {
    id: 'dwarf', name: 'Enano', icon: '⛏️', size: 'Mediano', speed: 30, darkvision: 120,
    desc: 'Recios como la roca de sus montañas, tercos y leales.',
    traits: [
      { name: 'Resistencia Enana', desc: 'Resistes el veneno y tienes ventaja para no quedar envenenado.' },
      { name: 'Dureza Enana', desc: 'Tu máximo de puntos de golpe aumenta en 1 por nivel.' },
      { name: 'Afinidad con la Piedra', desc: 'Percibes vibraciones a través de la roca.' },
      { name: 'Visión en la Oscuridad', desc: 'Ves en la oscuridad hasta 36 m.' }
    ],
    hpPerLevel: 1
  },
  {
    id: 'elf', name: 'Elfo', icon: '🧝', size: 'Mediano', speed: 30, darkvision: 60,
    desc: 'Gráciles y longevos, con sentidos agudos y magia en la sangre.',
    traits: [
      { name: 'Linaje Feérico', desc: 'Ventaja para no quedar hechizado.' },
      { name: 'Sentidos Agudos', desc: 'Competencia en Percepción, Perspicacia o Supervivencia.' },
      { name: 'Trance', desc: 'No necesitas dormir: te basta con cuatro horas de meditación.' },
      { name: 'Visión en la Oscuridad', desc: 'Ves en la oscuridad hasta 18 m.' }
    ],
    skillChoice: { count: 1, from: ['insight', 'perception', 'survival'] },
    options: {
      label: 'Linaje élfico',
      choices: [
        { id: 'drow', name: 'Drow', desc: 'Visión en la oscuridad a 36 m y el truco Luces Danzantes.', darkvision: 120 },
        { id: 'high', name: 'Alto Elfo', desc: 'Conoces el truco Prestidigitación.' },
        { id: 'wood', name: 'Elfo del Bosque', desc: 'Tu velocidad es de 10,5 m y conoces el truco Saber Druídico.', speed: 35 }
      ]
    }
  },
  {
    id: 'gnome', name: 'Gnomo', icon: '🍄', size: 'Pequeño', speed: 30, darkvision: 60,
    desc: 'Pequeños, curiosos e ingeniosos, con una mente difícil de engañar.',
    traits: [
      { name: 'Astucia Gnoma', desc: 'Ventaja en salvaciones de Inteligencia, Sabiduría y Carisma.' },
      { name: 'Visión en la Oscuridad', desc: 'Ves en la oscuridad hasta 18 m.' }
    ],
    options: {
      label: 'Linaje gnomo',
      choices: [
        { id: 'forest', name: 'Gnomo del Bosque', desc: 'Conoces Ilusión Menor y puedes hablar con animales.' },
        { id: 'rock', name: 'Gnomo de las Rocas', desc: 'Conoces Reparar y Prestidigitación, y construyes pequeños artilugios.' }
      ]
    }
  },
  {
    id: 'goliath', name: 'Goliat', icon: '🏔️', size: 'Mediano', speed: 35, darkvision: 0,
    desc: 'Descendientes de gigantes, enormes y hechos a las cumbres.',
    traits: [
      { name: 'Ascendencia Gigante', desc: 'Un don sobrenatural heredado de tus ancestros gigantes.' },
      { name: 'Complexión Poderosa', desc: 'Ventaja para escapar de presas y cuentas como una talla mayor al cargar.' },
      { name: 'Velocidad', desc: 'Tu velocidad es de 10,5 m.' }
    ],
    options: {
      label: 'Ascendencia gigante',
      choices: [
        { id: 'cloud', name: 'Nubes', desc: 'Te teletransportas hasta 9 m.' },
        { id: 'fire', name: 'Fuego', desc: 'Añades 1d10 de fuego a un golpe.' },
        { id: 'frost', name: 'Escarcha', desc: 'Añades 1d6 de frío y frenas al objetivo.' },
        { id: 'hill', name: 'Colinas', desc: 'Derribas a un enemigo al golpearlo.' },
        { id: 'stone', name: 'Piedra', desc: 'Reduces el daño que recibes en 1d12 + Constitución.' },
        { id: 'storm', name: 'Tormentas', desc: 'Devuelves 1d8 de trueno a quien te hiere.' }
      ]
    }
  },
  {
    id: 'halfling', name: 'Mediano', icon: '🥧', size: 'Pequeño', speed: 30, darkvision: 0,
    desc: 'Pequeños, afables y con una suerte que roza lo sobrenatural.',
    traits: [
      { name: 'Valiente', desc: 'Ventaja para no quedar asustado.' },
      { name: 'Agilidad de Mediano', desc: 'Puedes pasar por el espacio de criaturas más grandes.' },
      { name: 'Suerte', desc: 'Cuando sacas un 1 en un d20, puedes repetir la tirada.' },
      { name: 'Sigiloso por Naturaleza', desc: 'Puedes esconderte tras criaturas más grandes que tú.' }
    ]
  },
  {
    id: 'human', name: 'Humano', icon: '🧑', size: 'Mediano', speed: 30, darkvision: 0,
    desc: 'Ambiciosos y adaptables: están en todas partes y sirven para todo.',
    traits: [
      { name: 'Ingenioso', desc: 'Ganas Inspiración Heroica tras cada descanso largo.' },
      { name: 'Hábil', desc: 'Competencia en una habilidad a tu elección.' },
      { name: 'Versátil', desc: 'Ganas una dote de origen a tu elección.' }
    ],
    skillChoice: { count: 1, from: 'any' },
    extraFeat: true
  },
  {
    id: 'orc', name: 'Orco', icon: '💪', size: 'Mediano', speed: 30, darkvision: 120,
    desc: 'Fuertes e incansables, con un aguante que desafía a la muerte.',
    traits: [
      { name: 'Subidón de Adrenalina', desc: 'Corres como acción adicional y ganas puntos de golpe temporales.' },
      { name: 'Aguante Incansable', desc: 'Una vez por descanso largo, caes a 1 punto de golpe en lugar de a 0.' },
      { name: 'Visión en la Oscuridad', desc: 'Ves en la oscuridad hasta 36 m.' }
    ]
  },
  {
    id: 'tiefling', name: 'Tiefling', icon: '😈', size: 'Mediano', speed: 30, darkvision: 60,
    desc: 'Marcados por una herencia de los Planos Inferiores: cuernos, cola y magia propia.',
    traits: [
      { name: 'Legado Infernal', desc: 'Resistencia a un tipo de daño y un truco, según tu legado.' },
      { name: 'Presencia de Otro Mundo', desc: 'Conoces el truco Taumaturgia.' },
      { name: 'Visión en la Oscuridad', desc: 'Ves en la oscuridad hasta 18 m.' }
    ],
    options: {
      label: 'Legado infernal',
      choices: [
        { id: 'abyssal', name: 'Abisal', desc: 'Resistencia al veneno y el truco Rociada Venenosa.' },
        { id: 'chthonic', name: 'Ctónico', desc: 'Resistencia al daño necrótico y el truco Toque Gélido.' },
        { id: 'infernal', name: 'Infernal', desc: 'Resistencia al fuego y el truco Descarga de Fuego.' }
      ]
    }
  }
];

// Every character knows Common plus two of these
export const LANGUAGES = [
  'Dracónico', 'Enano', 'Élfico', 'Gigante', 'Gnomo', 'Goblin', 'Mediano', 'Orco', 'Lengua de Signos Común'
];
export const BASE_LANGUAGE = 'Común';
export const LANGUAGE_CHOICES = 2;

export const ALIGNMENTS = [
  'Legal Bueno', 'Neutral Bueno', 'Caótico Bueno',
  'Legal Neutral', 'Neutral', 'Caótico Neutral',
  'Legal Malvado', 'Neutral Malvado', 'Caótico Malvado'
];

export const AVATARS = ['🛡️', '⚔️', '🗡️', '🏹', '🪓', '🔮', '📘', '✨', '🌿', '🎻', '👊', '🧝', '🧝‍♀️', '🧙‍♂️', '🧙‍♀️', '🧔', '👩‍🦰', '🐉', '😈', '🐺'];

// Names offered by the "random name" button, per species
export const NAME_IDEAS = {
  dragonborn: ['Arjhan Kepeshkmolik', 'Balasar Yarjerit', 'Kava Myastan', 'Sora Delmirev', 'Rhogar Daardendrian'],
  dwarf: ['Thorin Yunquenegro', 'Brunilda Rocaviva', 'Durgan Barbaférrea', 'Hilda Martillopétreo', 'Gimra Vetaprofunda'],
  elf: ['Aelar Lunaplata', 'Sylwen Hojaverde', 'Thaliel Brisanocturna', 'Naivara Cantoalba', 'Erevan Sombraveloz'],
  gnome: ['Fizwick Tuercaloca', 'Nyx Chisparrápida', 'Boddynock Raízalegre', 'Ellywick Tintineo', 'Orryn Engranajillo'],
  goliath: ['Kavaki Rompecumbres', 'Thalai Vigíanubes', 'Gauthak Piedrafirme', 'Orilo Truenolejano', 'Manneo Pasolargo'],
  halfling: ['Milo Buencamino', 'Rosie Colinaverde', 'Perrin Piesligeros', 'Lidda Tejónalegre', 'Finnan Sotobosque'],
  human: ['Alaric Valdés', 'Mirena Costa', 'Dorian Ferro', 'Isolda Brezo', 'Tomás Rivanegra'],
  orc: ['Grash Colmillorroto', 'Urzoga Puñoférreo', 'Thokk Rajacráneos', 'Baggi Lunarroja', 'Mhurren Lobogrís'],
  tiefling: ['Kairon Ascuanegra', 'Nemeia Velocarmesí', 'Damakos Cuernoviejo', 'Rieta Susurrosombra', 'Mordai Espinaluz']
};
