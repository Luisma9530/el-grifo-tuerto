// Preset Worlds, Characters, Factions and Tavern Data for El Grifo Tuerto

export const PRESET_WORLDS = [
  {
    id: 'oakhaven',
    name: 'Oakhaven y el Bosque Umbrío',
    genre: 'Fantasía Oscura',
    difficulty: 'Equilibrado',
    tagline: 'Niebla espesa, árboles antiguos con rostros y secretos que acechan tras la barra.',
    description: 'Un rincón olvidado del reino donde los aldeanos no salen tras el ocaso. En el corazón del bosque se encuentra La Taberna del Jabalí Sombrío, el único refugio iluminado por faroles de grasa de troll.',
    coverGradient: 'from-amber-950 via-stone-900 to-emerald-950',
    bannerBadge: 'Mundo Más Popular',
    initialLocation: 'Taberna del Jabalí Sombrío',
    factions: [
      { name: 'Guardia de Oakhaven', status: 'Neutral', rep: 50, color: 'text-blue-400' },
      { name: 'Círculo de la Niebla', status: 'Hostil', rep: 20, color: 'text-red-400' },
      { name: 'Contrabandistas del Río', status: 'Amistoso', rep: 75, color: 'text-amber-400' }
    ],
    mapNodes: [
      { id: 'tavern', name: 'Taberna del Jabalí', settlement: 'tavern', status: 'current', x: 25, y: 50, desc: 'Fuego encendido, olor a estofado de ciervo y cerveza rancia.' },
      { id: 'mill', name: 'Viejo Molino Quebrado', settlement: null, status: 'discovered', x: 45, y: 30, desc: 'Ruedas atascadas con huesos antiguos. Se oyen murmullos.' },
      { id: 'dock', name: 'Embarcadero de Niebla', settlement: 'port', status: 'discovered', x: 55, y: 70, desc: 'Balsas cubiertas de algas y farolillos verdes flotando.' },
      { id: 'ruins', name: 'Túmulo de Obsidiana', settlement: null, status: 'locked', x: 80, y: 45, desc: 'Runas élficas profanadas por garras no humanas.' }
    ],
    initialStory: `El viento aúlla contra los tablones de roble de la taberna. Fuera, la niebla del bosque de Oakhaven es tan espesa que no se ven ni las botas.

Al otro lado de la barra, **Maese Duncan** se limpia las manos en un delantal con manchas que prefieres no analizar mientras acomoda su parche de cuero negro. Te clava una mirada entrecerrada con su pipa humeante entre los dientes.

—*Menuda noche para asomar el hocico, forastero* —suelta Duncan con un carraspeo rasposo, golpeando una jarra espumosa sobre el mostrador—. *La guardia dice que la bestia del río destrozó la balsa del recaudador hace dos horas. Y en la mesa del rincón... ese encapuchado no ha dejado de mirarte desde que cruzaste la puerta.*

Duncan se apoya con ambos codos y te guiña un ojo:
—*¿Vas a beber, vas a preguntar o vas a buscar problemas antes de que se enfríe el estofado?*`
  },
  {
    id: 'cinder-citadel',
    name: 'La Ciudadela de Ceniza',
    genre: 'Grimdark & Alta Fantasía',
    difficulty: 'Difícil',
    tagline: 'Caballeros herejes, cielos de azufre y ceniza que cae como nieve negra.',
    description: 'Bajo la sombra del Volcán Durmiente de Kar-Thun, las forjas nunca descansan. En la taberna "El Crisol Agrietado", los mercenarios beben antes de su descenso a las minas de cristal de sangre.',
    coverGradient: 'from-orange-950 via-red-950 to-stone-900',
    bannerBadge: 'Desafío Hardcore',
    initialLocation: 'El Crisol Agrietado',
    factions: [
      { name: 'Inquisición de Fuego', status: 'Hostil', rep: 10, color: 'text-red-400' },
      { name: 'Gremio de la Forja', status: 'Neutral', rep: 50, color: 'text-amber-400' },
      { name: 'Parias de las Minas', status: 'Amistoso', rep: 80, color: 'text-emerald-400' }
    ],
    mapNodes: [
      { id: 'tavern', name: 'El Crisol Agrietado', settlement: 'tavern', status: 'current', x: 20, y: 40, desc: 'Calor sofocante, taburetes de hierro forjado y jarras de metal.' },
      { id: 'gates', name: 'Puertas del Martillo', settlement: 'city', status: 'discovered', x: 45, y: 25, desc: 'Guardias con armaduras al rojo vivo pidiendo salvoconducto.' },
      { id: 'mines', name: 'Boca de la Fosa 4', settlement: null, status: 'discovered', x: 60, y: 65, desc: 'Cables chirriantes bajando jaulas al abismo.' },
      { id: 'sanctum', name: 'Templo de Brasas', settlement: null, status: 'locked', x: 85, y: 35, desc: 'Ecos de cánticos guturales y sacrificios de metal líquido.' }
    ],
    initialStory: `El aire sabe a azufre y metal chamuscado. En "El Crisol Agrietado", los enanos y soldados beben cerveza espesa con copos de ceniza flotando en la espuma.

Maese Duncan golpea un mazo contra un barril para llamar tu atención:
—*Si buscas trabajo fácil, te has equivocado de continente. La Inquisición acaba de doblar la recompensa por cualquier portador de magia salvaje. Y tu mochila vibra con un brillo sospechoso, amigo.*

Un grupo de tres mercenarios con marcas de quemaduras en los brazos gira sus cabezas hacia ti, tocando los pomos de sus mandobles.

—*Tienes diez segundos antes de que alguien aquí decida cobrar la recompensa* —masulla Duncan en voz baja mientras desliza un frasco con líquido azul bajo la barra—. *¿Qué vas a hacer?*`
  },
  {
    id: 'neon-2099',
    name: 'Callejón Neón 2099',
    genre: 'Cyberpunk & Sci-Fi Noir',
    difficulty: 'Dinámico',
    tagline: 'Lluvia ácida, ciberimplantes ilegales y fideos sintéticos en los bajos fondos.',
    description: 'En el subnivel 14 del Megabloque Babel, la taberna "The Griffin\'s Synth & Brew" es el único sitio donde los hackers, samuráis callejeros y androides fugitivos pueden beber sin que los drones corporativos los escaneen.',
    coverGradient: 'from-cyan-950 via-purple-950 to-stone-900',
    bannerBadge: 'Sci-Fi Especial',
    initialLocation: 'The Griffin\'s Synth & Brew (Subnivel 14)',
    factions: [
      { name: 'Zaibatsu Kuroshio', status: 'Hostil', rep: 15, color: 'text-red-400' },
      { name: 'Ghost Runners', status: 'Amistoso', rep: 70, color: 'text-cyan-400' },
      { name: 'Sindicato Neón', status: 'Neutral', rep: 45, color: 'text-amber-400' }
    ],
    mapNodes: [
      { id: 'tavern', name: 'The Griffin\'s Synth & Brew', settlement: 'tavern', status: 'current', x: 25, y: 55, desc: 'Tubos de neón parpadeantes, vapor y música sintetizada Lo-Fi.' },
      { id: 'market', name: 'Bazar del Cromo Negro', settlement: 'city', status: 'discovered', x: 45, y: 75, desc: 'Puestos de prótesis de segunda mano y chips de memoria crackeados.' },
      { id: 'subway', name: 'Línea Maglev Abandonada', settlement: null, status: 'discovered', x: 65, y: 35, desc: 'Graffitis holográficos y pandillas con katanas de plasma.' },
      { id: 'tower', name: 'Ascensor a Babel Prime', settlement: null, status: 'locked', x: 85, y: 60, desc: 'Torretas automáticas blindadas protegiendo los pisos ejecutivos.' }
    ],
    initialStory: `Lluvia ácida resbala por el letrero de neón rosa parpadeante: *"GRIFFIN'S - SINCE 2041"*. El humo sintético huele a ozono y especias baratas de ramen.

Maese Duncan tiene un brazo cibernético de cromo desgastado con el que desenrosca tres botellas de biolicores al mismo tiempo. Sus ojos con óptica Nikon de grado militar enfocan tu comunicador.

—*Tu deck neuronal acaba de registrar una intrusión de rango ICE-4, chaval* —dice con una voz amplificada por un sintetizador vocal ronco—. *Una ejecutiva de Kuroshio acaba de pagar 50.000 créditos por el chip que traes en el bolsillo izquierdo. Hay dos cibermatones esperándote en el callejón trasero.*

Duncan te sirve un vaso humeante que brilla en verde eléctrico:
—*Bébete esto si quieres que tus reflejos funcionen a tiempo. ¿Hackeas la puerta, desenfundas el calibre .45 o intentas hablarles en su propio lenguaje corporativo?*`
  },
  {
    id: 'sunken-abyss',
    name: 'El Arrecife de los Ahogados',
    genre: 'Terror Náutico & Lovecraft',
    difficulty: 'Pesadilla',
    tagline: 'Olas negras, faros que alumbran monstruos y canciones bajo el mar.',
    description: 'Una taberna construida dentro del casco invertido de un galeón español encallado en los arrecifes de San Brándano. Aquí se sientan los supervivientes que escucharon las campanas submarinas.',
    coverGradient: 'from-blue-950 via-teal-950 to-stone-950',
    bannerBadge: 'Terror Lovecraft',
    initialLocation: 'La Quilla del Holandés',
    factions: [
      { name: 'Hijos del Abismo', status: 'Hostil', rep: 5, color: 'text-red-400' },
      { name: 'Arponeros de Bruma', status: 'Neutral', rep: 50, color: 'text-cyan-400' },
      { name: 'Sociedad de Cartógrafos', status: 'Amistoso', rep: 65, color: 'text-amber-400' }
    ],
    mapNodes: [
      { id: 'tavern', name: 'La Quilla del Holandés', settlement: 'tavern', status: 'current', x: 30, y: 50, desc: 'Maderas crujientes con caracolas y olor a salitre y ron negro.' },
      { id: 'lighthouse', name: 'El Faro Ciego', settlement: null, status: 'discovered', x: 50, y: 25, desc: 'La linterna rota aún emite un zumbido verdoso a medianoche.' },
      { id: 'graveyard', name: 'Cementerio de Quillas', settlement: null, status: 'discovered', x: 70, y: 70, desc: 'Mástiles partidos saliendo del agua como costillas de ballena.' },
      { id: 'trench', name: 'La Fosa de Coral Negro', settlement: null, status: 'locked', x: 88, y: 40, desc: 'Burbujas heladas que traen susurros en una lengua antediluviana.' }
    ],
    initialStory: `El mar rompe contra el casco con una violencia sorda. Cada ola hace temblar los candiles de aceite de ballena que cuelgan de las vigas encorvadas de "La Quilla".

Maese Duncan cojea con una pata de palo tallada en hueso de cachalote. Deja una botella de ron que parece haber estado cien años en el fondo de la fosa.

—*No mires por el ojo de buey, muchacho* —gruñe Duncan con voz grave como el trueno en la mar—. *Las cosas que nadan ahí fuera no tienen aletas, tienen dedos. Y esta marea ha traído el medallón que tu abuelo perdió en el naufragio del 'Santa Clara'. Lo tiene el viejo marinero tuerto de la esquina... y no parece vivo del todo.*

Un olor a algas podridas y salitre inunda la sala.
—*¿Vas a sacar la navaja de desollar, vas a ofrecerle una moneda de plata bendecida, o saltas a por la escotilla?*`
  }
];

export const PRESET_CHARACTERS = [
  {
    id: 'kaelen',
    name: 'Kaelen Sombraveloz',
    race: 'Elfo Silvano',
    class: 'Pícaro (Nivel 3)',
    hp: 28,
    maxHp: 28,
    ac: 15,
    gold: 42,
    avatar: '🧝‍♂️',
    stats: { fue: 10, des: 17, con: 12, int: 13, sab: 14, car: 15 },
    inventory: [
      { id: 'daga', name: 'Daga de Acero Toledano', type: 'weapon', bonus: '+5 al ataque, 1d4+3 daño' },
      { id: 'pocion1', name: 'Poción de Curación Menor', type: 'consumable', effect: 'Recupera 2d4+2 HP', uses: 2 },
      { id: 'ganzua', name: 'Juego de Ganzúas Finas', type: 'tool', desc: '+2 a abrir cerraduras' },
      { id: 'capa', name: 'Capa de Viajero Embadurnada', type: 'armor', desc: '+1 a Sigilo en niebla' }
    ],
    backstory: 'Creció en los callejones del barrio bajo de Oakhaven. Nunca conoció a sus padres pero sabe abrir cualquier cofre del reino.'
  },
  {
    id: 'brog',
    name: 'Brog Rompehuesos',
    race: 'Semi-Orco',
    class: 'Bárbaro (Nivel 3)',
    hp: 39,
    maxHp: 39,
    ac: 14,
    gold: 18,
    avatar: '👹',
    stats: { fue: 18, des: 13, con: 16, int: 8, sab: 11, car: 10 },
    inventory: [
      { id: 'gran_hacha', name: 'Gran Hacha Mellada de Dos Manos', type: 'weapon', bonus: '+6 al ataque, 1d12+4 daño' },
      { id: 'pocion_furia', name: 'Licor de Raíz Negra', type: 'consumable', effect: '+2 a tiradas de Fuerza por 1 hora', uses: 1 },
      { id: 'colgante', name: 'Collar de Dientes de Oso', type: 'relic', desc: 'Recuerdo de su primera cacería' }
    ],
    backstory: 'Exiliado de su clan por negarse a quemar una aldea pacífica. Ahora busca redención resolviendo problemas a golpes de hacha.'
  },
  {
    id: 'lyra',
    name: 'Lyra la Astrónoma',
    race: 'Humana',
    class: 'Maga Arcanista (Nivel 3)',
    hp: 22,
    maxHp: 22,
    ac: 12,
    gold: 65,
    avatar: '🧙‍♀️',
    stats: { fue: 8, des: 14, con: 12, int: 18, sab: 13, car: 11 },
    inventory: [
      { id: 'vara', name: 'Vara de Roble Plateado', type: 'weapon', bonus: '+6 al impacto mágico, 1d8 arcano' },
      { id: 'pergamino', name: 'Pergamino de Bola de Fuego', type: 'consumable', effect: '8d6 de daño de fuego en área', uses: 1 },
      { id: 'grimorio', name: 'Grimorio de Fórmulas Ocultas', type: 'tome', desc: 'Contiene hechizos de utilidad' },
      { id: 'pocion_mana', name: 'Elixir de Polvo Estelar', type: 'consumable', effect: 'Restaura 2 ranuras de conjuro', uses: 2 }
    ],
    backstory: 'Expulsada de la Real Academia por investigar grimorios prohibidos sobre los dioses exteriores. Duncan es uno de sus pocos aliados.'
  },
  {
    id: 'valeria',
    name: 'Valeria Luz del Alba',
    race: 'Humana',
    class: 'Paladín de la Devoción (Nivel 3)',
    hp: 34,
    maxHp: 34,
    ac: 18,
    gold: 30,
    avatar: '🛡️',
    stats: { fue: 16, des: 10, con: 15, int: 10, sab: 12, car: 16 },
    inventory: [
      { id: 'espada', name: 'Espada Larga Consagrada', type: 'weapon', bonus: '+5 al ataque, 1d8+3 (+1d8 radiante)' },
      { id: 'escudo', name: 'Escudo de Acero con Emblema Solar', type: 'armor', bonus: '+2 CA' },
      { id: 'pocion_sanar', name: 'Agua Bendita de San Rafael', type: 'consumable', effect: 'Cura 2d4+4 o daña no-muertos', uses: 1 }
    ],
    backstory: 'Caballero andante con una brújula moral inquebrantable que a menudo choca con el pragmatismo canalla de Maese Duncan.'
  }
];

export const TAVERN_MENU = [
  { id: 'ale', name: 'Cerveza Negra del Enano Minero', cost: 2, icon: '🍺', effect: '+5 HP temporal y eructo atronador que asusta ratas' },
  { id: 'mead', name: 'Hidromiel de Fuego de Dragón', cost: 5, icon: '🔥', effect: '+2 a Tiradas de Fuerza en tu próximo turno, ardor en la garganta' },
  { id: 'stew', name: 'Guiso Tradicional del Grifo', cost: 3, icon: '🍲', effect: 'Recupera 1d8 HP (Duncan jura que la carne es de ciervo, casi seguro)' },
  { id: 'wine', name: 'Vino Élfico del Bosque Crepuscular', cost: 8, icon: '🍷', effect: '+2 a Percepción y tiradas de Carisma por 3 turnos' },
  { id: 'pipe', name: 'Tabaco de Pipa de Maese Duncan', cost: 4, icon: '🌿', effect: 'Baja el estrés del grupo y otorga inspiración de Duncan' }
];

export const FAQS = [
  {
    q: '¿Es realmente gratis? ¿Hay que registrarse?',
    a: 'Sí, es gratis y no hay cuentas ni suscripciones. Abres la página y juegas. Tus partidas se guardan en tu propio navegador.'
  },
  {
    q: '¿Cómo se crea el personaje?',
    a: 'Cada campaña empieza creando a tu héroe paso a paso con las reglas de D&D 2024: clase, trasfondo, especie, características (conjunto estándar, compra de puntos o tirando dados), competencias e identidad. Si tienes prisa, el botón "Héroe al azar" te genera uno completo que puedes retocar. Todos empiezan en nivel 1.'
  },
  {
    q: '¿Mi personaje sube de nivel?',
    a: 'Sí, hasta el nivel 20, como en las reglas. Ganas experiencia al superar retos: combates, hechizos certeros, pruebas difíciles... Cuando tienes suficiente, aparece el botón «Subir de nivel» en tu ficha: eliges si tiras el dado de golpe o tomas la media, recibes los rasgos de tu clase y subclase, mejoras de característica, un Don Épico a nivel 19 y, si lanzas conjuros, aprendes nuevos hasta llegar a los de nivel 9.'
  },
  {
    q: '¿Cómo funcionan los combates?',
    a: 'Los combates nacen de la historia: cuando atacas a alguien o alguien te ataca, Maese Duncan (o el motor local si juegas sin IA) elige a los enemigos del bestiario (127 criaturas del SRD, de goblins a dragones antiguos) según tu nivel y tu mundo. El juego lleva la iniciativa, la vida y los ataques de cada enemigo; tú atacas, lanzas conjuros, bebes pociones, esquivas o huyes. Los enemigos malheridos pueden huir o rendirse, y al vencer ganas la experiencia de cada criatura. Para practicar o repetir un combate perdido está el Simulador de combates, que nunca cambia tu campaña.'
  },
  {
    q: '¿Cómo se resuelven los ataques?',
    a: 'En la vista de combate: eliges un arma equipada (o un golpe sin armas) y el juego tira el ataque contra la armadura del objetivo y el daño, con tus modificadores, Ataque Adicional, Ataque Furtivo o Furia si los tienes. Maese Duncan solo narra el resultado. En la mochila puedes equipar y desequipar armas.'
  },
  {
    q: '¿Cómo funciona la magia?',
    a: 'Los lanzadores de conjuros eligen sus trucos y conjuros de nivel 1 al crear el personaje. En la pestaña "Conjuros" de la ficha los lanzas con un clic: el juego tira el ataque, el daño o la curación con los dados 3D y Maese Duncan narra el resultado. Los trucos son ilimitados; los conjuros gastan espacios, que recuperas descansando en la posada.'
  },
  {
    q: '¿Necesito saber las reglas de D&D 5ª Edición para jugar?',
    a: '¡Para nada! Tú solo escribes o eliges qué quieres que haga tu personaje con tus propias palabras. El juego tira los dados, aplica los modificadores de tu ficha y Maese Duncan narra lo que ocurre.'
  },
  {
    q: '¿Dónde se guardan mis partidas? ¿Puedo perderlas?',
    a: 'Se guardan automáticamente en este navegador. Si borras los datos de navegación o cambias de dispositivo, no estarán allí: por eso el Grimorio de Campañas te deja exportar tus partidas a un archivo .json e importarlas en cualquier otro navegador.'
  },
  {
    q: '¿Puedo jugar con amigos?',
    a: 'El Grifo Tuerto es una experiencia en solitario: cada jugador vive su propia aventura en su navegador. Puedes compartir la página con tus amigos, o exportar tu campaña y enviársela para que la continúen por su cuenta.'
  },
  {
    q: '¿Puedo crear mi propio mundo o usar ambientaciones sci-fi?',
    a: `¡Totalmente! Además de los mundos incluidos (${PRESET_WORLDS.map(w => w.name).join(', ')}), con la "Forja de Mundos" puedes definir tu propia ambientación: cyberpunk, fantasía medieval, western sobrenatural, terror cósmico...`
  },
  {
    q: '¿Qué diferencia hay entre el motor local y conectar Google Gemini?',
    a: 'El motor local funciona sin configurar nada, con respuestas predefinidas según el tipo de acción. Si conectas tu propia clave gratuita de Google AI Studio, Maese Duncan pasa a narrar con IA: improvisa, recuerda la crónica reciente y aplica daño y oro a tu ficha. La clave se queda en tu navegador, y el uso gratuito depende de los límites que fije Google.'
  }
];
