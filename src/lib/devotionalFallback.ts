// Deterministic 365-day devotional fallback.
// Same date (in America/New_York) → same devotional for every user, every device.
// Used when the database has no entry AND AI generation is unavailable.

export type FallbackLang = "pt" | "en" | "es";

interface Seed {
  ref: string;
  verse: { pt: string; en: string; es: string };
  title: { pt: string; en: string; es: string };
  reflection: { pt: string; en: string; es: string };
  application: { pt: string; en: string; es: string };
  prayer: { pt: string; en: string; es: string };
}

// Curated evergreen passages. Cycled by day-of-year so day N always maps to SEEDS[(N-1) % SEEDS.length].
const SEEDS: Seed[] = [
  {
    ref: "John 3:16",
    verse: {
      pt: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.",
      en: "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.",
      es: "Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.",
    },
    title: { pt: "O Amor que Salva", en: "The Love That Saves", es: "El Amor que Salva" },
    reflection: {
      pt: "O amor de Deus não é uma ideia distante: é um presente concreto em Jesus. Hoje, lembre-se de que você é amado antes mesmo de tentar merecer.",
      en: "God's love is not a distant idea: it is a concrete gift in Jesus. Today, remember that you are loved before you ever try to earn it.",
      es: "El amor de Dios no es una idea lejana: es un regalo concreto en Jesús. Hoy, recuerda que eres amado antes incluso de intentar merecerlo.",
    },
    application: {
      pt: "Reserve um momento para agradecer pelo dom da vida eterna e compartilhe esse amor com alguém hoje.",
      en: "Take a moment to thank God for the gift of eternal life and share that love with someone today.",
      es: "Tómate un momento para agradecer el don de la vida eterna y comparte ese amor con alguien hoy.",
    },
    prayer: {
      pt: "Pai, obrigado pelo teu amor que me alcança em Cristo. Que eu viva hoje consciente dessa graça. Em nome de Jesus, amém.",
      en: "Father, thank you for your love that reaches me in Christ. May I live today aware of that grace. In Jesus' name, amen.",
      es: "Padre, gracias por tu amor que me alcanza en Cristo. Que viva hoy consciente de esa gracia. En el nombre de Jesús, amén.",
    },
  },
  {
    ref: "Psalm 23:1",
    verse: {
      pt: "O Senhor é o meu pastor; nada me faltará.",
      en: "The Lord is my shepherd; I shall not want.",
      es: "Jehová es mi pastor; nada me faltará.",
    },
    title: { pt: "Pastor Fiel", en: "Faithful Shepherd", es: "Pastor Fiel" },
    reflection: {
      pt: "Quando Davi chama Deus de pastor, ele descansa em uma promessa: alguém cuida dele. Você não precisa carregar tudo sozinho hoje.",
      en: "When David calls God his shepherd, he rests in a promise: someone is caring for him. You do not need to carry everything alone today.",
      es: "Cuando David llama a Dios su pastor, descansa en una promesa: alguien cuida de él. No necesitas cargar con todo solo hoy.",
    },
    application: {
      pt: "Identifique uma preocupação e entregue-a a Deus em oração antes de começar suas tarefas.",
      en: "Identify one worry and hand it over to God in prayer before you begin your tasks.",
      es: "Identifica una preocupación y entrégasela a Dios en oración antes de comenzar tus tareas.",
    },
    prayer: {
      pt: "Senhor, tu és meu pastor. Confio que cuidarás de mim hoje em cada passo. Amém.",
      en: "Lord, you are my shepherd. I trust that you will care for me today in every step. Amen.",
      es: "Señor, tú eres mi pastor. Confío en que cuidarás de mí hoy en cada paso. Amén.",
    },
  },
  {
    ref: "Philippians 4:13",
    verse: {
      pt: "Posso todas as coisas naquele que me fortalece.",
      en: "I can do all things through him who strengthens me.",
      es: "Todo lo puedo en Cristo que me fortalece.",
    },
    title: { pt: "Força em Cristo", en: "Strength in Christ", es: "Fuerza en Cristo" },
    reflection: {
      pt: "A força que Paulo descreve não vem de dentro: vem de Cristo. Hoje, troque o 'eu não consigo' por 'Cristo me capacita'.",
      en: "The strength Paul describes does not come from within: it comes from Christ. Today, trade 'I can't' for 'Christ enables me.'",
      es: "La fuerza que describe Pablo no viene de dentro: viene de Cristo. Hoy, cambia el 'no puedo' por 'Cristo me capacita'.",
    },
    application: {
      pt: "Em vez de evitar o desafio do dia, ore antes e siga em frente confiando na força de Cristo.",
      en: "Instead of avoiding today's challenge, pray first and step forward trusting in Christ's strength.",
      es: "En lugar de evitar el desafío del día, ora primero y avanza confiando en la fuerza de Cristo.",
    },
    prayer: {
      pt: "Jesus, em ti tenho a força que preciso. Capacita-me hoje. Amém.",
      en: "Jesus, in you I have the strength I need. Empower me today. Amen.",
      es: "Jesús, en ti tengo la fuerza que necesito. Capacítame hoy. Amén.",
    },
  },
  {
    ref: "Matthew 11:28",
    verse: {
      pt: "Vinde a mim, todos os que estais cansados e sobrecarregados, e eu vos aliviarei.",
      en: "Come to me, all you who are weary and burdened, and I will give you rest.",
      es: "Venid a mí todos los que estáis trabajados y cargados, y yo os haré descansar.",
    },
    title: { pt: "Descanso Verdadeiro", en: "True Rest", es: "Descanso Verdadero" },
    reflection: {
      pt: "Jesus não nos chama para mais esforço, mas para descanso real. Ele leva o peso que você não foi feito para carregar.",
      en: "Jesus does not call us to more effort, but to real rest. He carries the weight you were never meant to bear.",
      es: "Jesús no nos llama a más esfuerzo, sino al descanso real. Él lleva el peso que nunca fuiste hecho para cargar.",
    },
    application: {
      pt: "Faça uma pausa intencional hoje: 5 minutos em silêncio entregando suas cargas a Jesus.",
      en: "Take an intentional pause today: 5 minutes in silence handing your burdens to Jesus.",
      es: "Haz una pausa intencional hoy: 5 minutos en silencio entregando tus cargas a Jesús.",
    },
    prayer: {
      pt: "Jesus, recebo teu descanso. Tira de mim o que não me cabe carregar. Amém.",
      en: "Jesus, I receive your rest. Take from me what I was not meant to carry. Amen.",
      es: "Jesús, recibo tu descanso. Quítame lo que no me corresponde llevar. Amén.",
    },
  },
  {
    ref: "Proverbs 3:5-6",
    verse: {
      pt: "Confia no Senhor de todo o teu coração e não te estribes no teu próprio entendimento.",
      en: "Trust in the Lord with all your heart, and do not lean on your own understanding.",
      es: "Fíate de Jehová de todo tu corazón, y no te apoyes en tu propia prudencia.",
    },
    title: { pt: "Confiança que Liberta", en: "Trust That Frees", es: "Confianza que Libera" },
    reflection: {
      pt: "Confiar em Deus significa soltar o controle. Quando você reconhece os caminhos do Senhor, Ele endireita o seu.",
      en: "Trusting God means letting go of control. When you acknowledge the Lord's ways, he straightens yours.",
      es: "Confiar en Dios significa soltar el control. Cuando reconoces los caminos del Señor, Él endereza el tuyo.",
    },
    application: {
      pt: "Identifique uma decisão pendente e entregue-a a Deus, pedindo direção antes de agir.",
      en: "Identify one pending decision and hand it to God, asking for guidance before acting.",
      es: "Identifica una decisión pendiente y entrégasela a Dios, pidiendo dirección antes de actuar.",
    },
    prayer: {
      pt: "Senhor, confio em ti mais do que no meu entendimento. Guia-me hoje. Amém.",
      en: "Lord, I trust you more than my own understanding. Guide me today. Amen.",
      es: "Señor, confío en ti más que en mi propio entendimiento. Guíame hoy. Amén.",
    },
  },
  {
    ref: "Isaiah 41:10",
    verse: {
      pt: "Não temas, porque eu sou contigo; não te assombres, porque eu sou o teu Deus.",
      en: "Do not fear, for I am with you; do not be dismayed, for I am your God.",
      es: "No temas, porque yo estoy contigo; no desmayes, porque yo soy tu Dios.",
    },
    title: { pt: "Sem Medo", en: "Without Fear", es: "Sin Miedo" },
    reflection: {
      pt: "Deus não promete ausência de tempestade, mas presença na tempestade. Você não está sozinho.",
      en: "God does not promise the absence of storms, but his presence in the storm. You are not alone.",
      es: "Dios no promete la ausencia de tormenta, sino su presencia en la tormenta. No estás solo.",
    },
    application: {
      pt: "Nomeie o medo que mais te paralisa e ore declarando: 'Deus está comigo'.",
      en: "Name the fear that most paralyzes you and pray declaring: 'God is with me.'",
      es: "Nombra el miedo que más te paraliza y ora declarando: 'Dios está conmigo'.",
    },
    prayer: {
      pt: "Pai, dissipa meu medo com tua presença. Sou teu, e tu és meu Deus. Amém.",
      en: "Father, dispel my fear with your presence. I am yours, and you are my God. Amen.",
      es: "Padre, disipa mi miedo con tu presencia. Soy tuyo, y tú eres mi Dios. Amén.",
    },
  },
  {
    ref: "Romans 8:28",
    verse: {
      pt: "Sabemos que todas as coisas cooperam para o bem daqueles que amam a Deus.",
      en: "We know that in all things God works for the good of those who love him.",
      es: "Sabemos que a los que aman a Dios, todas las cosas les ayudan a bien.",
    },
    title: { pt: "Tudo Coopera", en: "All Things Work Together", es: "Todo Coopera" },
    reflection: {
      pt: "Nem tudo é bom, mas tudo pode ser usado por Deus para o bem de quem o ama. Há propósito até no inesperado.",
      en: "Not everything is good, but everything can be used by God for the good of those who love him. There is purpose even in the unexpected.",
      es: "No todo es bueno, pero todo puede ser usado por Dios para el bien de quienes le aman. Hay propósito incluso en lo inesperado.",
    },
    application: {
      pt: "Olhe para uma situação difícil e pergunte: 'Senhor, o que queres me ensinar aqui?'",
      en: "Look at a hard situation and ask: 'Lord, what do you want to teach me here?'",
      es: "Mira una situación difícil y pregunta: 'Señor, ¿qué quieres enseñarme aquí?'",
    },
    prayer: {
      pt: "Deus, confio que tu transformas até o difícil em bem. Amém.",
      en: "God, I trust that you turn even the hard into good. Amen.",
      es: "Dios, confío en que tú transformas hasta lo difícil en bien. Amén.",
    },
  },
  {
    ref: "Joshua 1:9",
    verse: {
      pt: "Esforça-te e tem bom ânimo; não temas, nem te espantes, porque o Senhor teu Deus é contigo por onde quer que andares.",
      en: "Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.",
      es: "Esfuérzate y sé valiente; no temas ni desmayes, porque Jehová tu Dios estará contigo en dondequiera que vayas.",
    },
    title: { pt: "Coragem Diária", en: "Daily Courage", es: "Valentía Diaria" },
    reflection: {
      pt: "A coragem bíblica não é ausência de medo, mas obediência apesar dele. Deus vai à sua frente.",
      en: "Biblical courage is not the absence of fear, but obedience despite it. God goes ahead of you.",
      es: "La valentía bíblica no es la ausencia de miedo, sino la obediencia a pesar de él. Dios va delante de ti.",
    },
    application: {
      pt: "Dê hoje um passo que você vinha adiando por insegurança.",
      en: "Take one step today that you have been postponing out of fear.",
      es: "Da hoy un paso que has estado posponiendo por inseguridad.",
    },
    prayer: {
      pt: "Senhor, me dá coragem para obedecer mesmo com medo. Amém.",
      en: "Lord, give me courage to obey even when afraid. Amen.",
      es: "Señor, dame valor para obedecer aun con miedo. Amén.",
    },
  },
  {
    ref: "Lamentations 3:22-23",
    verse: {
      pt: "As misericórdias do Senhor são a causa de não sermos consumidos; renovam-se cada manhã.",
      en: "Because of the Lord's great love we are not consumed, for his compassions never fail. They are new every morning.",
      es: "Por la misericordia de Jehová no hemos sido consumidos, porque nunca decayeron sus misericordias. Nuevas son cada mañana.",
    },
    title: { pt: "Misericórdias Novas", en: "New Mercies", es: "Misericordias Nuevas" },
    reflection: {
      pt: "Você não vive das sobras de ontem. A graça de Deus é fresca para o dia de hoje.",
      en: "You do not live off yesterday's leftovers. God's grace is fresh for today.",
      es: "No vives de las sobras de ayer. La gracia de Dios es fresca para el día de hoy.",
    },
    application: {
      pt: "Comece o dia agradecendo por três misericórdias novas que reconhece hoje.",
      en: "Start the day by thanking God for three new mercies you recognize today.",
      es: "Comienza el día agradeciendo por tres misericordias nuevas que reconoces hoy.",
    },
    prayer: {
      pt: "Pai, obrigado por misericórdias novas a cada manhã. Amém.",
      en: "Father, thank you for mercies that are new every morning. Amen.",
      es: "Padre, gracias por misericordias nuevas cada mañana. Amén.",
    },
  },
  {
    ref: "Psalm 46:10",
    verse: {
      pt: "Aquietai-vos e sabei que eu sou Deus.",
      en: "Be still, and know that I am God.",
      es: "Estad quietos, y conoced que yo soy Dios.",
    },
    title: { pt: "Quietude Santa", en: "Holy Stillness", es: "Quietud Santa" },
    reflection: {
      pt: "Em um mundo barulhento, o silêncio diante de Deus é um ato de fé. Pare. Respire. Lembre-se de quem Ele é.",
      en: "In a noisy world, silence before God is an act of faith. Stop. Breathe. Remember who he is.",
      es: "En un mundo ruidoso, el silencio ante Dios es un acto de fe. Detente. Respira. Recuerda quién es Él.",
    },
    application: {
      pt: "Reserve 5 minutos sem celular para apenas estar diante de Deus.",
      en: "Set aside 5 minutes without your phone just to be present before God.",
      es: "Aparta 5 minutos sin tu teléfono para simplemente estar delante de Dios.",
    },
    prayer: {
      pt: "Senhor, aquieta meu coração. Tu és Deus, e isso me basta. Amém.",
      en: "Lord, still my heart. You are God, and that is enough for me. Amen.",
      es: "Señor, aquieta mi corazón. Tú eres Dios, y eso me basta. Amén.",
    },
  },
];

/** Day-of-year (1..366) for a given YYYY-MM-DD interpreted as a calendar date in NYC. */
export function dayOfYearFromISODate(isoDate: string): number {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return 1;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  // Use UTC math to avoid host-TZ drift; the inputs already represent NYC date.
  const start = Date.UTC(year, 0, 1);
  const current = Date.UTC(year, month - 1, day);
  return Math.floor((current - start) / 86_400_000) + 1;
}

/** Returns a deterministic devotional for the given NYC date + language. Never returns null. */
export function getFallbackDevotional(isoDate: string, lang: FallbackLang) {
  const doy = dayOfYearFromISODate(isoDate);
  const seed = SEEDS[(doy - 1) % SEEDS.length];
  const L: FallbackLang = (["pt", "en", "es"] as const).includes(lang) ? lang : "pt";
  return {
    // Stable synthetic id so completion records are consistent for the same day+language.
    id: `fallback-${isoDate}-${L}`,
    devotional_date: isoDate,
    title: seed.title[L],
    bible_reference: seed.ref,
    verse_text: seed.verse[L],
    reflection: seed.reflection[L],
    application: seed.application[L],
    prayer: seed.prayer[L],
    language: L,
  };
}
