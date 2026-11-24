// Starting zones of the preset worlds: where a character begins when the
// campaign starts "cada uno desde su origen". Each zone is a settlement of the
// world map (it is added to the map of new campaigns) labelled with the 2024
// backgrounds (`backgrounds`, ids of BACKGROUNDS in srd.js) and species
// (`species`, ids of SPECIES) that fit it. Every background and every species
// fits at least one zone of each world (checked by the tests).
//
// `settlement`: kind of place (shops.js SETTLEMENTS), `x` / `y`: position on the
// map (percent), `intro`: how the story starts there, `suggestions`: first ideas.

export const START_ZONES = {
  oakhaven: [
    {
      id: 'zone-campana', name: 'Monasterio de la Campana Muda', settlement: 'village', x: 10, y: 18,
      desc: 'Muros de piedra cubiertos de liquen y una campana que nadie se atreve a tocar.',
      backgrounds: ['acolyte', 'sage'], species: ['human', 'dragonborn'],
      intro: 'Los monjes rezan a media voz alrededor de la campana muda, que esta madrugada ha sonado sola tres veces. El prior ha mandado cerrar la biblioteca y nadie explica por qué faltan dos hermanos en el refectorio.',
      suggestions: ['Preguntar al prior por la campana', 'Buscar a los hermanos desaparecidos', 'Colarse en la biblioteca cerrada', 'Rezar en la capilla y escuchar']
    },
    {
      id: 'zone-sauces', name: 'Brezal de los Sauces', settlement: 'village', x: 10, y: 82,
      desc: 'Cabañas sobre los árboles, faroles de luciérnaga y senderos que solo conocen los del bosque.',
      backgrounds: ['poacher', 'minstrel'], species: ['elf', 'halfling', 'gnome'],
      intro: 'Entre los sauces, los cazadores han vuelto con las trampas vacías y las flechas rotas. Algo grande se mueve por el brezal de noche, y las canciones del fuego hablan de un ciervo blanco con los ojos rojos.',
      suggestions: ['Seguir el rastro de las trampas rotas', 'Preguntar a los cazadores qué han visto', 'Tocar junto al fuego y escuchar las historias', 'Subir al sauce más alto a otear']
    },
    {
      id: 'zone-hierro', name: 'Minas de Hierro Viejo', settlement: 'town', x: 70, y: 14,
      desc: 'Un pueblo minero de chimeneas, forjas y galerías que se hunden bajo la colina.',
      backgrounds: ['smith', 'soldier'], species: ['dwarf', 'goliath', 'gnome'],
      intro: 'Las forjas de Hierro Viejo no se apagan nunca, pero hoy los martillos callan: la galería honda se ha derrumbado con una cuadrilla dentro, y el capataz jura que oyó golpes que no eran de pico.',
      suggestions: ['Bajar a la galería derrumbada', 'Hablar con el capataz', 'Revisar las herramientas en la forja', 'Invitar a una ronda a los mineros']
    },
    {
      id: 'zone-puente', name: 'Barrio del Puente Podrido', settlement: 'town', x: 88, y: 80,
      desc: 'Callejas sobre pilotes, tabernuchas y contrabando a la luz de los farolillos.',
      backgrounds: ['criminal', 'innkeeper', 'minstrel'], species: ['human', 'orc', 'tiefling', 'halfling'],
      intro: 'En el Puente Podrido todo tiene precio, incluido el silencio. Esta noche la guardia ha cerrado el puente y registra casa por casa: buscan a alguien que robó un sello del recaudador, y en la taberna del Anzuelo todos te miran a ti.',
      suggestions: ['Esconderse en los bajos del puente', 'Averiguar quién robó el sello', 'Servir copas y escuchar rumores', 'Sobornar a un guardia']
    }
  ],
  'cinder-citadel': [
    {
      id: 'zone-yunques', name: 'Hondonada de los Yunques', settlement: 'town', x: 8, y: 76,
      desc: 'Un enclave enano de fraguas excavadas en la roca caliente del volcán.',
      backgrounds: ['smith', 'soldier'], species: ['dwarf', 'goliath'],
      intro: 'En la Hondonada, los yunques cantan día y noche. El maestro forjador ha encontrado su sello en una espada que mató a un inquisidor, y él jura que nunca la forjó: alguien falsifica el trabajo del gremio.',
      suggestions: ['Examinar la espada falsificada', 'Hablar con el maestro forjador', 'Buscar al falsificador entre los aprendices', 'Bajar a las fraguas profundas']
    },
    {
      id: 'zone-claustro', name: 'Claustro de la Llama Fría', settlement: 'village', x: 26, y: 10,
      desc: 'Un monasterio de piedra blanca donde arde una llama que no da calor.',
      backgrounds: ['acolyte', 'sage'], species: ['human', 'dragonborn', 'tiefling'],
      intro: 'La llama fría del claustro se ha vuelto negra al amanecer. Los hermanos hablan de un mal augurio y la abadesa ha mandado copiar a toda prisa los textos prohibidos antes de que llegue la Inquisición.',
      suggestions: ['Estudiar la llama negra', 'Ayudar a copiar los textos', 'Preguntar a la abadesa qué teme', 'Vigilar el camino de la Inquisición']
    },
    {
      id: 'zone-parias', name: 'Campamento de los Parias', settlement: 'village', x: 40, y: 88,
      desc: 'Tiendas remendadas y hogueras de carbón en las laderas, lejos de las leyes de la ciudadela.',
      backgrounds: ['criminal', 'poacher'], species: ['orc', 'tiefling', 'halfling', 'elf'],
      intro: 'Los parias viven de lo que roban a las minas y de lo que cazan en las laderas. Anoche desapareció el niño del jefe del campamento, y las huellas llevan hacia los respiraderos del volcán.',
      suggestions: ['Seguir las huellas hacia los respiraderos', 'Hablar con el jefe del campamento', 'Cazar algo para la cena', 'Preguntar quién vio algo anoche']
    },
    {
      id: 'zone-escoria', name: 'Bazar de Escoria', settlement: 'city', x: 76, y: 84,
      desc: 'El arrabal comercial bajo las murallas: puestos, posadas y ruido a todas horas.',
      backgrounds: ['innkeeper', 'minstrel', 'criminal'], species: ['human', 'gnome', 'halfling'],
      intro: 'En el Bazar de Escoria se vende de todo bajo toldos manchados de hollín. Un mercader gnomo ofrece un mapa de las minas de cristal de sangre a quien le saque de la ciudad antes del toque de queda.',
      suggestions: ['Escuchar la oferta del mercader', 'Cantar en la plaza para ganar unas monedas', 'Buscar posada antes del toque de queda', 'Echar un vistazo al mapa']
    }
  ],
  'neon-2099': [
    {
      id: 'zone-capilla', name: 'Capilla del Código', settlement: 'village', x: 8, y: 20,
      desc: 'Una secta tecno-monástica que reza en binario entre servidores antiguos.',
      backgrounds: ['acolyte', 'sage'], species: ['human', 'dragonborn', 'tiefling'],
      intro: 'Los fieles de la Capilla del Código guardan el servidor más antiguo del Megabloque. Esta noche, su oráculo digital ha empezado a recitar nombres de gente que todavía no ha muerto.',
      suggestions: ['Escuchar la lista del oráculo', 'Revisar los registros del servidor', 'Preguntar al sumo archivista', 'Rastrear quién accedió al oráculo']
    },
    {
      id: 'zone-talleres', name: 'Talleres del Nivel 9', settlement: 'town', x: 42, y: 12,
      desc: 'Un barrio de mecánicos, soldadores y exmilitares que reparan lo que la ciudad tira.',
      backgrounds: ['smith', 'soldier', 'innkeeper'], species: ['dwarf', 'gnome', 'goliath'],
      intro: 'En el Nivel 9, las chispas de soldadura iluminan los pasillos. Un dron militar se ha estrellado contra el taller de la esquina y todavía emite una señal: alguien muy poderoso querrá recuperarlo.',
      suggestions: ['Desmontar el dron', 'Descifrar la señal', 'Avisar a los veteranos del barrio', 'Esconder el dron antes de que vengan']
    },
    {
      id: 'zone-invernadero', name: 'Invernadero Hidropónico Verde', settlement: 'village', x: 8, y: 86,
      desc: 'Una comuna de cultivadores bajo lámparas de crecimiento, el único verde del subnivel.',
      backgrounds: ['poacher', 'minstrel'], species: ['elf', 'halfling'],
      intro: 'El invernadero da de comer a medio subnivel. Hoy las plantas se marchitan una a una y en los conductos de agua han aparecido huellas de algo que no debería existir aquí abajo.',
      suggestions: ['Inspeccionar los conductos de agua', 'Hablar con la jefa de la comuna', 'Poner trampas junto a las tuberías', 'Animar a los cultivadores con música']
    },
    {
      id: 'zone-sinlicencia', name: 'Mercado de los Sin Licencia', settlement: 'city', x: 70, y: 90,
      desc: 'Puestos ilegales, implantes de dudosa procedencia y bares que no aparecen en ningún mapa.',
      backgrounds: ['criminal', 'minstrel', 'innkeeper'], species: ['human', 'orc', 'tiefling', 'halfling'],
      intro: 'En el mercado sin licencia, un chip robado puede valer una vida. Un perista te ofrece un trabajo fácil: entregar un paquete sellado al otro lado del bloque antes de que amanezca, sin preguntas.',
      suggestions: ['Aceptar el encargo del perista', 'Abrir el paquete a escondidas', 'Preguntar por ahí quién es el perista', 'Tomarse algo en un bar sin nombre']
    }
  ],
  'sunken-abyss': [
    {
      id: 'zone-ermita', name: 'Ermita de San Brándano', settlement: 'village', x: 12, y: 16,
      desc: 'Una ermita encalada en lo alto del acantilado, con exvotos de náufragos en las paredes.',
      backgrounds: ['acolyte', 'sage'], species: ['human', 'dragonborn'],
      intro: 'La ermita guarda los exvotos de todos los que el mar devolvió. Esta mañana, uno de ellos, un ancla de plata, apareció mojada y con algas frescas, aunque lleva un siglo colgada en la pared.',
      suggestions: ['Examinar el ancla de plata', 'Consultar el libro de náufragos', 'Hablar con el ermitaño', 'Bajar a la cala del acantilado']
    },
    {
      id: 'zone-ballenero', name: 'Puerto Ballenero de Gris', settlement: 'port', x: 14, y: 84,
      desc: 'Muelles grasientos, astilleros y tabernas de arponeros con olor a aceite de ballena.',
      backgrounds: ['soldier', 'innkeeper', 'criminal', 'smith'], species: ['human', 'orc', 'dwarf', 'goliath'],
      intro: 'En Gris, los balleneros han vuelto con las redes cortadas y un tripulante de menos. El capitán del puerto busca gente dura para escoltar la próxima salida, y paga por adelantado.',
      suggestions: ['Ofrecerse al capitán del puerto', 'Preguntar por el tripulante perdido', 'Revisar los arpones del astillero', 'Escuchar a los borrachos del muelle']
    },
    {
      id: 'zone-perlas', name: 'Islote de los Pescadores de Perlas', settlement: 'village', x: 46, y: 90,
      desc: 'Palafitos sobre aguas turquesa donde los buceadores contienen el aliento durante minutos.',
      backgrounds: ['poacher', 'minstrel'], species: ['halfling', 'elf', 'gnome'],
      intro: 'Los pescadores de perlas del islote cantan para no oír lo que hay bajo el agua. Hoy un buceador ha subido con una perla negra del tamaño de un puño... y no ha vuelto a hablar desde entonces.',
      suggestions: ['Examinar la perla negra', 'Bucear donde la encontró', 'Cantar con los pescadores', 'Cuidar del buceador mudo']
    },
    {
      id: 'zone-archivo', name: 'Archivo de la Sociedad de Cartógrafos', settlement: 'town', x: 72, y: 12,
      desc: 'Un caserón lleno de cartas marinas, astrolabios y mapas de costas que ya no existen.',
      backgrounds: ['sage', 'minstrel'], species: ['gnome', 'elf', 'tiefling'],
      intro: 'En el archivo de los cartógrafos, una carta marina recién llegada dibuja una isla que no estaba ayer. La presidenta de la Sociedad quiere que alguien la verifique antes de que la vean los Hijos del Abismo.',
      suggestions: ['Estudiar la carta marina', 'Hablar con la presidenta', 'Buscar mapas antiguos de la zona', 'Averiguar quién trajo la carta']
    }
  ]
};

/** The zones of a preset world (copies, so a campaign can't change the data). */
export const presetZones = worldId => (START_ZONES[worldId] || []).map(z => ({ ...z, backgrounds: [...z.backgrounds], species: [...z.species], suggestions: [...z.suggestions] }));
