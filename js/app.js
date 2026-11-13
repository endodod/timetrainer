/* TimeTrainer: picture-based drills for TimeGuessr. Vanilla JS, no build step. */
(function () {
  'use strict';
  const D = window.TT_DATA;
  const app = document.getElementById('app');
  const NOW = new Date().getFullYear();
  const MIN_YEAR = 1900;

  /* ------------------------------------------------------------ utils */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  };
  function hashStr(s) { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return h >>> 0; }
  function rngFrom(seed) { // mulberry32
    let a = hashStr(String(seed));
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
  function shuffle(rng, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function weightedPick(rng, arr, weight) {
    const ws = arr.map(weight); const tot = ws.reduce((a, b) => a + b, 0);
    let r = rng() * tot; for (let i = 0; i < arr.length; i++) { r -= ws[i]; if (r <= 0) return arr[i]; } return arr[arr.length - 1];
  }
  const decade = y => Math.floor(y / 10) * 10;
  function groupBy(arr, key) { const m = new Map(); arr.forEach(x => { const k = key(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }); return [...m]; }
  const range = (f, t) => t == null ? `${f}–today` : (f === t ? `${f}` : `${f}–${t}`);
  function yearScore(guess, f, t) {
    const hi = t == null ? NOW : t;
    const d = guess < f ? f - guess : guess > hi ? guess - hi : 0;
    return { pts: Math.round(1000 * Math.exp(-d / 7)), off: d };
  }
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2200);
  }
  async function copyText(s) {
    try { await navigator.clipboard.writeText(s); toast('Copied to clipboard'); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = s; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Copied'); }
  }
  function download(name, text, type = 'text/plain') {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const csvCell = v => { const s = String(v == null ? '' : v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

  /* ------------------------------------------------------------ stats */
  const STATS = 'tt_stats_v1';
  function stats() { return store.get(STATS, { modes: {}, games: [] }); }
  function recordRound(mode, key, label, pts) {
    const s = stats(); const m = s.modes[mode] = s.modes[mode] || { rounds: 0, pts: 0, perfect: 0, miss: {}, labels: {} };
    m.rounds++; m.pts += pts; if (pts >= 900) m.perfect++;
    if (key) { // timeline rounds have no single item to retry
      m.labels[key] = label;
      if (pts < 500) m.miss[key] = (m.miss[key] || 0) + 1;
      else if (m.miss[key]) { m.miss[key] = Math.max(0, m.miss[key] - 1); if (!m.miss[key]) delete m.miss[key]; }
    }
    store.set(STATS, s);
  }
  function recordGame(g) { const s = stats(); s.games.unshift(g); s.games = s.games.slice(0, 50); store.set(STATS, s); }
  function missWeight(mode) { const m = (stats().modes[mode] || {}).miss || {}; return key => 1 + 2 * (m[key] || 0); }

  /* ------------------------------------------------------------ media helpers */
  function figure(img, alt) {
    if (!img) return `<div class="media empty">Image could not be loaded</div>`;
    return `<figure class="media"><img src="${esc(img.src)}" alt="${esc(alt || 'quiz image')}" loading="eager" decoding="async"></figure>`;
  }
  function credit(img) {
    if (!img || !img.file) return '';
    return `<a class="credit" href="${esc(Wiki.fileUrl(img.file))}" target="_blank" rel="noopener">${esc(img.file.replace(/^File:/, ''))} · Wikimedia Commons</a>`;
  }
  const SIGN_STYLES = ['sign-street', 'sign-shop', 'sign-green', 'sign-plaque', 'sign-neon', 'sign-red'];
  function signs(texts, rng) {
    return `<div class="signs">${texts.map((t, i) => `<div class="sign ${SIGN_STYLES[Math.floor(rng() * SIGN_STYLES.length)]}" dir="auto">${esc(t)}</div>`).join('')}</div>`;
  }

  /* ------------------------------------------------------------ modes */
  const cars = D.cars.items;
  const langs = D.languages.items;
  const sampleOwners = {};
  langs.forEach(l => new Set(l.s.map(t => t.toLowerCase())).forEach(t => sampleOwners[t] = (sampleOwners[t] || 0) + 1));
  const plates = D.plates.items;
  const brands = D.logos.brands;
  const outfitArts = D.outfits.articles;
  const plateGroups = [...new Set(plates.map(p => p.g))];
  const marks = D.landmarks.items;
  const markRange = l => l.gone ? `${l.y}–${l.gone}` : `${l.y}+`;

  /* Timeline: pick items whose years are far enough apart that the order is unambiguous. */
  function spreadPick(rng, pool, n, gap) {
    const out = [];
    for (const x of shuffle(rng, pool)) { if (out.every(o => Math.abs(o.year - x.year) >= gap)) out.push(x); if (out.length === n) break; }
    return out;
  }
  const carSrc = c => ({ id: 'c:' + c.w, label: c.n, year: c.f, what: 'launched', get: () => Wiki.lead(c.w) });
  const markSrc = l => ({ id: 'l:' + l.w, label: `${l.n} (${l.city})`, year: l.y, what: 'completed', get: () => Wiki.lead(l.w) });
  async function timelineItems(rng, kind) {
    if (kind === 'logos') {
      for (const b of shuffle(rng, brands).slice(0, 6)) {
        const list = await Wiki.logos(b.b, b.cats);
        const items = spreadPick(rng, list.map(l => ({ id: 'g:' + l.file, label: `${b.b} logo`, year: l.from, what: 'introduced', img: l, logo: true })), 4, 3);
        if (items.length >= 3) return items;
      }
      return null;
    }
    const pool = kind === 'cars' ? cars.map(carSrc) : kind === 'landmarks' ? marks.map(markSrc) : cars.map(carSrc).concat(marks.map(markSrc));
    const items = spreadPick(rng, pool, 7, kind === 'mixed' ? 5 : 3);
    const imgs = await Promise.all(items.map(x => x.get()));
    const ok = items.filter((x, i) => (x.img = imgs[i]));
    return ok.length >= 4 ? ok.slice(0, 4) : null;
  }

  async function outfitPool() {
    const lists = await Promise.all(outfitArts.map(a => Wiki.gallery(a.w)));
    const pool = [];
    lists.forEach((list, i) => {
      const a = outfitArts[i];
      list.forEach(img => {
        const exact = img.year && img.year >= a.f && img.year <= a.t;
        pool.push({ img, f: exact ? img.year : a.f, t: exact ? img.year : a.t, art: a });
      });
    });
    return pool;
  }
  const outfitRow = y => D.outfits.sheet.find(r => r[0] === decade(y) + 's') || [];
  function logoRange(list, i) {
    const l = list[i];
    if (l.to) return [l.from, l.to];
    const next = list.slice(i + 1).find(x => x.from > l.from);
    return [l.from, next ? next.from - 1 : null];
  }

  const MODES = {
    cars: {
      icon: '🚗', title: 'Cars', blurb: 'Date the car or name the model. In street scenes the newest car sets the earliest possible year.',
      types: [{ id: 'year', label: 'Launch year (slider)' }, { id: 'model', label: 'Name the model (4 choices)' }],
      filters: [{ id: 'all', label: 'All eras' }, { id: 'pre45', label: '1900–1945' }, { id: '45-80', label: '1945–1980' }, { id: '80-00', label: '1980–2000' }, { id: 'post00', label: '2000–today' }],
      async question(rng, s, weight) {
        const lim = { all: [0, 9999], pre45: [0, 1945], '45-80': [1945, 1980], '80-00': [1980, 2000], post00: [2000, 9999] }[s.filter || 'all'];
        const pool = cars.filter(c => c.f >= lim[0] && c.f < lim[1]);
        const c = weightedPick(rng, pool, x => weight('cars:' + x.w));
        const img = await Wiki.lead(c.w);
        if (!img) return null;
        const reveal = `<b>${esc(c.n)}</b> · built ${range(c.f, c.t)} · ${esc(c.r)}<br><span class="tell">${esc(c.tell)}</span>`;
        if (s.type === 'model') {
          const near = cars.filter(x => x !== c && Math.abs(x.f - c.f) <= 12);
          const opts = shuffle(rng, [c, ...shuffle(rng, near.length >= 3 ? near : cars.filter(x => x !== c)).slice(0, 3)]);
          return { key: 'cars:' + c.w, label: c.n, media: figure(img, 'a car'), img, prompt: 'Which model is this?', kind: 'choice', options: opts.map(o => ({ id: o.w, label: o.n })), answer: c.w, reveal };
        }
        return { key: 'cars:' + c.w, label: c.n, media: figure(img, 'a car'), img, prompt: 'When was this model launched?', kind: 'year', f: c.f, t: c.f, reveal };
      }
    },
    outfits: {
      icon: '👗', title: 'Outfits', blurb: 'Guess the year from clothes, hair and photo style. Fashion images by decade.',
      types: [{ id: 'year', label: 'Guess the year (slider)' }],
      async question(rng, s, weight) {
        const pool = await (this._pool || (this._pool = outfitPool()));
        if (!pool.length) { this._pool = null; return null; }
        const it = weightedPick(rng, pool, x => weight('outfits:' + x.img.file));
        const row = outfitRow(Math.round((it.f + it.t) / 2));
        const reveal = `<b>${it.f === it.t ? it.f : range(it.f, it.t)}</b> (${esc(it.art.w)})${it.img.desc ? `<br><span class="desc">${esc(it.img.desc)}</span>` : ''}${row.length ? `<br><span class="tell">Women: ${esc(row[1])}<br>Men: ${esc(row[2])}</span>` : ''}`;
        return { key: 'outfits:' + it.img.file, label: it.img.file.replace(/^File:/, ''), media: figure(it.img, 'historic fashion'), img: it.img, prompt: 'Which year is this outfit from?', kind: 'year', f: it.f, t: it.t, reveal };
      }
    },
    languages: {
      icon: '🔤', title: 'Languages', blurb: 'Read the signs and name the language: Spain vs Latin America, Portugal vs Brazil, Nordic, Cyrillic, Eastern Europe, Asia…',
      types: [{ id: 'lang', label: 'Which language? (4 choices)' }],
      filters: [{ id: 'all', label: 'All' }].concat(Object.entries(D.languages.groups).map(([id, label]) => ({ id, label }))),
      async question(rng, s, weight) {
        const pool = s.filter && s.filter !== 'all' ? langs.filter(l => l.g.includes(s.filter)) : langs;
        const l = weightedPick(rng, pool, x => weight('lang:' + x.id));
        const g = s.filter && s.filter !== 'all' ? s.filter : l.g[0];
        let others = shuffle(rng, langs.filter(x => x !== l && x.g.includes(g)));
        if (others.length < 3) others = others.concat(shuffle(rng, langs.filter(x => x !== l && !others.includes(x))));
        const opts = shuffle(rng, [l, ...others.slice(0, 3)]);
        // Prefer samples that no other language uses (e.g. 'Аптека' is Russian AND Ukrainian AND Bulgarian).
        const uniqueS = l.s.filter(t => !sampleOwners[t.toLowerCase()] || sampleOwners[t.toLowerCase()] === 1);
        const texts = shuffle(rng, uniqueS.length >= 3 ? uniqueS : l.s).slice(0, 3);
        const reveal = `<b>${esc(l.n)}</b> · ${esc(l.script)}<br><span class="tell">Unique: ${esc(l.uniq)}<br>Giveaways: ${esc(l.words)}<br>vs. others: ${esc(l.vs)}</span>`;
        return { key: 'lang:' + l.id, label: l.n, media: signs(texts, rng), prompt: 'Which language is this?', kind: 'choice', options: opts.map(o => ({ id: o.id, label: o.n })), answer: l.id, reveal };
      }
    },
    plates: {
      icon: '🚘', title: 'License plates', blurb: 'Which country is this plate from? Current and historic plates from Wikipedia.',
      types: [{ id: 'country', label: 'Which country? (4 choices)' }],
      filters: [{ id: 'all', label: 'All' }].concat(plateGroups.map(g => ({ id: g, label: g }))),
      async question(rng, s, weight) {
        const pool = s.filter && s.filter !== 'all' ? plates.filter(p => p.g === s.filter) : plates;
        const p = weightedPick(rng, pool, x => weight('plates:' + x.c));
        const gal = await Wiki.gallery(p.w, { allowSvg: true });
        if (!gal.length) return null;
        const img = pick(rng, gal);
        let others = shuffle(rng, plates.filter(x => x !== p && x.g === p.g));
        const opts = shuffle(rng, [p, ...others.slice(0, 3)]);
        const reveal = `<b>${esc(p.c)}</b>${img.year ? ` · image year ${img.year}` : ''}<br><span class="tell">Now: ${esc(p.now)}<br>${esc(p.tell)}</span>${img.desc ? `<br><span class="desc">${esc(img.desc)}</span>` : ''}`;
        return { key: 'plates:' + p.c, label: p.c, media: figure(img, 'license plate'), img, prompt: 'Which country is this plate from?', kind: 'choice', options: opts.map(o => ({ id: o.c, label: o.c })), answer: p.c, reveal };
      }
    },
    logos: {
      icon: '🥤', title: 'Logos & brands', blurb: 'When was this version of the logo in use? Coca-Cola, Pepsi, Shell, BP, VW, Apple…',
      types: [{ id: 'year', label: 'When was it in use? (slider)' }],
      async question(rng, s, weight) {
        const b = pick(rng, brands);
        const list = await Wiki.logos(b.b, b.cats);
        if (!list.length) return null;
        const i = list.indexOf(weightedPick(rng, list, x => weight('logos:' + x.file)));
        const l = list[i]; const [f, t] = logoRange(list, i);
        const tl = b.timeline.map(([y, txt]) => `<li${y <= (t || NOW) && y >= f - 1 ? ' class="hit"' : ''}><b>${y}</b> ${esc(txt)}</li>`).join('');
        const reveal = `<b>${esc(b.b)}</b>: this design ${range(f, t)}<ul class="timeline">${tl}</ul>`;
        return { key: 'logos:' + l.file, label: `${b.b} ${l.from}`, media: figure(l, b.b + ' logo').replace('class="media"', 'class="media logo"'), img: l, prompt: `When was this ${esc(b.b)} logo in use?`, kind: 'year', f, t: t == null ? NOW : t, reveal };
      }
    },
    landmarks: {
      icon: '🏙️', title: 'Landmarks', blurb: 'When was it finished? Towers, bridges and skylines tell you the earliest possible year of a photo.',
      types: [{ id: 'year', label: 'Year completed (slider)' }],
      filters: [{ id: 'all', label: 'All' }].concat(D.landmarks.regions.map(g => ({ id: g, label: g }))),
      async question(rng, s, weight) {
        const pool = s.filter && s.filter !== 'all' ? marks.filter(l => l.g === s.filter) : marks;
        const l = weightedPick(rng, pool, x => weight('landmarks:' + x.w));
        const img = await Wiki.lead(l.w);
        if (!img) return null;
        const reveal = `<b>${esc(l.n)}</b>, ${esc(l.city)} · completed ${l.y}${l.gone ? `, destroyed ${l.gone}` : ''}<br><span class="tell">${esc(l.tell)}</span>`;
        return { key: 'landmarks:' + l.w, label: l.n, media: figure(img, 'a landmark'), img, prompt: 'When was this completed?', kind: 'year', f: l.y, t: l.y, reveal };
      }
    },
    timeline: {
      icon: '📅', title: 'Timeline', noLearn: true, blurb: 'Put 4 pictures in order, oldest to newest. Trains the core skill: spotting which thing in a photo is the newest.',
      types: [{ id: 'mixed', label: 'Cars + landmarks' }, { id: 'cars', label: 'Cars only' }, { id: 'landmarks', label: 'Landmarks only' }, { id: 'logos', label: 'Logos of one brand' }],
      async question(rng, s) {
        const items = await timelineItems(rng, s.type || 'mixed');
        if (!items) return null;
        const sorted = items.slice().sort((a, b) => a.year - b.year);
        const reveal = `<ol class="timeline">${sorted.map(x => `<li><b>${x.year}</b> ${esc(x.label)} <small>(${x.what})</small></li>`).join('')}</ol>`;
        return { key: null, label: 'Timeline: ' + sorted.map(x => x.year).join(' → '), items, prompt: 'Click them from oldest to newest', kind: 'order', reveal };
      }
    },
    gauntlet: {
      icon: '🏆', title: 'Gauntlet (mixed)', noLearn: true, blurb: 'Everything mixed like a real round: cars, outfits, landmarks, logos, plates and languages.',
      types: [{ id: 'mix', label: 'Mixed' }],
      async question(rng, s, weight) {
        const m = pick(rng, ['cars', 'cars', 'outfits', 'outfits', 'landmarks', 'logos', 'plates', 'languages']);
        const type = { cars: rng() < 0.6 ? 'year' : 'model', outfits: 'year', landmarks: 'year', logos: 'year', plates: 'country', languages: 'lang' }[m];
        const q = await MODES[m].question.call(MODES[m], rng, { type, filter: 'all' }, missWeight(m));
        if (q) q.sub = m;
        return q;
      }
    }
  };

  /* ------------------------------------------------------------ views */
  function setNav(id) { $$('header nav a').forEach(a => a.classList.toggle('on', a.dataset.nav === id)); }

  function viewHome() {
    setNav('home');
    const st = stats();
    const card = (id) => {
      const m = MODES[id]; const ms = st.modes[id];
      const avg = ms && ms.rounds ? Math.round(ms.pts / ms.rounds) : null;
      return `<a class="card mode" href="#/mode/${id}"><div class="icon">${m.icon}</div><h3>${m.title}</h3><p>${m.blurb}</p>
        <div class="meta">${ms ? `${ms.rounds} rounds · avg ${avg}` : 'not played yet'}</div></a>`;
    };
    app.innerHTML = `
      <section class="hero">
        <h1>Train for TimeGuessr 2v2 ranked</h1>
        <p>Picture-first drills for the things that win rounds: <b>cars</b>, <b>outfits</b>, <b>landmarks</b>, <b>signage languages</b>, <b>license plates</b> and <b>logo changes</b>.
        Every mode has a <a href="#/sheets">cheat sheet</a> (also as <a href="TimeTrainer_Cheatsheets.xlsx">Excel file</a>). Your misses come back more often.</p>
        <p class="sub">Playing with a teammate? Start a mode, press <b>Challenge link</b> and send it. You both get the same rounds and can compare scores.</p>
      </section>
      <div class="grid modes">${Object.keys(MODES).map(card).join('')}
        <a class="card mode" href="#/sheets/general"><div class="icon">🕰️</div><h3>Era tells</h3><p>The baseline: photo quality, phones, streetlights, landmarks, historical events.</p><div class="meta">cheat sheet</div></a>
      </div>`;
  }

  function viewMode(id) {
    const m = MODES[id]; if (!m) return viewHome();
    setNav('home');
    const last = store.get('tt_last_' + id, {});
    const sel = (name, list, cur) => `<label>${name}<select name="${name.toLowerCase()}">${list.map(o => `<option value="${o.id}"${o.id === cur ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`;
    app.innerHTML = `
      <section class="panel">
        <div class="crumb"><a href="#/">Train</a> / ${m.title}</div>
        <h1>${m.icon} ${m.title}</h1>
        <p>${m.blurb}</p>
        <p class="sub">${esc((D[id] && D[id].about) || '')}</p>
        <form id="setup" class="setup">
          ${sel('Type', m.types, last.type)}
          ${m.filters ? sel('Filter', m.filters, last.filter) : ''}
          ${sel('Rounds', [{ id: '5', label: '5' }, { id: '10', label: '10' }, { id: '20', label: '20' }, { id: '0', label: 'Endless' }], last.rounds || '10')}
          ${sel('Timer', [{ id: '0', label: 'No time limit' }, { id: '60', label: '60 s per round' }, { id: '30', label: '30 s per round' }, { id: '15', label: '15 s per round (blitz)' }], last.timer || '0')}
          <div class="row">
            <button class="btn primary" type="submit">Start ▶</button>
            <button class="btn" type="button" id="challenge">Challenge link 🔗</button>
            ${!m.noLearn ? `<a class="btn ghost" href="#/learn/${id}">Learn gallery</a><a class="btn ghost" href="#/sheets/${id}">Cheat sheet</a>` : ''}
          </div>
        </form>
      </section>`;
    const params = () => { const f = new FormData($('#setup')); const o = { type: f.get('type'), filter: f.get('filter') || 'all', rounds: f.get('rounds'), timer: f.get('timer') || '0' }; store.set('tt_last_' + id, o); return o; };
    const qs = (p, n) => `type=${p.type}&filter=${encodeURIComponent(p.filter)}&n=${n}${+p.timer ? '&t=' + p.timer : ''}`;
    $('#setup').onsubmit = e => { e.preventDefault(); const p = params(); location.hash = `#/play/${id}?${qs(p, p.rounds)}`; };
    $('#challenge').onclick = () => {
      const p = params(); const seed = Math.random().toString(36).slice(2, 8);
      const url = location.href.split('#')[0] + `#/play/${id}?${qs(p, p.rounds === '0' ? 10 : p.rounds)}&seed=${seed}`;
      copyText(url);
      toast('Challenge link copied: send it to your teammate');
    };
  }

  /* ---------------- play ---------------- */
  let game = null;
  async function viewPlay(id, q) {
    const m = MODES[id]; if (!m) return viewHome();
    setNav('home');
    const n = +(q.get('n') || 10);
    const seed = q.get('seed');
    game = { id, m, n, seed, limit: +(q.get('t') || 0), rng: rngFrom(seed || Math.random()), s: { type: q.get('type') || m.types[0].id, filter: q.get('filter') || 'all' }, round: 0, total: 0, log: [], token: Symbol() };
    game.weight = seed ? () => 1 : missWeight(id);
    nextRound();
  }
  function hud(g, q, clock = true) {
    return `<div class="hud"><span>${g.m.icon} ${g.m.title}${q && q.sub ? ' · ' + MODES[q.sub].title : ''}${g.seed ? ` · <span class="pill">challenge ${esc(g.seed)}</span>` : ''}</span>
      <span>${g.limit && clock ? `<span class="clock" id="clock">⏱ ${g.limit}s</span> ` : ''}<span id="score">Round ${g.round}${g.n ? '/' + g.n : ''} · <b>${g.total}</b> pts</span></span></div>`;
  }
  const preload = src => new Promise(res => { const im = new Image(); im.onload = im.onerror = res; im.src = src; setTimeout(res, 4000); });
  async function nextRound() {
    const g = game; const tok = g.token;
    clearInterval(g.timerId);
    if (g.n && g.round >= g.n) return endGame();
    g.round++;
    app.innerHTML = `<section class="play">${hud(g, null, false)}<div class="loading">Loading picture…</div></section>`;
    let qn = null;
    for (let i = 0; i < 10 && !qn; i++) {
      try { qn = await g.m.question.call(g.m, g.rng, g.s, g.weight); } catch (e) { console.warn(e); }
      if (tok !== game.token) return;
    }
    if (!qn) { app.innerHTML = `<section class="panel"><h2>Couldn't load pictures</h2><p>The Wikipedia image API didn't answer. Check your connection (or an ad/privacy blocker blocking wikipedia.org) and try again.</p><a class="btn" href="#/mode/${g.id}">Back</a></section>`; return; }
    const srcs = qn.items ? qn.items.map(x => x.img.src) : qn.img ? [qn.img.src] : [];
    await Promise.all(srcs.map(preload));
    if (tok !== game.token) return;
    g.q = qn;
    renderQuestion();
  }
  function renderQuestion() {
    const g = game, q = g.q;
    let answerUi = '', stage = `<div class="stage">${q.media}</div>`;
    if (q.kind === 'year') answerUi = `<div class="yearpick">
          <div class="yearval" id="yv">${g.lastGuess || 1970}</div>
          <input type="range" id="yr" min="${MIN_YEAR}" max="${NOW}" value="${g.lastGuess || 1970}">
          <div class="row center"><button class="btn sm" data-d="-10">−10</button><button class="btn sm" data-d="-1">−1</button><button class="btn sm" data-d="1">+1</button><button class="btn sm" data-d="10">+10</button></div>
          <div class="decades">${Array.from({ length: Math.floor((NOW - MIN_YEAR) / 10) + 1 }, (_, i) => MIN_YEAR + i * 10).map(d => `<button class="chip" data-y="${d + 5}">${d}s</button>`).join('')}</div>
          <button class="btn primary big" id="go">Guess ⏎</button></div>`;
    else if (q.kind === 'order') {
      stage = `<div class="ogrid">${q.items.map((x, i) => `<button class="ocard${x.logo ? ' logo' : ''}" data-i="${i}"><img src="${esc(x.img.src)}" alt="picture ${i + 1}"><kbd>${i + 1}</kbd><span class="rank"></span><span class="olab"></span></button>`).join('')}</div>`;
      answerUi = `<div class="row center"><button class="btn ghost" id="undo">Undo</button><button class="btn primary big" id="go" disabled>Check order ⏎</button></div>`;
    } else answerUi = `<div class="choices">${q.options.map((o, i) => `<button class="btn choice" data-id="${esc(o.id)}"><kbd>${i + 1}</kbd> ${esc(o.label)}</button>`).join('')}</div>`;
    $('.play').innerHTML = `${hud(g, q)}${stage}
      <h2 class="prompt">${q.prompt}</h2>
      <div id="answer">${answerUi}</div>
      <div id="reveal"></div>`;
    if (q.kind === 'year') {
      const yr = $('#yr'), yv = $('#yv');
      const set = v => { v = Math.max(MIN_YEAR, Math.min(NOW, v)); yr.value = v; yv.textContent = v; };
      yr.oninput = () => set(+yr.value);
      $$('[data-d]').forEach(b => b.onclick = () => set(+yr.value + +b.dataset.d));
      $$('[data-y]').forEach(b => b.onclick = () => set(+b.dataset.y));
      $('#go').onclick = () => answer(+yr.value);
      yr.focus();
    } else if (q.kind === 'order') {
      g.order = [];
      const paint = () => {
        $$('.ocard').forEach(b => { const r = g.order.indexOf(+b.dataset.i); b.classList.toggle('picked', r >= 0); b.querySelector('.rank').textContent = r >= 0 ? r + 1 : ''; });
        $('#go').disabled = g.order.length < q.items.length;
      };
      $$('.ocard').forEach(b => b.onclick = () => {
        if (g.answered === g.round) return;
        const i = +b.dataset.i, r = g.order.indexOf(i);
        if (r >= 0) g.order.splice(r); // un-pick this card and everything after it
        else {
          g.order.push(i);
          if (g.order.length === q.items.length - 1) g.order.push(q.items.findIndex((_, k) => !g.order.includes(k))); // last one is forced
        }
        paint();
      });
      $('#undo').onclick = () => { if (g.answered !== g.round) { g.order.pop(); paint(); } };
      $('#go').onclick = () => answer(g.order.slice());
    } else {
      $$('.choice').forEach(b => b.onclick = () => answer(b.dataset.id));
    }
    if (g.limit) startClock(g);
  }
  function startClock(g) {
    let left = g.limit; const round = g.round;
    clearInterval(g.timerId);
    g.timerId = setInterval(() => {
      const el = $('#clock');
      if (game !== g || g.round !== round || g.answered === round || !el) return clearInterval(g.timerId);
      left--; el.textContent = `⏱ ${left}s`; el.classList.toggle('low', left <= 5);
      if (left > 0) return;
      clearInterval(g.timerId);
      const q = g.q;
      if (q.kind === 'year') answer(+$('#yr').value, true);
      else if (q.kind === 'order') answer(g.order.concat(q.items.map((_, i) => i).filter(i => !g.order.includes(i))), true);
      else answer(null, true);
    }, 1000);
  }
  function answer(val, timedOut) {
    const g = game, q = g.q; if (g.answered === g.round) return; g.answered = g.round;
    clearInterval(g.timerId);
    let pts, verdict;
    if (q.kind === 'year') {
      g.lastGuess = val;
      const r = yearScore(val, q.f, q.t); pts = r.pts;
      verdict = r.off === 0 ? `Spot on: <b>${val}</b>` : `You said <b>${val}</b>, ${r.off} year${r.off === 1 ? '' : 's'} off`;
      $('#answer').innerHTML = `<div class="yearline">${yearLine(val, q.f, q.t)}</div>`;
    } else if (q.kind === 'order') {
      // Score = share of pairs that are in the right relative order.
      let good = 0, all = 0;
      for (let a = 0; a < val.length; a++) for (let b = a + 1; b < val.length; b++) { all++; if (q.items[val[a]].year < q.items[val[b]].year) good++; }
      pts = Math.round(1000 * good / all);
      verdict = pts === 1000 ? 'Perfect order!' : `${good} of ${all} pairs in the right order`;
      const truth = q.items.map((x, i) => i).sort((a, b) => q.items[a].year - q.items[b].year);
      $$('.ocard').forEach(b => {
        const i = +b.dataset.i, mine = val.indexOf(i), right = truth.indexOf(i), x = q.items[i];
        b.disabled = true; b.classList.remove('picked'); b.classList.add(mine === right ? 'right' : 'wrong');
        b.querySelector('.rank').textContent = mine === right ? right + 1 : `${mine + 1}→${right + 1}`;
        b.querySelector('.olab').innerHTML = `<b>${x.year}</b> ${esc(x.label)}`;
      });
      $('#answer').innerHTML = '';
    } else {
      pts = val === q.answer ? 1000 : 0;
      verdict = pts ? 'Correct!' : 'Not quite';
      $$('.choice').forEach(b => { b.disabled = true; if (b.dataset.id === q.answer) b.classList.add('right'); else if (b.dataset.id === val) b.classList.add('wrong'); });
    }
    if (timedOut) verdict = `⏱ Time's up. ${verdict}`;
    g.total += pts;
    g.log.push({ label: q.label, pts, sub: q.sub });
    recordRound(q.sub || g.id, q.key, q.label, pts);
    $('#score').innerHTML = `Round ${g.round}${g.n ? '/' + g.n : ''} · <b>${g.total}</b> pts`;
    const credits = q.items ? `<div class="credits">${q.items.map(x => credit(x.img)).join('')}</div>` : credit(q.img);
    $('#reveal').innerHTML = `<div class="reveal ${pts >= 900 ? 'good' : pts >= 400 ? 'ok' : 'bad'}">
        <div class="verdict">${verdict} <span class="pts">+${pts}</span></div>
        <div class="explain">${q.reveal}</div>${credits}
        <div class="row"><button class="btn primary" id="next">${g.n && g.round >= g.n ? 'Results' : 'Next'} ⏎</button><a class="btn ghost" href="#/mode/${g.id}">Quit</a></div></div>`;
    $('#next').onclick = nextRound;
    $('#next').focus();
  }
  function yearLine(guess, f, t) {
    const pos = y => ((y - MIN_YEAR) / (NOW - MIN_YEAR) * 100).toFixed(2) + '%';
    const hi = t == null ? NOW : t;
    return `<div class="track"><div class="band" style="left:${pos(f)};width:calc(${pos(hi)} - ${pos(f)} + 4px)"></div><div class="mark guess" style="left:${pos(guess)}"><span>${guess}</span></div><div class="mark truth" style="left:${pos(f)}"><span>${f === hi ? f : f + '–' + (t == null ? 'now' : hi)}</span></div></div><div class="axis">${[1900, 1925, 1950, 1975, 2000].map(y => `<span style="left:${pos(y)}">${y}</span>`).join('')}<span style="left:100%">${NOW}</span></div>`;
  }
  function endGame() {
    const g = game; const max = g.log.length * 1000;
    const text = `TimeTrainer · ${g.m.title}${g.seed ? ' · challenge ' + g.seed : ''}: ${g.total}/${max} pts (${g.log.filter(l => l.pts >= 900).length}/${g.log.length} perfect)`;
    recordGame({ mode: g.id, pts: g.total, max, seed: g.seed || null, at: Date.now() });
    app.innerHTML = `<section class="panel">
      <h1>${g.m.icon} ${g.total} <small>/ ${max}</small></h1>
      <p>${g.log.filter(l => l.pts >= 900).length} of ${g.log.length} spot on.</p>
      <ol class="results">${g.log.map(l => `<li class="${l.pts >= 900 ? 'good' : l.pts >= 400 ? 'ok' : 'bad'}"><span>${esc(l.label)}</span><b>${l.pts}</b></li>`).join('')}</ol>
      <div class="row"><button class="btn" id="share">Copy result</button><button class="btn primary" id="again">Play again</button><a class="btn ghost" href="#/mode/${g.id}">Settings</a>${!g.m.noLearn ? `<a class="btn ghost" href="#/sheets/${g.id}">Cheat sheet</a>` : ''}</div></section>`;
    $('#share').onclick = () => copyText(text + (g.seed ? '\n' + location.href : ''));
    $('#again').onclick = () => { const q = new URLSearchParams(location.hash.split('?')[1] || ''); q.delete('seed'); location.hash = `#/play/${g.id}?${q}&r=${Date.now() % 1e5}`; };
  }
  document.addEventListener('keydown', e => {
    if (!game || !$('.play')) return;
    if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
    if (e.key === 'Enter') { const n = $('#next'); if (n) { e.preventDefault(); n.click(); } else if ($('#go')) { e.preventDefault(); $('#go').click(); } }
    if (/^[1-4]$/.test(e.key)) { const b = $$('.choice, .ocard')[+e.key - 1]; if (b && !b.disabled) b.click(); }
    if (e.key === 'Backspace' && $('#undo')) { e.preventDefault(); $('#undo').click(); }
  });

  /* ---------------- learn galleries ---------------- */
  const lazyObs = 'IntersectionObserver' in window ? new IntersectionObserver(ents => ents.forEach(en => { if (en.isIntersecting) { lazyObs.unobserve(en.target); en.target._load(); } }), { rootMargin: '400px' }) : null;
  function lazy(el, fn) { el._load = fn; lazyObs ? lazyObs.observe(el) : fn(); }

  function viewLearn(id) {
    setNav('home');
    const head = (t, extra = '') => `<div class="crumb"><a href="#/">Train</a> / <a href="#/mode/${id}">${MODES[id].title}</a> / Learn</div><h1>${MODES[id].icon} ${t}</h1>${extra}`;
    if (id === 'cars') {
      const decs = [...new Set(cars.map(c => decade(c.f)))].sort((a, b) => a - b);
      app.innerHTML = `<section>${head('Car gallery', `<p class="sub">Sorted by launch year. Hover/tap a card for the tell. ${D.cars.about}</p>`)}
        <div class="chips">${decs.map(d => `<a class="chip" href="#dec${d}" onclick="document.getElementById('dec${d}').scrollIntoView({behavior:'smooth'});return false">${d}s</a>`).join('')}</div>
        ${decs.map(d => `<h2 id="dec${d}" class="dechead">${d}s</h2><div class="grid gallery">${cars.filter(c => decade(c.f) === d).sort((a, b) => a.f - b.f).map(c => `<div class="card pic" data-w="${esc(c.w)}"><div class="ph"></div><div class="cap"><b>${esc(c.n)}</b><span>${range(c.f, c.t)} · ${esc(c.r)}</span><em>${esc(c.tell)}</em></div></div>`).join('')}</div>`).join('')}</section>`;
      $$('.pic[data-w]').forEach(el => lazy(el, async () => { const img = await Wiki.lead(el.dataset.w); el.querySelector('.ph').outerHTML = img ? `<img src="${esc(img.src)}" alt="" loading="lazy">` : '<div class="ph none">no image</div>'; }));
    } else if (id === 'landmarks') {
      app.innerHTML = `<section>${head('Landmarks', `<p class="sub">${esc(D.landmarks.about)}</p>`)}
        ${D.landmarks.regions.map(g => `<h2 class="dechead">${esc(g)}</h2><div class="grid gallery">${marks.filter(l => l.g === g).sort((a, b) => a.y - b.y).map(l => `<div class="card pic" data-w="${esc(l.w)}"><div class="ph"></div><div class="cap"><b>${esc(l.n)}</b><span>${markRange(l)} · ${esc(l.city)}</span><em>${esc(l.tell)}</em></div></div>`).join('')}</div>`).join('')}</section>`;
      $$('.pic[data-w]').forEach(el => lazy(el, async () => { const img = await Wiki.lead(el.dataset.w); el.querySelector('.ph').outerHTML = img ? `<img src="${esc(img.src)}" alt="" loading="lazy">` : '<div class="ph none">no image</div>'; }));
    } else if (id === 'outfits') {
      app.innerHTML = `<section>${head('Fashion by decade', `<p class="sub">${D.outfits.about}</p>`)}
        ${outfitArts.map(a => { const rows = D.outfits.sheet.filter(r => { const d = parseInt(r[0], 10); return d >= decade(a.f) && d <= a.t; }); return `<h2 class="dechead">${range(a.f, a.t)}</h2>${rows.map(row => `<p class="tell"><b>${esc(row[0])} women:</b> ${esc(row[1])}<br><b>Men:</b> ${esc(row[2])}<br><b>Quick tell:</b> ${esc(row[3])}</p>`).join('')}<div class="grid gallery small" data-art="${esc(a.w)}"><div class="loading">Loading…</div></div>`; }).join('')}</section>`;
      $$('[data-art]').forEach(el => lazy(el, async () => {
        const list = await Wiki.gallery(el.dataset.art);
        el.innerHTML = list.map(img => `<a class="card pic" href="${esc(Wiki.fileUrl(img.file))}" target="_blank" rel="noopener"><img src="${esc(img.src)}" alt="" loading="lazy"><div class="cap">${img.year ? `<b>${img.year}</b>` : ''}<em>${esc(img.desc || img.file.replace(/^File:/, ''))}</em></div></a>`).join('') || '<p class="sub">No images found.</p>';
      }));
    } else if (id === 'plates') {
      app.innerHTML = `<section>${head('Plates by country', `<p class="sub">${D.plates.about}</p>`)}
        ${plateGroups.map(gr => `<h2 class="dechead">${esc(gr)}</h2><div class="grid plates">${plates.filter(p => p.g === gr).map(p => `<div class="card plate" data-w="${esc(p.w)}"><h3>${esc(p.c)}</h3><p class="now">${esc(p.now)}</p><p class="tell">${esc(p.tell)}</p><div class="strip"><div class="loading">…</div></div></div>`).join('')}</div>`).join('')}</section>`;
      $$('.plate[data-w]').forEach(el => lazy(el, async () => {
        const list = await Wiki.gallery(el.dataset.w, { allowSvg: true });
        el.querySelector('.strip').innerHTML = list.slice(0, 8).map(img => `<a href="${esc(Wiki.fileUrl(img.file))}" target="_blank" rel="noopener" title="${esc(img.desc || img.file)}"><img src="${esc(img.src)}" alt="" loading="lazy">${img.year ? `<span>${img.year}</span>` : ''}</a>`).join('') || '<span class="sub">no images</span>';
      }));
    } else if (id === 'logos') {
      app.innerHTML = `<section>${head('Logo timelines', `<p class="sub">${D.logos.about}</p>`)}
        ${brands.map(b => `<div class="card brand" data-b="${esc(b.b)}"><h3>${esc(b.b)}</h3><div class="strip logos"><div class="loading">…</div></div><ul class="timeline">${b.timeline.map(([y, t]) => `<li><b>${y}</b> ${esc(t)}</li>`).join('')}</ul></div>`).join('')}</section>`;
      $$('.brand[data-b]').forEach(el => lazy(el, async () => {
        const b = brands.find(x => x.b === el.dataset.b);
        const list = await Wiki.logos(b.b, b.cats);
        el.querySelector('.strip').innerHTML = list.map((l, i) => { const [f, t] = logoRange(list, i); return `<a href="${esc(Wiki.fileUrl(l.file))}" target="_blank" rel="noopener" title="${esc(l.file)}"><img src="${esc(l.src)}" alt="" loading="lazy"><span>${range(f, t)}</span></a>`; }).join('') || '<span class="sub">no historic logo files found on Commons, use the timeline</span>';
      }));
    } else if (id === 'languages') {
      const rng = rngFrom('learn');
      app.innerHTML = `<section>${head('Languages & scripts', `<p class="sub">${D.languages.about}</p>`)}
        ${Object.entries(D.languages.groups).map(([g, label]) => `<h2 class="dechead">${esc(label)}</h2><div class="grid langs">${langs.filter(l => l.g[0] === g).map(l => `<div class="card lang"><h3>${esc(l.n)} <small>${esc(l.script)}</small></h3>${signs(l.s.slice(0, 4), rng)}<p><b>Unique:</b> ${esc(l.uniq)}</p><p><b>Giveaways:</b> ${esc(l.words)}</p><p><b>Don't confuse:</b> ${esc(l.vs)}</p></div>`).join('')}</div>`).join('')}</section>`;
    } else viewHome();
  }

  /* ---------------- cheat sheets ----------------
   * Each sheet is a list of sections. A section is shown as cards (one per group) and
   * keeps a flat table (cols/rows) for the CSV download. A fact is
   * { tag, h, sub, body, kv: [[label, text]], note }. */
  function sheetSections(id) {
    switch (id) {
      case 'general': {
        const icons = { Photo: '📷', People: '🧍', Street: '🛣️', Tech: '📺', History: '📜', Architecture: '🏛️' };
        return [
          { title: 'Work through a photo like this', cols: ['#', 'Tip'], rows: D.general.baseline_tips.map((t, i) => [i + 1, t]), one: true,
            groups: [{ ordered: true, items: D.general.baseline_tips.map(t => ({ body: t })) }] },
          { title: 'Era tells', cols: ['Category', 'Clue', 'Period'], rows: D.general.sheet,
            groups: groupBy(D.general.sheet, r => r[0]).map(([name, rs]) => ({ name: `${icons[name] || ''} ${name}`, items: rs.map(r => ({ tag: r[2], body: r[1] })) })) },
          { title: 'Objects that date a photo', cols: ['Clue', 'Year', 'Note'], rows: D.logos.sheet_extra,
            groups: [{ name: 'Not before…', items: D.logos.sheet_extra.slice().sort((a, b) => a[1] - b[1]).map(r => ({ tag: r[1], h: r[0], body: r[2] })) }] }];
      }
      case 'cars': return [
        { title: 'Car shapes by era', cols: ['Era', 'What to look for', 'Typical models'], rows: D.cars.sheet,
          groups: D.cars.sheet.map(r => ({ name: r[0], items: [({ body: r[1], note: 'e.g. ' + r[2] })] })) },
        { title: 'Models by launch decade', cols: ['Model', 'From', 'To', 'Region', 'Tell'], rows: cars.slice().sort((a, b) => a.f - b.f).map(c => [c.n, c.f, c.t == null ? 'today' : c.t, c.r, c.tell]),
          groups: groupBy(cars.slice().sort((a, b) => a.f - b.f), c => decade(c.f)).map(([d, cs]) => ({ name: `${d}s`, items: cs.map(c => ({ tag: range(c.f, c.t), h: c.n, sub: c.r, body: c.tell })) })) }];
      case 'outfits': return [
        { title: 'Fashion by decade', cols: ['Decade', 'Women', 'Men', 'Quick tell'], rows: D.outfits.sheet,
          groups: D.outfits.sheet.map(r => ({ name: r[0], lead: r[3], items: [({ kv: [['Women', r[1]], ['Men', r[2]]] })] })) }];
      case 'languages': return [
        { title: 'Languages & scripts', cols: ['Language', 'Script', 'Unique letters', 'Giveaway words', "Don't confuse with"], rows: langs.map(l => [l.n, l.script, l.uniq, l.words, l.vs]),
          groups: Object.entries(D.languages.groups).map(([g, label]) => ({ name: label, items: langs.filter(l => l.g[0] === g).map(l => ({ h: l.n, sub: l.script, kv: [['Letters', l.uniq], ['Words', l.words], ['Not', l.vs]] })) })) }];
      case 'plates': return [
        { title: 'License plates', cols: ['Country', 'Region', 'Current format', 'Tells & history'], rows: plates.map(p => [p.c, p.g, p.now, p.tell]),
          groups: plateGroups.map(gr => ({ name: gr, items: plates.filter(p => p.g === gr).map(p => ({ h: p.c, kv: [['Now', p.now]], body: p.tell })) })) }];
      case 'logos': return [
        { title: 'Logo changes', cols: ['Brand', 'Year', 'Change'], rows: brands.flatMap(b => b.timeline.map(([y, t]) => [b.b, y, t])),
          groups: brands.map(b => ({ name: b.b, items: b.timeline.map(([y, t]) => ({ tag: y, body: t })) })) }];
      case 'landmarks': return [
        { title: 'Landmarks: not before…', cols: ['Landmark', 'City', 'Region', 'Completed', 'Gone', 'Tell'], rows: marks.map(l => [l.n, l.city, l.g, l.y, l.gone || '', l.tell]),
          groups: D.landmarks.regions.map(g => ({ name: g, items: marks.filter(l => l.g === g).sort((a, b) => a.y - b.y).map(l => ({ tag: markRange(l), h: l.n, sub: l.city, body: l.tell })) })) },
        { title: 'By decade', cols: ['Decade', 'Landmarks'], rows: groupBy(marks.slice().sort((a, b) => a.y - b.y), l => decade(l.y)).map(([d, ls]) => [`${d}s`, ls.map(l => `${l.n} ${l.y}`).join(', ')]),
          groups: groupBy(marks.slice().sort((a, b) => a.y - b.y), l => decade(l.y)).map(([d, ls]) => ({ name: `${d}s`, items: [({ body: ls.map(l => `${l.n} (${l.y})`).join(' · ') })] })) }];
    }
    return [];
  }
  function renderFact(f) {
    return `<li class="fact">${f.tag != null ? `<span class="tag">${esc(f.tag)}</span>` : ''}${f.h ? `<b>${esc(f.h)}</b>${f.sub ? ` <small>${esc(f.sub)}</small>` : ''}${f.body || f.kv ? '<br>' : ''}` : ''}${f.body ? `<span>${esc(f.body)}</span>` : ''}${(f.kv || []).map(([k, v]) => `<div class="kv"><span>${esc(k)}</span>${esc(v)}</div>`).join('')}${f.note ? `<div class="note">${esc(f.note)}</div>` : ''}</li>`;
  }
  const SHEET_TABS = [['general', '🕰️ Era tells'], ['cars', '🚗 Cars'], ['outfits', '👗 Outfits'], ['landmarks', '🏙️ Landmarks'], ['languages', '🔤 Languages'], ['plates', '🚘 Plates'], ['logos', '🥤 Logos']];
  function viewSheets(id) {
    setNav('sheets');
    if (!SHEET_TABS.some(([k]) => k === id)) id = 'general';
    const secs = sheetSections(id);
    const about = (D[id] && D[id].about) || '';
    app.innerHTML = `<section class="sheets">
      <h1>Cheat sheets</h1>
      <div class="tabs">${SHEET_TABS.map(([k, l]) => `<a class="tab${k === id ? ' on' : ''}" href="#/sheets/${k}">${l}</a>`).join('')}</div>
      ${about ? `<p class="sub about">${esc(about)}</p>` : ''}
      <div class="sheettools"><input class="search" id="flt" placeholder="Filter… (e.g. 1970, Japan, chrome)"><button class="btn sm" id="print">Print</button><a class="btn sm ghost" href="TimeTrainer_Cheatsheets.xlsx">Excel ⬇</a></div>
      ${secs.map((t, i) => `<section class="sheet" data-sec>
        <div class="sheethead"><h2>${esc(t.title)}</h2><button class="btn sm ghost" data-csv="${i}">CSV ⬇</button></div>
        <div class="sgroups${t.one ? ' one' : ''}">${t.groups.map(g => `<div class="sgroup" data-g>
          ${g.name ? `<h3>${esc(g.name)}</h3>` : ''}${g.lead ? `<p class="lead">${esc(g.lead)}</p>` : ''}
          <${g.ordered ? 'ol' : 'ul'} class="facts">${g.items.map(renderFact).join('')}</${g.ordered ? 'ol' : 'ul'}></div>`).join('')}</div></section>`).join('')}
      <p class="sub empty" id="none" hidden>Nothing matches.</p>
    </section>`;
    $$('[data-csv]').forEach(b => b.onclick = () => { const t = secs[+b.dataset.csv]; download(`timetrainer-${id}-${t.title.toLowerCase().replace(/\W+/g, '-').replace(/-$/, '')}.csv`, '﻿' + [t.cols, ...t.rows].map(r => r.map(csvCell).join(',')).join('\n'), 'text/csv'); });
    $('#print').onclick = () => window.print();
    $('#flt').oninput = e => {
      const v = e.target.value.trim().toLowerCase(); let any = false;
      $$('[data-sec]').forEach(sec => {
        let secAny = false;
        $$('[data-g]', sec).forEach(gr => {
          const head = (($('h3', gr) || {}).textContent || '') + ' ' + (($('.lead', gr) || {}).textContent || '');
          const whole = !v || head.toLowerCase().includes(v);
          let n = 0;
          $$('.fact', gr).forEach(li => { const show = whole || li.textContent.toLowerCase().includes(v); li.hidden = !show; n += show; });
          gr.hidden = !n; secAny = secAny || n > 0;
        });
        sec.hidden = !secAny; any = any || secAny;
      });
      $('#none').hidden = any;
    };
  }

  /* ---------------- progress ---------------- */
  function viewStats() {
    setNav('stats');
    const s = stats();
    const ids = [...new Set([...Object.keys(MODES), ...Object.keys(s.modes)])].filter(k => s.modes[k]);
    app.innerHTML = `<section>
      <h1>📈 Progress</h1>
      ${ids.length ? `<div class="grid statgrid">${ids.map(k => { const m = s.modes[k]; return `<div class="card"><h3>${(MODES[k] || {}).icon || ''} ${(MODES[k] || { title: k }).title}</h3><div class="big">${Math.round(m.pts / m.rounds)}</div><p>avg points over ${m.rounds} rounds · ${Math.round(100 * m.perfect / m.rounds)}% spot on</p>
        ${Object.keys(m.miss).length ? `<p><b>Weak spots</b> (come up more often):</p><ul class="weak">${Object.entries(m.miss).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([key, n]) => `<li>${esc(m.labels[key] || key)} <small>×${n}</small></li>`).join('')}</ul>` : '<p class="sub">No weak spots right now.</p>'}</div>`; }).join('')}</div>` : '<p>No rounds played yet. <a href="#/">Start training</a>.</p>'}
      ${s.games.length ? `<h2>Recent games</h2><table class="mini"><tbody>${s.games.slice(0, 15).map(g => `<tr><td>${new Date(g.at).toLocaleString()}</td><td>${(MODES[g.mode] || { title: g.mode }).title}</td><td>${g.pts}/${g.max}</td><td>${g.seed ? 'challenge ' + esc(g.seed) : ''}</td></tr>`).join('')}</tbody></table>` : ''}
      <div class="row"><button class="btn ghost" id="reset">Reset progress</button><button class="btn ghost" id="cache">Clear image cache (${Wiki.cacheSize()})</button></div>
    </section>`;
    $('#reset').onclick = () => { if (confirm('Reset all progress?')) { store.set(STATS, { modes: {}, games: [] }); viewStats(); } };
    $('#cache').onclick = () => { Wiki.clearCache(); toast('Image cache cleared'); viewStats(); };
  }

  /* ------------------------------------------------------------ router */
  function route() {
    if (game) { game.token = Symbol(); clearInterval(game.timerId); } // cancel pending loads and the round timer
    const [path, qs] = (location.hash.slice(1) || '/').split('?');
    const parts = path.split('/').filter(Boolean);
    const q = new URLSearchParams(qs || '');
    window.scrollTo(0, 0);
    switch (parts[0]) {
      case 'mode': return viewMode(parts[1]);
      case 'play': return viewPlay(parts[1], q);
      case 'learn': return viewLearn(parts[1]);
      case 'sheets': return viewSheets(parts[1]);
      case 'stats': return viewStats();
      default: game = null; return viewHome();
    }
  }
  window.addEventListener('hashchange', route);
  route();
})();
