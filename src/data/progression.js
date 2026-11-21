// Level progression (levels 1 to 20) for the 2024 rules of D&D.
//
// This file includes material from the System Reference Document 5.2.1
// ("SRD 5.2.1") by Wizards of the Coast LLC, available at
// https://www.dndbeyond.com/srd, licensed under the Creative Commons
// Attribution 4.0 International License.

/** The game covers the full range of levels. */
export const MAX_LEVEL = 20;

/** Total experience points needed to reach each level. */
export const XP_FOR_LEVEL = {
  1: 0, 2: 300, 3: 900, 4: 2700, 5: 6500,
  6: 14000, 7: 23000, 8: 34000, 9: 48000, 10: 64000,
  11: 85000, 12: 100000, 13: 120000, 14: 140000, 15: 165000,
  16: 195000, 17: 225000, 18: 265000, 19: 305000, 20: 355000
};

export const PROFICIENCY_BY_LEVEL = {
  1: 2, 2: 2, 3: 2, 4: 2,
  5: 3, 6: 3, 7: 3, 8: 3,
  9: 4, 10: 4, 11: 4, 12: 4,
  13: 5, 14: 5, 15: 5, 16: 5,
  17: 6, 18: 6, 19: 6, 20: 6
};

/** Level at which every class chooses its subclass (the SRD offers one per class). */
export const SUBCLASS_LEVEL = 3;

/** Cantrips roll one more damage die at each of these levels (x2, x3, x4). */
export const CANTRIP_UPGRADE_LEVELS = [5, 11, 17];

/** At this level every class gains an Epic Boon feat. */
export const EPIC_BOON_LEVEL = 19;

/** Levels at which each class gains an Ability Score Improvement (level 19 is the Epic Boon). */
export const ASI_LEVELS_BY_CLASS = {
  barbarian: [4, 8, 12, 16],
  bard: [4, 8, 12, 16],
  cleric: [4, 8, 12, 16],
  druid: [4, 8, 12, 16],
  fighter: [4, 6, 8, 12, 14, 16],
  monk: [4, 8, 12, 16],
  paladin: [4, 8, 12, 16],
  ranger: [4, 8, 12, 16],
  rogue: [4, 8, 10, 12, 16],
  sorcerer: [4, 8, 12, 16],
  warlock: [4, 8, 12, 16],
  wizard: [4, 8, 12, 16]
};

/** Epic Boon feats of the SRD 5.2.1. Each one also raises an ability score by 1 (up to 30). */
export const EPIC_BOONS = [
  { id: 'combatProwess', name: 'Don de Destreza en Combate', desc: 'Cuando fallas un ataque puedes convertirlo en un impacto, una vez hasta tu siguiente turno.' },
  { id: 'dimensionalTravel', name: 'Don del Viaje Dimensional', desc: 'Tras atacar o lanzar un conjuro, puedes teletransportarte a un lugar visible cercano.' },
  { id: 'fate', name: 'Don del Destino', desc: 'Puedes sumar o restar 2d4 a una prueba de d20 de una criatura cercana.' },
  { id: 'irresistibleOffense', name: 'Don de la Ofensiva Irresistible', desc: 'Tu daño contundente, cortante y perforante ignora la resistencia, y un 20 natural añade daño extra.' },
  { id: 'spellRecall', name: 'Don de la Memoria Mágica', desc: 'Al gastar un espacio de nivel 1 a 4 tiras 1d4: si sale el nivel del espacio, no lo pierdes.' },
  { id: 'nightSpirit', name: 'Don del Espíritu Nocturno', desc: 'Te fundes con las sombras: invisible en penumbra u oscuridad y resistente a casi todo daño allí.' },
  { id: 'truesight', name: 'Don de la Visión Verdadera', desc: 'Obtienes visión verdadera hasta 18 metros.' }
];

/** Subclass of each class (one per class in the SRD 5.2.1) with its features by level. */
export const SUBCLASSES = {
  barbarian: {
    name: 'Senda del Berserker',
    desc: 'Tu furia se convierte en un frenesí que multiplica el daño.',
    features: { 3: ['Frenesí'], 6: ['Furia Irracional'], 10: ['Represalia'], 14: ['Presencia Intimidante'] }
  },
  bard: {
    name: 'Colegio del Saber',
    desc: 'Más habilidades y palabras cortantes que estropean las tiradas enemigas.',
    features: { 3: ['Competencias Adicionales', 'Palabras Cortantes'], 6: ['Descubrimientos Mágicos'], 14: ['Habilidad sin Par'] }
  },
  cleric: {
    name: 'Dominio de la Vida',
    desc: 'Tus conjuros de curación son más potentes.',
    features: { 3: ['Discípulo de la Vida', 'Conjuros del Dominio de la Vida', 'Preservar la Vida'], 6: ['Sanador Bendito'], 17: ['Curación Suprema'] }
  },
  druid: {
    name: 'Círculo de la Tierra',
    desc: 'La tierra que elijas te concede conjuros adicionales.',
    features: { 3: ['Conjuros del Círculo de la Tierra', 'Ayuda de la Tierra'], 6: ['Recuperación Natural'], 10: ['Protección de la Naturaleza'], 14: ['Santuario de la Naturaleza'] }
  },
  fighter: {
    name: 'Campeón',
    desc: 'Tus ataques son críticos con un 19 o un 20.',
    features: { 3: ['Crítico Mejorado', 'Atleta Excepcional'], 7: ['Estilo de Combate Adicional'], 10: ['Guerrero Heroico'], 15: ['Crítico Superior'], 18: ['Superviviente'] }
  },
  monk: {
    name: 'Guerrero de la Mano Abierta',
    desc: 'Tus golpes derriban, empujan y desequilibran.',
    features: { 3: ['Técnica de la Mano Abierta'], 6: ['Integridad Corporal'], 11: ['Paso Veloz'], 17: ['Palma Temblorosa'] }
  },
  paladin: {
    name: 'Juramento de Devoción',
    desc: 'Armas sagradas y la protección de los más altos ideales.',
    features: { 3: ['Conjuros del Juramento de Devoción', 'Arma Sagrada'], 7: ['Aura de Devoción'], 15: ['Castigo Protector'], 20: ['Halo Sagrado'] }
  },
  ranger: {
    name: 'Cazador',
    desc: 'Conoces las debilidades de tu presa y la castigas.',
    features: { 3: ['Saber del Cazador', 'Presa del Cazador'], 7: ['Tácticas Defensivas'], 11: ['Presa Superior del Cazador'], 15: ['Defensa Superior del Cazador'] }
  },
  rogue: {
    name: 'Ladrón',
    desc: 'Manos rápidas, trepar como nadie y usar objetos en un suspiro.',
    features: { 3: ['Manos Rápidas', 'Trabajo en las Alturas'], 9: ['Sigilo Supremo'], 13: ['Usar Objeto Mágico'], 17: ['Reflejos de Ladrón'] }
  },
  sorcerer: {
    name: 'Hechicería Dracónica',
    desc: 'Sangre de dragón: más resistente y con conjuros dracónicos.',
    features: { 3: ['Resistencia Dracónica', 'Conjuros Dracónicos'], 6: ['Afinidad Elemental'], 14: ['Alas de Dragón'], 18: ['Compañero Dragón'] }
  },
  warlock: {
    name: 'Patrón Infernal',
    desc: 'Un pacto con un señor de los Planos Inferiores.',
    features: { 3: ['Bendición del Oscuro', 'Conjuros del Infernal'], 6: ['Suerte del Propio Oscuro'], 10: ['Resiliencia Infernal'], 14: ['Arrojar al Infierno'] }
  },
  wizard: {
    name: 'Evocador',
    desc: 'Maestro de los conjuros de daño, que puedes moldear para no herir a tus aliados.',
    features: { 3: ['Sabio de la Evocación', 'Truco Potente'], 6: ['Esculpir Conjuros'], 10: ['Evocación Potenciada'], 14: ['Sobrecanalizar'] }
  }
};

/**
 * Class features gained at each level after the first. The subclass and its features,
 * the Ability Score Improvements and the Epic Boon are added from the tables above.
 */
export const CLASS_FEATURES = {
  barbarian: {
    2: ['Ataque Temerario', 'Sentido del Peligro'],
    3: ['Conocimiento Primigenio'],
    5: ['Ataque Adicional', 'Movimiento Rápido'],
    7: ['Instinto Salvaje', 'Abalanzarse Instintivo'],
    9: ['Golpe Brutal'],
    11: ['Furia Implacable'],
    13: ['Golpe Brutal Mejorado'],
    15: ['Furia Persistente'],
    17: ['Golpe Brutal Mejorado (II)'],
    18: ['Poderío Indómito'],
    20: ['Campeón Primigenio']
  },
  bard: {
    2: ['Pericia', 'Aprendiz de Todo'],
    5: ['Fuente de Inspiración'],
    7: ['Contraencantamiento'],
    9: ['Pericia adicional'],
    10: ['Secretos Mágicos'],
    18: ['Inspiración Superior'],
    20: ['Palabras de Creación']
  },
  cleric: {
    2: ['Canalizar Divinidad'],
    5: ['Abrasar Muertos Vivientes'],
    7: ['Golpes Benditos'],
    10: ['Intervención Divina'],
    14: ['Golpes Benditos Mejorados'],
    20: ['Intervención Divina Mayor']
  },
  druid: {
    2: ['Forma Salvaje', 'Compañero Salvaje'],
    5: ['Resurgir Salvaje'],
    7: ['Furia Elemental'],
    15: ['Furia Elemental Mejorada'],
    18: ['Conjuros Bestiales'],
    20: ['Archidruida']
  },
  fighter: {
    2: ['Oleada de Acción', 'Mente Táctica'],
    5: ['Ataque Adicional', 'Reposicionamiento Táctico'],
    9: ['Indomable', 'Maestro Táctico'],
    11: ['Dos Ataques Adicionales'],
    13: ['Indomable (dos usos)', 'Ataques Estudiados'],
    17: ['Oleada de Acción (dos usos)', 'Indomable (tres usos)'],
    20: ['Tres Ataques Adicionales']
  },
  monk: {
    2: ['Concentración del Monje', 'Movimiento sin Armadura', 'Metabolismo Asombroso'],
    3: ['Desviar Ataques'],
    4: ['Caída Lenta'],
    5: ['Ataque Adicional', 'Golpe Aturdidor'],
    6: ['Golpes Potenciados'],
    7: ['Evasión'],
    9: ['Movimiento Acrobático'],
    10: ['Concentración Elevada', 'Autorrestauración'],
    13: ['Desviar Energía'],
    14: ['Superviviente Disciplinado'],
    15: ['Concentración Perfecta'],
    18: ['Defensa Superior'],
    20: ['Cuerpo y Mente']
  },
  paladin: {
    2: ['Estilo de Combate', 'Castigo del Paladín'],
    3: ['Canalizar Divinidad'],
    5: ['Ataque Adicional', 'Corcel Fiel'],
    6: ['Aura de Protección'],
    9: ['Abjurar Enemigos'],
    10: ['Aura de Valor'],
    11: ['Golpes Radiantes'],
    14: ['Toque Restaurador'],
    18: ['Expansión de Aura']
  },
  ranger: {
    2: ['Explorador Diestro', 'Estilo de Combate'],
    5: ['Ataque Adicional'],
    6: ['Errante'],
    9: ['Pericia'],
    10: ['Incansable'],
    13: ['Cazador Implacable'],
    14: ['Velo de la Naturaleza'],
    17: ['Cazador Preciso'],
    18: ['Sentidos Salvajes'],
    20: ['Asesino de Enemigos']
  },
  rogue: {
    2: ['Acción Astuta'],
    3: ['Puntería Firme'],
    5: ['Golpe Astuto', 'Esquiva Asombrosa'],
    6: ['Pericia adicional'],
    7: ['Evasión', 'Talento Fiable'],
    11: ['Golpe Astuto Mejorado'],
    14: ['Golpes Taimados'],
    15: ['Mente Escurridiza'],
    18: ['Escurridizo'],
    20: ['Golpe de Suerte']
  },
  sorcerer: {
    2: ['Fuente de Magia', 'Metamagia'],
    5: ['Restauración Hechicera'],
    7: ['Hechicería Encarnada'],
    10: ['Metamagia adicional'],
    17: ['Metamagia adicional (II)'],
    20: ['Apoteosis Arcana']
  },
  warlock: {
    2: ['Astucia Mágica'],
    9: ['Contactar con el Patrón'],
    11: ['Arcano Místico (nivel 6)'],
    13: ['Arcano Místico (nivel 7)'],
    15: ['Arcano Místico (nivel 8)'],
    17: ['Arcano Místico (nivel 9)'],
    20: ['Maestro Sobrenatural']
  },
  wizard: {
    2: ['Erudito'],
    5: ['Memorizar Conjuro'],
    18: ['Dominio de Conjuros'],
    20: ['Conjuros Característicos']
  }
};

/** Short description of every feature named in CLASS_FEATURES and SUBCLASSES. */
export const FEATURE_INFO = {
  // Shared
  'Ataque Adicional': 'Atacas dos veces cuando usas la acción de Atacar.',
  'Estilo de Combate': 'Eliges una especialidad de combate que mejora tu forma de luchar.',
  'Canalizar Divinidad': 'Canalizas poder divino para producir efectos especiales unas pocas veces por descanso.',
  'Pericia': 'Duplicas tu bonificador de competencia en dos habilidades que elijas.',
  'Pericia adicional': 'Eliges otras dos habilidades en las que duplicas tu bonificador de competencia.',
  'Evasión': 'Si una salvación de Destreza te deja a mitad de daño, no recibes ninguno; si fallas, solo la mitad.',

  // Barbarian
  'Ataque Temerario': 'Atacas con ventaja usando Fuerza, pero los ataques contra ti también la tienen hasta tu siguiente turno.',
  'Sentido del Peligro': 'Tienes ventaja en las salvaciones de Destreza mientras no estés incapacitado.',
  'Conocimiento Primigenio': 'Ganas una habilidad más y puedes usar Fuerza en ciertas pruebas mientras estás en furia.',
  'Movimiento Rápido': 'Tu velocidad aumenta 3 metros si no llevas armadura pesada.',
  'Instinto Salvaje': 'Tienes ventaja en las tiradas de iniciativa.',
  'Abalanzarse Instintivo': 'Al entrar en furia puedes moverte la mitad de tu velocidad.',
  'Golpe Brutal': 'Renuncias a la ventaja de un ataque temerario para causar más daño y un efecto adicional.',
  'Furia Implacable': 'Si caes a 0 PG en furia, puedes superar una salvación para quedarte en pie.',
  'Golpe Brutal Mejorado': 'Tu Golpe Brutal gana nuevos efectos para elegir.',
  'Golpe Brutal Mejorado (II)': 'Tu Golpe Brutal hace aún más daño y aplica dos efectos a la vez.',
  'Furia Persistente': 'Recuperas la furia al tirar iniciativa y tu furia dura mucho más sin mantenerla.',
  'Poderío Indómito': 'Si tu prueba de Fuerza da menos que tu puntuación de Fuerza, usas la puntuación.',
  'Campeón Primigenio': 'Tu Fuerza y tu Constitución aumentan en 4, hasta un máximo de 25.',
  'Frenesí': 'Mientras estás en furia, tu primer ataque temerario del turno hace daño adicional.',
  'Furia Irracional': 'En furia no puedes ser hechizado ni asustado.',
  'Represalia': 'Cuando una criatura cercana te daña, puedes atacarla como reacción.',
  'Presencia Intimidante': 'Puedes asustar a las criaturas que elijas a tu alrededor.',

  // Bard
  'Aprendiz de Todo': 'Sumas la mitad de tu competencia a las pruebas en las que no eres competente.',
  'Fuente de Inspiración': 'Recuperas la Inspiración Bárdica en descansos cortos y gastando espacios de conjuro.',
  'Contraencantamiento': 'Permites repetir una salvación contra hechizado o asustado, con ventaja.',
  'Secretos Mágicos': 'Puedes preparar conjuros de las listas de bardo, clérigo, druida y mago.',
  'Inspiración Superior': 'Al tirar iniciativa recuperas usos de Inspiración Bárdica.',
  'Palabras de Creación': 'Siempre tienes preparados Palabra de poder: sanar y Palabra de poder: matar, y afectan a dos criaturas.',
  'Competencias Adicionales': 'Ganas competencia en tres habilidades a tu elección.',
  'Palabras Cortantes': 'Usas tu Inspiración Bárdica para restar a la tirada o al daño de un enemigo.',
  'Descubrimientos Mágicos': 'Aprendes dos conjuros de las listas de clérigo, druida o mago.',
  'Habilidad sin Par': 'Si fallas una prueba o un ataque, puedes sumar un dado de inspiración.',

  // Cleric
  'Abrasar Muertos Vivientes': 'Al expulsar muertos vivientes, además les causas daño radiante.',
  'Golpes Benditos': 'Tus ataques con arma o tus trucos causan daño divino adicional.',
  'Intervención Divina': 'Una vez por descanso largo lanzas un conjuro de clérigo de nivel 5 o menor sin espacio.',
  'Golpes Benditos Mejorados': 'El daño extra de tus Golpes Benditos aumenta.',
  'Intervención Divina Mayor': 'Tu Intervención Divina puede lanzar Deseo.',
  'Discípulo de la Vida': 'Tus conjuros de curación restauran puntos de golpe adicionales.',
  'Conjuros del Dominio de la Vida': 'Siempre tienes preparados ciertos conjuros de curación y protección.',
  'Preservar la Vida': 'Canalizas divinidad para repartir curación entre las criaturas cercanas.',
  'Sanador Bendito': 'Al curar a otros con un conjuro, tú también recuperas puntos de golpe.',
  'Curación Suprema': 'Tus dados de curación dan siempre el valor máximo.',

  // Druid
  'Forma Salvaje': 'Te transformas en una bestia que hayas visto.',
  'Compañero Salvaje': 'Gastas un uso de Forma Salvaje o un espacio para invocar un familiar feérico.',
  'Resurgir Salvaje': 'Intercambias espacios de conjuro y usos de Forma Salvaje entre sí.',
  'Furia Elemental': 'Sumas tu Sabiduría al daño de tus trucos o tus golpes causan 1d8 de daño elemental adicional.',
  'Furia Elemental Mejorada': 'Tus trucos ganan mucho alcance o tu daño elemental adicional sube a 2d8.',
  'Conjuros Bestiales': 'Puedes lanzar conjuros mientras estás en Forma Salvaje.',
  'Archidruida': 'Recuperas Forma Salvaje al tirar iniciativa, conviertes formas en espacios y envejeces más despacio.',
  'Conjuros del Círculo de la Tierra': 'Según el terreno elegido, siempre tienes preparados conjuros extra.',
  'Ayuda de la Tierra': 'Gastas Forma Salvaje para dañar a enemigos y curar a aliados en un área.',
  'Recuperación Natural': 'Recuperas espacios de conjuro durante un descanso corto.',
  'Protección de la Naturaleza': 'No puedes ser envenenado y resistes un tipo de daño ligado a tu tierra.',
  'Santuario de la Naturaleza': 'Creas una zona de árboles espectrales que protege a tus aliados.',

  // Fighter
  'Oleada de Acción': 'Una vez por descanso, obtienes una acción adicional en tu turno.',
  'Mente Táctica': 'Gastas Tomar Aliento para sumar a una prueba de característica fallida.',
  'Reposicionamiento Táctico': 'Al usar Tomar Aliento, te mueves sin provocar ataques de oportunidad.',
  'Indomable': 'Repites una salvación fallada sumando tu nivel de guerrero.',
  'Maestro Táctico': 'Puedes cambiar la maestría de tu arma por otras al atacar.',
  'Dos Ataques Adicionales': 'Atacas tres veces cuando usas la acción de Atacar.',
  'Indomable (dos usos)': 'Puedes usar Indomable dos veces entre descansos largos.',
  'Ataques Estudiados': 'Si fallas un ataque, tienes ventaja en el siguiente contra ese objetivo.',
  'Oleada de Acción (dos usos)': 'Puedes usar Oleada de Acción dos veces entre descansos, una por turno.',
  'Indomable (tres usos)': 'Puedes usar Indomable tres veces entre descansos largos.',
  'Tres Ataques Adicionales': 'Atacas cuatro veces cuando usas la acción de Atacar.',
  'Crítico Mejorado': 'Tus ataques con armas son críticos con un 19 o un 20.',
  'Atleta Excepcional': 'Ventaja en iniciativa y Atletismo, y te mueves tras un crítico.',
  'Estilo de Combate Adicional': 'Eliges un segundo estilo de combate.',
  'Guerrero Heroico': 'Al inicio de cada turno en combate obtienes Inspiración Heroica si no la tienes.',
  'Crítico Superior': 'Tus ataques con armas son críticos con un 18, 19 o 20.',
  'Superviviente': 'Ventaja en salvaciones contra muerte y te curas cada turno cuando estás malherido.',

  // Monk
  'Concentración del Monje': 'Obtienes puntos de concentración para Ráfaga de Golpes, Defensa Paciente y Paso del Viento.',
  'Movimiento sin Armadura': 'Tu velocidad aumenta mientras no llevas armadura ni escudo.',
  'Metabolismo Asombroso': 'Al tirar iniciativa recuperas tus puntos de concentración y algo de vida.',
  'Desviar Ataques': 'Reduces el daño de un ataque que te alcanza y puedes devolverlo.',
  'Caída Lenta': 'Reduces mucho el daño de una caída como reacción.',
  'Golpe Aturdidor': 'Gastas concentración para intentar aturdir a quien golpeas.',
  'Golpes Potenciados': 'Tus golpes sin armas pueden causar daño de fuerza.',
  'Movimiento Acrobático': 'Corres por superficies verticales y sobre líquidos durante tu turno.',
  'Concentración Elevada': 'Ráfaga de Golpes, Defensa Paciente y Paso del Viento se vuelven más potentes.',
  'Autorrestauración': 'Te libras de estar hechizado, asustado o envenenado y no sufres cansancio por hambre o sed.',
  'Desviar Energía': 'Desviar Ataques funciona contra cualquier tipo de daño.',
  'Superviviente Disciplinado': 'Eres competente en todas las salvaciones y puedes repetir las fallidas.',
  'Concentración Perfecta': 'Al tirar iniciativa con pocos puntos de concentración, recuperas varios.',
  'Defensa Superior': 'Gastas concentración para resistir todo el daño salvo el de fuerza durante un minuto.',
  'Cuerpo y Mente': 'Tu Destreza y tu Sabiduría aumentan en 4, hasta un máximo de 25.',
  'Técnica de la Mano Abierta': 'Tu Ráfaga de Golpes puede derribar, empujar o impedir reacciones.',
  'Integridad Corporal': 'Como acción adicional, te curas varias veces por descanso largo.',
  'Paso Veloz': 'Tras una acción adicional, puedes usar también Paso del Viento.',
  'Palma Temblorosa': 'Siembras vibraciones letales en una criatura que puedes activar después.',

  // Paladin
  'Castigo del Paladín': 'Siempre tienes preparado Castigo Divino y puedes lanzarlo una vez gratis.',
  'Corcel Fiel': 'Siempre tienes preparado Encontrar Corcel y puedes lanzarlo una vez gratis.',
  'Aura de Protección': 'Tú y tus aliados cercanos sumáis tu Carisma a las salvaciones.',
  'Abjurar Enemigos': 'Canalizas divinidad para asustar a enemigos cercanos.',
  'Aura de Valor': 'Tú y tus aliados en tu aura no podéis ser asustados.',
  'Golpes Radiantes': 'Tus ataques con arma causan 1d8 de daño radiante extra.',
  'Toque Restaurador': 'Tu Imposición de Manos también elimina estados como cegado o paralizado.',
  'Expansión de Aura': 'Tus auras alcanzan 9 metros.',
  'Conjuros del Juramento de Devoción': 'Siempre tienes preparados conjuros ligados a tu juramento.',
  'Arma Sagrada': 'Imbuyes tu arma de luz y le sumas tu Carisma a los ataques.',
  'Aura de Devoción': 'Tú y tus aliados en tu aura no podéis ser hechizados.',
  'Castigo Protector': 'Al usar Castigo Divino, tus aliados en el aura obtienen media cobertura.',
  'Halo Sagrado': 'Tu aura se llena de luz solar que quema a los enemigos y te da ventaja en salvaciones contra infernales y muertos vivientes.',

  // Ranger
  'Explorador Diestro': 'Ganas pericia en una habilidad y aprendes dos idiomas.',
  'Errante': 'Tu velocidad aumenta y ganas velocidad de trepar y nadar.',
  'Incansable': 'Ganas puntos de golpe temporales y descansar te quita cansancio.',
  'Cazador Implacable': 'Recibir daño no rompe tu concentración en Marca del Cazador.',
  'Velo de la Naturaleza': 'Te vuelves invisible hasta el final de tu siguiente turno.',
  'Cazador Preciso': 'Tienes ventaja al atacar a la criatura marcada por tu Marca del Cazador.',
  'Sentidos Salvajes': 'Obtienes vista ciega hasta 9 metros.',
  'Asesino de Enemigos': 'El dado de daño de tu Marca del Cazador pasa a ser un d10.',
  'Saber del Cazador': 'Conoces las inmunidades, resistencias y vulnerabilidades de tu presa marcada.',
  'Presa del Cazador': 'Eliges una técnica de caza: Asesino de Colosos o Rompehordas.',
  'Tácticas Defensivas': 'Eliges una defensa: Escapar de la Horda o Defensa contra Ataques Múltiples.',
  'Presa Superior del Cazador': 'El daño de tu Marca del Cazador salta a otra criatura cercana.',
  'Defensa Superior del Cazador': 'Cuando recibes daño, puedes resistir ese tipo de daño hasta tu siguiente turno.',

  // Rogue
  'Acción Astuta': 'Puedes Correr, Retirarte u Ocultarte como acción adicional.',
  'Puntería Firme': 'Renuncias a moverte para tener ventaja en tu siguiente ataque.',
  'Golpe Astuto': 'Cambias dados de Ataque Furtivo por efectos como envenenar o derribar.',
  'Esquiva Asombrosa': 'Reduces a la mitad el daño de un ataque que ves venir.',
  'Talento Fiable': 'En pruebas de habilidades en las que eres competente, un 9 o menos cuenta como 10.',
  'Golpe Astuto Mejorado': 'Puedes aplicar dos efectos de Golpe Astuto a la vez.',
  'Golpes Taimados': 'Nuevos efectos de Golpe Astuto: aturdir, dejar inconsciente u ofuscar.',
  'Mente Escurridiza': 'Eres competente en salvaciones de Sabiduría y Carisma.',
  'Escurridizo': 'Ningún ataque contra ti tiene ventaja mientras no estés incapacitado.',
  'Golpe de Suerte': 'Una vez por descanso, conviertes una prueba de d20 fallida en un 20.',
  'Manos Rápidas': 'Usas Juego de Manos, herramientas u objetos como acción adicional.',
  'Trabajo en las Alturas': 'Trepas a velocidad normal y saltas más lejos usando Destreza.',
  'Sigilo Supremo': 'Ganas un Golpe Astuto que te mantiene oculto al atacar.',
  'Usar Objeto Mágico': 'Puedes vincularte a más objetos mágicos y usar pergaminos de conjuro.',
  'Reflejos de Ladrón': 'Haces dos turnos en la primera ronda de cada combate.',

  // Sorcerer
  'Fuente de Magia': 'Obtienes puntos de hechicería que puedes convertir en espacios de conjuro y viceversa.',
  'Metamagia': 'Aprendes opciones para alterar tus conjuros gastando puntos de hechicería.',
  'Restauración Hechicera': 'En un descanso corto recuperas algunos puntos de hechicería.',
  'Hechicería Encarnada': 'Puedes activar Hechicería Innata con puntos y usar dos metamagias en un conjuro.',
  'Metamagia adicional': 'Aprendes dos opciones de Metamagia más.',
  'Metamagia adicional (II)': 'Aprendes otras dos opciones de Metamagia.',
  'Apoteosis Arcana': 'Durante tu Hechicería Innata puedes aplicar una Metamagia gratis cada turno.',
  'Resistencia Dracónica': 'Tu vida máxima aumenta y tu piel escamosa te da una buena CA sin armadura.',
  'Conjuros Dracónicos': 'Siempre tienes preparados ciertos conjuros de temática dracónica.',
  'Afinidad Elemental': 'Resistes un tipo de daño y sumas tu Carisma al daño de ese tipo.',
  'Alas de Dragón': 'Despliegas alas que te dan velocidad de vuelo.',
  'Compañero Dragón': 'Puedes invocar un dragón aliado sin componente material.',

  // Warlock
  'Astucia Mágica': 'Con un breve ritual recuperas espacios de Magia de Pacto.',
  'Contactar con el Patrón': 'Siempre tienes preparado Contactar con otro Plano y puedes hablar con tu patrón.',
  'Arcano Místico (nivel 6)': 'Aprendes un conjuro de nivel 6 que lanzas una vez por descanso largo sin espacio.',
  'Arcano Místico (nivel 7)': 'Aprendes un conjuro de nivel 7 que lanzas una vez por descanso largo sin espacio.',
  'Arcano Místico (nivel 8)': 'Aprendes un conjuro de nivel 8 que lanzas una vez por descanso largo sin espacio.',
  'Arcano Místico (nivel 9)': 'Aprendes un conjuro de nivel 9 que lanzas una vez por descanso largo sin espacio.',
  'Maestro Sobrenatural': 'Al usar Astucia Mágica recuperas todos tus espacios de Magia de Pacto.',
  'Bendición del Oscuro': 'Ganas puntos de golpe temporales cuando reduces a un enemigo a 0 PG.',
  'Conjuros del Infernal': 'Siempre tienes preparados ciertos conjuros infernales.',
  'Suerte del Propio Oscuro': 'Sumas 1d10 a una prueba de característica o salvación.',
  'Resiliencia Infernal': 'Tras cada descanso eliges un tipo de daño al que eres resistente.',
  'Arrojar al Infierno': 'Envías a quien golpeas a un viaje por los Planos Inferiores que lo daña.',

  // Wizard
  'Erudito': 'Ganas pericia en una habilidad de saber: Arcanos, Historia, Investigación, Medicina, Naturaleza o Religión.',
  'Memorizar Conjuro': 'En un descanso corto cambias un conjuro preparado por otro de tu libro.',
  'Dominio de Conjuros': 'Lanzas a voluntad un conjuro de nivel 1 y otro de nivel 2 sin gastar espacios.',
  'Conjuros Característicos': 'Dos conjuros de nivel 3 siempre preparados que lanzas una vez gratis por descanso.',
  'Sabio de la Evocación': 'Añades conjuros de evocación gratis a tu libro.',
  'Truco Potente': 'Tus trucos de daño causan la mitad de daño aunque falles o el objetivo salve.',
  'Esculpir Conjuros': 'Proteges a algunas criaturas del efecto de tus conjuros de evocación.',
  'Evocación Potenciada': 'Sumas tu Inteligencia al daño de tus conjuros de evocación.',
  'Sobrecanalizar': 'Tus conjuros de daño de nivel 1 a 5 hacen el máximo, a costa de dañarte si repites.'
};

// --- Spell slots -------------------------------------------------------------
// { characterLevel: { spellLevel: slots } }

const FULL_CASTER = {
  1: { 1: 2 },
  2: { 1: 3 },
  3: { 1: 4, 2: 2 },
  4: { 1: 4, 2: 3 },
  5: { 1: 4, 2: 3, 3: 2 },
  6: { 1: 4, 2: 3, 3: 3 },
  7: { 1: 4, 2: 3, 3: 3, 4: 1 },
  8: { 1: 4, 2: 3, 3: 3, 4: 2 },
  9: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  10: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  11: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  12: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  13: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  14: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  15: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
  18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 },
  19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
  20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 }
};

// Paladins and rangers (2024): slots from level 1, up to spell level 5
const HALF_CASTER = {
  1: { 1: 2 },
  2: { 1: 2 },
  3: { 1: 3 },
  4: { 1: 3 },
  5: { 1: 4, 2: 2 },
  6: { 1: 4, 2: 2 },
  7: { 1: 4, 2: 3 },
  8: { 1: 4, 2: 3 },
  9: { 1: 4, 2: 3, 3: 2 },
  10: { 1: 4, 2: 3, 3: 2 },
  11: { 1: 4, 2: 3, 3: 3 },
  12: { 1: 4, 2: 3, 3: 3 },
  13: { 1: 4, 2: 3, 3: 3, 4: 1 },
  14: { 1: 4, 2: 3, 3: 3, 4: 1 },
  15: { 1: 4, 2: 3, 3: 3, 4: 2 },
  16: { 1: 4, 2: 3, 3: 3, 4: 2 },
  17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }
};

// Pact Magic: few slots, all of the same level, back on a short rest
const PACT_MAGIC = {
  1: { 1: 1 },
  2: { 1: 2 },
  3: { 2: 2 },
  4: { 2: 2 },
  5: { 3: 2 },
  6: { 3: 2 },
  7: { 4: 2 },
  8: { 4: 2 },
  9: { 5: 2 },
  10: { 5: 2 },
  11: { 5: 3 },
  12: { 5: 3 },
  13: { 5: 3 },
  14: { 5: 3 },
  15: { 5: 3 },
  16: { 5: 3 },
  17: { 5: 4 },
  18: { 5: 4 },
  19: { 5: 4 },
  20: { 5: 4 }
};

// Prepared spells shared by the bard, cleric and druid (and the sorcerer from level 3)
const FULL_PREPARED = [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];
const HALF_PREPARED = [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15];

/** Cantrips by level: `base` at level 1, +1 at level 4 and +1 at level 10. */
const cantripsFrom = base => Array.from({ length: 20 }, (_, i) => base + (i + 1 >= 4 ? 1 : 0) + (i + 1 >= 10 ? 1 : 0));

/**
 * Spellcasting of each class by level (arrays indexed by level - 1):
 * slots table, when slots return, and cantrips / prepared spells at each level.
 * Wizards also grow a spellbook (`spellbook`), from which they prepare.
 * Warlocks gain a Mystic Arcanum (character level -> spell level), cast once per long rest without a slot.
 */
export const SPELL_PROGRESSION = {
  bard: { slots: FULL_CASTER, recovery: 'long', cantrips: cantripsFrom(2), prepared: [...FULL_PREPARED] },
  cleric: { slots: FULL_CASTER, recovery: 'long', cantrips: cantripsFrom(3), prepared: [...FULL_PREPARED] },
  druid: { slots: FULL_CASTER, recovery: 'long', cantrips: cantripsFrom(2), prepared: [...FULL_PREPARED] },
  sorcerer: {
    slots: FULL_CASTER, recovery: 'long', cantrips: cantripsFrom(4),
    prepared: [2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22]
  },
  wizard: {
    slots: FULL_CASTER, recovery: 'long', cantrips: cantripsFrom(3),
    prepared: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25],
    spellbook: Array.from({ length: 20 }, (_, i) => 6 + 2 * i)
  },
  paladin: { slots: HALF_CASTER, recovery: 'long', cantrips: Array(20).fill(0), prepared: [...HALF_PREPARED] },
  ranger: { slots: HALF_CASTER, recovery: 'long', cantrips: Array(20).fill(0), prepared: [...HALF_PREPARED] },
  warlock: {
    slots: PACT_MAGIC, recovery: 'short', cantrips: cantripsFrom(2),
    prepared: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
    mysticArcanum: { 11: 6, 13: 7, 15: 8, 17: 9 }
  }
};
