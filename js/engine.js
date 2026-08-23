/* ============================================================
   engine.js — campaign actions, random events, AI opponents
   ============================================================ */

const BASE_EFFECT = 0.075;   // bias units moved by a full-reach national buy
const STATE_GAIN  = 2.6;     // concentration bonus for a single-state buy
const DIMINISH    = 0.45;    // strength of diminishing returns per repeat

window.Engine = (function () {

  /* ---------------- costs ---------------- */
  function costOf(actionId, scope, stateCount, copies) {
    const A = window.ACTIONS[actionId];
    if (!A) return (window.SPECIALS[actionId] || {}).cost || 0;
    if (scope === 'national') return A.costNational;
    return A.costState * Math.max(1, stateCount || 1) * Math.max(1, copies || 1);
  }

  /* ---------------- diminishing returns ---------------- */
  function repeatKey(actionId, scope, targetKey, stateKey) {
    return [actionId, scope, targetKey || 'all', stateKey || '-'].join('~');
  }
  function diminish(cand, key) {
    const n = cand.counters[key] || 0;
    return 1 / (1 + DIMINISH * n);
  }
  function bumpCounter(cand, key) { cand.counters[key] = (cand.counters[key] || 0) + 1; }

  /* A campaign nobody believes in works less well. */
  function effOf(cand) {
    const auth = cand.auth ? cand.auth.score : 1;
    return cand.analysis.effectiveness * (0.70 + 0.30 * auth);
  }

  /* ---------------- outcome roll ---------------- */
  function roll(rng, variance, backfireChance, cand) {
    const lucky = rng();
    const backfired = lucky < backfireChance * (1 + cand.analysis.gaffeRisk * 2);
    let mult = Math.max(0.05, rng.gauss(1, variance));
    if (backfired) mult = -Math.abs(rng.range(0.25, 0.9));
    return { mult, backfired };
  }

  function tierOf(mult) {
    if (mult < 0) return 'backfire';
    if (mult < 0.35) return 'flat';
    if (mult < 0.72) return 'modest';
    if (mult < 1.18) return 'solid';
    if (mult < 1.75) return 'strong';
    return 'breakout';
  }

  /* ---------------- flavour text ---------------- */
  const FLAVOR = {
    tv: {
      backfire: ['The spot runs for eleven hours before it is pulled. The clip that survives is the one being mocked.',
                 'Somebody at the agency approved a shot of you that will be a reaction image by Thursday.'],
      flat:     ['The buy runs. Nobody mentions it. The tracking barely twitches.',
                 'Perfectly competent, perfectly forgettable. It played to empty rooms.'],
      modest:   ['A steady rotation in the evening news blocks. The needle moves a little.',
                 'The spot tests fine. Not great, fine. Older viewers nod along.'],
      solid:    ['Saturation in every media market. The message is landing where you paid for it to land.',
                 'By the third night, people are finishing your line before you say it.'],
      strong:   ['The ad breaks out of the ad break. Two networks run it as a story.',
                 'Focus groups keep circling back to it unprompted. That is the tell.'],
      breakout: ['It becomes the spot of the cycle. Rivals are now running against your ad instead of you.',
                 'A thirty-second film that ends up in a documentary about this election.'],
    },
    internet: {
      backfire: ['The creative gets ratioed into oblivion. The quote-posts are worse than the replies.',
                 'It runs next to something unspeakable and the screenshot is everywhere within an hour.'],
      flat:     ['Impressions delivered, engagement flat. The algorithm ate your money.',
                 'It runs, it scrolls past, it is gone. Cheap lesson.'],
      modest:   ['Decent completion rates. A few edits of it start circulating on their own.',
                 'It finds a niche audience that likes it a lot and an audience that never sees it.'],
      solid:    ['The creative gets shared without being paid for. That is the whole game.',
                 'Comment sections turn friendly. Your name starts trending in the good way.'],
      strong:   ['Somebody sets it to music and that version outperforms your version.',
                 'Fifteen million views and a wave of unpaid imitations.'],
      breakout: ['It escapes the platform entirely. Morning shows are playing a meme of your ad.',
                 'The internet decides you are funny. There is no more valuable accident in politics.'],
    },
    print: {
      backfire: ['The paper runs it opposite an editorial dismantling the exact claim you made.',
                 'A typo in the headline. It is going to be on a mug by the weekend.'],
      flat:     ['Full pages, thin returns. The people who saw it had already decided.',
                 'It ran. Somewhere, a subscriber turned the page.'],
      modest:   ['A quiet, respectable buy. Older readers register the name.',
                 'It reads well over coffee, which is exactly who saw it.'],
      solid:    ['Two of the papers write about the ad. Free coverage on top of paid.',
                 'It lands with the reliable voters, and reliable voters vote.'],
      strong:   ['An editorial board cites your copy approvingly. That never happens.',
                 'Clipped, pinned to refrigerators, mailed to relatives.'],
      breakout: ['The layout gets reprinted in three dozen local papers for free.',
                 'A full page becomes a front page. Old media still has one gear left.'],
    },
    rally: {
      backfire: ['The venue is half empty and the camera crews shoot the empty half.',
                 'A protester gets a better line than you do and it leads the local news.'],
      flat:     ['A decent crowd, a decent speech, no moment. The room went home unchanged.',
                 'You gave them the stump. They have heard the stump.'],
      modest:   ['A warm room. Local anchors run ninety friendly seconds of it.',
                 'You worked the rope line for an hour and it shows in the county numbers.'],
      solid:    ['Overflow crowd, the fire marshal is unhappy, the coverage is excellent.',
                 'You found a new applause line halfway through and used it four more times.'],
      strong:   ['You go off script and it is the best thing you have said all cycle.',
                 'The clip of you and the kid in the third row is going to run for a week.'],
      breakout: ['Every network cuts in live. For six minutes you are the only thing on television.',
                 'People who were not there are talking about being there.'],
    },
    canvass: {
      backfire: ['A volunteer says something regrettable on a doorstep with a camera behind it.',
                 'The field director quits mid-week and half the shifts go unfilled.'],
      flat:     ['Doors knocked, contacts logged, nothing to write home about.',
                 'The turf gets covered. Slow work, slow returns.'],
      modest:   ['Steady contact rates. The file gets cleaner and the numbers inch up.',
                 'Three hundred conversations that nobody will ever report on.'],
      solid:    ['The operation hums. Volunteers are bringing friends.',
                 'This is the unglamorous part that decides close states.'],
      strong:   ['Contact rates double. Your field program is now the story in the state.',
                 'A wave of new sign-ups. The office runs out of clipboards.'],
      breakout: ['The field program becomes a small movement. Other states start copying the model.',
                 'Somebody writes a book about this operation in four years.'],
    },
  };

  const SCALE_WORDS = {
    backfire: 'Damage done.', flat: 'No measurable movement.', modest: 'A small bump.',
    solid: 'A real gain.', strong: 'A clear surge.', breakout: 'A step change.',
  };

  function flavorFor(actionId, tier, rng) {
    const set = FLAVOR[actionId] || FLAVOR.tv;
    return rng.pick(set[tier]);
  }

  /* ---------------- ad / visit / field ---------------- */
  /* opts: { actionId, scope:'national'|'state', states:[], ageFilter, genFilter,
             attack: candIndex|null, copies } */
  function runMedia(G, ci, opts) {
    const cand = G.candidates[ci];
    const A = window.ACTIONS[opts.actionId];
    const rng = G.rng;
    const stateCount = opts.scope === 'state' ? opts.states.length : 0;
    const cost = costOf(opts.actionId, opts.scope, stateCount, opts.copies);
    if (cost > cand.money + 1e-6) return { ok: false, reason: 'Not enough money.' };
    cand.money -= cost;

    const targetKey = (opts.ageFilter || '') + (opts.genFilter || '') || 'all';
    const stateKey = opts.scope === 'state' ? opts.states.slice().sort().join(',') : 'US';
    const key = repeatKey(opts.actionId, opts.scope, targetKey + (opts.attack != null ? '|atk' + opts.attack : ''), stateKey);
    const dim = diminish(cand, key);
    bumpCounter(cand, key);

    const r = roll(rng, A.variance, A.backfire + (opts.attack != null ? 0.07 : 0), cand);

    let magnitude = BASE_EFFECT * A.reach * effOf(cand) * dim * r.mult;
    if (opts.scope === 'state') magnitude *= STATE_GAIN;
    if (opts.copies && opts.copies > 1) magnitude *= (1 + 0.55 * (opts.copies - 1)); // surrogates: sublinear
    if (opts.attack != null) {
      const dossier = cand.dossier[opts.attack] || 0;
      magnitude *= 0.85 * (1 + 0.4 * dossier);
    }

    const res = window.applyBias(G, {
      cand: ci,
      magnitude,
      states: opts.scope === 'state' ? opts.states : null,
      spill: A.id === 'rally' ? 0.05 : 0,
      ageMult: A.ageMult, genMult: A.genMult,
      ageFilter: opts.ageFilter || null, genFilter: opts.genFilter || null,
      attack: opts.attack != null ? opts.attack : null,
      blowback: opts.attack != null ? 0.18 : 0,
    });

    const tier = tierOf(r.mult);
    let head = A.icon + ' ' + A.label;
    if (opts.attack != null) head = '⚔️ Attack ' + A.label.replace(' Advertising', ' ad') + ' vs ' + G.candidates[opts.attack].name;
    const where = opts.scope === 'state'
      ? opts.states.map(s => window.STATES[s].name).join(', ')
      : 'nationwide';
    const who = opts.ageFilter ? ' targeting ' + label(window.AGE_GROUPS, opts.ageFilter).toLowerCase() + ' voters'
              : opts.genFilter ? ' targeting ' + label(window.GENDERS, opts.genFilter).toLowerCase()
              : '';

    return {
      ok: true, cost, tier, magnitude,
      title: head, sub: where + who,
      text: flavorFor(A.id, tier, rng) + ' ' + SCALE_WORDS[tier],
      repeated: (cand.counters[key] || 1) - 1,
    };
  }

  function label(list, id) { const x = list.find(o => o.id === id); return x ? x.label : id; }

  /* ---------------- policy pivot ---------------- */
  function runPivot(G, ci, topicIndex, newStance) {
    const cand = G.candidates[ci];
    const cost = window.SPECIALS.pivot.cost;
    if (cost > cand.money + 1e-6) return { ok: false, reason: 'Not enough money.' };
    const old = cand.stances[topicIndex];
    if (old === newStance) return { ok: false, reason: 'That is already your position.' };
    if (cand.lockedTopics && cand.lockedTopics[topicIndex]) {
      return { ok: false, reason: 'Your backers own this position. It does not move.' };
    }
    cand.money -= cost;
    const dist = Math.abs(newStance - old);
    cand.stances[topicIndex] = newStance;
    cand.pivots.push({ topic: topicIndex, from: old, to: newStance, round: G.round });
    cand.auth = window.authenticity(cand.analysis, G.topics, cand.stances);

    // Flip-flop penalty scales with distance and shrinks if voters trust you.
    const trust = cand.analysis.traits.trust / 100;
    const penalty = 0.022 * dist * (1.35 - trust) * (1 + 0.5 * (cand.pivots.length - 1));
    window.applyBias(G, { cand: ci, magnitude: -penalty });

    const t = G.topics[topicIndex];
    const tier = dist >= 4 ? 'strong' : dist >= 2 ? 'solid' : 'modest';
    const texts = {
      modest: 'A quiet clarification. A few reporters notice; nobody makes a meal of it.',
      solid: 'You are asked about the change eleven times in two days. The new position is now the position.',
      strong: 'A full reversal, live and on camera. The old tape runs immediately after the new tape.',
    };
    return {
      ok: true, cost, tier: 'solid', magnitude: penalty,
      title: '🔀 Policy change — ' + t.name,
      sub: window.stanceLabel(t, old) + '  →  ' + window.stanceLabel(t, newStance),
      text: texts[tier] + ' Your alignment with voters shifts; your credibility takes the bill.',
    };
  }

  /* ---------------- celebrity ---------------- */
  function runCeleb(G, ci, celebIndex) {
    const cand = G.candidates[ci];
    const cost = window.SPECIALS.celeb.cost;
    if (cost > cand.money + 1e-6) return { ok: false, reason: 'Not enough money.' };
    const celeb = G.celebOffers[celebIndex];
    if (!celeb || celeb.used) return { ok: false, reason: 'That endorsement is no longer available.' };
    cand.money -= cost;
    celeb.used = true;
    cand.endorsements.push(celeb.name);

    const rng = G.rng;
    const key = repeatKey('celeb', 'national', 'all', 'US');
    const dim = diminish(cand, key); bumpCounter(cand, key);
    const r = roll(rng, 0.45, celeb.risk, cand);
    const magnitude = 0.16 * celeb.power * effOf(cand) * dim * r.mult;

    window.applyBias(G, { cand: ci, magnitude, ageMult: celeb.pull, genMult: celeb.gen });

    const tier = tierOf(r.mult);
    const text = tier === 'backfire'
      ? celeb.name + ' says something at the rollout that becomes the story instead of you.'
      : tier === 'flat' ? 'The announcement lands in a busy news cycle and disappears.'
      : tier === 'breakout' ? celeb.name + ' does not just endorse you, they campaign for you. The crowds triple.'
      : celeb.name + ' cuts a video with you that their audience actually watches.';
    return {
      ok: true, cost, tier, magnitude,
      title: '⭐ Endorsement — ' + celeb.name,
      sub: 'the ' + celeb.field,
      text: text + ' ' + SCALE_WORDS[tier],
    };
  }

  /* ---------------- donors ---------------- */
  function runVip(G, ci) {
    const cand = G.candidates[ci];
    const cost = window.SPECIALS.vip.cost;
    if (cost > cand.money + 1e-6) return { ok: false, reason: 'Not enough money.' };
    cand.money -= cost;
    const rng = G.rng;
    const key = repeatKey('vip', 'national', 'all', 'US');
    const dim = diminish(cand, key); bumpCounter(cand, key);
    const haul = Math.max(0, rng.gauss(33, 13)) * dim * (0.7 + cand.analysis.traits.establishment / 175);
    cand.money += haul;
    cand.raised += haul;

    // A season of black-tie fundraisers costs you something with younger voters.
    const authenticityHit = 0.012 * (1 + (cand.counters[key] - 1) * 0.4);
    window.applyBias(G, { cand: ci, magnitude: -authenticityHit, ageMult: { young: 1.8, middle: 0.7, old: 0.4 } });

    const tier = haul > 65 ? 'breakout' : haul > 45 ? 'strong' : haul > 28 ? 'solid' : haul > 14 ? 'modest' : 'flat';
    const text = haul > 45 ? 'The room is generous and the room is large. The finance director is grinning.'
      : haul > 20 ? 'A solid night. Cheques, photographs, a hundred handshakes.'
      : 'Thin attendance. You paid for the ballroom and most of the plates went cold.';
    return {
      ok: true, cost, tier, magnitude: haul,
      title: '🥂 Donor circuit',
      sub: 'raised $' + haul.toFixed(0) + 'M',
      text: text + ' Younger voters notice who you spend your evenings with.',
    };
  }

  /* ---------------- opposition research ---------------- */
  function runOppo(G, ci, targetIndex) {
    const cand = G.candidates[ci];
    const cost = window.SPECIALS.oppo.cost;
    if (cost > cand.money + 1e-6) return { ok: false, reason: 'Not enough money.' };
    cand.money -= cost;
    const rng = G.rng;
    const target = G.candidates[targetIndex];
    cand.dossier[targetIndex] = (cand.dossier[targetIndex] || 0) + 1;

    const hit = rng() < 0.34;
    let magnitude = 0;
    if (hit) {
      magnitude = 0.05 * rng.range(0.7, 1.6) * (target.corp ? 1.6 : 1);
      window.applyBias(G, { cand: ci, magnitude, attack: targetIndex, blowback: 0 });
    }
    const finds = [
      'a decade-old deposition', 'an unfiled disclosure form', 'a very strange land purchase',
      'a consulting contract nobody declared', 'twelve minutes of unaired interview footage',
      'a settled lawsuit with a sealed exhibit', 'an old radio appearance', 'a donor list that should not exist',
    ];
    return {
      ok: true, cost, tier: hit ? 'solid' : 'flat', magnitude,
      title: '🔎 Opposition research — ' + target.name,
      sub: 'dossier level ' + cand.dossier[targetIndex],
      text: hit
        ? 'Your researchers surface ' + rng.pick(finds) + '. It leaks within the week and it stings. Every attack you run against them from here lands harder.'
        : 'Weeks of work, nothing publishable yet. Still, your attack ads against them will be sharper for it.',
    };
  }

  /* ---------------- corporate money ---------------- */
  function acceptCorp(G, ci, offerIndex) {
    const cand = G.candidates[ci];
    const offer = G.corpOffers[offerIndex];
    if (!offer || offer.taken) return { ok: false, reason: 'That offer is gone.' };
    if (cand.corp) return { ok: false, reason: 'You already have a principal backer.' };
    offer.taken = true;
    cand.corp = offer;
    cand.money += offer.money;
    cand.raised += offer.money;

    // The price: your position on their issue becomes theirs, and it is locked.
    const t = offer.topicIndex;
    const old = cand.stances[t];
    cand.stances[t] = offer.want;
    cand.lockedTopics[t] = true;
    cand.auth = window.authenticity(cand.analysis, G.topics, cand.stances);

    return {
      ok: true, cost: 0, tier: 'breakout', magnitude: offer.money,
      title: '🏛️ ' + offer.name + ' is now your principal backer',
      sub: '+$' + offer.money + 'M · ' + G.topics[t].name + ' locked',
      text: 'The ' + offer.industry + ' money arrives in one wire. Your position on ' + G.topics[t].name +
            ' moves from "' + window.stanceLabel(G.topics[t], old) + '" to "' + window.stanceLabel(G.topics[t], offer.want) +
            '" and it will not move again. Reporters will find this out eventually.',
    };
  }

  /* ---------------- between-round events ---------------- */
  const NEWS = [
    { id: 'mood', weight: 3 },
    { id: 'scandal', weight: 2 },
    { id: 'debate', weight: 3 },
    { id: 'econ', weight: 2 },
    { id: 'quiet', weight: 2 },
  ];

  function rollEvent(G) {
    const rng = G.rng;
    const total = NEWS.reduce((a, b) => a + b.weight, 0);
    let x = rng() * total;
    let pick = NEWS[0];
    for (const n of NEWS) { x -= n.weight; if (x <= 0) { pick = n; break; } }

    if (pick.id === 'quiet') {
      return { title: '📻 A quiet week', text: 'Nothing much happens. The country is watching something else. Every campaign privately calls this a win.' };
    }

    if (pick.id === 'mood') {
      const ti = rng.int(0, 4);
      const t = G.topics[ti];
      const delta = rng.gauss(0, 1) > 0 ? rng.range(0.35, 0.95) : -rng.range(0.35, 0.95);
      shiftMood(G, ti, delta);
      const dir = delta > 0 ? t.pos : t.neg;
      return {
        title: '📰 The country moves on ' + t.name,
        text: 'A shift in public opinion pushes the electorate toward ' + dir + '. Everyone\'s alignment with voters is recalculated. Candidates who staked out the far side of this issue just got more expensive to defend.',
        moodShift: { topic: ti, delta },
      };
    }

    if (pick.id === 'econ') {
      const good = rng() < 0.5;
      // A good economy helps whoever is closest to the incumbent centre; here, the front-runner.
      const t = window.tallyElection(G);
      let lead = 0; for (let k = 1; k < G.candidates.length; k++) if (t.shares[k] > t.shares[lead]) lead = k;
      const mag = 0.02 * (good ? 1 : -1);
      window.applyBias(G, { cand: lead, magnitude: mag });
      return {
        title: good ? '📈 The numbers come in strong' : '📉 The numbers come in ugly',
        text: (good ? 'Growth beats every forecast and the mood lifts. ' : 'A bad quarter, and the mood sours. ') +
              'Front-runners absorb the credit and the blame in roughly equal measure — ' + G.candidates[lead].name + ' feels it either way.',
      };
    }

    if (pick.id === 'scandal') {
      // Corporate-backed candidates are the likeliest to spring a leak.
      const tainted = G.candidates.map((c, i) => ({ c, i })).filter(o => o.c.corp);
      const victim = tainted.length && rng() < 0.65 ? rng.pick(tainted).i : rng.int(0, G.candidates.length - 1);
      const c = G.candidates[victim];
      const mag = 0.045 * rng.range(0.6, 1.5);
      window.applyBias(G, { cand: victim, magnitude: -mag });
      const line = c.corp
        ? 'A reporter connects ' + c.name + ' to ' + c.corp.name + '. The wire transfer is on page one by Sunday.'
        : 'An old story about ' + c.name + ' resurfaces with a new document attached. It is not fatal. It is not nothing.';
      return { title: '🔥 Scandal — ' + c.name, text: line };
    }

    // debate
    const scores = G.candidates.map((c, i) => {
      const t = c.analysis.traits;
      return { i, s: t.charisma * 0.4 + t.gravitas * 0.35 + t.trust * 0.25 + rng.gauss(0, 22) };
    }).sort((a, b) => b.s - a.s);
    const winner = scores[0], loser = scores[scores.length - 1];
    window.applyBias(G, { cand: winner.i, magnitude: 0.055, ageMult: { young: 0.9, middle: 1.1, old: 1.15 } });
    window.applyBias(G, { cand: loser.i, magnitude: -0.04, ageMult: { young: 0.9, middle: 1.1, old: 1.15 } });
    return {
      title: '🎙️ Debate night',
      text: G.candidates[winner.i].name + ' has the best night on the stage' +
        (G.candidates.length > 1 ? ', and ' + G.candidates[loser.i].name + ' has the worst — the split screen was not kind.' : '.') +
        ' Roughly forty million people watched at least some of it.',
    };
  }

  // Move the whole electorate's opinion on one topic.
  function shiftMood(G, topicIndex, delta) {
    G.topics[topicIndex].mood += delta;
    for (const ab in G.electorate) {
      for (const v of G.electorate[ab].voters) {
        v.vec[topicIndex] = window.clamp(v.vec[topicIndex] + delta, -3, 3);
      }
    }
  }

  /* ---------------- AI opponents ---------------- */
  function aiChooseStances(G, cand, rng) {
    const a = cand.archetype;
    const centre = window.electorateCentre(G);
    const prag = a.pragmatism != null ? a.pragmatism : 0.4;
    return G.topics.map((t, i) => {
      // What the archetype believes...
      const conviction = 3 * 1.55 * ((t.axes.s || 0) * a.tilt.s + (t.axes.e || 0) * a.tilt.e + (t.axes.n || 0) * a.tilt.n);
      // ...and what the polling says, sharpened: cosine rewards direction, not proximity.
      const populist = window.clamp(centre[i] * 1.8, -3, 3);
      const blend = conviction * (1 - prag) + populist * prag;
      return Math.round(window.clamp(blend + rng.gauss(0, a.spread * 0.6), -3, 3));
    });
  }

  function aiTurn(G, ci) {
    const cand = G.candidates[ci];
    const rng = G.rng;
    const style = cand.archetype.style;
    const truth = window.tallyElection(G);
    const results = [];

    // Rank states by "worth fighting for": close, and worth electoral votes.
    const board = Object.keys(truth.states).map(ab => {
      const s = truth.states[ab];
      const mine = s.shares[ci];
      const best = Math.max(...s.shares.filter((_, k) => k !== ci));
      const gap = Math.abs(mine - best);
      return { ab, ev: s.ev, gap, winning: mine > best };
    }).sort((x, y) => (y.ev / (0.06 + y.gap)) - (x.ev / (0.06 + x.gap)));
    const battleground = board.slice(0, 12);

    // Weakest demographic slice, so the AI targets where it has room to grow.
    let weakAge = null, worst = 2;
    for (const g of window.AGE_GROUPS) {
      const share = truth.demo[ci][g.id] / truth.demoTotals[g.id];
      if (share < worst) { worst = share; weakAge = g.id; }
    }

    const prefs = {
      tv:       { tv: 5, internet: 2, print: 2, rally: 2, canvass: 1, celeb: 2, vip: 3, oppo: 1 },
      digital:  { tv: 1, internet: 6, print: 0.4, rally: 2, canvass: 2, celeb: 3, vip: 2, oppo: 1 },
      ground:   { tv: 1.5, internet: 2, print: 1, rally: 5, canvass: 5, celeb: 1, vip: 2, oppo: 0.6 },
      attack:   { tv: 3, internet: 4, print: 0.6, rally: 3, canvass: 1, celeb: 1.5, vip: 2, oppo: 3.5 },
      balanced: { tv: 3, internet: 3, print: 1.5, rally: 3, canvass: 3, celeb: 2, vip: 2.5, oppo: 1.5 },
    }[style];

    let guard = 0;
    while (cand.money >= 5 && guard++ < 24) {
      // Fundraise when short, especially early.
      if (cand.money < 26 && rng() < 0.55 && G.round < G.totalRounds) {
        const r = runVip(G, ci); if (r.ok) { results.push(r); continue; }
      }
      const opts = [];
      for (const k in prefs) opts.push([k, prefs[k]]);
      const tot = opts.reduce((a, b) => a + b[1], 0);
      let x = rng() * tot, choice = opts[0][0];
      for (const [k, w] of opts) { x -= w; if (x <= 0) { choice = k; break; } }

      if (choice === 'celeb') {
        const avail = G.celebOffers.map((c, i) => ({ c, i })).filter(o => !o.c.used);
        if (avail.length && cand.money >= window.SPECIALS.celeb.cost) {
          const r = runCeleb(G, ci, rng.pick(avail).i); if (r.ok) { results.push(r); continue; }
        }
        continue;
      }
      if (choice === 'vip') {
        if (cand.money >= window.SPECIALS.vip.cost && G.round < G.totalRounds) {
          const r = runVip(G, ci); if (r.ok) { results.push(r); continue; }
        }
        continue;
      }
      if (choice === 'oppo') {
        const others = G.candidates.map((c, i) => i).filter(i => i !== ci);
        if (cand.money >= window.SPECIALS.oppo.cost && others.length) {
          const r = runOppo(G, ci, rng.pick(others)); if (r.ok) { results.push(r); continue; }
        }
        continue;
      }

      const A = window.ACTIONS[choice];
      const goNational = A.scope !== 'state' && rng() < 0.28;
      const target = rng.pick(battleground.slice(0, 8));
      const attack = (style === 'attack' && rng() < 0.42 && G.candidates.length > 1)
        ? rng.pick(G.candidates.map((c, i) => i).filter(i => i !== ci)) : null;
      const useDemo = rng() < 0.3;
      const r = runMedia(G, ci, {
        actionId: choice,
        scope: goNational ? 'national' : 'state',
        states: [target.ab],
        ageFilter: useDemo ? weakAge : null,
        genFilter: null,
        attack,
        copies: (choice === 'rally' && rng() < 0.25) ? 2 : 1,
      });
      if (r.ok) results.push(r); else break;
    }
    return results;
  }

  /* ---------------- corporate offers ---------------- */
  function makeCorpOffers(G, rng, count) {
    const pool = rng.shuffle(window.CORPORATIONS);
    const offers = [];
    for (const c of pool) {
      const ti = G.topics.findIndex(t => c.topics.includes(t.id));
      if (ti < 0) continue;
      offers.push({ ...c, topicIndex: ti, money: Math.round(c.money * rng.range(0.75, 1.2)), taken: false });
      if (offers.length >= count) break;
    }
    // If none of this cycle's topics match a listed industry, improvise.
    while (offers.length < count && pool.length) {
      const c = pool[offers.length % pool.length];
      const ti = rng.int(0, 4);
      offers.push({ ...c, topicIndex: ti, money: Math.round(c.money * rng.range(0.75, 1.2)), taken: false });
    }
    return offers;
  }

  return {
    costOf, runMedia, runPivot, runCeleb, runVip, runOppo, acceptCorp,
    rollEvent, shiftMood, aiTurn, aiChooseStances, makeCorpOffers, tierOf, effOf,
    BASE_EFFECT, STATE_GAIN,
  };
})();
