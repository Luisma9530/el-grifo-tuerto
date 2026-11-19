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
  ['unseenServant', 'Sirviente Invisible', 1, ['bard', 'warlock', 'wizard'], 'utility', { ritual: true }, 'Una fuerza invisible hace tareas sencillas por ti.'],

  // ------------------------------------------------------------------ level 2
  ['aid', 'Auxilio', 2, ['bard', 'cleric', 'druid', 'paladin', 'ranger'], 'utility', {}, 'Tres criaturas ganan 5 puntos de golpe máximos durante ocho horas.'],
  ['barkskin', 'Piel Robliza', 2, ['druid', 'ranger'], 'utility', {}, 'La piel de una criatura se endurece: su CA no baja de 17.'],
  ['blindnessDeafness', 'Ceguera/Sordera', 2, ['bard', 'cleric', 'sorcerer', 'wizard'], 'save', { save: 'con' }, 'Dejas ciega o sorda a una criatura.'],
  ['blur', 'Contorno Borroso', 2, ['sorcerer', 'wizard'], 'utility', { concentration: true }, 'Tu silueta se difumina: los ataques contra ti tienen desventaja.'],
  ['darkness', 'Oscuridad', 2, ['sorcerer', 'warlock', 'wizard'], 'utility', { concentration: true }, 'Una esfera de oscuridad mágica que ninguna luz normal atraviesa.'],
  ['darkvision', 'Visión en la Oscuridad', 2, ['druid', 'ranger', 'sorcerer', 'wizard'], 'utility', {}, 'Una criatura ve en la oscuridad durante ocho horas.'],
  ['detectThoughts', 'Detectar Pensamientos', 2, ['bard', 'sorcerer', 'wizard'], 'save', { save: 'sab', concentration: true }, 'Lees los pensamientos superficiales de quienes te rodean.'],
  ['enhanceAbility', 'Potenciar Característica', 2, ['bard', 'cleric', 'druid', 'ranger', 'sorcerer', 'wizard'], 'utility', { concentration: true }, 'Una criatura tiene ventaja en las pruebas de una característica.'],
  ['findSteed', 'Encontrar Corcel', 2, ['paladin'], 'utility', {}, 'Invocas a un espíritu con forma de montura leal.'],
  ['flamingSphere', 'Esfera de Llamas', 2, ['druid', 'sorcerer', 'wizard'], 'save', { save: 'des', damage: '2d6', type: 'fuego', half: true, concentration: true }, 'Una bola de fuego rodante que diriges contra tus enemigos.'],
  ['heatMetal', 'Calentar Metal', 2, ['bard', 'druid'], 'auto', { damage: '2d8', type: 'fuego', concentration: true }, 'Pones al rojo vivo un objeto de metal, como un arma o una armadura.'],
  ['holdPerson', 'Inmovilizar Persona', 2, ['bard', 'cleric', 'druid', 'sorcerer', 'warlock', 'wizard'], 'save', { save: 'sab', concentration: true }, 'Un humanoide queda paralizado.'],
  ['invisibility', 'Invisibilidad', 2, ['bard', 'sorcerer', 'warlock', 'wizard'], 'utility', { concentration: true }, 'Una criatura se vuelve invisible hasta que ataque o lance un conjuro.'],
  ['knock', 'Apertura', 2, ['bard', 'sorcerer', 'wizard'], 'utility', {}, 'Abres una cerradura, un candado o una puerta atrancada, con un golpe sonoro.'],
  ['lesserRestoration', 'Restablecimiento Menor', 2, ['bard', 'cleric', 'druid', 'paladin', 'ranger'], 'utility', {}, 'Curas una enfermedad o una condición: cegado, ensordecido, paralizado o envenenado.'],
  ['levitate', 'Levitar', 2, ['sorcerer', 'wizard'], 'save', { save: 'con', concentration: true }, 'Una criatura u objeto se eleva hasta 6 metros del suelo.'],
  ['magicWeapon', 'Arma Mágica', 2, ['paladin', 'ranger', 'sorcerer', 'wizard'], 'utility', {}, 'Un arma se vuelve mágica: +1 al ataque y al daño.'],
  ['mirrorImage', 'Imagen Múltiple', 2, ['bard', 'sorcerer', 'warlock', 'wizard'], 'utility', {}, 'Tres duplicados ilusorios confunden a quien te ataca.'],
  ['mistyStep', 'Paso Brumoso', 2, ['sorcerer', 'warlock', 'wizard'], 'utility', {}, 'Te teletransportas hasta 9 metros envuelto en niebla plateada.'],
  ['moonbeam', 'Rayo de Luna', 2, ['druid'], 'save', { save: 'con', damage: '2d10', type: 'radiante', half: true, concentration: true }, 'Un haz de luz pálida abrasa a quien lo pisa.'],
  ['passWithoutTrace', 'Pasar sin Rastro', 2, ['druid', 'ranger'], 'utility', { concentration: true }, 'Tú y tus aliados sumáis +10 al Sigilo y no dejáis huellas.'],
  ['prayerOfHealing', 'Plegaria de Curación', 2, ['cleric', 'paladin'], 'heal', { heal: '2d8' }, 'Diez minutos de oración que curan a los presentes.'],
  ['rayOfEnfeeblement', 'Rayo Debilitador', 2, ['warlock', 'wizard'], 'save', { save: 'con', concentration: true }, 'Un rayo negro que deja sin fuerzas a tu enemigo.'],
  ['scorchingRay', 'Rayo Abrasador', 2, ['sorcerer', 'wizard'], 'attack', { damage: '6d6', type: 'fuego' }, 'Tres rayos de fuego contra uno o varios objetivos.'],
  ['shatter', 'Estallar', 2, ['bard', 'sorcerer', 'wizard'], 'save', { save: 'con', damage: '3d8', type: 'trueno', half: true }, 'Un estruendo que hiere y hace añicos los objetos.'],
  ['silence', 'Silencio', 2, ['bard', 'cleric', 'ranger'], 'utility', { ritual: true, concentration: true }, 'Ningún sonido puede crearse ni atravesar una esfera de 6 metros.'],
  ['spikeGrowth', 'Crecimiento Espinoso', 2, ['druid', 'ranger'], 'utility', { concentration: true }, 'El suelo se cubre de espinas ocultas que hieren a quien lo cruza.'],
  ['spiritualWeapon', 'Arma Espiritual', 2, ['cleric'], 'attack', { damage: '1d8', type: 'fuerza', concentration: true }, 'Un arma espectral flota y golpea donde tú le ordenas.'],
  ['suggestion', 'Sugestión', 2, ['bard', 'sorcerer', 'warlock', 'wizard'], 'save', { save: 'sab', concentration: true }, 'Sugieres un curso de acción que la criatura sigue.'],
  ['web', 'Telaraña', 2, ['sorcerer', 'wizard'], 'save', { save: 'des', concentration: true }, 'Telarañas gruesas y pegajosas llenan la zona y atrapan.'],
  ['zoneOfTruth', 'Zona de Verdad', 2, ['bard', 'cleric', 'paladin'], 'save', { save: 'car' }, 'Dentro de la zona nadie puede mentir a sabiendas.'],

  // ------------------------------------------------------------------ level 3
  ['bestowCurse', 'Lanzar Maldición', 3, ['bard', 'cleric', 'wizard'], 'save', { save: 'sab', concentration: true }, 'Tu toque impone una maldición a la criatura.'],
  ['callLightning', 'Invocar Relámpagos', 3, ['druid'], 'save', { save: 'des', damage: '3d10', type: 'relámpago', half: true, concentration: true }, 'Una nube de tormenta descarga rayos donde señalas.'],
  ['conjureAnimals', 'Conjurar Animales', 3, ['druid', 'ranger'], 'save', { save: 'des', damage: '3d10', type: 'cortante', half: true, concentration: true }, 'Una manada de espíritus animales acosa a tus enemigos.'],
  ['counterspell', 'Contrahechizo', 3, ['sorcerer', 'warlock', 'wizard'], 'utility', {}, 'Interrumpes a una criatura mientras lanza un conjuro.'],
  ['daylight', 'Luz del Día', 3, ['cleric', 'druid', 'paladin', 'ranger', 'sorcerer'], 'utility', {}, 'Una esfera de luz solar ilumina 18 metros a la redonda.'],
  ['dispelMagic', 'Disipar Magia', 3, ['bard', 'cleric', 'druid', 'paladin', 'sorcerer', 'warlock', 'wizard'], 'utility', {}, 'Pones fin a los conjuros que afectan a una criatura u objeto.'],
  ['fear', 'Miedo', 3, ['bard', 'sorcerer', 'warlock', 'wizard'], 'save', { save: 'sab', concentration: true }, 'Proyectas una imagen aterradora: los que fallan sueltan lo que llevan y huyen.'],
  ['fireball', 'Bola de Fuego', 3, ['sorcerer', 'wizard'], 'save', { save: 'des', damage: '8d6', type: 'fuego', half: true }, 'Una explosión de llamas que arrasa 6 metros a la redonda.'],
  ['fly', 'Volar', 3, ['sorcerer', 'warlock', 'wizard'], 'utility', { concentration: true }, 'Una criatura puede volar durante diez minutos.'],
  ['haste', 'Acelerar', 3, ['sorcerer', 'wizard'], 'utility', { concentration: true }, 'Una criatura dobla su velocidad y gana una acción adicional.'],
  ['hypnoticPattern', 'Patrón Hipnótico', 3, ['bard', 'sorcerer', 'warlock', 'wizard'], 'save', { save: 'sab', concentration: true }, 'Un remolino de colores deja embelesados a quienes lo miran.'],
  ['lightningBolt', 'Rayo Relampagueante', 3, ['sorcerer', 'wizard'], 'save', { save: 'des', damage: '8d6', type: 'relámpago', half: true }, 'Un rayo de 30 metros que atraviesa todo lo que encuentra.'],
  ['majorImage', 'Imagen Mayor', 3, ['bard', 'sorcerer', 'warlock', 'wizard'], 'utility', { concentration: true }, 'Una ilusión con sonido, olor y temperatura.'],
  ['massHealingWord', 'Palabra de Curación en Masa', 3, ['bard', 'cleric'], 'heal', { heal: '2d4', addMod: true }, 'Tus palabras curan a seis criaturas a la vez.'],
  ['plantGrowth', 'Crecimiento Vegetal', 3, ['bard', 'druid', 'ranger'], 'utility', {}, 'La vegetación crece espesa y frena a quien la atraviesa.'],
  ['protectionFromEnergy', 'Protección contra la Energía', 3, ['cleric', 'druid', 'ranger', 'sorcerer', 'wizard'], 'utility', { concentration: true }, 'Una criatura resiste un tipo de daño elemental.'],
  ['removeCurse', 'Quitar Maldición', 3, ['cleric', 'paladin', 'warlock', 'wizard'], 'utility', {}, 'Tu toque pone fin a las maldiciones de una criatura u objeto.'],
  ['revivify', 'Revivir', 3, ['cleric', 'druid', 'paladin', 'ranger'], 'utility', {}, 'Devuelves la vida a alguien que ha muerto en el último minuto.'],
  ['sleetStorm', 'Tormenta de Aguanieve', 3, ['druid', 'sorcerer', 'wizard'], 'save', { save: 'des', concentration: true }, 'Aguanieve y hielo: el suelo resbala y nada se ve.'],
  ['slow', 'Ralentizar', 3, ['bard', 'sorcerer', 'wizard'], 'save', { save: 'sab', concentration: true }, 'Hasta seis criaturas se mueven y actúan a cámara lenta.'],
  ['speakWithDead', 'Hablar con los Muertos', 3, ['bard', 'cleric', 'wizard'], 'utility', {}, 'Un cadáver responde a cinco preguntas.'],
  ['spiritGuardians', 'Espíritus Guardianes', 3, ['cleric'], 'save', { save: 'sab', damage: '3d8', type: 'radiante', half: true, concentration: true }, 'Espíritus protectores te rodean y castigan a tus enemigos.'],
  ['tongues', 'Don de Lenguas', 3, ['bard', 'cleric', 'sorcerer', 'warlock', 'wizard'], 'utility', {}, 'Una criatura entiende y habla cualquier idioma.'],
  ['vampiricTouch', 'Toque Vampírico', 3, ['sorcerer', 'warlock', 'wizard'], 'attack', { damage: '3d6', type: 'necrótico', concentration: true }, 'Tu toque drena la vida de la víctima.'],
  ['waterBreathing', 'Respirar Bajo el Agua', 3, ['druid', 'ranger', 'sorcerer', 'wizard'], 'utility', { ritual: true }, 'Hasta diez criaturas respiran bajo el agua un día entero.'],
  ['windWall', 'Muro de Viento', 3, ['druid', 'ranger'], 'utility', { concentration: true }, 'Un muro de viento que desvía flechas y gases.']
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
