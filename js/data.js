/* ============================================================
   data.js — static game data
   States, demographics, topic pool, action definitions,
   celebrities, corporate backers, AI archetypes.
   ============================================================ */

/* ---------- Candidate palette ---------- */
window.PALETTE = [
  { key: 'blue',   name: 'Cobalt',   hex: '#3b7fe0', light: '#9dc0f2' },
  { key: 'red',    name: 'Crimson',  hex: '#e0503b', light: '#f2a89d' },
  { key: 'green',  name: 'Sage',     hex: '#3ba86a', light: '#9ddcb8' },
  { key: 'purple', name: 'Amethyst', hex: '#9152d6', light: '#c9a6ee' },
  { key: 'amber',  name: 'Amber',    hex: '#d99a1f', light: '#f0d491' },
  { key: 'magenta',name: 'Magenta',  hex: '#d8489b', light: '#f0a3ce' },
];

/* ---------- Demographic dimensions ---------- */
// Ideology profile axes, each -1 .. +1
//   s = social      (-1 progressive / cosmopolitan  ->  +1 traditional)
//   e = economic    (-1 interventionist / redistributive -> +1 free market)
//   n = national    (-1 globalist / open -> +1 nationalist / protectionist)

window.AGE_GROUPS = [
  { id: 'young',  label: 'Young',       sub: '18–34', profile: { s: -0.62, e: -0.45, n: -0.40 }, turnout: 0.55 },
  { id: 'middle', label: 'Middle-aged', sub: '35–64', profile: { s:  0.05, e:  0.12, n:  0.08 }, turnout: 0.72 },
  { id: 'old',    label: 'Older',       sub: '65+',   profile: { s:  0.48, e:  0.18, n:  0.42 }, turnout: 0.84 },
];

window.GENDERS = [
  { id: 'male',      label: 'Men',       profile: { s:  0.20, e:  0.22, n:  0.20 } },
  { id: 'female',    label: 'Women',     profile: { s: -0.20, e: -0.24, n: -0.14 } },
  { id: 'nonbinary', label: 'Nonbinary', profile: { s: -0.78, e: -0.55, n: -0.60 } },
];

/* ---------- States ----------
   ev        electoral votes (2024–2030 apportionment)
   pop       voting-age population, millions (approx.)
   s,e,n     ideology profile of the state's political culture
   young/old share of the adult population (middle = remainder)
   male      share of adults, nb = nonbinary share
------------------------------------------------ */
window.STATES = {
  AL: { name: 'Alabama',        ev: 9,  pop: 3.9,  s: 0.72, e: 0.46, n: 0.62, young: 0.29, old: 0.24, male: 0.484, nb: 0.005 },
  AK: { name: 'Alaska',         ev: 3,  pop: 0.56, s: 0.22, e: 0.44, n: 0.40, young: 0.32, old: 0.17, male: 0.520, nb: 0.008 },
  AZ: { name: 'Arizona',        ev: 11, pop: 5.7,  s: 0.06, e: 0.22, n: 0.10, young: 0.29, old: 0.26, male: 0.494, nb: 0.008 },
  AR: { name: 'Arkansas',       ev: 6,  pop: 2.4,  s: 0.70, e: 0.40, n: 0.58, young: 0.29, old: 0.24, male: 0.489, nb: 0.005 },
  CA: { name: 'California',     ev: 54, pop: 30.6, s: -0.52, e: -0.44, n: -0.55, young: 0.31, old: 0.20, male: 0.495, nb: 0.012 },
  CO: { name: 'Colorado',       ev: 10, pop: 4.6,  s: -0.26, e: 0.06, n: -0.20, young: 0.31, old: 0.20, male: 0.502, nb: 0.011 },
  CT: { name: 'Connecticut',    ev: 7,  pop: 2.9,  s: -0.34, e: -0.18, n: -0.28, young: 0.28, old: 0.24, male: 0.487, nb: 0.008 },
  DE: { name: 'Delaware',       ev: 3,  pop: 0.83, s: -0.24, e: -0.10, n: -0.20, young: 0.27, old: 0.27, male: 0.483, nb: 0.007 },
  DC: { name: 'District of Columbia', ev: 3, pop: 0.57, s: -0.90, e: -0.55, n: -0.80, young: 0.38, old: 0.14, male: 0.474, nb: 0.021 },
  FL: { name: 'Florida',        ev: 30, pop: 18.4, s: 0.26, e: 0.38, n: 0.22, young: 0.26, old: 0.28, male: 0.489, nb: 0.008 },
  GA: { name: 'Georgia',        ev: 16, pop: 8.4,  s: 0.14, e: 0.20, n: 0.04, young: 0.30, old: 0.20, male: 0.485, nb: 0.008 },
  HI: { name: 'Hawaii',         ev: 4,  pop: 1.1,  s: -0.48, e: -0.40, n: -0.52, young: 0.28, old: 0.24, male: 0.501, nb: 0.010 },
  ID: { name: 'Idaho',          ev: 4,  pop: 1.5,  s: 0.72, e: 0.62, n: 0.56, young: 0.30, old: 0.22, male: 0.503, nb: 0.006 },
  IL: { name: 'Illinois',       ev: 19, pop: 9.7,  s: -0.30, e: -0.22, n: -0.26, young: 0.29, old: 0.21, male: 0.489, nb: 0.009 },
  IN: { name: 'Indiana',        ev: 11, pop: 5.3,  s: 0.44, e: 0.36, n: 0.36, young: 0.29, old: 0.21, male: 0.492, nb: 0.007 },
  IA: { name: 'Iowa',           ev: 6,  pop: 2.5,  s: 0.34, e: 0.26, n: 0.30, young: 0.28, old: 0.24, male: 0.495, nb: 0.007 },
  KS: { name: 'Kansas',         ev: 6,  pop: 2.2,  s: 0.40, e: 0.38, n: 0.34, young: 0.29, old: 0.22, male: 0.495, nb: 0.007 },
  KY: { name: 'Kentucky',       ev: 8,  pop: 3.5,  s: 0.60, e: 0.24, n: 0.56, young: 0.28, old: 0.23, male: 0.489, nb: 0.006 },
  LA: { name: 'Louisiana',      ev: 8,  pop: 3.5,  s: 0.56, e: 0.34, n: 0.46, young: 0.30, old: 0.22, male: 0.485, nb: 0.006 },
  ME: { name: 'Maine',          ev: 4,  pop: 1.1,  s: -0.22, e: -0.06, n: -0.02, young: 0.25, old: 0.30, male: 0.489, nb: 0.011 },
  MD: { name: 'Maryland',       ev: 10, pop: 4.8,  s: -0.44, e: -0.24, n: -0.40, young: 0.28, old: 0.22, male: 0.483, nb: 0.009 },
  MA: { name: 'Massachusetts',  ev: 11, pop: 5.6,  s: -0.48, e: -0.24, n: -0.44, young: 0.30, old: 0.22, male: 0.483, nb: 0.013 },
  MI: { name: 'Michigan',       ev: 15, pop: 7.9,  s: 0.02, e: -0.08, n: 0.10, young: 0.28, old: 0.24, male: 0.490, nb: 0.008 },
  MN: { name: 'Minnesota',      ev: 10, pop: 4.4,  s: -0.14, e: -0.10, n: -0.10, young: 0.29, old: 0.22, male: 0.494, nb: 0.010 },
  MS: { name: 'Mississippi',    ev: 6,  pop: 2.2,  s: 0.62, e: 0.24, n: 0.44, young: 0.30, old: 0.22, male: 0.480, nb: 0.005 },
  MO: { name: 'Missouri',       ev: 10, pop: 4.8,  s: 0.44, e: 0.34, n: 0.40, young: 0.28, old: 0.23, male: 0.490, nb: 0.007 },
  MT: { name: 'Montana',        ev: 4,  pop: 0.89, s: 0.40, e: 0.44, n: 0.34, young: 0.27, old: 0.25, male: 0.503, nb: 0.008 },
  NE: { name: 'Nebraska',       ev: 5,  pop: 1.5,  s: 0.44, e: 0.40, n: 0.36, young: 0.29, old: 0.21, male: 0.497, nb: 0.007 },
  NV: { name: 'Nevada',         ev: 6,  pop: 2.5,  s: -0.10, e: 0.12, n: -0.04, young: 0.29, old: 0.23, male: 0.503, nb: 0.010 },
  NH: { name: 'New Hampshire',  ev: 4,  pop: 1.1,  s: -0.08, e: 0.28, n: 0.02, young: 0.26, old: 0.26, male: 0.494, nb: 0.009 },
  NJ: { name: 'New Jersey',     ev: 14, pop: 7.2,  s: -0.28, e: -0.10, n: -0.30, young: 0.28, old: 0.22, male: 0.487, nb: 0.008 },
  NM: { name: 'New Mexico',     ev: 5,  pop: 1.6,  s: -0.24, e: -0.24, n: -0.24, young: 0.29, old: 0.24, male: 0.492, nb: 0.010 },
  NY: { name: 'New York',       ev: 28, pop: 15.4, s: -0.42, e: -0.34, n: -0.44, young: 0.29, old: 0.23, male: 0.484, nb: 0.012 },
  NC: { name: 'North Carolina', ev: 16, pop: 8.4,  s: 0.16, e: 0.24, n: 0.10, young: 0.28, old: 0.24, male: 0.486, nb: 0.008 },
  ND: { name: 'North Dakota',   ev: 3,  pop: 0.60, s: 0.60, e: 0.50, n: 0.52, young: 0.31, old: 0.21, male: 0.510, nb: 0.007 },
  OH: { name: 'Ohio',           ev: 17, pop: 9.2,  s: 0.30, e: 0.16, n: 0.34, young: 0.28, old: 0.24, male: 0.489, nb: 0.008 },
  OK: { name: 'Oklahoma',       ev: 7,  pop: 3.1,  s: 0.68, e: 0.52, n: 0.58, young: 0.30, old: 0.22, male: 0.492, nb: 0.007 },
  OR: { name: 'Oregon',         ev: 8,  pop: 3.4,  s: -0.42, e: -0.28, n: -0.36, young: 0.28, old: 0.24, male: 0.494, nb: 0.014 },
  PA: { name: 'Pennsylvania',   ev: 19, pop: 10.3, s: 0.06, e: -0.02, n: 0.12, young: 0.28, old: 0.25, male: 0.488, nb: 0.008 },
  RI: { name: 'Rhode Island',   ev: 4,  pop: 0.88, s: -0.36, e: -0.26, n: -0.30, young: 0.29, old: 0.24, male: 0.485, nb: 0.011 },
  SC: { name: 'South Carolina', ev: 9,  pop: 4.3,  s: 0.44, e: 0.34, n: 0.34, young: 0.27, old: 0.26, male: 0.484, nb: 0.007 },
  SD: { name: 'South Dakota',   ev: 3,  pop: 0.71, s: 0.56, e: 0.48, n: 0.48, young: 0.29, old: 0.23, male: 0.503, nb: 0.007 },
  TN: { name: 'Tennessee',      ev: 11, pop: 5.5,  s: 0.56, e: 0.42, n: 0.48, young: 0.28, old: 0.23, male: 0.487, nb: 0.007 },
  TX: { name: 'Texas',          ev: 40, pop: 22.6, s: 0.32, e: 0.46, n: 0.26, young: 0.32, old: 0.18, male: 0.497, nb: 0.008 },
  UT: { name: 'Utah',           ev: 6,  pop: 2.5,  s: 0.62, e: 0.50, n: 0.28, young: 0.36, old: 0.15, male: 0.507, nb: 0.008 },
  VT: { name: 'Vermont',        ev: 3,  pop: 0.53, s: -0.52, e: -0.48, n: -0.36, young: 0.26, old: 0.28, male: 0.492, nb: 0.016 },
  VA: { name: 'Virginia',       ev: 13, pop: 6.8,  s: -0.14, e: 0.02, n: -0.14, young: 0.29, old: 0.21, male: 0.489, nb: 0.009 },
  WA: { name: 'Washington',     ev: 12, pop: 6.2,  s: -0.44, e: -0.24, n: -0.42, young: 0.29, old: 0.21, male: 0.498, nb: 0.013 },
  WV: { name: 'West Virginia',  ev: 4,  pop: 1.4,  s: 0.66, e: 0.04, n: 0.68, young: 0.26, old: 0.28, male: 0.494, nb: 0.006 },
  WI: { name: 'Wisconsin',      ev: 10, pop: 4.6,  s: 0.04, e: 0.02, n: 0.06, young: 0.28, old: 0.24, male: 0.494, nb: 0.009 },
  WY: { name: 'Wyoming',        ev: 3,  pop: 0.45, s: 0.66, e: 0.62, n: 0.52, young: 0.28, old: 0.22, male: 0.512, nb: 0.007 },
};

// Small northeastern states get a labelled callout box instead of relying on geography.
window.CALLOUTS = ['VT', 'NH', 'MA', 'RI', 'CT', 'NJ', 'DE', 'MD', 'DC'];

/* ---------- Topic pool ----------
   axes  weight of each ideology axis; a state/demo with a matching profile
         lands on the "+" side of the issue.
   pos   what a +3 stance means.   neg  what a −3 stance means.
------------------------------------------------ */
window.TOPIC_POOL = [
  { id: 'health',   name: 'Health Care',            axes:{s:-0.15,e:-0.85,n:0},      pos:'universal public coverage',      neg:'private, market-driven care' },
  { id: 'tax',      name: 'Taxes on the Wealthy',   axes:{s:0,e:-0.95,n:0},          pos:'tax the top brackets hard',      neg:'broad tax cuts, flatter rates' },
  { id: 'climate',  name: 'Climate Policy',         axes:{s:-0.35,e:-0.45,n:-0.30},  pos:'aggressive decarbonization',     neg:'energy abundance, drill and burn' },
  { id: 'guns',     name: 'Firearms',               axes:{s:0.75,e:0.10,n:0.30},     pos:'expand gun rights',              neg:'strict licensing and bans' },
  { id: 'immig',    name: 'Immigration',            axes:{s:0.30,e:0.05,n:0.85},     pos:'seal the border, mass removals',  neg:'open pathways and amnesty' },
  { id: 'trade',    name: 'Trade & Tariffs',        axes:{s:0.05,e:0.15,n:0.90},     pos:'tariff walls for home industry', neg:'free trade with everyone' },
  { id: 'abortion', name: 'Reproductive Rights',    axes:{s:-0.95,e:0,n:-0.10},      pos:'codify nationwide access',       neg:'near-total restrictions' },
  { id: 'crime',    name: 'Policing & Crime',       axes:{s:0.80,e:0.15,n:0.35},     pos:'flood the streets with police',  neg:'divert funding to services' },
  { id: 'college',  name: 'Student Debt',           axes:{s:-0.30,e:-0.80,n:-0.10},  pos:'cancel it outright',             neg:'borrowers pay what they owe' },
  { id: 'housing',  name: 'Housing Costs',          axes:{s:-0.25,e:-0.60,n:-0.10},  pos:'public building and rent caps',  neg:'deregulate and let markets build' },
  { id: 'ai',       name: 'AI Regulation',          axes:{s:0.25,e:-0.55,n:0.35},    pos:'licence and restrain the labs',  neg:'let the technology run free' },
  { id: 'crypto',   name: 'Digital Currency',       axes:{s:-0.10,e:0.80,n:-0.15},   pos:'embrace crypto, hands off',      neg:'regulate it like a security' },
  { id: 'social',   name: 'Social Security',        axes:{s:0.15,e:-0.80,n:0.15},    pos:'raise benefits, no cuts ever',   neg:'means-test and raise the age' },
  { id: 'union',    name: 'Organized Labor',        axes:{s:-0.20,e:-0.85,n:0.15},   pos:'card check and sector bargaining', neg:'right-to-work everywhere' },
  { id: 'foreign',  name: 'Foreign Entanglements',  axes:{s:0.10,e:0.05,n:0.90},     pos:'come home, fund nothing abroad', neg:'lead alliances, arm partners' },
  { id: 'defense',  name: 'Defense Spending',       axes:{s:0.45,e:0.35,n:0.55},     pos:'a much bigger military',         neg:'deep cuts to the Pentagon' },
  { id: 'drugs',    name: 'Drug Policy',            axes:{s:-0.80,e:-0.15,n:-0.20},  pos:'legalize and treat, not jail',   neg:'zero tolerance, hard sentences' },
  { id: 'edu',      name: 'Public Schools',         axes:{s:0.35,e:0.70,n:0.15},     pos:'vouchers and school choice',     neg:'fund public schools only' },
  { id: 'tech',     name: 'Big Tech Power',         axes:{s:0.10,e:-0.75,n:0.30},    pos:'break the platforms up',         neg:'let the winners keep winning' },
  { id: 'water',    name: 'Water & Drought',        axes:{s:-0.20,e:-0.60,n:-0.15},  pos:'federal rationing and rebuild',  neg:'states and markets sort it out' },
  { id: 'space',    name: 'The Space Program',      axes:{s:0.05,e:0.35,n:0.55},     pos:'a flag on Mars this decade',     neg:'spend it here on Earth' },
  { id: 'privacy',  name: 'Surveillance',           axes:{s:0.55,e:0.05,n:0.55},     pos:'give agencies the tools',        neg:'encryption and privacy first' },
  { id: 'wage',     name: 'The Minimum Wage',       axes:{s:-0.15,e:-0.90,n:0},      pos:'raise it to a living wage',      neg:'let local markets set it' },
  { id: 'religion', name: 'Religion in Public Life',axes:{s:0.90,e:0,n:0.25},        pos:'faith belongs in government',    neg:'a hard wall of separation' },
  { id: 'vote',     name: 'Voting Rules',           axes:{s:0.45,e:0.10,n:0.45},     pos:'strict ID, tighter rolls',       neg:'automatic universal registration' },
  { id: 'child',    name: 'Child Care',             axes:{s:-0.35,e:-0.75,n:-0.05},  pos:'universal subsidized care',      neg:'families handle their own' },
  { id: 'farm',     name: 'Farm & Food Policy',     axes:{s:0.25,e:0.05,n:0.65},     pos:'protect and subsidize growers',  neg:'end the subsidy regime' },
  { id: 'prison',   name: 'Prison Reform',          axes:{s:-0.80,e:-0.25,n:-0.15},  pos:'decarcerate and rehabilitate',   neg:'longer sentences, more beds' },
  { id: 'transit',  name: 'Transit & Rail',         axes:{s:-0.30,e:-0.65,n:-0.15},  pos:'national high-speed rail',       neg:'roads, cars, and no new taxes' },
  { id: 'ubi',      name: 'A Basic Income',         axes:{s:-0.30,e:-0.85,n:-0.10},  pos:'a monthly check for everyone',   neg:'work requirements, no handouts' },
];

// Random framings that give a topic its "this cycle" flavour.
window.TOPIC_HOOKS = [
  'after a leaked memo lands on the front page',
  'following three weeks of protests on the Mall',
  'after a viral clip racks up 40 million views',
  'in the wake of a surprise Supreme Court order',
  'after a bruising Senate hearing',
  'now that a bipartisan bill has collapsed',
  'after a whistleblower goes public',
  'following an emergency governors’ summit',
  'after the numbers came in worse than forecast',
  'now that a documentary has the country arguing',
  'after a late-night monologue turns it into a punchline',
  'following a mass resignation at the agency',
];

/* ---------- Stance labels ---------- */
window.stanceLabel = function (topic, v) {
  const dir = v > 0 ? topic.pos : topic.neg;
  const mag = Math.abs(v);
  if (mag === 0) return 'No firm position';
  const pre = mag === 3 ? 'Absolutely' : mag === 2 ? 'Firmly' : 'Leaning';
  return pre + ': ' + dir;
};

/* ---------- Campaign actions ----------
   scope     'national' | 'state'
   cost      base cost in $M (state actions are per state)
   reach     share of the electorate the medium can touch
   ageMult / genMult   how well the medium penetrates each slice
   variance  spread of the outcome roll
   backfire  chance the buy hurts instead of helps
------------------------------------------------ */
window.ACTIONS = {
  tv: {
    id: 'tv', label: 'TV Advertising', icon: '📺', kind: 'ad', scope: 'both',
    costNational: 34, costState: 11, reach: 1.00, variance: 0.30, backfire: 0.06,
    ageMult: { young: 0.45, middle: 1.00, old: 1.55 },
    genMult: { male: 1.0, female: 1.05, nonbinary: 0.85 },
    blurb: 'Thirty-second spots in every market. Expensive, broad, and older eyes are the ones still watching live.',
  },
  internet: {
    id: 'internet', label: 'Internet Advertising', icon: '📱', kind: 'ad', scope: 'both',
    costNational: 15, costState: 5, reach: 0.92, variance: 0.62, backfire: 0.12,
    ageMult: { young: 1.75, middle: 1.00, old: 0.32 },
    genMult: { male: 1.05, female: 1.0, nonbinary: 1.35 },
    blurb: 'Cheap, fast, wildly variable. Sometimes it is a movement. Sometimes it is a ratio.',
  },
  print: {
    id: 'print', label: 'Print Advertising', icon: '📰', kind: 'ad', scope: 'both',
    costNational: 11, costState: 4, reach: 0.48, variance: 0.18, backfire: 0.03,
    ageMult: { young: 0.22, middle: 0.75, old: 1.85 },
    genMult: { male: 1.0, female: 1.0, nonbinary: 0.8 },
    blurb: 'Full pages in the metro dailies. Nobody under forty will ever see it, and it never blows up in your face.',
  },
  rally: {
    id: 'rally', label: 'Campaign Visit', icon: '🎤', kind: 'visit', scope: 'state',
    costNational: 0, costState: 8, reach: 1.35, variance: 0.38, backfire: 0.08,
    ageMult: { young: 1.15, middle: 1.05, old: 0.95 },
    genMult: { male: 1.0, female: 1.0, nonbinary: 1.0 },
    blurb: 'You, a stage, a high school gym. Deep effect in one state plus a slice of earned media everywhere else.',
  },
  canvass: {
    id: 'canvass', label: 'Field & Canvassing', icon: '🚪', kind: 'field', scope: 'state',
    costNational: 0, costState: 7, reach: 0.85, variance: 0.10, backfire: 0.01,
    ageMult: { young: 1.05, middle: 1.05, old: 1.05 },
    genMult: { male: 1.0, female: 1.0, nonbinary: 1.0 },
    blurb: 'Doors, clipboards, and volunteers. Small, dull, and the most reliable dollar in politics.',
  },
};

window.SPECIALS = {
  pivot:  { id: 'pivot',  label: 'Change a Policy',      icon: '🔀', cost: 12,
            blurb: 'Move one of your stances. The electorate updates instantly — but reporters keep the old tape.' },
  celeb:  { id: 'celeb',  label: 'Celebrity Endorsement',icon: '⭐', cost: 22,
            blurb: 'Book a famous friend. Enormous demographic pull when it lands, a news cycle of cringe when it does not.' },
  vip:    { id: 'vip',    label: 'Donor & VIP Circuit',  icon: '🥂', cost: 14,
            blurb: 'Rubber chicken, six figures a plate. Spend money to make money — and lose a little authenticity.' },
  oppo:   { id: 'oppo',   label: 'Opposition Research',  icon: '🔎', cost: 16,
            blurb: 'Dig on a rival. Unlocks a sharper attack and may surface something that damages them on its own.' },
  corp:   { id: 'corp',   label: 'Take Corporate Money', icon: '🏛️', cost: 0,
            blurb: 'An industry wants a friend in the building. The cheque clears immediately. The bill comes later.' },
};

/* ---------- Celebrities ---------- */
window.CELEBRITIES = [
  { name: 'Dax Moreno',        field: 'streaming megastar',      pull: { young: 2.0, middle: 0.8, old: 0.2 }, gen: { female: 1.2, male: 0.9, nonbinary: 1.3 }, power: 1.25, risk: 0.16 },
  { name: 'Marguerite Vale',   field: 'daytime television icon', pull: { young: 0.3, middle: 1.2, old: 1.9 }, gen: { female: 1.6, male: 0.7, nonbinary: 0.9 }, power: 1.15, risk: 0.10 },
  { name: 'Coach Bud Hanrahan',field: 'legendary football coach',pull: { young: 0.9, middle: 1.5, old: 1.3 }, gen: { female: 0.7, male: 1.6, nonbinary: 0.6 }, power: 1.10, risk: 0.12 },
  { name: 'Nia Okonkwo',       field: 'astronaut turned author', pull: { young: 1.2, middle: 1.3, old: 1.0 }, gen: { female: 1.3, male: 1.0, nonbinary: 1.1 }, power: 1.05, risk: 0.06 },
  { name: 'The Reverend Cass Bell', field: 'megachurch preacher',pull: { young: 0.4, middle: 1.2, old: 1.8 }, gen: { female: 1.1, male: 1.1, nonbinary: 0.3 }, power: 1.20, risk: 0.20 },
  { name: 'Jonah Pike',        field: 'billionaire provocateur', pull: { young: 1.4, middle: 1.1, old: 0.5 }, gen: { female: 0.6, male: 1.6, nonbinary: 0.5 }, power: 1.35, risk: 0.34 },
  { name: 'Lupe Ibarra',       field: 'country music royalty',   pull: { young: 0.8, middle: 1.5, old: 1.4 }, gen: { female: 1.3, male: 1.1, nonbinary: 0.7 }, power: 1.12, risk: 0.09 },
  { name: 'DJ Halcyon',        field: 'festival headliner',      pull: { young: 2.2, middle: 0.6, old: 0.1 }, gen: { female: 1.1, male: 1.1, nonbinary: 1.5 }, power: 1.20, risk: 0.22 },
  { name: 'Dr. Irene Sowell',  field: 'the nation’s doctor',pull: { young: 0.7, middle: 1.4, old: 1.6 }, gen: { female: 1.3, male: 0.9, nonbinary: 1.0 }, power: 1.00, risk: 0.05 },
  { name: 'Sgt. Ray Delacroix',field: 'decorated veteran',       pull: { young: 0.6, middle: 1.4, old: 1.6 }, gen: { female: 0.8, male: 1.5, nonbinary: 0.5 }, power: 1.08, risk: 0.08 },
  { name: 'Winona Frost',      field: 'literary novelist',       pull: { young: 1.1, middle: 1.2, old: 1.0 }, gen: { female: 1.4, male: 0.8, nonbinary: 1.4 }, power: 0.92, risk: 0.05 },
  { name: 'Kip Vandergraff',   field: 'late-night host',         pull: { young: 1.5, middle: 1.3, old: 0.6 }, gen: { female: 1.1, male: 1.1, nonbinary: 1.2 }, power: 1.10, risk: 0.14 },
];

/* ---------- Corporate backers ---------- */
window.CORPORATIONS = [
  { name: 'Halcyon Dynamics',    industry: 'defense contracting',  topics: ['defense','foreign','space','privacy'],   want: +2, money: 90,  power: 'a no-bid contract to rebuild the missile fleet' },
  { name: 'Meridian Petroleum',  industry: 'oil and gas',          topics: ['climate','water','transit'],             want: -2, money: 95,  power: 'drilling rights across four national preserves' },
  { name: 'Verdant Pharma',      industry: 'pharmaceuticals',      topics: ['health','drugs'],                        want: -2, money: 85,  power: 'a twelve-year extension on its patent monopolies' },
  { name: 'Northgate Financial', industry: 'banking',              topics: ['tax','crypto','college','housing'],      want: +2, money: 100, power: 'the quiet repeal of the capital reserve rules' },
  { name: 'Lumen Systems',       industry: 'artificial intelligence', topics: ['ai','tech','privacy','edu'],          want: -2, money: 110, power: 'a federal exemption from every model audit on the books' },
  { name: 'Cordova Foods',       industry: 'agribusiness',         topics: ['farm','wage','union','immig'],           want: +2, money: 70,  power: 'permanent control of the crop subsidy board' },
  { name: 'Atlas Carceral Group',industry: 'private prisons',      topics: ['prison','crime','drugs','immig'],        want: -2, money: 65,  power: 'a thirty-year federal detention contract' },
  { name: 'Bellweather Media',   industry: 'broadcast media',      topics: ['tech','privacy','vote'],                 want: -2, money: 80,  power: 'the end of the last ownership caps on local news' },
  { name: 'Sunbelt Realty Trust',industry: 'real estate',          topics: ['housing','transit','tax'],               want: -2, money: 75,  power: 'a nationwide preemption of every rent ordinance' },
  { name: 'Kestrel Insurance',   industry: 'health insurance',     topics: ['health','child','social'],               want: -2, money: 88,  power: 'the privatization of the public plan' },
];

/* ---------- AI opponent archetypes ---------- */
window.AI_ARCHETYPES = [
  { name: 'Governor Marla Whitfield', tag: 'the pragmatist', pragmatism: 0.75,  bio: 'Two-term governor. Balanced the budget, hates a speech, answers every question with a number. Ran the state through a hurricane and a strike in the same month.', tilt:{s:0.05,e:0.15,n:0.05}, spread:0.7, style:'balanced' },
  { name: 'Senator Ray Ledbetter',    tag: 'the institution', pragmatism: 0.6, bio: 'Thirty-one years in the Senate. Knows every rule and most of the janitors. Says the word "folks" roughly once a minute and means it.', tilt:{s:0.25,e:0.20,n:0.25}, spread:0.6, style:'tv' },
  { name: 'Mayor Aisha Bowen',        tag: 'the reformer', pragmatism: 0.4,    bio: 'Youngest mayor her city ever elected. Rebuilt the transit system, fought the police union to a draw, and still takes the bus to work.', tilt:{s:-0.5,e:-0.45,n:-0.3}, spread:0.8, style:'ground' },
  { name: 'Congressman Dale Prater',  tag: 'the firebrand', pragmatism: 0.22,   bio: 'Talk radio host turned congressman. Built a following on livestreams, contempt for the press, and an unbeatable memory for grievances.', tilt:{s:0.6,e:0.35,n:0.75}, spread:1.1, style:'attack' },
  { name: 'Dr. Priya Raghunathan',    tag: 'the technocrat', pragmatism: 0.55,  bio: 'Ran the national labs, then the pandemic response. Has never lost an argument about a spreadsheet and has never won one about a slogan.', tilt:{s:-0.25,e:-0.1,n:-0.35}, spread:0.5, style:'digital' },
  { name: 'General Thaddeus Cole',    tag: 'the commander', pragmatism: 0.45,   bio: 'Four stars, three wars, one very short memoir. Entered the race after a televised argument with a sitting cabinet secretary.', tilt:{s:0.4,e:0.25,n:0.6}, spread:0.7, style:'tv' },
  { name: 'Isabel Marchetti',         tag: 'the outsider', pragmatism: 0.4,    bio: 'Founded a logistics company in a garage and sold it for eleven figures. Has never held office and mentions that in every third sentence.', tilt:{s:0.1,e:0.7,n:0.15}, spread:0.9, style:'digital' },
  { name: 'Reverend Cy Trask',        tag: 'the moralist', pragmatism: 0.26,    bio: 'Filled the biggest sanctuary in three states every Sunday for twenty years. Preaches without notes and campaigns the same way.', tilt:{s:0.75,e:0.2,n:0.4}, spread:0.8, style:'ground' },
  { name: 'Justice Nadine Okoro',     tag: 'the jurist', pragmatism: 0.6,      bio: 'Retired from the appellate bench to run. Speaks in complete paragraphs, refuses to attack anyone by name, and is quietly ruthless.', tilt:{s:-0.35,e:-0.2,n:-0.2}, spread:0.6, style:'balanced' },
  { name: 'Union Chief Bobby Nunez',  tag: 'the organizer', pragmatism: 0.36,   bio: 'Ran the biggest local in the country and shut down a port for nine days. Knows the name of every shop steward in six states.', tilt:{s:-0.15,e:-0.8,n:0.35}, spread:0.9, style:'ground' },
  { name: 'Chancellor Evelyn Hark',   tag: 'the academic', pragmatism: 0.5,    bio: 'Ran a university system of four hundred thousand students. Wrote the book on federalism, literally, and it is nine hundred pages.', tilt:{s:-0.4,e:-0.3,n:-0.45}, spread:0.6, style:'balanced' },
  { name: 'Sheriff Wade Bristow',     tag: 'the lawman', pragmatism: 0.36,      bio: 'Elected sheriff six times in the largest rural county in the state. Campaigns in the uniform and is very clear that this is on purpose.', tilt:{s:0.65,e:0.3,n:0.5}, spread:0.8, style:'attack' },
];
