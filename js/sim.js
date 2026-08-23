/* ============================================================
   sim.js — the electorate and the election
   ============================================================ */

/* ---------- seeded RNG (mulberry32) ---------- */
window.makeRng = function (seed) {
  let a = seed >>> 0;
  const r = function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (lo, hi) => lo + r() * (hi - lo);
  r.int = (lo, hi) => Math.floor(lo + r() * (hi - lo + 1));
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.gauss = (mu, sd) => {
    let u = 0, v = 0;
    while (u === 0) u = r();
    while (v === 0) v = r();
    return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  r.shuffle = (arr) => {
    const a2 = arr.slice();
    for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; }
    return a2;
  };
  return r;
};

const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
window.clamp = clamp;

const AXIS_GAIN = 1.55;          // how sharply an ideology profile maps onto a −3..+3 stance
const VOTER_NOISE = 0.9;         // individual variation on top of the demographic average

/* ---------- topic selection ---------- */
window.rollTopics = function (rng) {
  const pool = rng.shuffle(window.TOPIC_POOL);
  return pool.slice(0, 5).map((t, i) => ({
    ...t,
    index: i,
    hook: rng.pick(window.TOPIC_HOOKS),
    // Per-cycle wrinkle: the country's mood on this issue shifts a little every election.
    mood: rng.gauss(0, 0.35),
  }));
};

function profileScore(topic, profile) {
  const a = topic.axes;
  return 3 * AXIS_GAIN * ((a.s || 0) * (profile.s || 0) + (a.e || 0) * (profile.e || 0) + (a.n || 0) * (profile.n || 0));
}

/* ---------- electorate ---------- */
window.buildElectorate = function (rng, topics, nCandidates) {
  const electorate = {};

  // Pre-compute the demographic-group stance vectors once.
  const ageVec = {}, genVec = {};
  for (const a of window.AGE_GROUPS) ageVec[a.id] = topics.map(t => clamp(profileScore(t, a.profile) + t.mood, -3, 3));
  for (const g of window.GENDERS) genVec[g.id] = topics.map(t => clamp(profileScore(t, g.profile) + t.mood, -3, 3));

  for (const ab in window.STATES) {
    const st = window.STATES[ab];
    const stateVec = topics.map(t => clamp(profileScore(t, st) + t.mood + rng.gauss(0, 0.45), -3, 3));

    // Deterministic allocation of the 100 simulated voters so the shares are exact.
    const youngN = Math.round(st.young * 100);
    const oldN = Math.round(st.old * 100);
    const midN = 100 - youngN - oldN;
    const nbN = Math.max(0, Math.round(st.nb * 100));
    const maleN = Math.round(st.male * (100 - nbN));
    const femN = 100 - nbN - maleN;

    const ages = [].concat(Array(youngN).fill('young'), Array(midN).fill('middle'), Array(oldN).fill('old'));
    const gens = rng.shuffle([].concat(Array(maleN).fill('male'), Array(femN).fill('female'), Array(nbN).fill('nonbinary')));

    const voters = [];
    const turnoutOf = {};
    for (const a of window.AGE_GROUPS) turnoutOf[a.id] = a.turnout;
    // People per simulated voter, weighted by how reliably that age group turns out.
    const perVoter = (st.pop * 1e6) / 100;

    for (let i = 0; i < 100; i++) {
      const a = ages[i], g = gens[i];
      const vec = new Float64Array(5);
      for (let t = 0; t < 5; t++) {
        vec[t] = clamp((stateVec[t] + ageVec[a][t] + genVec[g][t]) / 3 + rng.gauss(0, VOTER_NOISE), -3, 3);
      }
      voters.push({
        age: a, gender: g, vec,
        bias: new Float64Array(nCandidates),
        w: perVoter * turnoutOf[a],
      });
    }
    electorate[ab] = { ab, voters, stateVec, totalW: voters.reduce((s, v) => s + v.w, 0) };
  }
  return electorate;
};

/* ---------- candidate vector ---------- */
// [ stance_1 .. stance_5 , +3 in my own bias slot, −3 in every rival's ]
window.candidateVector = function (cand, idx, n) {
  const v = new Float64Array(5 + n);
  for (let i = 0; i < 5; i++) v[i] = cand.stances[i];
  for (let k = 0; k < n; k++) v[5 + k] = (k === idx) ? 3 : -3;
  return v;
};

function cosine(a, b, len) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < len; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
window.cosine = cosine;

/* ---------- the count ---------- */
window.tallyElection = function (G) {
  const n = G.candidates.length;
  const dim = 5 + n;
  const cvecs = G.candidates.map((c, i) => window.candidateVector(c, i, n));
  const scratch = new Float64Array(dim);

  const states = {};
  const national = new Float64Array(n);
  const evs = new Float64Array(n);
  // support[candidate][ageId / genderId] -> weighted votes, for the breakdown panels
  const demo = G.candidates.map(() => ({ young: 0, middle: 0, old: 0, male: 0, female: 0, nonbinary: 0 }));
  const demoTotals = { young: 0, middle: 0, old: 0, male: 0, female: 0, nonbinary: 0 };

  for (const ab in G.electorate) {
    const S = G.electorate[ab];
    const votes = new Float64Array(n);
    const heads = new Float64Array(n);           // raw simulated-voter counts (out of 100)
    const sdemo = G.candidates.map(() => ({ young: 0, middle: 0, old: 0, male: 0, female: 0, nonbinary: 0 }));
    const sdemoTot = { young: 0, middle: 0, old: 0, male: 0, female: 0, nonbinary: 0 };

    for (const v of S.voters) {
      for (let i = 0; i < 5; i++) scratch[i] = v.vec[i];
      for (let k = 0; k < n; k++) scratch[5 + k] = v.bias[k];

      let best = -Infinity, bi = 0;
      for (let k = 0; k < n; k++) {
        const sim = cosine(scratch, cvecs[k], dim);
        if (sim > best) { best = sim; bi = k; }
      }
      votes[bi] += v.w; heads[bi] += 1;
      sdemo[bi][v.age] += v.w; sdemo[bi][v.gender] += v.w;
      sdemoTot[v.age] += v.w; sdemoTot[v.gender] += v.w;
      demo[bi][v.age] += v.w; demo[bi][v.gender] += v.w;
      demoTotals[v.age] += v.w; demoTotals[v.gender] += v.w;
      national[bi] += v.w;
    }

    const tot = S.totalW;
    const shares = Array.from(votes, x => x / tot);
    let win = 0; for (let k = 1; k < n; k++) if (votes[k] > votes[win]) win = k;
    const sorted = shares.slice().sort((a, b) => b - a);
    states[ab] = {
      ab, votes: Array.from(votes), heads: Array.from(heads), shares,
      winner: win, margin: sorted[0] - (sorted[1] || 0),
      ev: window.STATES[ab].ev, demo: sdemo, demoTot: sdemoTot, total: tot,
    };
    evs[win] += window.STATES[ab].ev;
  }

  const natTot = Array.from(national).reduce((a, b) => a + b, 0);
  return {
    states,
    ev: Array.from(evs),
    votes: Array.from(national),
    shares: Array.from(national, x => x / natTot),
    totalVotes: natTot,
    demo, demoTotals,
  };
};

/* ---------- polling: gaussian fuzz over the truth ---------- */
window.pollFrom = function (truth, sigma, rng, n) {
  const states = {};
  const evs = new Float64Array(n);
  const national = new Float64Array(n);
  let natTot = 0;
  // A single national "house effect" applies to every state, the way real polling error does.
  const house = Array.from({ length: n }, () => rng.gauss(0, sigma * 0.55));

  for (const ab in truth.states) {
    const t = truth.states[ab];
    const raw = t.shares.map((s, k) => Math.max(0.001, s + house[k] + rng.gauss(0, sigma)));
    const sum = raw.reduce((a, b) => a + b, 0);
    const shares = raw.map(x => x / sum);
    let win = 0; for (let k = 1; k < n; k++) if (shares[k] > shares[win]) win = k;
    const sorted = shares.slice().sort((a, b) => b - a);
    states[ab] = { ab, shares, winner: win, margin: sorted[0] - (sorted[1] || 0), ev: t.ev, total: t.total, demo: t.demo, demoTot: t.demoTot, votes: shares.map(s => s * t.total) };
    evs[win] += t.ev;
    for (let k = 0; k < n; k++) { national[k] += shares[k] * t.total; }
    natTot += t.total;
  }
  return {
    states, ev: Array.from(evs), votes: Array.from(national),
    shares: Array.from(national, x => x / natTot), totalVotes: natTot,
    demo: truth.demo, demoTotals: truth.demoTotals, isPoll: true,
  };
};

/* ---------- applying a campaign action to the electorate ---------- */
/* spec: { cand, magnitude, states|null, ageMult, genMult, ageFilter, genFilter,
           attack: targetIndex|null, blowback } */
window.applyBias = function (G, spec) {
  const abs = spec.states || Object.keys(G.electorate);
  const spill = spec.spill || 0;           // effect applied to every *other* state
  const allAbs = Object.keys(G.electorate);
  const inScope = new Set(abs);
  let touched = 0, totalDelta = 0, totalWeight = 0;

  for (const ab of allAbs) {
    const scoped = inScope.has(ab);
    if (!scoped && spill <= 0) continue;
    const scale = scoped ? 1 : spill;
    for (const v of G.electorate[ab].voters) {
      let d = spec.magnitude * scale;
      d *= (spec.ageMult && spec.ageMult[v.age] != null) ? spec.ageMult[v.age] : 1;
      d *= (spec.genMult && spec.genMult[v.gender] != null) ? spec.genMult[v.gender] : 1;
      if (spec.ageFilter) d *= (v.age === spec.ageFilter) ? 2.0 : 0.12;
      if (spec.genFilter) d *= (v.gender === spec.genFilter) ? 2.0 : 0.12;
      if (d === 0) continue;

      if (spec.attack != null) {
        v.bias[spec.attack] = clamp(v.bias[spec.attack] - d, -3, 3);
        if (spec.blowback) v.bias[spec.cand] = clamp(v.bias[spec.cand] - d * spec.blowback, -3, 3);
      } else {
        v.bias[spec.cand] = clamp(v.bias[spec.cand] + d, -3, 3);
      }
      totalDelta += Math.abs(d) * v.w; totalWeight += v.w; touched++;
    }
  }
  return { touched, intensity: totalWeight > 0 ? totalDelta / totalWeight : 0 };
};

/* ---------- foundational appeal ----------
   Before a dollar is spent, the biography has already decided who is
   willing to listen. This seeds every voter's bias toward each candidate. */
const GUT_SIGMA = 0.34;
window.seedFoundationalAppeal = function (G, rng) {
  for (const c of G.candidates) {
    const a = c.analysis;
    for (const ab in G.electorate) {
      for (const v of G.electorate[ab].voters) {
        const demo = 0.20 * (a.age[v.age] + a.gen[v.gender]);
        const broad = 0.25 * (a.appeal - 0.55);
        // Gut feeling: people form impressions that no model can explain.
        v.bias[c.idx] += clamp(demo + broad + rng.gauss(0, GUT_SIGMA), -3, 3);
      }
    }
  }
};

/* ---------- where the electorate actually sits on each issue ---------- */
window.electorateCentre = function (G) {
  const out = [];
  for (let i = 0; i < 5; i++) {
    let sum = 0, tot = 0;
    for (const ab in G.electorate)
      for (const v of G.electorate[ab].voters) { sum += v.vec[i] * v.w; tot += v.w; }
    out.push(sum / tot);
  }
  return out;
};

/* ---------- authenticity ----------
   A biography implies positions. Running on the opposite of them is possible,
   and it costs you: only the issues your story actually spoke to are counted. */
window.authenticity = function (analysis, topics, stances) {
  const ideal = topics.map(t => clamp(3 * AXIS_GAIN * (
    (t.axes.s || 0) * analysis.tilt.s + (t.axes.e || 0) * analysis.tilt.e + (t.axes.n || 0) * analysis.tilt.n), -3, 3));
  const counted = [];
  for (let i = 0; i < topics.length; i++) if (Math.abs(ideal[i]) >= 1) counted.push(i);
  if (!counted.length) return { score: 1, dev: 0, counted: [], ideal, label: 'Your story does not commit you to anything in particular.' };
  let dev = 0;
  for (const i of counted) dev += Math.abs(stances[i] - ideal[i]);
  dev /= counted.length;
  const score = clamp(1 - (dev - 1.2) / 3.0, 0, 1);
  const label = score > 0.85 ? 'You are running on the person you said you were.'
    : score > 0.62 ? 'A few positions sit oddly against your story. Survivable.'
    : score > 0.38 ? 'This platform and that biography are two different people. Reporters will notice.'
    : 'Nobody who reads your biography believes this platform. Nobody at all.';
  return { score, dev, counted, ideal, label };
};

/* ---------- helper: national demographic profile of the electorate ---------- */
window.electorateProfile = function (G) {
  const out = { age: {}, gender: {}, totalW: 0 };
  for (const a of window.AGE_GROUPS) out.age[a.id] = 0;
  for (const g of window.GENDERS) out.gender[g.id] = 0;
  for (const ab in G.electorate) {
    for (const v of G.electorate[ab].voters) {
      out.age[v.age] += v.w; out.gender[v.gender] += v.w; out.totalW += v.w;
    }
  }
  return out;
};
