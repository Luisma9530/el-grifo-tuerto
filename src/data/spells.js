// Cantrips and level 1 spells for the 2024 rules of D&D.
//
// This file includes material from the System Reference Document 5.2.1
// ("SRD 5.2.1") by Wizards of the Coast LLC, available at
// https://www.dndbeyond.com/srd, licensed under the Creative Commons
// Attribution 4.0 International License.
//
// Names are in Spanish and descriptions are our own one-line summaries.
//
// How a spell resolves in the game (`kind`):
//   attack  – the caster rolls a spell attack (d20 + bonus); `damage` on a hit
//   save    – the target rolls a saving throw (`save`) against the caster's DC;
//             `damage` on a failure (`half`: half damage on a success)
//   auto    – always hits (`damage`)
//   heal    – restores `heal` hit points (+ spellcasting modifier if `addMod`)
//   utility – no numbers: the Dungeon Master narrates the effect

const C = 'cantrip';

// [id, name, level, classes, kind, mechanics, description]
const ROWS = [
  // ------------------------------------------------------------------ cantrips
  ['acidSplash', 'Salpicadura de Ácido', C, ['sorcerer', 'wizard'], 'save', { save: 'des', damage: '1d6', type: 'ácido' }, 'Una burbuja de ácido estalla sobre tus enemigos.'],
  ['chillTouch', 'Toque Gélido', C, ['sorcerer', 'warlock', 'wizard'], 'attack', { damage: '1d10', type: 'necrótico' }, 'Un toque de frío sepulcral que impide a la víctima curarse.'],
  ['dancingLights', 'Luces Danzantes', C, ['bard', 'sorcerer', 'wizard'], 'utility', {}, 'Creas hasta cuatro luces flotantes que mueves a voluntad.'],
  ['druidcraft', 'Saber Druídico', C, ['druid'], 'utility', {}, 'Pequeños prodigios naturales: predecir el tiempo, hacer brotar una flor.'],
  ['eldritchBlast', 'Descarga Sobrenatural', C, ['warlock'], 'attack', { damage: '1d10', type: 'fuerza' }, 'Un rayo crepitante de energía de tu patrón.'],
  ['elementalism', 'Elementalismo', C, ['druid', 'sorcerer', 'wizard'], 'utility', {}, 'Controlas un poco de aire, tierra, fuego o agua.'],
  ['fireBolt', 'Descarga de Fuego', C, ['sorcerer', 'wizard'], 'attack', { damage: '1d10', type: 'fuego' }, 'Lanzas una mota de fuego que prende lo inflamable.'],
  ['guidance', 'Guía', C, ['cleric', 'druid'], 'utility', {}, 'Tocas a un aliado: suma 1d4 a una prueba de habilidad.'],
  ['light', 'Luz', C, ['bard', 'cleric', 'sorcerer', 'wizard'], 'utility', {}, 'Un objeto brilla como una antorcha durante una hora.'],
  ['mageHand', 'Mano de Mago', C, ['bard', 'sorcerer', 'warlock', 'wizard'], 'utility', {}, 'Una mano espectral manipula objetos a distancia.'],
  ['mending', 'Remendar', C, ['bard', 'cleric', 'druid', 'sorcerer', 'wizard'], 'utility', {}, 'Reparas una rotura o desgarrón en un objeto.'],
  ['message', 'Mensaje', C, ['bard', 'druid', 'sorcerer', 'wizard'], 'utility', {}, 'Susurras un mensaje que solo oye su destinatario.'],
  ['minorIllusion', 'Ilusión Menor', C, ['bard', 'sorcerer', 'warlock', 'wizard'], 'utility', {}, 'Creas un sonido o la imagen de un objeto.'],
  ['poisonSpray', 'Rociada Venenosa', C, ['druid', 'sorcerer', 'warlock', 'wizard'], 'attack', { damage: '1d12', type: 'veneno' }, 'Proyectas una nube de gas tóxico.'],
  ['prestidigitation', 'Prestidigitación', C, ['bard', 'sorcerer', 'warlock', 'wizard'], 'utility', {}, 'Trucos menores: chispas, limpiar, enfriar, marcar.'],
  ['produceFlame', 'Producir Llama', C, ['druid'], 'attack', { damage: '1d8', type: 'fuego' }, 'Una llama en tu mano que ilumina o que puedes arrojar.'],
  ['rayOfFrost', 'Rayo de Escarcha', C, ['sorcerer', 'wizard'], 'attack', { damage: '1d8', type: 'frío' }, 'Un haz helado que además frena al objetivo.'],
  ['resistance', 'Resistencia', C, ['cleric', 'druid'], 'utility', {}, 'Proteges a un aliado: reduce en 1d4 un tipo de daño.'],
  ['sacredFlame', 'Llama Sagrada', C, ['cleric'], 'save', { save: 'des', damage: '1d8', type: 'radiante' }, 'Un resplandor divino desciende sobre una criatura.'],
  ['shillelagh', 'Shillelagh', C, ['druid'], 'utility', {}, 'Tu garrote o bastón golpea con tu Sabiduría y hace 1d8 de daño.'],
  ['shockingGrasp', 'Agarre Electrizante', C, ['sorcerer', 'wizard'], 'attack', { damage: '1d8', type: 'relámpago' }, 'Una descarga al contacto que deja al enemigo sin reacciones.'],
  ['sorcerousBurst', 'Estallido Hechicero', C, ['sorcerer'], 'attack', { damage: '1d8', type: 'elemental' }, 'Energía hechicera en bruto del tipo que elijas.'],
  ['spareTheDying', 'Estabilizar', C, ['cleric', 'druid'], 'utility', {}, 'Estabilizas a una criatura con 0 puntos de golpe.'],
  ['starryWisp', 'Voluta Estelar', C, ['bard', 'druid'], 'attack', { damage: '1d8', type: 'radiante' }, 'Una mota de luz estelar que hiere y delata al objetivo.'],
  ['thaumaturgy', 'Taumaturgia', C, ['cleric'], 'utility', {}, 'Un pequeño prodigio: voz atronadora, temblores, llamas que cambian.'],
  ['viciousMockery', 'Burla Dañina', C, ['bard'], 'save', { save: 'sab', damage: '1d6', type: 'psíquico' }, 'Insultos cargados de magia que hieren y desconcentran.'],

  // ------------------------------------------------------------------ level 1
  ['alarm', 'Alarma', 1, ['ranger', 'wizard'], 'utility', { ritual: true }, 'Una alarma te avisa si alguien entra en la zona protegida.'],
  ['animalFriendship', 'Amistad con los Animales', 1, ['bard', 'druid', 'ranger'], 'save', { save: 'sab' }, 'Convences a una bestia de que no quieres hacerle daño.'],
  ['bane', 'Perdición', 1, ['bard', 'cleric', 'warlock'], 'save', { save: 'car', concentration: true }, 'Hasta tres enemigos restan 1d4 a sus ataques y salvaciones.'],
  ['bless', 'Bendición', 1, ['cleric', 'paladin'], 'utility', { concentration: true }, 'Hasta tres aliados suman 1d4 a sus ataques y salvaciones.'],
  ['burningHands', 'Manos Ardientes', 1, ['sorcerer', 'wizard'], 'save', { save: 'des', damage: '3d6', type: 'fuego', half: true }, 'Un abanico de llamas brota de tus dedos.'],
  ['charmPerson', 'Hechizar Persona', 1, ['bard', 'druid', 'sorcerer', 'warlock', 'wizard'], 'save', { save: 'sab' }, 'Un humanoide te considera un conocido amistoso.'],
  ['colorSpray', 'Rociada de Color', 1, ['bard', 'sorcerer', 'wizard'], 'save', { save: 'con' }, 'Un estallido de colores ciega a quienes tienes delante.'],
  ['command', 'Orden', 1, ['bard', 'cleric', 'paladin'], 'save', { save: 'sab' }, 'Das una orden de una palabra que la criatura obedece.'],
  ['comprehendLanguages', 'Comprensión Idiomática', 1, ['bard', 'sorcerer', 'warlock', 'wizard'], 'utility', { ritual: true }, 'Entiendes cualquier idioma que oigas o leas.'],
  ['createWater', 'Crear o Destruir Agua', 1, ['cleric', 'druid'], 'utility', {}, 'Creas o haces desaparecer hasta 40 litros de agua.'],
  ['cureWounds', 'Curar Heridas', 1, ['bard', 'cleric', 'druid', 'paladin', 'ranger'], 'heal', { heal: '2d8', addMod: true }, 'Tu toque cierra las heridas de una criatura.'],
  ['detectEvilAndGood', 'Detectar el Bien y el Mal', 1, ['cleric', 'paladin'], 'utility', { concentration: true }, 'Percibes aberraciones, celestiales, infernales y no muertos.'],
  ['detectMagic', 'Detectar Magia', 1, ['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard'], 'utility', { ritual: true, concentration: true }, 'Percibes la presencia de magia a tu alrededor.'],
  ['detectPoison', 'Detectar Venenos y Enfermedades', 1, ['cleric', 'druid', 'paladin', 'ranger'], 'utility', { ritual: true, concentration: true }, 'Percibes venenos, criaturas venenosas y contagios.'],
  ['disguiseSelf', 'Disfrazarse', 1, ['bard', 'sorcerer', 'wizard'], 'utility', {}, 'Cambias tu aspecto, ropa incluida, durante una hora.'],
  ['dissonantWhispers', 'Susurros Disonantes', 1, ['bard'], 'save', { save: 'sab', damage: '3d6', type: 'psíquico', half: true }, 'Una melodía discordante que solo oye tu víctima y la hace huir.'],
  ['divineFavor', 'Favor Divino', 1, ['paladin'], 'utility', {}, 'Tus ataques con arma hacen 1d4 de daño radiante adicional.'],
  ['divineSmite', 'Castigo Divino', 1, ['paladin'], 'auto', { damage: '2d8', type: 'radiante' }, 'Al acertar con un arma, descargas poder radiante sobre el enemigo.'],
  ['entangle', 'Enmarañar', 1, ['druid', 'ranger'], 'save', { save: 'fue', concentration: true }, 'Hierbas y lianas brotan del suelo y atrapan a quien pillan.'],
  ['expeditiousRetreat', 'Retirada Expeditiva', 1, ['sorcerer', 'warlock', 'wizard'], 'utility', { concentration: true }, 'Te permite correr como acción adicional cada turno.'],
  ['faerieFire', 'Fuego Feérico', 1, ['bard', 'druid'], 'save', { save: 'des', concentration: true }, 'Perfilas a los enemigos con luz: es más fácil acertarles.'],
  ['falseLife', 'Falsa Vida', 1, ['sorcerer', 'wizard'], 'utility', {}, 'Ganas 2d4 + 4 puntos de golpe temporales.'],
  ['featherFall', 'Caída de Pluma', 1, ['bard', 'sorcerer', 'wizard'], 'utility', {}, 'Hasta cinco criaturas caen despacio y sin daño.'],
  ['findFamiliar', 'Encontrar Familiar', 1, ['wizard'], 'utility', { ritual: true }, 'Invocas a un espíritu con forma de animal que te sirve.'],
  ['fogCloud', 'Nube de Niebla', 1, ['druid', 'ranger', 'sorcerer', 'wizard'], 'utility', { concentration: true }, 'Una esfera de niebla espesa oculta la zona.'],
  ['goodberry', 'Buenas Bayas', 1, ['druid', 'ranger'], 'utility', {}, 'Creas diez bayas que alimentan y curan 1 punto de golpe cada una.'],
  ['grease', 'Grasa', 1, ['sorcerer', 'wizard'], 'save', { save: 'des' }, 'Cubres el suelo de grasa resbaladiza: quien falle cae.'],
  ['guidingBolt', 'Saeta Guía', 1, ['cleric'], 'attack', { damage: '4d6', type: 'radiante' }, 'Un rayo de luz que hiere y facilita el siguiente ataque.'],
  ['healingWord', 'Palabra de Curación', 1, ['bard', 'cleric', 'druid'], 'heal', { heal: '2d4', addMod: true }, 'Una palabra de aliento cura a distancia.'],
  ['hellishRebuke', 'Reprensión Infernal', 1, ['warlock'], 'save', { save: 'des', damage: '2d10', type: 'fuego', half: true }, 'Envuelves en llamas a quien acaba de herirte.'],
  ['heroism', 'Heroísmo', 1, ['bard', 'paladin'], 'utility', { concentration: true }, 'Un aliado se vuelve inmune al miedo y gana puntos de golpe temporales.'],
  ['hex', 'Maleficio', 1, ['warlock'], 'utility', { concentration: true }, 'Maldices a un enemigo: tus ataques le hacen 1d6 necrótico adicional.'],
  ['hideousLaughter', 'Risa Horrible', 1, ['bard', 'wizard'], 'save', { save: 'sab', concentration: true }, 'La víctima cae al suelo presa de un ataque de risa.'],
  ['huntersMark', 'Marca del Cazador', 1, ['ranger'], 'utility', { concentration: true }, 'Marcas una presa: tus ataques le hacen 1d6 de fuerza adicional.'],
  ['identify', 'Identificar', 1, ['bard', 'wizard'], 'utility', { ritual: true }, 'Descubres las propiedades de un objeto mágico.'],
  ['inflictWounds', 'Infligir Heridas', 1, ['cleric'], 'save', { save: 'con', damage: '2d10', type: 'necrótico', half: true }, 'Tu toque marchita la carne de una criatura.'],
  ['jump', 'Salto', 1, ['druid', 'ranger', 'sorcerer', 'wizard'], 'utility', {}, 'Una criatura puede saltar hasta 9 metros.'],
  ['longstrider', 'Zancada Prodigiosa', 1, ['bard', 'druid', 'ranger', 'wizard'], 'utility', {}, 'La velocidad de una criatura aumenta 3 metros durante una hora.'],
  ['mageArmor', 'Armadura de Mago', 1, ['sorcerer', 'wizard'], 'utility', {}, 'Una fuerza protectora: CA 13 + Destreza sin armadura.'],
  ['magicMissile', 'Proyectil Mágico', 1, ['sorcerer', 'wizard'], 'auto', { damage: '3d4+3', type: 'fuerza' }, 'Tres dardos de fuerza que nunca fallan.'],
  ['protectionEvilGood', 'Protección contra el Bien y el Mal', 1, ['cleric', 'druid', 'paladin', 'warlock', 'wizard'], 'utility', { concentration: true }, 'Proteges a una criatura de seres de otros planos y no muertos.'],
  ['purifyFood', 'Purificar Comida y Bebida', 1, ['cleric', 'druid', 'paladin'], 'utility', { ritual: true }, 'Limpias de veneno y enfermedad la comida y bebida cercanas.'],
  ['rayOfSickness', 'Rayo Nauseabundo', 1, ['sorcerer', 'wizard'], 'attack', { damage: '2d8', type: 'veneno' }, 'Un rayo verdoso que hiere y envenena.'],
  ['sanctuary', 'Santuario', 1, ['cleric'], 'utility', {}, 'Quien quiera atacar a tu protegido debe superar una salvación.'],
  ['shield', 'Escudo', 1, ['sorcerer', 'wizard'], 'utility', {}, 'Una barrera invisible: +5 a la CA hasta tu próximo turno.'],
  ['shieldOfFaith', 'Escudo de la Fe', 1, ['cleric', 'paladin'], 'utility', { concentration: true }, 'Un campo resplandeciente da +2 a la CA de una criatura.'],
  ['silentImage', 'Imagen Silenciosa', 1, ['bard', 'sorcerer', 'wizard'], 'utility', { concentration: true }, 'Creas la imagen de un objeto o criatura, sin sonido.'],
  ['sleep', 'Dormir', 1, ['bard', 'sorcerer', 'wizard'], 'save', { save: 'sab', concentration: true }, 'Las criaturas de la zona caen en un sueño mágico.'],
  ['speakWithAnimals', 'Hablar con los Animales', 1, ['bard', 'druid', 'ranger', 'warlock'], 'utility', { ritual: true }, 'Puedes comunicarte con las bestias durante diez minutos.'],
  ['thunderwave', 'Onda Atronadora', 1, ['bard', 'druid', 'sorcerer', 'wizard'], 'save', { save: 'con', damage: '2d8', type: 'trueno', half: true }, 'Una onda de trueno que hiere y empuja.'],
  ['unseenServant', 'Sirviente Invisible', 1, ['bard', 'warlock', 'wizard'], 'utility', { ritual: true }, 'Una fuerza invisible hace tareas sencillas por ti.']
];

export const SPELLS = ROWS.map(([id, name, level, classes, kind, mechanics, desc]) => ({
  id,
  name,
  level: level === C ? 0 : level,
  classes,
  kind,
  desc,
  ...mechanics
}));

/**
 * Spellcasting at level 1 for each class that has it:
 * spellcasting ability, cantrips known, spells prepared and spell slots.
 * Wizards also keep a spellbook they prepare from; warlock slots return on a short rest.
 */
export const CLASS_SPELLCASTING = {
  bard: { ability: 'car', cantrips: 2, prepared: 4, slots: 2, recovery: 'long' },
  cleric: { ability: 'sab', cantrips: 3, prepared: 4, slots: 2, recovery: 'long' },
  druid: { ability: 'sab', cantrips: 2, prepared: 4, slots: 2, recovery: 'long' },
  paladin: { ability: 'car', cantrips: 0, prepared: 2, slots: 2, recovery: 'long' },
  ranger: { ability: 'sab', cantrips: 0, prepared: 2, slots: 2, recovery: 'long' },
  sorcerer: { ability: 'car', cantrips: 4, prepared: 2, slots: 2, recovery: 'long' },
  warlock: { ability: 'car', cantrips: 2, prepared: 2, slots: 1, recovery: 'short' },
  wizard: { ability: 'int', cantrips: 3, prepared: 4, spellbook: 6, slots: 2, recovery: 'long' }
};

// Origin feat "Magic Initiate": two cantrips and one level 1 spell from a class list.
// The spell can be cast once per long rest without a slot.
export const MAGIC_INITIATE = {
  magicInitiateCleric: { list: 'cleric', ability: 'sab', cantrips: 2, spells: 1 },
  magicInitiateDruid: { list: 'druid', ability: 'sab', cantrips: 2, spells: 1 },
  magicInitiateWizard: { list: 'wizard', ability: 'int', cantrips: 2, spells: 1 }
};

// Cantrips some species know innately: { speciesId: { always: [...], byOption: { optionId: [...] } } }
export const SPECIES_CANTRIPS = {
  elf: { byOption: { drow: ['dancingLights'], high: ['prestidigitation'], wood: ['druidcraft'] } },
  gnome: { byOption: { forest: ['minorIllusion'], rock: ['mending', 'prestidigitation'] } },
  tiefling: { always: ['thaumaturgy'], byOption: { abyssal: ['poisonSpray'], chthonic: ['chillTouch'], infernal: ['fireBolt'] } }
};
