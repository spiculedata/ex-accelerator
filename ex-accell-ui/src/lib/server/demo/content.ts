/** Fictional-city content for the demo dataset. Nothing here refers to real people or events. */

export type SentimentBand = 'positive' | 'negative' | 'neutral';

export interface DemoTopic {
  key: string;
  name: string;
  category: string;
  color: string;
  keywords: string[];
  hashtags: string[];
  /** Relative odds of [very positive, positive, neutral, negative, very negative]. */
  bias: [number, number, number, number, number];
  sentences: Record<SentimentBand, string[]>;
}

export const TOPICS: DemoTopic[] = [
  {
    key: 'transit', name: 'Public Transit', category: 'Infrastructure', color: '#0072b2',
    keywords: ['bus', 'tram', 'strike', 'delays', 'fare', 'timetable'],
    hashtags: ['#MarlowTransit', '#TramDelays'],
    bias: [3, 10, 25, 40, 22],
    sentences: {
      positive: ['The new tram timetable is a big improvement, my commute is ten minutes shorter.', 'Credit to the bus drivers who kept routes running all week.'],
      negative: ['Another morning of tram delays and no information at the stop.', 'The fare increase is hard to justify with service this unreliable.'],
      neutral: ['Transit board meets Thursday to discuss the revised timetable.', 'Route 12 will be diverted for road works until the end of the month.']
    }
  },
  {
    key: 'festival', name: 'Harbor Festival', category: 'Culture', color: '#cc79a7',
    keywords: ['festival', 'music', 'fireworks', 'crowds', 'tickets', 'food'],
    hashtags: ['#HarborFest', '#MarlowBay'],
    bias: [28, 40, 22, 8, 2],
    sentences: {
      positive: ['The harbor fireworks were incredible, best festival night in years.', 'Great food stalls and live music all weekend. Already planning next year.'],
      negative: ['Festival crowds were overwhelming and the queues for tickets were far too long.', 'Not enough bins along the waterfront after the fireworks.'],
      neutral: ['Harbor Festival programme and stage times are now online.', 'Road closures around the waterfront start at noon on Saturday.']
    }
  },
  {
    key: 'housing', name: 'Housing and Rent', category: 'Society', color: '#e69f00',
    keywords: ['rent', 'landlord', 'housing', 'affordable', 'construction', 'tenants'],
    hashtags: ['#MarlowHousing', '#RentCrisis'],
    bias: [2, 8, 25, 45, 20],
    sentences: {
      positive: ['Good to see 200 affordable homes approved near the old depot.', 'Our landlord froze the rent this year, a small relief.'],
      negative: ['Rents keep climbing while wages stay flat. Something has to change.', 'Three viewings this week and every flat was out of budget.'],
      neutral: ['Council publishes the draft housing plan for public comment.', 'Tenants association meets at the community hall on Tuesday.']
    }
  },
  {
    key: 'water', name: 'Water Quality', category: 'Environment', color: '#56b4e9',
    keywords: ['water', 'tap', 'filter', 'advisory', 'pipes', 'testing'],
    hashtags: ['#CleanWater', '#MarlowBay'],
    bias: [3, 12, 30, 38, 17],
    sentences: {
      positive: ['Latest testing shows tap water well within safe limits. Good news.', 'Thanks to the crews who replaced the old pipes on Elm Street.'],
      negative: ['Still no clear answer on the water advisory. Buying bottled water again.', 'Brown tap water this morning, third time this month.'],
      neutral: ['Water utility will flush mains in the north district overnight.', 'Results of the quarterly water testing are due next week.']
    }
  },
  {
    key: 'schools', name: 'Schools and Budget', category: 'Education', color: '#009e73',
    keywords: ['school', 'budget', 'teachers', 'funding', 'class', 'library'],
    hashtags: ['#MarlowSchools', '#SchoolBudget'],
    bias: [5, 20, 35, 28, 12],
    sentences: {
      positive: ['The reopened school library is wonderful, kids are reading more already.', 'Proud of our teachers for the science fair this year.'],
      negative: ['Class sizes are up again after the budget cuts. Parents deserve answers.', 'Funding for after-school clubs has been dropped without any consultation.'],
      neutral: ['School board budget vote is scheduled for the 14th.', 'Enrolment forms for next term open on Monday.']
    }
  },
  {
    key: 'cycling', name: 'Cycling and Streets', category: 'Infrastructure', color: '#d55e00',
    keywords: ['bike', 'lane', 'traffic', 'safety', 'parking', 'cars'],
    hashtags: ['#MarlowCycling', '#SafeStreets'],
    bias: [8, 27, 30, 25, 10],
    sentences: {
      positive: ['The new protected bike lane on Quay Road feels so much safer.', 'More bike parking downtown, exactly what we needed.'],
      negative: ['Cars keep parking in the bike lane and nobody enforces it.', 'Traffic on Quay Road is worse since the lane changes.'],
      neutral: ['Consultation on the next phase of cycle routes opens this week.', 'Street sweeping schedule changes for the harbor district.']
    }
  },
  {
    key: 'heat', name: 'Heatwave and Parks', category: 'Environment', color: '#a20711',
    keywords: ['heat', 'park', 'shade', 'cooling', 'trees', 'pool'],
    hashtags: ['#MarlowHeat', '#CoolParks'],
    bias: [4, 14, 32, 35, 15],
    sentences: {
      positive: ['The new shade trees in Central Park are a lifesaver in this heat.', 'Free entry to the municipal pool during the heatwave, great idea.'],
      negative: ['Brutal heat again and the cooling centre closes at five. Not enough.', 'Half the park fountains are broken in the hottest week of the year.'],
      neutral: ['Cooling centres open until 5pm across the city during the heat advisory.', 'Park rangers remind visitors to carry water.']
    }
  },
  {
    key: 'business', name: 'Local Business', category: 'Economy', color: '#344253',
    keywords: ['cafe', 'market', 'shops', 'jobs', 'tourism', 'prices'],
    bias: [10, 30, 32, 21, 7],
    hashtags: ['#ShopLocal', '#MarlowBay'],
    sentences: {
      positive: ['The Saturday market is thriving, so many new stalls this season.', 'Our favourite cafe on Pier Street just won a regional award.'],
      negative: ['Another small shop closing on the high street, rents are too high.', 'Prices at the harbor cafes have gone up again for tourists and locals alike.'],
      neutral: ['The business association is holding an open evening for new traders.', 'Tourism office reports visitor numbers for the quarter.']
    }
  }
];

export interface DemoLanguage { id: number; code: string; name: string; nativeName: string; share: number }

export const LANGUAGES: DemoLanguage[] = [
  { id: 1, code: 'en', name: 'English', nativeName: 'English', share: 72 },
  { id: 2, code: 'es', name: 'Spanish', nativeName: 'Español', share: 14 },
  { id: 3, code: 'fr', name: 'French', nativeName: 'Français', share: 8 },
  { id: 4, code: 'de', name: 'German', nativeName: 'Deutsch', share: 6 }
];

/** Short generic posts for non-English languages (not tied to a topic). */
export const FOREIGN_SENTENCES: Record<string, Record<SentimentBand, string[]>> = {
  es: {
    positive: ['Gran noticia para Marlow Bay hoy, muy contentos.', 'Excelente trabajo del equipo municipal esta semana.'],
    negative: ['Otra vez problemas en la ciudad, estamos cansados de esperar.', 'Esto no puede seguir así, necesitamos soluciones.'],
    neutral: ['Reunión municipal el jueves por la tarde.', 'Nuevo horario publicado en la web del ayuntamiento.']
  },
  fr: {
    positive: ['Très bonne nouvelle pour Marlow Bay aujourd’hui.', 'Bravo à toutes les équipes pour cette semaine.'],
    negative: ['Encore des problèmes en ville, on attend toujours des réponses.', 'Ça ne peut pas continuer comme ça.'],
    neutral: ['Réunion publique jeudi soir à la mairie.', 'Le nouveau calendrier est en ligne.']
  },
  de: {
    positive: ['Tolle Neuigkeiten für Marlow Bay heute.', 'Großartige Arbeit des Teams in dieser Woche.'],
    negative: ['Schon wieder Probleme in der Stadt, wir warten auf Antworten.', 'So kann es nicht weitergehen.'],
    neutral: ['Öffentliche Sitzung am Donnerstagabend im Rathaus.', 'Der neue Zeitplan ist jetzt online.']
  }
};

export const SENTIMENTS = ['Very Positive', 'Positive', 'Neutral', 'Negative', 'Very Negative'] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const bandOf = (sentiment: Sentiment): SentimentBand =>
  sentiment === 'Very Positive' || sentiment === 'Positive' ? 'positive' : sentiment === 'Neutral' ? 'neutral' : 'negative';

export const EMOTIONS: Record<SentimentBand, Array<{ emotion: string; weight: number }>> = {
  positive: [{ emotion: 'Joy', weight: 6 }, { emotion: 'Trust', weight: 3 }, { emotion: 'Surprise', weight: 1 }],
  neutral: [{ emotion: 'Trust', weight: 3 }, { emotion: 'Surprise', weight: 2 }, { emotion: 'Fear', weight: 1 }],
  negative: [{ emotion: 'Anger', weight: 5 }, { emotion: 'Sadness', weight: 3 }, { emotion: 'Fear', weight: 2 }, { emotion: 'Disgust', weight: 1 }]
};

export const CONTENT_TYPES = [
  { id: 1, name: 'Text Only', description: 'Plain text posts' },
  { id: 2, name: 'Image', description: 'Posts with a photo' },
  { id: 3, name: 'Video', description: 'Posts with a video' },
  { id: 4, name: 'Link', description: 'Posts sharing a link' }
];

export interface DemoSource { id: number; name: string; platform: string; contentWeights: [number, number, number, number]; reach: number }

export const SOURCES: DemoSource[] = [
  { id: 1, name: 'Demo Telegram local channels', platform: 'telegram', contentWeights: [45, 30, 10, 15], reach: 4000 },
  { id: 2, name: 'Demo YouTube city channels', platform: 'youtube', contentWeights: [2, 8, 85, 5], reach: 9000 },
  { id: 3, name: 'Demo Bluesky local feed', platform: 'bluesky', contentWeights: [60, 22, 5, 13], reach: 1500 }
];
