'use strict';
/* LyricGap — complete song lyrics while the YouTube video plays. */

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
  { pace: 'flow', difficulty: 'medio', mode: isTouch ? 'choice' : 'type', speed: 1, translate: true, lang: 'en', autoReplay: 8, sounds: true, ytKey: '', pipedOk: '', goal: 20 },
  store.get('lg:settings', {})
);
const saveSettings = () => store.set('lg:settings', settings);

let lib = store.get('lg:lib', null) || (() => {
  const old = store.get('lg:songs', {}), videos = {};
  for (const [id, s] of Object.entries(old)) videos[id] = { id, title: s.title || id, author: '', lrc: s.lrc || null, offset: s.offset || 0, best: s.best || 0, fav: false, updated: s.updated || 0 };
  return { videos, playlists: [], recent: Object.keys(videos) };
})();
lib.phrases = lib.phrases || [];
lib.stats = Object.assign({ songs: 0, lines: 0, words: 0, misses: 0, ms: 0, days: {}, uniq: [] }, lib.stats || {});

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
  if (after.level > before) toast(`⬆️ Nível ${after.level} · ${after.name}!`);
  else if (k === 'words' && !goalBefore && d.words >= settings.goal) toast('🎯 Meta do dia batida!');
}
const xpOf = st => st.words * 10 + st.lines * 2 + st.songs * 50;
const LEVEL_NAMES = ['Iniciante', 'Ouvinte', 'Curioso', 'Cantor de chuveiro', 'Afinado', 'Dedicado', 'Fluente', 'Virtuoso', 'Mestre', 'Lenda'];
function levelOf(xp) {
  let level = 1; while (xp >= 50 * level * level) level++;       // thresholds: 50, 200, 450, 800…
  const from = 50 * (level - 1) * (level - 1), to = 50 * level * level;
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
const trCache = store.get('lg:tr', {});

const STOP = new Set(('the a an and or but of to in on at for is it its i you me my we he she they them his her our your be am are was were ' +
  'do did does so as if no not oh ooh ah uh yeah hey la na da o e de do um uma que en el los las y se mi tu te le les du un une et je il').split(' '));

/* ================= state ================= */
let player = null, apiReady = false, playerReady = false, pendingId = null, wakeLock = null;
const S = {
  videoId: null, v: null, autoSearched: false, queue: null,
  entries: [], lines: [], pool: [],
  phase: 'idle',        // idle | lyrics | sync | ready | play
  cur: -1, hold: null, waiting: false, finished: false, lastActivity: 0,
  score: 0, streak: 0, offset: 0,
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
    if (S.phase === 'play') endPlay();
    S.phase = 'idle';
    renderHome();
  }
  window.scrollTo(0, 0);
}
const panes = ['pLyrics', 'pSync', 'pReady', 'pGame'];
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
    const f = el('button', 'feature', `<div class="ov"><span class="eyebrow">Continuar</span><b>${esc(v.title || v.id)}</b>
      <small>${esc(v.author || '')}${v.best ? ' · recorde ' + v.best : ''}${v.lrc ? '' : ' · precisa de letra'}</small></div>
      <span class="fab">${icon('play')}</span>`);
    f.style.backgroundImage = `url(${hq(v.id)})`;
    f.onclick = () => openSong(v.id, v);
    box.appendChild(f);

    if (recent.length > 1) {
      const s = section('Recentes'); const car = el('div', 'carousel');
      recent.slice(1, 15).forEach(x => car.appendChild(ccard(x))); s.appendChild(car); box.appendChild(s);
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

const SUGGEST = ['Músicas fáceis em inglês', 'Acoustic covers', 'Ed Sheeran', 'Adele', 'Coldplay', 'Bruno Mars', 'The Beatles', 'Taylor Swift', 'Shakira', 'Músicas em espanhol'];
function renderSearchTab() {
  const box = $('#searchList'); box.innerHTML = '';
  if (!H.results) {
    const s = el('div', ''); s.appendChild(el('div', 'sectionhead', '<h2 style="font-size:17px">Sugestões</h2>'));
    const wrap = el('div', 'suggest');
    SUGGEST.forEach(q => { const b = el('button', '', esc(q)); b.onclick = () => { $('#q').value = q; doSearch(q); }; wrap.appendChild(b); });
    s.appendChild(wrap);
    s.appendChild(el('p', 'caption', 'Dica: você também pode colar o link de um vídeo do YouTube na busca.'));
    box.appendChild(s);
    return;
  }
  if (H.results === 'loading') { box.appendChild(el('div', 'empty', '<b>Buscando…</b>')); return; }
  if (H.results.error) { box.appendChild(emptyMsg('search', 'Busca indisponível', H.results.error)); return; }
  if (!H.results.length) { box.appendChild(emptyMsg('search', 'Nada encontrado', 'Tente outro nome ou cole o link do vídeo.')); return; }
  const list = el('div', 'list');
  H.results.forEach(v => list.appendChild(videoItem(v)));
  box.appendChild(list);
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
        <b>${done ? 'Meta de hoje batida 🎯' : 'Meta de hoje'}</b>
        <small>${done ? `${t.words} palavras certas hoje` : `Faltam ${settings.goal - t.words} palavras certas`}</small>
        <div class="prog-chips"><span class="pchip">🔥 ${streak} dia${streak === 1 ? '' : 's'}</span><span class="pchip lvl">Nível ${lv.level}</span></div>
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
    <p class="caption">XP: 10 por palavra certa, 2 por verso tocado e 50 por música completa. Jogue um pouco todo dia para manter a sequência 🔥.</p>
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
async function ytSearch(q) {
  if (settings.ytKey) {
    const r = await fetchT('https://www.googleapis.com/youtube/v3/search?' + new URLSearchParams({ part: 'snippet', type: 'video', maxResults: '20', videoEmbeddable: 'true', q, key: settings.ytKey }));
    const j = await r.json();
    if (j.error) throw new Error('API do YouTube: ' + j.error.message);
    return j.items.map(it => ({ id: it.id.videoId, title: decode(it.snippet.title), author: decode(it.snippet.channelTitle) }));
  }
  const order = [settings.pipedOk, ...PIPED.filter(x => x !== settings.pipedOk)].filter(Boolean);
  for (const base of order) {
    try {
      const r = await fetchT(`${base}/search?${new URLSearchParams({ q, filter: 'videos' })}`);
      if (!r.ok) continue;
      const j = await r.json();
      const items = (j.items || []).filter(x => x.type === 'stream' && x.url)
        .map(x => ({ id: (x.url.match(/v=([\w-]{11})/) || [])[1], title: x.title, author: x.uploaderName, dur: x.duration }))
        .filter(x => x.id && !x.isShort);
      if (items.length) { if (settings.pipedOk !== base) { settings.pipedOk = base; saveSettings(); } return items; }
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
      ? 'Os servidores gratuitos de busca não responderam agora 😕<br><br>Opções: cole o link do vídeo aqui na busca, ou coloque uma <b>chave da API do YouTube</b> (grátis) em ⚙ Configurações para uma busca sempre funcionando.'
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
        const playing = e.data === YT.PlayerState.PLAYING;
        $('#gPause').innerHTML = icon(playing ? 'pause' : 'play') + `<span>${playing ? 'Pausa' : 'Tocar'}</span>`;
        $('#sPlay').innerHTML = icon(playing ? 'pause' : 'play') + `<span>${playing ? 'Pausa' : 'Play'}</span>`;
      },
      onError: e => {
        const msg = (e.data === 101 || e.data === 150) ? 'Esse vídeo não pode ser tocado fora do YouTube. Tente outra versão (ex.: "lyrics" ou "audio").' : 'Erro no player do YouTube (' + e.data + ').';
        toast(msg);
      }
    }
  });
}
function openSong(id, meta, queue = null) {
  S.queue = queue;
  const v = vid(id, meta);
  lib.recent = [id, ...lib.recent.filter(x => x !== id)].slice(0, 50);
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
function prefillLyrics() {
  const v = S.v; let track = v.title || '', artist = (v.author || '').replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim();
  const m = track.match(/^(.+?)\s+[-–]\s+(.+)$/);
  if (m) { artist = m[1]; track = m[2]; }
  track = track.replace(/[([](official|lyric|audio|video|clipe|hd|4k|visualizer|live|letra|legendado|tradu)[^)\]]*[)\]]/gi, '').replace(/\s+/g, ' ').trim();
  $('#qTrack').value = track; $('#qArtist').value = artist;
}

/* ================= lyrics (LRCLIB) ================= */
async function searchLyrics() {
  const track = $('#qTrack').value.trim(), artist = $('#qArtist').value.trim();
  const box = $('#lrcResults'); box.innerHTML = '<p class="muted" style="text-align:center">Buscando letra…</p>';
  try {
    let res = [];
    if (track) {
      const p = new URLSearchParams({ track_name: track }); if (artist) p.set('artist_name', artist);
      res = await (await fetchT('https://lrclib.net/api/search?' + p, 10000)).json();
    }
    if (!res.length) res = await (await fetchT('https://lrclib.net/api/search?' + new URLSearchParams({ q: `${track} ${artist}`.trim() }), 10000)).json();
    res = res.filter(r => r.syncedLyrics || r.plainLyrics).sort((a, b) => (!!b.syncedLyrics) - (!!a.syncedLyrics)).slice(0, 8);
    if (!res.length) {
      box.innerHTML = '<div class="notfound"><b>Letra não encontrada</b><span>Essa música ainda não está no banco de letras. Cole a letra de qualquer site e sincronize uma vez. Fica salvo para sempre.</span><button class="btn primary wide" id="goPaste">Colar letra</button></div>';
      $('#goPaste').onclick = () => $('#lyrTabs [data-tab=paste]').click();
      return;
    }
    const vd = playerReady ? player.getDuration() : 0;
    box.innerHTML = '';
    res.forEach(r => {
      const b = document.createElement('div'); b.className = 'item';
      const diff = vd && r.duration ? Math.abs(vd - r.duration) : 0;
      b.innerHTML = `<div class="meta"><b>${esc(r.trackName)} — ${esc(r.artistName)}</b><small>${r.syncedLyrics ? '<span class="badge">SINCRONIZADA</span>' : 'só texto · você sincroniza'}${r.duration ? ' · ' + fmtDur(r.duration) : ''}${diff > 4 ? ' · ⚠ duração diferente do vídeo' : ''}</small></div>`;
      b.onclick = () => { if (r.syncedLyrics) setEntries(parseLRC(r.syncedLyrics), true); else startSync(plainLines(r.plainLyrics)); };
      box.appendChild(b);
    });
  } catch (e) {
    box.innerHTML = '<p class="muted">Erro ao buscar a letra. Use a aba Colar.</p>';
  }
}
function setEntries(entries, save) {
  if (!entries || !entries.length) return;
  S.entries = entries;
  if (save) saveSong();
  S.phase = 'ready'; showPane('pReady'); renderReady();
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
  $('#readyInfo').textContent = settings.pace === 'flow'
    ? 'A música não para: responda enquanto o verso toca. Quanto mais rápido, mais pontos. Erros só aparecem no final.'
    : 'O vídeo pausa no fim de cada frase. Acertou, continua. Errou, a frase toca de novo.';
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
function tokenize(text) {
  return text.split(/(\s+)/).filter(s => s !== '').map(raw => {
    if (/^\s+$/.test(raw)) return { raw, ws: true };
    const m = raw.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u);
    return { raw, pre: m[1], core: m[2], post: m[3], word: /\p{L}/u.test(m[2]) };
  });
}
function buildGame() {
  const E = S.entries, lines = [], seen = new Map();
  const dur = playerReady ? player.getDuration() : 0;
  for (let i = 0; i < E.length; i++) {
    if (!E[i].text) continue;
    let end = i + 1 < E.length ? E[i + 1].t : (dur || E[i].t + 6);
    end = Math.min(end, E[i].t + 10);
    if (end - E[i].t < 0.6) end = E[i].t + 0.6;
    const tokens = tokenize(E[i].text);
    tokens.forEach(tk => { if (tk.word && tk.core.length >= 2) { const k = norm(tk.core); if (k && !seen.has(k)) seen.set(k, tk.core); } });
    lines.push({ t: E[i].t, end, text: E[i].text, tokens, blanks: [], blankMap: {}, tr: null });
  }
  const diff = settings.difficulty;
  lines.forEach(line => {
    if (diff === 'facil' && Math.random() > 0.6) return;
    const words = line.tokens.map((tk, i) => ({ tk, i })).filter(x => x.tk.word);
    let cand = words.filter(x => x.tk.core.length >= 3 && !STOP.has(norm(x.tk.core)));
    if (!cand.length) cand = words.filter(x => x.tk.core.length >= 2);
    if (!cand.length) return;
    cand = shuffle(cand).sort((a, b) => (b.tk.core.length > 3) - (a.tk.core.length > 3));
    const count = diff === 'dificil' && words.length >= 5 ? 2 : 1;
    const pick = [];
    for (const c of cand) { if (pick.length >= count) break; if (!pick.some(p => Math.abs(p.i - c.i) < 3)) pick.push(c); }
    pick.sort((a, b) => a.i - b.i).forEach(p => {
      const b = { ti: p.i, answer: p.tk.core, solved: false, missed: false, attempts: 0, hint: 0, options: null, removed: new Set() };
      line.blanks.push(b); line.blankMap[p.i] = b;
    });
  });
  S.lines = lines; S.pool = [...seen.values()];
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
  Object.assign(S, { phase: 'play', cur: -1, maxCur: -1, backAt: 0, backTarget: null, hold: null, waiting: false, finished: false, score: 0, streak: 0 });
  showPane('pGame'); document.body.classList.add('playing'); closeSheet();
  applyMode();
  $('#gSpeed').innerHTML = `<b>${settings.speed}x</b><span>Velocidade</span>`;
  setStatus('🎧 Ouça e complete!', 'info');
  player.seekTo(0, true); player.setPlaybackRate(settings.speed); player.playVideo();
  renderGame();
  window.scrollTo(0, 0);
  if (settings.mode === 'type' && !isTouch) $('#answer').focus();
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { }
}
function endPlay() {
  document.body.classList.remove('playing');
  try { wakeLock && wakeLock.release(); } catch { } wakeLock = null;
}
function quitGame() {
  if (playerReady) player.pauseVideo();
  endPlay();
  S.phase = 'ready'; showPane('pReady'); renderReady();
}
const lyricTime = () => player.getCurrentTime() + S.offset;
const seekLyric = t => player.seekTo(Math.max(0, t - S.offset), true);
function setStatus(msg, cls = '') { const el = $('#status'); el.textContent = msg; el.className = 'status ' + cls; }
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
  const line = S.lines[idx];
  if (line) translateLine(line);   // prefetch so it's ready when the line becomes "previous"
  renderGame();
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
      S.lines[i].blanks.forEach(b => { if (!b.solved) { b.solved = true; b.missed = true; b.soft = true; S.streak = 0; stat('misses'); } });
    }
  }
  if (idx !== S.cur) enterLine(idx);
  const line = S.lines[S.cur];
  setRing(line && hasUnsolved(line) ? 1 - (L - line.t) / Math.max(0.5, line.end - line.t) : 0);
  const last = S.lines[S.lines.length - 1];
  if (last && S.cur === S.lines.length - 1 && L > last.end) last.blanks.forEach(b => { if (!b.solved) { b.solved = b.missed = b.soft = true; stat('misses'); renderGame(); } });
  checkFinish(idx, L);
}
let lastTick = Date.now();
function tick() {
  const now = Date.now(), dt = now - lastTick; lastTick = now;
  if (S.phase !== 'play' || !playerReady) return;
  if (dt < 1000 && player.getPlayerState() === YT.PlayerState.PLAYING) { S.msAcc = (S.msAcc || 0) + dt; if (S.msAcc > 10000) { stat('ms', S.msAcc); S.msAcc = 0; } }
  const st = player.getPlayerState();
  const L = lyricTime();
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
        if (el >= w) { setStatus('🔁 Ouvindo de novo…', 'info'); replayLine(); }
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
  setStatus(`⏮ Verso ${target + 1} de ${S.lines.length}`, 'info');
}
function resume() { S.waiting = false; setRing(0); player.playVideo(); }

function submitAnswer(value) {
  const line = S.lines[S.cur]; const b = activeBlank(line);
  if (!b) return;
  const v = judge(value, b.answer);
  if (v === 'empty') return;
  if (settings.pace === 'flow') return submitFlow(line, b, v, value);
  if (v === 'exact' || v === 'close') {
    b.solved = true;
    const pts = Math.max(10, [100, 60, 30][Math.min(b.attempts, 2)] - b.hint * 25);
    S.streak++; S.score += pts + Math.min(S.streak - 1, 10) * 10; stat('words');
    setStatus(v === 'close' ? `Quase! Era “${b.answer}” · +${pts}` : `Isso! +${pts}`, 'good');
    flash('flash-ok'); beep(true);
    $('#answer').value = '';
    if (!hasUnsolved(line)) { translateLine(line); if (S.waiting) resume(); }
  } else {
    b.attempts++; S.streak = 0;
    flash('flash-bad'); beep(false);
    if (settings.mode === 'choice') b.removed.add(norm(value));
    if (b.attempts >= 3) {
      b.solved = true; b.missed = true; stat('misses');
      setStatus(`Era “${b.answer}” — ouça de novo`, 'bad');
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
/* Flow: no rewinds, no red, no buzzer. Right = points (faster = more). Wrong = quietly revealed. */
function submitFlow(line, b, v, value) {
  if (v === 'exact' || v === 'close') {
    b.solved = true;
    const L = lyricTime();
    const speed = Math.max(0, Math.min(1, 1 - (L - line.t) / Math.max(0.5, line.end - line.t)));
    const pts = Math.max(10, 50 + Math.round(speed * 50) - b.hint * 20 - b.attempts * 15);
    S.streak++; S.score += pts + Math.min(S.streak - 1, 10) * 5; stat('words');
    setStatus(S.streak >= 3 ? `+${pts} · 🔥${S.streak}` : `+${pts}`, 'good');
    flash('flash-ok'); beep(true);
    $('#answer').value = '';
  } else if (settings.mode === 'choice') {
    b.solved = true; b.missed = true; b.soft = true; S.streak = 0; stat('misses');
    setStatus('', '');
  } else {
    b.attempts++;            // typing: let the player try again until the line ends
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
  line.blanks.forEach(b => { if (!b.solved) { b.solved = true; b.missed = true; stat('misses'); } });
  S.streak = 0; setStatus('Pulado', '');
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
  if (withTr && line.tr && settings.translate) h += `<div class="tr">${esc(line.tr)}</div>`;
  return h;
}
const DIRS = ['up', 'left', 'right', 'down'];
function renderGame() {
  if (S.phase !== 'play') return;
  const i = S.cur, L = S.lines;
  const prev = L[i - 1];
  $('#lPrev').innerHTML = prev ? lineHTML(prev, false, true) + bmBtn(!!findPhrase(S.videoId, prev.text), `data-bm="${i - 1}"`) : '';
  $('#lPrev').classList.toggle('empty', !prev);
  // a verse revisited with the back button shows its answers + translation (nothing left to answer)
  const revisit = i >= 0 && i < S.maxCur && !hasUnsolved(L[i]);
  $('#lCur').innerHTML = i < 0 ? '<span class="muted">🎧 Prepare-se…</span>'
    : lineHTML(L[i], true, revisit) + (revisit ? ' ' + bmBtn(!!findPhrase(S.videoId, L[i].text), `data-bm="${i}" style="position:static;transform:none;display:inline-grid;vertical-align:middle"`) : '');
  $('#gBack').disabled = S.cur <= 0 && S.backTarget == null;
  $('#gSkip').classList.toggle('hidden', settings.pace === 'flow');
  $('#hudScore').textContent = S.score; $('#hudStreak').textContent = S.streak;
  $('#progress').style.width = (L.length ? Math.max(0, (i + 1) / L.length * 100) : 0) + '%';
  const b = activeBlank(L[i]);
  $('#gHint').disabled = $('#gSkip').disabled = !b;
  if (settings.mode === 'choice') {
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
async function fetchTr(text) {
  if (settings.lang === 'pt') return null;
  const key = settings.lang + '|' + text;
  if (trCache[key]) return trCache[key];
  try {
    const r = await fetchT('https://api.mymemory.translated.net/get?' + new URLSearchParams({ q: text, langpair: settings.lang + '|pt-BR' }));
    const j = await r.json();
    const tx = j && j.responseData && j.responseData.translatedText;
    if (tx && !/MYMEMORY WARNING|INVALID/i.test(tx)) { trCache[key] = decode(tx); store.set('lg:tr', trCache); return trCache[key]; }
  } catch { }
  return null;
}
async function translateLine(line) {
  if (!settings.translate || line.tr) return;
  const tr = await fetchTr(line.text);
  if (tr) { line.tr = tr; renderGame(); }
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
  lib.phrases.unshift(p); saveLib(); toast('🔖 Frase salva');
  renderGame();
  if (!p.tr) { const tr = await fetchTr(p.text); if (tr) { p.tr = tr; line.tr = line.tr || tr; saveLib(); } }
  return true;
}
const bmBtn = (saved, attrs) => `<button class="iconbtn sm bm ${saved ? 'on' : ''}" ${attrs} title="Salvar frase">${icon(saved ? 'bm-f' : 'bm')}</button>`;

let clipPlayer = null;
function sheetClip(p) {
  if (playerReady) player.pauseVideo();
  const link = `https://youtu.be/${p.videoId}?t=${Math.floor(p.start)}`;
  openSheet(`<div class="cliptext">${esc(p.text)}</div>${p.tr ? `<div class="tr">${esc(p.tr)}</div>` : ''}
    <div class="clipwrap"><div id="clipPlayer"></div></div>
    <p class="muted" style="text-align:center;margin:0 0 6px">${esc(p.title || '')} · ${fmtDur(p.start) || '0:00'}</p>
    <div class="actions" style="margin-top:6px">
      <button class="ctrl" data-a="again">${icon('replay')}<span>Ouvir de novo</span></button>
      <button class="ctrl" data-a="song">${icon('play')}<span>Jogar música</span></button>
      <a class="ctrl" href="${link}" target="_blank" rel="noopener" style="text-decoration:none">${icon('ext')}<span>YouTube</span></a>
      <button class="ctrl" data-a="del">${icon('trash')}<span>Remover</span></button>
    </div>`, {
    again: () => clipPlayer && clipPlayer.loadVideoById({ videoId: p.videoId, startSeconds: p.start, endSeconds: p.end }),
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
function finish() {
  S.finished = true;
  stat('songs');
  if (!lib.stats.uniq.includes(S.videoId)) lib.stats.uniq.push(S.videoId);
  const all = S.lines.flatMap(l => l.blanks.map(b => ({ b, l })));
  const ok = all.filter(x => x.b.solved && !x.b.missed).length;
  const acc = all.length ? Math.round(ok / all.length * 100) : 0;
  S.v.best = Math.max(S.v.best || 0, S.score); saveLib();
  const missed = all.filter(x => x.b.missed || x.b.attempts > 0);
  const hasNext = S.queue && S.queue.idx + 1 < S.queue.ids.length;
  openSheet(`<h3>🎉 Fim da música!</h3>
    <div class="stats"><div><b>${S.score}</b><span>pontos</span></div><div><b>${acc}%</b><span>acertos</span></div><div><b>${S.v.best}</b><span>recorde</span></div></div>
    ${(() => { const t = todayStats(), lv = levelOf(xpOf(lib.stats)), sk = dayStreak(); return `<div class="todayline"><span>Hoje <b>${t.words}/${settings.goal}</b> palavras</span><span>🔥 <b>${sk}</b> dia${sk === 1 ? "" : "s"}</span><span>Nível <b>${lv.level}</b></span></div>`; })()}
    ${missed.length ? `<p class="muted">Palavras para revisar · 🔖 salva a frase</p><ul class="missed">${missed.map(x => `<li><div><b>${esc(x.b.answer)}</b> — ${esc(x.l.text)}${x.l.tr ? `<div class="tr">${esc(x.l.tr)}</div>` : ''}</div>${bmBtn(!!findPhrase(S.videoId, x.l.text), `data-a="bm" data-i="${S.lines.indexOf(x.l)}" style="position:static;transform:none"`)}</li>`).join('')}</ul>` : '<p class="muted" style="text-align:center">Perfeito, nenhum erro! 🏆</p>'}
    <div class="sheetbtns" style="flex-direction:column">
      ${hasNext ? '<button class="btn primary" data-a="next">Próxima música ▶</button>' : ''}
      <button class="btn ${hasNext ? '' : 'primary'}" data-a="again">Jogar de novo</button>
      <button class="btn" data-a="close">Fechar</button>
    </div>`, {
    next: () => { const q = { ...S.queue, idx: S.queue.idx + 1 }; closeSheet(); endPlay(); openSong(q.ids[q.idx], lib.videos[q.ids[q.idx]], q); },
    again: () => { closeSheet(); startGame(); },
    close: () => { closeSheet(); quitGame(); },
    bm: async (e, el) => { e.stopPropagation(); const on = await toggleSavePhrase(S.lines[+el.dataset.i]); el.classList.toggle('on', on); el.innerHTML = icon(on ? 'bm-f' : 'bm'); }
  });
}

/* ================= sheets ================= */
function openSheet(html, actions = {}) {
  $('#sheetContent').innerHTML = html;
  $$('#sheetContent [data-a]').forEach(el => { const f = actions[el.dataset.a]; if (f) el.addEventListener('click', e => f(e, el)); });
  $('#sheet').classList.remove('hidden');
}
function closeSheet() {
  $('#sheet').classList.add('hidden');
  if (clipPlayer) { try { clipPlayer.destroy(); } catch { } clipPlayer = null; }
}
$('#sheetBg').onclick = closeSheet;

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
    <div class="field"><label>Idioma das músicas</label>${seg('lang', [['en', 'EN'], ['es', 'ES'], ['fr', 'FR'], ['it', 'IT'], ['de', 'DE'], ['pt', 'PT']], settings.lang)}</div>
    <div class="group">
      ${swRow('Tradução para português', 'translate', 'Mostrada no cartão da frase anterior')}
      ${swRow('Sons de acerto', 'sounds')}
    </div>

    <div class="grouplabel">Busca de vídeos</div>
    <input id="ytKey" placeholder="Chave da API do YouTube (opcional)" value="${esc(settings.ytKey)}" autocapitalize="off" autocorrect="off" spellcheck="false">
    <p class="caption" style="margin-top:6px">Sem chave, a busca usa servidores gratuitos que às vezes ficam fora do ar. Uma chave grátis (Google Cloud → YouTube Data API v3) deixa a busca estável.</p>

    <div class="grouplabel">Biblioteca</div>
    <div class="group">
      <button class="grow" data-a="export">${icon('share')}<span>Copiar backup<small>Músicas, letras, playlists e frases</small></span></button>
      <button class="grow" data-a="import">${icon('text')}<span>Restaurar backup<small>Mescla com o que já existe</small></span></button>
    </div>
    <textarea id="ioBox" rows="4" class="hidden" placeholder="Cole aqui o backup e toque em Restaurar backup"></textarea>

    <button class="btn primary wide" data-a="done">Concluído</button>
    <p class="caption center-text">LyricGap · letras de LRCLIB · tradução por MyMemory</p>`, {
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
    done: () => { settings.ytKey = ($('#ytKey').value || '').trim(); saveSettings(); closeSheet(); if (S.phase === 'ready') renderReady(); }
  });
  $$('#sheetContent [data-seg]').forEach(g => g.querySelectorAll('button').forEach(b => b.onclick = () => applySetting(g.dataset.seg, b.dataset.v, g)));
  $$('#sheetContent [data-t]').forEach(b => b.onclick = () => { const k = b.dataset.t; settings[k] = !settings[k]; saveSettings(); b.classList.toggle('on', settings[k]); if (S.phase === 'play') renderGame(); });
  $('#ytKey').addEventListener('change', e => { settings.ytKey = e.target.value.trim(); saveSettings(); });
}
function applySetting(k, v, group) {
  if (['autoReplay', 'speed'].includes(k)) v = +v;
  settings[k] = v; saveSettings();
  if (group) group.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.v === String(v)));
  if (k === 'mode' && S.phase === 'play') { applyMode(); renderGame(); }
  if (k === 'pace' && S.phase === 'play') { S.waiting = false; setRing(0); player.playVideo(); renderGame(); }
  if (k === 'speed' && playerReady) { player.setPlaybackRate(v); $('#gSpeed').innerHTML = `<b>${v}x</b><span>Velocidade</span>`; }
  if (S.phase === 'ready') renderReady();
}
function sheetSongMore() {
  const v = S.v; if (!v) return;
  const has = S.entries.length > 0;
  openSheet(`<h3>${esc(v.title || 'Música')}</h3>
    <div class="group">
      <button class="grow" data-a="pl">${icon('addlist')}<span>Adicionar à playlist</span></button>
      <button class="grow" data-a="yt">${icon('ext')}<span>Abrir no YouTube</span></button>
    </div>
    <div class="grouplabel">Letra</div>
    <div class="group">
      ${has ? `<button class="grow" data-a="resync">${icon('sync')}<span>Sincronizar de novo<small>Marcar o tempo de cada frase outra vez</small></span></button>
      <button class="grow" data-a="edit">${icon('edit')}<span>Editar LRC<small>Corrigir texto ou tempos</small></span></button>` : ''}
      <button class="grow" data-a="change">${icon('text')}<span>${has ? 'Trocar letra' : 'Buscar ou colar letra'}</span></button>
    </div>`, {
    pl: () => sheetAddToPlaylist(v),
    yt: () => { closeSheet(); window.open('https://www.youtube.com/watch?v=' + v.id, '_blank', 'noopener'); },
    resync: () => { closeSheet(); if (S.phase === 'play') quitGame(); startSync(S.entries.filter(e => e.text).map(e => e.text)); },
    edit: () => sheetEditLRC(),
    change: () => { closeSheet(); if (S.phase === 'play') quitGame(); S.phase = 'lyrics'; showPane('pLyrics'); prefillLyrics(); }
  });
}
function sheetEditLRC() {
  openSheet(`<h3>Editar LRC</h3><p class="caption" style="margin-top:0">Cada linha: <code>[mm:ss.cc]texto</code></p>
    <textarea id="lrcBox" rows="12">${esc(toLRC(S.entries))}</textarea>
    <div class="sheetbtns"><button class="btn" data-a="copy">Copiar</button><button class="btn primary" data-a="save">Salvar</button></div>`, {
    copy: async () => { try { await navigator.clipboard.writeText($('#lrcBox').value); toast('Copiado ✓'); } catch { } },
    save: () => { const e = parseLRC($('#lrcBox').value); if (!e) { toast('LRC inválido'); return; } S.entries = e; saveSong(); closeSheet(); if (S.phase === 'ready') renderReady(); toast('Salvo ✓'); }
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

['#lPrev', '#lCur'].forEach(sel => $(sel).addEventListener('click', e => { const b = e.target.closest('[data-bm]'); if (b) toggleSavePhrase(S.lines[+b.dataset.bm]); }));
$('#gBack').onclick = goBackVerse;
$('#answerForm').onsubmit = e => { e.preventDefault(); submitAnswer($('#answer').value); };
$$('#pad .opt').forEach(btn => btn.onclick = () => { if (btn.textContent) submitAnswer(btn.textContent); });
$$('.replayBtn').forEach(b => b.onclick = () => { setStatus('🔁 Ouvindo de novo…', 'info'); replayLine(); });
$('#gHint').onclick = giveHint;
$('#gSkip').onclick = skipBlank;
$('#gPause').onclick = () => { if (S.waiting) return replayLine(); player.getPlayerState() === YT.PlayerState.PLAYING ? player.pauseVideo() : player.playVideo(); };
$('#gSpeed').onclick = () => { settings.speed = { 1: 0.75, 0.75: 0.5, 0.5: 1 }[settings.speed] || 1; saveSettings(); player.setPlaybackRate(settings.speed); $('#gSpeed').innerHTML = `<b>${settings.speed}x</b><span>Velocidade</span>`; };
$('#gQuit').onclick = quitGame;
$('#gSet').onclick = sheetSettings;

['input', 'pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { S.lastActivity = Date.now(); if (S.waiting) setRing(0); }, true));
document.addEventListener('visibilitychange', async () => { if (document.visibilityState === 'visible' && S.phase === 'play' && !wakeLock) { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { } } });

document.addEventListener('keydown', e => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (e.key === 'Escape' && !$('#sheet').classList.contains('hidden')) { closeSheet(); return; }
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
