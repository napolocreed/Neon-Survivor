// Persistent profile: shards, Nanite Matrix ranks, pilots, records,
// achievements, lifetime counters, settings.

import { PILOTS } from '../game/data';

export interface Records {
  bestTime: number;
  bestKills: number;
  bestLevel: number;
  bestScore: number;
  bestCombo: number;
  victories: number;
  runs: number;
  totalKills: number;
  totalFrozen: number;
  wormKills: number;
  bossKills: [number, number, number];
  cursesTaken: number;
  endlessTime: number;
  bestChain: number;
  surgesCleared: number;
  playtime: number;
  totalReactions: number;
  pilotBest?: Record<string, number>;
}

export interface DailyResult {
  date: string; // YYYY-MM-DD (UTC)
  score: number;
  time: number;
  kills: number;
  rank: string;
  pilot: string;
}

export interface Settings {
  sfx: boolean;
  music: boolean;
  haptics: boolean;
  shake: boolean;
}

export interface Profile {
  shards: number;
  meta: Record<string, number>;
  pilots: string[];
  selectedPilot: string;
  records: Records;
  settings: Settings;
  achievements: Record<string, boolean>;
  evolutionsSeen: string[];
  reactionsSeen: string[];
  weaponsSeen: number[];
  enemiesSeen: number[];
  daily: DailyResult[];
  endlessUnlocked: boolean;
}

const KEY = 'neon-survivor-v2';

function defaultProfile(): Profile {
  return {
    shards: 0,
    meta: {},
    pilots: ['vector'],
    selectedPilot: 'vector',
    records: {
      bestTime: 0, bestKills: 0, bestLevel: 0, bestScore: 0, bestCombo: 0,
      victories: 0, runs: 0, totalKills: 0, totalFrozen: 0, wormKills: 0,
      bossKills: [0, 0, 0], cursesTaken: 0, endlessTime: 0,
      bestChain: 0, surgesCleared: 0, playtime: 0, totalReactions: 0,
    },
    settings: { sfx: true, music: true, haptics: true, shake: true },
    achievements: {},
    evolutionsSeen: [],
    reactionsSeen: [],
    weaponsSeen: [],
    enemiesSeen: [],
    daily: [],
    endlessUnlocked: false,
  };
}

export const profile: Profile = load();

function load(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultProfile();
    const p = { ...defaultProfile(), ...(JSON.parse(raw) as Partial<Profile>) };
    p.records = { ...defaultProfile().records, ...p.records };
    if (!Array.isArray(p.records.bossKills) || p.records.bossKills.length !== 3) p.records.bossKills = [0, 0, 0];
    p.settings = { ...defaultProfile().settings, ...p.settings };
    p.achievements = p.achievements ?? {};
    p.evolutionsSeen = p.evolutionsSeen ?? [];
    p.reactionsSeen = p.reactionsSeen ?? [];
    p.weaponsSeen = p.weaponsSeen ?? [];
    p.enemiesSeen = p.enemiesSeen ?? [];
    p.daily = p.daily ?? [];
    if (!p.pilots.includes('vector')) p.pilots.push('vector');
    if (!p.pilots.includes(p.selectedPilot)) p.selectedPilot = 'vector';
    return p;
  } catch {
    return defaultProfile();
  }
}

export function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // storage full / private mode — play on without persistence
  }
}

export function resetProfile(): void {
  Object.assign(profile, defaultProfile());
  save();
}

export function metaRank(id: string): number {
  return profile.meta[id] ?? 0;
}

export function metaBonuses(): {
  hp: number; dmg: number; fireRate: number; speed: number;
  xp: number; shards: number; rerolls: number; banishes: number;
  revive: boolean; startLevel2: boolean;
} {
  const fortune = metaRank('fortune') > 0;
  return {
    hp: 12 * metaRank('vitality'),
    dmg: 0.05 * metaRank('firepower'),
    fireRate: 0.04 * metaRank('overclock'),
    speed: 0.04 * metaRank('thrusters'),
    xp: 0.06 * metaRank('wisdom'),
    shards: 0.1 * metaRank('greed'),
    rerolls: fortune ? 1 : 0,
    banishes: fortune ? 1 : 0,
    revive: metaRank('guardian') > 0,
    startLevel2: metaRank('warcore') > 0,
  };
}

export function currentPilot() {
  return PILOTS.find(p => p.id === profile.selectedPilot) ?? PILOTS[0];
}


// ------------------------------------------------------------ daily challenge

/** UTC date key — everyone on Earth gets the same run on the same day. */
export function dailyKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

/** Stable 32-bit seed derived from the date key. */
export function dailySeed(key = dailyKey()): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function todaysDaily(): DailyResult | undefined {
  const k = dailyKey();
  return profile.daily.find(d => d.date === k);
}

export function recordDaily(r: DailyResult): void {
  const existing = profile.daily.findIndex(d => d.date === r.date);
  if (existing >= 0) profile.daily[existing] = r;
  else profile.daily.unshift(r);
  profile.daily = profile.daily.slice(0, 30);
  save();
}

export function discoverWeapon(id: number): void {
  if (!profile.weaponsSeen.includes(id)) {
    profile.weaponsSeen.push(id);
    save();
  }
}

export function discoverEnemy(kind: number): void {
  if (!profile.enemiesSeen.includes(kind)) {
    profile.enemiesSeen.push(kind);
    save();
  }
}
