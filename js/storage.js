import { DEFAULT_SETUP } from './config.js';

const KEY = 'apex-circuit-save-v1';

const fresh = () => ({
  credits: 18000,
  setup: { ...DEFAULT_SETUP },
  owned: {},
  best: {},
  races: 0,
  wins: 0,
});

let data = fresh();

try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const saved = JSON.parse(raw);
    data = {
      ...data,
      ...saved,
      setup: { ...DEFAULT_SETUP, ...(saved.setup || {}) },
      owned: { ...(saved.owned || {}) },
      best: { ...(saved.best || {}) },
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
  owns(category, id) {
    const part = id == null ? data.setup[category] : id;
    return data.owned[category]?.includes(part) === true;
  },
  buy(category, id, price) {
    if (this.owns(category, id)) return true;
    if (data.credits < price) return false;
    data.credits -= price;
    (data.owned[category] ||= []).push(id);
    data.setup[category] = id;
    persist();
    return true;
  },
  set(category, id) {
    data.setup[category] = id;
    persist();
  },
  setNumber(value) {
    data.setup.number = String(value || '07').slice(0, 3).toUpperCase();
    persist();
  },
  addCredits(amount) { data.credits += amount; persist(); },
  recordRace(trackId, bestLap, position) {
    data.races++;
    if (position === 1) data.wins++;
    const prev = data.best[trackId];
    if (bestLap && (!prev || bestLap < prev)) data.best[trackId] = bestLap;
    persist();
  },
  bestLap(trackId) { return data.best[trackId] || null; },
  reset() { data = fresh(); persist(); },
};
