/* ============================================================
   ui.js — map rendering and shared display helpers
   ============================================================ */
window.UI = (function () {

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const svgEl = (tag, attrs) => {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- colour ---------- */
  function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(hexA, hexB, t) {
    const a = hex2rgb(hexA), b = hex2rgb(hexB);
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  }
  const MAP_BG = '#1a212c';
  // Margin bands, 538-style: tossup → safe.
  function shadeFor(color, margin) {
    let t;
    if (margin >= 0.22) t = 0;
    else if (margin >= 0.12) t = 0.22;
    else if (margin >= 0.06) t = 0.46;
    else if (margin >= 0.02) t = 0.66;
    else t = 0.80;
    return mix(color, MAP_BG, t);
  }
  function bandName(margin) {
    if (margin >= 0.22) return 'Safe';
    if (margin >= 0.12) return 'Likely';
    if (margin >= 0.06) return 'Lean';
    if (margin >= 0.02) return 'Tilt';
    return 'Toss-up';
  }

  /* ---------- the map ---------- */
  const CO_X = 986, CO_W = 46, CO_H = 22, CO_GAP = 26, CO_Y0 = 96;

  function buildMap(svg, opts) {
    svg.innerHTML = '';
    const M = window.US_MAP;
    const g = svgEl('g', {});
    svg.appendChild(g);
    const paths = {};
    const labels = {};

    for (const ab in M.states) {
      const s = M.states[ab];
      const p = svgEl('path', { d: s.d, class: 'st', 'data-ab': ab, fill: MAP_BG });
      g.appendChild(p);
      paths[ab] = p;
    }
    // Abbreviations inside the larger states only.
    for (const ab in M.states) {
      const s = M.states[ab];
      if (s.a < 1150 || window.CALLOUTS.includes(ab)) continue;
      const t = svgEl('text', { x: s.c[0], y: s.c[1] + 3, class: 'stlabel' });
      t.textContent = ab;
      g.appendChild(t);
      labels[ab] = t;
    }
    // Callout boxes for the small north-eastern states.
    const co = svgEl('g', {});
    svg.appendChild(co);
    window.CALLOUTS.forEach((ab, i) => {
      const s = M.states[ab];
      const y = CO_Y0 + i * CO_GAP;
      const line = svgEl('path', { class: 'coline', d: `M${s.c[0]},${s.c[1]} L${CO_X - 8},${y + CO_H / 2}` });
      co.appendChild(line);
      const r = svgEl('rect', { x: CO_X, y, width: CO_W, height: CO_H, rx: 4, class: 'st', 'data-ab': ab, fill: MAP_BG });
      co.appendChild(r);
      const t = svgEl('text', { x: CO_X + CO_W / 2, y: y + CO_H / 2 + 3.5, class: 'stlabel' });
      t.textContent = ab;
      co.appendChild(t);
      paths[ab + '#box'] = r;
    });

    svg._paths = paths;
    return paths;
  }

  /* result: a tally or poll. cands: candidate list with .color */
  function paintMap(svg, result, cands, opts) {
    opts = opts || {};
    if (!svg._paths) buildMap(svg, opts);
    const P = svg._paths;
    for (const ab in result.states) {
      const s = result.states[ab];
      const fill = opts.blank && opts.blank.has && opts.blank.has(ab)
        ? MAP_BG
        : shadeFor(cands[s.winner].color, s.margin);
      const nodes = [P[ab], P[ab + '#box']];
      for (const nd of nodes) {
        if (!nd) continue;
        nd.setAttribute('fill', fill);
        nd.classList.toggle('sel', !!(opts.selected && opts.selected === ab));
        nd.classList.toggle('tgt', !!(opts.targets && opts.targets.has(ab)));
      }
    }
  }

  function wireMap(svg, tip, getResult, getCands, handlers) {
    const box = svg.parentElement;
    svg.addEventListener('mousemove', e => {
      const t = e.target.closest('[data-ab]');
      if (!t) { tip.classList.remove('on'); return; }
      const ab = t.getAttribute('data-ab');
      const r = getResult();
      if (!r || !r.states[ab]) { tip.classList.remove('on'); return; }
      tip.innerHTML = tooltipHTML(ab, r.states[ab], getCands(), r.isPoll);
      tip.classList.add('on');
      const bb = box.getBoundingClientRect();
      let x = e.clientX - bb.left + 16, y = e.clientY - bb.top + 14;
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      if (x + tw > bb.width - 6) x = e.clientX - bb.left - tw - 14;
      if (y + th > bb.height - 6) y = Math.max(4, e.clientY - bb.top - th - 12);
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    });
    svg.addEventListener('mouseleave', () => tip.classList.remove('on'));
    if (handlers && handlers.onClick) {
      svg.addEventListener('click', e => {
        const t = e.target.closest('[data-ab]');
        if (t) handlers.onClick(t.getAttribute('data-ab'));
      });
    }
  }

  function tooltipHTML(ab, s, cands, isPoll) {
    const st = window.STATES[ab];
    const order = s.shares.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
    let h = `<div class="tt-h"><span>${esc(st.name)}</span><span class="ev">${st.ev} EV</span></div>`;
    for (const o of order) {
      h += `<div class="tt-row"><span class="dot" style="background:${cands[o.i].color}"></span>
            <span class="n">${esc(cands[o.i].name)}</span><span class="v">${(o.v * 100).toFixed(1)}%</span></div>`;
    }
    h += `<div class="tt-row" style="margin-top:6px;color:var(--fg3);font-size:11.5px">
          ${bandName(s.margin)} · ${cands[s.winner].name.split(' ').slice(-1)[0]} +${(s.margin * 100).toFixed(1)}
          ${isPoll ? ' · polled' : ''}</div>`;
    return h;
  }

  /* ---------- EV bar ---------- */
  function renderEvBar(node, result, cands) {
    node.innerHTML = '';
    const order = result.ev.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
    for (const o of order) {
      if (o.v <= 0) continue;
      const seg = el('div', 'evseg');
      seg.style.width = (o.v / 538 * 100) + '%';
      seg.style.background = cands[o.i].color;
      seg.textContent = o.v >= 26 ? o.v : '';
      seg.title = cands[o.i].name + ' — ' + o.v + ' electoral votes';
      node.appendChild(seg);
    }
    const mid = el('div', 'mid'); node.appendChild(mid);
    const lbl = el('div', 'midlbl', '270 to win'); node.appendChild(lbl);
  }

  function renderLegend(node, cands) {
    node.innerHTML = '';
    for (const c of cands) {
      const w = el('div', 'lg');
      const swatches = [0.80, 0.46, 0].map(t => `<i style="width:9px;background:${mix(c.color, MAP_BG, t)}"></i>`).join('');
      w.innerHTML = swatches + ' ' + esc(c.name);
      node.appendChild(w);
    }
    const scale = el('div', 'lg');
    scale.style.opacity = '.75';
    scale.innerHTML = '<span>toss-up → safe</span>';
    node.appendChild(scale);
  }

  /* ---------- misc formatting ---------- */
  const fmtVotes = v => v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : Math.round(v).toLocaleString();
  const fmtMoney = m => '$' + (Math.round(m * 10) / 10).toFixed(m < 10 ? 1 : 0) + 'M';
  const pct = v => (v * 100).toFixed(1) + '%';

  return { $, $$, el, svgEl, esc, mix, shadeFor, bandName, buildMap, paintMap, wireMap,
           renderEvBar, renderLegend, tooltipHTML, fmtVotes, fmtMoney, pct, MAP_BG };
})();
