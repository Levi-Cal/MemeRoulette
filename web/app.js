'use strict';

const $ = (id) => document.getElementById(id);
const SAVED_KEY = 'mr_saved';
const REGION_KEY = 'mr_region';

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TAGLINES = [
  'memes from around the world',
  'certified internet culture',
  'scientifically random',
  'one more. just one more.',
  'your daily brain rot, imported',
  'no thoughts, just memes',
];

const state = {
  region: load(REGION_KEY, 'all'),
  history: [],   // memes shown, for "previous"
  index: -1,
  saved: load(SAVED_KEY, []),
  busy: false,
};

// ---------------------------------------------------------------- UI bits

function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2400);
}

function formatUps(n) {
  if (!n && n !== 0) return '';
  return '⬆ ' + (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : n);
}

function renderRegions() {
  const all = [{ id: 'all', flag: '🎲', name: 'Everywhere' }, ...window.REGIONS];
  $('regions').innerHTML = all.map((r) =>
    `<button class="chip ${r.id === state.region ? 'active' : ''}" data-region="${r.id}">${r.flag} ${esc(r.name)}</button>`).join('');
}

function showStatus(text, isError) {
  $('status').hidden = false;
  $('status').classList.toggle('error', !!isError);
  $('statusText').innerHTML = text;
  $('card').classList.add('hidden');
}

function hideStatus() {
  $('status').hidden = true;
  $('card').classList.remove('hidden');
}

function current() { return state.history[state.index]; }

function isSaved(m) { return !!m && state.saved.some((s) => s.url === m.url); }

function updateButtons() {
  $('prev').disabled = state.index <= 0;
  const m = current();
  const saved = isSaved(m);
  $('save').classList.toggle('done', saved);
  $('save').querySelector('span').textContent = saved ? 'Saved' : 'Save';
  $('save').disabled = !m;
  $('share').disabled = !m;
  $('savedCount').textContent = state.saved.length;
}

function preload(m) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = m.url;
  });
}

async function display(m, direction) {
  const card = $('card');
  card.classList.add(direction === 'back' ? 'out-right' : 'out-left');
  await new Promise((r) => setTimeout(r, 160));
  $('meme').src = m.url;
  $('meme').alt = m.title;
  $('title').textContent = m.title;
  $('where').textContent = `${m.flag} r/${m.sub}`;
  $('ups').textContent = formatUps(m.ups);
  hideStatus();
  card.classList.remove('out-left', 'out-right');
  updateButtons();
}

// ---------------------------------------------------------------- navigation

async function next() {
  if (state.busy) return;
  // Going forward through history after pressing "previous"
  if (state.index < state.history.length - 1) {
    state.index++;
    return display(current(), 'forward');
  }
  state.busy = true;
  if (!current()) showStatus('Spinning the wheel…');
  try {
    for (let attempt = 0; attempt < 6; attempt++) {
      const m = await window.Memes.next(state.region);
      if (!m) break;
      if (await preload(m)) { // skip images that won't load
        state.history.push(m);
        if (state.history.length > 100) state.history.shift();
        state.index = state.history.length - 1;
        await display(m, 'forward');
        return;
      }
    }
    showStatus('Couldn\'t find any memes right now.<br>Check your internet, or try another region.'
      + '<br><button class="ghost retry" id="retry">Try again</button>', true);
  } catch (e) {
    showStatus(`Something broke: ${esc(e.message)}<br><button class="ghost retry" id="retry">Try again</button>`, true);
  } finally {
    state.busy = false;
    // warm up the next couple of images
    window.Memes.peek(2).forEach(preload);
  }
}

function prev() {
  if (state.index <= 0) return;
  state.index--;
  display(current(), 'back');
}

function setRegion(id) {
  if (id === state.region) return;
  state.region = id;
  store(REGION_KEY, id);
  renderRegions();
  window.Memes.reset();
  state.history = state.history.slice(0, state.index + 1);
  showStatus('Spinning the wheel…');
  next();
}

// ---------------------------------------------------------------- saving

function fileName(m) {
  const ext = (m.url.match(/\.(jpe?g|png|gif|webp)(\?|$)/i) || [, 'jpg'])[1].toLowerCase();
  const slug = m.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'meme';
  return `${slug}-${Date.now().toString(36)}.${ext}`;
}

async function save() {
  const m = current();
  if (!m) return;
  const burst = $('burst');
  burst.classList.remove('go');
  void burst.offsetWidth; // restart animation
  burst.classList.add('go');
  if (isSaved(m)) { toast('Already in your stash'); return; }
  try {
    const where = await window.native.save(m.url, fileName(m));
    state.saved.unshift({ url: m.url, title: m.title, sub: m.sub, flag: m.flag, link: m.link, time: Date.now() });
    store(SAVED_KEY, state.saved.slice(0, 500));
    updateButtons();
    toast(`Saved to ${where}`);
  } catch (e) {
    toast(`Couldn't save: ${e.message}`);
  }
}

// ---------------------------------------------------------------- saved tab

function renderSaved() {
  const where = { android: 'Saved to your Gallery → Pictures/Meme Roulette', windows: 'Saved in Pictures\\Meme Roulette', browser: 'Saved to your Downloads' };
  $('savedWhere').textContent = `${state.saved.length} memes · ${where[window.native.platform]}`;
  $('openFolder').hidden = window.native.platform !== 'windows';
  $('grid').innerHTML = state.saved.length
    ? state.saved.map((s, i) => `<div class="thumb" data-i="${i}"><img loading="lazy" src="${esc(s.url)}" alt="">
        <div class="cap">${s.flag || ''} ${esc(s.title)}</div></div>`).join('')
    : '<div class="empty"><big>🫙</big>Nothing saved yet.<br>Tap a meme you like to keep it.</div>';
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  $('roll').hidden = tab !== 'roll';
  $('saved').hidden = tab !== 'saved';
  $('regions').hidden = tab !== 'roll';
  if (tab === 'saved') renderSaved();
}

// ---------------------------------------------------------------- events

$('regions').addEventListener('click', (e) => {
  const b = e.target.closest('[data-region]');
  if (b) setRegion(b.dataset.region);
});
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));
$('next').onclick = next;
$('prev').onclick = prev;
$('save').onclick = save;
$('share').onclick = () => { const m = current(); if (m) window.native.share(m.link || m.url, m.title); };
$('source').onclick = () => { const m = current(); if (m) window.native.openLink(m.link || m.url); };
$('openFolder').onclick = () => window.native.openFolder();
$('status').addEventListener('click', (e) => { if (e.target.id === 'retry') { showStatus('Spinning the wheel…'); next(); } });
$('grid').addEventListener('click', (e) => {
  const t = e.target.closest('[data-i]');
  if (!t) return;
  const s = state.saved[Number(t.dataset.i)];
  const r = window.Memes.regionOf(s.sub);
  state.history = state.history.slice(0, state.index + 1);
  state.history.push({ ...s, flag: s.flag || r.flag, region: r.name });
  state.index = state.history.length - 1;
  switchTab('roll');
  display(current(), 'forward');
});

// Click/tap the meme to save; swipe left for next, right for previous
let touch = null;
const wrap = $('imgwrap');
wrap.addEventListener('pointerdown', (e) => { touch = { x: e.clientX, y: e.clientY, t: Date.now() }; });
wrap.addEventListener('pointerup', (e) => {
  if (!touch) return;
  const dx = e.clientX - touch.x;
  const dy = e.clientY - touch.y;
  const quick = Date.now() - touch.t < 600;
  touch = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) && quick) {
    dx < 0 ? next() : prev();
  } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
    save();
  }
});

document.addEventListener('keydown', (e) => {
  if ($('roll').hidden) return;
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
  else if (e.key === 'ArrowLeft') prev();
  else if (e.key.toLowerCase() === 's') save();
});

// ---------------------------------------------------------------- start

$('tag').textContent = TAGLINES[Math.floor(Math.random() * TAGLINES.length)];
renderRegions();
updateButtons();
next();
