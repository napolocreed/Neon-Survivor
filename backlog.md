# Neon Survivor - Development Backlog

This file tracks the evolution of the game, focusing on replayability, chaotic build variety, and a rewarding meta-economy. 

## 🟢 Priority 1: Meta-Progression & Parallel Economy (Cross-Game) - DONE
*To give death a purpose and provide long-term goals.*
- [x] **Meta-Currency ("Neon Cores" / "Nanites")**: Earned during runs based on score, elites killed, or converted from leftover XP.
- [x] **Hub / Main Menu Store**: A screen before starting a run where you can spend your meta-currency.
- [x] **Permanent Global Upgrades**: Boost Base Health, passive Regen, starting Magnet Radius, base Move Speed, or increase the drop rate of Legendary upgrades.
- [x] **Unlockable Chassis (Characters)**: Buy new ship classes with unique starting traits:
  - *The Engineer*: Starts with +2 Orbitals, lower base speed.
  - *The Glass Cannon*: 3x Damage, 1 HP (one hit kill).
  - *The Speedster*: Massive move speed, emits a damaging trail.

## 🟡 Priority 2: Vastly Expanded In-Game Upgrades - DONE
*To ensure the player never knows how their build will end up. The upgrade pool should be massive.*
- [x] **Elemental Status Effects**:
  - **Cryo**: Projectiles slow enemies on hit.
  - **Corrosive**: Damage over time, spreading to nearby enemies.
- [x] **Weapon Evolutions & Synergies**: If a player maxes out two specific upgrades (e.g., Multi-Shot + Explosive Rounds), they combine into a "Legendary Evolution" like a **Cluster Nuke** that clears the screen.
- [x] **Cursed/Corrupted Upgrades**: "Devil deals" that give massive benefits for a severe cost (e.g., +200% Damage, but -50% Move Speed and no Regen).
## 🚀 The Future: Sprints to the Ultimate Mobile Game

With the core mechanics, synergies, and PWA setup complete, our focus shifts to pacing, performance, and long-term player retention. The work is now divided into focused Sprints. Just say **"continue"** to trigger the next sprint!

### 🏃 Sprint 1: Elites, Loot Chests & Consumables
*Adding dopamine hits to the mid-game.*
- [x] **Elite Drops & Chest UI**: Make Elites drop a "Chest" upon death. When collected, pause the game and show a flashy roulette animation granting 1-3 random upgrades instantly.
- [x] **Consumables**: Add rare drops from enemies like "Screen Nuke" (bomb to clear the screen) or "Vacuum" (magnet to instantly collect all XP gems on the map).

### 🏃 Sprint 2: Arena Bosses & Dramatic Pacing
*Creating memorable peaks in the run.*
- [x] **Boss Scheduling**: Trigger the 'boss' enemy at specific time marks (e.g., 5 and 10 minutes).
- [x] **Arena Lockdown**: When a boss spawns, smoothly zoom the camera out and draw restricting "arena walls" that the player cannot cross, forcing a confrontation.
- [x] **Bullet Hell Patterns**: Refine the boss AI to use distinct, dodgeable bullet-hell attack phases.

### 🏃 Sprint 3: Advanced Enemy AI & Swarm Dynamics
*Introducing tactical variety to combat.*
- [x] **Flockers**: Create a new enemy type that uses boid/flocking algorithms to move together in a unified, sweeping wave, forcing the player to cut through them.
- [x] **Worms / Centipedes**: Multi-segmented enemies that weave through the map, requiring the player to target the head or split them into smaller segments.

### 🏃 Sprint 4: Performance & Swarm Optimization
*Ensuring buttery smooth 60 FPS on mobile even with massive chaos.*
- [x] **Spatial Grid Collision**: Replace the $O(n \times m)$ collision checks with a Spatial Grid or QuadTree to comfortably handle 500+ entities.
- [ ] **Object Pooling**: (Optional depending on performance) Implement object pools for particles, projectiles, and gems to reduce Garbage Collection stutters.

### 🏃 Sprint 5: Deep Meta-Economy & Achievements
*Building the long-term hook.*
- [x] **Talent Tree / Nanite Matrix**: Replace or evolve the simple global upgrades into a branching skill tree using "Nanites" earned during runs.
- [x] **Achievements System**: Add a quest log for things like "Reach 100x Combo" or "Survive 10 minutes". Give out unique rewards (special chassis, rare palettes).

---
*To reward aggressive, skilled play and keep the momentum going.*
- [x] **Combo Meter Overhaul**: Combo shouldn't just be a number. At certain thresholds (e.g., 50x, 100x), the player enters "Flow State" / "Overdrive".
- [x] **Overdrive Mode**: Screen pulses to the beat, music intensifies, +50% Move Speed, +50% Attack Speed, and weapons visually change (e.g., projectiles become wider/brighter) while the combo holds.
- [x] **Graze Mechanic**: Getting extremely close to enemies without getting hit instantly adds to the combo meter and generates a small amount of XP. High risk, high reward.

## 🔴 Priority 4: Enemy Diversity & Boss Fights - DONE
*To prevent the game from becoming a mindless kite-fest.*
- [x] **New Enemy Behaviors**:
  - *Dashers*: Pause, aim, and rapidly dash at the player.
  - *Snipers*: Stay on the edge of the screen and shoot telegraphed lasers.
  - *Summoners*: Spawns smaller swarms until killed.
- [x] **Elite Mobs**: Huge variants of normal enemies with random affixes (e.g., "Shielded", "Fast", "Explosive Death"). Drop massive XP gems or Meta-Currency.
- [x] **True Bosses**: At the 5-minute, 10-minute, and 15-minute marks. The screen locks, swarms stop, and a massive boss with bullet-hell patterns appears.

## 🔵 Priority 5: Visual Polish & Sound - DONE
- [x] **Adaptive Audio / Soundtrack**: A dynamic background synth track that gets faster and more intense as the timer increases or during boss fights.
- [x] **UI Enhancements**: 
  - A pause menu with a clear breakdown of current stats and acquired upgrades.
  - A minimap or directional arrows pointing to off-screen Elites/Drops. (Partially completed via Trailing ribbon, can be skipped for now)
- [x] **Damage Number Polish**: Color coding for elemental damage, larger fonts for massive critical hits.

---