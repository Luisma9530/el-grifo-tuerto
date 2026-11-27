// Narration of spells and rests for the local (non-AI) Dungeon Master engine.

import { ABILITIES } from '../data/srd';

const abilityName = id => ABILITIES.find(a => a.id === id)?.name || id;

const AFTER_COMBAT = [
  'Rematar la faena antes de que se recupere',
  'Exigirle que se rinda',
  'Retroceder y buscar cobertura',
  'Preguntar a Duncan quién era ese tipo'
];
const AFTER_UTILITY = [
  'Aprovechar el efecto del conjuro',
  'Examinar con calma lo que has descubierto',
  'Preguntar a Duncan qué opina',
  'Guardar fuerzas y pedir una jarra'
];

/**
 * Narrate a spell cast (see castSpell in spellcasting.js).
 * @param {object} cast
 * @param {object} context
 * @param {object} context.character
 * @param {number} context.enemyRoll  d20 rolled by the engine, used as the target's saving throw
 * @returns {{ text: string, suggestedActions: string[], usedEnemyRoll: boolean, xp: number }}
 */
export function narrateSpell(cast, { character, enemyRoll }) {
  const { spell } = cast;
  const name = character.name;
  const dmg = cast.damage ? `**${cast.damage.total}** de daño ${cast.damage.type}` : '';

  if (cast.attack) {
    const { raw, total, isNat20, isNat1 } = cast.attack;
    const tag = `[🎲 Ataque de conjuro D20: **${raw}** = ${total}]`;
    if (isNat20) {
      return {
        text: `*(Las velas de la taberna se apagan y vuelven a encenderse solas)* ${tag} **¡CRÍTICO!**

**${spell.name}** sale de las manos de ${name} con una fuerza que hace vibrar las jarras: el impacto es de lleno y causa ${dmg}. El objetivo sale despedido contra una mesa y media taberna se echa al suelo.

—*¡Por las barbas de mi abuelo! Avisa antes de hacer eso bajo mi techo, que casi me chamuscas el bigote.*`,
        suggestedActions: AFTER_COMBAT,
        usedEnemyRoll: false,
        xp: 75
      };
    }
    if (!isNat1 && total >= 12) {
      return {
        text: `${name} traza el gesto y pronuncia la palabra justa ${tag} **(Impacta)**.

**${spell.name}** alcanza a su objetivo y le causa ${dmg}. El olor a magia recién usada se mezcla con el del estofado, y más de un parroquiano aparta su silla con disimulo.

—*Bonito truco* —gruñe Duncan sin dejar de secar una jarra—. *Sigue en pie, pero ya no sonríe tanto.*`,
        suggestedActions: AFTER_COMBAT,
        usedEnemyRoll: false,
        xp: 40
      };
    }
    return {
      text: `${name} lanza **${spell.name}**, pero ${isNat1 ? 'las palabras se le traban en la lengua' : 'el objetivo se aparta en el último instante'} ${tag} **(${isNat1 ? '¡PIFIA!' : 'Falla'})**.

El conjuro pasa de largo y deja una marca humeante en una viga del techo. Alguien al fondo aplaude con sorna.

—*Esa viga lleva ahí doscientos años, hechicero. Como me la tires abajo, la pagas tú.*`,
      suggestedActions: ['Intentarlo de nuevo', 'Cambiar de táctica y sacar un arma', 'Ponerte a cubierto', 'Disculparte por lo de la viga'],
      usedEnemyRoll: false,
      xp: 10
    };
  }

  if (spell.kind === 'save') {
    // The game rolled the target's save with its own sheet when known (see rollTargetSave)
    const own = cast.targetSave;
    const saveTotal = own ? own.total : enemyRoll + 1;
    const saved = own ? own.success : enemyRoll !== 1 && (enemyRoll === 20 || saveTotal >= cast.saveDC);
    const tag = own
      ? `[🎲 Salvación de ${abilityName(spell.save)} ${own.of} D20: **${own.raw}** ${own.bonus >= 0 ? '+' : '−'}${Math.abs(own.bonus)} = ${own.total} vs CD ${cast.saveDC}]`
      : `[🎲 Salvación de ${abilityName(spell.save)} del objetivo D20: **${enemyRoll}** = ${saveTotal} vs CD ${cast.saveDC}]`;
    if (saved) {
      const partial = cast.damage && spell.half ? ` Aun así, se lleva **${Math.floor(cast.damage.total / 2)}** de daño ${cast.damage.type}.` : '';
      return {
        text: `${name} desata **${spell.name}** ${tag} **(Resiste)**.

El objetivo aprieta los dientes y aguanta el envite del conjuro.${partial}

—*Ese es duro de pelar* —comenta Duncan, apoyado en la barra—. *Vas a tener que esforzarte más.*`,
        suggestedActions: ['Insistir con otro conjuro', 'Cambiar de táctica', 'Negociar antes de que vaya a peor', 'Retroceder hacia la puerta'],
        usedEnemyRoll: true,
        xp: cast.damage && spell.half ? 25 : 10
      };
    }
    return {
      text: `${name} desata **${spell.name}** ${tag} **(No resiste)**.

${cast.damage ? `El conjuro le alcanza de lleno y le causa ${dmg}.` : `El conjuro hace efecto: ${spell.desc.charAt(0).toLowerCase()}${spell.desc.slice(1)}`}

—*Mira tú por dónde* —Duncan arquea la ceja de su ojo bueno—. *La magia también sirve para algo más que para encender pipas.*`,
      suggestedActions: AFTER_COMBAT,
      usedEnemyRoll: true,
      xp: 40
    };
  }

  if (spell.kind === 'auto') {
    return {
      text: `${name} lanza **${spell.name}** y no hay esquiva que valga: el conjuro acierta sin remedio y causa ${dmg}.

El objetivo retrocede tambaleándose, con la ropa humeante y los ojos como platos.

—*Eso no falla nunca, ¿eh?* —dice Duncan—. *Recuérdame que no juegue a los dardos contigo.*`,
      suggestedActions: AFTER_COMBAT,
      usedEnemyRoll: false,
      xp: 40
    };
  }

  if (cast.heal) {
    return {
      text: `Una luz cálida envuelve a ${name} al completar **${spell.name}**: las heridas se cierran y recupera **${cast.heal.applied}** puntos de golpe.

—*Eso me ahorra vendas* —refunfuña Duncan, casi decepcionado—. *Aunque un buen estofado cura lo mismo y sabe mejor.*`,
      suggestedActions: ['Volver a la acción con fuerzas renovadas', 'Pedir un estofado igualmente', 'Preguntar a Duncan por los rumores', 'Revisar tu equipo'],
      usedEnemyRoll: false,
      xp: 0
    };
  }

  return {
    text: `${name} completa los gestos de **${spell.name}** y la magia responde. ${spell.desc}

Un par de parroquianos se santiguan y otro pide que le rellenen la jarra «por si acaso».

—*Mientras no me espantes a la clientela, aquí cada uno hace lo que quiere* —dice Duncan encogiéndose de hombros.`,
    suggestedActions: AFTER_UTILITY,
    usedEnemyRoll: false,
    xp: 5
  };
}

/**
 * Narrate a weapon attack already resolved by the game (see resolveAttack in combat.js).
 * @returns {{ text: string, suggestedActions: string[], xp: number }}
 */
export function narrateAttack(attack, { character }) {
  const name = character.name;
  const weapon = attack.option.weapon ? `su ${attack.option.name.toLowerCase()}` : 'los puños';
  const tags = attack.rolls.map(r => `[🎲 Ataque D20: **${r.raw}** = ${r.total} vs CA ${attack.targetAC}]`).join(' ');
  const crit = attack.rolls.some(r => r.crit);
  const fumble = attack.rolls.every(r => r.fumble);

  if (attack.hits === 0) {
    return {
      text: `${name} arremete con ${weapon} ${tags} **(${fumble ? '¡Pifia!' : 'Falla'})**.

${fumble ? 'El golpe se pierde en el aire y casi acabas por los suelos entre las risas de la sala.' : 'Tu rival esquiva en el último momento y el golpe muerde la madera de una mesa.'}

—*Así no, chaval* —gruñe Duncan—. *Más muñeca y menos furia.*`,
      suggestedActions: ['Volver a atacar', 'Retroceder y buscar cobertura', 'Cambiar de arma', 'Intentar intimidarlo'],
      xp: 10
    };
  }

  const sneak = attack.sneak ? ` Aprovechas un descuido para hundir el golpe donde más duele (**+${attack.sneak.total}** de Ataque Furtivo).` : '';
  return {
    text: `${name} ataca con ${weapon} ${tags} **(${crit ? '¡CRÍTICO!' : attack.hits > 1 ? `${attack.hits} impactos` : 'Impacta'})**.

El golpe ${crit ? 'entra de lleno con un crujido que hace callar a la taberna' : 'encuentra su objetivo'}: **${attack.totalDamage}** de daño ${attack.option.type}.${sneak}

—*Eso ha tenido que doler* —comenta Duncan sin dejar de secar una jarra—. *Pero aún respira.*`,
    suggestedActions: ['Rematar la faena', 'Exigirle que se rinda', 'Retroceder y buscar cobertura', 'Registrar sus bolsillos'],
    xp: crit ? 75 : 40
  };
}

/** Narrate a rest. `kind`: 'long' | 'short'. */
export function narrateRest(kind, character) {
  if (kind === 'long') {
    return {
      text: `Duncan te lanza una llave de hierro por encima de la barra.

—*Segunda puerta. El colchón tiene más años que yo, pero las chinches ya te conocen.*

Duermes de un tirón mientras la taberna se apaga escalera abajo. Al amanecer, ${character.name} despierta como nuevo: las heridas cerradas, la mente despejada y fuerzas para lo que venga.

—*Buenos días, dormilón* —te recibe Duncan con un cuenco de gachas—. *El mundo sigue igual de peligroso que ayer. ¿Por dónde empezamos?*`,
      suggestedActions: ['Desayunar y preguntar por las novedades', 'Revisar tu equipo antes de salir', 'Salir a explorar los alrededores', 'Buscar trabajo en el tablón de anuncios']
    };
  }
  return {
    text: `Te acomodas en el banco junto a la chimenea y te concedes una hora de respiro. El calor del fuego y el murmullo de la taberna hacen su trabajo.

—*Descansa, que te hace falta* —dice Duncan, dejándote una jarra de agua al lado—. *Pero no te me duermas en el banco, que luego nadie te levanta.*`,
    suggestedActions: ['Volver a la acción', 'Observar a los parroquianos mientras descansas', 'Pedir algo de comer', 'Preguntar a Duncan por una habitación']
  };
}
