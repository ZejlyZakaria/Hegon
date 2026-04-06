export type Quote = {
  text: string;
  source: string;
  mood: "spiritual" | "philosophical" | "poetic" | "bold" | "minimal";
  origin: "arabic" | "greek" | "french" | "universal";
};

export const quotesLibrary: Quote[] = [
  // spiritual — arabic
  {
    text: "With hardship comes ease.",
    source: "Quran",
    mood: "spiritual",
    origin: "arabic",
  },
  {
    text: "Indeed, Allah is with the patient.",
    source: "Quran",
    mood: "spiritual",
    origin: "arabic",
  },
  {
    text: "In the remembrance of Allah do hearts find rest.",
    source: "Quran",
    mood: "spiritual",
    origin: "arabic",
  },
  {
    text: "Allah does not burden a soul beyond what it can bear.",
    source: "Quran",
    mood: "spiritual",
    origin: "arabic",
  },
  {
    text: "Perhaps you dislike a thing while it is good for you.",
    source: "Quran",
    mood: "spiritual",
    origin: "arabic",
  },
  {
    text: "Tie your camel, then trust in Allah.",
    source: "Hadith",
    mood: "spiritual",
    origin: "arabic",
  },
  {
    text: "Actions are judged by intentions.",
    source: "Hadith",
    mood: "spiritual",
    origin: "arabic",
  },
  {
    text: "The strong one controls himself in anger.",
    source: "Hadith",
    mood: "spiritual",
    origin: "arabic",
  },
  {
    text: "Make things easy, not difficult.",
    source: "Hadith",
    mood: "spiritual",
    origin: "arabic",
  },
  {
    text: "The best of people are those most beneficial to others.",
    source: "Hadith",
    mood: "spiritual",
    origin: "arabic",
  },
  {
    text: "What is written for you will never miss you.",
    source: "Islamic Wisdom",
    mood: "spiritual",
    origin: "arabic",
  },
  {
    text: "A quiet heart sees what panic cannot.",
    source: "Islamic Reflection",
    mood: "spiritual",
    origin: "arabic",
  },

  // spiritual — universal
  {
    text: "Be still enough to hear what your life is saying.",
    source: "Universal Wisdom",
    mood: "spiritual",
    origin: "universal",
  },
  {
    text: "Patience is trust stretched across time.",
    source: "Universal Wisdom",
    mood: "spiritual",
    origin: "universal",
  },
  {
    text: "Peace often arrives after surrender, not control.",
    source: "Universal Wisdom",
    mood: "spiritual",
    origin: "universal",
  },
  {
    text: "The soul grows in silence before it speaks in strength.",
    source: "Universal Wisdom",
    mood: "spiritual",
    origin: "universal",
  },
  {
    text: "What is meant for you will find its road.",
    source: "Universal Wisdom",
    mood: "spiritual",
    origin: "universal",
  },
  {
    text: "Sometimes the answer is simply to endure with grace.",
    source: "Universal Reflection",
    mood: "spiritual",
    origin: "universal",
  },

  // philosophical — greek / roman
  {
    text: "You have power over your mind, not outside events.",
    source: "Marcus Aurelius",
    mood: "philosophical",
    origin: "greek",
  },
  {
    text: "Waste no more time arguing what a good man should be. Be one.",
    source: "Marcus Aurelius",
    mood: "philosophical",
    origin: "greek",
  },
  {
    text: "The obstacle is the way.",
    source: "Marcus Aurelius",
    mood: "philosophical",
    origin: "greek",
  },
  {
    text: "Very little is needed to make a happy life.",
    source: "Marcus Aurelius",
    mood: "philosophical",
    origin: "greek",
  },
  {
    text: "We suffer more in imagination than in reality.",
    source: "Seneca",
    mood: "philosophical",
    origin: "greek",
  },
  {
    text: "Luck is what happens when preparation meets opportunity.",
    source: "Seneca",
    mood: "philosophical",
    origin: "greek",
  },
  {
    text: "No man is free who is not master of himself.",
    source: "Epictetus",
    mood: "philosophical",
    origin: "greek",
  },
  {
    text: "It is not things that disturb us, but our judgment of them.",
    source: "Epictetus",
    mood: "philosophical",
    origin: "greek",
  },
  {
    text: "First say to yourself what you would be, then do what you must.",
    source: "Epictetus",
    mood: "philosophical",
    origin: "greek",
  },
  {
    text: "He who fears death will never do anything worthy of a living man.",
    source: "Seneca",
    mood: "philosophical",
    origin: "greek",
  },
  {
    text: "Time discovers truth.",
    source: "Seneca",
    mood: "philosophical",
    origin: "greek",
  },
  {
    text: "The happiness of your life depends on the quality of your thoughts.",
    source: "Marcus Aurelius",
    mood: "philosophical",
    origin: "greek",
  },

  // poetic — french / european
  {
    text: "Il faudrait essayer d'être heureux, ne serait-ce que pour donner l'exemple.",
    source: "Jacques Prévert",
    mood: "poetic",
    origin: "french",
  },
  {
    text: "Au milieu de l'hiver, j'apprenais enfin qu'il y avait en moi un été invincible.",
    source: "Albert Camus",
    mood: "poetic",
    origin: "french",
  },
  {
    text: "La vraie générosité envers l’avenir consiste à tout donner au présent.",
    source: "Albert Camus",
    mood: "poetic",
    origin: "french",
  },
  {
    text: "Vivre, c'est ne pas se résigner.",
    source: "Albert Camus",
    mood: "poetic",
    origin: "french",
  },
  {
    text: "Let everything happen to you: beauty and terror.",
    source: "Rainer Maria Rilke",
    mood: "poetic",
    origin: "french",
  },
  {
    text: "Live the questions now.",
    source: "Rainer Maria Rilke",
    mood: "poetic",
    origin: "french",
  },
  {
    text: "And now we welcome the new year, full of things that have never been.",
    source: "Rainer Maria Rilke",
    mood: "poetic",
    origin: "french",
  },
  {
    text: "Il y a dans la lumière du soir une mémoire qu’aucun mot ne porte.",
    source: "European Reflection",
    mood: "poetic",
    origin: "french",
  },
  {
    text: "Certaines nuits savent mieux nous comprendre que les foules.",
    source: "French Reflection",
    mood: "poetic",
    origin: "french",
  },
  {
    text: "Le silence a parfois la douceur d’une réponse.",
    source: "French Reflection",
    mood: "poetic",
    origin: "french",
  },
  {
    text: "A horizon is enough to begin again.",
    source: "European Reflection",
    mood: "poetic",
    origin: "french",
  },
  {
    text: "The heart remembers what the day tries to erase.",
    source: "European Reflection",
    mood: "poetic",
    origin: "french",
  },

  // bold — universal
  {
    text: "Stay hard.",
    source: "David Goggins",
    mood: "bold",
    origin: "universal",
  },
  {
    text: "Suffer the pain of discipline or the pain of regret.",
    source: "Jim Rohn",
    mood: "bold",
    origin: "universal",
  },
  {
    text: "Success is stumbling from failure to failure with no loss of enthusiasm.",
    source: "Winston Churchill",
    mood: "bold",
    origin: "universal",
  },
  {
    text: "If you're going through hell, keep going.",
    source: "Winston Churchill",
    mood: "bold",
    origin: "universal",
  },
  {
    text: "The only easy day was yesterday.",
    source: "Navy SEAL Saying",
    mood: "bold",
    origin: "universal",
  },
  {
    text: "Discipline is choosing what you want most over what you want now.",
    source: "Abraham Lincoln (attributed)",
    mood: "bold",
    origin: "universal",
  },
  {
    text: "The standard you walk past is the standard you accept.",
    source: "David Hurley",
    mood: "bold",
    origin: "universal",
  },
  {
    text: "Do not pray for an easy life; pray for the strength to endure a hard one.",
    source: "Bruce Lee",
    mood: "bold",
    origin: "universal",
  },
  {
    text: "A man becomes what he does repeatedly under pressure.",
    source: "Warrior Reflection",
    mood: "bold",
    origin: "universal",
  },
  {
    text: "Your comfort is expensive; your discipline pays dividends.",
    source: "Modern Reflection",
    mood: "bold",
    origin: "universal",
  },
  {
    text: "No one is coming. Build yourself.",
    source: "Modern Reflection",
    mood: "bold",
    origin: "universal",
  },
  {
    text: "Earn your confidence through repetition.",
    source: "Performance Reflection",
    mood: "bold",
    origin: "universal",
  },

  // minimal — universal
  {
    text: "Focus on what matters.",
    source: "Modern Wisdom",
    mood: "minimal",
    origin: "universal",
  },
  {
    text: "Clarity beats intensity.",
    source: "Modern Wisdom",
    mood: "minimal",
    origin: "universal",
  },
  {
    text: "Small steps, repeated daily.",
    source: "Modern Wisdom",
    mood: "minimal",
    origin: "universal",
  },
  {
    text: "Less noise. Better thinking.",
    source: "Modern Wisdom",
    mood: "minimal",
    origin: "universal",
  },
  {
    text: "Consistency beats motivation.",
    source: "Modern Wisdom",
    mood: "minimal",
    origin: "universal",
  },
  {
    text: "What you track, you improve.",
    source: "Modern Wisdom",
    mood: "minimal",
    origin: "universal",
  },
  {
    text: "Attention is a finite asset.",
    source: "Modern Wisdom",
    mood: "minimal",
    origin: "universal",
  },
  {
    text: "Calm is a competitive edge.",
    source: "Modern Wisdom",
    mood: "minimal",
    origin: "universal",
  },
  {
    text: "Protect your mornings.",
    source: "Modern Wisdom",
    mood: "minimal",
    origin: "universal",
  },
  {
    text: "Build systems, not moods.",
    source: "Modern Wisdom",
    mood: "minimal",
    origin: "universal",
  },
  {
    text: "A clear desk helps a clear mind.",
    source: "Modern Wisdom",
    mood: "minimal",
    origin: "universal",
  },
  {
    text: "Do fewer things, better.",
    source: "Modern Wisdom",
    mood: "minimal",
    origin: "universal",
  },
];
