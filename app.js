'use strict';
/* LyricGap — complete song lyrics while the YouTube video plays. */

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } }
};
const isTouch = matchMedia('(pointer: coarse)').matches;
const DEFAULT_URL = 'https://www.youtube.com/watch?v=PTdzL_K_ss8';

const settings = Object.assign(
  { difficulty: 'medio', mode: isTouch ? 'choice' : 'type', speed: 1, translate: true, lang: 'en' },
  store.get('lg:settings', {})
);
const saveSettings = () => store.set('lg:settings', settings);
let songs = store.get('lg:songs', {});
const saveSongs = () => store.set('lg:songs', songs);
const trCache = store.get('lg:tr', {});

const STOP = new Set(('the a an and or but of to in on at for is it its i you me my we he she they them his her our your be am are was were ' +
  'do did does so as if no not oh ooh ah uh yeah hey la na da o e de do um uma que en el los las y se mi tu te le les du un une et je il').split(' '));

/* ---------- state ---------- */
let player = null, apiReady = false, playerReady = false, pendingId = null;
const S = {
  videoId: null, title: '', author: '', autoSearched: false,
  entries: [],            // [{t, text}] raw synced lyrics (text '' = end marker)
  lines: [], pool: [],    // game lines
  phase: 'idle',          // idle | lyrics | sync | ready | play
  cur: -1, hold: null, waiting: false, finished: false,
  score: 0, streak: 0, offset: 0,
  sync: { lines: [], idx: 0, entries: [] }
};

/* ---------- helpers ---------- */
function norm(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`´]/g, "'").replace(/[^\p{L}\p{N}']/gu, '');
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
const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0;[arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
const fmt = t => { const m = Math.floor(t / 60), s = (t - m * 60).toFixed(2).padStart(5, '0'); return `${String(m).padStart(2, '0')}:${s}`; };

function parseVideoId(u) {
  u = (u || '').trim();
  if (/^[\w-]{11}$/.test(u)) return u;
  const m = u.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/);
  return m ? m[1] : null;
}
function parseLRC(text) {
  const out = []; let tagged = 0;
  for (const raw of text.split(/\r?\n/)) {
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

/* ---------- UI helpers ---------- */
const sections = ['lyricsCard', 'syncCard', 'readyCard', 'gameCard'];
function show(id) { sections.forEach(s => $('#' + s).classList.toggle('hidden', s !== id)); }
function setStatus(msg, cls = '') { const el = $('#status'); el.textContent = msg; el.className = 'status ' + cls; }
function flash(cls) { const el = $('#lCur'); el.classList.remove('flash-ok', 'flash-bad'); void el.offsetWidth; el.classList.add(cls); }

/* ---------- YouTube ---------- */
window.onYouTubeIframeAPIReady = () => { apiReady = true; if (pendingId) createPlayer(pendingId); };
(function loadApi() { const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s); })();

function createPlayer(id) {
  player = new YT.Player('player', {
    videoId: id,
    playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin, iv_load_policy: 3 },
    events: {
      onReady: () => { playerReady = true; updateMeta(); },
      onStateChange: e => {
        updateMeta();
        if (e.data === YT.PlayerState.ENDED && S.phase === 'play' && !S.finished) finish();
      },
      onError: e => {
        const msg = (e.data === 101 || e.data === 150) ? 'Esse vídeo não permite ser tocado fora do YouTube. Tente outro link (ex.: versão "lyrics" ou "audio").' : 'Erro no player do YouTube (código ' + e.data + ').';
        $('#lyricsStatus').textContent = msg; alert(msg);
      }
    }
  });
}
function loadVideo(id) {
  S.videoId = id; S.title = ''; S.author = ''; S.autoSearched = false;
  store.set('lg:last', id);
  $('#videoWrap').classList.remove('hidden');
  if (player && playerReady) player.cueVideoById(id);
  else if (apiReady && !player) createPlayer(id);
  else pendingId = id;

  const saved = songs[id];
  $('#results').innerHTML = ''; $('#lyricsStatus').textContent = '';
  if (saved && saved.lrc) {
    S.offset = saved.offset || 0;
    setEntries(parseLRC(saved.lrc), false);
  } else {
    S.offset = 0; S.entries = [];
    S.phase = 'lyrics'; show('lyricsCard');
  }
  renderSaved();
}
function updateMeta() {
  if (!playerReady || S.title) return;
  const d = player.getVideoData && player.getVideoData();
  if (!d || !d.title) return;
  S.title = d.title;
  S.author = (d.author || '').replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim();
  let track = S.title, artist = S.author;
  const m = S.title.match(/^(.+?)\s+[-–]\s+(.+)$/);
  if (m) { artist = m[1]; track = m[2]; }
  track = track.replace(/[([](official|lyric|audio|video|clipe|hd|4k|visualizer|live)[^)\]]*[)\]]/gi, '').trim();
  $('#qTrack').value = track; $('#qArtist').value = artist;
  $('#hdrInfo').textContent = S.title.length > 30 ? S.title.slice(0, 30) + '…' : S.title;
  if (songs[S.videoId]) { songs[S.videoId].title = S.title; saveSongs(); renderSaved(); }
  if (S.phase === 'lyrics' && !S.autoSearched) { S.autoSearched = true; searchLyrics(); }
  if (S.phase === 'ready') renderReady();
}

/* ---------- lyrics search (LRCLIB) ---------- */
async function searchLyrics() {
  const track = $('#qTrack').value.trim(), artist = $('#qArtist').value.trim();
  const box = $('#results'); box.innerHTML = '<p class="muted">Buscando…</p>';
  try {
    let res = [];
    if (track) {
      const p = new URLSearchParams({ track_name: track }); if (artist) p.set('artist_name', artist);
      res = await (await fetch('https://lrclib.net/api/search?' + p)).json();
    }
    if (!res.length) res = await (await fetch('https://lrclib.net/api/search?' + new URLSearchParams({ q: `${track} ${artist}`.trim() }))).json();
    res = res.filter(r => r.syncedLyrics || r.plainLyrics).sort((a, b) => (!!b.syncedLyrics) - (!!a.syncedLyrics)).slice(0, 10);
    if (!res.length) {
      box.innerHTML = '<p class="muted">Não encontrei essa letra no LRCLIB. 👉 Vá na aba <b>Colar</b>, cole a letra (de qualquer site de letras) e sincronize — leva o tempo de ouvir a música uma vez, e fica salvo.</p>';
      return;
    }
    const vd = playerReady ? player.getDuration() : 0;
    box.innerHTML = '';
    res.forEach(r => {
      const b = document.createElement('button');
      const diff = vd && r.duration ? Math.abs(vd - r.duration) : 0;
      b.innerHTML = `<span>${esc(r.trackName)} — ${esc(r.artistName)}<br><small>${r.syncedLyrics ? '✅ sincronizada' : '📝 só texto (você sincroniza)'}${r.duration ? ' · ' + fmt(r.duration).slice(0, 5) : ''}${diff > 4 ? ' · ⚠️ duração diferente do vídeo' : ''}</small></span>`;
      b.onclick = () => {
        if (r.syncedLyrics) setEntries(parseLRC(r.syncedLyrics), true);
        else startSync(plainLines(r.plainLyrics));
      };
      box.appendChild(b);
    });
  } catch (e) {
    box.innerHTML = '<p class="muted">Erro ao buscar (' + esc(e.message) + '). Use a aba Colar.</p>';
  }
}

function setEntries(entries, save) {
  if (!entries || !entries.length) return;
  S.entries = entries;
  if (save) saveSong();
  S.phase = 'ready'; show('readyCard'); renderReady();
}
function saveSong() {
  const prev = songs[S.videoId] || {};
  songs[S.videoId] = { ...prev, title: S.title || prev.title || S.videoId, lrc: toLRC(S.entries), offset: S.offset, updated: Date.now() };
  saveSongs(); renderSaved();
}
function renderSaved() {
  const box = $('#savedList'); box.innerHTML = '';
  Object.entries(songs).sort((a, b) => (b[1].updated || 0) - (a[1].updated || 0)).forEach(([id, s]) => {
    const b = document.createElement('button');
    b.textContent = '🎵 ' + (s.title || id) + (s.best ? ` · ${s.best} pts` : '');
    b.onclick = () => { $('#url').value = 'https://www.youtube.com/watch?v=' + id; loadVideo(id); };
    box.appendChild(b);
  });
}
function renderReady() {
  const n = S.entries.filter(e => e.text).length;
  $('#readyTitle').textContent = S.title ? '🎶 ' + S.title : 'Pronto!';
  const best = songs[S.videoId]?.best;
  $('#readyInfo').textContent = `${n} frases carregadas.${best ? ' Recorde: ' + best + ' pts.' : ''} O vídeo pausa no fim de cada frase com lacuna; acertou = continua, errou = volta a frase.`;
  $('#optDiff').value = settings.difficulty; $('#optMode').value = settings.mode;
  $('#optSpeed').value = String(settings.speed); $('#optLang').value = settings.lang; $('#optTr').checked = settings.translate;
  $('#lrcBox').value = toLRC(S.entries);
}

/* ---------- sync mode ---------- */
function startSync(lines) {
  if (!lines.length) { alert('Nenhuma linha de letra encontrada.'); return; }
  S.sync = { lines, idx: 0, entries: [] };
  S.phase = 'sync'; show('syncCard'); renderSync();
  if (playerReady) { player.pauseVideo(); player.seekTo(0, true); }
}
function renderSync() {
  const { lines, idx } = S.sync;
  $('#syncProg').textContent = `${Math.min(idx, lines.length)} / ${lines.length} frases marcadas`;
  $('#sPrev').textContent = lines[idx - 1] || '';
  if (idx < lines.length) {
    $('#sCur').textContent = lines[idx];
    $('#sNext').textContent = lines[idx + 1] || '(última frase)';
    $('#sMark').textContent = 'MARCAR';
  } else {
    $('#sCur').textContent = 'Toque quando a última frase TERMINAR';
    $('#sNext').textContent = '';
    $('#sMark').textContent = 'FIM ✔';
  }
}
function syncMark() {
  if (!playerReady) return;
  const { lines, entries } = S.sync;
  const t = Math.max(0, player.getCurrentTime() - 0.15); // compensate reaction time
  if (S.sync.idx < lines.length) {
    entries.push({ t, text: lines[S.sync.idx] }); S.sync.idx++; renderSync();
  } else {
    entries.push({ t: t + 0.15, text: '' });
    player.pauseVideo();
    S.offset = 0;
    S.entries = entries.slice().sort((a, b) => a.t - b.t);
    saveSong();
    S.phase = 'ready'; show('readyCard'); renderReady();
  }
}
function syncGap() {
  if (!playerReady || !S.sync.entries.length) return;
  const last = S.sync.entries[S.sync.entries.length - 1];
  if (!last.text) return;
  S.sync.entries.push({ t: player.getCurrentTime(), text: '' });
}
function syncUndo() {
  const e = S.sync.entries.pop(); if (!e) return;
  if (e.text) S.sync.idx--;
  renderSync();
  if (playerReady) player.seekTo(Math.max(0, e.t - 3), true);
}

/* ---------- game ---------- */
function tokenize(text) {
  return text.split(/(\s+)/).filter(s => s !== '').map(raw => {
    if (/^\s+$/.test(raw)) return { raw, ws: true };
    const m = raw.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u);
    const core = m[2];
    return { raw, pre: m[1], core, post: m[3], word: /\p{L}/u.test(core) };
  });
}
function buildGame() {
  const E = S.entries, lines = [], seen = new Map();
  const dur = playerReady ? player.getDuration() : 0;
  for (let i = 0; i < E.length; i++) {
    if (!E[i].text) continue;
    let end = i + 1 < E.length ? E[i + 1].t : (dur || E[i].t + 6);
    end = Math.min(end, E[i].t + 10);   // never wait more than 10s (instrumental after a line)
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
    // prefer longer words a bit
    cand = shuffle(cand).sort((a, b) => (b.tk.core.length > 3) - (a.tk.core.length > 3));
    const count = diff === 'dificil' && words.length >= 5 ? 2 : 1;
    const pick = [];
    for (const c of cand) { if (pick.length >= count) break; if (!pick.some(p => Math.abs(p.i - c.i) < 3)) pick.push(c); }
    pick.sort((a, b) => a.i - b.i).forEach(p => {
      const b = { ti: p.i, answer: p.tk.core, solved: false, missed: false, attempts: 0, hint: 0, options: null, removed: new Set() };
      line.blanks.push(b); line.blankMap[p.i] = b;
    });
  });
  S.lines = lines;
  S.pool = [...seen.values()];
}
const activeBlank = line => line && line.blanks.find(b => !b.solved);
const hasUnsolved = line => !!activeBlank(line);

function startGame() {
  if (!playerReady) { alert('O vídeo ainda está carregando, tente de novo em instantes.'); return; }
  buildGame();
  Object.assign(S, { phase: 'play', cur: -1, hold: null, waiting: false, finished: false, score: 0, streak: 0 });
  show('gameCard');
  $('#resultsModal').classList.add('hidden');
  $('#gSpeed').value = String(settings.speed);
  $('#answerForm').classList.toggle('hidden', settings.mode !== 'type');
  $('#choices').classList.toggle('hidden', settings.mode !== 'choice');
  setStatus('🎧 Ouça e complete as lacunas!', 'info');
  player.seekTo(0, true);
  player.setPlaybackRate(settings.speed);
  player.playVideo();
  renderGame();
  if (settings.mode === 'type' && !isTouch) $('#answer').focus();
}

function lyricTime() { return player.getCurrentTime() + S.offset; }
function seekLyric(t) { player.seekTo(Math.max(0, t - S.offset), true); }

function tick() {
  if (S.phase !== 'play' || !playerReady) return;
  const st = player.getPlayerState();
  const L = lyricTime();
  const cur = S.lines[S.cur];
  // reached end of a line that still has a gap -> stop and wait for the answer
  if (cur && hasUnsolved(cur) && st === YT.PlayerState.PLAYING && L >= cur.end - 0.15 && L < cur.end + 1.5) {
    pauseForAnswer(); return;
  }
  if (S.waiting) {
    if (st === YT.PlayerState.PLAYING && cur && L < cur.end - 0.4) S.waiting = false; else return;
  }
  let idx = -1;
  for (let i = 0; i < S.lines.length; i++) { if (S.lines[i].t <= L) idx = i; else break; }
  if (S.hold != null) {          // pre-roll before a replayed line: keep showing it
    const h = S.lines[S.hold];
    if (L < h.t - 2 || L > h.end) S.hold = null; else if (L < h.t) idx = S.hold; else S.hold = null;
  }
  if (idx !== S.cur) { S.cur = idx; renderGame(); }
  const last = S.lines[S.lines.length - 1];
  if (!S.finished && last && idx === S.lines.length - 1 && !hasUnsolved(last) && L > last.end + 3) finish();
}
setInterval(tick, 50);

function pauseForAnswer() {
  player.pauseVideo();
  S.waiting = true;
  const b = activeBlank(S.lines[S.cur]);
  setStatus(b && b.attempts ? `Tente de novo (${b.attempts}/3)` : 'Qual é a palavra? 👇', 'info');
  if (settings.mode === 'type') $('#answer').focus();
}
function replayLine() {
  const line = S.lines[S.cur]; if (!line) { seekLyric(0); player.playVideo(); return; }
  S.waiting = false; S.hold = S.cur;
  seekLyric(line.t - 0.8);
  player.playVideo();
}
function resume() {
  S.waiting = false;
  player.playVideo();
}

function submitAnswer(value) {
  const line = S.lines[S.cur]; const b = activeBlank(line);
  if (!b) return;
  const v = judge(value, b.answer);
  if (v === 'empty') return;
  if (v === 'exact' || v === 'close') {
    b.solved = true;
    const pts = Math.max(10, [100, 60, 30][Math.min(b.attempts, 2)] - b.hint * 25);
    S.streak++; S.score += pts + Math.min(S.streak - 1, 10) * 10;
    setStatus(v === 'close' ? `Quase perfeito! Era "${b.answer}" (+${pts})` : `✔ Isso! +${pts}`, 'good');
    flash('flash-ok');
    $('#answer').value = '';
    if (!hasUnsolved(line)) { translateLine(line); if (S.waiting) resume(); }
  } else {
    b.attempts++; S.streak = 0;
    flash('flash-bad');
    if (settings.mode === 'choice') b.removed.add(norm(value));
    if (b.attempts >= 3) {
      b.solved = true; b.missed = true;
      setStatus(`A palavra era "${b.answer}". Ouça de novo 👂`, 'bad');
      $('#answer').value = '';
      if (!hasUnsolved(line)) translateLine(line);
      replayLine();
    } else if (S.waiting) {
      setStatus(`✘ "${value}" não é. Voltando a frase… (${b.attempts}/3)`, 'bad');
      $('#answer').select();
      setTimeout(() => { if (S.phase === 'play') replayLine(); }, 700);
    } else {
      setStatus(`✘ "${value}" não é. (${b.attempts}/3)`, 'bad');
      $('#answer').select();
    }
  }
  renderGame();
}
function giveHint() {
  const line = S.lines[S.cur]; const b = activeBlank(line); if (!b) return;
  if (settings.mode === 'choice') {
    const wrong = (b.options || []).filter(o => norm(o) !== norm(b.answer) && !b.removed.has(norm(o)));
    if (wrong.length > 1) { b.removed.add(norm(wrong[0])); b.hint++; }
  } else if (b.hint < b.answer.length - 1) b.hint++;
  renderGame();
}
function skipBlank() {
  const line = S.lines[S.cur]; if (!line) return;
  line.blanks.forEach(b => { if (!b.solved) { b.solved = true; b.missed = true; } });
  S.streak = 0;
  setStatus('Pulado.', '');
  translateLine(line);
  renderGame();
  if (S.waiting) resume();
}

function makeOptions(b) {
  const ans = norm(b.answer);
  const others = S.pool.filter(w => norm(w) !== ans);
  const close = shuffle(others.slice()).sort((x, y) => Math.abs(x.length - b.answer.length) - Math.abs(y.length - b.answer.length)).slice(0, 10);
  const opts = shuffle(close).slice(0, 3);
  opts.push(b.answer);
  return shuffle(opts);
}

function lineHTML(line, isCur) {
  if (!line) return '';
  const act = isCur ? activeBlank(line) : null;
  let h = line.tokens.map((tk, i) => {
    const b = line.blankMap[i];
    if (!b) return esc(tk.raw);
    let inner;
    if (b.solved) inner = `<span class="${b.missed ? 'miss' : 'ok'}">${esc(b.answer)}</span>`;
    else {
      const shown = b.answer.slice(0, b.hint);
      inner = `<span class="gap${b === act ? ' active' : ''}">${esc(shown)}${'_'.repeat(b.answer.length - shown.length)}</span>`;
    }
    return esc(tk.pre) + inner + esc(tk.post);
  }).join('');
  if (line.tr && !hasUnsolved(line)) h += `<div class="tr">${esc(line.tr)}</div>`;
  return h;
}
function renderGame() {
  if (S.phase !== 'play') return;
  const i = S.cur, L = S.lines;
  $('#lPrev').innerHTML = lineHTML(L[i - 1], false);
  $('#lCur').innerHTML = i < 0 ? '🎧 Prepare-se…' : lineHTML(L[i], true);
  $('#lNext').innerHTML = lineHTML(L[i + 1], false);
  $('#hudScore').textContent = S.score; $('#hudStreak').textContent = S.streak;
  $('#progress').style.width = (L.length ? Math.max(0, (i + 1) / L.length * 100) : 0) + '%';
  $('#offVal').textContent = (S.offset >= 0 ? '+' : '') + S.offset.toFixed(1) + 's';
  const b = activeBlank(L[i]);
  $('#btnHint').disabled = $('#btnSkip').disabled = !b;
  if (settings.mode === 'choice') {
    const box = $('#choices');
    if (!b) { box.innerHTML = ''; return; }
    if (!b.options) b.options = makeOptions(b);
    box.innerHTML = '';
    b.options.forEach((o, k) => {
      const btn = document.createElement('button');
      btn.textContent = `${k + 1}. ${o}`;
      if (b.removed.has(norm(o))) { btn.classList.add('wrong'); btn.disabled = true; }
      btn.onclick = () => submitAnswer(o);
      box.appendChild(btn);
    });
  }
}

async function translateLine(line) {
  if (!settings.translate || settings.lang === 'pt' || line.tr) return;
  const key = settings.lang + '|' + line.text;
  if (trCache[key]) { line.tr = trCache[key]; renderGame(); return; }
  try {
    const r = await fetch('https://api.mymemory.translated.net/get?' + new URLSearchParams({ q: line.text, langpair: settings.lang + '|pt-BR' }));
    const j = await r.json();
    const tx = j && j.responseData && j.responseData.translatedText;
    if (tx && !/MYMEMORY WARNING|INVALID/i.test(tx)) {
      const t = document.createElement('textarea'); t.innerHTML = tx; // decode entities
      line.tr = t.value; trCache[key] = line.tr; store.set('lg:tr', trCache); renderGame();
    }
  } catch { }
}

function finish() {
  S.finished = true;
  const all = S.lines.flatMap(l => l.blanks.map(b => ({ b, l })));
  const ok = all.filter(x => x.b.solved && !x.b.missed).length;
  const acc = all.length ? Math.round(ok / all.length * 100) : 0;
  const song = songs[S.videoId] || {};
  song.best = Math.max(song.best || 0, S.score); songs[S.videoId] = song; saveSongs(); renderSaved();
  $('#rScore').textContent = S.score; $('#rAcc').textContent = acc + '%'; $('#rBest').textContent = song.best;
  const missed = all.filter(x => x.b.missed || x.b.attempts > 0);
  $('#rMissedWrap').classList.toggle('hidden', !missed.length);
  $('#rMissed').innerHTML = missed.map(x => `<li><b>${esc(x.b.answer)}</b> — ${esc(x.l.text)}${x.l.tr ? `<br><span class="tr">${esc(x.l.tr)}</span>` : ''}</li>`).join('');
  $('#resultsModal').classList.remove('hidden');
}
function quitGame() {
  if (playerReady) player.pauseVideo();
  S.phase = 'ready'; show('readyCard'); renderReady();
}

/* ---------- wiring ---------- */
$('#loadBtn').onclick = () => {
  const id = parseVideoId($('#url').value);
  if (!id) { alert('Link do YouTube inválido.'); return; }
  loadVideo(id);
};
$('#url').addEventListener('keydown', e => { if (e.key === 'Enter') $('#loadBtn').click(); });
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('active', x === b));
  $('#tab-search').classList.toggle('hidden', b.dataset.tab !== 'search');
  $('#tab-paste').classList.toggle('hidden', b.dataset.tab !== 'paste');
});
$('#searchBtn').onclick = searchLyrics;
$('#pasteBtn').onclick = () => {
  const txt = $('#pasteBox').value;
  const lrc = parseLRC(txt);
  if (lrc) setEntries(lrc, true); else startSync(plainLines(txt));
};

$('#sMark').onclick = syncMark;
$('#sUndo').onclick = syncUndo;
$('#sGap').onclick = syncGap;
$('#sPlay').onclick = () => { if (!playerReady) return; player.getPlayerState() === YT.PlayerState.PLAYING ? player.pauseVideo() : player.playVideo(); };
$('#sSpeed').onchange = e => playerReady && player.setPlaybackRate(+e.target.value);
$('#sCancel').onclick = () => { if (playerReady) player.pauseVideo(); if (S.entries.length) { S.phase = 'ready'; show('readyCard'); } else { S.phase = 'lyrics'; show('lyricsCard'); } };

$('#optDiff').onchange = e => { settings.difficulty = e.target.value; saveSettings(); };
$('#optMode').onchange = e => { settings.mode = e.target.value; saveSettings(); };
$('#optSpeed').onchange = e => { settings.speed = +e.target.value; saveSettings(); };
$('#optLang').onchange = e => { settings.lang = e.target.value; saveSettings(); };
$('#optTr').onchange = e => { settings.translate = e.target.checked; saveSettings(); };
$('#playBtn').onclick = startGame;
$('#resyncBtn').onclick = () => startSync(S.entries.filter(e => e.text).map(e => e.text));
$('#editBtn').onclick = () => $('#editBox').classList.toggle('hidden');
$('#changeBtn').onclick = () => { S.phase = 'lyrics'; show('lyricsCard'); };
$('#lrcSave').onclick = () => { const e = parseLRC($('#lrcBox').value); if (!e) { alert('LRC inválido.'); return; } S.entries = e; saveSong(); renderReady(); alert('Salvo!'); };
$('#lrcCopy').onclick = () => { navigator.clipboard?.writeText($('#lrcBox').value); };

$('#answerForm').onsubmit = e => { e.preventDefault(); submitAnswer($('#answer').value); };
$('#btnReplay').onclick = () => { setStatus('🔁 Ouvindo de novo…', 'info'); replayLine(); };
$('#btnHint').onclick = giveHint;
$('#btnSkip').onclick = skipBlank;
$('#btnPause').onclick = () => {
  if (S.waiting) return replayLine();
  player.getPlayerState() === YT.PlayerState.PLAYING ? player.pauseVideo() : player.playVideo();
};
const nudge = d => { S.offset = Math.round((S.offset + d) * 10) / 10; if (songs[S.videoId]) { songs[S.videoId].offset = S.offset; saveSongs(); } renderGame(); };
$('#offMinus').onclick = () => nudge(-0.2);
$('#offPlus').onclick = () => nudge(0.2);
$('#gSpeed').onchange = e => { settings.speed = +e.target.value; saveSettings(); player.setPlaybackRate(settings.speed); };
$('#btnQuit').onclick = quitGame;
$('#rAgain').onclick = startGame;
$('#rClose').onclick = () => { $('#resultsModal').classList.add('hidden'); quitGame(); };

document.addEventListener('keydown', e => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (S.phase === 'sync' && !typing) {
    if (e.code === 'Space') { e.preventDefault(); syncMark(); }
    else if (e.key === 'Backspace') { e.preventDefault(); syncUndo(); }
  }
  if (S.phase === 'play') {
    if (settings.mode === 'choice' && /^[1-4]$/.test(e.key) && !typing) {
      const b = activeBlank(S.lines[S.cur]); const o = b && b.options && b.options[+e.key - 1];
      if (o && !b.removed.has(norm(o))) submitAnswer(o);
    }
    if (e.key === 'Escape') { e.preventDefault(); replayLine(); }
  }
});

/* ---------- init ---------- */
if (location.protocol === 'file:') $('#fileWarn').classList.remove('hidden');
(function init() {
  const q = new URLSearchParams(location.search).get('v');
  const id = parseVideoId(q || '') || store.get('lg:last', null) || parseVideoId(DEFAULT_URL);
  $('#url').value = 'https://www.youtube.com/watch?v=' + id;
  renderSaved();
  loadVideo(id);
})();
