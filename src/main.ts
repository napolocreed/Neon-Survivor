// Bootstrap: wires input, game, renderer, UI and the main loop together.

import './style.css';
import { Input } from './core/input';
import { Renderer } from './render/render';
import { Game, GameHooks } from './game/game';
import { UI } from './ui/ui';
import { audio } from './audio/audio';
import { profile, save, currentPilot } from './meta/save';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const input = new Input(document.body);

let game: Game | null = null;
let lastT = performance.now();
let ambientT = 0;

// test/debug knobs: ?t=300 (start at 5:00), ?god=1, ?speed=2
const params = new URLSearchParams(location.search);
const startTime = Number(params.get('t') ?? 0) || 0;
const god = params.has('god');
const speed = Number(params.get('speed') ?? 1) || 1;

const ui = new UI({
  startRun: () => startRun(),
  restartRun: () => startRun(),
  quitToTitle: () => {
    endRun();
    ui.showTitle();
  },
});

function makeHooks(): GameHooks {
  return {
    levelUp: offers => ui.showLevelUp(game!, offers),
    chestOpen: result => ui.showChest(game!, result),
    deal: options => ui.showDeal(game!, options),
    gameOver: stats => {
      save();
      ui.clearHud();
      ui.showEnd(game!, stats);
    },
    victory: stats => {
      save();
      ui.showEnd(game!, stats);
    },
    bossWarn: name => ui.toast(`⚠ ${name} INBOUND ⚠`, 'warn'),
    bossBar: (name, frac, visible) => ui.setBossBar(name, frac, visible),
    evolved: name => ui.toast(`★ ${name} ★`, 'evo'),
    overdrive: () => ui.toast('⚡ OVERDRIVE ⚡', 'od'),
    sector: (name, sub) => ui.sectorToast(name, sub),
    achievement: (name, reward) => ui.achievementToast(name, reward),
    hud: () => ui.updateHud(game!),
  };
}

function startRun(): void {
  audio.unlock();
  audio.startMusic();
  ui.hideScreens();
  input.reset();
  game = new Game(input, makeHooks(), currentPilot(), { startTime, god });
  (window as unknown as { __game: Game }).__game = game; // debug/bot hook
  renderer.resize();
  game.viewR = renderer.viewRadius();
  game.camX = game.px;
  game.camY = game.py;
  ui.buildHud(game.pilot.abilityName);
  ui.onPause = () => {
    if (game && game.phase === 'run') {
      game.pause();
      ui.showPause(game);
    }
  };
  ui.onAbility = () => game?.useAbility();
  save();
}

function endRun(): void {
  game = null;
  ui.clearHud();
  ui.hideScreens();
  audio.intensity = 0;
}

window.addEventListener('keydown', e => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (game?.phase === 'run') {
      game.pause();
      ui.showPause(game);
    } else if (game?.phase === 'paused') {
      ui.hideScreens();
      game.resume();
    }
  }
  if (e.code === 'KeyE') game?.useAbility();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game?.phase === 'run') {
    game.pause();
    ui.showPause(game);
  }
});

const unlockOnce = (): void => {
  audio.unlock();
  audio.sfxEnabled = profile.settings.sfx;
  audio.setMusicEnabled(profile.settings.music);
  audio.startMusic();
  window.removeEventListener('pointerdown', unlockOnce);
  window.removeEventListener('touchstart', unlockOnce);
};
window.addEventListener('pointerdown', unlockOnce);
window.addEventListener('touchstart', unlockOnce);

function frame(now: number): void {
  const dt = Math.min(0.033, (now - lastT) / 1000);
  lastT = now;
  if (game) {
    game.viewR = renderer.viewRadius() / (game.arenaActive ? 0.84 : 1);
    for (let i = 0; i < speed; i++) game.update(dt);
    renderer.render(game, now / 1000, dt);
  } else {
    ambientT += dt;
    renderer.renderAmbient(ambientT);
  }
  requestAnimationFrame(frame);
}

ui.showTitle();
requestAnimationFrame(frame);
