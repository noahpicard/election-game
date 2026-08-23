/* ============================================================
   analyst.js — the "Pundit Engine"
   Reads a candidate's bio and derives a foundational appeal
   profile: headline traits, an ideological tilt, and a starting
   bias with every demographic slice.

   This is a local, deterministic text analyser (lexicon +
   style heuristics), not a call out to a language model — the
   game runs entirely offline in the browser.
   ============================================================ */

/* Deterministic hash so the same bio always yields the same read. */
function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/* Lexicon. Each entry can move the candidate's ideological tilt,
   their standing with age/gender slices, and their headline traits. */
const LEXICON = [
  { re: /\b(veteran|army|navy|marines?|marine corps|air ?force|combat|deploy\w*|served overseas|purple heart|sergeant|colonel|general|enlisted|tour of duty)\b/i,
    note: 'Military service reads as duty and steadiness.',
    tilt: { s: 0.20, n: 0.35 }, age: { old: 0.55, middle: 0.30, young: -0.10 }, gen: { male: 0.35, female: 0.05, nonbinary: -0.15 },
    traits: { gravitas: 12, trust: 10 } },

  { re: /\b(teacher|teach\w*|professor|educator|classroom|school board|principal|chancellor|university)\b/i,
    note: 'A classroom background is the single most trusted résumé line in politics.',
    tilt: { e: -0.20 }, age: { young: 0.25, middle: 0.35 }, gen: { female: 0.35, nonbinary: 0.20 },
    traits: { trust: 14, relatability: 10 } },

  { re: /\b(nurse|nursing|doctor|physician|surgeon|paramedic|hospital|\ber\b|emergency room|medic\w*|epidemiolog\w*|clinic)\b/i,
    note: 'Medical credentials buy an enormous amount of benefit of the doubt.',
    tilt: { e: -0.25 }, age: { old: 0.40, middle: 0.25 }, gen: { female: 0.30 },
    traits: { trust: 16, gravitas: 8 } },

  { re: /\b(farm\w*|ranch\w*|agricultur\w*|crops?|livestock|harvest|cattle|acres|tractor)\b/i,
    note: 'Rural roots travel well through the middle of the country.',
    tilt: { s: 0.25, n: 0.30 }, age: { old: 0.35, middle: 0.20 }, gen: { male: 0.25 },
    traits: { relatability: 12, trust: 8 } },

  { re: /\b(factor(y|ies)|union|local \d+|shop floor|assembly line|steel|mill|weld\w*|machinist|electrician|plumber|trucker|truck driver|warehouse|labou?r|picket|strike|payroll|shift work|blue collar|working class)\b/i,
    note: 'Working-class credentials cut hard against the "out of touch" charge.',
    tilt: { e: -0.45, n: 0.25 }, age: { middle: 0.35, old: 0.25 }, gen: { male: 0.30 },
    traits: { relatability: 18, trust: 8 } },

  { re: /\b(founder|startup|entrepreneur|ceo|built a company|small business|invest|venture|billion)\b/i,
    note: 'Business success signals competence and, to some, contempt.',
    tilt: { e: 0.55 }, age: { middle: 0.30, young: 0.10, old: 0.05 }, gen: { male: 0.30, nonbinary: -0.15 },
    traits: { gravitas: 10, relatability: -12 } },

  { re: /\b(engineer|scientist|research|phd|physicist|data|technolog|software|coder|programmer)\b/i,
    note: 'Technical fluency plays as competence and reads a little cold.',
    tilt: { n: -0.20 }, age: { young: 0.35, middle: 0.15, old: -0.15 }, gen: { nonbinary: 0.25 },
    traits: { gravitas: 12, relatability: -8 } },

  { re: /\b(lawyer|attorney|prosecutor|judge|district attorney|court|litigat|counsel)\b/i,
    note: 'Legal training projects precision. Voters do not love lawyers.',
    tilt: { s: 0.10 }, age: { middle: 0.20, old: 0.15 }, gen: {},
    traits: { gravitas: 14, relatability: -14 } },

  { re: /\b(pastor|preacher|church|faith|congregation|ministry|scripture|god|prayer|believer)\b/i,
    note: 'Open faith is a firm anchor with older and rural voters and a wall with the young.',
    tilt: { s: 0.60, n: 0.20 }, age: { old: 0.60, middle: 0.20, young: -0.45 }, gen: { nonbinary: -0.60, female: 0.10 },
    traits: { trust: 8, gravitas: 8 } },

  { re: /\b(activist|organizer|movement|protest|march|grassroots|advocate|community)\b/i,
    note: 'Movement credentials energize the base and worry the middle.',
    tilt: { s: -0.45, e: -0.40, n: -0.30 }, age: { young: 0.60, middle: 0.05, old: -0.35 }, gen: { female: 0.20, nonbinary: 0.55 },
    traits: { charisma: 10, gravitas: -8 } },

  { re: /\b(mayor|governor|senator|congress|representative|legislature|city council|elected|office|incumbent)\b/i,
    note: 'A record in office is a résumé and a liability at the same time.',
    tilt: {}, age: { old: 0.35, middle: 0.20, young: -0.20 }, gen: {},
    traits: { gravitas: 16, establishment: 24, relatability: -10 } },

  { re: /\b(outsider|never held office|drain the swamp|career politician|washington is broken|corrupt)\b/i,
    note: 'Running against the building itself. Volatile, and it works more often than it should.',
    tilt: { n: 0.35 }, age: { middle: 0.25, young: 0.20 }, gen: { male: 0.20 },
    traits: { charisma: 12, establishment: -30, gravitas: -10 } },

  { re: /\b(single mother|single mom|single father|raised (me|us)|food stamps|poverty|broke|paycheck|paycheque|eviction|evicted|homeless|struggled|couldn.t afford|second job)\b/i,
    note: 'A hardship story is the most portable form of political capital there is.',
    tilt: { e: -0.40 }, age: { young: 0.30, middle: 0.30 }, gen: { female: 0.35, nonbinary: 0.25 },
    traits: { relatability: 22, trust: 10 } },

  { re: /\b(immigrant|refugee|came to this country|first generation|naturalized|abuela|abuelo)\b/i,
    note: 'An immigrant story reads as the American myth to some and as the argument itself to others.',
    tilt: { n: -0.55, s: -0.20 }, age: { young: 0.35 }, gen: { female: 0.15, nonbinary: 0.25 },
    traits: { relatability: 12, charisma: 6 } },

  { re: /\b(mother|father|mom|dad|parent|kids|children|grandchildren|grandkids|family)\b/i,
    note: 'Family framing is cheap, safe, and it still moves suburban numbers.',
    tilt: { s: 0.15 }, age: { middle: 0.30, old: 0.20 }, gen: { female: 0.25 },
    traits: { relatability: 10, trust: 6 } },

  { re: /\b(athlete|olympic|championship|coach|quarterback|team|league)\b/i,
    note: 'Sport gives you a crowd that has already decided it likes you.',
    tilt: { s: 0.10 }, age: { young: 0.25, middle: 0.30 }, gen: { male: 0.35 },
    traits: { charisma: 14, gravitas: -6 } },

  { re: /\b(actor|musician|singer|band|celebrity|famous|reality|host|podcast|influencer|streamer)\b/i,
    note: 'Fame is reach you did not have to pay for, and a ceiling you did not choose.',
    tilt: { s: -0.20 }, age: { young: 0.55, middle: 0.10, old: -0.35 }, gen: { nonbinary: 0.30 },
    traits: { charisma: 22, gravitas: -18 } },

  { re: /\b(climate|renewable|solar|wind|planet|emissions|green)\b/i,
    note: 'Climate framing sorts the electorate faster than almost any other phrase.',
    tilt: { s: -0.25, e: -0.35, n: -0.30 }, age: { young: 0.45, old: -0.25 }, gen: { female: 0.20, nonbinary: 0.40 },
    traits: {} },

  { re: /\b(border|illegal|sovereignty|america first|patriot|flag|constitution|founding)\b/i,
    note: 'Nationalist vocabulary. It consolidates one half and hardens the other.',
    tilt: { n: 0.60, s: 0.30 }, age: { old: 0.45, middle: 0.15, young: -0.35 }, gen: { male: 0.30, nonbinary: -0.45 },
    traits: { charisma: 6 } },

  { re: /\b(equity|justice|marginalized|systemic|inclusive|diversity|queer|lgbt|trans)\b/i,
    note: 'Justice vocabulary. Deep loyalty from a narrow slice, resistance beyond it.',
    tilt: { s: -0.65, n: -0.35 }, age: { young: 0.50, old: -0.40 }, gen: { nonbinary: 0.85, female: 0.25, male: -0.20 },
    traits: {} },

  { re: /\b(bipartisan|across the aisle|compromise|common ground|unity|both parties|listen)\b/i,
    note: 'Consensus language: a broad, shallow appeal that almost nobody hates.',
    tilt: {}, age: { old: 0.25, middle: 0.25 }, gen: { female: 0.15 },
    traits: { trust: 12, charisma: -8 } },
];

const STOPWORD = /\b(the|and|a|an|of|to|in|for|on|with|at|by|from|is|was|be|as|that|this|it|i|my|we|our)\b/gi;

window.analyzeBio = function (name, bioRaw) {
  const bio = (bioRaw || '').trim();
  const text = bio.toLowerCase();
  const words = bio.split(/\s+/).filter(Boolean);
  const wc = words.length;
  const seed = hashString(name + '|' + bio);
  // Deterministic tiny wobble so two similar bios are not identical.
  const wob = (i) => (((seed >>> (i * 5)) & 255) / 255 - 0.5) * 0.16;

  const traits = { charisma: 50, trust: 50, relatability: 50, gravitas: 50, establishment: 50 };
  const tilt = { s: 0, e: 0, n: 0 };
  const age = { young: 0, middle: 0, old: 0 };
  const gen = { male: 0, female: 0, nonbinary: 0 };
  const notes = [];

  for (const entry of LEXICON) {
    if (!entry.re.test(text)) continue;
    notes.push(entry.note);
    for (const k in entry.tilt) tilt[k] += entry.tilt[k];
    for (const k in entry.age) age[k] += entry.age[k];
    for (const k in entry.gen) gen[k] += entry.gen[k];
    for (const k in entry.traits) traits[k] += entry.traits[k];
  }

  /* ---- style heuristics ---- */
  if (wc === 0) {
    notes.push('No biography submitted. The public knows nothing about you, and the public assumes the worst.');
    traits.charisma -= 18; traits.trust -= 14; traits.relatability -= 12; traits.gravitas -= 10;
  } else if (wc < 18) {
    notes.push('The biography is thin. Voters fill a vacuum with whatever your opponents put there.');
    traits.gravitas -= 10; traits.trust -= 6;
  } else if (wc > 140) {
    notes.push('It runs long. Length reads as substance to some and as a filibuster to everyone else.');
    traits.gravitas += 8; traits.relatability -= 10; traits.charisma -= 5;
  } else if (wc >= 40 && wc <= 110) {
    notes.push('Well-proportioned. Long enough to be a person, short enough to be a poster.');
    traits.charisma += 6; traits.trust += 4;
  }

  const bangs = (bio.match(/!/g) || []).length;
  if (bangs >= 3) {
    notes.push('Heavy on exclamation. Energy up, gravity down.');
    traits.charisma += 9; traits.gravitas -= 12;
  }
  const caps = (bio.match(/\b[A-Z]{3,}\b/g) || []).length;
  if (caps >= 2) {
    notes.push('Shouting in capitals. It travels, and it is remembered for the wrong reasons.');
    traits.charisma += 12; traits.trust -= 10; traits.gravitas -= 10;
    age.young += 0.15; age.old -= 0.15;
  }
  const firstPerson = (text.match(/\bi\b|\bmy\b|\bme\b/g) || []).length;
  if (wc > 20 && firstPerson / wc > 0.09) {
    notes.push('Relentlessly first-person. Reads as conviction or as ego depending on the room.');
    traits.charisma += 7; traits.trust -= 7;
  }
  if (/\d/.test(bio)) {
    notes.push('You brought numbers. Specificity is the cheapest credibility on the market.');
    traits.trust += 9; traits.gravitas += 7;
  }
  const clean = text.replace(STOPWORD, ' ');
  const avgLen = clean.split(/\s+/).filter(Boolean).reduce((a, w) => a + w.length, 0) / Math.max(1, clean.split(/\s+/).filter(Boolean).length);
  if (avgLen > 7.2) {
    notes.push('The vocabulary is elevated. It sounds like a report, not a neighbour.');
    traits.gravitas += 10; traits.relatability -= 12;
    age.old += 0.1; age.young -= 0.05;
  } else if (avgLen > 0 && avgLen < 4.9) {
    notes.push('Short, plain words. That is how you get quoted.');
    traits.relatability += 12; traits.charisma += 6; traits.gravitas -= 5;
  }
  if (notes.length === 0) notes.push('Nothing in the text grabs a hook. A blank slate is safe and forgettable.');

  /* ---- normalise ---- */
  for (const k in traits) traits[k] = Math.max(2, Math.min(98, Math.round(traits[k] + wob(1) * 40)));
  for (const k in tilt) tilt[k] = Math.max(-1, Math.min(1, tilt[k] * 0.55 + wob(2)));
  for (const k in age) age[k] = Math.max(-1.2, Math.min(1.2, age[k] * 0.55 + wob(3)));
  for (const k in gen) gen[k] = Math.max(-1.2, Math.min(1.2, gen[k] * 0.55 + wob(4)));

  // Overall appeal drives starting bias floor and effectiveness of campaigning.
  const appeal = (traits.charisma * 0.3 + traits.trust * 0.3 + traits.relatability * 0.25 + traits.gravitas * 0.15) / 100;

  return {
    traits, tilt, age, gen, notes,
    appeal,                                    // ~0.2 .. ~0.95
    effectiveness: 0.72 + appeal * 0.55,       // multiplier on every campaign action
    gaffeRisk: Math.max(0.02, 0.16 - traits.gravitas / 900 - traits.trust / 1200),
    verdict: verdictFor(appeal, traits),
  };
};

function verdictFor(appeal, t) {
  if (appeal > 0.72) return 'A natural. The consultants are already fighting over you.';
  if (appeal > 0.62) return 'Strong raw material. Give the country a reason and it will listen.';
  if (appeal > 0.52) return 'Viable. You will have to buy the attention you do not earn.';
  if (appeal > 0.42) return 'A hard sell. Everything you do this cycle will cost more than it should.';
  return 'The focus groups went quiet. You are running uphill in the rain.';
}
