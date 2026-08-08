// Persistent profile: shards, armory ranks, pilots, records, settings.

import { META_UPGRADES, PILOTS } from '../game/data';

export interface Records {
  bestTime: number;
  bestKills: number;
  bestLevel: number;
  bestScore: number;
  victories: number;
  runs: number;
  totalKills: number;
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
  pilots: string[]; // unlocked ids
  selectedPilot: string;
  records: Records;
  settings: Settings;
  endlessUnlocked: boolean;
}

const KEY = 'neon-survivor-v2';

function defaultProfile(): Profile {
  return {
    shards: 0,
    meta: {},
    pilots: ['vector'],
    selectedPilot: 'vector',
    records: { bestTime: 0, bestKills: 0, bestLevel: 0, bestScore: 0, victories: 0, runs: 0, totalKills: 0 },
    settings: { sfx: true, music: true, haptics: true, shake: true },
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
    p.settings = { ...defaultProfile().settings, ...p.settings };
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
  const fresh = defaultProfile();
  Object.assign(profile, fresh);
  save();
}

export function metaRank(id: string): number {
  return profile.meta[id] ?? 0;
}

export function metaBonuses(): {
  hp: number; dmg: number; fireRate: number; speed: number;
  magnet: number; xp: number; shards: number; rerolls: number; revive: boolean;
} {
  return {
    hp: 12 * metaRank('vitality'),
    dmg: 0.05 * metaRank('firepower'),
    fireRate: 0.04 * metaRank('overclock'),
    speed: 0.04 * metaRank('thrusters'),
    magnet: 0.15 * metaRank('magnet'),
    xp: 0.06 * metaRank('wisdom'),
    shards: 0.1 * metaRank('greed'),
    rerolls: metaRank('adrenaline'),
    revive: metaRank('guardian') > 0,
  };
}

export function currentPilot() {
  return PILOTS.find(p => p.id === profile.selectedPilot) ?? PILOTS[0];
}

export function armoryTotalSpent(): number {
  let total = 0;
  for (const def of META_UPGRADES) {
    const rank = metaRank(def.id);
    for (let r = 0; r < rank; r++) {
      total += Math.round((def.baseCost * Math.pow(r + 1, 1.7)) / 5) * 5;
    }
  }
  return total;
}
