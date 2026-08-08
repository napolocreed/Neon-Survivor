// DOM UI: title, Nanite Matrix, pilots, achievements, settings, HUD,
// level-up (reroll + banish), chest, Cursed Tech deals, pause, endings.

import { Game, RunStats, ChestResult } from '../game/game';
import { CardOffer, WeaponId, CurseDef } from '../game/types';
import {
  WEAPONS, PASSIVES, PILOTS, MATRIX, MATRIX_BRANCHES, matrixCost,
  ACHIEVEMENTS, CURSES, RARITY_COLORS, RARITY_NAMES,
} from '../game/data';
import { profile, save, resetProfile, metaRank } from '../meta/save';
import { audio } from '../audio/audio';
import { fmtTime } from '../core/math';

export interface UIHandlers {
  startRun(): void;
  restartRun(): void;
  quitToTitle(): void;
}

export class UI {
  private ui = document.getElementById('ui')!;
  private hud = document.getElementById('hud')!;
  private handlers: UIHandlers;

  private hudBuilt = false;
  private elTimer!: HTMLElement;
  private elKills!: HTMLElement;
  private elShards!: HTMLElement;
  private elXp!: HTMLElement;
  private elLevel!: HTMLElement;
  private elHp!: HTMLElement;
  private elHpLabel!: HTMLElement;
  private elDashes!: HTMLElement;
  private elCombo!: HTMLElement;
  private elBoss!: HTMLElement;
  private elBossName!: HTMLElement;
  private elBossFill!: HTMLElement;
  private elAbility!: HTMLElement;
  private elAbilityFill!: HTMLElement;
  private lastHud = { timer: '', kills: -1, shards: -1, xp: -1, level: -1, hp: -1, dashes: -1, combo: -1, ability: -1 };

  onPause: (() => void) | null = null;
  onAbility: (() => void) | null = null;

  constructor(handlers: UIHandlers) {
    this.handlers = handlers;
  }

  // ---------------------------------------------------------------- helpers

  private show(html: string): HTMLElement {
    this.ui.innerHTML = html;
    return this.ui.firstElementChild as HTMLElement;
  }

  hideScreens(): void {
    this.ui.innerHTML = '';
  }

  private click(root: HTMLElement, sel: string, fn: (el: HTMLElement) => void): void {
    root.querySelectorAll<HTMLElement>(sel).forEach(el => {
      el.addEventListener('click', ev => {
        ev.stopPropagation();
        audio.unlock();
        fn(el);
      });
    });
  }

  toast(text: string, cls: 'warn' | 'evo' | 'od' | 'sector' | 'ach'): void {
    const el = document.createElement('div');
    el.className = `toast ${cls}`;
    el.textContent = text;
    this.hud.appendChild(el);
    setTimeout(() => el.remove(), 2700);
  }

  sectorToast(name: string, sub: string): void {
    const el = document.createElement('div');
    el.className = 'toast sector';
    el.innerHTML = `${name}<br/><span>${sub}</span>`;
    this.hud.appendChild(el);
    setTimeout(() => el.remove(), 2700);
  }

  achievementToast(name: string, reward: number): void {
    const el = document.createElement('div');
    el.className = 'ach-pop';
    el.innerHTML = `<b>🏆 ${name}</b><span>+◆ ${reward}</span>`;
    this.hud.appendChild(el);
    setTimeout(() => el.remove(), 3400);
  }

  // ---------------------------------------------------------------- title

  showTitle(): void {
    const r = profile.records;
    const best = r.bestTime > 0
      ? `BEST ${fmtTime(r.bestTime)} · LVL ${r.bestLevel} · ${r.victories > 0 ? `${r.victories} WIN${r.victories > 1 ? 'S' : ''}` : `${r.bestKills} KILLS`}`
      : 'DRAG TO MOVE · TAP TO DASH';
    const achDone = Object.keys(profile.achievements).length;
    const root = this.show(`
      <div class="screen">
        <div class="title-logo">
          <div class="title-neon">NEON</div>
          <div class="title-survivor">SURVIVOR</div>
          <div class="title-tag">${best}</div>
        </div>
        <div class="menu-stack">
          <div style="text-align:center;margin-bottom:14px">
            <span class="shards-chip">◆ ${profile.shards}</span>
          </div>
          <button class="btn primary" data-a="play">DEPLOY</button>
          <button class="btn" data-a="pilots">PILOTS</button>
          <button class="btn" data-a="matrix">NANITE MATRIX</button>
          <button class="btn" data-a="ach">ACHIEVEMENTS <span class="btn-badge">${achDone}/${ACHIEVEMENTS.length}</span></button>
          <button class="btn" data-a="settings">SETTINGS</button>
        </div>
        <div class="hint">Survive 10 minutes. Kill the boss. Become the storm.<br/>Graze bullets to charge OVERDRIVE.</div>
      </div>
    `);
    this.click(root, '[data-a="play"]', () => this.handlers.startRun());
    this.click(root, '[data-a="pilots"]', () => { audio.ui(); this.showPilots(); });
    this.click(root, '[data-a="matrix"]', () => { audio.ui(); this.showMatrix(); });
    this.click(root, '[data-a="ach"]', () => { audio.ui(); this.showAchievements(); });
    this.click(root, '[data-a="settings"]', () => { audio.ui(); this.showSettings(); });
  }

  // ---------------------------------------------------------------- nanite matrix

  showMatrix(): void {
    const cols = [0, 1, 2].map(branch => {
      const nodes = MATRIX.filter(n => n.branch === branch).sort((a, b) => a.tier - b.tier);
      const items = nodes.map(def => {
        const rank = metaRank(def.id);
        const maxed = rank >= def.maxRank;
        const prev = nodes.find(n => n.tier === def.tier - 1);
        const locked = !!prev && metaRank(prev.id) === 0;
        const cost = maxed ? 0 : matrixCost(def, rank);
        const afford = profile.shards >= cost;
        const pips = def.maxRank > 1
          ? `<div class="armory-pips">${Array.from({ length: def.maxRank }, (_, i) => `<div class="pip ${i < rank ? 'on' : ''}"></div>`).join('')}</div>`
          : rank > 0 ? '<div class="matrix-owned">ACTIVE</div>' : '';
        return `
          <div class="matrix-node ${locked ? 'locked' : ''} ${rank > 0 ? 'active' : ''} ${def.maxRank === 1 ? 'capstone' : ''}">
            <div class="matrix-link"></div>
            <div class="armory-name">${def.name}</div>
            <div class="armory-desc">${def.desc(Math.max(rank, 1))}${rank > 0 && !maxed ? ` → ${def.desc(rank + 1)}` : ''}</div>
            ${pips}
            <button class="armory-buy ${maxed ? 'maxed' : ''}" data-id="${def.id}"
              ${maxed || !afford || locked ? 'disabled' : ''}>
              ${maxed ? 'MAX' : locked ? '🔒' : `◆ ${cost}`}
            </button>
          </div>`;
      }).join('');
      return `
        <div class="matrix-col">
          <div class="matrix-branch">${MATRIX_BRANCHES[branch]}</div>
          ${items}
        </div>`;
    }).join('');
    const root = this.show(`
      <div class="screen">
        <div class="back-row">
          <button class="back-btn" data-a="back">‹ BACK</button>
          <span class="shards-chip">◆ ${profile.shards}</span>
        </div>
        <div class="screen-title">NANITE MATRIX</div>
        <div class="screen-sub">Permanent upgrades — unlock each branch top-down</div>
        <div class="matrix-grid">${cols}</div>
      </div>
    `);
    this.click(root, '[data-a="back"]', () => { audio.ui(); this.showTitle(); });
    this.click(root, '.armory-buy:not([disabled])', el => {
      const id = el.dataset.id!;
      const def = MATRIX.find(d => d.id === id)!;
      const rank = metaRank(id);
      const cost = matrixCost(def, rank);
      if (rank >= def.maxRank || profile.shards < cost) { audio.deny(); return; }
      profile.shards -= cost;
      profile.meta[id] = rank + 1;
      save();
      audio.buy();
      this.showMatrix();
    });
  }

  // ---------------------------------------------------------------- achievements

  showAchievements(): void {
    const items = ACHIEVEMENTS.map(a => {
      const done = !!profile.achievements[a.id];
      return `
        <div class="ach-item ${done ? 'done' : ''}">
          <div class="ach-icon">${done ? '🏆' : '◇'}</div>
          <div class="armory-info">
            <div class="armory-name">${a.name}</div>
            <div class="armory-desc">${a.desc}</div>
          </div>
          <div class="ach-reward">${done ? '✓' : `◆ ${a.reward}`}</div>
        </div>`;
    }).join('');
    const root = this.show(`
      <div class="screen">
        <div class="back-row">
          <button class="back-btn" data-a="back">‹ BACK</button>
          <span class="shards-chip">◆ ${profile.shards}</span>
        </div>
        <div class="screen-title">ACHIEVEMENTS</div>
        <div class="screen-sub">${Object.keys(profile.achievements).length} / ${ACHIEVEMENTS.length} unlocked</div>
        <div class="armory-list">${items}</div>
      </div>
    `);
    this.click(root, '[data-a="back"]', () => { audio.ui(); this.showTitle(); });
  }

  // ---------------------------------------------------------------- pilots

  showPilots(): void {
    const cards = PILOTS.map(p => {
      const unlocked = profile.pilots.includes(p.id);
      const selected = profile.selectedPilot === p.id;
      const badge = selected
        ? '<div class="pilot-check">✓ ACTIVE</div>'
        : unlocked ? '' : `<div class="pilot-lock">◆ ${p.cost}</div>`;
      return `
        <button class="pilot-card ${selected ? 'selected' : ''}" style="--pc:${p.color}" data-id="${p.id}">
          ${badge}
          <div class="pilot-name">${p.name}</div>
          <div class="pilot-title">${p.title}</div>
          <div class="pilot-desc">${p.desc}</div>
          <div class="pilot-ability">⚡ ${p.abilityName} — ${p.abilityDesc} (${p.abilityCd}s)</div>
        </button>`;
    }).join('');
    const root = this.show(`
      <div class="screen">
        <div class="back-row">
          <button class="back-btn" data-a="back">‹ BACK</button>
          <span class="shards-chip">◆ ${profile.shards}</span>
        </div>
        <div class="screen-title">PILOTS</div>
        <div class="screen-sub">Each pilot has a unique ACTIVE ability — tap its button in-game</div>
        <div class="pilot-list">${cards}</div>
      </div>
    `);
    this.click(root, '[data-a="back"]', () => { audio.ui(); this.showTitle(); });
    this.click(root, '.pilot-card', el => {
      const id = el.dataset.id!;
      const p = PILOTS.find(x => x.id === id)!;
      if (profile.pilots.includes(id)) {
        profile.selectedPilot = id;
        save();
        audio.ui();
      } else if (profile.shards >= p.cost) {
        profile.shards -= p.cost;
        profile.pilots.push(id);
        profile.selectedPilot = id;
        save();
        audio.buy();
      } else {
        audio.deny();
        return;
      }
      this.showPilots();
    });
  }

  // ---------------------------------------------------------------- settings

  showSettings(): void {
    const s = profile.settings;
    const r = profile.records;
    const row = (id: string, label: string, on: boolean) => `
      <button class="setting-row" data-id="${id}">
        <span>${label}</span>
        <span class="toggle ${on ? 'on' : ''}"></span>
      </button>`;
    const root = this.show(`
      <div class="screen">
        <div class="back-row">
          <button class="back-btn" data-a="back">‹ BACK</button>
        </div>
        <div class="screen-title">SETTINGS</div>
        <div class="screen-sub">&nbsp;</div>
        <div class="settings-list">
          ${row('sfx', 'Sound Effects', s.sfx)}
          ${row('music', 'Music', s.music)}
          ${row('haptics', 'Haptics', s.haptics)}
          ${row('shake', 'Screen Shake', s.shake)}
        </div>
        <div class="records-box">
          Runs <b>${r.runs}</b><br/>
          Total kills <b>${r.totalKills}</b><br/>
          Best time <b>${fmtTime(r.bestTime)}</b><br/>
          Best level <b>${r.bestLevel}</b><br/>
          Best combo <b>${r.bestCombo}×</b><br/>
          Best score <b>${r.bestScore}</b><br/>
          Victories <b>${r.victories}</b>
        </div>
        <button class="btn danger" style="margin-top:18px" data-a="reset">RESET ALL DATA</button>
        <div class="hint">Neon Survivor v3 — built with love & photons</div>
      </div>
    `);
    this.click(root, '[data-a="back"]', () => { audio.ui(); this.showTitle(); });
    this.click(root, '.setting-row', el => {
      const id = el.dataset.id as keyof typeof s;
      s[id] = !s[id];
      save();
      if (id === 'music') audio.setMusicEnabled(s.music);
      if (id === 'sfx') audio.sfxEnabled = s.sfx;
      audio.ui();
      this.showSettings();
    });
    this.click(root, '[data-a="reset"]', el => {
      if (el.dataset.confirm) {
        resetProfile();
        audio.deny();
        this.showTitle();
      } else {
        el.dataset.confirm = '1';
        el.textContent = 'TAP AGAIN TO CONFIRM';
      }
    });
  }

  // ---------------------------------------------------------------- HUD

  buildHud(abilityName: string): void {
    this.hud.innerHTML = `
      <div class="hud-xp"><div id="h-xp" style="width:0%"></div></div>
      <div class="hud-top">
        <div class="hud-stat">☠ <b id="h-kills">0</b></div>
        <div class="hud-timer" id="h-timer">0:00</div>
        <div class="hud-stat" style="color:var(--gold)">◆ <b id="h-shards">0</b></div>
      </div>
      <div class="hud-level" id="h-level">LVL 1</div>
      <button class="hud-pause" id="h-pause">⏸</button>
      <div class="hud-boss" id="h-boss" style="display:none">
        <div class="hud-boss-name" id="h-boss-name"></div>
        <div class="hud-boss-bar"><div id="h-boss-fill" style="width:100%"></div></div>
      </div>
      <div class="hud-bottom">
        <div class="hud-hp">
          <div class="hud-hp-bar"><div id="h-hp" style="width:100%"></div></div>
          <div class="hud-hp-label" id="h-hp-label"></div>
          <div class="hud-dashes" id="h-dashes"></div>
        </div>
        <div class="hud-combo" id="h-combo" style="visibility:hidden">
          <div class="hud-combo-num" id="h-combo-num">0</div>
          <div class="hud-combo-label">COMBO</div>
        </div>
      </div>
      <button class="hud-ability" id="h-ability">
        <svg viewBox="0 0 40 40" class="hud-ability-ring"><circle id="h-ability-fill" cx="20" cy="20" r="17.5"/></svg>
        <span class="hud-ability-name">${abilityName}</span>
      </button>
    `;
    this.elTimer = document.getElementById('h-timer')!;
    this.elKills = document.getElementById('h-kills')!;
    this.elShards = document.getElementById('h-shards')!;
    this.elXp = document.getElementById('h-xp')!;
    this.elLevel = document.getElementById('h-level')!;
    this.elHp = document.getElementById('h-hp')!;
    this.elHpLabel = document.getElementById('h-hp-label')!;
    this.elDashes = document.getElementById('h-dashes')!;
    this.elCombo = document.getElementById('h-combo')!;
    this.elBoss = document.getElementById('h-boss')!;
    this.elBossName = document.getElementById('h-boss-name')!;
    this.elBossFill = document.getElementById('h-boss-fill')!;
    this.elAbility = document.getElementById('h-ability')!;
    this.elAbilityFill = document.getElementById('h-ability-fill')!;
    this.hudBuilt = true;
    this.lastHud = { timer: '', kills: -1, shards: -1, xp: -1, level: -1, hp: -1, dashes: -1, combo: -1, ability: -1 };
    document.getElementById('h-pause')!.addEventListener('click', () => this.onPause?.());
    this.elAbility.addEventListener('click', () => this.onAbility?.());
    this.elAbility.addEventListener('touchstart', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      this.onAbility?.();
    }, { passive: false });
  }

  clearHud(): void {
    this.hud.innerHTML = '';
    this.hudBuilt = false;
  }

  updateHud(g: Game): void {
    if (!this.hudBuilt) return;
    const L = this.lastHud;
    const timer = fmtTime(g.time);
    if (timer !== L.timer) { L.timer = timer; this.elTimer.textContent = timer; }
    if (g.kills !== L.kills) { L.kills = g.kills; this.elKills.textContent = String(g.kills); }
    if (g.shardsPicked !== L.shards) { L.shards = g.shardsPicked; this.elShards.textContent = String(g.shardsPicked); }
    const xpPct = Math.round((g.xp / g.xpNext) * 100);
    if (xpPct !== L.xp) { L.xp = xpPct; this.elXp.style.width = `${xpPct}%`; }
    if (g.level !== L.level) { L.level = g.level; this.elLevel.textContent = `LVL ${g.level}`; }
    const hpPct = Math.round((g.hp / g.stats.maxHp) * 1000);
    if (hpPct !== L.hp) {
      L.hp = hpPct;
      this.elHp.style.width = `${hpPct / 10}%`;
      this.elHpLabel.textContent = `${Math.max(0, Math.ceil(g.hp))} / ${g.stats.maxHp}`;
    }
    const dashKey = g.dashCharges * 10 + g.stats.dashCharges;
    if (dashKey !== L.dashes) {
      L.dashes = dashKey;
      this.elDashes.innerHTML = Array.from(
        { length: g.stats.dashCharges },
        (_, i) => `<div class="hud-dash-pip ${i < g.dashCharges ? 'on' : ''}"></div>`,
      ).join('');
    }
    const combo = g.combo >= 5 ? g.combo : 0;
    if (combo !== L.combo) {
      L.combo = combo;
      this.elCombo.style.visibility = combo > 0 ? 'visible' : 'hidden';
      if (combo > 0) document.getElementById('h-combo-num')!.textContent = `${combo}×`;
    }
    // ability cooldown ring (circumference ≈ 110)
    const frac = g.abilityTimer <= 0 ? 1 : 1 - g.abilityTimer / g.stats.abilityCooldown;
    const key = Math.round(frac * 100);
    if (key !== L.ability) {
      L.ability = key;
      this.elAbilityFill.style.strokeDashoffset = String(110 * (1 - frac));
      this.elAbility.classList.toggle('ready', frac >= 1);
    }
  }

  setBossBar(name: string, frac: number, visible: boolean): void {
    if (!this.hudBuilt) return;
    this.elBoss.style.display = visible ? 'block' : 'none';
    if (visible) {
      this.elBossName.textContent = name;
      this.elBossFill.style.width = `${Math.round(frac * 100)}%`;
    }
  }

  // ---------------------------------------------------------------- level-up

  showLevelUp(g: Game, offers: CardOffer[]): void {
    const cards = offers.map((o, i) => {
      const rc = RARITY_COLORS[o.rarity];
      const color = o.kind === 'weapon' || o.kind === 'evolution' ? WEAPONS[o.id as WeaponId]?.color ?? rc : rc;
      const levelText =
        o.kind === 'evolution' ? 'EVOLUTION' :
        o.kind === 'weapon' || o.kind === 'passive' ? (o.isNew ? 'NEW!' : `LVL ${o.level - 1} → ${o.level}`) : '';
      const banishable = g.banishesLeft > 0 && (o.kind === 'weapon' || o.kind === 'passive') && o.isNew;
      return `
        <div class="card-row">
          <button class="card ${o.rarity === 3 ? 'legendary' : ''}" style="--rc:${rc}" data-i="${i}">
            <div class="card-head">
              <span class="card-name" style="color:${color}">${o.title}</span>
              <span class="card-tag">${RARITY_NAMES[o.rarity]}</span>
            </div>
            <div class="card-desc">${o.desc}</div>
            ${levelText ? `<div class="card-level">${levelText}</div>` : ''}
          </button>
          ${banishable ? `<button class="banish-btn" data-b="${i}" title="Banish from this run">✕</button>` : ''}
        </div>`;
    }).join('');
    const root = this.show(`
      <div class="screen levelup-wrap">
        <div class="levelup-title">LEVEL UP</div>
        <div class="cards">${cards}</div>
        <div class="levelup-actions">
          <button class="reroll-btn" data-a="reroll" ${g.rerollsLeft <= 0 ? 'disabled style="opacity:.3"' : ''}>
            ⟳ REROLL (${g.rerollsLeft})
          </button>
          <span class="banish-hint" ${g.banishesLeft <= 0 ? 'style="opacity:.3"' : ''}>✕ banish (${g.banishesLeft})</span>
        </div>
      </div>
    `);
    this.click(root, '.card', el => {
      g.chooseOffer(Number(el.dataset.i));
      audio.ui();
      this.hideScreens();
    });
    this.click(root, '.banish-btn', el => {
      const next = g.banish(Number(el.dataset.b));
      if (next) this.showLevelUp(g, next);
      else audio.deny();
    });
    this.click(root, '[data-a="reroll"]', () => {
      const next = g.reroll();
      if (next) this.showLevelUp(g, next);
      else audio.deny();
    });
  }

  // ---------------------------------------------------------------- chest

  showChest(g: Game, result: ChestResult): void {
    const items = result.items.map((it, i) => `
      <div class="chest-item ${it.isEvo ? 'evo' : ''}" style="animation-delay:${0.15 + i * 0.22}s">
        <div class="n" style="color:${it.color}">${it.name}</div>
        <div class="d">${it.detail}</div>
      </div>`).join('');
    const root = this.show(`
      <div class="screen chest-wrap">
        <div class="chest-title">⬢ SUPPLY DROP</div>
        <div class="chest-items">${items || '<div class="chest-item"><div class="d">Systems already at maximum…</div></div>'}</div>
        <div class="chest-shards">+ ◆ ${result.shards} shards</div>
        <button class="btn primary" style="margin-top:26px" data-a="ok">COLLECT</button>
      </div>
    `);
    this.click(root, '[data-a="ok"]', () => {
      audio.ui();
      this.hideScreens();
      g.resumeFromChest();
    });
  }

  // ---------------------------------------------------------------- cursed tech

  showDeal(g: Game, options: CurseDef[]): void {
    const cards = options.map(c => `
      <button class="card cursed" data-id="${c.id}">
        <div class="card-head">
          <span class="card-name" style="color:#ff5e7a">${c.name}</span>
          <span class="card-tag" style="color:#ff5e7a">CURSED</span>
        </div>
        <div class="curse-good">▲ ${c.good}</div>
        <div class="curse-bad">▼ ${c.bad}</div>
      </button>`).join('');
    const root = this.show(`
      <div class="screen levelup-wrap">
        <div class="deal-title">CURSED TECH</div>
        <div class="screen-sub" style="color:#ff5e7a">The boss dropped something… powerful. And hungry.</div>
        <div class="cards">${cards}</div>
        <button class="reroll-btn" style="margin-top:16px" data-a="refuse">REFUSE</button>
      </div>
    `);
    this.click(root, '.card', el => {
      g.acceptDeal(el.dataset.id!);
      this.hideScreens();
    });
    this.click(root, '[data-a="refuse"]', () => {
      g.refuseDeal();
      this.hideScreens();
    });
  }

  // ---------------------------------------------------------------- pause

  showPause(g: Game): void {
    const chips = [
      ...g.weapons.map(w => {
        const def = WEAPONS[w.id];
        return `<span class="build-chip" style="--bc:${def.color}">${w.evolved ? def.evoName : def.name} ${w.evolved ? '★' : `L${w.level}`}</span>`;
      }),
      ...[...g.passives.entries()].map(([id, lvl]) =>
        `<span class="build-chip">${PASSIVES[id].icon} ${PASSIVES[id].name} L${lvl}</span>`),
      ...g.curses.map(id => {
        const c = CURSES.find(x => x.id === id)!;
        return `<span class="build-chip" style="--bc:#ff5e7a">☠ ${c.name}</span>`;
      }),
    ].join('');
    const root = this.show(`
      <div class="screen levelup-wrap">
        <div class="screen-title">PAUSED</div>
        <div class="screen-sub">${g.pilot.name} · ${fmtTime(g.time)} · LVL ${g.level}</div>
        <div class="pause-build">${chips}</div>
        <div class="menu-stack">
          <button class="btn primary" data-a="resume">RESUME</button>
          <button class="btn" data-a="restart">RESTART</button>
          <button class="btn danger" data-a="quit">ABANDON RUN</button>
        </div>
      </div>
    `);
    this.click(root, '[data-a="resume"]', () => { audio.ui(); this.hideScreens(); g.resume(); });
    this.click(root, '[data-a="restart"]', () => { audio.ui(); this.handlers.restartRun(); });
    this.click(root, '[data-a="quit"]', () => { audio.ui(); this.handlers.quitToTitle(); });
  }

  // ---------------------------------------------------------------- endings

  showEnd(g: Game, stats: RunStats): void {
    const isWin = stats.victory;
    const total = stats.shardsFromScore + stats.shardsPicked;
    const newRecord =
      stats.score >= profile.records.bestScore && stats.score > 0 && profile.records.runs > 1;
    const root = this.show(`
      <div class="screen">
        <div class="over-title ${isWin ? 'win' : 'dead'}">${isWin ? 'SECTOR CLEARED' : 'SIGNAL LOST'}</div>
        <div class="over-sub">${isWin ? 'OMEGA PRIME DESTROYED — THE GRID IS YOURS' : `${stats.pilotName} · SURVIVED ${fmtTime(stats.time)}`}</div>
        ${newRecord ? '<div class="record-flag">★ NEW BEST SCORE</div>' : ''}
        <div class="stats-grid">
          <div class="stat-box"><div class="v">${fmtTime(stats.time)}</div><div class="l">TIME</div></div>
          <div class="stat-box"><div class="v">${stats.kills}</div><div class="l">KILLS</div></div>
          <div class="stat-box"><div class="v">${stats.level}</div><div class="l">LEVEL</div></div>
          <div class="stat-box"><div class="v">${stats.maxCombo}×</div><div class="l">MAX COMBO</div></div>
          <div class="stat-box"><div class="v">${stats.bossKills}</div><div class="l">BOSSES</div></div>
          <div class="stat-box"><div class="v">${stats.score}</div><div class="l">SCORE</div></div>
        </div>
        <div class="shards-earned">+ ◆ <span id="shard-count">0</span> SHARDS</div>
        <div class="menu-stack">
          ${isWin ? '<button class="btn gold" data-a="endless">CONTINUE — ENDLESS MODE</button>' : ''}
          <button class="btn primary" data-a="retry">${isWin ? 'NEW RUN' : 'RETRY'}</button>
          <button class="btn" data-a="menu">MAIN MENU</button>
        </div>
      </div>
    `);
    const counter = root.querySelector('#shard-count')!;
    const t0 = performance.now();
    const dur = 900;
    const tick = (): void => {
      const t = Math.min(1, (performance.now() - t0) / dur);
      counter.textContent = String(Math.round(total * (1 - Math.pow(1 - t, 3))));
      if (t < 1 && counter.isConnected) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    this.click(root, '[data-a="retry"]', () => { audio.ui(); this.handlers.restartRun(); });
    this.click(root, '[data-a="menu"]', () => { audio.ui(); this.handlers.quitToTitle(); });
    this.click(root, '[data-a="endless"]', () => {
      audio.ui();
      this.hideScreens();
      this.buildHud(g.pilot.abilityName);
      g.continueEndless();
    });
  }
}
