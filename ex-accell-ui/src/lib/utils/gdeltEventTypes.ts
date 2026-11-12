import { CHART } from '$lib/utils/chartColors';

export interface GdeltEventTypeConfig {
  codes: string[];
  label: string;
  color: string;
  description: string;
}

// GDELT Event Type Mappings (based on CAMEO codes). Cooperation takes the blue family (sky for verbal, blue for
// material, dark teal for diplomacy, green for agreements), conflict the orange family (orange for verbal,
// vermilion for material, yellow for protests, dark red for violence), political and military action the two
// ends of the grey ramp, media pink and the economy light teal. Red and green are not paired as bad and good
// anywhere, since many people cannot tell them apart. The legend beside the map names every type.
export const GDELT_EVENT_TYPES: Record<string, GdeltEventTypeConfig> = {
  verbal_cooperation: {
    codes: ['10', '11', '12', '13', '14', '15', '16', '17'],
    label: 'Verbal Cooperation',
    color: CHART.catSky,
    description: 'Make statement, comment, consult, engage in diplomatic cooperation'
  },
  material_cooperation: {
    codes: ['20', '21', '22', '23', '24', '25', '26', '27'],
    label: 'Material Cooperation',
    color: CHART.catBlue,
    description: 'Appeal, express intent to cooperate, provide aid'
  },
  verbal_conflict: {
    codes: ['10', '11', '12', '13', '14', '15', '16', '17'].map((c) => '1' + c),
    label: 'Verbal Conflict',
    color: CHART.catOrange,
    description: 'Demand, disapprove, reject, threaten, protest'
  },
  material_conflict: {
    codes: ['18', '19', '20'],
    label: 'Material Conflict',
    color: CHART.catVermilion,
    description: 'Exhibit force, reduce relations, coerce'
  },
  diplomacy: {
    codes: ['30', '31', '32', '33', '34', '35', '36', '37'],
    label: 'Diplomacy',
    color: CHART.primary700,
    description: 'Express intent to cooperate, consult, support'
  },
  support: {
    codes: ['40', '41', '42', '43', '44', '45', '46'],
    label: 'Support & Agreements',
    color: CHART.catGreen,
    description: 'Cooperate, agree, provide support'
  },
  information: {
    codes: ['50', '51', '52', '53', '54', '55', '56', '57'],
    label: 'Information & Media',
    color: CHART.catPink,
    description: 'Engage in symbolic acts, media statements'
  },
  economic: {
    codes: ['60', '61', '62', '63', '64', '65', '66', '67'],
    label: 'Economic Actions',
    color: CHART.primary400,
    description: 'Economic cooperation, trade, sanctions'
  },
  political: {
    codes: ['70', '71', '72', '73', '74', '75', '76'],
    label: 'Political Actions',
    color: CHART.ink400,
    description: 'Provide diplomatic cooperation, host meetings'
  },
  military: {
    codes: ['80', '81', '82', '83', '84', '85', '86', '87'],
    label: 'Military Actions',
    color: CHART.ink900,
    description: 'Military cooperation, exercises, operations'
  },
  protests: {
    codes: ['14', '141', '142', '143', '144', '145'],
    label: 'Protests & Demonstrations',
    color: CHART.catYellow,
    description: 'Protests, demonstrations, strikes'
  },
  violence: {
    codes: ['17', '18', '19', '190', '193', '194', '195'],
    label: 'Violence & Conflict',
    color: CHART.danger700,
    description: 'Violence, fighting, armed conflict'
  }
};

/** The first type, in declaration order, whose code prefix the event code starts with, else 'other'. */
export function getEventType(eventCode: string): string {
  for (const [type, config] of Object.entries(GDELT_EVENT_TYPES)) {
    if (config.codes.some((code) => eventCode.startsWith(code))) {
      return type;
    }
  }
  return 'other';
}

export function getEventTypeColor(eventCode: string): string {
  const type = getEventType(eventCode);
  return GDELT_EVENT_TYPES[type]?.color || CHART.ink500;
}
