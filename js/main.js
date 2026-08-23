/* ============================================================
   main.js — game state, screen flow, and every panel
   ============================================================ */
(function () {
const { $, el, esc, fmtMoney, pct, shadeFor } = window.UI;

/* ---------------- global game state ---------------- */
let G = null;
let cfg = { n: 3, rounds: 5, funding: 'flat' };
let ui = { tab: 'actions', selectedState: null, draft: null, mapMode: 'poll' };

/* ---------------- screens ---------------- */
const SCREENS = ['s-title','s-how','s-setup','s-bio','s-analysis','s-stance','s-hand','s-campaign','s-poll','s-night','s-final'];
function show(id) {
  SCREENS.forEach(s => $('#' + s).classList.toggle('active', s === id));
  window.scrollTo(0, 0);
}
function modal(html) { $('#modal').innerHTML = html; $('#modal-wrap').classList.add('on'); }
function closeModal() { $('#modal-wrap').classList.remove('on'); }
$('#modal-wrap').addEventListener('click', e => { if (e.target.id === 'modal-wrap') closeModal(); });

/* ---------------- polling noise field ----------------
   One noise field per round keeps the map stable while you campaign:
   your actions move the truth, the polling error stays put.        */
function noiseField(rng, n, sigma) {
  const f = { house: [], st: {} };
  for (let k = 0; k < n; k++) f.house.push(rng.gauss(0, sigma * 0.55));
  for (const ab in window.STATES) {
    const a = []; for (let k = 0; k < n; k++) a.push(rng.gauss(0, sigma));
    f.st[ab] = a;
  }
  return f;
}
function applyField(truth, field, n) {
  const states = {}; const evs = new Float64Array(n); const nat = new Float64Array(n);
  let natTot = 0;
  for (const ab in truth.states) {
    const t = truth.states[ab];
    const raw = t.shares.map((s, k) => Math.max(0.002, s + field.house[k] + field.st[ab][k]));
    const sum = raw.reduce((a, b) => a + b, 0);
    const shares = raw.map(x => x / sum);
    let win = 0; for (let k = 1; k < n; k++) if (shares[k] > shares[win]) win = k;
    const sorted = shares.slice().sort((a, b) => b - a);
    states[ab] = { ab, shares, winner: win, margin: sorted[0] - (sorted[1] || 0), ev: t.ev,
                   total: t.total, demo: t.demo, demoTot: t.demoTot, votes: shares.map(s => s * t.total) };
    evs[win] += t.ev;
    for (let k = 0; k < n; k++) nat[k] += shares[k] * t.total;
    natTot += t.total;
  }
  return { states, ev: Array.from(evs), votes: Array.from(nat),
           shares: Array.from(nat, x => x / natTot), totalVotes: natTot,
           demo: truth.demo, demoTotals: truth.demoTotals, isPoll: true };
}

/* ---------------- title / how ---------------- */
$('#btn-start').onclick = () => { buildSetup(); show('s-setup'); };
$('#btn-how').onclick = () => show('s-how');
$('#btn-how-back').onclick = () => show('s-title');
$('#btn-setup-back').onclick = () => show('s-title');

/* ---------------- setup ---------------- */
const FUNDING = [
  { id: 'flat',   title: 'Level playing field', desc: 'Every campaign is handed exactly the same money every round. Pure strategy, no excuses.' },
  { id: 'random', title: 'The luck of the draw', desc: 'Each campaign draws a different amount each round. Somebody is going to get rich and it might not be you.' },
  { id: 'corp',   title: 'Money with strings',  desc: 'Smaller budgets — but industries are offering cheques. Take one and they own a position on your platform.' },
];

function buildSetup() {
  const segC = $('#seg-count'); segC.innerHTML = '';
  [2,3,4,5,6].forEach(k => {
    const b = el('button', cfg.n === k ? 'on' : '', String(k));
    b.onclick = () => { cfg.n = k; normalizeSlots(); buildSetup(); };
    segC.appendChild(b);
  });
  const segR = $('#seg-rounds'); segR.innerHTML = '';
  [3,4,5,6,8].forEach(k => {
    const b = el('button', cfg.rounds === k ? 'on' : '', String(k));
    b.onclick = () => { cfg.rounds = k; buildSetup(); };
    segR.appendChild(b);
  });
  const fw = $('#opt-funding'); fw.innerHTML = '';
  FUNDING.forEach(f => {
    const c = el('div', 'opt-card' + (cfg.funding === f.id ? ' on' : ''),
      `<h4>${f.title}</h4><p>${f.desc}</p>`);
    c.onclick = () => { cfg.funding = f.id; buildSetup(); };
    fw.appendChild(c);
  });
  renderSlots();
}

let slotHuman = [true, false, false, false, false, false];
function normalizeSlots() { while (slotHuman.length < cfg.n) slotHuman.push(false); }

function renderSlots() {
  const w = $('#slots'); w.innerHTML = '';
  for (let i = 0; i < cfg.n; i++) {
    const p = window.PALETTE[i];
    const row = el('div', 'slot');
    row.innerHTML = `<span class="dot" style="background:${p.hex}"></span>
      <span class="who">Candidate ${i + 1}<span class="sub">${p.name}</span></span>`;
    const seg = el('div', 'seg');
    ['Human','AI'].forEach((lab, j) => {
      const isH = j === 0;
      const b = el('button', slotHuman[i] === isH ? 'on' : '', lab);
      b.onclick = () => { slotHuman[i] = isH; renderSlots(); };
      seg.appendChild(b);
    });
    row.appendChild(seg);
    w.appendChild(row);
  }
}

$('#btn-setup-go').onclick = () => {
  if (!slotHuman.slice(0, cfg.n).some(Boolean)) {
    modal(`<h3>Nobody is running</h3><p>At least one slot has to be a human, or there is nothing for you to do.
      You can still watch a pure AI race — set one slot to Human and simply end your turns.</p>
      <div class="setup-foot"><button class="btn" onclick="document.getElementById('modal-wrap').classList.remove('on')">Fine</button></div>`);
    return;
  }
  newGame();
};

/* ---------------- new game ---------------- */
function newGame() {
  const seed = (Math.random() * 4294967295) >>> 0;
  const rng = window.makeRng(seed);
  const topics = window.rollTopics(rng);
  const n = cfg.n;

  const candidates = [];
  const archetypes = rng.shuffle(window.AI_ARCHETYPES);
  // Make sure the field contains at least one opponent who actually chases votes.
  const nAi = Array.from({ length: n }, (_, i) => !slotHuman[i]).filter(Boolean).length;
  if (nAi > 0) {
    const j = archetypes.findIndex(a => a.pragmatism >= 0.55);
    if (j > 0) { const t = archetypes[0]; archetypes[0] = archetypes[j]; archetypes[j] = t; }
  }
  let ai = 0;
  for (let i = 0; i < n; i++) {
    const p = window.PALETTE[i];
    const isHuman = !!slotHuman[i];
    const c = {
      idx: i, isHuman, color: p.hex, colorKey: p.key,
      name: isHuman ? '' : archetypes[ai].name,
      party: isHuman ? '' : archetypes[ai].tag,
      bio: isHuman ? '' : archetypes[ai].bio,
      archetype: isHuman ? null : archetypes[ai],
      stances: [0,0,0,0,0],
      money: 0, raised: 0,
      counters: {}, dossier: {}, pivots: [], endorsements: [],
      lockedTopics: {}, corp: null, analysis: null, roundLog: [],
    };
    if (!isHuman) { c.analysis = window.analyzeBio(c.name, c.bio); ai++; }
    candidates.push(c);
  }

  G = {
    seed, rng, cfg: { ...cfg }, topics, candidates,
    electorate: window.buildElectorate(rng, topics, n),
    round: 1, totalRounds: cfg.rounds, finalPush: false,
    log: [], polls: [], events: [],
    celebOffers: rng.shuffle(window.CELEBRITIES).slice(0, 4).map(c => ({ ...c, used: false })),
    corpOffers: [],
    humanQueue: [], turnPtr: 0, field: null, truth: null, internal: null,
  };
  genericPlatform = null; consultantModel = {};
  if (cfg.funding === 'corp') G.corpOffers = window.Engine.makeCorpOffers(G, rng, 4);

  // AI platforms
  for (const c of G.candidates) if (!c.isHuman) {
    c.stances = window.Engine.aiChooseStances(G, c, rng);
    c.auth = window.authenticity(c.analysis, G.topics, c.stances);
  }

  bioQueue = G.candidates.filter(c => c.isHuman).map(c => c.idx);
  bioPtr = 0;
  nextBio();
}

/* ---------------- bio flow ---------------- */
let bioQueue = [], bioPtr = 0, chosenColor = null;

const RANDOM_BIOS = [
  ['Jo Rivera','The Front Porch Party','I spent 14 years as an ER nurse in a hospital that lost its funding twice. I raised two kids on shift work and food stamps. I have watched what happens when the people who make the rules have never once needed them to work. I am not a career politician and I am not pretending to be.'],
  ['Web Calloway','Steady Hands','Thirty-one years running a family cattle operation before I ever ran for anything. Two terms as county commissioner, then eight in the state house. I balanced six budgets and never once shut the government down to make a point. I am running because somebody has to be boring on purpose.'],
  ['Simi Adeyemi','Tomorrow Together','I came to this country at nine with one suitcase and a grandmother who cleaned offices at night. I built a software company, sold it, and spent the last six years organizing tenants who were being priced out of the city I grew up in. Everything I have, this country gave me. I would like to return the favour.'],
  ['Hank Dorsey','America Unbent','TWENTY-TWO YEARS in the Marine Corps. Two deployments. I came home and found a country that had forgotten how to make anything. Washington is broken, both parties are the same party, and I am not here to make friends! I am here to put this nation FIRST.'],
  ['Dr. Elena Marsh','The Evidence Party','I ran the state health department through the worst four years it ever had. I have a doctorate in epidemiology and a habit of answering questions with numbers, which my consultants tell me is a serious liability. I would rather be right and unpopular than the other way around.'],
  ['Bobby Vance','Union Made','I welded for eleven years and ran the local for nine more. I have shut down a port and I have sat across a table from people who own more than my whole county. Nobody in this race has met a payroll from the other side of it. I have.'],
];

function nextBio() {
  if (bioPtr >= bioQueue.length) { startStances(); return; }
  const ci = bioQueue[bioPtr];
  const c = G.candidates[ci];
  chosenColor = c.colorKey;
  $('#bio-kicker').textContent = bioQueue.length > 1 ? `candidate ${bioPtr + 1} of ${bioQueue.length}` : 'step two';
  $('#in-name').value = c.name || '';
  $('#in-party').value = c.party || '';
  $('#in-bio').value = c.bio || '';
  updateWordCount();
  renderSwatches();
  show('s-bio');
}

function renderSwatches() {
  const w = $('#swatches'); w.innerHTML = '';
  const taken = new Set(G.candidates.filter(c => c.idx !== bioQueue[bioPtr]).map(c => c.colorKey));
  window.PALETTE.forEach(p => {
    const s = el('div', 'sw' + (chosenColor === p.key ? ' on' : '') + (taken.has(p.key) ? ' taken' : ''));
    s.style.background = p.hex;
    s.title = p.name;
    if (!taken.has(p.key)) s.onclick = () => { chosenColor = p.key; renderSwatches(); };
    w.appendChild(s);
  });
}

function updateWordCount() {
  const v = $('#in-bio').value.trim();
  $('#bio-count').textContent = v ? v.split(/\s+/).length : 0;
}
$('#in-bio').addEventListener('input', updateWordCount);

$('#btn-bio-random').onclick = () => {
  const r = RANDOM_BIOS[Math.floor(Math.random() * RANDOM_BIOS.length)];
  $('#in-name').value = r[0]; $('#in-party').value = r[1]; $('#in-bio').value = r[2];
  updateWordCount();
};

$('#btn-bio-go').onclick = () => {
  const ci = bioQueue[bioPtr];
  const c = G.candidates[ci];
  const name = $('#in-name').value.trim() || 'Candidate ' + (ci + 1);
  c.name = name;
  c.party = $('#in-party').value.trim();
  c.bio = $('#in-bio').value.trim();
  const p = window.PALETTE.find(x => x.key === chosenColor) || window.PALETTE[ci];
  c.colorKey = p.key; c.color = p.hex;
  // Keep every candidate on a distinct colour: whoever else holds this one gets moved.
  const claimed = new Set([p.key]);
  for (const o of G.candidates) {
    if (o.idx === ci) continue;
    if (claimed.has(o.colorKey)) {
      const free = window.PALETTE.find(q => !claimed.has(q.key));
      if (free) { o.colorKey = free.key; o.color = free.hex; }
    }
    claimed.add(o.colorKey);
  }
  c.analysis = window.analyzeBio(c.name, c.bio);
  renderAnalysis(c);
  show('s-analysis');
};

function renderAnalysis(c) {
  const a = c.analysis;
  $('#an-name').textContent = c.name + (c.party ? ' — ' + c.party : '');
  const TL = { charisma: 'Charisma', trust: 'Trust', relatability: 'Relatability', gravitas: 'Gravitas', establishment: 'Establishment' };
  let h = `<div class="an-verdict">${esc(a.verdict)}</div><div class="traits">`;
  for (const k in TL) {
    h += `<div class="trait"><span class="tn">${TL[k]}</span>
      <span class="tb"><i class="tf" style="width:${a.traits[k]}%"></i></span>
      <span class="tv">${a.traits[k]}</span></div>`;
  }
  h += `</div><div class="sec-title" style="margin-top:0">Who starts out willing to listen</div><div class="affin">`;
  const rows = [];
  for (const g of window.AGE_GROUPS) rows.push([g.label, a.age[g.id]]);
  for (const g of window.GENDERS) rows.push([g.label, a.gen[g.id]]);
  for (const [lab, v] of rows) {
    const cls = v > 0.12 ? 'pos' : v < -0.12 ? 'neg' : 'neu';
    const mag = v > 0.45 ? '▲▲' : v > 0.12 ? '▲' : v < -0.45 ? '▼▼' : v < -0.12 ? '▼' : '— — —'.slice(0, 3);
    h += `<div class="aff ${cls}"><div class="an">${lab}</div><div class="av">${mag}</div></div>`;
  }
  h += `</div><div class="sec-title">What the read turned up</div><ul class="notes">`;
  for (const n of a.notes) h += `<li>${esc(n)}</li>`;
  h += `</ul><div class="kv"><span class="k">Campaign effectiveness multiplier</span><span class="v">×${a.effectiveness.toFixed(2)}</span></div>
        <div class="kv"><span class="k">Chance any given move blows up in your face</span><span class="v">${(a.gaffeRisk * 100).toFixed(0)}%</span></div>`;
  $('#an-body').innerHTML = h;
}

$('#btn-an-redo').onclick = () => show('s-bio');
$('#btn-an-go').onclick = () => { bioPtr++; nextBio(); };

/* ---------------- stances ---------------- */
let stanceQueue = [], stancePtr = 0, draftStances = null;

function startStances() {
  // Every biography is now on the record: the country forms its first impressions.
  if (!G.seeded) { window.seedFoundationalAppeal(G, G.rng); G.seeded = true; }
  stanceQueue = G.candidates.filter(c => c.isHuman).map(c => c.idx);
  stancePtr = 0;
  nextStance();
}
function nextStance() {
  if (stancePtr >= stanceQueue.length) { beginCampaign(); return; }
  const c = G.candidates[stanceQueue[stancePtr]];
  draftStances = c.stances.slice();
  $('#stance-kicker').textContent = stanceQueue.length > 1 ? `${c.name} — platform` : 'step three';
  renderStanceList();
  show('s-stance');
}

function renderStanceList() {
  const w = $('#stance-list'); w.innerHTML = '';
  const proj = el('div', 'proj'); proj.id = 'stance-proj'; w.appendChild(proj);
  G.topics.forEach((t, i) => {
    const card = el('div', 'topic');
    let h = `<div class="topic-head"><h3>${esc(t.name)}</h3><span class="hook">${esc(t.hook)}</span></div>
      <div class="scale-ends"><span>−3 &nbsp;${esc(t.neg)}</span><span class="r">${esc(t.pos)}&nbsp; +3</span></div>
      <div class="scale" data-t="${i}">`;
    for (let v = -3; v <= 3; v++) h += `<button data-v="${v}" class="${draftStances[i] === v ? 'on' : ''}">${v > 0 ? '+' + v : v}</button>`;
    h += `</div><div class="stance-read">${esc(window.stanceLabel(t, draftStances[i]))}</div>`;
    card.innerHTML = h;
    card.querySelectorAll('.scale button').forEach(b => {
      b.onclick = () => { draftStances[i] = +b.dataset.v; renderStanceList(); };
    });
    w.appendChild(card);
  });
  renderProjection();
}

/* A rival platform stand-in for humans who have not announced yet. */
let genericPlatform = null, consultantModel = {};

/* Consultants do not have the electorate; they have a survey of it.
   Two independent surveys: one they optimise against, one they report from,
   so a recommendation cannot quietly overfit the number you are shown. */
function consultantElectorate(which) {
  const key = which || 'report';
  if (consultantModel[key]) return consultantModel[key];
  const sigma = key === 'search' ? 0.62 : 0.34;
  const r = window.makeRng((G.seed ^ (key === 'search' ? 0x5bf03635 : 0x1d872b41)) >>> 0);
  const out = {};
  for (const ab in G.electorate) {
    const S = G.electorate[ab];
    out[ab] = { ab, totalW: S.totalW, voters: S.voters.map(v => {
      const vec = new Float64Array(5);
      for (let i = 0; i < 5; i++) vec[i] = window.clamp(v.vec[i] + r.gauss(0, sigma), -3, 3);
      return { age: v.age, gender: v.gender, vec, bias: v.bias, w: v.w };
    }) };
  }
  consultantModel[key] = out;
  return out;
}
function genericRival() {
  if (genericPlatform) return genericPlatform;
  genericPlatform = G.topics.map((t, i) => {
    let avg = 0, tot = 0;
    for (const ab in G.electorate)
      for (const v of G.electorate[ab].voters) { avg += v.vec[i] * v.w; tot += v.w; }
    avg /= tot;
    return Math.max(-3, Math.min(3, Math.round(avg * 1.6) || (avg >= 0 ? 1 : -1)));
  });
  return genericPlatform;
}

/* Project the race using the draft platform, standing in for anyone undeclared. */
function projectWith(stances, electorate) {
  const me = G.candidates[stanceQueue[stancePtr]];
  const cands = G.candidates.map(c => ({
    stances: c.idx === me.idx ? stances
           : (c.isHuman && !c.committed) ? genericRival()
           : c.stances,
  }));
  return window.tallyElection({ candidates: cands, electorate: electorate || G.electorate });
}

function renderProjection() {
  const host = $('#stance-proj');
  if (!host) return;
  const me = G.candidates[stanceQueue[stancePtr]];
  const t = projectWith(draftStances, consultantElectorate());
  const undeclared = G.candidates.some(c => c.isHuman && !c.committed && c.idx !== me.idx);
  const order = G.candidates.map((c, i) => ({ c, i })).sort((a, b) => t.ev[b.i] - t.ev[a.i]);
  let h = `<div class="proj-head"><span class="t">your consultants' model · if the vote were held today</span>
           <span class="n">${t.ev[me.idx]} electoral votes · ${(t.shares[me.idx] * 100).toFixed(1)}%</span></div>
           <div class="proj-rows">`;
  for (const o of order) {
    h += `<div class="proj-row"><span class="dot" style="background:${o.c.color}"></span>
      <span class="nm">${o.i === me.idx ? '<b>You</b>' : esc(o.c.name)}</span>
      <span class="num">${t.ev[o.i]} EV · ${(t.shares[o.i] * 100).toFixed(1)}%</span>
      <span class="bar"><i style="display:block;height:100%;width:${(t.ev[o.i] / 538 * 100).toFixed(1)}%;background:${o.c.color}"></i></span></div>`;
  }
  const auth = window.authenticity(me.analysis, G.topics, draftStances);
  const authCls = auth.score > 0.62 ? 'var(--good)' : auth.score > 0.38 ? 'var(--accent)' : 'var(--bad)';
  h += `</div><div class="proj-warn" style="color:${authCls}">
        <b style="color:inherit">Authenticity ${Math.round(auth.score * 100)}%</b> — ${esc(auth.label)}
        ${auth.score < 0.99 ? ' Everything your campaign does lands ' + Math.round((1 - auth.score) * 30) + '% weaker.' : ''}</div>`;
  const shrugs = draftStances.filter(v => v === 0).length;
  if (shrugs >= 3) {
    h += `<div class="proj-warn" style="color:var(--fg3)">You are declining to answer ${shrugs} of the five questions.
          A blank platform only looks good while your rivals look worse than nothing — and they can move.</div>`;
  }
  if (t.shares[me.idx] < 0.72 / G.candidates.length) {
    h += `<div class="proj-warn">You are nobody's first choice yet. Voters compare <i>direction</i>, not distance —
          a platform of blank shrugs points nowhere, and pointing the wrong way is worse. Commit to something.</div>`;
  } else if (undeclared) {
    h += `<div class="proj-warn" style="color:var(--fg3)">Rivals who have not announced yet are modelled as
          middle-of-the-pack, and your consultants are working from a survey, not from the country. A sketch.</div>`;
  } else {
    h += `<div class="proj-warn" style="color:var(--fg3)">Your consultants are working from a survey, not from the
          country itself. The real electorate is a few points off this in ways nobody can see yet.</div>`;
  }
  host.innerHTML = h;
}

$('#btn-stance-auto').onclick = (e) => {
  const btn = e.currentTarget;
  btn.disabled = true; btn.textContent = 'Modelling…';
  setTimeout(() => {
    // Coordinate ascent: try all seven positions on each issue, twice around.
    const me = G.candidates[stanceQueue[stancePtr]];
    const model = consultantElectorate('search');
    let best = draftStances.slice();
    const scoreOf = s => {
      const t = projectWith(s, model);
      const a = window.authenticity(me.analysis, G.topics, s);
      return t.ev[me.idx] * 1000 + t.votes[me.idx] / 1e5 - (1 - a.score) * 140000;
    };
    let bestScore = scoreOf(best);
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < 5; i++) {
        for (let v = -3; v <= 3; v++) {
          if (v === best[i]) continue;
          const cand = best.slice(); cand[i] = v;
          const sc = scoreOf(cand);
          if (sc > bestScore) { bestScore = sc; best = cand; }
        }
      }
    }
    draftStances = best;
    renderStanceList();
    btn.disabled = false; btn.textContent = 'Let the consultants pick';
  }, 30);
};

$('#btn-stance-go').onclick = () => {
  const c = G.candidates[stanceQueue[stancePtr]];
  c.stances = draftStances.slice();
  c.committed = true;
  c.auth = window.authenticity(c.analysis, G.topics, c.stances);
  stancePtr++;
  nextStance();
};

/* ---------------- campaign loop ---------------- */
function beginCampaign() {
  // A platform nobody believes starts you in a hole with everyone.
  for (const c of G.candidates) {
    if (!c.auth) c.auth = window.authenticity(c.analysis, G.topics, c.stances);
    if (c.auth.score < 1) window.applyBias(G, { cand: c.idx, magnitude: -0.13 * (1 - c.auth.score) });
  }
  G.humanQueue = G.candidates.filter(c => c.isHuman).map(c => c.idx);
  G.turnPtr = 0;
  startRound();
}

function grantMoney() {
  const rng = G.rng;
  for (const c of G.candidates) {
    let amt = 0;
    if (G.cfg.funding === 'flat') amt = 110;
    else if (G.cfg.funding === 'random') amt = Math.round(rng.range(68, 178));
    else amt = Math.round(rng.range(52, 108));
    c.money += amt;
    c.raised += amt;
    c.lastGrant = amt;
  }
}

function startRound() {
  if (!G.finalPush) grantMoney();
  G.field = noiseField(G.rng, G.candidates.length, 0.030);
  G.turnPtr = 0;
  for (const c of G.candidates) c.roundLog = [];
  nextTurn();
}

function nextTurn() {
  if (G.turnPtr >= G.humanQueue.length) { resolveAIAndEndRound(); return; }
  const ci = G.humanQueue[G.turnPtr];
  ui.tab = 'actions'; ui.draft = null; ui.selectedState = null;
  if (G.humanQueue.length > 1) {
    $('#hand-name').textContent = G.candidates[ci].name;
    $('#hand-sub').textContent = 'Your turn. Round ' + roundLabel() + '. Nobody else should be looking at this screen.';
    show('s-hand');
    $('#btn-hand-go').onclick = () => { openCampaign(ci); };
  } else {
    openCampaign(ci);
  }
}

function roundLabel() { return G.finalPush ? 'Final push' : G.round + ' of ' + G.totalRounds; }

function openCampaign(ci) {
  G.activeCand = ci;
  refreshTruth();
  window.UI.buildMap($('#usmap'), {});
  window.UI.wireMap($('#usmap'), $('#tip'), () => G.internal, () => G.candidates, { onClick: onMapClick });
  renderCampaign();
  show('s-campaign');
}

function refreshTruth() {
  G.truth = window.tallyElection(G);
  G.internal = applyField(G.truth, G.field, G.candidates.length);
}

function onMapClick(ab) {
  if (ui.draft && ui.draft.scope === 'state') {
    const i = ui.draft.states.indexOf(ab);
    if (i >= 0) ui.draft.states.splice(i, 1);
    else if (ui.draft.states.length < 3) ui.draft.states.push(ab);
    renderSide(); paint();
    return;
  }
  ui.selectedState = ab; ui.tab = 'state';
  renderSide(); paint();
}

function paint() {
  const targets = ui.draft && ui.draft.scope === 'state' ? new Set(ui.draft.states) : null;
  window.UI.paintMap($('#usmap'), G.internal, G.candidates, { selected: ui.selectedState, targets });
  window.UI.renderEvBar($('#evbar'), G.internal, G.candidates);
  window.UI.renderLegend($('#maplegend'), G.candidates);
}

function renderCampaign() {
  const me = G.candidates[G.activeCand];
  $('#pill-round').textContent = G.finalPush ? 'FINAL PUSH' : 'Round ' + G.round + ' / ' + G.totalRounds;
  $('#pill-money').textContent = fmtMoney(me.money);
  $('#map-kicker').textContent = 'internal tracking · ' + (G.finalPush ? 'final push' : 'round ' + G.round);
  $('#map-title').textContent = 'Where the race stands';
  renderTopStandings();
  renderSideTabs();
  renderSide();
  paint();
}

function renderTopStandings() {
  const w = $('#top-standings'); w.innerHTML = '';
  const order = G.candidates.map((c, i) => ({ c, ev: G.internal.ev[i] })).sort((a, b) => b.ev - a.ev);
  order.forEach((o, rank) => {
    const chip = el('div', 'cchip' + (o.c.idx === G.activeCand ? ' me' : '') + (rank === 0 ? ' lead' : ''));
    chip.innerHTML = `<span class="dot" style="background:${o.c.color}"></span>
      <span class="nm">${esc(o.c.name)}</span><span class="ev">${o.ev}</span>`;
    w.appendChild(chip);
  });
}

const TABS = [['actions','Campaign'],['board','Standings'],['state','State'],['log','Log']];
function renderSideTabs() {
  const w = $('#side-tabs'); w.innerHTML = '';
  TABS.forEach(([id, lab]) => {
    const b = el('button', ui.tab === id ? 'on' : '', lab);
    b.onclick = () => { ui.tab = id; if (id !== 'actions') ui.draft = null; renderSide(); paint(); };
    w.appendChild(b);
  });
}

function renderSide() {
  renderSideTabs();
  const body = $('#side-body');
  body.innerHTML = '';
  if (ui.tab === 'actions') renderActions(body);
  else if (ui.tab === 'board') renderBoard(body);
  else if (ui.tab === 'state') renderStatePanel(body);
  else renderLog(body);
}

/* ---------------- actions panel ---------------- */
function renderActions(body) {
  const me = G.candidates[G.activeCand];

  if (ui.draft) { renderDrawer(body, me); return; }

  const head = el('div');
  head.innerHTML = `<div class="kv"><span class="k">War chest</span><span class="v" style="color:var(--accent)">${fmtMoney(me.money)}</span></div>
    <div class="kv"><span class="k">Raised this cycle</span><span class="v">${fmtMoney(me.raised)}</span></div>`;
  body.appendChild(head);

  body.appendChild(el('div', 'sec-title', 'Buy some attention'));
  for (const k in window.ACTIONS) {
    const A = window.ACTIONS[k];
    const cheapest = A.scope === 'state' ? A.costState : Math.min(A.costNational, A.costState);
    const dis = me.money < cheapest;
    const card = el('div', 'act' + (dis ? ' dis' : ''));
    card.innerHTML = `<span class="ic">${A.icon}</span><div class="body">
      <div class="t"><span>${A.label}</span><span class="c">from ${fmtMoney(cheapest)}</span></div>
      <div class="d">${A.blurb}</div></div>`;
    if (!dis) card.onclick = () => { openDraft(k); };
    body.appendChild(card);
  }

  body.appendChild(el('div', 'sec-title', 'Everything else'));
  const specials = ['pivot','celeb','vip','oppo'];
  if (G.cfg.funding === 'corp' && !me.corp) specials.push('corp');
  for (const k of specials) {
    const S = window.SPECIALS[k];
    const dis = me.money < S.cost;
    const card = el('div', 'act' + (dis ? ' dis' : ''));
    card.innerHTML = `<span class="ic">${S.icon}</span><div class="body">
      <div class="t"><span>${S.label}</span><span class="c">${S.cost ? fmtMoney(S.cost) : 'free'}</span></div>
      <div class="d">${S.blurb}</div></div>`;
    if (!dis) card.onclick = () => { openDraft(k); };
    body.appendChild(card);
  }

  if (me.roundLog.length) {
    body.appendChild(el('div', 'sec-title', 'This round'));
    for (let i = me.roundLog.length - 1; i >= 0; i--) body.appendChild(resultCard(me.roundLog[i]));
  }
}

function resultCard(r) {
  const c = el('div', 'res t-' + r.tier);
  c.innerHTML = `<div class="rt"><span>${esc(r.title)}</span><span class="tag">${r.tier}</span></div>
    <div class="rs">${esc(r.sub || '')}${r.cost ? ' · ' + fmtMoney(r.cost) : ''}</div>
    <div class="rx">${esc(r.text)}</div>`;
  return c;
}

function openDraft(actionId) {
  const A = window.ACTIONS[actionId];
  ui.draft = {
    id: actionId,
    scope: A ? (A.scope === 'state' ? 'state' : 'national') : null,
    states: [], ageFilter: null, genFilter: null, attack: null, copies: 1,
    topic: 0, newStance: 0, target: null,
  };
  if (actionId === 'pivot') {
    const me = G.candidates[G.activeCand];
    ui.draft.newStance = me.stances[0];
  }
  renderSide(); paint();
}

function renderDrawer(body, me) {
  const d = ui.draft;
  const A = window.ACTIONS[d.id], S = window.SPECIALS[d.id];
  const drawer = el('div', 'drawer');
  const back = el('button', 'btn small ghost', '← back');
  back.style.marginBottom = '12px';
  back.onclick = () => { ui.draft = null; renderSide(); paint(); };
  body.appendChild(back);

  drawer.innerHTML = `<h4>${(A || S).icon} ${(A || S).label}</h4><div class="db">${(A || S).blurb}</div>`;
  body.appendChild(drawer);

  const add = (labelText, node) => {
    const r = el('div', 'drow');
    if (labelText) r.appendChild(el('div', 'lbl', labelText));
    r.appendChild(node);
    drawer.appendChild(r);
  };
  const chipRow = (opts, current, onPick) => {
    const w = el('div', 'chips');
    opts.forEach(([val, lab]) => {
      const c = el('div', 'chip' + (current === val ? ' on' : ''), lab);
      c.onclick = () => { onPick(val); renderSide(); paint(); };
      w.appendChild(c);
    });
    return w;
  };

  /* ---- media buys ---- */
  if (A) {
    if (A.scope === 'both') {
      add('Scope', chipRow([['national', 'Nationwide'], ['state', 'Targeted states']], d.scope, v => { d.scope = v; }));
    }
    if (d.scope === 'state') {
      const w = el('div');
      if (d.states.length) {
        const chips = el('div', 'chips');
        d.states.forEach(ab => {
          const c = el('div', 'chip rm', window.STATES[ab].name + ' ×');
          c.onclick = () => { d.states = d.states.filter(x => x !== ab); renderSide(); paint(); };
          chips.appendChild(c);
        });
        w.appendChild(chips);
      }
      w.appendChild(el('div', 'pickhint', d.states.length >= 3
        ? 'Three states is the limit for one buy.'
        : 'Click states on the map to add them (up to three).'));
      add('Where', w);
    }
    add('Audience', chipRow(
      [[null, 'Everyone']].concat(window.AGE_GROUPS.map(g => ['a:' + g.id, g.label])).concat(window.GENDERS.map(g => ['g:' + g.id, g.label])),
      d.ageFilter ? 'a:' + d.ageFilter : d.genFilter ? 'g:' + d.genFilter : null,
      v => {
        d.ageFilter = null; d.genFilter = null;
        if (v && v.startsWith('a:')) d.ageFilter = v.slice(2);
        if (v && v.startsWith('g:')) d.genFilter = v.slice(2);
      }));
    const mult = A.ageMult;
    drawer.appendChild(el('div', 'pickhint',
      `Reach by age — young ×${mult.young.toFixed(2)}, middle ×${mult.middle.toFixed(2)}, older ×${mult.old.toFixed(2)}. ` +
      `Targeting a slice doubles the effect on them and nearly erases it everywhere else.`));

    if (A.kind === 'ad') {
      const opts = [[null, 'Promote yourself']].concat(
        G.candidates.filter(c => c.idx !== me.idx).map(c => [c.idx, 'Attack ' + c.name.split(' ').slice(-1)[0]]));
      add('Message', chipRow(opts, d.attack, v => { d.attack = v; }));
      if (d.attack != null) {
        const dos = me.dossier[d.attack] || 0;
        drawer.appendChild(el('div', 'pickhint',
          `Attacks push voters away from ${esc(G.candidates[d.attack].name)} and splash a little back on you. ` +
          (dos ? `Your dossier (level ${dos}) makes this land ${Math.round(dos * 40)}% harder.` : `Opposition research would make it land harder.`)));
      }
    }
    if (d.id === 'rally') {
      add('Surrogates', chipRow([[1, 'Just you'], [2, 'You + a running mate'], [3, 'A three-way blitz']], d.copies, v => { d.copies = v; }));
    }

    const stateCount = d.scope === 'state' ? d.states.length : 0;
    const cost = window.Engine.costOf(d.id, d.scope, stateCount, d.copies);
    const ok = (d.scope !== 'state' || d.states.length > 0) && cost <= me.money && cost > 0;
    const line = el('div', 'costline');
    line.innerHTML = `<span class="cc ${cost > me.money ? 'bad' : ''}">${fmtMoney(cost)}</span>`;
    const go = el('button', 'btn' + (ok ? ' big' : ''), 'Run it');
    go.disabled = !ok;
    go.onclick = () => {
      const res = window.Engine.runMedia(G, me.idx, {
        actionId: d.id, scope: d.scope, states: d.states.slice(),
        ageFilter: d.ageFilter, genFilter: d.genFilter, attack: d.attack, copies: d.copies,
      });
      finishAction(res);
    };
    line.appendChild(go);
    drawer.appendChild(line);
    return;
  }

  /* ---- specials ---- */
  if (d.id === 'pivot') {
    const opts = G.topics.map((t, i) => [i, t.name]);
    add('Which issue', chipRow(opts, d.topic, v => { d.topic = v; d.newStance = me.stances[v]; }));
    const t = G.topics[d.topic];
    const locked = !!me.lockedTopics[d.topic];
    const sc = el('div');
    sc.innerHTML = `<div class="scale-ends"><span>−3 ${esc(t.neg)}</span><span class="r">${esc(t.pos)} +3</span></div>`;
    const row = el('div', 'scale');
    for (let v = -3; v <= 3; v++) {
      const b = el('button', d.newStance === v ? 'on' : '', v > 0 ? '+' + v : String(v));
      b.onclick = () => { d.newStance = v; renderSide(); };
      row.appendChild(b);
    }
    sc.appendChild(row);
    sc.appendChild(el('div', 'stance-read', window.stanceLabel(t, d.newStance)));
    sc.appendChild(el('div', 'pickhint', 'Currently: ' + window.stanceLabel(t, me.stances[d.topic]) +
      (locked ? ' — locked by your backers.' : '')));
    add('New position', sc);
    const line = el('div', 'costline');
    line.innerHTML = `<span class="cc">${fmtMoney(window.SPECIALS.pivot.cost)}</span>`;
    const go = el('button', 'btn big', 'Announce the change');
    go.disabled = locked || d.newStance === me.stances[d.topic];
    go.onclick = () => finishAction(window.Engine.runPivot(G, me.idx, d.topic, d.newStance));
    line.appendChild(go); drawer.appendChild(line);
    return;
  }

  if (d.id === 'celeb') {
    const avail = G.celebOffers.map((c, i) => ({ c, i })).filter(o => !o.c.used);
    if (!avail.length) { drawer.appendChild(el('div', 'emptyish', 'Everyone famous is already spoken for.')); return; }
    for (const o of avail) {
      const card = el('div', 'act');
      const top = Object.entries(o.c.pull).sort((a, b) => b[1] - a[1])[0][0];
      card.innerHTML = `<span class="ic">⭐</span><div class="body">
        <div class="t"><span>${esc(o.c.name)}</span><span class="c">${fmtMoney(window.SPECIALS.celeb.cost)}</span></div>
        <div class="d">${esc(o.c.field)} · strongest with <b>${top}</b> voters · risk ${(o.c.risk * 100).toFixed(0)}%</div></div>`;
      card.onclick = () => finishAction(window.Engine.runCeleb(G, me.idx, o.i));
      drawer.appendChild(card);
    }
    return;
  }

  if (d.id === 'vip') {
    drawer.appendChild(el('div', 'pickhint',
      `A night on the donor circuit costs ${fmtMoney(window.SPECIALS.vip.cost)} and typically brings back a good deal more — ` +
      `less each time you go back to the same well. Younger voters keep score.`));
    const line = el('div', 'costline');
    line.innerHTML = `<span class="cc">${fmtMoney(window.SPECIALS.vip.cost)}</span>`;
    const go = el('button', 'btn big', 'Work the room');
    go.onclick = () => finishAction(window.Engine.runVip(G, me.idx));
    line.appendChild(go); drawer.appendChild(line);
    return;
  }

  if (d.id === 'oppo') {
    const opts = G.candidates.filter(c => c.idx !== me.idx).map(c => [c.idx, c.name]);
    add('Target', chipRow(opts, d.target, v => { d.target = v; }));
    const line = el('div', 'costline');
    line.innerHTML = `<span class="cc">${fmtMoney(window.SPECIALS.oppo.cost)}</span>`;
    const go = el('button', 'btn big', 'Start digging');
    go.disabled = d.target == null;
    go.onclick = () => finishAction(window.Engine.runOppo(G, me.idx, d.target));
    line.appendChild(go); drawer.appendChild(line);
    return;
  }

  if (d.id === 'corp') {
    const avail = G.corpOffers.map((c, i) => ({ c, i })).filter(o => !o.c.taken);
    if (!avail.length) { drawer.appendChild(el('div', 'emptyish', 'Nobody is offering. The industries have made their choices.')); return; }
    for (const o of avail) {
      const t = G.topics[o.c.topicIndex];
      const card = el('div', 'act');
      card.innerHTML = `<span class="ic">🏛️</span><div class="body">
        <div class="t"><span>${esc(o.c.name)}</span><span class="c">+${fmtMoney(o.c.money)}</span></div>
        <div class="d">${esc(o.c.industry)} · they want your position on <b>${esc(t.name)}</b> set to
        “${esc(window.stanceLabel(t, o.c.want))}” — permanently.</div></div>`;
      card.onclick = () => {
        modal(`<h3>${esc(o.c.name)}</h3>
          <p>They will wire <b>${fmtMoney(o.c.money)}</b> today. In exchange your position on <b>${esc(t.name)}</b>
             becomes “${esc(window.stanceLabel(t, o.c.want))}” and locks. You will not be able to move it again.</p>
          <p>If you win with their money behind you, the country finds out what they bought.</p>
          <div class="setup-foot"><button class="btn ghost" id="m-no">Walk away</button>
          <button class="btn big" id="m-yes">Take the cheque</button></div>`);
        $('#m-no').onclick = closeModal;
        $('#m-yes').onclick = () => { closeModal(); finishAction(window.Engine.acceptCorp(G, me.idx, o.i)); };
      };
      drawer.appendChild(card);
    }
  }
}

function finishAction(res) {
  if (!res.ok) {
    modal(`<h3>Can't do that</h3><p>${esc(res.reason)}</p>
      <div class="setup-foot"><button class="btn" id="m-ok">Understood</button></div>`);
    $('#m-ok').onclick = closeModal;
    return;
  }
  const me = G.candidates[G.activeCand];
  res.round = G.round; res.cand = me.idx; res.finalPush = G.finalPush;
  me.roundLog.push(res);
  G.log.push(res);
  ui.draft = null;
  refreshTruth();
  renderCampaign();
}

/* ---------------- standings panel ---------------- */
function renderBoard(body) {
  const P = G.internal;
  body.appendChild(el('div', 'sec-title', 'Internal tracking · electoral votes'));
  const order = G.candidates.map((c, i) => ({ c, ev: P.ev[i], sh: P.shares[i] })).sort((a, b) => b.ev - a.ev);
  for (const o of order) {
    const row = el('div', 'board-row');
    row.innerHTML = `<span class="dot" style="background:${o.c.color}"></span>
      <div><div class="nm">${esc(o.c.name)}${o.c.idx === G.activeCand ? ' <span style="color:var(--accent)">(you)</span>' : ''}</div>
        <div class="sb">${pct(o.sh)} of the popular vote${o.c.corp ? ' · backed by ' + esc(o.c.corp.name) : ''}${o.c.idx === G.activeCand && o.c.auth ? ' · authenticity ' + Math.round(o.c.auth.score * 100) + '%' : ''}</div>
        <div class="barline"><i style="width:${(o.ev / 538 * 100).toFixed(1)}%;background:${o.c.color}"></i></div></div>
      <div class="num">${o.ev}<small>${o.ev >= 270 ? 'WINNING' : (270 - o.ev) + ' short'}</small></div>`;
    body.appendChild(row);
  }

  body.appendChild(el('div', 'sec-title', 'Who is voting for whom'));
  const groups = window.AGE_GROUPS.map(g => [g.id, g.label]).concat(window.GENDERS.map(g => [g.id, g.label]));
  const grid = el('div', 'demo-grid');
  for (const [id, lab] of groups) {
    grid.appendChild(el('div', 'dl', lab));
    const bar = el('div', 'stackbar');
    const tot = P.demoTotals[id] || 1;
    G.candidates.forEach((c, i) => {
      const s = P.demo[i][id] / tot;
      const seg = el('i'); seg.style.width = (s * 100) + '%'; seg.style.background = c.color;
      seg.title = `${c.name}: ${pct(s)} of ${lab}`;
      bar.appendChild(seg);
    });
    grid.appendChild(bar);
  }
  body.appendChild(grid);
  body.appendChild(el('div', 'pickhint',
    'Share of actual ballots, not headcount — older voters turn out more, so their bars carry more weight than their numbers.'));

  body.appendChild(el('div', 'sec-title', 'Closest states'));
  const close = Object.values(P.states).sort((a, b) => a.margin - b.margin).slice(0, 8);
  for (const s of close) {
    const row = el('div', 'kv');
    row.innerHTML = `<span class="k">${esc(window.STATES[s.ab].name)} <span style="color:var(--fg3)">· ${s.ev} EV</span></span>
      <span class="v" style="color:${G.candidates[s.winner].color}">
      ${esc(G.candidates[s.winner].name.split(' ').slice(-1)[0])} +${(s.margin * 100).toFixed(1)}</span>`;
    row.style.cursor = 'pointer';
    row.onclick = () => { ui.selectedState = s.ab; ui.tab = 'state'; renderSide(); paint(); };
    body.appendChild(row);
  }

  body.appendChild(el('div', 'sec-title', 'Platforms'));
  G.topics.forEach((t, i) => {
    const row = el('div', 'kv');
    const spread = G.candidates.map(c =>
      `<span title="${esc(c.name)}: ${esc(window.stanceLabel(t, c.stances[i]))}" style="color:${c.color};font-weight:700">${c.stances[i] > 0 ? '+' : ''}${c.stances[i]}</span>`).join(' ');
    row.innerHTML = `<span class="k">${esc(t.name)}</span><span class="v">${spread}</span>`;
    body.appendChild(row);
  });
}

/* ---------------- state panel ---------------- */
function renderStatePanel(body) {
  const ab = ui.selectedState;
  if (!ab) { body.appendChild(el('div', 'emptyish', 'Click a state on the map.')); return; }
  const st = window.STATES[ab], S = G.internal.states[ab], E = G.electorate[ab];
  body.appendChild(el('div', 'sec-title', 'State briefing'));
  const h = el('div');
  h.innerHTML = `<h3 style="margin-bottom:2px">${esc(st.name)}</h3>
    <div class="pickhint" style="margin-bottom:12px">${st.ev} electoral votes · ${window.UI.bandName(S.margin)} ·
      ${(st.pop).toFixed(1)}M adults</div>`;
  body.appendChild(h);

  const order = S.shares.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  for (const o of order) {
    const row = el('div', 'board-row');
    row.innerHTML = `<span class="dot" style="background:${G.candidates[o.i].color}"></span>
      <div><div class="nm">${esc(G.candidates[o.i].name)}</div>
      <div class="barline"><i style="width:${(o.v * 100).toFixed(1)}%;background:${G.candidates[o.i].color}"></i></div></div>
      <div class="num" style="font-size:19px">${(o.v * 100).toFixed(1)}<small>percent</small></div>`;
    body.appendChild(row);
  }

  body.appendChild(el('div', 'sec-title', 'Composition of the electorate'));
  const counts = { young: 0, middle: 0, old: 0, male: 0, female: 0, nonbinary: 0 };
  const wts = { young: 0, middle: 0, old: 0, male: 0, female: 0, nonbinary: 0 };
  for (const v of E.voters) { counts[v.age]++; counts[v.gender]++; wts[v.age] += v.w; wts[v.gender] += v.w; }
  const tw = E.totalW;
  for (const g of window.AGE_GROUPS.concat(window.GENDERS)) {
    const row = el('div', 'kv');
    row.innerHTML = `<span class="k">${g.label}${g.sub ? ' <span style="color:var(--fg3)">' + g.sub + '</span>' : ''}</span>
      <span class="v">${counts[g.id]}% of adults · <b style="color:var(--fg)">${(wts[g.id] / tw * 100).toFixed(0)}%</b> of ballots</span>`;
    body.appendChild(row);
  }

  body.appendChild(el('div', 'sec-title', 'Where this state stands'));
  const me = G.candidates[G.activeCand];
  G.topics.forEach((t, i) => {
    let avg = 0; for (const v of E.voters) avg += v.vec[i] * v.w;
    avg /= tw;
    // Cosine compares direction, so what matters is whether you point the same way they do.
    const mine = me.stances[i];
    let verdict, col;
    if (Math.abs(avg) < 0.25 || mine === 0) { verdict = 'split'; col = 'var(--fg3)'; }
    else if (Math.sign(avg) === Math.sign(mine)) { verdict = Math.abs(avg) > 0.8 ? 'with you' : 'leans your way'; col = 'var(--good)'; }
    else { verdict = Math.abs(avg) > 0.8 ? 'against you' : 'leans away'; col = 'var(--bad)'; }
    const row = el('div', 'kv');
    row.innerHTML = `<span class="k">${esc(t.name)}</span>
      <span class="v">${avg >= 0 ? '+' : ''}${avg.toFixed(1)} vs you ${mine >= 0 ? '+' : ''}${mine}
      <span style="color:${col}">· ${verdict}</span></span>`;
    body.appendChild(row);
  });
  body.appendChild(el('div', 'pickhint',
    'Turnout-weighted average voter position on each issue, and yours beside it. Voters compare direction, not distance — ' +
    'pointing the same way as a state matters more than matching its exact number.'));
}

/* ---------------- log ---------------- */
function renderLog(body) {
  // Hot-seat hygiene: what rivals did this round is not yours to read yet.
  const items = G.log.filter(r => r.cand === G.activeCand || r.round < G.round).slice().reverse();
  const evs = G.events.slice().reverse();
  if (!items.length && !evs.length) { body.appendChild(el('div', 'emptyish', 'Nothing has happened yet.')); return; }
  let lastRound = null;
  for (const ev of evs) {
    const box = el('div', 'newsbox');
    box.innerHTML = `<h3 style="font-size:16px">${esc(ev.title)}</h3><p style="font-size:13px">${esc(ev.text)}</p>`;
    box.style.margin = '0 0 12px';
    body.appendChild(box);
  }
  for (const r of items) {
    if (r.round !== lastRound) {
      body.appendChild(el('div', 'sec-title', r.finalPush ? 'Final push' : 'Round ' + r.round));
      lastRound = r.round;
    }
    const c = resultCard(r);
    const who = G.candidates[r.cand];
    c.style.borderLeftColor = who.color;
    if (r.cand !== G.activeCand) {
      c.querySelector('.rs').innerHTML = esc(who.name) + ' · ' + c.querySelector('.rs').textContent;
    }
    body.appendChild(c);
  }
}

/* ---------------- end of turn ---------------- */
$('#btn-endturn').onclick = () => {
  const me = G.candidates[G.activeCand];
  if (me.money >= 20 && !G.finalPush) {
    modal(`<h3>End the turn with ${fmtMoney(me.money)} unspent?</h3>
      <p>It carries over — but money sitting in the bank on election day has never moved a single vote.</p>
      <div class="setup-foot"><button class="btn ghost" id="m-no">Keep working</button>
      <button class="btn big" id="m-yes">End turn</button></div>`);
    $('#m-no').onclick = closeModal;
    $('#m-yes').onclick = () => { closeModal(); G.turnPtr++; nextTurn(); };
    return;
  }
  G.turnPtr++; nextTurn();
};

function resolveAIAndEndRound() {
  for (const c of G.candidates) {
    if (c.isHuman) continue;
    // Corporate mode: some AI candidates will take the money.
    if (G.cfg.funding === 'corp' && !c.corp && G.rng() < 0.45) {
      const avail = G.corpOffers.map((o, i) => ({ o, i })).filter(x => !x.o.taken);
      if (avail.length) {
        const pick = avail[Math.floor(G.rng() * avail.length)];
        const r = window.Engine.acceptCorp(G, c.idx, pick.i);
        if (r.ok) { r.round = G.round; r.cand = c.idx; G.log.push(r); c.roundLog.push(r); }
      }
    }
    const results = window.Engine.aiTurn(G, c.idx);
    for (const r of results) { r.round = G.round; r.cand = c.idx; r.finalPush = G.finalPush; G.log.push(r); c.roundLog.push(r); }
  }

  if (G.finalPush) { runElection(); return; }

  const ev = window.Engine.rollEvent(G);
  ev.round = G.round;
  G.events.push(ev);

  refreshTruth();
  // Published poll: noisier than internal tracking, and it tightens as the election nears.
  const sigma = 0.055 - 0.006 * G.round;
  const poll = window.pollFrom(G.truth, Math.max(0.022, sigma), G.rng, G.candidates.length);
  poll.round = G.round;
  G.polls.push(poll);
  renderPoll(poll, ev);
  show('s-poll');
}

/* ---------------- poll screen ---------------- */
function renderPoll(poll, ev) {
  $('#poll-kicker').textContent = 'polling release · after round ' + G.round;
  $('#poll-title').textContent = G.round >= G.totalRounds ? 'The last poll before the vote' : 'The state of the race';
  const body = $('#poll-body');
  body.innerHTML = '';

  const news = el('div', 'newsbox');
  news.innerHTML = `<h3>${esc(ev.title)}</h3><p>${esc(ev.text)}</p>`;
  body.appendChild(news);

  const grid = el('div', 'pollgrid');
  const order = G.candidates.map((c, i) => ({ c, ev: poll.ev[i], sh: poll.shares[i] })).sort((a, b) => b.ev - a.ev);
  const prev = G.polls.length > 1 ? G.polls[G.polls.length - 2] : null;
  for (const o of order) {
    const card = el('div', 'pollcard');
    let delta = '';
    if (prev) {
      const d = (o.sh - prev.shares[o.c.idx]) * 100;
      delta = `<span class="${d >= 0 ? 'pos' : 'neg'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(1)}</span>`;
    }
    card.innerHTML = `<div class="pn"><span class="dot" style="background:${o.c.color}"></span>${esc(o.c.name)}</div>
      <div class="big">${(o.sh * 100).toFixed(1)}<span style="font-size:19px">%</span> ${delta}</div>
      <div class="sub">${o.ev} projected electoral votes${o.c.corp ? ' · ' + esc(o.c.corp.name) + ' money' : ''}</div>`;
    body.appendChild(card);
    grid.appendChild(card);
  }
  body.appendChild(grid);

  const note = el('p', 'dek small');
  note.innerHTML = `Margin of error is real: this is your true standing blurred by a national house effect and
    state-level noise. It is a photograph of a moving thing.`;
  body.appendChild(note);

  // What everybody did.
  body.appendChild(el('div', 'sec-title', 'What the campaigns did this round'));
  const roundLog = el('div', 'roundlog');
  for (const c of G.candidates) {
    if (!c.roundLog.length) continue;
    const box = el('div', 'pollcard');
    let h = `<div class="pn"><span class="dot" style="background:${c.color}"></span>${esc(c.name)}
      <span style="margin-left:auto;font-family:var(--mono);font-size:11.5px;color:var(--fg3)">${fmtMoney(c.money)} left</span></div>`;
    for (const r of c.roundLog) {
      h += `<div style="font-size:13px;padding:5px 0;border-top:1px solid var(--line)">
        <b style="font-weight:600">${esc(r.title)}</b>
        <span style="color:var(--fg3)"> — ${esc(r.sub || '')}</span></div>`;
    }
    box.innerHTML = h;
    roundLog.appendChild(box);
  }
  body.appendChild(roundLog);

  $('#btn-poll-go').textContent = G.round >= G.totalRounds ? 'To the final push ▸' : 'Next round ▸';
}

$('#btn-poll-go').onclick = () => {
  if (G.round >= G.totalRounds) {
    if (G.finalPush) { runElection(); return; }
    G.finalPush = true;
    G.round = G.totalRounds + 1;
    modal(`<h3>The final push</h3>
      <p>No more money is coming. Whatever is left in the war chest is what you have for the last week.
         Spend it or watch it expire.</p>
      <div class="setup-foot"><button class="btn big" id="m-ok">Let's go</button></div>`);
    $('#m-ok').onclick = () => { closeModal(); startRound(); };
    return;
  }
  G.round++;
  startRound();
};

/* ---------------- election night ---------------- */
let night = null;

function runElection() {
  refreshTruth();
  // One last jitter: the difference between what the model knew and what happened.
  const jitter = noiseField(G.rng, G.candidates.length, 0.018);
  G.result = applyField(G.truth, jitter, G.candidates.length);
  G.result.isPoll = false;
  // Actual vote counts, jittered per state so the totals are not perfectly smooth.
  for (const ab in G.result.states) {
    const s = G.result.states[ab];
    const turnoutWobble = 1 + G.rng.gauss(0, 0.03);
    s.total = G.truth.states[ab].total * turnoutWobble;
    s.votes = s.shares.map(x => x * s.total);
  }
  const n = G.candidates.length;
  const nat = new Float64Array(n); let tot = 0;
  for (const ab in G.result.states) {
    for (let k = 0; k < n; k++) nat[k] += G.result.states[ab].votes[k];
    tot += G.result.states[ab].total;
  }
  G.result.votes = Array.from(nat);
  G.result.shares = Array.from(nat, x => x / tot);
  G.result.totalVotes = tot;

  // Reveal order: east to west, the way polls actually close.
  // Polls close in the east first; Alaska and Hawaii sit far to the left in this projection, so they close last anyway.
  const order = Object.keys(G.result.states).sort((a, b) => window.US_MAP.states[b].c[0] - window.US_MAP.states[a].c[0]);
  night = { order, ptr: 0, revealed: new Set(), ev: new Array(n).fill(0), called: null, timer: null };

  window.UI.buildMap($('#nightmap'), {});
  window.UI.wireMap($('#nightmap'), $('#ntip'), () => nightView(), () => G.candidates, {});
  $('#night-feed').innerHTML = '';
  $('#night-title').textContent = 'Returns';
  show('s-night');
  paintNight();
  night.timer = setInterval(revealNext, 420);
}

function nightView() {
  // Only revealed states carry a call; the rest stay grey.
  const view = { states: {}, ev: night.ev, shares: G.result.shares, isPoll: false, demo: G.result.demo, demoTotals: G.result.demoTotals };
  for (const ab in G.result.states) view.states[ab] = G.result.states[ab];
  return view;
}

function paintNight() {
  const blank = new Set(Object.keys(G.result.states).filter(ab => !night.revealed.has(ab)));
  window.UI.paintMap($('#nightmap'), G.result, G.candidates, { blank });
  const bar = { ev: night.ev };
  window.UI.renderEvBar($('#night-evbar'), bar, G.candidates);
  const w = $('#night-standings'); w.innerHTML = '';
  const order = G.candidates.map((c, i) => ({ c, ev: night.ev[i] })).sort((a, b) => b.ev - a.ev);
  order.forEach((o, r) => {
    const chip = el('div', 'cchip' + (r === 0 ? ' lead' : ''));
    chip.innerHTML = `<span class="dot" style="background:${o.c.color}"></span>
      <span class="nm">${esc(o.c.name)}</span><span class="ev">${o.ev}</span>`;
    w.appendChild(chip);
  });
  const pctIn = Math.round(night.ptr / night.order.length * 100);
  $('#night-clock').textContent = pctIn >= 100 ? 'All returns in' : pctIn + '% of states reporting';
}

function revealNext() {
  if (night.ptr >= night.order.length) { endNight(); return; }
  const batch = Math.min(2 + Math.floor(night.ptr / 12), 4);
  for (let b = 0; b < batch && night.ptr < night.order.length; b++) {
    const ab = night.order[night.ptr++];
    const s = G.result.states[ab];
    night.revealed.add(ab);
    night.ev[s.winner] += s.ev;
    const item = el('div', 'feed-item');
    const band = window.UI.bandName(s.margin);
    item.innerHTML = `<div class="fh"><span>${esc(window.STATES[ab].name)}</span>
      <span style="color:${G.candidates[s.winner].color}">${esc(G.candidates[s.winner].name.split(' ').slice(-1)[0])}</span></div>
      <div class="fs">${s.ev} EV · ${band.toLowerCase()} · +${(s.margin * 100).toFixed(1)} · ${(s.shares[s.winner] * 100).toFixed(1)}%</div>`;
    $('#night-feed').prepend(item);
  }
  // Has anyone crossed 270?
  if (!night.called) {
    for (let k = 0; k < night.ev.length; k++) {
      if (night.ev[k] >= 270) {
        night.called = k;
        const box = el('div', 'calledbox');
        box.innerHTML = `<div class="k">projected winner</div><div class="n">${esc(G.candidates[k].name)}</div>
          <div class="fs">${night.ev[k]} electoral votes and counting</div>`;
        $('#night-feed').prepend(box);
      }
    }
  }
  paintNight();
}

function endNight() {
  clearInterval(night.timer);
  night.timer = null;
  setTimeout(showFinal, 900);
}

$('#btn-night-skip').onclick = () => {
  if (!night) return;
  if (night.timer) clearInterval(night.timer);
  while (night.ptr < night.order.length) revealNext();
  clearInterval(night.timer);
  showFinal();
};

/* ---------------- final ---------------- */
function showFinal() {
  if (night && night.done) return;
  if (night) night.done = true;
  const n = G.candidates.length;
  const R = G.result;
  const evs = new Array(n).fill(0);
  for (const ab in R.states) evs[R.states[ab].winner] += R.states[ab].ev;
  R.ev = evs;

  let win = 0;
  for (let k = 1; k < n; k++) if (evs[k] > evs[win] || (evs[k] === evs[win] && R.votes[k] > R.votes[win])) win = k;
  const contingent = evs[win] < 270;
  const W = G.candidates[win];

  let popWin = 0;
  for (let k = 1; k < n; k++) if (R.votes[k] > R.votes[popWin]) popWin = k;

  const body = $('#final-body');
  let h = `<div class="winner-card">
    <div class="k">${contingent ? 'no majority — the house decides' : 'president-elect'}</div>
    <h1 style="color:${W.color}">${esc(W.name)}</h1>
    <div class="sub">${evs[win]} electoral votes · ${pct(R.shares[win])} of the popular vote
      ${W.party ? '· ' + esc(W.party) : ''}</div></div>`;

  if (contingent) {
    h += `<div class="newsbox"><h3>Nobody reached 270</h3><p>The electoral college is deadlocked, and under the
      Twelfth Amendment the choice falls to the House of Representatives, voting one state at a time. After four
      ballots they settle on ${esc(W.name)}, the candidate with the most electoral votes. Roughly nobody is happy.</p></div>`;
  }
  if (popWin !== win) {
    h += `<div class="newsbox"><h3>Split decision</h3><p>${esc(G.candidates[popWin].name)} won the popular vote by
      ${((R.shares[popWin] - R.shares[win]) * 100).toFixed(1)} points and lost the presidency. This is the fourth
      time in living memory somebody has explained the electoral college on television at length.</p></div>`;
  }

  if (W.corp) {
    h += `<div class="corp-epilogue"><div class="k">the bill comes due</div>
      <p>${esc(W.name)} won while backed by ${esc(W.corp.name)}, who has achieved additional power through
      <b>${esc(W.corp.power)}</b>.</p></div>`;
  }
  const otherCorp = G.candidates.filter(c => c.corp && c.idx !== win);
  if (otherCorp.length) {
    h += `<p class="dek small">Also on the record: ` + otherCorp.map(c =>
      `${esc(c.name)} took ${esc(c.corp.name)}'s money and lost`).join('; ') + `.</p>`;
  }

  h += `<table class="finaltable"><thead><tr><th>Candidate</th><th>Electoral</th><th>States</th>
        <th>Popular vote</th><th>Share</th></tr></thead><tbody>`;
  const order = G.candidates.map((c, i) => ({ c, i })).sort((a, b) => R.ev[b.i] - R.ev[a.i] || R.votes[b.i] - R.votes[a.i]);
  for (const o of order) {
    const states = Object.values(R.states).filter(s => s.winner === o.i).length;
    h += `<tr class="${o.i === win ? 'win' : ''}"><td class="nm"><span class="wrap"><span class="dot" style="background:${o.c.color}"></span>
      ${esc(o.c.name)}${o.c.isHuman ? ' <span style="color:var(--accent);font-family:var(--mono);font-size:11px">YOU</span>' : ''}</span></td>
      <td>${R.ev[o.i]}</td><td>${states}</td><td>${window.UI.fmtVotes(R.votes[o.i])}</td>
      <td>${pct(R.shares[o.i])}</td></tr>`;
  }
  h += `</tbody></table>`;

  // The last poll vs. what actually happened.
  const lastPoll = G.polls[G.polls.length - 1];
  if (lastPoll) {
    h += `<div class="sec-title">How wrong were the polls?</div><div class="pollgrid">`;
    for (const o of order) {
      const d = (R.shares[o.i] - lastPoll.shares[o.i]) * 100;
      h += `<div class="pollcard"><div class="pn"><span class="dot" style="background:${o.c.color}"></span>${esc(o.c.name)}</div>
        <div class="big" style="font-size:27px">${d >= 0 ? '+' : ''}${d.toFixed(1)}</div>
        <div class="sub">points versus the final poll</div></div>`;
    }
    h += `</div>`;
  }

  // Closest calls.
  const close = Object.values(R.states).sort((a, b) => a.margin - b.margin).slice(0, 5);
  h += `<div class="sec-title">The five states that decided it</div>`;
  for (const s of close) {
    h += `<div class="kv"><span class="k">${esc(window.STATES[s.ab].name)} · ${s.ev} EV</span>
      <span class="v" style="color:${G.candidates[s.winner].color}">
      ${esc(G.candidates[s.winner].name.split(' ').slice(-1)[0])} by ${(s.margin * 100).toFixed(2)} pts
      (${window.UI.fmtVotes(Math.abs(s.votes[s.winner] - Math.max(...s.votes.filter((_, k) => k !== s.winner))))} votes)</span></div>`;
  }

  // Spending summary.
  h += `<div class="sec-title">The money</div>`;
  for (const o of order) {
    h += `<div class="kv"><span class="k">${esc(o.c.name)}</span><span class="v">raised ${fmtMoney(o.c.raised)} ·
      ${G.log.filter(r => r.cand === o.i).length} moves · ${fmtMoney(o.c.money)} unspent
      ${o.c.endorsements.length ? '· ' + esc(o.c.endorsements.join(', ')) : ''}</span></div>`;
  }

  body.innerHTML = h;
  show('s-final');
}

$('#btn-final-again').onclick = () => { show('s-title'); };

/* ---------------- keyboard ---------------- */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); if (ui.draft) { ui.draft = null; if (G && G.activeCand != null) { renderSide(); paint(); } } }
});

// expose for the automated playtest harness
window.__game = () => G;
window.__ui = () => ui;
})();
