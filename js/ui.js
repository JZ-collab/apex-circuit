import { TABS, CATALOG, TRACKS, findPart, computeSpecs } from './config.js';
import { save } from './storage.js';
import { audio } from './audio.js';

const $ = id => document.getElementById(id);
const fmtTime = t => {
  if (!t && t !== 0) return '—';
  const m = Math.floor(t / 60);
  const s = (t % 60).toFixed(2).padStart(5, '0');
  return `${m}:${s}`;
};
const fmtKmh = v => Math.round(Math.abs(v) * 3.6);

export const ui = {
  selectedTrack: 'sunset',
  laps: 2,
  rivals: 5,
  garageTab: 'car',
  onStart: null,
  onConfigChange: null,
  onResume: null,
  onRestart: null,
  onQuit: null,
  onCamera: null,
  onRespawn: null,
  onPause: null,
  toastTimer: null,

  init() {
    // Menu buttons.
    $('btn-quick').onclick = () => { audio.ensure(); this.onStart?.(this.selectedTrack, this.laps, this.rivals); };
    $('btn-race').onclick = () => { audio.ensure(); this.onStart?.(this.selectedTrack, this.laps, this.rivals); };
    $('btn-garage').onclick = () => { audio.ensure(); audio.beep(520, .08); this.openGarage(); };
    $('btn-help').onclick = () => this.show('help');
    $('btn-help-close').onclick = () => this.show(this.helpReturn || 'menu');
    $('btn-garage-back').onclick = () => this.show('menu');

    // Segmented controls.
    $('lap-select').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      this.laps = +b.dataset.laps;
      [...$('lap-select').children].forEach(x => x.classList.toggle('on', x === b));
    };
    $('rival-select').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      this.rivals = +b.dataset.rivals;
      [...$('rival-select').children].forEach(x => x.classList.toggle('on', x === b));
    };

    // Race controls.
    $('btn-resume').onclick = () => this.onResume?.();
    $('btn-restart').onclick = () => this.onRestart?.();
    $('btn-quit').onclick = () => this.onQuit?.();
    $('btn-again').onclick = () => this.onRestart?.();
    $('btn-results-garage').onclick = () => this.openGarage();
    $('btn-results-menu').onclick = () => this.onQuit?.();
    $('btn-camera').onclick = () => this.onCamera?.();
    $('btn-respawn').onclick = () => this.onRespawn?.();
    $('btn-pause').onclick = () => this.onPause?.();
    for (const btn of document.querySelectorAll('[id^="btn-mute"]')) {
      btn.onclick = () => this.setMuted(audio.toggle());
    }

    // Touch controls.
    document.querySelectorAll('.touch-controls button').forEach(btn => {
      const key = btn.dataset.key;
      const down = e => { e.preventDefault(); this.touch[key] = true; };
      const up = e => { e.preventDefault(); this.touch[key] = false; };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
    });

    this.renderTracks();
    this.renderSpecs();
    this.setMuted(audio.muted);
  },

  touch: {},

  show(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $('screen-' + name)?.classList.add('active');
    if (name === 'menu') this.renderMenu();
  },

  showHelp() { this.helpReturn = document.querySelector('.screen.active')?.id.replace('screen-', '') || 'menu'; this.show('help'); },

  setMuted(muted) {
    document.querySelectorAll('[id^="btn-mute"]').forEach(b => b.classList.toggle('muted', muted));
  },

  toast(message, error = false) {
    const el = $('toast');
    el.textContent = message;
    el.classList.toggle('error', error);
    el.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('show'), 1900);
  },

  renderMenu() {
    $('menu-credits').textContent = save.credits.toLocaleString();
    const car = findPart('car', save.setup.car);
    $('menu-stats').innerHTML = `
      <div><small>YOUR CAR</small><b>${car.name}</b></div>
      <div><small>RACES</small><b>${save.data.races}</b></div>
      <div><small>WINS</small><b>${save.data.wins}</b></div>
      <div><small>POWER</small><b>${computeSpecs(save.setup).hp} HP</b></div>`;
  },

  renderTracks() {
    $('track-list').innerHTML = TRACKS.map(t => `
      <div class="track-item ${t.id === this.selectedTrack ? 'on' : ''}" data-track="${t.id}">
        <b>${t.name}</b><small>${t.sub} · ${t.laps} LAPS${save.bestLap(t.id) ? ' · BEST ' + fmtTime(save.bestLap(t.id)) : ''}</small>
      </div>`).join('');
    $('track-list').onclick = e => {
      const item = e.target.closest('.track-item'); if (!item) return;
      this.selectedTrack = item.dataset.track;
      this.renderTracks();
      audio.beep(480, .06, .15);
    };
  },

  openGarage() {
    this.show('garage');
    this.renderGarage();
  },

  renderGarage() {
    $('garage-credits').textContent = save.credits.toLocaleString();
    $('garage-tabs').innerHTML = TABS.map(t => `<button class="garage-tab ${t.id === this.garageTab ? 'on' : ''}" data-tab="${t.id}">${t.label}</button>`).join('');
    $('garage-tabs').onclick = e => {
      const b = e.target.closest('.garage-tab'); if (!b) return;
      this.garageTab = b.dataset.tab;
      audio.beep(500, .05, .12);
      this.renderGarage();
    };

    const cat = this.garageTab;
    const parts = CATALOG[cat];
    $('garage-panel-title').textContent = TABS.find(t => t.id === cat).label.split('/ ')[1] || cat.toUpperCase();

    if (cat === 'number') {
      $('garage-options-list').innerHTML = `
        <div class="opt on"><div class="opt-info"><b>RACE NUMBER</b><small>Shown on the hood</small></div>
        <input class="text-input" id="number-input" maxlength="3" value="${save.setup.number}"></div>`;
      $('number-input').oninput = e => {
        save.setNumber(e.target.value.replace(/[^a-z0-9]/gi, ''));
        this.onConfigChange?.();
      };
    } else {
      $('garage-options-list').innerHTML = parts.map(p => {
        // Color swatches for paint / accent / underglow use their color directly.
        const owned = save.owns(cat, p.id);
        const selected = save.setup[cat] === p.id;
        const swatch = p.color ? `<span class="opt-swatch" style="background:${p.color}"></span>` : '';
        const spec = p.hp ? `${p.hp} HP / ${p.torque} Nm` : (p.sub || '');
        return `<div class="opt ${selected ? 'on' : ''} ${owned ? 'owned' : 'locked'}" data-id="${p.id}" data-price="${p.price}">
          ${swatch}
          <div class="opt-info"><b>${p.name}</b><small>${spec}</small></div>
          <div class="opt-price">${owned ? (selected ? 'FITTED' : 'OWNED') : p.price ? '◈ ' + p.price.toLocaleString() : 'FREE'}</div>
        </div>`;
      }).join('');
      $('garage-options-list').onclick = e => {
        const opt = e.target.closest('.opt'); if (!opt) return;
        const id = opt.dataset.id;
        const price = +opt.dataset.price;
        if (!save.owns(cat, id)) {
          if (!save.buy(cat, id, price)) { this.toast('NOT ENOUGH CREDITS', true); audio.beep(180, .18, .2, 'sawtooth'); return; }
          this.toast(`${findPart(cat, id).name} PURCHASED + FITTED`);
          audio.beep(760, .1, .2);
        } else {
          save.set(cat, id);
          audio.beep(620, .07, .15);
        }
        this.renderGarage();
        this.renderSpecs();
        this.onConfigChange?.();
      };
    }
    this.renderSpecs();
  },

  renderSpecs() {
    const el = $('spec-list'); if (!el) return;
    const s = computeSpecs(save.setup);
    const rows = [
      ['POWER', `${s.hp} HP`, Math.min(s.hp / 650, 1) * 100],
      ['WEIGHT', `${Math.round(s.mass)} KG`, (1 - Math.min(s.mass / 2400, 1)) * 100],
      ['TOP SPEED', `${Math.round(s.topSpeed * 3.6)} KM/H`, Math.min(s.topSpeed / 72, 1) * 100],
      ['0-100', `${s.quarter.toFixed(1)} S`, (1 - Math.min(s.quarter / 16, 1)) * 100],
      ['GRIP', s.grip.toFixed(2), Math.min(s.grip / 2, 1) * 100],
      ['HANDLING', s.handling.toFixed(2), Math.min(s.handling / 2, 1) * 100],
    ];
    el.innerHTML = rows.map(([label, value, pct]) => `<div class="spec-row"><span>${label}</span><span class="spec-bar"><i style="width:${pct}%"></i></span><b>${value}</b></div>`).join('');
  },

  hud(data) {
    $('hud-lap').textContent = `${Math.min(data.lap, data.laps)} / ${data.laps}`;
    $('hud-time').textContent = fmtTime(data.time);
    $('hud-best').textContent = data.best ? 'BEST ' + fmtTime(data.best) : 'BEST —';
    $('hud-pos').textContent = `${data.pos} / ${data.total}`;
    $('hud-speed').textContent = fmtKmh(data.speed);
    $('hud-gear').textContent = data.gear < 0 ? 'R' : data.gear || 'N';
    $('rpm-fill').style.width = `${Math.min(data.rpm / data.redline, 1) * 100}%`;
  },

  countdown(text, mode = '') {
    const el = $('countdown');
    el.textContent = text;
    el.classList.toggle('show', !!text);
    el.classList.toggle('go', mode === 'go');
  },

  minimap(track, vehicles, player) {
    const canvas = $('minimap');
    if (!canvas || !track) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const s of track.samples) {
      minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x);
      minZ = Math.min(minZ, s.z); maxZ = Math.max(maxZ, s.z);
    }
    const pad = 18;
    const scale = Math.min((W - pad * 2) / (maxX - minX), (H - pad * 2) / (maxZ - minZ));
    const ox = (W - (maxX - minX) * scale) / 2 - minX * scale;
    const oy = (H - (maxZ - minZ) * scale) / 2 - minZ * scale;
    const px = x => x * scale + ox, py = z => z * scale + oy;

    ctx.beginPath();
    track.samples.forEach((s, i) => i ? ctx.lineTo(px(s.x), py(s.z)) : ctx.moveTo(px(s.x), py(s.z)));
    ctx.closePath();
    ctx.strokeStyle = 'rgba(150,190,220,.35)';
    ctx.lineWidth = 7; ctx.stroke();
    ctx.strokeStyle = 'rgba(72,230,255,.9)';
    ctx.lineWidth = 2; ctx.stroke();

    const start = track.sample(0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px(start.x) - 3, py(start.z) - 3, 6, 6);

    for (const v of vehicles) {
      ctx.beginPath();
      ctx.arc(px(v.x), py(v.z), v === player ? 5 : 3.3, 0, Math.PI * 2);
      ctx.fillStyle = v === player ? '#b8ff5c' : v.color;
      ctx.fill();
      if (v === player) {
        ctx.strokeStyle = '#05070d'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }
  },

  results(rows, reward, finished) {
    $('results-eyebrow').textContent = finished ? '// RACE COMPLETE' : '// RACE ENDED';
    $('results-title').textContent = finished ? 'FINISH LINE.' : 'RACE OVER.';
    $('results-body').innerHTML = rows.map((r, i) => `<tr class="${r.player ? 'you' : ''}"><td>${i + 1}</td><td>${r.name}${r.player ? ' (YOU)' : ''}</td><td>${r.car}</td><td>${fmtTime(r.best)}</td></tr>`).join('');
    $('results-reward').textContent = '+' + reward.toLocaleString();
    this.show('results');
  },
};

window.__ui = ui;
