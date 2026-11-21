// Level 6 to 9 spells for the 2024 rules of D&D.
//
// This file includes material from the System Reference Document 5.2.1
// ("SRD 5.2.1") by Wizards of the Coast LLC, available at
// https://www.dndbeyond.com/srd, licensed under the Creative Commons
// Attribution 4.0 International License.
//
// Names are in Spanish and descriptions are our own one-line summaries.
// Same row format and `kind` meanings as in spells.js.

// [id, name, level, classes, kind, mechanics, description]
export const SPELL_ROWS_6_9 = [
  // ------------------------------------------------------------------ level 6
  ['bladeBarrier', 'Barrera de Cuchillas', 6, ['cleric'], 'save', { save: 'des', damage: '6d10', type: 'fuerza', half: true, concentration: true }, 'Un muro de cuchillas giratorias destroza a quien lo cruza.'],
  ['chainLightning', 'Cadena de Relámpagos', 6, ['sorcerer', 'wizard'], 'save', { save: 'des', damage: '10d8', type: 'relámpago', half: true }, 'Un relámpago salta de enemigo en enemigo.'],
  ['circleOfDeath', 'Círculo de Muerte', 6, ['sorcerer', 'warlock', 'wizard'], 'save', { save: 'con', damage: '8d8', type: 'necrótico', half: true }, 'Una esfera de energía negativa marchita a todos a su alrededor.'],
  ['conjureFey', 'Conjurar Feérico', 6, ['druid'], 'attack', { damage: '3d12', type: 'psíquico', concentration: true }, 'Un espíritu feérico aparece junto a tus enemigos y los ataca.'],
  ['contingency', 'Contingencia', 6, ['wizard'], 'utility', {}, 'Dejas preparado un conjuro que se activa solo cuando se cumple una condición.'],
  ['createUndead', 'Crear No Muerto', 6, ['cleric', 'warlock', 'wizard'], 'utility', {}, 'Alzas cadáveres como necrófagos que obedecen tus órdenes.'],
  ['disintegrate', 'Desintegrar', 6, ['sorcerer', 'wizard'], 'save', { save: 'des', damage: '10d6+40', type: 'fuerza' }, 'Un rayo verde que reduce a polvo lo que destruye.'],
  ['eyebite', 'Mirada Penetrante', 6, ['bard', 'sorcerer', 'warlock', 'wizard'], 'save', { save: 'sab', concentration: true }, 'Tu mirada duerme, aterra o enferma a quien la cruza.'],
  ['findThePath', 'Encontrar el Camino', 6, ['bard', 'cleric', 'druid'], 'utility', { concentration: true }, 'Sabes en todo momento la ruta más directa hacia un lugar.'],
  ['fleshToStone', 'Carne a Piedra', 6, ['druid', 'sorcerer', 'wizard'], 'save', { save: 'con', concentration: true }, 'La víctima se va petrificando poco a poco.'],
  ['forbiddance', 'Prohibición', 6, ['cleric'], 'utility', { ritual: true }, 'Sellas una zona contra la teletransportación y daña a ciertas criaturas.'],
  ['freezingSphere', 'Esfera Congelante', 6, ['sorcerer', 'wizard'], 'save', { save: 'con', damage: '10d6', type: 'frío', half: true }, 'Un globo de frío estalla y congela todo a su alrededor.'],
  ['globeOfInvulnerability', 'Globo de Invulnerabilidad', 6, ['sorcerer', 'wizard'], 'utility', { concentration: true }, 'Una barrera detiene los conjuros de nivel 5 o inferior.'],
  ['guardsAndWards', 'Guardas y Custodias', 6, ['bard', 'wizard'], 'utility', {}, 'Proteges un edificio con nieblas, puertas ilusorias y trampas mágicas.'],
  ['harm', 'Dañar', 6, ['cleric'], 'save', { save: 'con', damage: '14d6', type: 'necrótico', half: true }, 'Una enfermedad mágica devora la vitalidad del objetivo.'],
  ['heal', 'Curar', 6, ['cleric', 'druid'], 'heal', { heal: '0d4+70' }, 'Una oleada de energía cura 70 puntos de golpe y males.'],
  ['heroesFeast', 'Banquete de Héroes', 6, ['bard', 'cleric', 'druid'], 'utility', {}, 'Un festín mágico que cura y fortalece a quienes lo comen.'],
  ['instantSummons', 'Convocación Instantánea', 6, ['wizard'], 'utility', { ritual: true }, 'Marcas un objeto para hacerlo aparecer en tu mano al instante.'],
  ['irresistibleDance', 'Danza Irresistible', 6, ['bard', 'wizard'], 'save', { save: 'sab', concentration: true }, 'La víctima se pone a bailar sin poder evitarlo.'],
  ['magicJar', 'Recipiente Mágico', 6, ['wizard'], 'save', { save: 'car' }, 'Tu alma pasa a un recipiente y puede poseer otros cuerpos.'],
  ['massSuggestion', 'Sugestión en Masa', 6, ['bard', 'sorcerer', 'wizard'], 'save', { save: 'sab' }, 'Hasta doce criaturas siguen una sugerencia razonable.'],
  ['moveEarth', 'Mover Tierra', 6, ['druid', 'sorcerer', 'wizard'], 'utility', { concentration: true }, 'Remodelas el terreno: colinas, zanjas y muros de tierra.'],
  ['planarAlly', 'Aliado Planar', 6, ['cleric'], 'utility', {}, 'Pides ayuda a una entidad de otro plano a cambio de un pago.'],
  ['programmedIllusion', 'Ilusión Programada', 6, ['bard', 'wizard'], 'utility', {}, 'Una ilusión que se activa cuando se da una condición.'],
  ['sunbeam', 'Rayo de Sol', 6, ['cleric', 'druid', 'sorcerer', 'wizard'], 'save', { save: 'con', damage: '6d8', type: 'radiante', half: true, concentration: true }, 'Un haz de luz solar quema y ciega a lo largo de una línea.'],
  ['transportViaPlants', 'Transportar por las Plantas', 6, ['druid'], 'utility', {}, 'Entras en una planta y sales por otra de la misma especie.'],
  ['trueSeeing', 'Visión Verdadera', 6, ['bard', 'cleric', 'sorcerer', 'warlock', 'wizard'], 'utility', {}, 'Ves a través de ilusiones, invisibilidad y formas cambiadas.'],
  ['wallOfIce', 'Muro de Hielo', 6, ['wizard'], 'save', { save: 'des', damage: '10d6', type: 'frío', half: true, concentration: true }, 'Levantas un muro de hielo que congela a quien lo atraviesa.'],
  ['wallOfThorns', 'Muro de Espinas', 6, ['druid'], 'save', { save: 'des', damage: '7d8', type: 'perforante', half: true, concentration: true }, 'Un muro de zarzas espinosas desgarra a quien lo toca.'],
  ['windWalk', 'Caminar con el Viento', 6, ['druid'], 'utility', {}, 'Tu grupo se convierte en niebla y viaja a gran velocidad.'],
  ['wordOfRecall', 'Palabra de Regreso', 6, ['cleric'], 'utility', {}, 'Tú y tus aliados volvéis al instante a tu santuario.'],

  // ------------------------------------------------------------------ level 7
  ['arcaneSword', 'Espada Arcana', 7, ['bard', 'wizard'], 'attack', { damage: '4d12', type: 'fuerza', concentration: true }, 'Una espada espectral flota y ataca a tus órdenes.'],
  ['conjureCelestial', 'Conjurar Celestial', 7, ['cleric'], 'save', { save: 'des', damage: '6d12', type: 'radiante', half: true, concentration: true }, 'Una columna de luz celestial hiere a enemigos y cura a aliados.'],
  ['delayedBlastFireball', 'Bola de Fuego de Explosión Retardada', 7, ['sorcerer', 'wizard'], 'save', { save: 'des', damage: '12d6', type: 'fuego', half: true, concentration: true }, 'Una bola de fuego que crece en potencia antes de estallar.'],
  ['divineWord', 'Palabra Divina', 7, ['cleric'], 'save', { save: 'car' }, 'Una palabra de poder ensordece, ciega, aturde o mata a los débiles.'],
  ['etherealness', 'Excursión Etérea', 7, ['bard', 'cleric', 'sorcerer', 'warlock', 'wizard'], 'utility', {}, 'Pasas al Plano Etéreo y atraviesas el mundo como un fantasma.'],
  ['fingerOfDeath', 'Dedo de la Muerte', 7, ['sorcerer', 'warlock', 'wizard'], 'save', { save: 'con', damage: '7d8+30', type: 'necrótico', half: true }, 'Energía negativa que mata y alza a la víctima como zombi.'],
  ['fireStorm', 'Tormenta de Fuego', 7, ['cleric', 'druid', 'sorcerer'], 'save', { save: 'des', damage: '7d10', type: 'fuego', half: true }, 'Un torbellino de llamas arrasa la zona que eliges.'],
  ['forcecage', 'Jaula de Fuerza', 7, ['bard', 'warlock', 'wizard'], 'utility', { concentration: true }, 'Una prisión invisible de fuerza atrapa a quien esté dentro.'],
  ['magnificentMansion', 'Mansión Magnífica', 7, ['bard', 'wizard'], 'utility', {}, 'Abres la puerta a una mansión extradimensional con sirvientes.'],
  ['mirageArcane', 'Espejismo Arcano', 7, ['bard', 'druid', 'wizard'], 'utility', {}, 'Haces que todo un paisaje parezca otro, hasta al tacto.'],
  ['planeShift', 'Desplazamiento entre Planos', 7, ['cleric', 'druid', 'sorcerer', 'warlock', 'wizard'], 'save', { save: 'car' }, 'Viajas a otro plano o destierras allí a una criatura.'],
  ['prismaticSpray', 'Rociada Prismática', 7, ['bard', 'sorcerer', 'wizard'], 'save', { save: 'des', damage: '12d6', type: 'fuego', half: true }, 'Rayos de siete colores, cada uno con un efecto distinto.'],
  ['projectImage', 'Proyectar Imagen', 7, ['bard', 'wizard'], 'utility', { concentration: true }, 'Una copia ilusoria tuya actúa y habla lejos de ti.'],
  ['regenerate', 'Regenerar', 7, ['bard', 'cleric', 'druid'], 'heal', { heal: '4d8+15' }, 'Curas a una criatura y le vuelven a crecer los miembros perdidos.'],
  ['resurrection', 'Resurrección', 7, ['bard', 'cleric'], 'utility', {}, 'Devuelves la vida a alguien muerto hace menos de un siglo.'],
  ['reverseGravity', 'Invertir Gravedad', 7, ['druid', 'sorcerer', 'wizard'], 'save', { save: 'des', concentration: true }, 'La gravedad se invierte y todo cae hacia arriba.'],
  ['sequester', 'Secuestro', 7, ['wizard'], 'utility', {}, 'Ocultas una criatura u objeto de toda detección mágica.'],
  ['simulacrum', 'Simulacro', 7, ['wizard'], 'utility', {}, 'Creas un duplicado de hielo y nieve de una criatura.'],
  ['symbol', 'Símbolo', 7, ['bard', 'cleric', 'druid', 'wizard'], 'utility', {}, 'Inscribes un glifo que desata un efecto terrible al activarse.'],
  ['teleport', 'Teletransporte', 7, ['bard', 'sorcerer', 'wizard'], 'utility', {}, 'Llevas a tu grupo a cualquier lugar del mismo plano.'],

  // ------------------------------------------------------------------ level 8
  ['animalShapes', 'Formas Animales', 8, ['druid'], 'utility', {}, 'Transformas a tus aliados en las bestias que elijas.'],
  ['antimagicField', 'Campo Antimagia', 8, ['cleric', 'wizard'], 'utility', { concentration: true }, 'Un aura a tu alrededor anula toda la magia.'],
  ['antipathySympathy', 'Antipatía/Simpatía', 8, ['bard', 'druid', 'wizard'], 'save', { save: 'sab' }, 'Un lugar u objeto repele o atrae a cierto tipo de criaturas.'],
  ['befuddlement', 'Desconcierto', 8, ['bard', 'druid', 'warlock', 'wizard'], 'save', { save: 'int', damage: '10d12', type: 'psíquico', half: true }, 'Destrozas la mente del objetivo, que puede quedar incapaz de pensar.'],
  ['clone', 'Clon', 8, ['wizard'], 'utility', {}, 'Cultivas un cuerpo de repuesto que te recibe si mueres.'],
  ['controlWeather', 'Controlar el Clima', 8, ['cleric', 'druid', 'wizard'], 'utility', { concentration: true }, 'Cambias el tiempo atmosférico en kilómetros a la redonda.'],
  ['demiplane', 'Semiplano', 8, ['sorcerer', 'warlock', 'wizard'], 'utility', {}, 'Abres una puerta a una pequeña dimensión vacía.'],
  ['dominateMonster', 'Dominar Monstruo', 8, ['bard', 'sorcerer', 'warlock', 'wizard'], 'save', { save: 'sab', concentration: true }, 'Controlas la voluntad de cualquier criatura.'],
  ['earthquake', 'Terremoto', 8, ['cleric', 'druid', 'sorcerer'], 'save', { save: 'des', concentration: true }, 'Un temblor abre grietas y derrumba edificios.'],
  ['glibness', 'Labia', 8, ['bard', 'warlock'], 'utility', {}, 'Tus palabras convencen a cualquiera y la magia no detecta tus mentiras.'],
  ['holyAura', 'Aura Sagrada', 8, ['cleric'], 'utility', { concentration: true }, 'Una luz divina protege a tus aliados y ciega a los malvados.'],
  ['incendiaryCloud', 'Nube Incendiaria', 8, ['druid', 'sorcerer', 'wizard'], 'save', { save: 'des', damage: '10d8', type: 'fuego', half: true, concentration: true }, 'Una nube de humo y ascuas que quema y avanza.'],
  ['maze', 'Laberinto', 8, ['wizard'], 'utility', { concentration: true }, 'Destierras a una criatura a un laberinto extradimensional.'],
  ['mindBlank', 'Mente en Blanco', 8, ['bard', 'wizard'], 'utility', {}, 'Proteges una mente contra la adivinación y el control mental.'],
  ['powerWordStun', 'Palabra de Poder Aturdir', 8, ['bard', 'sorcerer', 'warlock', 'wizard'], 'utility', {}, 'Una palabra que deja aturdida a una criatura debilitada.'],
  ['sunburst', 'Estallido Solar', 8, ['cleric', 'druid', 'sorcerer', 'wizard'], 'save', { save: 'con', damage: '12d6', type: 'radiante', half: true }, 'Una explosión de luz solar abrasa y ciega.'],
  ['tsunami', 'Tsunami', 8, ['druid'], 'save', { save: 'fue', damage: '6d10', type: 'contundente', half: true, concentration: true }, 'Un muro de agua gigantesco arrasa todo a su paso.'],

  // ------------------------------------------------------------------ level 9
  ['astralProjection', 'Proyección Astral', 9, ['cleric', 'warlock', 'wizard'], 'utility', {}, 'Tu grupo viaja en forma astral a otros planos.'],
  ['foresight', 'Presciencia', 9, ['bard', 'druid', 'warlock', 'wizard'], 'utility', {}, 'Ves el futuro inmediato: ventaja en todo y nadie te pilla por sorpresa.'],
  ['gate', 'Portal', 9, ['cleric', 'sorcerer', 'warlock', 'wizard'], 'utility', { concentration: true }, 'Abres un portal a otro plano o traes a una criatura concreta.'],
  ['imprisonment', 'Encarcelamiento', 9, ['warlock', 'wizard'], 'save', { save: 'sab' }, 'Encierras a una criatura en una prisión mágica eterna.'],
  ['massHeal', 'Curar en Masa', 9, ['cleric'], 'heal', { heal: '0d4+700' }, 'Repartes hasta 700 puntos de golpe de curación entre muchos.'],
  ['meteorSwarm', 'Lluvia de Meteoritos', 9, ['sorcerer', 'wizard'], 'save', { save: 'des', damage: '20d6', type: 'fuego', half: true }, 'Cuatro meteoritos de fuego caen del cielo y estallan.'],
  ['powerWordHeal', 'Palabra de Poder Curar', 9, ['bard', 'cleric'], 'utility', {}, 'Una palabra que devuelve todos los puntos de golpe a una criatura.'],
  ['powerWordKill', 'Palabra de Poder Matar', 9, ['bard', 'sorcerer', 'warlock', 'wizard'], 'utility', {}, 'Una palabra que mata al instante a una criatura debilitada.'],
  ['prismaticWall', 'Muro Prismático', 9, ['bard', 'wizard'], 'utility', {}, 'Un muro de siete capas de colores, cada una con su propio peligro.'],
  ['shapechange', 'Cambiar de Forma', 9, ['druid', 'wizard'], 'utility', { concentration: true }, 'Adoptas la forma de cualquier criatura que hayas visto.'],
  ['stormOfVengeance', 'Tormenta de Venganza', 9, ['druid'], 'save', { save: 'con', damage: '2d6', type: 'trueno', concentration: true }, 'Una tormenta furiosa de truenos, ácido, rayos y granizo.'],
  ['timeStop', 'Detener el Tiempo', 9, ['sorcerer', 'wizard'], 'utility', {}, 'El tiempo se detiene para todos menos para ti durante unos turnos.'],
  ['truePolymorph', 'Polimorfar Verdadero', 9, ['bard', 'warlock', 'wizard'], 'save', { save: 'sab', concentration: true }, 'Transformas a una criatura u objeto en otra cosa, incluso para siempre.'],
  ['trueResurrection', 'Resurrección Verdadera', 9, ['cleric', 'druid'], 'utility', {}, 'Devuelves la vida a alguien muerto hace siglos, aun sin cuerpo.'],
  ['weird', 'Extraño', 9, ['warlock', 'wizard'], 'save', { save: 'sab', damage: '10d10', type: 'psíquico', half: true, concentration: true }, 'Tus enemigos ven sus peores pesadillas hechas realidad.'],
  ['wish', 'Deseo', 9, ['sorcerer', 'wizard'], 'utility', {}, 'El conjuro más poderoso: altera la realidad a tu voluntad.'],
];
