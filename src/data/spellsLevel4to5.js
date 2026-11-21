// Level 4 and level 5 spells for the 2024 rules of D&D.
//
// This file includes material from the System Reference Document 5.2.1
// ("SRD 5.2.1") by Wizards of the Coast LLC, available at
// https://www.dndbeyond.com/srd, licensed under the Creative Commons
// Attribution 4.0 International License.
//
// Names are in Spanish and descriptions are our own one-line summaries.
// Row format and `kind` meanings are the same as in spells.js.

// [id, name, level, classes, kind, mechanics, description]
export const SPELL_ROWS_4_5 = [
  // ------------------------------------------------------------------ level 4
  ['arcaneEye', 'Ojo Arcano', 4, ['wizard'], 'utility', { concentration: true }, 'Creas un ojo invisible y flotante que explora por ti.'],
  ['auraOfLife', 'Aura de Vida', 4, ['cleric', 'paladin'], 'utility', { concentration: true }, 'Tu aura protege del daño necrótico y levanta a los aliados caídos.'],
  ['banishment', 'Destierro', 4, ['cleric', 'paladin', 'sorcerer', 'warlock', 'wizard'], 'save', { save: 'car', concentration: true }, 'Envías a una criatura a otro plano de existencia.'],
  ['blackTentacles', 'Tentáculos Negros', 4, ['wizard'], 'save', { save: 'fue', damage: '3d6', type: 'contundente', concentration: true }, 'Tentáculos de ébano brotan del suelo, golpean y apresan a quien pisa la zona.'],
  ['blight', 'Marchitar', 4, ['druid', 'sorcerer', 'warlock', 'wizard'], 'save', { save: 'con', damage: '8d8', type: 'necrótico', half: true }, 'Drenas la humedad y la vida de una criatura.'],
  ['charmMonster', 'Hechizar Monstruo', 4, ['bard', 'druid', 'sorcerer', 'warlock', 'wizard'], 'save', { save: 'sab' }, 'Cualquier criatura te considera un conocido amistoso durante una hora.'],
  ['compulsion', 'Compulsión', 4, ['bard'], 'save', { save: 'sab', concentration: true }, 'Obligas a varias criaturas a moverse en la dirección que tú elijas.'],
  ['confusion', 'Confusión', 4, ['bard', 'druid', 'sorcerer', 'wizard'], 'save', { save: 'sab', concentration: true }, 'Las criaturas de la zona actúan al azar, sin saber qué hacen.'],
  ['conjureMinorElementals', 'Conjurar Elementales Menores', 4, ['druid', 'wizard'], 'utility', { concentration: true }, 'Espíritus elementales te rodean y potencian tus ataques con daño extra.'],
  ['conjureWoodlandBeings', 'Conjurar Seres de los Bosques', 4, ['druid', 'ranger'], 'save', { save: 'sab', damage: '5d8', type: 'fuerza', half: true, concentration: true }, 'Espíritus de la naturaleza revolotean a tu alrededor y hieren a tus enemigos.'],
  ['controlWater', 'Controlar Agua', 4, ['cleric', 'druid', 'wizard'], 'utility', { concentration: true }, 'Inundas, separas o arremolinas una gran masa de agua.'],
  ['deathWard', 'Custodia contra la Muerte', 4, ['cleric', 'paladin'], 'utility', {}, 'La primera vez que una criatura fuera a caer a 0 PG, queda en pie con 1.'],
  ['dimensionDoor', 'Puerta Dimensional', 4, ['bard', 'sorcerer', 'warlock', 'wizard'], 'utility', {}, 'Te teletransportas hasta 500 pies, y puedes llevar a un acompañante.'],
  ['divination', 'Adivinación', 4, ['cleric', 'druid', 'wizard'], 'utility', { ritual: true }, 'Haces una pregunta sobre un hecho próximo y recibes una respuesta veraz.'],
  ['dominateBeast', 'Dominar Bestia', 4, ['druid', 'ranger', 'sorcerer'], 'save', { save: 'sab', concentration: true }, 'Tomas el control de una bestia y le das órdenes.'],
  ['fabricate', 'Fabricar', 4, ['wizard'], 'utility', {}, 'Conviertes materias primas en objetos acabados del mismo material.'],
  ['faithfulHound', 'Sabueso Fiel', 4, ['wizard'], 'utility', {}, 'Un perro guardián invisible vigila una zona y muerde a los intrusos.'],
  ['fireShield', 'Escudo de Fuego', 4, ['druid', 'sorcerer', 'wizard'], 'utility', {}, 'Llamas te envuelven, te protegen del frío o del fuego y queman a quien te golpea.'],
  ['freedomOfMovement', 'Libertad de Movimiento', 4, ['bard', 'cleric', 'druid', 'ranger'], 'utility', {}, 'Una criatura se mueve sin trabas: ni terreno difícil ni ataduras la frenan.'],
  ['giantInsect', 'Insecto Gigante', 4, ['druid'], 'utility', { concentration: true }, 'Invocas un ciempiés, araña o avispa gigante que lucha a tu lado.'],
  ['greaterInvisibility', 'Invisibilidad Mayor', 4, ['bard', 'sorcerer', 'wizard'], 'utility', { concentration: true }, 'Una criatura se vuelve invisible aunque ataque o lance conjuros.'],
  ['guardianOfFaith', 'Guardián de la Fe', 4, ['cleric'], 'save', { save: 'des', damage: '0d4+20', type: 'radiante', half: true }, 'Un guardián espectral vigila un lugar y castiga a los enemigos que se acercan.'],
  ['hallucinatoryTerrain', 'Terreno Alucinatorio', 4, ['bard', 'druid', 'warlock', 'wizard'], 'utility', {}, 'Haces que un terreno natural parezca otro distinto.'],
  ['iceStorm', 'Tormenta de Hielo', 4, ['druid', 'sorcerer', 'wizard'], 'save', { save: 'des', damage: '2d10', type: 'contundente', half: true }, 'Una granizada golpea y congela a todos los que están en la zona.'],
  ['locateCreature', 'Localizar Criatura', 4, ['bard', 'cleric', 'druid', 'paladin', 'ranger', 'wizard'], 'utility', { concentration: true }, 'Percibes en qué dirección está una criatura que conoces.'],
  ['phantasmalKiller', 'Asesino Fantasmal', 4, ['bard', 'wizard'], 'save', { save: 'sab', damage: '4d10', type: 'psíquico', half: true, concentration: true }, 'Das forma a los peores miedos de una criatura, que la atormentan turno tras turno.'],
  ['polymorph', 'Polimorfar', 4, ['bard', 'druid', 'sorcerer', 'wizard'], 'save', { save: 'sab', concentration: true }, 'Transformas a una criatura en una bestia.'],
  ['privateSanctum', 'Santuario Privado', 4, ['wizard'], 'utility', {}, 'Proteges una zona contra el espionaje mágico, el sonido o la teletransportación.'],
  ['resilientSphere', 'Esfera Resiliente', 4, ['wizard'], 'save', { save: 'des', concentration: true }, 'Encierras a una criatura u objeto en una esfera impenetrable.'],
  ['secretChest', 'Cofre Secreto', 4, ['wizard'], 'utility', {}, 'Escondes un cofre en el Plano Etéreo y lo recuperas cuando quieras.'],
  ['stoneShape', 'Moldear Piedra', 4, ['cleric', 'druid', 'wizard'], 'utility', {}, 'Das a la piedra la forma que quieras, como si fuera arcilla.'],
  ['stoneskin', 'Piel de Piedra', 4, ['druid', 'ranger', 'sorcerer', 'wizard'], 'utility', { concentration: true }, 'La piel de una criatura se endurece y resiste los golpes, cortes y perforaciones.'],
  ['vitriolicSphere', 'Esfera Vitriólica', 4, ['sorcerer', 'wizard'], 'save', { save: 'des', damage: '10d4', type: 'ácido', half: true }, 'Una bola de ácido estalla y sigue corroyendo a las víctimas.'],
  ['wallOfFire', 'Muro de Fuego', 4, ['druid', 'sorcerer', 'wizard'], 'save', { save: 'des', damage: '5d8', type: 'fuego', half: true, concentration: true }, 'Levantas una pared de llamas que abrasa a quien está cerca.'],

  // ------------------------------------------------------------------ level 5
  ['animateObjects', 'Animar Objetos', 5, ['bard', 'sorcerer', 'wizard'], 'utility', { concentration: true }, 'Das vida a objetos cercanos para que luchen a tus órdenes.'],
  ['antilifeShell', 'Caparazón Antivida', 5, ['druid'], 'utility', { concentration: true }, 'Una barrera a tu alrededor impide el paso a las criaturas vivas.'],
  ['arcaneHand', 'Mano Arcana', 5, ['sorcerer', 'wizard'], 'attack', { damage: '5d8', type: 'fuerza', concentration: true }, 'Una mano gigante de energía golpea, empuja o agarra a tus enemigos.'],
  ['awaken', 'Despertar', 5, ['bard', 'druid'], 'utility', {}, 'Das inteligencia a una bestia o a una planta, que se vuelve tu amiga.'],
  ['cloudkill', 'Nube Aniquiladora', 5, ['sorcerer', 'wizard'], 'save', { save: 'con', damage: '5d8', type: 'veneno', half: true, concentration: true }, 'Una niebla venenosa se arrastra y envenena a todo el que atrapa.'],
  ['commune', 'Comunión', 5, ['cleric'], 'utility', { ritual: true }, 'Haces tres preguntas de sí o no a tu deidad.'],
  ['communeWithNature', 'Comunión con la Naturaleza', 5, ['druid', 'ranger'], 'utility', { ritual: true }, 'La naturaleza te revela el terreno, los peligros y las criaturas cercanas.'],
  ['coneOfCold', 'Cono de Frío', 5, ['druid', 'sorcerer', 'wizard'], 'save', { save: 'con', damage: '8d8', type: 'frío', half: true }, 'Un soplo de aire helado congela todo lo que hay delante.'],
  ['conjureElemental', 'Conjurar Elemental', 5, ['druid', 'wizard'], 'utility', { concentration: true }, 'Invocas un gran espíritu elemental que atrapa y daña a quien se acerca.'],
  ['contactOtherPlane', 'Contactar con Otro Plano', 5, ['warlock', 'wizard'], 'utility', { ritual: true }, 'Consultas a una entidad de otro plano, arriesgando tu cordura.'],
  ['contagion', 'Contagio', 5, ['cleric', 'druid'], 'save', { save: 'con', damage: '11d8', type: 'necrótico' }, 'Tu toque transmite una enfermedad mágica que debilita a la víctima.'],
  ['creation', 'Creación', 5, ['sorcerer', 'wizard'], 'utility', {}, 'Creas de la nada un objeto inerte de materia vegetal o mineral.'],
  ['dispelEvilAndGood', 'Disipar el Bien y el Mal', 5, ['cleric', 'paladin'], 'utility', { concentration: true }, 'Te proteges de celestiales, infernales y otros seres, y puedes expulsarlos.'],
  ['dominatePerson', 'Dominar Persona', 5, ['bard', 'sorcerer', 'wizard'], 'save', { save: 'sab', concentration: true }, 'Tomas el control de un humanoide y le das órdenes.'],
  ['dream', 'Sueño', 5, ['bard', 'warlock', 'wizard'], 'utility', {}, 'Te comunicas con alguien a través de sus sueños, o le das pesadillas.'],
  ['flameStrike', 'Columna de Llamas', 5, ['cleric'], 'save', { save: 'des', damage: '5d6', type: 'fuego', half: true }, 'Una columna de fuego divino cae del cielo sobre tus enemigos.'],
  ['geas', 'Geas', 5, ['bard', 'cleric', 'druid', 'paladin', 'wizard'], 'save', { save: 'sab' }, 'Impones a una criatura una orden mágica que le duele desobedecer.'],
  ['greaterRestoration', 'Restablecimiento Mayor', 5, ['bard', 'cleric', 'druid', 'paladin', 'ranger'], 'utility', {}, 'Eliminas un efecto grave: hechizo, petrificación, maldición o agotamiento.'],
  ['hallow', 'Santificar', 5, ['cleric'], 'utility', {}, 'Consagras un lugar que protege de criaturas sobrenaturales.'],
  ['holdMonster', 'Inmovilizar Monstruo', 5, ['bard', 'sorcerer', 'warlock', 'wizard'], 'save', { save: 'sab', concentration: true }, 'Una criatura cualquiera queda paralizada.'],
  ['insectPlague', 'Plaga de Insectos', 5, ['cleric', 'druid', 'sorcerer'], 'save', { save: 'con', damage: '4d10', type: 'perforante', half: true, concentration: true }, 'Un enjambre de langostas pica a todos los que están en la zona.'],
  ['legendLore', 'Conocimiento de Leyendas', 5, ['bard', 'cleric', 'wizard'], 'utility', {}, 'Recuerdas las leyendas sobre una persona, lugar u objeto importante.'],
  ['massCureWounds', 'Curar Heridas en Masa', 5, ['bard', 'cleric', 'druid'], 'heal', { heal: '5d8', addMod: true }, 'Una oleada de energía curativa sana a seis criaturas a la vez.'],
  ['mislead', 'Despiste', 5, ['bard', 'warlock', 'wizard'], 'utility', { concentration: true }, 'Te vuelves invisible y dejas un doble ilusorio en tu lugar.'],
  ['modifyMemory', 'Modificar Recuerdo', 5, ['bard', 'wizard'], 'save', { save: 'sab', concentration: true }, 'Cambias, borras o inventas un recuerdo de una criatura.'],
  ['passwall', 'Pasamuros', 5, ['wizard'], 'utility', {}, 'Abres un pasadizo a través de una pared de madera, piedra o yeso.'],
  ['planarBinding', 'Vínculo Planar', 5, ['bard', 'cleric', 'druid', 'warlock', 'wizard'], 'utility', {}, 'Obligas a un celestial, elemental, feérico o infernal a servirte.'],
  ['raiseDead', 'Revivir a los Muertos', 5, ['bard', 'cleric', 'paladin'], 'utility', {}, 'Devuelves la vida a alguien que murió hace menos de diez días.'],
  ['reincarnate', 'Reencarnar', 5, ['druid'], 'utility', {}, 'Devuelves la vida a un muerto en un cuerpo nuevo, quizá de otra especie.'],
  ['scrying', 'Escudriñar', 5, ['bard', 'cleric', 'druid', 'warlock', 'wizard'], 'utility', { concentration: true }, 'Espías a distancia a una criatura, aunque esté en otro plano.'],
  ['seeming', 'Apariencia', 5, ['bard', 'sorcerer', 'wizard'], 'utility', {}, 'Cambias el aspecto de varias criaturas durante horas.'],
  ['summonDragon', 'Invocar Dragón', 5, ['wizard'], 'utility', { concentration: true }, 'Invocas un espíritu dracónico que muerde y escupe su aliento.'],
  ['telekinesis', 'Telequinesis', 5, ['sorcerer', 'wizard'], 'utility', { concentration: true }, 'Mueves criaturas y objetos pesados con la mente.'],
  ['telepathicBond', 'Vínculo Telepático', 5, ['bard', 'wizard'], 'utility', { ritual: true }, 'Conectas las mentes de tu grupo para que hablen sin palabras.'],
  ['teleportationCircle', 'Círculo de Teletransporte', 5, ['bard', 'sorcerer', 'warlock', 'wizard'], 'utility', {}, 'Dibujas un círculo que abre un portal a otro círculo conocido.'],
  ['treeStride', 'Zancada Arbórea', 5, ['druid', 'ranger'], 'utility', { concentration: true }, 'Entras en un árbol y sales por otro de la misma especie.'],
  ['wallOfForce', 'Muro de Fuerza', 5, ['wizard'], 'utility', { concentration: true }, 'Levantas una pared invisible que nada puede atravesar.'],
  ['wallOfStone', 'Muro de Piedra', 5, ['druid', 'sorcerer', 'wizard'], 'utility', { concentration: true }, 'Levantas una pared de piedra que puede volverse permanente.']
];
