'use strict';
/* Versa (Sóstenes Rondena): complete song lyrics while the YouTube video plays. */

/* ================= utils ================= */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const decode = s => { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; };
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } }
};
const wait = ms => new Promise(r => setTimeout(r, ms));
const isTouch = matchMedia('(pointer: coarse)').matches;
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
const thumb = id => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
const fmt = t => { const m = Math.floor(t / 60), s = (t - m * 60).toFixed(2).padStart(5, '0'); return `${String(m).padStart(2, '0')}:${s}`; };
const fmtDur = t => t > 0 ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` : '';
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0;[a[i], a[j]] = [a[j], a[i]]; } return a; };
const uid = () => Math.random().toString(36).slice(2, 9);
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2200); }
const icon = (name, cls = '') => `<svg class="${cls}"><use href="#i-${name}"/></svg>`;

/* ================= settings & library ================= */
const settings = Object.assign(
  { pace: 'pause', difficulty: 'medio', mode: 'choice', speed: 1, translate: true, lang: 'en', autoReplay: 8, sounds: true, ytKey: '', pipedOk: '', goal: 20, musicOnly: true, karTr: 'side', claudeKey: '', aiModel: 'claude-haiku-5-5', showPrev: true },
  store.get('lg:settings', {})
);
const saveSettings = () => store.set('lg:settings', settings);
// defaults v2: "Pausa em cada frase" + "Múltipla escolha" — applied once to settings saved before the change
if (settings.defaultsV !== 2) { settings.pace = 'pause'; settings.mode = 'choice'; settings.defaultsV = 2; saveSettings(); }

let lib = store.get('lg:lib', null) || (() => {
  const old = store.get('lg:songs', {}), videos = {};
  for (const [id, s] of Object.entries(old)) videos[id] = { id, title: s.title || id, author: '', lrc: s.lrc || null, offset: s.offset || 0, best: s.best || 0, fav: false, updated: s.updated || 0 };
  return { videos, playlists: [], recent: Object.keys(videos) };
})();
lib.phrases = lib.phrases || [];
lib.stats = Object.assign({ songs: 0, lines: 0, words: 0, misses: 0, ms: 0, days: {}, uniq: [] }, lib.stats || {});
// scoring v2: 1 point per correct word, +10 for a completed song. Old records (100s of points) no longer compare.
// example songs, so the app opens with something to play. Added once to "Recentes" (after the user's own songs).
const SAMPLES = [   // official album audio (same timing as the lyrics); all embeddable, all with synced lyrics
  ['AUAxlOfw2O0', "The Killers - All These Things That I've Done", 'The Killers'],
  ['NMZ74lDDn2A', 'The Cranberries - Ode To My Family', 'The Cranberries'],
  ['Mc_6rKOwhxg', 'The Killers - Read My Mind', 'The Killers'],
  ['Qjo_x_8vrVY', 'Coldplay - Ink', 'Coldplay'],
  ['2u4ZlLpY7_Y', 'The Strokes - Someday', 'The Strokes'],
  ['1UjLFMg18cY', "Queen - Don't Stop Me Now", 'Queen'],
  ['WtJ5GY2A8eo', 'Sia - House On Fire', 'Sia'],
  ['D2mlCmROm2M', 'Maroon 5 - Girls Like You', 'Maroon 5'],
  ['EkGiGf8utCM', 'Aya Nakamura - Copines', 'Aya Nakamura'],
  ['WKZO-CWeOVA', 'Billie Eilish - Birds of a Feather', 'Billie Eilish'],
  ['mHzBysO5HF0', 'Maná - Ojalá Pudiera Borrarte', 'Maná'],
  ['bmBf_YedOQc', 'Angels & Airwaves - Epic Holiday', 'Angels & Airwaves'],
  ['X3Sdg1_-M0c', 'Adele - Send My Love (To Your New Lover)', 'Adele'],
  ['BVR3k32x9h0', 'Ashe - Stop The Wedding!', 'Ashe'],
  ['b-D5yAAXYng', 'Ben E. King - Stand By Me', 'Ben E. King'],
  ['W-Khe7DInxo', 'Phoebe Bridgers - Scott Street', 'Phoebe Bridgers']
];
if ((lib.samplesV || 0) < 2) {
  // drop old example songs the user never opened (still flagged "sample"), then add the current set
  const keep = new Set(SAMPLES.map(x => x[0]));
  Object.values(lib.videos).forEach(v => { if (v.sample && !keep.has(v.id)) { delete lib.videos[v.id]; lib.recent = lib.recent.filter(id => id !== v.id); } });
  SAMPLES.forEach(([id, title, author]) => { if (!lib.videos[id]) lib.videos[id] = { id, title, author, lrc: null, offset: 0, best: 0, fav: false, updated: 0, sample: true }; });
  if (!lib.samplesV) lib.recent = [...lib.recent, ...SAMPLES.map(x => x[0]).filter(id => !lib.recent.includes(id))].slice(0, 50);   // first run only
  lib.samplesV = 2; store.set('lg:lib', lib);
}
if (lib.scoreV !== 2) { Object.values(lib.videos).forEach(v => { v.best = 0; }); lib.scoreV = 2; store.set('lg:lib', lib); }

/* ================= progress stats ================= */
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
let statSaveT = null;
function stat(k, n = 1) {
  const st = lib.stats, before = levelOf(xpOf(st)).level, d = st.days[dayKey()] || (st.days[dayKey()] = { songs: 0, lines: 0, words: 0, misses: 0, ms: 0 });
  const goalBefore = d.words >= settings.goal;
  st[k] = (st[k] || 0) + n; d[k] = (d[k] || 0) + n;
  clearTimeout(statSaveT); statSaveT = setTimeout(saveLib, 1500);
  if (k === 'ms') return;
  const after = levelOf(xpOf(st));
  if (after.level > before) toast(`Você chegou ao nível ${after.level} · ${after.name}`);
  else if (k === 'words' && !goalBefore && d.words >= settings.goal) toast('Meta do dia batida');
}
const SONG_BONUS = 10;
const xpOf = st => st.words + st.songs * SONG_BONUS;   // same rule as the in-game points: 1 per word, +10 per finished song
const LEVEL_NAMES = ['Iniciante', 'Ouvinte', 'Curioso', 'Cantor de chuveiro', 'Afinado', 'Dedicado', 'Fluente', 'Virtuoso', 'Mestre', 'Lenda'];
function levelOf(xp) {
  let level = 1; while (xp >= 10 * level * level) level++;       // thresholds: 10, 40, 90, 160…
  const from = 10 * (level - 1) * (level - 1), to = 10 * level * level;
  return { level, name: LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)], xp, from, to, frac: (xp - from) / (to - from) };
}
function dayStreak() {
  const days = lib.stats.days, active = k => days[k] && (days[k].words > 0 || days[k].lines > 0);
  const d = new Date(); if (!active(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0; while (active(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function bestStreak() {
  const keys = Object.keys(lib.stats.days).filter(k => lib.stats.days[k].words > 0 || lib.stats.days[k].lines > 0).sort();
  let best = 0, run = 0, prev = null;
  keys.forEach(k => { const t = new Date(k + 'T12:00'); run = prev && (t - prev) / 864e5 < 1.5 ? run + 1 : 1; best = Math.max(best, run); prev = t; });
  return best;
}
const fmtNum = n => n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace('.', ',') + ' mil' : n.toLocaleString('pt-BR');
function fmtTime(ms) { const m = Math.round(ms / 60000); return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0'); }
const todayStats = () => lib.stats.days[dayKey()] || { songs: 0, lines: 0, words: 0, misses: 0, ms: 0 };
const hasProgress = () => lib.stats.lines > 0 || lib.stats.words > 0;

const saveLib = () => store.set('lg:lib', lib);
function vid(id, meta) {
  let v = lib.videos[id];
  if (!v) v = lib.videos[id] = { id, title: '', author: '', lrc: null, offset: 0, best: 0, fav: false, updated: Date.now() };
  if (meta) { if (meta.title) v.title = meta.title; if (meta.author) v.author = meta.author; }
  return v;
}
const trCache = store.get('lg:tr', {});          // automatic translations (MyMemory), per device
lib.trOverride = lib.trOverride || {};            // translations the user picked or wrote; part of the library/backup
const trKey = (text, lang = settings.lang) => lang + '|' + text;
const trOf = (text, lang) => lib.trOverride[trKey(text, lang)] || trCache[trKey(text, lang)] || null;

const STOP = new Set(('the a an and or but of to in on at for is it its i you me my we he she they them his her our your be am are was were ' +
  'do did does so as if no not oh ooh ah uh yeah hey la na da o e de do um uma que en el los las y se mi tu te le les du un une et je il ' +
  'ich du und die der das ist ein eine zu es il di che non mi ti per ' +
  'の が は を に で と も へ や か ね よ な だ て た し' /* Japanese particles / endings */).split(' '));

/* ================= state ================= */
let player = null, apiReady = false, playerReady = false, pendingId = null, wakeLock = null;
const S = {
  videoId: null, v: null, autoSearched: false, queue: null,
  entries: [], lines: [], pool: [],
  phase: 'idle',        // idle | lyrics | sync | ready | play | karaoke
  cur: -1, hold: null, waiting: false, finished: false, lastActivity: 0,
  score: 0, ok: 0, miss: 0, streak: 0, bestStreak: 0, offset: 0,
  sync: { lines: [], idx: 0, entries: [] }
};
const H = { tab: 'home', libTab: 'fav', plOpen: null, results: null, query: '' };

/* ================= text helpers ================= */
function norm(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘`´]/g, "'").replace(/[^\p{L}\p{N}']/gu, '');
}
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
function judge(input, answer) {
  const a = norm(input), b = norm(answer);
  if (!a) return 'empty';
  if (a === b || a.replace(/'/g, '') === b.replace(/'/g, '')) return 'exact';
  if (b.length >= 5 && lev(a, b) <= 1) return 'close';
  return 'wrong';
}
function parseVideoId(u) {
  u = (u || '').trim();
  const m = u.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/);
  if (m) return m[1];
  if (/^[\w-]{11}$/.test(u) && /[\d_-]/.test(u)) return u;
  return null;
}
function parseLRC(text) {
  const out = []; let tagged = 0;
  for (const raw of (text || '').split(/\r?\n/)) {
    const tags = [...raw.matchAll(/\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)];
    if (!tags.length) continue;
    tagged++;
    const txt = raw.replace(/\[[^\]]*\]/g, '').replace(/<\d+:\d+(?:\.\d+)?>/g, '').trim();
    for (const t of tags) out.push({ t: +t[1] * 60 + parseFloat(t[2].replace(':', '.')), text: txt });
  }
  if (tagged < 2) return null;
  return out.sort((a, b) => a.t - b.t);
}
const toLRC = entries => entries.map(e => `[${fmt(e.t)}]${e.text}`).join('\n');
const plainLines = text => text.split(/\r?\n/).map(s => s.replace(/\[[^\]]*\]/g, '').trim()).filter(Boolean);

/* ================= sounds ================= */
let actx = null;
function beep(ok) {
  if (!settings.sounds) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = ok ? [660, 880] : [220, 180];
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * 0.09;
      o.type = ok ? 'sine' : 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(ok ? 0.12 : 0.05, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.18);
    });
  } catch { }
}

/* ================= navigation ================= */
function go(view) {
  document.body.dataset.view = view;
  if (view === 'home') {
    if (playerReady) player.pauseVideo();
    if (inSession()) endPlay();
    S.phase = 'idle';
    renderHome();
  }
  window.scrollTo(0, 0);
}
const inSession = () => S.phase === 'play' || S.phase === 'karaoke';
const panes = ['pLyrics', 'pSync', 'pReady', 'pGame', 'pKaraoke'];
function showPane(id) { panes.forEach(p => $('#' + p).classList.toggle('on', p === id)); }
window.addEventListener('popstate', () => { if (document.body.dataset.view === 'song') go('home'); });

/* ================= home (tabs) ================= */
const hq = id => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function songMeta(v) {
  const lv = lib.videos[v.id] || {};
  return `${lv.lrc ? '<span class="badge">LETRA OK</span>' : ''}${lv.best ? '★ ' + lv.best + ' · ' : ''}${esc(v.author || '')}${v.dur > 0 ? ' · ' + fmtDur(v.dur) : ''}`;
}
function videoItem(v, { onOpen, trailing } = {}) {
  const lv = lib.videos[v.id];
  const row = el('div', 'item', `<img class="thumb" loading="lazy" src="${thumb(v.id)}" alt="">
    <div class="meta"><b>${esc(v.title || 'Vídeo ' + v.id)}</b><small>${songMeta(v)}</small></div>`);
  const fav = el('button', 'iconbtn sm' + (lv && lv.fav ? ' on' : ''), icon(lv && lv.fav ? 'star-f' : 'star'));
  fav.setAttribute('aria-label', 'Favoritar');
  fav.onclick = e => { e.stopPropagation(); toggleFav(v); renderHome(); };
  row.appendChild(fav);
  if (trailing) row.appendChild(trailing);
  else {
    const add = el('button', 'iconbtn sm', icon('addlist'));
    add.setAttribute('aria-label', 'Adicionar à playlist');
    add.onclick = e => { e.stopPropagation(); sheetAddToPlaylist(v); };
    row.appendChild(add);
  }
  row.onclick = onOpen || (() => openSong(v.id, v));
  return row;
}
function ccard(v) {
  const c = el('button', 'ccard', `<img loading="lazy" src="${thumb(v.id)}" alt=""><b>${esc(v.title || v.id)}</b><small>${v.best ? '★ ' + v.best + ' · ' : ''}${esc(v.author || '')}</small>`);
  c.onclick = () => openSong(v.id, v);
  return c;
}
function section(title, action, actionLabel = 'Ver tudo') {
  const s = el('div', 'section');
  const h = el('div', 'sectionhead', `<h2>${esc(title)}</h2>`);
  if (action) { const b = el('button', '', actionLabel); b.onclick = action; h.appendChild(b); }
  s.appendChild(h);
  return s;
}
function toggleFav(v) {
  const x = vid(v.id, v); x.fav = !x.fav; x.updated = Date.now(); saveLib();
  toast(x.fav ? '★ Adicionada aos favoritos' : 'Removida dos favoritos');
  return x.fav;
}
function emptyMsg(ic, title, text) { return el('div', 'empty', `<div class="big">${icon(ic)}</div><b>${title}</b>${text}`); }
function setTab(t) { H.tab = t; window.scrollTo(0, 0); renderHome(); if (t === 'search' && !H.results) setTimeout(() => $('#q').focus(), 50); }

const TITLES = { home: '', search: 'Buscar', library: 'Biblioteca', phrases: 'Frases' };
function renderHome() {
  $$('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === H.tab));
  $$('.tabpanel').forEach(p => p.classList.toggle('on', p.id === 'tab-' + H.tab));
  $('#homeLogo').classList.toggle('hidden', H.tab !== 'home');
  $('#headTitle').classList.toggle('hidden', H.tab === 'home');
  $('#headTitle').textContent = TITLES[H.tab];
  ({ home: renderHomeTab, search: renderSearchTab, library: renderLibraryTab, phrases: renderPhrasesTab })[H.tab]();
}

function renderHomeTab() {
  const box = $('#tab-home'); box.innerHTML = '';
  const recent = lib.recent.map(id => lib.videos[id]).filter(Boolean);
  if (!recent.length) {
    const hero = el('div', 'hero', `<h2>Aprenda idiomas cantando</h2>
      <p>Escolha uma música, complete a letra enquanto ela toca e veja a tradução de cada verso.</p>`);
    const go = el('button', 'cta', icon('search') + 'Buscar uma música'); go.style.marginTop = '0';
    go.onclick = () => setTab('search');
    hero.appendChild(go);
    hero.appendChild(el('div', 'steps', `
      <div class="step"><span class="n">1</span><div><b>Escolha a música</b><span>Busque pelo nome ou cole um link do YouTube.</span></div></div>
      <div class="step"><span class="n">2</span><div><b>Complete as lacunas</b><span>Toque a palavra certa no ritmo da música.</span></div></div>
      <div class="step"><span class="n">3</span><div><b>Entenda e revise</b><span>Veja a tradução e salve as frases que quiser estudar.</span></div></div>`));
    box.appendChild(hero);
  } else {
    if (hasProgress()) box.appendChild(progressCard());
    const v = recent[0];
    if (!hasProgress() && v.sample) box.appendChild(el('p', 'intro', '<b>Aprenda idiomas cantando.</b> Escolha uma música, complete a letra enquanto ela toca e veja a tradução de cada verso.'));
    const f = el('button', 'feature', `<div class="ov"><span class="eyebrow">${v.sample ? 'Comece por aqui' : 'Continuar'}</span><b>${esc(v.title || v.id)}</b>
      <small>${esc(v.author || '')}${v.best ? ' · recorde ' + v.best : ''}${v.lrc || v.sample ? '' : ' · precisa de letra'}</small></div>
      <span class="fab">${icon('play')}</span>`);
    f.style.backgroundImage = `url(${hq(v.id)})`;
    f.onclick = () => openSong(v.id, v);
    box.appendChild(f);

    if (recent.length > 1) {
      const s = section(recent.slice(1, 15).every(x => x.sample) ? 'Músicas de exemplo' : 'Recentes'); const car = el('div', 'carousel');
      recent.slice(1, 15).forEach(x => car.appendChild(ccard(x))); s.appendChild(car); box.appendChild(s);
    }
    if (!recent.slice(1, 15).every(x => x.sample)) {
      const s2 = section('Para começar'); const car2 = el('div', 'carousel');
      SAMPLES.forEach(([id, title, author]) => car2.appendChild(ccard(lib.videos[id] || { id, title, author })));
      s2.appendChild(car2); box.appendChild(s2);
    }
    const favs = Object.values(lib.videos).filter(x => x.fav).sort((a, b) => b.updated - a.updated);
    if (favs.length) {
      const s = section('Favoritos', () => { H.libTab = 'fav'; setTab('library'); }); const car = el('div', 'carousel');
      favs.slice(0, 15).forEach(x => car.appendChild(ccard(x))); s.appendChild(car); box.appendChild(s);
    }
    if (lib.phrases.length) {
      const s = section('Frases salvas', () => setTab('phrases'));
      const list = el('div', 'card list'); list.style.padding = '4px 14px';
      lib.phrases.slice(0, 3).forEach(p => list.appendChild(phraseRow(p)));
      s.appendChild(list); box.appendChild(s);
    }
  }
  if (isIOS && !isStandalone && !store.get('lg:hintClosed', false)) {
    const c = el('div', 'installcard', `${icon('share')}<span>Para jogar em <b>tela cheia</b>, toque em Compartilhar e depois em <b>Adicionar à Tela de Início</b>.</span>`);
    const x = el('button', 'iconbtn sm', icon('close')); x.onclick = () => { store.set('lg:hintClosed', true); renderHome(); };
    c.appendChild(x); box.appendChild(c);
  }
}

// search suggestions: recent hits by language (each chip runs that search)
const SUGGEST = [
  ['🇺🇸', 'Inglês', ['Billie Eilish Birds of a Feather', 'Sabrina Carpenter Espresso', 'Lady Gaga Bruno Mars Die With A Smile', 'Ed Sheeran Perfect']],
  ['🇪🇸', 'Espanhol', ['Bad Bunny DtMF', 'Shakira Soltera', 'Karol G Si Antes Te Hubiera Conocido', 'Karol G Shakira TQG']],
  ['🇫🇷', 'Francês', ['Aya Nakamura Djadja', 'Stromae Papaoutai', 'ZAZ Je veux', 'Indila Dernière danse']],
  ['🇩🇪', 'Alemão', ['Peter Fox Zukunft Pink', 'Nina Chuba Wildberry Lillet', 'Apache 207 Roller', 'Sido Astronaut']],
  ['🇯🇵', 'Japonês', ['YOASOBI Idol', 'Creepy Nuts Bling-Bang-Bang-Born', 'Fujii Kaze Shinunoga E-Wa', 'Kenshi Yonezu Lemon']],
  ['🇰🇷', 'Coreano', ['NewJeans Ditto', 'aespa Supernova', 'IVE Love Dive', 'BTS Spring Day']],
  ['🇮🇹', 'Italiano', ['Måneskin Zitti e buoni', 'Mahmood Soldi', 'Laura Pausini La soledad']]
];
function renderSearchTab() {
  const box = $('#searchList'); box.innerHTML = '';
  const filt = el('div', 'seg small searchfilt', `<button data-v="1" class="${settings.musicOnly ? 'on' : ''}">${icon('note')}Músicas</button><button data-v="0" class="${settings.musicOnly ? '' : 'on'}">Todos os vídeos</button>`);
  filt.querySelectorAll('button').forEach(b => b.onclick = () => {
    const v = b.dataset.v === '1'; if (v === settings.musicOnly) return;
    settings.musicOnly = v; saveSettings();
    if (H.query && H.results) doSearch(H.query); else renderSearchTab();
  });
  box.appendChild(filt);
  if (!H.results) {
    const s = el('div', ''); s.appendChild(el('div', 'sectionhead', '<h2 style="font-size:17px">Sucessos para praticar</h2>'));
    SUGGEST.forEach(([flag, name, songs]) => {
      s.appendChild(el('div', 'suggesthead', `<span class="flag">${flag}</span>${esc(name)}`));
      const wrap = el('div', 'suggest');
      songs.forEach(q => { const b = el('button', '', esc(q)); b.onclick = () => { $('#q').value = q; doSearch(q); }; wrap.appendChild(b); });
      s.appendChild(wrap);
    });
    s.appendChild(el('p', 'caption', 'Dica: você também pode colar o link de um vídeo do YouTube na busca.'));
    box.appendChild(s);
    return;
  }
  if (H.results === 'loading') { box.appendChild(el('div', 'empty', '<b>Buscando…</b>')); return; }
  if (H.results.error) { box.appendChild(emptyMsg('search', 'Busca indisponível', H.results.error)); return; }
  if (!H.results.length) { box.appendChild(emptyMsg('search', 'Nada encontrado', settings.musicOnly ? 'Nenhuma música com esse nome. Tente “Todos os vídeos” ou cole o link.' : 'Tente outro nome ou cole o link do vídeo.')); return; }
  const list = el('div', 'list');
  H.results.forEach(v => {
    const row = videoItem(v);
    const lv = lib.videos[v.id];
    if (!(lv && lv.lrc)) { const b = el('span', 'lb'); b.dataset.id = v.id; row.querySelector('small').prepend(b); paintLyricBadge(b, lyricCheck.get(v.id)); }
    list.appendChild(row);
  });
  box.appendChild(list);
  checkLyricsFor(H.results.slice(0, 10));
}

/* Lyrics availability for search results: ask LRCLIB once per video so the user sees which ones are playable. */
const lyricCheck = new Map();   // videoId -> 'synced' | 'plain' | 'none' | 'loading'
function paintLyricBadge(b, st) {
  b.className = 'lb';
  b.innerHTML = st === 'synced' ? '<span class="badge">COM LETRA</span>' : st === 'plain' ? '<span class="badge warn">LETRA SIMPLES</span>'
    : st === 'none' ? '<span class="badge muted">SEM LETRA</span>' : '';
}
let lyricCheckPausedUntil = 0;
async function checkLyricsFor(items) {
  // LRCLIB rate-limits bursts (HTTP 429): one request per result, two at a time, and back off on 429
  // so the lyrics lookup that runs when a song is opened is never starved.
  const todo = items.filter(v => !lyricCheck.has(v.id) && !(lib.videos[v.id] && lib.videos[v.id].lrc));
  todo.forEach(v => lyricCheck.set(v.id, 'loading'));
  const worker = async () => {
    for (let v; (v = todo.shift());) {
      if (Date.now() < lyricCheckPausedUntil || document.body.dataset.view !== 'home') { lyricCheck.delete(v.id); continue; }
      let st;
      try {
        const { track, artist } = guessTrack(v.title, v.author);
        const r = await fetchT('https://lrclib.net/api/search?' + new URLSearchParams({ q: `${track} ${artist}`.trim() }), 8000);
        if (r.status === 429) { lyricCheckPausedUntil = Date.now() + 30000; lyricCheck.delete(v.id); continue; }
        const res = await r.json();
        st = res.some(x => x.syncedLyrics) ? 'synced' : res.some(x => x.plainLyrics) ? 'plain' : 'none';
      } catch { lyricCheck.delete(v.id); continue; }
      lyricCheck.set(v.id, st);
      $$(`#searchList .lb[data-id="${v.id}"]`).forEach(b => paintLyricBadge(b, st));
      await wait(150);
    }
  };
  await Promise.all([worker(), worker()]);
}

function renderLibraryTab() {
  $$('#libSeg button').forEach(b => b.classList.toggle('on', b.dataset.lib === H.libTab));
  const box = $('#libList'); box.innerHTML = '';
  if (H.libTab === 'fav') {
    const list = Object.values(lib.videos).filter(v => v.fav).sort((a, b) => b.updated - a.updated);
    if (!list.length) box.appendChild(emptyMsg('star', 'Nenhum favorito', 'Toque na estrela de uma música para guardá-la aqui.'));
    list.forEach(v => box.appendChild(videoItem(v)));
  } else if (H.libTab === 'ready') {
    const list = Object.values(lib.videos).filter(v => v.lrc).sort((a, b) => b.updated - a.updated);
    if (!list.length) box.appendChild(emptyMsg('note', 'Nenhuma música pronta', 'Músicas com letra sincronizada aparecem aqui, prontas para jogar.'));
    list.forEach(v => box.appendChild(videoItem(v)));
  } else if (H.plOpen) {
    const pl = lib.playlists.find(p => p.id === H.plOpen);
    if (!pl) { H.plOpen = null; return renderLibraryTab(); }
    const head = el('div', 'listhead', `<button class="iconbtn sm" data-a="back">${icon('back')}</button><h3>${esc(pl.name)}</h3>
      <button class="iconbtn sm" data-a="more">${icon('more')}</button>`);
    head.querySelector('[data-a=back]').onclick = () => { H.plOpen = null; renderLibraryTab(); };
    head.querySelector('[data-a=more]').onclick = () => sheetPlaylistMenu(pl);
    box.appendChild(head);
    if (pl.items.length) {
      const play = el('button', 'cta', icon('play') + 'Tocar playlist'); play.style.margin = '4px 0 10px';
      play.onclick = () => openSong(pl.items[0], lib.videos[pl.items[0]], { plId: pl.id, ids: pl.items.slice(), idx: 0, name: pl.name });
      box.appendChild(play);
    } else box.appendChild(emptyMsg('addlist', 'Playlist vazia', 'Use o botão ＋ ao lado das músicas para adicionar.'));
    pl.items.forEach((id, i) => {
      const v = lib.videos[id] || { id };
      const rm = el('button', 'iconbtn sm', icon('trash'));
      rm.onclick = e => { e.stopPropagation(); pl.items.splice(i, 1); saveLib(); renderLibraryTab(); };
      box.appendChild(videoItem(v, { trailing: rm, onOpen: () => openSong(id, v, { plId: pl.id, ids: pl.items.slice(), idx: i, name: pl.name }) }));
    });
  } else {
    const nw = el('div', 'item', `<div class="thumb sq">＋</div><div class="meta"><b>Nova playlist</b><small>Agrupe músicas para jogar em sequência</small></div>`);
    nw.onclick = () => sheetNewPlaylist();
    box.appendChild(nw);
    lib.playlists.forEach(pl => {
      const row = el('div', 'item', (pl.items[0] ? `<img class="thumb sq" src="${thumb(pl.items[0])}" alt="">` : `<div class="thumb sq">♪</div>`) +
        `<div class="meta"><b>${esc(pl.name)}</b><small>${pl.items.length} música${pl.items.length === 1 ? '' : 's'}</small></div>${icon('chev')}`);
      row.querySelector('svg:last-child').style.color = 'var(--muted)';
      row.onclick = () => { H.plOpen = pl.id; renderLibraryTab(); };
      box.appendChild(row);
    });
  }
}

/* ================= progress UI ================= */
/* activity heatmap: one square per day, sequential single hue (more correct words = brighter) */
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function heatLevel(day) {
  if (!day || (!day.words && !day.lines)) return 0;
  const f = day.words / settings.goal;
  return f >= 1 ? 4 : f >= 0.5 ? 3 : f >= 0.2 ? 2 : 1;   // listened but few words still counts as level 1
}
function heatmap(weeks) {
  const cell = 13, gap = 3, step = cell + gap, left = 22, topPad = 14;
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - start.getDay() - (weeks - 1) * 7);
  const W = left + weeks * step, H = topPad + 7 * step;
  let g = '', lastMonth = -1;
  ['', 'seg', '', 'qua', '', 'sex', ''].forEach((l, i) => { if (l) g += `<text x="0" y="${topPad + i * step + cell - 3}" class="hlbl">${l}</text>`; });
  const d = new Date(start);
  for (let w = 0; w < weeks; w++) {
    if (d.getMonth() !== lastMonth && d.getDate() <= 7) { g += `<text x="${left + w * step}" y="10" class="hlbl">${MONTHS[d.getMonth()]}</text>`; lastMonth = d.getMonth(); }
    for (let wd = 0; wd < 7; wd++) {
      if (d <= today) {
        const k = dayKey(d), day = lib.stats.days[k], lvl = heatLevel(day);
        const tip = `${d.getDate()} ${MONTHS[d.getMonth()]}: ${day ? `${day.words || 0} palavra${day.words === 1 ? '' : 's'} certa${day.words === 1 ? '' : 's'}, ${day.lines || 0} versos` : 'sem atividade'}`;
        g += `<rect x="${left + w * step}" y="${topPad + wd * step}" width="${cell}" height="${cell}" rx="3" class="h${lvl}${k === dayKey() ? ' htoday' : ''}" data-tip="${tip}"><title>${tip}</title></rect>`;
      }
      d.setDate(d.getDate() + 1);
    }
  }
  return `<svg class="heatmap" viewBox="0 0 ${W} ${H}" role="img" aria-label="Atividade diária nas últimas ${weeks} semanas">${g}</svg>`;
}
const heatLegend = () => `<div class="heatlegend"><span>menos</span>${[0, 1, 2, 3, 4].map(i => `<i class="h${i}"></i>`).join('')}<span>mais</span></div>`;


function ringSVG(frac) {
  const r = 26, c = +(2 * Math.PI * r).toFixed(1);
  return `<svg class="goalring" viewBox="0 0 64 64"><circle cx="32" cy="32" r="${r}" class="track"/><circle cx="32" cy="32" r="${r}" class="fill" stroke-dasharray="${c}" stroke-dashoffset="${(c * (1 - Math.min(1, frac))).toFixed(1)}"/></svg>`;
}
function progressCard() {
  const st = lib.stats, t = todayStats(), lv = levelOf(xpOf(st)), streak = dayStreak(), done = t.words >= settings.goal;
  const c = el('button', 'progress card', `
    <div class="prog-top">
      <div class="ringwrap">${ringSVG(t.words / settings.goal)}<span><b>${t.words}</b><small>/${settings.goal}</small></span></div>
      <div class="prog-info">
        <b>${done ? 'Meta de hoje batida' : 'Meta de hoje'}</b>
        <small>${done ? `${t.words} palavras certas hoje` : `Faltam ${settings.goal - t.words} palavras certas`}</small>
        <div class="prog-chips"><span class="pchip">${icon('flame', 'ii')} ${streak} dia${streak === 1 ? '' : 's'}</span><span class="pchip lvl">Nível ${lv.level}</span></div>
      </div>
      ${icon('chev')}
    </div>
    <div class="prog-stats">
      <div><b>${fmtNum(st.songs)}</b><span>músicas</span></div>
      <div><b>${fmtNum(st.lines)}</b><span>versos</span></div>
      <div><b>${fmtNum(st.words)}</b><span>palavras</span></div>
    </div>
    <div class="heatwrap">${heatmap(20)}${heatLegend()}</div>`);
  c.onclick = sheetProgress;
  return c;
}
/* last 7 days, correct words per day — single series: one hue, today emphasised, goal as a dashed reference line */
function weekChart() {
  const names = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'], days = [], d = new Date();
  d.setDate(d.getDate() - 6);
  for (let i = 0; i < 7; i++) { const k = dayKey(d); days.push({ label: names[d.getDay()], v: (lib.stats.days[k] || {}).words || 0, today: i === 6 }); d.setDate(d.getDate() + 1); }
  const W = 320, H = 150, base = 124, top = 18, max = Math.max(settings.goal, ...days.map(x => x.v)), bw = 22, slot = W / 7;
  const y = v => base - (v / max) * (base - top);
  const gy = y(settings.goal).toFixed(1);
  let g = `<line x1="0" x2="${W}" y1="${base}" y2="${base}" class="axis"/>
    <line x1="0" x2="${W}" y1="${gy}" y2="${gy}" class="goal"/><text x="${W}" y="${gy - 4}" text-anchor="end" class="goaltxt">meta ${settings.goal}</text>`;
  days.forEach((x, i) => {
    const cx = slot * i + slot / 2, x0 = cx - bw / 2, h = base - y(x.v), r = Math.min(4, h);
    const bar = h > 0 ? `<path class="b${x.today ? ' today' : ''}" d="M${x0},${base} V${base - h + r} Q${x0},${base - h} ${x0 + r},${base - h} H${x0 + bw - r} Q${x0 + bw},${base - h} ${x0 + bw},${base - h + r} V${base} Z"/>` : '';
    g += `<g class="col"><title>${x.label}: ${x.v} palavra${x.v === 1 ? '' : 's'} certa${x.v === 1 ? '' : 's'}</title>
      <rect x="${slot * i}" y="0" width="${slot}" height="${H}" fill="transparent"/>${bar}
      ${x.today && x.v ? `<text x="${cx}" y="${base - h - 6}" text-anchor="middle" class="val">${x.v}</text>` : ''}
      <text x="${cx}" y="${H - 6}" text-anchor="middle" class="lbl${x.today ? ' on' : ''}">${x.today ? 'hoje' : x.label}</text></g>`;
  });
  return `<svg class="weekchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Palavras certas por dia nos últimos 7 dias">${g}</svg>`;
}
function sheetProgress() {
  const st = lib.stats, lv = levelOf(xpOf(st)), acc = st.words + st.misses ? Math.round(st.words / (st.words + st.misses) * 100) + '%' : '—';
  const tiles = [
    [fmtNum(st.songs), 'músicas ouvidas'], [fmtNum(st.uniq.length), 'músicas diferentes'], [fmtNum(st.lines), 'versos tocados'],
    [fmtNum(st.words), 'palavras certas'], [acc, 'precisão'], [fmtTime(st.ms), 'tempo de jogo'],
    [dayStreak(), 'dias seguidos'], [bestStreak(), 'recorde de dias'], [lib.phrases.length, 'frases salvas']
  ];
  openSheet(`<h3>Seu progresso</h3>
    <div class="lvlcard"><div class="lvlbadge">${lv.level}</div><div class="lvlinfo"><b>${lv.name}</b>
      <small>${fmtNum(lv.xp)} XP · faltam ${fmtNum(lv.to - lv.xp)} para o nível ${lv.level + 1}</small>
      <div class="bar"><div style="width:${Math.round(lv.frac * 100)}%"></div></div></div></div>
    <div class="grouplabel">Atividade · últimos 6 meses</div>
    <div class="chartcard heatcard">${heatmap(26)}<div class="heatfoot"><span class="heatcap" id="heatCap">Toque em um dia para ver os detalhes</span>${heatLegend()}</div></div>
    <div class="grouplabel">Últimos 7 dias · palavras certas</div>
    <div class="chartcard">${weekChart()}</div>
    <div class="grouplabel">Desde o começo</div>
    <div class="statgrid">${tiles.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>
    <div class="grouplabel">Meta diária de palavras certas</div>
    ${seg('goal', [[10, '10'], [20, '20'], [30, '30'], [50, '50'], [100, '100']], settings.goal)}
    <p class="caption">XP: 1 por palavra certa e ${SONG_BONUS} por música completa (jogada até o fim). Jogue um pouco todo dia para manter a sequência.</p>
    <button class="btn primary wide" data-a="ok">Fechar</button>`, { ok: closeSheet });
  $('#sheetContent .heatcard').addEventListener('click', e => {
    const r = e.target.closest('[data-tip]'); if (!r) return;
    $('#heatCap').textContent = r.dataset.tip;
    $$('#sheetContent .hsel').forEach(x => x.classList.remove('hsel')); r.classList.add('hsel');
  });
  $$('#sheetContent [data-seg=goal] button').forEach(b => b.onclick = () => {
    settings.goal = +b.dataset.v; saveSettings(); sheetProgress(); if (document.body.dataset.view === 'home') renderHome();
  });
}

function phraseRow(p) {
  const row = el('div', 'item phrase', `<div class="meta"><b>${esc(p.text)}</b>${p.tr ? `<div class="tr">${esc(p.tr)}</div>` : ''}
    <small>${esc(p.title || '')} · ${fmtDur(p.start) || '0:00'}</small></div><span class="iconbtn sm">${icon('play')}</span>`);
  row.onclick = () => sheetClip(p);
  return row;
}
function renderPhrasesTab() {
  const box = $('#phraseList'); box.innerHTML = '';
  if (!lib.phrases.length) { box.appendChild(emptyMsg('bm', 'Nenhuma frase salva', 'Durante o jogo, toque no marcador ao lado de uma frase para guardar o texto, a tradução e o trecho da música.')); return; }
  lib.phrases.forEach(p => box.appendChild(phraseRow(p)));
}

/* ================= YouTube search ================= */
const PIPED = ['https://api.piped.private.coffee', 'https://pipedapi.kavin.rocks', 'https://pipedapi.adminforge.de', 'https://pipedapi.r4fo.com',
  'https://pipedapi.leptons.xyz', 'https://piped-api.lunar.icu', 'https://pipedapi.darkness.services', 'https://pipedapi.drgns.space'];
async function fetchT(url, ms = 7000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { signal: c.signal }); } finally { clearTimeout(t); }
}
/* Order merged results by how well title + artist match what the user typed.
   The "songs" and "music videos" lists are ranked separately by YouTube; simply concatenating them
   can bury the original (e.g. "Aya Nakamura Copines": the original is only in the videos list). */
const VARIANT = /\b(slowed|sped ?up|speed ?up|reverb|8d|nightcore|remix|mashup|cover|karaok[eê]|instrumental|bass ?boosted|tiktok|lofi|lo-fi|choreograph\w*|tutorial|piano version|guitar lesson)\b/i;
const qTokens = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^\p{L}\p{N}']+/u).filter(t => t.length >= 2);
function rankByQuery(items, q) {
  const qt = [...new Set(qTokens(q))];
  if (!qt.length) return items;
  const wantsVariant = VARIANT.test(q);
  const scored = items.map(x => {
    const tt = new Set(qTokens(x.title || '')), at = new Set(qTokens(x.author || ''));
    const hits = qt.filter(t => tt.has(t) || at.has(t)).length;
    let score = (hits / qt.length) * 10;
    if (qt.some(t => at.has(t))) score += 2;                       // artist named in the query
    if (!wantsVariant && VARIANT.test(x.title || '')) score -= 6;  // remixes, slowed, 8D… go down
    if (x.src === 'song') score += 0.5;                            // album audio: timing matches the lyrics
    if (x.views > 0) score += Math.log10(x.views) * 0.4;           // popular version wins ties (10k → 1.6, 100M → 3.2)
    score -= x.rank * 0.05;                                        // keep YouTube's own order as tie-break
    return { x, score };
  });
  return scored.sort((a, b) => b.score - a.score).map(s => { const { src, rank, ...rest } = s.x; return rest; });
}
async function ytSearch(q) {
  const music = settings.musicOnly;
  if (settings.ytKey) {
    const p = { part: 'snippet', type: 'video', maxResults: '20', videoEmbeddable: 'true', q, key: settings.ytKey };
    if (music) p.videoCategoryId = '10';   // YouTube category "Music"
    const r = await fetchT('https://www.googleapis.com/youtube/v3/search?' + new URLSearchParams(p));
    const j = await r.json();
    if (j.error) throw new Error('Não foi possível buscar agora. Tente de novo em instantes.');
    return j.items.map(it => ({ id: it.id.videoId, title: decode(it.snippet.title), author: decode(it.snippet.channelTitle) }));
  }
  const order = [settings.pipedOk, ...PIPED.filter(x => x !== settings.pipedOk)].filter(Boolean);
  const pipedQuery = async (base, filter) => {
    const r = await fetchT(`${base}/search?${new URLSearchParams({ q, filter })}`);
    if (!r.ok) throw new Error('http ' + r.status);
    const j = await r.json();
    return (j.items || []).filter(x => x.type === 'stream' && x.url && !x.isShort)
      .map(x => ({ id: (x.url.match(/v=([\w-]{11})/) || [])[1], title: x.title, author: x.uploaderName, dur: x.duration, views: x.views }))
      .filter(x => x.id);
  };
  for (const base of order) {
    try {
      let items;
      if (music) {
        // YouTube Music: "songs" are the album audio (no clip intro, same timing as the lyrics), then official music videos
        const [songs, vids] = await Promise.all([pipedQuery(base, 'music_songs').catch(() => null), pipedQuery(base, 'music_videos').catch(() => null)]);
        if (!songs && !vids) continue;   // instance down
        const seen = new Set();
        const merged = [...(songs || []).map((x, i) => ({ ...x, src: 'song', rank: i })), ...(vids || []).map((x, i) => ({ ...x, src: 'video', rank: i }))]
          .filter(x => !seen.has(x.id) && seen.add(x.id));
        items = rankByQuery(merged, q);
      } else items = await pipedQuery(base, 'videos');
      if (items.length || music) { if (settings.pipedOk !== base) { settings.pipedOk = base; saveSettings(); } return items; }
    } catch { }
  }
  throw new Error('offline');
}
async function doSearch(q) {
  q = q.trim(); if (!q) return;
  const id = parseVideoId(q);
  if (id) { $('#q').value = ''; $('#q').blur(); openSong(id, null); return; }
  $('#q').blur();
  H.tab = 'search'; H.results = 'loading'; H.query = q; renderHome();
  try { H.results = await ytSearch(q); }
  catch (e) {
    H.results = { error: e.message === 'offline'
      ? 'A busca não está respondendo agora. Tente de novo em instantes ou cole o link do vídeo na busca.'
      : esc(e.message) };
  }
  if (H.query === q) renderHome();
}

/* ================= song / player ================= */
window.onYouTubeIframeAPIReady = () => { apiReady = true; if (pendingId) { createPlayer(pendingId); pendingId = null; } };
(function loadApi() { const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s); })();

function createPlayer(id) {
  player = new YT.Player('player', {
    videoId: id,
    playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin, iv_load_policy: 3, fs: 0 },
    events: {
      onReady: () => { playerReady = true; updateMeta(); },
      onStateChange: e => {
        updateMeta();
        if (e.data === YT.PlayerState.ENDED && S.phase === 'play' && !S.finished) finish();
        if (e.data === YT.PlayerState.ENDED && S.phase === 'karaoke' && !S.finished) karaokeEnd();
        const playing = e.data === YT.PlayerState.PLAYING;
        $('#gPause').innerHTML = icon(playing ? 'pause' : 'play') + `<span>${playing ? 'Pausa' : 'Tocar'}</span>`;
        $('#kPause').innerHTML = icon(playing ? 'pause' : 'play') + `<span>${playing ? 'Pausa' : 'Tocar'}</span>`;
        $('#sPlay').innerHTML = icon(playing ? 'pause' : 'play') + `<span>${playing ? 'Pausa' : 'Play'}</span>`;
      },
      onError: e => {
        const msg = (e.data === 101 || e.data === 150) ? 'Este vídeo não pode ser reproduzido no app. Tente outra versão da música.' : 'Não foi possível reproduzir este vídeo agora.';
        toast(msg);
      }
    }
  });
}
function openSong(id, meta, queue = null) {
  S.queue = queue;
  const v = vid(id, meta);
  delete v.sample;   // an example song becomes a regular recent once opened
  lib.recent =[id, ...lib.recent.filter(x => x !== id)].slice(0, 50);
  saveLib();
  Object.assign(S, { videoId: id, v, offset: v.offset || 0, autoSearched: false, entries: [] });
  if (document.body.dataset.view !== 'song') history.pushState({ song: id }, '');
  document.body.dataset.view = 'song';
  window.scrollTo(0, 0);
  updateSongBar();
  if (player && playerReady) player.cueVideoById(id);
  else if (apiReady && !player) createPlayer(id);
  else pendingId = id;
  $('#lrcResults').innerHTML = '';
  if (v.lrc && parseLRC(v.lrc)) setEntries(parseLRC(v.lrc), false);
  else {
    S.phase = 'lyrics'; showPane('pLyrics'); prefillLyrics();
    if (v.title) { S.autoSearched = true; searchLyrics(); }
  }
}
function updateSongBar() {
  const v = S.v; if (!v) return;
  $('#songTitle').textContent = v.title || 'Carregando…';
  $('#songSub').textContent = S.queue ? `${S.queue.name} · ${S.queue.idx + 1}/${S.queue.ids.length}` : (v.author || '');
  $('#btnFav').classList.toggle('on', !!v.fav);
  $('#btnFav').innerHTML = icon(v.fav ? 'star-f' : 'star');
}
function updateMeta() {
  if (!playerReady || !S.v) return;
  const d = player.getVideoData && player.getVideoData();
  if (!d || !d.title || d.video_id !== S.videoId) return;
  const v = S.v;
  if (!v.title || !v.author) {
    v.title = v.title || d.title;
    v.author = v.author || (d.author || '').replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim();
    saveLib(); updateSongBar();
    if (S.phase === 'lyrics') prefillLyrics();
  }
  if (S.phase === 'lyrics' && !S.autoSearched) { S.autoSearched = true; searchLyrics(); }
}
function guessTrack(title, author) {
  let track = title || '', artist = (author || '').replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim();
  const m = track.match(/^(.+?)\s+[-–]\s+(.+)$/);
  if (m) { artist = m[1]; track = m[2]; }
  // drop "(Official Video)", "(Clip officiel)", "[Paroles]", "(Video oficial)", "(Testo)", "(Offizielles Musikvideo)"…
  const tag = /[([][^)\]]*\b(official|officiel|officielle|oficial|ufficiale|offiziell\w*|lyrics?|paroles|letra|testo|songtext|audio|video|v[ií]deo|vid[ée]o|videoclip|clip|clipe|musikvideo|mv|m\/v|hd|4k|visuali[sz]er|live|ao vivo|en vivo|legendado|subtitulado|tradu\w*|ft\.?|feat\.?|prod\.?)\b[^)\]]*[)\]]/gi;
  track = track.replace(tag, '').replace(/\s+(ft\.?|feat\.?)\s.*$/i, '').replace(/\s+/g, ' ').trim();
  return { track, artist };
}
function prefillLyrics() {
  const { track, artist } = guessTrack(S.v.title, S.v.author);
  $('#qTrack').value = track; $('#qArtist').value = artist;
}

/* ================= lyrics (LRCLIB) ================= */
async function searchLyrics() {
  const track = $('#qTrack').value.trim(), artist = $('#qArtist').value.trim();
  const box = $('#lrcResults'); box.innerHTML = '<p class="muted" style="text-align:center">Buscando letra…</p>';
  // LRCLIB answers 429 when it gets too many requests (e.g. right after the search badges); wait and retry instead of giving up
  const lrclib = async params => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetchT('https://lrclib.net/api/search?' + new URLSearchParams(params), 10000);
      if (r.status === 429) { box.innerHTML = '<p class="muted" style="text-align:center">Buscando letra…</p>'; await wait(2000 * (attempt + 1)); continue; }
      const j = await r.json();
      return Array.isArray(j) ? j : [];
    }
    throw new Error('busy');
  };
  try {
    let res = [];
    if (track) res = await lrclib(artist ? { track_name: track, artist_name: artist } : { track_name: track });
    if (!res.length) res = await lrclib({ q: `${track} ${artist}`.trim() });
    if (!res.length && track) res = await lrclib({ q: track });
    // synced first, then the version whose duration is closest to the video (same recording → same timing)
    const vdur = playerReady ? player.getDuration() : 0;
    const gap = r => vdur && r.duration ? Math.abs(vdur - r.duration) : 999;
    res = res.filter(r => r.syncedLyrics || r.plainLyrics)
      .sort((a, b) => ((!!b.syncedLyrics) - (!!a.syncedLyrics)) || (gap(a) - gap(b))).slice(0, 8);
    if (!res.length) {
      box.innerHTML = '<div class="notfound"><b>Letra não encontrada</b><span>Ainda não temos a letra desta música. Cole a letra e marque o ritmo uma única vez: ela fica salva para as próximas vezes.</span><button class="btn primary wide" id="goPaste">Colar letra</button></div>';
      $('#goPaste').onclick = () => $('#lyrTabs [data-tab=paste]').click();
      return;
    }
    const vd = playerReady ? player.getDuration() : 0;
    box.innerHTML = '';
    res.forEach(r => {
      const b = document.createElement('div'); b.className = 'item';
      const diff = vd && r.duration ? Math.abs(vd - r.duration) : 0;
      b.innerHTML = `<div class="meta"><b>${esc(r.trackName)} · ${esc(r.artistName)}</b><small>${r.syncedLyrics && vd && r.duration && diff <= 2 ? '<span class="badge">RECOMENDADA</span>' : r.syncedLyrics ? '<span class="badge">PRONTA</span>' : 'sem os tempos · você marca o ritmo'}${r.duration ? ' · ' + fmtDur(r.duration) : ''}${diff > 4 ? ' · versão diferente do vídeo' : ''}</small></div>`;
      b.onclick = () => {
        if (!r.syncedLyrics) return startSync(plainLines(r.plainLyrics));
        // a different duration usually means a clip intro / live / edited version: suggest the quick sync
        if (diff > 4) S.v.syncHint = Math.round(diff); else delete S.v.syncHint;
        setEntries(parseLRC(r.syncedLyrics), true);
      };
      box.appendChild(b);
    });
  } catch (e) {
    box.innerHTML = `<div class="notfound"><b>Não foi possível buscar a letra agora</b><span>${e.message === 'busy' ? 'Muitas buscas seguidas. Espere alguns segundos e tente de novo.' : 'Verifique a internet e tente de novo, ou cole a letra.'}</span><button class="btn primary wide" id="retryLrc">Tentar de novo</button></div>`;
    $('#retryLrc').onclick = searchLyrics;
  }
}
function setEntries(entries, save) {
  if (!entries || !entries.length) return;
  S.entries = entries;
  if (save) saveSong();
  applySongLang();
  S.phase = 'ready'; showPane('pReady'); renderReady();
}

/* ---------- song language: detected from the lyrics, saved per song, editable in Settings ---------- */
const LANG_WORDS = {
  en: "the you and i to my me it is in that your on be love all do we so don't i'm what like",
  es: 'el la que de y en no me tu te lo mi es por un una con para yo amor como pero',
  fr: "je tu le la les de et que pas un une est mon ma moi des il elle on c'est j'ai mais",
  it: 'il la che di e non mi ti un una per sono io amore come ma con questo',
  de: 'ich du und die der das nicht ist mich mir ein eine zu wir es dich auf mit',
  pt: 'eu você que não de e o a do da meu minha com pra tu um uma é mas'
};
const LANG_SETS = Object.fromEntries(Object.entries(LANG_WORDS).map(([k, v]) => [k, new Set(v.split(' '))]));
function detectLang(lines) {
  const txt = lines.join('\n');
  if (/[぀-ヿ]/.test(txt)) return 'ja';       // hiragana / katakana
  if (/[가-힯]/.test(txt)) return 'ko';       // hangul
  const words = txt.toLowerCase().replace(/[’‘]/g, "'").split(/[^\p{L}']+/u).filter(Boolean);
  const score = Object.fromEntries(Object.keys(LANG_SETS).map(k => [k, 0]));
  words.forEach(w => { for (const k in LANG_SETS) if (LANG_SETS[k].has(w)) score[k]++; });
  const [best, second] = Object.entries(score).sort((a, b) => b[1] - a[1]);
  return best[1] >= 5 && best[1] >= second[1] * 1.3 ? best[0] : null;   // not sure → keep the current setting
}
function applySongLang() {
  if (!S.v || !S.entries.length) return;
  if (!S.v.lang) {
    const d = detectLang(S.entries.filter(e => e.text).map(e => e.text));
    if (!d) return;
    S.v.lang = d; saveLib();
  }
  if (settings.lang !== S.v.lang) {
    settings.lang = S.v.lang; saveSettings();
    toast(`Idioma da música: ${LANG_NAME[S.v.lang] || S.v.lang}`);
  }
}
function saveSong() {
  const v = S.v; v.lrc = toLRC(S.entries); v.offset = S.offset; v.updated = Date.now(); saveLib();
}
const DIFF_LABEL = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };
function renderReady() {
  const n = S.entries.filter(e => e.text).length;
  $('#rLines').textContent = n;
  $('#rBest').textContent = (S.v && S.v.best) || '—';
  $('#rLevel').textContent = DIFF_LABEL[settings.difficulty];
  const mark = (id, val) => $$(id + ' button').forEach(b => b.classList.toggle('on', b.dataset.v === String(val)));
  mark('#rdPace', settings.pace); mark('#rdMode', settings.mode); mark('#rdDiff', settings.difficulty);
  const hint = $('#syncHint');
  if (S.v && S.v.syncHint) {
    hint.innerHTML = `<div class="synchint"><b>A letra pode estar fora do ritmo</b><span>Ela é de uma versão um pouco diferente deste vídeo. Se o texto aparecer adiantado ou atrasado, acerte com um ou dois toques.</span>
      <div class="sheetbtns"><button class="btn primary" id="qsGo">Sincronia rápida</button><button class="btn" id="qsDismiss">Está certa</button></div></div>`;
    $('#qsGo').onclick = sheetQuickSync;
    $('#qsDismiss').onclick = () => { delete S.v.syncHint; saveLib(); renderReady(); };
  } else hint.innerHTML = '';
  $('#songTrBtn').innerHTML = icon('spark', 'spk') + (S.v && S.v.aiSong ? 'Ver a tradução' : 'Traduzir a música');
  $('#songTrBtn').classList.toggle('hidden', settings.lang === 'pt');
  $('#readyInfo').textContent = (settings.pace === 'flow'
    ? 'A música não para: responda enquanto o verso toca. Erros só aparecem no final.'
    : 'O vídeo pausa no fim de cada frase. Acertou, continua. Errou, a frase toca de novo.')
    + ` Cada palavra certa vale 1 ponto e terminar a música vale +${SONG_BONUS}.`;
}
/* ================= quick sync (1–2 taps) ================= */
/* The app can't hear the YouTube audio (cross-origin player) and video captions aren't reachable from the browser,
   so fully automatic alignment isn't possible. Instead: tap once when the voice starts the 1st verse (shifts the whole
   lyric), and optionally once more on a later verse (also corrects speed, for slowed/sped/live versions). */
function sheetQuickSync() {
  if (!S.entries.length || !playerReady) return;
  if (inSession()) quitGame();
  const lines = S.entries.filter(e => e.text);
  if (lines.length < 2) return;
  const first = lines[0], later = lines[Math.max(1, Math.floor(lines.length * 0.75))];
  const vd = player.getDuration() || 0, lrcEnd = S.entries[S.entries.length - 1].t;
  const guess = vd > lrcEnd + 3 ? Math.min(vd - lrcEnd - 2, 60) : 0;   // longer video: probably an intro before the song
  let step = 1, tap1 = null;
  const cue = t => { player.seekTo(Math.max(0, t), true); player.playVideo(); };
  const stop = () => { if (playerReady) player.pauseVideo(); };
  const apply = (t1, t2) => {
    let a = 1;
    if (t2 != null) {
      const k = (t2 - t1) / (later.t - first.t);
      if (k > 0.8 && k < 1.25) a = k; else toast('O segundo toque ficou fora do esperado e não foi usado');
    }
    S.entries = S.entries.map(e => ({ ...e, t: Math.max(0, +(a * (e.t - first.t) + t1).toFixed(2)) }));
    S.offset = 0; delete S.v.syncHint;
    saveSong(); closeSheet(); stop(); renderReady();
    toast(a !== 1 ? 'Letra sincronizada e velocidade ajustada' : 'Letra sincronizada');
  };
  const render = () => {
    const ln = step === 1 ? first : later;
    openSheet(`<h3>Sincronia rápida</h3>
      <div class="qsstep">Passo ${step} de 2${step === 2 ? ' · opcional' : ''}</div>
      <p class="caption center-text" style="margin-top:4px">${step === 1 ? 'Toque em <b>AGORA</b> no instante em que a voz começar este verso:' : 'Para acertar também a velocidade, toque quando a voz começar este verso:'}</p>
      <div class="adjline qsline">${esc(ln.text)}</div>
      <div class="qsbox"><button class="markbtn" data-a="now"><span>AGORA</span></button></div>
      <div class="chips center-row"><button class="chip" data-a="back">−5s</button><button class="chip" data-a="pp">Play/Pausa</button><button class="chip" data-a="fwd">+5s</button></div>
      <div class="sheetbtns">${step === 2 ? '<button class="btn" data-a="skip">Pular e salvar</button>' : ''}<button class="btn" data-a="cancel">Cancelar</button></div>
      <p class="caption center-text">Perdeu o momento? Volte 5s e toque de novo.</p>`, {
      now: () => {
        const t = player.getCurrentTime() - 0.2;   // average reaction time
        if (step === 1) { tap1 = t; step = 2; render(); cue(tap1 + (later.t - first.t) - 6); }
        else apply(tap1, t);
      },
      back: () => cue(player.getCurrentTime() - 5),
      fwd: () => cue(player.getCurrentTime() + 5),
      pp: () => player.getPlayerState() === YT.PlayerState.PLAYING ? player.pauseVideo() : player.playVideo(),
      skip: () => apply(tap1, null),
      cancel: () => { closeSheet(); stop(); }
    }, stop);
  };
  render();
  cue(first.t + guess - 6);
}

/* ================= sync mode ================= */
function startSync(lines) {
  if (!lines.length) { toast('Nenhuma linha de letra encontrada.'); return; }
  S.sync = { lines, idx: 0, entries: [] };
  S.phase = 'sync'; showPane('pSync'); renderSync();
  if (playerReady) { player.pauseVideo(); player.seekTo(0, true); }
}
function renderSync() {
  const { lines, idx } = S.sync;
  $('#syncProg').textContent = `${Math.min(idx, lines.length)} / ${lines.length}`;
  $('#sPrev').textContent = lines[idx - 1] || '';
  if (idx < lines.length) {
    $('#sCur').textContent = lines[idx];
    $('#sNext').textContent = lines[idx + 1] || '(última frase)';
    $('#sMark').innerHTML = '<span>MARCAR</span>';
  } else {
    $('#sCur').textContent = 'Toque quando a última frase terminar';
    $('#sNext').textContent = '';
    $('#sMark').innerHTML = '<span>FIM ✓</span>';
  }
}
function syncMark() {
  if (!playerReady) return;
  if (player.getPlayerState() !== YT.PlayerState.PLAYING && !S.sync.entries.length) { player.playVideo(); return; }
  const { lines, entries } = S.sync;
  const t = Math.max(0, player.getCurrentTime() - 0.15);
  if (S.sync.idx < lines.length) { entries.push({ t, text: lines[S.sync.idx] }); S.sync.idx++; renderSync(); }
  else {
    entries.push({ t: t + 0.15, text: '' });
    player.pauseVideo();
    S.offset = 0;
    S.entries = entries.slice().sort((a, b) => a.t - b.t);
    saveSong(); toast('Letra sincronizada e salva ✓');
    S.phase = 'ready'; showPane('pReady'); renderReady();
  }
}
function syncGap() {
  if (!playerReady || !S.sync.entries.length) return;
  const last = S.sync.entries[S.sync.entries.length - 1];
  if (!last.text) return;
  S.sync.entries.push({ t: player.getCurrentTime(), text: '' }); toast('Fim de frase marcado');
}
function syncUndo() {
  const e = S.sync.entries.pop(); if (!e) return;
  if (e.text) S.sync.idx--;
  renderSync();
  if (playerReady) player.seekTo(Math.max(0, e.t - 3), true);
}

/* ================= game ================= */
/* Japanese / Chinese have no spaces between words: split with the browser's word segmenter (Intl.Segmenter).
   Korean uses spaces, so it goes through the normal path. */
const NO_SPACE_SCRIPT = /[぀-ヿ㐀-鿿]/;
const segmenters = {};
function tokenize(text) {
  if (NO_SPACE_SCRIPT.test(text) && typeof Intl !== 'undefined' && Intl.Segmenter) {
    const loc = settings.lang === 'zh' ? 'zh' : 'ja';
    const seg = segmenters[loc] || (segmenters[loc] = new Intl.Segmenter(loc, { granularity: 'word' }));
    return [...seg.segment(text)].map(s => s.isWordLike
      ? { raw: s.segment, pre: '', core: s.segment, post: '', word: /\p{L}/u.test(s.segment), cjk: NO_SPACE_SCRIPT.test(s.segment) }
      : { raw: s.segment, ws: true });
  }
  return text.split(/(\s+)/).filter(s => s !== '').map(raw => {
    if (/^\s+$/.test(raw)) return { raw, ws: true };
    const m = raw.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u);
    return { raw, pre: m[1], core: m[2], post: m[3], word: /\p{L}/u.test(m[2]) };
  });
}
function buildLines() {
  const E = S.entries, lines = [], seen = new Map();
  const dur = playerReady ? player.getDuration() : 0;
  for (let i = 0; i < E.length; i++) {
    if (!E[i].text) continue;
    const tokens = tokenize(E[i].text);
    tokens.forEach(tk => { if (tk.word && tk.core.length >= (tk.cjk ? 1 : 2)) { const k = norm(tk.core); if (k && !seen.has(k)) seen.set(k, tk.core); } });
    // entry: the LRC entry this verse comes from, so its timing can be edited and saved later
    lines.push({ entry: E[i], t: E[i].t, end: lineEnd(E, i, dur), text: E[i].text, tokens, blanks: [], blankMap: {}, tr: trOf(E[i].text) });
  }
  S.lines = lines; S.pool = [...seen.values()];
  return lines;
}
/* A verse ends where the next LRC entry starts. An empty entry is an explicit "verse ends here" marker
   (from sync or from the verse timing editor) and is respected as is; otherwise the verse lasts at most 10s. */
function lineEnd(E, i, dur) {
  const t = E[i].t, next = E[i + 1];
  let end = next ? next.t : (dur || t + 6);
  if (!next || next.text) end = Math.min(end, t + 10);
  return Math.max(end, t + 0.6);
}
function retimeLines() {
  const E = S.entries, dur = playerReady ? player.getDuration() : 0;
  S.lines.forEach(l => { const i = E.indexOf(l.entry); if (i >= 0) { l.t = E[i].t; l.end = lineEnd(E, i, dur); } });
}

/* ================= verse timing editor ================= */
/* When the lyric is a bit off (the quiz stops before the verse is fully sung), the player fixes that verse:
   listen, nudge or tap-mark the start/end, save. The fix is written into the song's LRC. */
function verseBounds(line) {
  const E = S.entries, i = E.indexOf(line.entry), dur = playerReady ? player.getDuration() : 0;
  let p = i - 1; while (p >= 0 && !E[p].text) p--;
  let j = i + 1; while (E[j] && !E[j].text) j++;
  const after = E[j] && E[j + 1];                       // whatever follows the next verse
  return {
    minStart: p >= 0 ? E[p].t + 0.5 : 0,
    // the end may push the next verse later, but never past what comes after it
    maxEnd: after ? after.t - 0.5 : E[j] ? (dur || E[j].t + 30) - 0.3 : (dur || line.t + 30)
  };
}
function sheetAdjustVerse(idx) {
  const line = S.lines[idx]; if (!line || !line.entry) return;
  const wasWaiting = S.waiting;
  if (playerReady) player.pauseVideo();
  S.waiting = false; setRing(0);
  const b = verseBounds(line);
  const A = S.adjust = { idx, line, start: line.t, end: line.end, mode: null, b, wasWaiting };
  const clamp = () => {
    A.start = Math.max(b.minStart, Math.min(A.start, A.end - 0.5));
    A.end = Math.max(A.start + 0.5, Math.min(A.end, b.maxEnd));
  };
  const paint = () => {
    $('#adjStart').textContent = fmt(Math.max(0, A.start));
    $('#adjEnd').textContent = fmt(Math.max(0, A.end));
    $('#adjDur').textContent = (A.end - A.start).toFixed(1) + 's';
    const changed = Math.abs(A.start - line.t) > 0.01 || Math.abs(A.end - line.end) > 0.01;
    $('#sheetContent [data-a=save]').disabled = !changed;
    const lab = { preview: ['■ Parar', 'Marcar início', 'Marcar fim'], markStart: ['▶ Ouvir o verso', '● Começou agora!', 'Marcar fim'], markEnd: ['▶ Ouvir o verso', 'Marcar início', '● Terminou agora!'] }[A.mode] || ['▶ Ouvir o verso', 'Marcar início', 'Marcar fim'];
    ['play', 'mstart', 'mend'].forEach((k, n) => { const el = $(`#sheetContent [data-a=${k}]`); el.textContent = lab[n]; el.classList.toggle('live', lab[n].startsWith('●')); });
  };
  A.paint = paint;
  const step = (k, d) => () => { A.mode = null; player.pauseVideo(); A[k] += d; clamp(); paint(); };
  const play = (from, mode) => { A.mode = mode; seekLyric(from); player.playVideo(); paint(); };
  const close = save => {
    if (save) applyVerseTiming(line, A.start, A.end);
    S.adjust = null; closeSheet();
    const l = S.lines[idx];
    if (S.phase === 'karaoke') { markKarCur(); seekLyric(l.t - 0.8); player.playVideo(); return; }
    // replay the verse with its (new) timing: in Pause mode it stops again at the end, now in the right place
    S.hold = idx; S.cur = idx; seekLyric(l.t - 0.8); player.playVideo(); renderGame();
    if (save) setStatus('Tempo do verso salvo', 'info');
  };
  openSheet(`<h3>Ajustar tempo do verso</h3>
    <div class="adjline">${S.phase === 'play' ? lineHTML(line, false, false) : esc(line.text)}</div>
    <p class="caption center-text" style="margin-top:4px">Verso ${idx + 1} de ${S.lines.length}. Deixe o verso tocar inteiro e terminar logo depois da última palavra.</p>
    <div class="adjgrid">
      <span>Começa</span><div class="stepper"><button data-a="s1">−</button><b id="adjStart"></b><button data-a="s2">+</button></div>
      <span>Termina</span><div class="stepper"><button data-a="e1">−</button><b id="adjEnd"></b><button data-a="e2">+</button></div>
    </div>
    <p class="caption center-text" style="margin-top:2px">Cada toque em − / + move 0,25s · duração <b id="adjDur"></b></p>
    <button class="btn tonal wide" data-a="play"></button>
    <div class="sheetbtns" style="margin-top:8px"><button class="btn" data-a="mstart"></button><button class="btn" data-a="mend"></button></div>
    <p class="caption" style="margin-top:8px"><b>Marcar:</b> toque e o trecho começa a tocar. Toque de novo no instante em que a voz começa (ou termina).</p>
    <div class="sheetbtns"><button class="btn" data-a="cancel">Cancelar</button><button class="btn primary" data-a="save">Salvar este verso</button></div>
    <div class="grouplabel">A música toda está fora?</div>
    <div class="group"><div class="grow"><span>Sincronia geral<small>Use − se toda a letra aparece antes da voz</small></span><div class="stepper"><button data-a="offm">−</button><span id="offVal">${(S.offset >= 0 ? '+' : '') + S.offset.toFixed(1)}s</span><button data-a="offp">+</button></div></div></div>`, {
    s1: step('start', -0.25), s2: step('start', 0.25), e1: step('end', -0.25), e2: step('end', 0.25),
    play: () => { if (A.mode === 'preview') { A.mode = null; player.pauseVideo(); paint(); } else play(A.start - 0.4, 'preview'); },
    mstart: () => {
      if (A.mode === 'markStart') { A.start = lyricTime() - 0.15; A.mode = null; player.pauseVideo(); clamp(); paint(); }
      else play(Math.max(b.minStart - 0.5, A.start - 3), 'markStart');
    },
    mend: () => {
      if (A.mode === 'markEnd') { A.end = lyricTime(); A.mode = null; player.pauseVideo(); clamp(); paint(); }
      else play(A.start - 0.4, 'markEnd');
    },
    offm: () => nudge(-0.2), offp: () => nudge(0.2),
    cancel: () => close(false), save: () => close(true)
  }, () => close(false));
  paint();
}
/* runs instead of the game tick while the editor is open: stop the preview at the verse end */
function adjustTick(L) {
  const A = S.adjust;
  if (A.mode === 'preview' && L >= A.end) { A.mode = null; player.pauseVideo(); A.paint(); }
  if (A.mode === 'markEnd' && L > A.b.maxEnd) { A.mode = null; player.pauseVideo(); A.paint(); }
}
function applyVerseTiming(line, start, end) {
  const E = S.entries, e = line.entry;
  e.t = start;
  for (let k = E.indexOf(e) - 1; k >= 0 && !E[k].text; k--) if (E[k].t > start) E[k].t = start;   // earlier end marker can't pass the new start
  const i = E.indexOf(e);
  let j = i + 1; while (E[j] && !E[j].text) E.splice(j, 1);      // old end markers of this verse
  const nt = E[j];
  if (nt && end >= nt.t - 0.05) nt.t = end;                       // the verse runs into the next one: the next one starts later
  else E.splice(j, 0, { t: end, text: '' });                      // a pause before the next verse: mark where this one ends
  E.sort((a, b) => a.t - b.t);
  saveSong(); retimeLines();
  toast('Tempo do verso salvo');
}
function buildGame() {
  const lines = buildLines();
  const diff = settings.difficulty;
  lines.forEach(line => {
    if (diff === 'facil' && Math.random() > 0.6) return;
    const words = line.tokens.map((tk, i) => ({ tk, i })).filter(x => x.tk.word);
    // Japanese words are short (1–3 characters, e.g. 君 / 声 / 聞こえる); particles (は / が / を…) are in STOP
    let cand = words.filter(x => x.tk.core.length >= (x.tk.cjk ? 1 : 3) && !STOP.has(norm(x.tk.core)));
    if (!cand.length) cand = words.filter(x => x.tk.core.length >= (x.tk.cjk ? 1 : 2));
    if (!cand.length) return;
    const long = x => x.tk.core.length >= (x.tk.cjk ? 2 : 4);   // prefer meatier words
    cand = shuffle(cand).sort((a, b) => long(b) - long(a));
    const count = diff === 'dificil' && words.length >= 5 ? 2 : 1;
    const pick = [];
    for (const c of cand) { if (pick.length >= count) break; if (!pick.some(p => Math.abs(p.i - c.i) < 3)) pick.push(c); }
    pick.sort((a, b) => a.i - b.i).forEach(p => {
      const b = { ti: p.i, answer: p.tk.core, solved: false, missed: false, attempts: 0, hint: 0, options: null, removed: new Set() };
      line.blanks.push(b); line.blankMap[p.i] = b;
    });
  });
}
const activeBlank = line => line && line.blanks.find(b => !b.solved);
const hasUnsolved = line => !!activeBlank(line);

function applyMode() {
  $('#pad').classList.toggle('hidden', settings.mode !== 'choice');
  $('#answerForm').classList.toggle('hidden', settings.mode !== 'type');
}
async function startGame() {
  if (!playerReady) { toast('O vídeo ainda está carregando…'); return; }
  buildGame();
  Object.assign(S, { phase: 'play', cur: -1, maxCur: -1, backAt: 0, backTarget: null, hold: null, waiting: false, finished: false, score: 0, ok: 0, miss: 0, streak: 0, bestStreak: 0 });
  showPane('pGame'); document.body.classList.add('playing'); closeSheet();
  applyMode();
  $('#gSpeed').innerHTML = `<b>${settings.speed}x</b><span>Velocidade</span>`;
  if (S.lines[0]) translateLine(S.lines[0]);
  setStatus('Ouça e complete', 'info');
  player.seekTo(0, true); player.setPlaybackRate(settings.speed); player.playVideo();
  renderGame();
  window.scrollTo(0, 0);
  if (settings.mode === 'type' && !isTouch) $('#answer').focus();
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { }
}
function endPlay() {
  document.body.classList.remove('playing');
  S.adjust = null;
  $('#skipIntro').classList.add('hidden');
  try { wakeLock && wakeLock.release(); } catch { } wakeLock = null;
}
function quitGame() {
  if (playerReady) player.pauseVideo();
  endPlay();
  S.phase = 'ready'; showPane('pReady'); renderReady();
}
/* "Encerrar": pause, confirm, and show the partial result (no song bonus). */
function confirmQuit() {
  if (!inSession()) return;
  const wasPlaying = playerReady && player.getPlayerState() === YT.PlayerState.PLAYING;
  if (playerReady) player.pauseVideo();
  const kar = S.phase === 'karaoke';
  openSheet(`<h3>Encerrar ${kar ? 'o karaokê' : 'a música'}?</h3>
    ${kar ? '' : `<p class="muted" style="text-align:center;margin:0 0 6px">Até agora: <b>${S.ok}</b> certa${S.ok === 1 ? '' : 's'} · <b>${S.miss}</b> erro${S.miss === 1 ? '' : 's'}.<br>As palavras certas já contam no seu progresso. O bônus de +${SONG_BONUS} é só para quem termina a música.</p>`}
    <div class="sheetbtns" style="flex-direction:column">
      <button class="btn primary" data-a="end">${kar ? 'Encerrar' : 'Encerrar e ver resultado'}</button>
      <button class="btn" data-a="cont">Continuar ${kar ? 'cantando' : 'jogando'}</button>
    </div>`, {
    end: () => { closeSheet(); if (kar) quitGame(); else showResults(false); },
    cont: () => { closeSheet(); resumeAfter(); }
  }, () => resumeAfter());
  function resumeAfter() { if (wasPlaying && !S.waiting) player.playVideo(); }
}
/* Skip the clip intro / long instrumental: jump to just before the next sung line. */
function nextLineGap(L) {
  const next = S.lines[S.cur + 1], cur = S.lines[S.cur];
  if (!next || S.waiting || (cur && L < cur.end)) return null;   // never cut a verse that is still being sung
  const gap = next.t - L;
  return gap > 5 ? { next, gap } : null;
}
function updateSkipIntro(L) {
  const g = nextLineGap(L), b = $('#skipIntro');
  b.classList.toggle('hidden', !g);
  if (g) {
    const txt = `${S.cur < 0 ? 'Pular para a letra' : 'Pular instrumental'} · ${Math.ceil(g.gap)}s`;
    if (b.dataset.txt !== txt) { b.dataset.txt = txt; b.innerHTML = icon('skip') + `<span>${txt}</span>`; }
  }
}
function skipToLyrics() {
  if (!playerReady || !inSession()) return;
  const g = nextLineGap(lyricTime()); if (!g) return;
  seekLyric(g.next.t - 1.5); player.playVideo();
  $('#skipIntro').classList.add('hidden');
}
const lyricTime = () => player.getCurrentTime() + S.offset;
const seekLyric = t => player.seekTo(Math.max(0, t - S.offset), true);
// feedback text goes to a screen-reader-only live region; on screen, colours, shakes and the ring already show it
function setStatus(msg) { $('#status').textContent = msg; }
function flash(cls) { const el = $('#lCur'); el.classList.remove('flash-ok', 'flash-bad'); void el.offsetWidth; el.classList.add(cls); }
function setRing(frac) { $$('.replayBtn .ring circle').forEach(c => c.style.strokeDashoffset = 226 * (1 - Math.max(0, Math.min(1, frac)))); }

function currentIdx(L) {
  let idx = -1;
  for (let i = 0; i < S.lines.length; i++) { if (S.lines[i].t <= L) idx = i; else break; }
  if (S.hold != null) {          // pre-roll before a replayed line: keep showing it
    const h = S.lines[S.hold];
    if (L < h.t - 2 || L > h.end) S.hold = null; else if (L < h.t) idx = S.hold; else S.hold = null;
  }
  return idx;
}
function enterLine(idx) {
  if (S.backTarget != null && idx >= S.maxCur && Date.now() - S.backAt > 300) { S.backTarget = null; setStatus('', ''); } // caught up again
  S.cur = idx;
  if (idx > S.maxCur && idx >= 0) stat('lines');
  S.maxCur = Math.max(S.maxCur, idx);
  // the translation is shown under the verse being sung, so fetch this one and prefetch the next
  if (S.lines[idx]) translateLine(S.lines[idx]);
  if (S.lines[idx + 1]) translateLine(S.lines[idx + 1]);
  renderGame();
}
/* individual counters: 1 point per correct word, nothing else */
function hitBlank(b) {
  b.solved = true; S.ok++; S.score++; S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak); stat('words');
}
function missBlank(b, soft = false) {
  if (b.solved) return;
  b.solved = b.missed = true; if (soft) b.soft = true;
  S.miss++; S.streak = 0; stat('misses');
}
function checkFinish(idx, L) {
  const last = S.lines[S.lines.length - 1];
  if (!S.finished && last && idx === S.lines.length - 1 && !hasUnsolved(last) && L > last.end + 3) finish();
}
/* Flow mode: the music never stops. Unanswered gaps are revealed quietly when the line ends. */
function tickFlow(L) {
  const idx = currentIdx(L);
  if (idx > S.cur) {
    for (let i = Math.max(0, S.cur); i < idx; i++) {
      S.lines[i].blanks.forEach(b => missBlank(b, true));
    }
  }
  if (idx !== S.cur) enterLine(idx);
  const line = S.lines[S.cur];
  setRing(line && hasUnsolved(line) ? 1 - (L - line.t) / Math.max(0.5, line.end - line.t) : 0);
  const last = S.lines[S.lines.length - 1];
  if (last && S.cur === S.lines.length - 1 && L > last.end && hasUnsolved(last)) { last.blanks.forEach(b => missBlank(b, true)); renderGame(); }
  checkFinish(idx, L);
}
let lastTick = Date.now();
function tick() {
  const now = Date.now(), dt = now - lastTick; lastTick = now;
  if (!inSession() || !playerReady) return;
  if (S.adjust) return adjustTick(lyricTime());
  if (dt < 1000 && player.getPlayerState() === YT.PlayerState.PLAYING) { S.msAcc = (S.msAcc || 0) + dt; if (S.msAcc > 10000) { stat('ms', S.msAcc); S.msAcc = 0; } }
  const st = player.getPlayerState();
  const L = lyricTime();
  updateSkipIntro(L);
  if (S.phase === 'karaoke') return tickKaraoke(L);
  const adjBtn = $('#lCur .tradj'); if (adjBtn) adjBtn.classList.toggle('hot', !!S.waiting);   // paused for an answer: when a cut verse gets noticed
  if (settings.pace === 'flow') return tickFlow(L);
  const cur = S.lines[S.cur];
  if (cur && hasUnsolved(cur) && st === YT.PlayerState.PLAYING && L >= cur.end - 0.15 && L < cur.end + 1.5) { pauseForAnswer(); return; }
  if (S.waiting) {
    if (st === YT.PlayerState.PLAYING && cur && L < cur.end - 0.4) { S.waiting = false; setRing(0); }
    else {
      const w = settings.autoReplay * 1000;
      if (w && cur) {
        const el = Date.now() - S.lastActivity;
        setRing(el / w);
        if (el >= w) { setStatus('Ouvindo de novo…', 'info'); replayLine(); }
      }
      return;
    }
  }
  const idx = currentIdx(L);
  if (idx !== S.cur) enterLine(idx);
  checkFinish(idx, L);
}
setInterval(tick, 50);

function pauseForAnswer() {
  player.pauseVideo();
  S.waiting = true; S.lastActivity = Date.now();
  const b = activeBlank(S.lines[S.cur]);
  setStatus(b && b.attempts ? `Tente de novo · ${b.attempts}/3` : 'Qual é a palavra?', 'info');
  if (settings.mode === 'type') $('#answer').focus();
}
function replayLine() {
  setRing(0);
  const line = S.lines[S.cur]; if (!line) { seekLyric(0); player.playVideo(); return; }
  S.waiting = false; S.hold = S.cur;
  seekLyric(line.t - 0.8); player.playVideo();
}
/* Back button: jump to the previous verse; quick repeated taps keep going back. The music continues from there. */
function goBackVerse() {
  if (!playerReady || S.phase !== 'play' || !S.lines.length) return;
  const now = Date.now();
  const from = (now - S.backAt < 2500 && S.backTarget != null) ? S.backTarget : Math.max(0, S.cur);
  const target = Math.max(0, from - 1);
  S.backAt = now; S.backTarget = target;
  S.waiting = false; setRing(0);
  S.hold = target;
  seekLyric(S.lines[target].t - 0.3);
  player.playVideo();
  enterLine(target);
  setStatus(`Verso ${target + 1} de ${S.lines.length}`, 'info');
}
function resume() { S.waiting = false; setRing(0); player.playVideo(); }

/* Answer feedback: the tapped option turns green or shakes red (and the right one lights up when revealed),
   the verse shakes, the typing box shakes, the phone vibrates. The pad is held still for a moment so the
   player can see it before the next options appear. */
let padFreezeUntil = 0, padFreezeT = null;
function answerFeedback(value, ok, reveal = null) {
  if (ok) { flash('flash-ok'); beep(true); }
  else {
    flash('flash-bad'); beep(false);
    try { navigator.vibrate && navigator.vibrate(70); } catch { }
    const a = $('#answer'); a.classList.remove('shake'); void a.offsetWidth; a.classList.add('shake');
  }
  if (settings.mode !== 'choice') return;
  const ms = ok ? 450 : 950;
  padFreezeUntil = Date.now() + ms;
  $$('#pad .opt').forEach(btn => {
    btn.classList.remove('pick-ok', 'pick-bad', 'pick-right'); void btn.offsetWidth;
    const t = norm(btn.textContent);
    if (t === norm(value)) btn.classList.add(ok ? 'pick-ok' : 'pick-bad');
    else if (reveal && t === norm(reveal)) btn.classList.add('pick-right');
  });
  clearTimeout(padFreezeT); padFreezeT = setTimeout(renderGame, ms + 20);
}
function submitAnswer(value) {
  const line = S.lines[S.cur]; const b = activeBlank(line);
  if (!b) return;
  const v = judge(value, b.answer);
  if (v === 'empty') return;
  if (settings.pace === 'flow') return submitFlow(line, b, v, value);
  if (v === 'exact' || v === 'close') {
    hitBlank(b);
    setStatus(v === 'close' ? `Quase! Era “${b.answer}” · +1` : `Isso! +1`, 'good');
    answerFeedback(value, true);
    $('#answer').value = '';
    if (!hasUnsolved(line)) { translateLine(line); if (S.waiting) resume(); }
  } else {
    b.attempts++; S.streak = 0;
    answerFeedback(value, false, b.attempts >= 3 ? b.answer : null);
    if (settings.mode === 'choice') b.removed.add(norm(value));
    if (b.attempts >= 3) {
      missBlank(b);
      setStatus(`A palavra era “${b.answer}”. Ouça de novo`, 'bad');
      $('#answer').value = '';
      if (!hasUnsolved(line)) translateLine(line);
      replayLine();
    } else if (S.waiting) {
      setStatus(`Não é “${value}” · voltando… ${b.attempts}/3`, 'bad');
      $('#answer').select();
      setTimeout(() => { if (S.phase === 'play') replayLine(); }, 650);
    } else {
      setStatus(`Não é “${value}” · ${b.attempts}/3`, 'bad');
      $('#answer').select();
    }
  }
  renderGame();
}
/* Flow: no rewinds. Right = +1. Wrong = a quick red shake, then the word is revealed and the music goes on. */
function submitFlow(line, b, v, value) {
  if (v === 'exact' || v === 'close') {
    hitBlank(b);
    setStatus(S.streak >= 3 ? `+1 · ${S.streak} seguidas` : '+1', 'good');
    answerFeedback(value, true);
    $('#answer').value = '';
  } else if (settings.mode === 'choice') {
    missBlank(b, true);
    setStatus(`✗ Era “${b.answer}”`, 'bad');
    answerFeedback(value, false, b.answer);
  } else {
    b.attempts++;            // typing: let the player try again until the line ends
    setStatus(`✗ Não é “${value}”`, 'bad');
    answerFeedback(value, false);
    $('#answer').value = '';
  }
  renderGame();
}
function giveHint() {
  const b = activeBlank(S.lines[S.cur]); if (!b) return;
  if (settings.mode === 'choice') {
    const wrong = (b.options || []).filter(o => norm(o) !== norm(b.answer) && !b.removed.has(norm(o)));
    if (wrong.length > 1) { b.removed.add(norm(wrong[0])); b.hint++; }
  } else if (b.hint < b.answer.length - 1) b.hint++;
  renderGame();
}
function skipBlank() {
  const line = S.lines[S.cur]; if (!line) return;
  line.blanks.forEach(b => missBlank(b));
  setStatus('Pulado', '');
  translateLine(line); renderGame();
  if (S.waiting) resume();
}
function makeOptions(b, line) {
  const ans = norm(b.answer);
  const inLine = new Set(line ? line.tokens.filter(t => t.word).map(t => norm(t.core)) : []);
  let others = S.pool.filter(w => norm(w) !== ans && !inLine.has(norm(w)));
  if (others.length < 3) others = S.pool.filter(w => norm(w) !== ans);
  const close = shuffle(others.slice()).sort((x, y) => Math.abs(x.length - b.answer.length) - Math.abs(y.length - b.answer.length)).slice(0, 10);
  const opts = shuffle(close).slice(0, 3); opts.push(b.answer);
  return shuffle(opts);
}
function lineHTML(line, isCur, withTr) {
  if (!line) return '';
  const act = isCur ? activeBlank(line) : null;
  let h = line.tokens.map((tk, i) => {
    const b = line.blankMap[i];
    if (!b) return esc(tk.raw);
    let inner;
    if (b.solved) inner = `<span class="${b.soft ? 'reveal' : b.missed ? 'miss' : 'ok'}">${esc(b.answer)}</span>`;
    else { const shown = b.answer.slice(0, b.hint); inner = `<span class="gap${b === act ? ' active' : ''}">${esc(shown)}${'_'.repeat(b.answer.length - shown.length)}</span>`; }
    return esc(tk.pre) + inner + esc(tk.post);
  }).join('');
  const idx = S.lines.indexOf(line);
  // current verse: a clock icon next to ✎ / ✨ adjusts this verse's timing (cut-off verses)
  const adj = isCur && S.phase === 'play' ? `<button class="tradj${S.waiting ? ' hot' : ''}" data-adj="${idx}" title="Ajustar o tempo deste verso" aria-label="Ajustar o tempo deste verso">${icon('sync')}</button>` : '';
  const btns = inner => inner ? `<span class="trbtns">${inner}</span>` : '';
  if (withTr && settings.translate && settings.lang !== 'pt') {
    h += `<div class="tr${isCur ? ' trcur' : ''}">${line.tr
      ? esc(line.tr) + btns(trFixBtn(`data-trfix="${idx}"`) + trAiBtn(`data-trai="${idx}"`) + adj)
      : (isCur && !line.trFail ? '<span class="trwait">traduzindo…</span>' : '') + btns(adj)}</div>`;
  } else if (adj) h += `<div class="tr trcur">${btns(adj)}</div>`;
  return h;
}
const DIRS = ['up', 'left', 'right', 'down'];
function renderGame() {
  if (S.phase !== 'play') return;
  const i = S.cur, L = S.lines;
  const prev = L[i - 1];
  // previous-verse card: the player can fold it into a small pill (choice remembered, no Settings needed)
  const showPrev = settings.showPrev !== false;
  $('#lPrev').innerHTML = !prev ? '' : showPrev
    ? `<button class="prevfold" data-prevtog title="Esconder verso anterior" aria-label="Esconder verso anterior">${icon('chev')}</button>`
      + lineHTML(prev, false, true) + bmBtn(!!findPhrase(S.videoId, prev.text), `data-bm="${i - 1}"`)
    : `<button class="prevpill" data-prevtog aria-label="Mostrar verso anterior">${icon('chev')}<span>Verso anterior</span></button>`;
  $('#lPrev').classList.toggle('empty', !prev);
  $('#lPrev').classList.toggle('folded', !!prev && !showPrev);
  // a verse revisited with the back button shows its answers + translation (nothing left to answer)
  const revisit = i >= 0 && i < S.maxCur && !hasUnsolved(L[i]);
  $('#lCur').innerHTML = i < 0 ? '<span class="muted">Prepare-se…</span>'
    : lineHTML(L[i], true, true) + (revisit ? ' ' + bmBtn(!!findPhrase(S.videoId, L[i].text), `data-bm="${i}" style="position:static;transform:none;display:inline-grid;vertical-align:middle"`) : '');
  $('#gBack').disabled = S.cur <= 0 && S.backTarget == null;
  $('#gSkip').classList.toggle('hidden', settings.pace === 'flow');
  $('#hudOk').textContent = S.ok; $('#hudMiss').textContent = S.miss; $('#hudStreak').textContent = S.streak;
  $('#progress').style.width = (L.length ? Math.max(0, (i + 1) / L.length * 100) : 0) + '%';
  const b = activeBlank(L[i]);
  $('#gHint').disabled = $('#gSkip').disabled = !b;
  if (settings.mode === 'choice' && Date.now() >= padFreezeUntil) {   // while frozen, keep showing the answer feedback
    if (b && !b.options) b.options = makeOptions(b, L[i]);
    $$('#pad .opt').forEach((btn, k) => {
      const o = b && b.options[k];
      const gone = o && b.removed.has(norm(o));
      btn.textContent = o || '';
      btn.className = `opt ${DIRS[k]}${o && o.length > 9 ? ' long' : ''}${gone ? ' wrong' : ''}`;
      btn.disabled = !o || gone;
    });
  }
}
/* Automatic translation: MyMemory first; when it fails or its free daily quota runs out (HTTP 429 /
   "MYMEMORY WARNING"), fall back to the alternative translator so no verse is left blank.
   The quota state is remembered for a few hours so we don't hit the exhausted service for every verse. */
let mmOffUntil = store.get('lg:mmOff', 0);
async function fetchTr(text) {
  if (settings.lang === 'pt') return null;
  const key = trKey(text);
  if (lib.trOverride[key]) return lib.trOverride[key];
  if (trCache[key]) return trCache[key];
  const keep = tx => { trCache[key] = tx; store.set('lg:tr', trCache); return tx; };
  if (Date.now() > mmOffUntil) {
    try {
      const r = await fetchT('https://api.mymemory.translated.net/get?' + new URLSearchParams({ q: text, langpair: settings.lang + '|pt-BR' }));
      const j = await r.json();
      const tx = j && j.responseData && j.responseData.translatedText;
      if (r.status === 429 || /MYMEMORY WARNING/i.test(tx || '')) { mmOffUntil = Date.now() + 6 * 3600e3; store.set('lg:mmOff', mmOffUntil); }
      else if (tx && !/INVALID/i.test(tx)) return keep(decode(tx));
    } catch { }
  }
  try { const g = await fetchGoogle(text, settings.lang); if (g) return keep(g); } catch { }
  return null;
}
async function translateLine(line, force = false) {
  if ((!settings.translate && !force) || line.tr || line.trBusy || line.trFail) return;
  line.trBusy = true;
  const tr = await fetchTr(line.text);
  line.trBusy = false;
  if (tr) line.tr = tr; else line.trFail = true;
  if (S.phase === 'karaoke') paintKarLine(S.lines.indexOf(line)); else renderGame();
}

/* ================= better translation ================= */
/* The automatic translation (MyMemory) is often literal. Next to every translation a ✎ button opens a panel to
   compare it with Google Translate or write your own; the choice is saved for that verse (and every repeat of it). */
const trFixBtn = attrs => `<button class="trfix" ${attrs} title="Melhorar tradução" aria-label="Melhorar tradução">${icon('edit')}</button>`;
const gCache = new Map();
async function fetchGoogle(text, lang) {
  const k = lang + '|' + text;
  if (gCache.has(k)) return gCache.get(k);
  // the public endpoint of Google Translate's web widget: no key, answers browser requests (unofficial, may change)
  const r = await fetchT('https://translate.googleapis.com/translate_a/single?' + new URLSearchParams({ client: 'gtx', sl: lang, tl: 'pt', dt: 't', q: text }), 8000);
  const j = await r.json();
  const tx = ((j && j[0]) || []).map(x => x[0]).join('').trim() || null;
  if (tx) gCache.set(k, tx);
  return tx;
}
function setTranslation(text, lang, tr, mine) {
  const key = trKey(text, lang);
  if (mine) lib.trOverride[key] = tr; else delete lib.trOverride[key];
  delete lib.aiNotes[key];   // a new choice replaces any AI translation/note (the AI flow sets its note right after)
  if (lang === settings.lang) S.lines.forEach(l => { if (l.text === text) { l.tr = tr; l.trFail = false; } });
  lib.phrases.forEach(p => { if (p.text === text && (p.lang || 'en') === lang) p.tr = tr; });
  saveLib();
}
/* ================= AI (Claude) ================= */
/* Optional. The user pastes their own Anthropic API key in Settings; it stays in this device's localStorage
   (never in the code, the repo or the library backup) and requests go straight from the browser to Anthropic.
   Official TypeScript SDK, loaded from the CDN on first use (pinned version). */
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.8.0/+esm';
const AI_MODELS = [['claude-haiku-5-5', 'Rápido'], ['claude-sonnet-5-5', 'Detalhado']];
let AnthropicSDK = null, aiClient = null, aiClientKey = '';
lib.aiNotes = lib.aiNotes || {};   // verse key -> short note about slang/idioms from the AI translation
async function getAI() {
  if (!settings.claudeKey) { const e = new Error('Sem chave'); e.code = 'nokey'; throw e; }
  if (!AnthropicSDK) { const mod = await import(SDK_URL); AnthropicSDK = mod.default || mod.Anthropic; }
  if (!aiClient || aiClientKey !== settings.claudeKey) {
    aiClient = new AnthropicSDK({ apiKey: settings.claudeKey, dangerouslyAllowBrowser: true });
    aiClientKey = settings.claudeKey;
  }
  return aiClient;
}
function aiErrorText(e) {
  const A = AnthropicSDK;
  if (e && e.code === 'nokey') return 'Ative a tradução inteligente em Configurações.';
  if (e && e.code === 'refusal') return 'Não foi possível gerar uma resposta para este trecho.';
  if (A) {   // most specific first; APIConnectionError is a subclass of APIError in the TS SDK
    if (e instanceof A.AuthenticationError) return 'Chave de acesso inválida. Confira em Configurações.';
    if (e instanceof A.PermissionDeniedError) return 'Esta chave não tem acesso a este recurso.';
    if (e instanceof A.NotFoundError) return 'Modo indisponível para esta chave. Troque o modo em Configurações.';
    if (e instanceof A.RateLimitError) return 'Limite de uso atingido. Tente de novo daqui a pouco.';
    if (e instanceof A.APIConnectionError) return 'Sem conexão. Verifique a internet.';
    if (e instanceof A.APIError) return 'Não foi possível concluir agora. Tente de novo em instantes.';
  }
  return 'Não foi possível concluir agora. Tente de novo em instantes.';
}
const LANG_NAME = { en: 'inglês', es: 'espanhol', fr: 'francês', it: 'italiano', de: 'alemão', pt: 'português', ja: 'japonês', ko: 'coreano' };
const songContext = () => {
  const lines = S.entries.filter(e => e.text).map(e => e.text);
  return `Música: "${(S.v && S.v.title) || ''}"${S.v && S.v.author ? ' — ' + S.v.author : ''}\nLetra completa (para contexto):\n${lines.join('\n')}`;
};
const textOf = msg => msg.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();

const AI_TR_SYSTEM = `Você ajuda brasileiros a aprender idiomas com músicas. Traduza para o português do Brasil o verso pedido, de forma natural e fiel ao sentido na música (não palavra por palavra): gírias, expressões idiomáticas, duplo sentido e referências culturais devem virar o equivalente que um brasileiro entenderia.
Responda exatamente neste formato, sem nada antes ou depois:
TRADUÇÃO: <a tradução do verso, em uma linha>
NOTA: <uma ou duas frases curtas explicando gíria, expressão ou referência do verso que ajudem a entender; escreva - se não houver nada a explicar>`;
async function aiTranslateVerse(text) {
  const ai = await getAI();
  const msg = await ai.messages.create({
    model: settings.aiModel,
    max_tokens: 1024,
    output_config: { effort: 'low' },   // short, well-defined task
    system: AI_TR_SYSTEM,
    messages: [{ role: 'user', content: `${S.entries.length ? songContext() + '\n\n' : ''}Verso para traduzir:\n${text}` }]
  });
  if (msg.stop_reason === 'refusal') { const e = new Error('refusal'); e.code = 'refusal'; throw e; }
  const out = textOf(msg);
  const tr = (out.match(/TRADU[ÇC][ÃA]O:\s*(.+)/i) || [])[1] || out.split('\n')[0];
  let note = ((out.match(/NOTA:\s*([\s\S]+)/i) || [])[1] || '').trim();
  if (/^[-–—]?$/.test(note)) note = '';
  return { tr: tr.trim().replace(/^["“]|["”]$/g, ''), note };
}

/* ✨ button next to every translation: translate this verse with Claude, save it, show the note */
const trAiBtn = attrs => `<button class="trai" ${attrs} title="Tradução inteligente" aria-label="Tradução inteligente">${icon('spark')}</button>`;
function sheetNoKey(after) {
  openSheet(`<h3>${icon('spark', 'h3i')}Tradução inteligente</h3>
    <p class="caption center-text" style="margin-top:0">A tradução inteligente usa a Claude. Cole sua chave de acesso para ativar; ela fica guardada só neste aparelho.</p>
    <input id="aiKeyQuick" type="password" placeholder="sk-ant-…" autocapitalize="off" autocorrect="off" spellcheck="false">
    <button class="btn primary wide" data-a="save">Salvar e continuar</button>
    <button class="btn wide" data-a="cancel">Agora não</button>`, {
    save: () => { const k = $('#aiKeyQuick').value.trim(); if (!k) { $('#aiKeyQuick').focus(); return; } settings.claudeKey = k; saveSettings(); closeSheet(); if (after) after(); },
    cancel: closeSheet
  });
  setTimeout(() => $('#aiKeyQuick') && $('#aiKeyQuick').focus(), 100);
}
/* lib.aiNotes[key] exists (possibly '') when the verse's current translation came from the AI */
const hasAiTr = (text, lang) => { const k = trKey(text, lang); return (k in lib.aiNotes) && !!lib.trOverride[k]; };
function sheetAiTr(text, lang, after) {
  const key = trKey(text, lang);
  const cached = hasAiTr(text, lang);
  if (!cached && !settings.claudeKey) return sheetNoKey(() => sheetAiTr(text, lang, after));
  let before = null;
  const wasPlaying = inSession() && playerReady && player.getPlayerState() === YT.PlayerState.PLAYING;
  if (wasPlaying) player.pauseVideo();
  const finish = () => { closeSheet(); if (wasPlaying) player.playVideo(); if (after) after(); };
  openSheet(`<h3>${icon('spark', 'h3i')}Tradução inteligente</h3>
    <div class="adjline">${esc(text)}</div>
    <div id="aiTrBox" class="aibox"></div>
    <div class="sheetbtns"><button class="btn" data-a="again" id="aiAgain">Traduzir de novo</button><button class="btn hidden" data-a="undo" id="aiUndo">Desfazer</button><button class="btn primary" data-a="ok">OK</button></div>`, {
    ok: finish,
    again: () => run(),
    undo: () => {
      if (before) setTranslation(text, lang, before, true); else setTranslation(text, lang, trCache[key] || null, false);
      saveLib(); toast('Tradução anterior de volta'); finish();
    }
  }, () => { if (wasPlaying) player.playVideo(); if (after) after(); });
  const show = (tr, note, label) => {
    const box = $('#aiTrBox'); if (!box) return;
    box.innerHTML = `<div class="aitr">${esc(tr)}</div>${note ? `<div class="ainote"><b>Entenda:</b> ${esc(note)}</div>` : ''}<small class="aisaved">${label}</small>`;
  };
  const run = () => {
    const box = $('#aiTrBox'); if (!box) return;
    if (!settings.claudeKey) { box.innerHTML = `<div class="ainote err">${esc(aiErrorText({ code: 'nokey' }))}</div>`; return; }
    before = lib.trOverride[key] || null;
    box.innerHTML = '<span class="trwait">Traduzindo o verso…</span>';
    $('#aiAgain').disabled = true; $('#aiUndo').classList.add('hidden');
    aiTranslateVerse(text).then(({ tr, note }) => {
      setTranslation(text, lang, tr, true);
      lib.aiNotes[key] = note || '';
      saveLib();
      show(tr, note, 'Salva para este verso');
      $('#aiUndo').classList.remove('hidden');
      $('#aiAgain').disabled = false;
    }).catch(e => {
      const b = $('#aiTrBox'); if (b) b.innerHTML = `<div class="ainote err">${esc(aiErrorText(e))}</div>`;
      const a = $('#aiAgain'); if (a) a.disabled = false;
    });
  };
  if (cached) show(lib.trOverride[key], lib.aiNotes[key], 'Tradução inteligente salva para este verso'); else run();
}

/* "✨ Traduzir a música toda": one request translates every distinct verse (with notes) and applies it to all lines */
const AI_SONG_SYSTEM = `Você ajuda brasileiros a aprender idiomas com músicas. Traduza para o português do Brasil cada verso numerado da letra, de forma natural e fiel ao sentido na música (não palavra por palavra): gírias, expressões idiomáticas, duplo sentido e referências culturais devem virar o equivalente que um brasileiro entenderia. Mantenha coerência entre os versos, já que você vê a música inteira.
Para cada verso, devolva o número (n), a tradução (tr) e uma nota (note) com uma ou duas frases curtas explicando gíria, expressão ou referência daquele verso; deixe note vazia ("") quando não houver nada a explicar. Traduza todos os versos, na ordem.`;
const AI_SONG_SCHEMA = {
  type: 'object',
  properties: {
    lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: { n: { type: 'integer' }, tr: { type: 'string' }, note: { type: 'string' } },
        required: ['n', 'tr', 'note'],
        additionalProperties: false
      }
    }
  },
  required: ['lines'],
  additionalProperties: false
};
const songVerses = () => [...new Set(S.entries.filter(e => e.text).map(e => e.text))];
async function aiTranslateSong() {
  const ai = await getAI();
  const verses = songVerses();
  const msg = await ai.messages.create({
    model: settings.aiModel,
    max_tokens: 16000,
    system: AI_SONG_SYSTEM,
    output_config: { format: { type: 'json_schema', schema: AI_SONG_SCHEMA } },
    messages: [{ role: 'user', content: `Música: "${(S.v && S.v.title) || ''}"${S.v && S.v.author ? ' · ' + S.v.author : ''}\n\nVersos:\n${verses.map((v, i) => `${i + 1}. ${v}`).join('\n')}` }]
  });
  if (msg.stop_reason === 'refusal') { const e = new Error('refusal'); e.code = 'refusal'; throw e; }
  if (msg.stop_reason === 'max_tokens') { const e = new Error('Letra longa demais para traduzir de uma vez'); e.code = 'toolong'; throw e; }
  const data = JSON.parse(textOf(msg));
  let done = 0;
  (data.lines || []).forEach(({ n, tr, note }) => {
    const text = verses[n - 1];
    if (!text || !tr || !tr.trim()) return;
    setTranslation(text, settings.lang, tr.trim(), true);
    lib.aiNotes[trKey(text, settings.lang)] = (note || '').trim();
    done++;
  });
  S.v.aiSong = done >= verses.length * 0.8;   // nearly all verses covered
  saveLib();
  return { done, total: verses.length };
}
function songTrListHTML() {
  return songVerses().map(text => {
    const k = trKey(text, settings.lang), tr = lib.trOverride[k] || trCache[k] || '', note = lib.aiNotes[k];
    return `<li><span class="so">${esc(text)}</span>${tr ? `<span class="st">${esc(tr)}</span>` : ''}${note ? `<span class="sn"><b>Entenda:</b> ${esc(note)}</span>` : ''}</li>`;
  }).join('');
}
function sheetTranslateSong(force = false) {
  const v = S.v; if (!v) return;
  if (!S.entries.length) { toast('Carregue a letra da música primeiro'); return; }
  if (settings.lang === 'pt') { toast('A música já está em português'); return; }
  const ready = !force && v.aiSong;
  if (!ready && !settings.claudeKey) return sheetNoKey(() => sheetTranslateSong(force));
  const wasPlaying = inSession() && playerReady && player.getPlayerState() === YT.PlayerState.PLAYING;
  if (wasPlaying) player.pauseVideo();
  const close = () => { closeSheet(); if (wasPlaying) player.playVideo(); if (S.phase === 'play') renderGame(); if (S.phase === 'karaoke') S.lines.forEach((_, i) => paintKarLine(i)); if (S.phase === 'ready') renderReady(); };
  const n = songVerses().length;
  openSheet(`<h3>${icon('spark', 'h3i')}Tradução da música</h3>
    <p class="caption center-text" style="margin-top:0">${esc(v.title || '')}${v.author ? ' · ' + esc(v.author) : ''}</p>
    <div id="songTrBox">${ready ? `<ul class="songtr">${songTrListHTML()}</ul>` : `<div class="aibox"><span class="trwait">Traduzindo ${n} versos com o contexto da música toda…</span></div>`}</div>
    <div class="sheetbtns"><button class="btn" data-a="again" id="stAgain" ${ready ? '' : 'disabled'}>Traduzir de novo</button><button class="btn primary" data-a="ok">Fechar</button></div>
    <p class="caption center-text">As traduções ficam salvas e aparecem durante o jogo e no karaokê.</p>`, {
    ok: close,
    again: () => { closeSheet(); sheetTranslateSong(true); }
  }, close);
  if (ready) return;
  aiTranslateSong().then(({ done, total }) => {
    const box = $('#songTrBox'); if (!box) return;
    box.innerHTML = `<div class="aisaved" style="margin:0 0 10px;text-align:center">${done} de ${total} versos traduzidos</div><ul class="songtr">${songTrListHTML()}</ul>`;
    const a = $('#stAgain'); if (a) a.disabled = false;
    if (S.phase === 'ready') renderReady();
  }).catch(e => {
    const box = $('#songTrBox'); if (!box) return;
    box.innerHTML = `<div class="aibox"><div class="ainote err">${esc(e && e.code === 'toolong' ? 'A letra é longa demais para traduzir de uma vez. Use o ✨ em cada verso.' : aiErrorText(e))}</div></div>`;
    const a = $('#stAgain'); if (a) a.disabled = false;
  });
}

/* "✨ Entender a música": a full explanation in Portuguese, streamed as it is written and kept with the song */
const AI_EXPLAIN_SYSTEM = `Você explica músicas para brasileiros que estão aprendendo o idioma da letra. Escreva em português do Brasil, em tom amigável, para quem quer entender a música de verdade. Use exatamente estas seções, com títulos começando por "## ":
## Resumo
(2 a 3 frases: do que a música fala)
## A história e o sentido
(o que acontece ou o que o eu lírico sente, parte por parte)
## Expressões e gírias
(lista com "- " : cada item com a expressão original curta em **negrito**, o significado e como diríamos em português)
## Contexto
(sobre o artista, a época, o estilo ou referências culturais que ajudam a entender; diga só o que tiver segurança)
## Para praticar
(3 palavras ou expressões úteis da música para guardar, com exemplo de uso)
Cite só trechos curtos da letra, nunca a letra inteira. Seja direto: no máximo umas 450 palavras.`;
function mdLite(src) {
  const out = []; let inList = false;
  esc(src).split('\n').forEach(raw => {
    const l = raw.trim();
    const inline = s => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<i>$2</i>');
    if (/^[-•]\s+/.test(l)) { if (!inList) { out.push('<ul>'); inList = true; } out.push('<li>' + inline(l.replace(/^[-•]\s+/, '')) + '</li>'); return; }
    if (inList) { out.push('</ul>'); inList = false; }
    if (/^#{1,4}\s+/.test(l)) out.push('<h4>' + inline(l.replace(/^#+\s+/, '')) + '</h4>');
    else if (l) out.push('<p>' + inline(l) + '</p>');
  });
  if (inList) out.push('</ul>');
  return out.join('');
}
let explainRun = 0;
function sheetExplain(force = false) {
  const v = S.v; if (!v) return;
  if (!S.entries.length) { toast('Carregue a letra da música primeiro'); return; }
  if (!settings.claudeKey) return sheetNoKey(() => sheetExplain(force));
  const wasPlaying = inSession() && playerReady && player.getPlayerState() === YT.PlayerState.PLAYING;
  if (wasPlaying) player.pauseVideo();
  const cached = !force && v.explain;
  openSheet(`<h3>${icon('spark', 'h3i')}Entender a música</h3>
    <p class="caption center-text" style="margin-top:0">${esc(v.title || '')}${v.author ? ' · ' + esc(v.author) : ''}</p>
    <div id="explainBox" class="explain">${cached ? mdLite(v.explain) : '<span class="trwait">Lendo a letra…</span>'}</div>
    <div class="sheetbtns"><button class="btn" data-a="again" id="exAgain" ${cached ? '' : 'disabled'}>Gerar de novo</button><button class="btn primary" data-a="ok">Fechar</button></div>
    <p class="caption center-text">Explicação gerada automaticamente. Pode conter imprecisões.</p>`, {
    ok: () => { explainRun++; closeSheet(); if (wasPlaying) player.playVideo(); },
    again: () => { explainRun++; sheetExplain(true); }
  }, () => { explainRun++; if (wasPlaying) player.playVideo(); });
  if (cached) return;
  const run = ++explainRun;
  (async () => {
    const ai = await getAI();
    const stream = ai.messages.stream({
      model: settings.aiModel,
      max_tokens: 8000,
      system: AI_EXPLAIN_SYSTEM,
      messages: [{ role: 'user', content: songContext() + '\n\nExplique esta música.' }]
    });
    let acc = '';
    for await (const ev of stream) {
      if (run !== explainRun) { stream.abort(); return; }   // sheet closed or regenerated
      if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
        acc += ev.delta.text;
        const box = $('#explainBox'); if (box) box.innerHTML = mdLite(acc);
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') { const e = new Error('refusal'); e.code = 'refusal'; throw e; }
    if (run !== explainRun) return;
    v.explain = acc.trim(); saveLib();
    const again = $('#exAgain'); if (again) again.disabled = false;
  })().catch(e => {
    if (run !== explainRun || (e && e.name === 'AbortError')) return;
    const box = $('#explainBox'); if (box) box.innerHTML = `<div class="ainote err">${esc(aiErrorText(e))}</div>`;
    const again = $('#exAgain'); if (again) again.disabled = false;
  });
}

function sheetFixTr(text, lang, after) {
  const key = trKey(text, lang), auto = trCache[key] || null, mine = lib.trOverride[key] || '';
  const wasPlaying = inSession() && playerReady && player.getPlayerState() === YT.PlayerState.PLAYING;
  if (wasPlaying) player.pauseVideo();
  const cur = mine || auto;
  let google = null;
  const done = msg => { closeSheet(); if (msg) toast(msg); if (wasPlaying) player.playVideo(); if (after) after(); };
  const choice = (k, label, tx, placeholder) => `<button class="tropt${tx && tx === cur ? ' on' : ''}" data-a="pick" data-k="${k}" ${tx ? '' : 'disabled'}>
      <small>${label}${tx && tx === cur ? ' · em uso' : ''}</small><span id="tro-${k}">${tx ? esc(tx) : placeholder}</span></button>`;
  openSheet(`<h3>Tradução do verso</h3>
    <div class="adjline">${S.phase === 'play' && S.lines.some(l => l.text === text && hasUnsolved(l)) ? lineHTML(S.lines.find(l => l.text === text), false, false) : esc(text)}</div>
    <p class="caption center-text" style="margin-top:4px">Toque na tradução que faz mais sentido. Ela fica salva para este verso.</p>
    ${choice('auto', 'Tradução automática', auto, 'sem tradução')}
    ${choice('google', 'Tradução alternativa', null, '<span class="trwait">buscando…</span>')}
    <button class="tropt aiopt" data-a="ai"><small>${icon('spark', 'ii')} Tradução inteligente</small><span>Considera a música inteira e explica gírias e expressões</span></button>
    <div class="tropt mine${mine && mine === cur ? ' on' : ''}"><small>Minha tradução${mine ? ' · em uso' : ''}</small>
      <textarea id="trMine" rows="2" placeholder="Escreva com suas palavras…">${esc(mine)}</textarea>
      <button class="btn primary wide" data-a="mine" style="margin-top:8px">Usar a minha</button></div>
    <button class="btn wide" data-a="cancel">Cancelar</button>`, {
    pick: (e, el) => {
      const k = el.dataset.k, tx = k === 'auto' ? auto : google;
      if (!tx) return;
      if (tx === cur && !(k === 'auto' && mine)) return done();
      setTranslation(text, lang, tx, k !== 'auto');
      done(k === 'auto' ? 'Voltou para a tradução automática' : 'Tradução salva');
    },
    mine: () => {
      const tx = $('#trMine').value.trim().replace(/\s+/g, ' ');
      if (!tx) { $('#trMine').focus(); return; }
      setTranslation(text, lang, tx, true);
      done('✎ Sua tradução foi salva');
    },
    cancel: () => done(),
    ai: () => { closeSheet(); sheetAiTr(text, lang, () => { if (wasPlaying) player.playVideo(); if (after) after(); }); }
  }, () => { if (wasPlaying) player.playVideo(); if (after) after(); });
  fetchGoogle(text, lang).then(tx => {
    google = tx;
    const el = $('#tro-google'); if (!el) return;
    const btn = el.closest('.tropt');
    if (!tx) { el.textContent = 'indisponível no momento'; return; }
    el.textContent = tx; btn.disabled = false;
    if (tx === cur) { btn.classList.add('on'); btn.querySelector('small').textContent = 'Tradução alternativa · em uso'; }
  }).catch(() => { const el = $('#tro-google'); if (el) el.textContent = 'indisponível no momento'; });
}

/* ================= saved phrases ================= */
const findPhrase = (videoId, text) => lib.phrases.find(p => p.videoId === videoId && p.text === text);
async function toggleSavePhrase(line) {
  if (!line) return false;
  const ex = findPhrase(S.videoId, line.text);
  if (ex) { lib.phrases = lib.phrases.filter(p => p !== ex); saveLib(); toast('Frase removida'); renderGame(); return false; }
  const p = {
    id: uid(), videoId: S.videoId, title: S.v.title, author: S.v.author, text: line.text, tr: line.tr || null, lang: settings.lang,
    start: Math.max(0, line.t - S.offset - 0.4), end: line.end - S.offset + 0.4, savedAt: Date.now()
  };
  lib.phrases.unshift(p); saveLib(); toast('Frase salva');
  renderGame();
  if (!p.tr) { const tr = await fetchTr(p.text); if (tr) { p.tr = tr; line.tr = line.tr || tr; saveLib(); } }
  return true;
}
const bmBtn = (saved, attrs) => `<button class="iconbtn sm bm ${saved ? 'on' : ''}" ${attrs} title="Salvar frase">${icon(saved ? 'bm-f' : 'bm')}</button>`;

let clipPlayer = null;
function sheetClip(p) {
  if (playerReady) player.pauseVideo();
  const link = `https://youtu.be/${p.videoId}?t=${Math.floor(p.start)}`;
  openSheet(`<div class="cliptext">${esc(p.text)}</div><div class="tr">${p.tr ? esc(p.tr) : ''}<span class="trbtns">${trFixBtn('data-a="trfix"')}${trAiBtn('data-a="trai"')}</span></div>
    <div class="clipwrap"><div id="clipPlayer"></div></div>
    <p class="muted" style="text-align:center;margin:0 0 6px">${esc(p.title || '')} · ${fmtDur(p.start) || '0:00'}</p>
    <div class="actions" style="margin-top:6px">
      <button class="ctrl" data-a="again">${icon('replay')}<span>Ouvir de novo</span></button>
      <button class="ctrl" data-a="song">${icon('play')}<span>Jogar música</span></button>
      <a class="ctrl" href="${link}" target="_blank" rel="noopener" style="text-decoration:none">${icon('ext')}<span>YouTube</span></a>
      <button class="ctrl" data-a="del">${icon('trash')}<span>Remover</span></button>
    </div>`, {
    again: () => clipPlayer && clipPlayer.loadVideoById({ videoId: p.videoId, startSeconds: p.start, endSeconds: p.end }),
    trfix: () => { closeSheet(); sheetFixTr(p.text, p.lang || 'en', () => { sheetClip(p); if (document.body.dataset.view === 'home') renderHome(); }); },
    trai: () => { closeSheet(); sheetAiTr(p.text, p.lang || 'en', () => { sheetClip(p); if (document.body.dataset.view === 'home') renderHome(); }); },
    song: () => { closeSheet(); openSong(p.videoId, { title: p.title, author: p.author }); },
    del: () => { lib.phrases = lib.phrases.filter(x => x !== p); saveLib(); closeSheet(); renderHome(); toast('Frase removida'); }
  });
  if (!apiReady) { toast('Player ainda carregando…'); return; }
  clipPlayer = new YT.Player('clipPlayer', {
    videoId: p.videoId,
    playerVars: { start: Math.floor(p.start), end: Math.ceil(p.end), playsinline: 1, rel: 0, autoplay: 1, modestbranding: 1, origin: location.origin },
    events: { onReady: e => e.target.playVideo() }
  });
}
function finish() { showResults(true); }
/* completed = song reached its end (+10 bonus); otherwise the player ended early with "Encerrar" */
function showResults(completed) {
  S.finished = true;
  if (playerReady) player.pauseVideo();
  if (completed) {
    S.score += SONG_BONUS;
    stat('songs');
    if (!lib.stats.uniq.includes(S.videoId)) lib.stats.uniq.push(S.videoId);
  }
  const all = S.lines.flatMap(l => l.blanks.map(b => ({ b, l })));
  const played = all.filter(x => x.b.solved);
  const acc = played.length ? Math.round(S.ok / played.length * 100) + '%' : '—';
  const newBest = completed && S.score > (S.v.best || 0);
  if (completed) S.v.best = Math.max(S.v.best || 0, S.score);
  saveLib();
  const missed = all.filter(x => x.b.missed || x.b.attempts > 0);
  const hasNext = S.queue && S.queue.idx + 1 < S.queue.ids.length;
  openSheet(`<h3>${completed ? 'Fim da música' : 'Música encerrada'}</h3>
    <div class="stats four">
      <div><b>${S.score}</b><span>pontos</span></div>
      <div><b class="okc">${S.ok}</b><span>certas</span></div>
      <div><b class="badc">${S.miss}</b><span>erros</span></div>
      <div><b>${acc}</b><span>precisão</span></div>
    </div>
    <div class="scoreline">
      <span>${S.ok} palavra${S.ok === 1 ? '' : 's'} × 1</span>
      <span>${completed ? `música completa <b>+${SONG_BONUS}</b>` : `sem bônus (encerrada ${S.lines.length ? Math.round((S.cur + 1) / S.lines.length * 100) : 0}%)`}</span>
      <span>${icon('flame', 'ii')} melhor sequência <b>${S.bestStreak}</b></span>
      <span>${newBest ? '<b>Novo recorde</b>' : `recorde <b>${S.v.best || '—'}</b>`}</span>
    </div>
    ${(() => { const t = todayStats(), lv = levelOf(xpOf(lib.stats)), sk = dayStreak(); return `<div class="todayline"><span>Hoje <b>${t.words}/${settings.goal}</b> palavras</span><span>🔥 <b>${sk}</b> dia${sk === 1 ? "" : "s"}</span><span>Nível <b>${lv.level}</b></span></div>`; })()}
    ${missed.length ? `<p class="muted">Palavras para revisar · toque em ${icon('bm', 'ii')} para salvar a frase</p><ul class="missed">${missed.map(x => `<li><div><b>${esc(x.b.answer)}</b> · ${esc(x.l.text)}${x.l.tr ? `<div class="tr">${esc(x.l.tr)}</div>` : ''}</div>${bmBtn(!!findPhrase(S.videoId, x.l.text), `data-a="bm" data-i="${S.lines.indexOf(x.l)}" style="position:static;transform:none"`)}</li>`).join('')}</ul>` : played.length ? '<p class="muted" style="text-align:center">Nenhum erro! 🏆</p>' : ''}
    <div class="sheetbtns" style="flex-direction:column">
      ${hasNext ? '<button class="btn primary" data-a="next">Próxima música</button>' : ''}
      <button class="btn ${hasNext ? '' : 'primary'}" data-a="again">Jogar de novo</button>
      <button class="btn" data-a="close">Fechar</button>
    </div>`, {
    next: () => { const q = { ...S.queue, idx: S.queue.idx + 1 }; closeSheet(); endPlay(); openSong(q.ids[q.idx], lib.videos[q.ids[q.idx]], q); },
    again: () => { closeSheet(); startGame(); },
    close: () => { closeSheet(); quitGame(); },
    bm: async (e, el) => { e.stopPropagation(); const on = await toggleSavePhrase(S.lines[+el.dataset.i]); el.classList.toggle('on', on); el.innerHTML = icon(on ? 'bm-f' : 'bm'); }
  }, quitGame);
}

/* ================= karaoke ================= */
/* The song plays with the whole lyric on screen; the sung verse is highlighted and the translation can sit beside or below it. */
const KAR_TR = { side: 'Tradução ao lado', below: 'Tradução abaixo', off: 'Sem tradução' };
let karUserScroll = 0;
async function startKaraoke() {
  if (!playerReady) { toast('O vídeo ainda está carregando…'); return; }
  buildLines();
  Object.assign(S, { phase: 'karaoke', cur: -1, maxCur: -1, hold: null, waiting: false, finished: false });
  showPane('pKaraoke'); document.body.classList.add('playing'); closeSheet();
  renderKaraoke();
  $('#kSpeed').innerHTML = `<b>${settings.speed}x</b><span>Velocidade</span>`;
  player.seekTo(0, true); player.setPlaybackRate(settings.speed); player.playVideo();
  window.scrollTo(0, 0);
  translateAllKaraoke();
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { }
}
function renderKaraoke() {
  const box = $('#kList'), mode = settings.lang === 'pt' ? 'off' : settings.karTr;
  box.className = 'klist ' + mode;
  $('#kTr').textContent = KAR_TR[mode];
  $('#kTr').disabled = settings.lang === 'pt';
  box.innerHTML = '<div class="kpad"></div>' + S.lines.map((l, i) => `<div class="kline" data-i="${i}">
      <div class="ko">${esc(l.text)}</div><div class="kt"></div><button class="iconbtn sm kadj" data-kadj="${i}" title="Ajustar tempo do verso">${icon('sync')}</button>${bmBtn(!!findPhrase(S.videoId, l.text), `data-kbm="${i}"`)}</div>`).join('') + '<div class="kpad"></div>';
  S.lines.forEach((_, i) => paintKarLine(i));
  markKarCur(true);
}
function paintKarLine(i) {
  const l = S.lines[i], row = $(`#kList .kline[data-i="${i}"]`); if (!l || !row) return;
  row.querySelector('.kt').innerHTML = l.tr ? esc(l.tr) + `<span class="trbtns">${trFixBtn(`data-ktr="${i}"`)}${trAiBtn(`data-kai="${i}"`)}</span>` : (l.trFail ? '' : '<span class="trwait">…</span>');
}
async function translateAllKaraoke() {
  if (settings.lang === 'pt' || settings.karTr === 'off') return;
  // nearest verses first, so what is about to be sung is ready before the rest
  const start = Math.max(0, S.cur), order = S.lines.map((l, i) => i).sort((a, b) => (a < start) - (b < start) || Math.abs(a - start) - Math.abs(b - start));
  for (const i of order) {
    if (S.phase !== 'karaoke') return;
    await translateLine(S.lines[i], true);
  }
}
function markKarCur(instant = false) {
  $$('#kList .kline').forEach(r => { const i = +r.dataset.i; r.classList.toggle('on', i === S.cur); r.classList.toggle('past', i < S.cur); });
  $('#kProgress').style.width = (S.lines.length ? Math.max(0, (S.cur + 1) / S.lines.length * 100) : 0) + '%';
  $('#kBack').disabled = S.cur <= 0;
  if (Date.now() - karUserScroll < 4000) return;   // the user is reading elsewhere; don't yank the list
  const box = $('#kList'), row = $(`#kList .kline[data-i="${Math.max(0, S.cur)}"]`); if (!row) return;
  box.scrollTo({ top: row.offsetTop - box.clientHeight / 2 + row.offsetHeight / 2, behavior: instant ? 'auto' : 'smooth' });
}
function tickKaraoke(L) {
  const idx = currentIdx(L);
  if (idx !== S.cur) {
    S.cur = idx;
    if (idx > S.maxCur && idx >= 0) stat('lines');
    S.maxCur = Math.max(S.maxCur, idx);
    markKarCur();
  }
}
function karaokeSeek(i) {
  const l = S.lines[Math.max(0, Math.min(S.lines.length - 1, i))]; if (!l) return;
  karUserScroll = 0;
  S.hold = S.lines.indexOf(l);
  seekLyric(l.t - 0.3); player.playVideo();
}
function karaokeBack() {
  const l = S.lines[S.cur];
  // early in a verse → previous verse; later → restart this one
  karaokeSeek(l && lyricTime() - l.t > 2.5 ? S.cur : S.cur - 1);
}
function karaokeEnd() {
  S.finished = true;
  openSheet(`<h3>Fim do karaokê</h3>
    <p class="muted" style="text-align:center;margin:0 0 6px">Agora que você conhece a letra, que tal completar as lacunas?</p>
    <div class="sheetbtns" style="flex-direction:column">
      <button class="btn primary" data-a="game">Jogar com lacunas</button>
      <button class="btn" data-a="again">Cantar de novo</button>
      <button class="btn" data-a="close">Fechar</button>
    </div>`, {
    game: () => { closeSheet(); endPlay(); startGame(); },
    again: () => { closeSheet(); startKaraoke(); },
    close: () => { closeSheet(); quitGame(); }
  }, quitGame);
}

/* ================= sheets ================= */
let sheetOnDismiss = null;   // run when the sheet is dismissed by tapping outside / Esc
function openSheet(html, actions = {}, onDismiss = null) {
  sheetOnDismiss = onDismiss;
  $('#sheetContent').innerHTML = html;
  $$('#sheetContent [data-a]').forEach(el => { const f = actions[el.dataset.a]; if (f) el.addEventListener('click', e => f(e, el)); });
  $('#sheet').classList.remove('hidden');
}
function closeSheet() {
  sheetOnDismiss = null;
  $('#sheet').classList.add('hidden');
  if (clipPlayer) { try { clipPlayer.destroy(); } catch { } clipPlayer = null; }
}
function dismissSheet() { const f = sheetOnDismiss; closeSheet(); if (f) f(); }
$('#sheetBg').onclick = dismissSheet;

function seg(name, opts, value) {
  return `<div class="seg small" data-seg="${name}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(v) === String(value) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
}
const swRow = (label, key, sub = '') => `<div class="grow"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span><button class="switch ${settings[key] ? 'on' : ''}" data-t="${key}" aria-label="${label}"></button></div>`;
function sheetSettings() {
  const inSong = document.body.dataset.view === 'song' && S.entries.length;
  openSheet(`<h3>Configurações</h3>
    <div class="grouplabel">Jogo</div>
    <div class="field"><label>Ritmo</label>${seg('pace', [['flow', 'Fluxo'], ['pause', 'Pausa em cada frase']], settings.pace)}</div>
    <div class="field"><label>Nível</label>${seg('difficulty', [['facil', 'Fácil'], ['medio', 'Médio'], ['dificil', 'Difícil']], settings.difficulty)}</div>
    <div class="field"><label>Responder</label>${seg('mode', [['choice', 'Múltipla escolha'], ['type', 'Digitando']], settings.mode)}</div>
    <div class="field"><label>Velocidade</label>${seg('speed', [[0.5, '0.5x'], [0.75, '0.75x'], [1, '1x']], settings.speed)}</div>
    <div class="field"><label>No modo Pausa, repetir o trecho se eu demorar</label>${seg('autoReplay', [[0, 'Nunca'], [5, '5s'], [8, '8s'], [12, '12s'], [20, '20s']], settings.autoReplay)}</div>
    ${inSong ? `<div class="group"><div class="grow"><span>Sincronia desta música<small>Use − se a letra aparece antes da voz</small></span><div class="stepper"><button data-a="offm">−</button><span id="offVal">${(S.offset >= 0 ? '+' : '') + S.offset.toFixed(1)}s</span><button data-a="offp">+</button></div></div></div>` : ''}

    <div class="grouplabel">Idioma</div>
    <div class="field"><label>${inSong ? 'Idioma desta música' : 'Idioma das músicas'}</label>${seg('lang', [['en', 'EN'], ['es', 'ES'], ['fr', 'FR'], ['it', 'IT'], ['de', 'DE'], ['ja', 'JA'], ['ko', 'KO'], ['pt', 'PT']], settings.lang)}
      <p class="caption" style="margin-top:6px">${inSong ? 'Detectado automaticamente pela letra. Corrija aqui se estiver errado.' : 'Cada música tem o idioma detectado automaticamente pela letra.'}</p></div>
    <div class="group">
      ${swRow('Tradução para português', 'translate', 'Mostrada embaixo do verso que está tocando')}
      ${swRow('Sons de acerto', 'sounds')}
    </div>

    <div class="grouplabel">Tradução inteligente</div>
    <input id="claudeKey" type="password" placeholder="Chave de acesso da Claude" value="${esc(settings.claudeKey)}" autocapitalize="off" autocorrect="off" spellcheck="false">
    <div class="field"><label>Modo</label>${seg('aiModel', AI_MODELS, settings.aiModel)}</div>
    <p class="caption" style="margin-top:6px">Ativa o ${icon('spark', 'ii')} ao lado das traduções e o <b>Entender a música</b>. A chave fica guardada só neste aparelho e não entra no backup. Recomendamos definir um limite de gastos para ela.</p>

    <div class="grouplabel">Avançado</div>
    <input id="ytKey" placeholder="Chave do YouTube (opcional)" value="${esc(settings.ytKey)}" autocapitalize="off" autocorrect="off" spellcheck="false">
    <p class="caption" style="margin-top:6px">Opcional. Com uma chave própria do YouTube, a busca de vídeos fica mais estável.</p>

    <div class="grouplabel">Biblioteca</div>
    <div class="group">
      <button class="grow" data-a="export">${icon('share')}<span>Copiar backup<small>Músicas, letras, playlists e frases</small></span></button>
      <button class="grow" data-a="import">${icon('text')}<span>Restaurar backup<small>Mescla com o que já existe</small></span></button>
    </div>
    <textarea id="ioBox" rows="4" class="hidden" placeholder="Cole aqui o backup e toque em Restaurar backup"></textarea>

    <button class="btn primary wide" data-a="done">Concluído</button>
    <p class="caption center-text">Versa · por Sóstenes Rondena</p>`, {
    offm: () => nudge(-0.2), offp: () => nudge(0.2),
    export: async () => {
      const txt = JSON.stringify(lib); const box = $('#ioBox'); box.classList.remove('hidden'); box.value = txt; box.select();
      try { await navigator.clipboard.writeText(txt); toast('Backup copiado ✓'); } catch { toast('Selecione e copie o texto'); }
    },
    import: () => {
      const box = $('#ioBox');
      if (box.classList.contains('hidden') || !box.value.trim().startsWith('{')) { box.classList.remove('hidden'); box.value = ''; box.focus(); toast('Cole o backup e toque em Restaurar de novo'); return; }
      try { importLib(JSON.parse(box.value)); toast('Biblioteca restaurada ✓'); closeSheet(); renderHome(); } catch { toast('Backup inválido'); }
    },
    done: () => { settings.ytKey = ($('#ytKey').value || '').trim(); settings.claudeKey = ($('#claudeKey').value || '').trim(); saveSettings(); closeSheet(); if (S.phase === 'ready') renderReady(); }
  });
  $$('#sheetContent [data-seg]').forEach(g => g.querySelectorAll('button').forEach(b => b.onclick = () => applySetting(g.dataset.seg, b.dataset.v, g)));
  $$('#sheetContent [data-t]').forEach(b => b.onclick = () => { const k = b.dataset.t; settings[k] = !settings[k]; saveSettings(); b.classList.toggle('on', settings[k]); if (S.phase === 'play') renderGame(); });
  $('#ytKey').addEventListener('change', e => { settings.ytKey = e.target.value.trim(); saveSettings(); });
  $('#claudeKey').addEventListener('change', e => { settings.claudeKey = e.target.value.trim(); saveSettings(); });
}
function applySetting(k, v, group) {
  if (['autoReplay', 'speed'].includes(k)) v = +v;
  settings[k] = v; saveSettings();
  if (group) group.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.v === String(v)));
  if (k === 'mode' && S.phase === 'play') { applyMode(); renderGame(); }
  if (k === 'pace' && S.phase === 'play') { S.waiting = false; setRing(0); player.playVideo(); renderGame(); }
  if (k === 'speed' && playerReady) { player.setPlaybackRate(v); setSpeedLabels(); }
  if (k === 'lang' && document.body.dataset.view === 'song' && S.v) { S.v.lang = v; saveLib(); }   // manual correction sticks to this song
  if (k === 'lang' && S.phase === 'play') { S.lines.forEach(l => { l.tr = null; l.trFail = false; translateLine(l); }); renderGame(); }
  if (k === 'lang' && S.phase === 'karaoke') { S.lines.forEach(l => { l.tr = null; l.trFail = false; }); renderKaraoke(); translateAllKaraoke(); }
  if (S.phase === 'ready') renderReady();
}
function sheetSongMore() {
  const v = S.v; if (!v) return;
  const has = S.entries.length > 0;
  openSheet(`<h3>${esc(v.title || 'Música')}</h3>
    <div class="group">
      <button class="grow" data-a="pl">${icon('addlist')}<span>Adicionar à playlist</span></button>
      <button class="grow" data-a="yt">${icon('ext')}<span>Abrir no YouTube</span></button>
      ${has ? `<button class="grow" data-a="songtr">${icon('spark', 'aiico')}<span>${v.aiSong ? 'Ver a tradução da música' : 'Traduzir a música toda'}<small>Todos os versos, com as gírias explicadas</small></span></button>
      <button class="grow" data-a="explain">${icon('spark', 'aiico')}<span>Entender a música<small>Resumo, sentido e expressões da letra</small></span></button>` : ''}
    </div>
    <div class="grouplabel">Letra</div>
    <div class="group">
      ${has ? `<button class="grow" data-a="kar">${icon('note')}<span>Modo karaokê<small>A letra rola junto com a música, com tradução</small></span></button>
      <button class="grow" data-a="quick">${icon('sync')}<span>Sincronia rápida<small>Letra fora de tempo? Acerte com 1 ou 2 toques</small></span></button>
      <button class="grow" data-a="resync">${icon('sync')}<span>Sincronizar de novo<small>Marcar o tempo de cada frase outra vez</small></span></button>
      <button class="grow" data-a="edit">${icon('edit')}<span>Editar letra<small>Corrigir o texto ou os tempos</small></span></button>` : ''}
      <button class="grow" data-a="change">${icon('text')}<span>${has ? 'Trocar letra' : 'Buscar ou colar letra'}</span></button>
    </div>`, {
    pl: () => sheetAddToPlaylist(v),
    yt: () => { closeSheet(); window.open('https://www.youtube.com/watch?v=' + v.id, '_blank', 'noopener'); },
    kar: () => { closeSheet(); startKaraoke(); },
    quick: () => { closeSheet(); sheetQuickSync(); },
    explain: () => sheetExplain(),
    songtr: () => sheetTranslateSong(),
    resync: () => { closeSheet(); if (inSession()) quitGame(); startSync(S.entries.filter(e => e.text).map(e => e.text)); },
    edit: () => sheetEditLRC(),
    change: () => { closeSheet(); if (inSession()) quitGame(); S.phase = 'lyrics'; showPane('pLyrics'); prefillLyrics(); }
  });
}
function sheetEditLRC() {
  openSheet(`<h3>Editar letra</h3><p class="caption" style="margin-top:0">Cada linha começa com o tempo do verso, por exemplo <code>[01:23.45]</code>.</p>
    <textarea id="lrcBox" rows="12">${esc(toLRC(S.entries))}</textarea>
    <div class="sheetbtns"><button class="btn" data-a="copy">Copiar</button><button class="btn primary" data-a="save">Salvar</button></div>`, {
    copy: async () => { try { await navigator.clipboard.writeText($('#lrcBox').value); toast('Copiado ✓'); } catch { } },
    save: () => { const e = parseLRC($('#lrcBox').value); if (!e) { toast('Formato inválido. Cada linha deve começar com o tempo, como [01:23.45]'); return; } S.entries = e; saveSong(); closeSheet(); if (S.phase === 'ready') renderReady(); toast('Salvo ✓'); }
  });
}
function nudge(d) {
  S.offset = Math.round((S.offset + d) * 10) / 10;
  if (S.v) { S.v.offset = S.offset; saveLib(); }
  const el = $('#offVal'); if (el) el.textContent = (S.offset >= 0 ? '+' : '') + S.offset.toFixed(1) + 's';
}
function importLib(data) {
  if (!data || !data.videos) throw new Error('bad');
  for (const [id, v] of Object.entries(data.videos)) {
    const cur = lib.videos[id];
    if (!cur) lib.videos[id] = v;
    else { if (!cur.lrc && v.lrc) { cur.lrc = v.lrc; cur.offset = v.offset; } cur.fav = cur.fav || v.fav; cur.best = Math.max(cur.best || 0, v.best || 0); cur.title = cur.title || v.title; cur.author = cur.author || v.author; }
  }
  (data.playlists || []).forEach(p => {
    const cur = lib.playlists.find(x => x.id === p.id);
    if (!cur) lib.playlists.push(p); else p.items.forEach(i => { if (!cur.items.includes(i)) cur.items.push(i); });
  });
  lib.recent = [...new Set([...lib.recent, ...(data.recent || [])])].slice(0, 50);
  Object.entries(data.trOverride || {}).forEach(([k, v]) => { if (!lib.trOverride[k]) lib.trOverride[k] = v; });
  (data.phrases || []).forEach(p => { if (!lib.phrases.some(x => x.id === p.id || (x.videoId === p.videoId && x.text === p.text))) lib.phrases.push(p); });
  saveLib();
}
function sheetAddToPlaylist(v) {
  vid(v.id, v);
  const render = () => {
    openSheet(`<h3>Adicionar à playlist</h3>
      <div class="list">${lib.playlists.map(p => `<div class="item" data-a="tog" data-id="${p.id}"><div class="meta"><b>${esc(p.name)}</b><small>${p.items.length} músicas</small></div><span class="check ${p.items.includes(v.id) ? 'on' : ''}">${p.items.includes(v.id) ? icon('check') : ''}</span></div>`).join('') || '<p class="muted" style="text-align:center">Nenhuma playlist ainda.</p>'}</div>
      <div class="row2" style="margin-top:12px"><input id="newPl" placeholder="Nova playlist…"><button class="btn primary" data-a="new">Criar</button></div>
      <button class="btn wide" data-a="done">Pronto</button>`, {
      tog: (e, el) => { const p = lib.playlists.find(x => x.id === el.dataset.id); const i = p.items.indexOf(v.id); i >= 0 ? p.items.splice(i, 1) : p.items.push(v.id); saveLib(); render(); },
      new: () => { const n = $('#newPl').value.trim(); if (!n) return; lib.playlists.push({ id: uid(), name: n, items: [v.id] }); saveLib(); toast('Adicionada em “' + n + '”'); render(); },
      done: () => { closeSheet(); renderHome(); }
    });
  };
  render();
}
function sheetNewPlaylist() {
  openSheet(`<h3>Nova playlist</h3><input id="newPl" placeholder="Nome da playlist"><button class="btn primary wide" data-a="ok">Criar</button>`, {
    ok: () => { const n = $('#newPl').value.trim(); if (!n) return; const p = { id: uid(), name: n, items: [] }; lib.playlists.push(p); saveLib(); closeSheet(); H.plOpen = p.id; renderHome(); }
  });
  setTimeout(() => $('#newPl').focus(), 100);
}
function sheetPlaylistMenu(pl) {
  openSheet(`<h3>${esc(pl.name)}</h3><input id="plName" value="${esc(pl.name)}">
    <button class="btn primary wide" data-a="ren">Renomear</button><button class="btn wide" data-a="del" style="color:var(--bad)">Excluir playlist</button>`, {
    ren: () => { const n = $('#plName').value.trim(); if (n) { pl.name = n; saveLib(); } closeSheet(); renderHome(); },
    del: () => { if (confirm('Excluir a playlist “' + pl.name + '”? As músicas continuam salvas.')) { lib.playlists = lib.playlists.filter(p => p !== pl); H.plOpen = null; saveLib(); closeSheet(); renderHome(); } }
  });
}

/* ================= wiring ================= */
$('#searchForm').onsubmit = e => { e.preventDefault(); doSearch($('#q').value); };
$('#q').addEventListener('search', () => { if (!$('#q').value && H.results) { H.results = null; renderHome(); } });
$$('#tabbar button').forEach(b => b.onclick = () => { if (H.tab === b.dataset.tab && b.dataset.tab === 'library') H.plOpen = null; setTab(b.dataset.tab); });
$$('#libSeg button').forEach(b => b.onclick = () => { H.libTab = b.dataset.lib; H.plOpen = null; renderLibraryTab(); });
$('#btnSettings').onclick = sheetSettings;

$('#btnBack').onclick = () => { if (history.state && history.state.song) history.back(); else go('home'); };
$('#btnFav').onclick = () => { toggleFav(S.v); updateSongBar(); };
$('#btnMore').onclick = sheetSongMore;

$$('#lyrTabs button').forEach(b => b.onclick = () => {
  $$('#lyrTabs button').forEach(x => x.classList.toggle('on', x === b));
  $('#lyrSearch').classList.toggle('hidden', b.dataset.tab !== 'search');
  $('#lyrPaste').classList.toggle('hidden', b.dataset.tab !== 'paste');
});
$('#lrcSearchBtn').onclick = searchLyrics;
$('#pasteBtn').onclick = () => { const txt = $('#pasteBox').value; const lrc = parseLRC(txt); if (lrc) setEntries(lrc, true); else startSync(plainLines(txt)); };

$('#sMark').onclick = syncMark;
$('#sUndo').onclick = syncUndo;
$('#sGap').onclick = syncGap;
$('#sPlay').onclick = () => { if (!playerReady) return; player.getPlayerState() === YT.PlayerState.PLAYING ? player.pauseVideo() : player.playVideo(); };
$('#sSpeed').onclick = e => { const r = { 1: 0.75, 0.75: 0.5, 0.5: 1 }[e.target.dataset.r || 1]; e.target.dataset.r = r; e.target.textContent = r + 'x'; playerReady && player.setPlaybackRate(r); };
$('#sCancel').onclick = () => { if (playerReady) player.pauseVideo(); if (S.entries.length) { S.phase = 'ready'; showPane('pReady'); renderReady(); } else { S.phase = 'lyrics'; showPane('pLyrics'); } };

$('#playBtn').onclick = startGame;
[['#rdPace', 'pace'], ['#rdMode', 'mode'], ['#rdDiff', 'difficulty']].forEach(([sel, key]) =>
  $$(sel + ' button').forEach(b => b.onclick = () => applySetting(key, b.dataset.v)));

['#lPrev', '#lCur'].forEach(sel => $(sel).addEventListener('click', e => {
  if (e.target.closest('[data-prevtog]')) { settings.showPrev = settings.showPrev === false; saveSettings(); renderGame(); return; }
  const adj = e.target.closest('[data-adj]');
  if (adj) { sheetAdjustVerse(+adj.dataset.adj); return; }
  const ai = e.target.closest('[data-trai]');
  if (ai) { const l = S.lines[+ai.dataset.trai]; if (l) sheetAiTr(l.text, settings.lang, renderGame); return; }
  const t = e.target.closest('[data-trfix]');
  if (t) { const l = S.lines[+t.dataset.trfix]; if (l) sheetFixTr(l.text, settings.lang, renderGame); return; }
  const b = e.target.closest('[data-bm]'); if (b) toggleSavePhrase(S.lines[+b.dataset.bm]);
}));
$('#gBack').onclick = goBackVerse;
$('#answerForm').onsubmit = e => { e.preventDefault(); submitAnswer($('#answer').value); };
$$('#pad .opt').forEach(btn => btn.onclick = () => { if (btn.textContent && Date.now() >= padFreezeUntil) submitAnswer(btn.textContent); });
$$('.replayBtn').forEach(b => b.onclick = () => { setStatus('Ouvindo de novo…', 'info'); replayLine(); });
$('#gHint').onclick = giveHint;
$('#gSkip').onclick = skipBlank;
$('#gPause').onclick = () => { if (S.waiting) return replayLine(); player.getPlayerState() === YT.PlayerState.PLAYING ? player.pauseVideo() : player.playVideo(); };
function setSpeedLabels() { ['#gSpeed', '#kSpeed'].forEach(s => $(s).innerHTML = `<b>${settings.speed}x</b><span>Velocidade</span>`); }
const cycleSpeed = () => { settings.speed = { 1: 0.75, 0.75: 0.5, 0.5: 1 }[settings.speed] || 1; saveSettings(); player.setPlaybackRate(settings.speed); setSpeedLabels(); };
$('#gSpeed').onclick = cycleSpeed;
$('#gQuit').onclick = confirmQuit;
$('#gSet').onclick = sheetSettings;
$('#skipIntro').onclick = skipToLyrics;

$('#karBtn').onclick = startKaraoke;
$('#explainBtn').onclick = () => sheetExplain();
$('#songTrBtn').onclick = () => sheetTranslateSong();
$('#kAiSong').onclick = () => sheetTranslateSong();
$('#kQuit').onclick = confirmQuit;
$('#kSet').onclick = sheetSettings;
$('#kSpeed').onclick = cycleSpeed;
$('#kPause').onclick = () => player.getPlayerState() === YT.PlayerState.PLAYING ? player.pauseVideo() : player.playVideo();
$('#kBack').onclick = karaokeBack;
$('#kNext').onclick = () => karaokeSeek(S.cur + 1);
$('#kTr').onclick = () => {
  settings.karTr = { side: 'below', below: 'off', off: 'side' }[settings.karTr] || 'side'; saveSettings();
  renderKaraoke(); translateAllKaraoke();
};
$('#kList').addEventListener('click', async e => {
  const kai = e.target.closest('[data-kai]');
  if (kai) { sheetAiTr(S.lines[+kai.dataset.kai].text, settings.lang, () => S.lines.forEach((_, i) => paintKarLine(i))); return; }
  const ktr = e.target.closest('[data-ktr]');
  if (ktr) { sheetFixTr(S.lines[+ktr.dataset.ktr].text, settings.lang, () => S.lines.forEach((_, i) => paintKarLine(i))); return; }
  const adj = e.target.closest('[data-kadj]');
  if (adj) { sheetAdjustVerse(+adj.dataset.kadj); return; }
  const bm = e.target.closest('[data-kbm]');
  if (bm) { const on = await toggleSavePhrase(S.lines[+bm.dataset.kbm]); bm.classList.toggle('on', on); bm.innerHTML = icon(on ? 'bm-f' : 'bm'); return; }
  const row = e.target.closest('.kline'); if (row) karaokeSeek(+row.dataset.i);
});
['wheel', 'touchmove'].forEach(ev => $('#kList').addEventListener(ev, () => { karUserScroll = Date.now(); }, { passive: true }));

['input', 'pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { S.lastActivity = Date.now(); if (S.waiting) setRing(0); }, true));
document.addEventListener('visibilitychange', async () => { if (document.visibilityState === 'visible' && S.phase === 'play' && !wakeLock) { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { } } });

document.addEventListener('keydown', e => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (e.key === 'Escape' && !$('#sheet').classList.contains('hidden')) { dismissSheet(); return; }
  if (!$('#sheet').classList.contains('hidden')) return;
  if (S.phase === 'karaoke' && !typing) {
    if (e.code === 'Space') { e.preventDefault(); $('#kPause').click(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); karaokeBack(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); karaokeSeek(S.cur + 1); }
    else if (e.key === 'Escape') confirmQuit();
  }
  if (S.phase === 'sync' && !typing) {
    if (e.code === 'Space') { e.preventDefault(); syncMark(); }
    else if (e.key === 'Backspace') { e.preventDefault(); syncUndo(); }
  }
  if (S.phase === 'play') {
    if (settings.mode === 'choice' && !typing) {
      const k = { ArrowUp: 0, ArrowLeft: 1, ArrowRight: 2, ArrowDown: 3, 1: 0, 2: 1, 3: 2, 4: 3 }[e.key];
      if (k != null) { e.preventDefault(); const btn = $$('#pad .opt')[k]; if (btn && !btn.disabled) btn.click(); }
      if (e.code === 'Space') { e.preventDefault(); replayLine(); }
    }
    if (e.key === 'Escape') { e.preventDefault(); replayLine(); }
    if (e.key === 'Backspace' && !typing) { e.preventDefault(); goBackVerse(); }
  }
});

/* ================= init ================= */
(function init() {
  const q = new URLSearchParams(location.search).get('v');
  renderHome();
  const id = parseVideoId(q || '');
  if (id) openSong(id, null);
})();
