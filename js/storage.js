import { DEFAULT_SETUP, CATALOG, findPart } from './config.js';

const KEY = 'apex-circuit-save-v2';

const fresh = () => ({
  credits: 18000,
  setup: { ...DEFAULT_SETUP },
  owned: {},
  best: {},
  ghosts: {},
  settings: { mode: 'race', weather: 'dry', difficulty: 'pro', laps: 2, rivals: 5 },
  races: 0,
  wins: 0,
  podiums: 0,
  distance: 0,
  customModel: { name: '', data: '' },
});

let data = fresh();

try {
  const raw = localStorage.getItem(KEY) || localStorage.getItem('apex-circuit-save-v1');
  if (raw) {
    const saved = JSON.parse(raw);
    data = {
      ...data,
      ...saved,
      setup: { ...DEFAULT_SETUP, ...(saved.setup || {}) },
      owned: { ...(saved.owned || {}) },
      best: { ...(saved.best || {}) },
      ghosts: { ...(saved.ghosts || {}) },
      settings: { ...data.settings, ...(saved.settings || {}) },
    };
  }
} catch { /* private mode or corrupted save: start fresh */ }

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

export const save = {
  get data() { return data; },
  get credits() { return data.credits; },
  get setup() { return data.setup; },
  get settings() { return data.settings; },
  get customModel() { return data.customModel || { name: '', data: '' }; },

  owns(category, id) {
    const partId = id == null ? data.setup[category] : id;
    const part = findPart(category, partId);
    if (part && part.price === 0) return true;
    return data.owned[category]?.includes(partId) === true;
  },

  buy(category, id, price) {
    if (this.owns(category, id)) { data.setup[category] = id; persist(); return true; }
    if (data.credits < price) return false;
    data.credits -= price;
    (data.owned[category] ||= []).push(id);
    data.setup[category] = id;
    persist();
    return true;
  },

  set(category, id) { data.setup[category] = id; persist(); },
  setNumber(value) {
    data.setup.number = String(value || '07').replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || '07';
    persist();
  },
  setCustomModel(name, dataUrl) {
    data.customModel = { name: String(name).slice(0, 48), data: dataUrl };
    data.setup.car = 'custom';
    persist();
    return true;
  },
  clearCustomModel() {
    data.customModel = { name: '', data: '' };
    if (data.setup.car === 'custom') data.setup.car = 'sedan';
    persist();
  },
  setSetting(key, value) { data.settings[key] = value; persist(); },
  addCredits(amount) { data.credits += Math.round(amount); persist(); },

  recordRace(trackId, bestLap, position, distance = 0) {
    data.races++;
    if (position === 1) data.wins++;
    if (position <= 3) data.podiums++;
    data.distance += distance;
    const prev = data.best[trackId];
    if (bestLap && (!prev || bestLap < prev)) data.best[trackId] = bestLap;
    persist();
  },

  bestLap(trackId) { return data.best[trackId] || null; },
  getGhost(trackId) { return data.ghosts[trackId] || null; },
  saveGhost(trackId, ghost) {
    const prev = data.ghosts[trackId];
    if (!prev || !prev.time || ghost.time < prev.time) {
      data.ghosts[trackId] = ghost;
      persist();
      return true;
    }
    return false;
  },

  shuffleLivery() {
    const pick = cat => {
      const owned = [findPart(cat, data.setup[cat]), ...CATALOG[cat].filter(p => this.owns(cat, p.id))];
      return owned[Math.floor(Math.random() * owned.length)].id;
    };
    for (const cat of ['paint', 'accent', 'underglow', 'wheels', 'spoiler', 'bodyKit']) data.setup[cat] = pick(cat);
    data.setup.number = String(Math.floor(Math.random() * 99) + 1).padStart(2, '0');
    persist();
  },

  reset() { data = fresh(); persist(); },
};
