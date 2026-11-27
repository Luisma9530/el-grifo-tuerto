// Narration of ability checks outside combat: the local engine's own (no AI), and
// the outcome Duncan wrote for each case when Gemini set the check (see checks.js).

const pick = (list, rng) => list[Math.floor(rng() * list.length) % list.length];

/** What the local engine says for each kind of check (LOCAL_DC_TABLE in checks.js). */
const LINES = {
  lock: {
    intro: 'Te arrodillas ante la cerradura y sacas las ganzúas, aguantando la respiración',
    win: 'Un chasquido seco: los pernos ceden uno a uno y la cerradura se rinde.',
    lose: 'La ganzúa resbala, el mecanismo se traba y alguien podría haber oído el roce del metal.'
  },
  pickpocket: {
    intro: 'Te arrimas con aire distraído, la mano lista bajo la capa',
    win: 'Tus dedos rozan la faja y vuelven con una bolsa de cuero abultada: **12 monedas de oro** que nadie echa en falta.',
    lose: 'La víctima se palpa la faja justo cuando tu mano se acerca y te clava una mirada de pocos amigos.',
    gold: 12
  },
  hide: {
    intro: 'Te deslizas hacia las sombras, midiendo cada paso',
    win: 'Te funden la penumbra y el silencio: nadie nota que estás ahí.',
    lose: 'Un tablón cruje bajo tu peso y varias cabezas se giran hacia ti.'
  },
  climb: {
    intro: 'Buscas asideros y empiezas a subir',
    win: 'Encuentras un ritmo seguro y llegas arriba con los brazos ardiendo, pero entero.',
    lose: 'Un asidero se desmorona y caes de espaldas *(pierdes 3 PG)*.',
    damage: 3
  },
  swim: {
    intro: 'Te lanzas al agua, que está más fría de lo que parecía',
    win: 'Braceas con fuerza y alcanzas la otra orilla, chorreando y satisfecho.',
    lose: 'El agua te arrastra, tragas más de la cuenta y sales a duras penas *(pierdes 2 PG)*.',
    damage: 2
  },
  jump: {
    intro: 'Tomas carrerilla y saltas',
    win: 'Aterrizas al otro lado con agilidad felina.',
    lose: 'Te quedas corto y aterrizas de mala manera *(pierdes 2 PG)*.',
    damage: 2
  },
  force: {
    intro: 'Apoyas el hombro, aprietas los dientes y empujas con todo',
    win: 'Con un crujido de madera vieja, el obstáculo cede.',
    lose: 'No se mueve ni un dedo; solo consigues un hombro dolorido y mucho ruido.'
  },
  grapple: {
    intro: 'Te abalanzas para sujetarlo',
    win: 'Lo inmovilizas con una llave firme: ya no va a ninguna parte.',
    lose: 'Se zafa con un tirón y queda fuera de tu alcance.'
  },
  balance: {
    intro: 'Abres los brazos y avanzas paso a paso',
    win: 'Cruzas sin un solo traspié.',
    lose: 'Un pie resbala y tienes que agarrarte como puedes para no caer.'
  },
  deceive: {
    intro: 'Pones tu mejor cara de inocencia y sueltas la mentira',
    win: 'Se lo traga sin pestañear: asiente y hasta te da las gracias.',
    lose: 'Entorna los ojos: no se cree ni una palabra y ahora desconfía de ti.'
  },
  intimidate: {
    intro: 'Te acercas demasiado, bajas la voz y dejas que tu mirada haga el resto',
    win: 'Traga saliva y retrocede: hará lo que digas.',
    lose: 'Te sostiene la mirada sin inmutarse y una sonrisa burlona le cruza la cara.'
  },
  persuade: {
    intro: 'Expones tus razones con calma y buenas palabras',
    win: 'Lo piensa un momento... y acepta. Has sabido tocar la tecla justa.',
    lose: 'Niega con la cabeza: hoy no vas a convencerle.'
  },
  perform: {
    intro: 'Te subes a una mesa y empiezas la función',
    win: 'La sala estalla en aplausos y alguna moneda vuela hacia tus pies.',
    lose: 'Silbidos, un mendrugo de pan al vuelo y una retirada digna... más o menos.'
  },
  readPerson: {
    intro: 'Observas sus gestos y el temblor de su voz',
    win: 'Lo ves claro: hay algo que no te está contando.',
    lose: 'No consigues leerle; o dice la verdad, o miente muy bien.'
  },
  track: {
    intro: 'Te agachas a estudiar el suelo y las ramas rotas',
    win: 'Encuentras el rastro y sabes hacia dónde fue.',
    lose: 'Las huellas se pierden y das vueltas en círculo.'
  },
  heal: {
    intro: 'Te arremangas y examinas la herida',
    win: 'Un buen vendaje: la hemorragia se corta y el herido respira mejor.',
    lose: 'Las vendas no aguantan y la herida sigue sangrando.'
  },
  animal: {
    intro: 'Te acercas despacio, con la mano tendida y voz tranquila',
    win: 'El animal resopla, se calma y acepta tu mano.',
    lose: 'El animal se encabrita y se aparta de ti con desconfianza.'
  },
  arcana: {
    intro: 'Repasas lo que sabes de los saberes arcanos',
    win: 'Reconoces el patrón: sabes qué es y para qué sirve.',
    lose: 'Las formas te bailan delante de los ojos sin decirte nada.'
  },
  religion: {
    intro: 'Rebuscas en tu memoria entre ritos y plegarias',
    win: 'Lo recuerdas: sabes a qué culto pertenece y qué significa.',
    lose: 'No te suena de nada; tendrás que preguntar a un sacerdote.'
  },
  nature: {
    intro: 'Lo observas con atención, recordando lo que sabes del mundo salvaje',
    win: 'Lo reconoces al instante y sabes para qué sirve... y qué evitar.',
    lose: 'No sabrías decir qué es; mejor no probarlo.'
  },
  history: {
    intro: 'Te frotas la frente intentando recordar',
    win: 'Te viene a la memoria una vieja historia que encaja con esto.',
    lose: 'Lo tienes en la punta de la lengua, pero no hay manera.'
  },
  search: {
    intro: 'Lo registras todo con calma, palmo a palmo',
    win: 'Das con algo que a otros se les habría pasado por alto.',
    lose: 'Revuelves por todas partes y no encuentras nada que valga la pena.'
  },
  notice: {
    intro: 'Aguzas el oído y la vista',
    win: 'Captas un detalle que cambia las cosas: no estás solo.',
    lose: 'Nada fuera de lo normal... o eso parece.'
  },
  generic: {
    intro: 'Lo intentas con todo lo que tienes',
    win: 'Sale como esperabas: superas el obstáculo y ganas algo de ventaja.',
    lose: 'Te quedas corto y la ocasión se te escapa entre los dedos.'
  }
};

const WIN_QUOTES = [
  '—*No está mal, %s. Has abierto camino; ahora aprovéchalo antes de que alguien se lo piense dos veces.*',
  '—*Así se hace, demonios* —gruñe Duncan desde la barra—. *¿Y ahora qué?*',
  '—*Con esa mano, lo que te propongas esta noche está a tu alcance* —dice Duncan, secando una jarra.'
];
const LOSE_QUOTES = [
  '—*Hoy no era tu día para eso, %s. Prueba otra cosa... o invita a una ronda y aquí no ha pasado nada.*',
  '—*He visto borrachos hacerlo mejor* —se ríe Duncan—. *Levanta y dime qué plan tienes ahora.*',
  '—*Eso no ha colado* —Duncan chasquea la lengua—. *Piensa otra cosa, rápido.*'
];

const verdict = check => (check.isNat20 ? '**¡CRÍTICO!**' : check.isNat1 ? '**¡PIFIA!**' : check.success ? '**(Éxito)**' : '**(Fallo)**');

/** Why the DC is what it is, in a short line: "CD 20: +5: es una obra de calidad". */
export function describeDifficulty(plan) {
  if (!plan?.reasons?.length) return '';
  return `*(Duncan lo ve venir: ${plan.reasons.map(r => r.replace(/^[+−]\d+: /, '')).join('; ')}.)*`;
}

/**
 * The local engine's narration of a check it planned and rolled.
 * @returns {{ text, suggestedActions, damageTaken, goldEarned }}
 */
export function narrateLocalCheck(plan, check, { character, rng = Math.random }) {
  const lines = LINES[plan.kind] || LINES.generic;
  const name = character?.name || 'forastero';
  const won = check.success;
  const damage = !won && lines.damage ? lines.damage + (check.isNat1 ? 1 : 0) : 0;
  const gold = won && lines.gold ? lines.gold : 0;
  const difficulty = describeDifficulty(plan);
  const quote = pick(won ? WIN_QUOTES : LOSE_QUOTES, rng).replace('%s', name);
  const text = `${lines.intro} ${check.tag} ${verdict(check)}.

${won ? lines.win : lines.lose}${difficulty ? `\n\n${difficulty}` : ''}

${quote}`;
  return {
    text,
    damageTaken: damage,
    goldEarned: gold,
    suggestedActions: won
      ? ['Aprovechar la ventaja y seguir adelante', 'Examinar con calma lo que has conseguido', 'Preguntar a Duncan qué sabe del asunto', 'Brindar por la hazaña en la barra']
      : ['Intentarlo de otra manera', 'Pedir ayuda a los compañeros', 'Disimular y pedir una jarra', 'Preguntar a Duncan por otra opción']
  };
}

/**
 * Duncan's narration with the check the game rolled: his lead-in, the roll and
 * the outcome he wrote for that case (a short generic line if he left it empty).
 */
export function narrateDuncanCheck(leadIn, check, outcome) {
  const kind = LINES.generic;
  const result = outcome?.text || (check.success ? kind.win : kind.lose);
  return `${leadIn}\n\n${check.tag} ${verdict(check)}\n\n${result}`;
}
