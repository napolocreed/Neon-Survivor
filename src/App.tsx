import React, { useState, useRef, useEffect, useMemo } from 'react';
import GameCanvas from './GameCanvas';
import { GameState, Upgrade } from './types';
import { createInitialState } from './gameEngine';
import { UPGRADES } from './upgrades';
import { Zap, Activity, RefreshCw, Star, Shield, ArrowUpCircle, Play, Cpu, ChevronRight, BarChart2, Trophy, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { initAudio, playSound } from './audio';
import { GLOBAL_UPGRADES, CHASSIS_LIST, ChassisId, loadSaveData, saveGameData, calculateUpgradeCost, SaveData, ACHIEVEMENTS } from './metaStore';
import { useRegisterSW } from 'virtual:pwa-register/react';

const StatCard = ({ title, value, isNewRecord, prevBest }: { title: string, value: string | number, isNewRecord?: boolean, prevBest?: string | number | null }) => (
  <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3 sm:p-4 flex flex-col items-center relative overflow-hidden shadow-lg">
    {isNewRecord && (
      <div className="absolute top-0 w-full bg-gradient-to-r from-amber-500 to-yellow-400 text-[10px] font-black uppercase tracking-widest text-amber-950 text-center py-0.5">
        New Record
      </div>
    )}
    <p className="text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-widest mt-2 mb-1 text-center leading-tight">{title}</p>
    <p className={`text-xl sm:text-2xl font-mono font-black ${isNewRecord ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'text-white'}`}>
      {value}
    </p>
    {!isNewRecord && prevBest != null && (
      <p className="text-slate-600 text-[10px] font-mono mt-1">Best: {prevBest}</p>
    )}
  </div>
);

export default function App() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Setup periodic update check if needed
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const [saveData, setSaveData] = useState<SaveData>(loadSaveData());
  const gameStateRef = useRef<GameState>(createInitialState(saveData.globalUpgrades, saveData.selectedChassis));
  
  // App states
  const [view, setView] = useState<'menu' | 'hub' | 'playing'>('menu');
  
  // UI States (throttled from canvas)
  const [xp, setXp] = useState(0);
  const [xpToNext, setXpToNext] = useState(20);
  const [level, setLevel] = useState(1);
  const [health, setHealth] = useState(100);
  const [maxHealth, setMaxHealth] = useState(100);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isLevelingUp, setIsLevelingUp] = useState(false);
  const isLevelingUpRef = useRef(false);
  const [time, setTime] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxComboThisRun, setMaxComboThisRun] = useState(0);
  const [runSummary, setRunSummary] = useState<{ time: number, level: number, kills: number, maxCombo: number, earnedNanites: number, isNewTimeRecord: boolean, isNewLevelRecord: boolean, isNewKillsRecord: boolean, isNewComboRecord: boolean, prevTime: number, prevLevel: number, prevKills: number, prevCombo: number } | null>(null);

  // Upgrades state
  const [upgradesState, setUpgradesState] = useState<Upgrade[]>(
    UPGRADES.map(u => ({ ...u }))
  );
  
  const [choices, setChoices] = useState<Upgrade[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  const [isChestOpen, setIsChestOpen] = useState(false);
  const isChestOpenRef = useRef(false);
  const [chestChoices, setChestChoices] = useState<Upgrade[]>([]);

  const startGame = () => {
    initAudio();
    playSound('click');
    gameStateRef.current = createInitialState(saveData.globalUpgrades, saveData.selectedChassis);
    setUpgradesState(UPGRADES.map(u => ({ ...u })));
    setIsGameOver(false);
    setIsLevelingUp(false);
    isLevelingUpRef.current = false;
    setIsChestOpen(false);
    isChestOpenRef.current = false;
    setChestChoices([]);
    setIsPaused(false);
    setCombo(0);
    setMaxComboThisRun(0);
    setRunSummary(null);
    setView('playing');
    handleStateUpdate();
  };

  const openHub = () => {
    playSound('click');
    setHubTab('upgrades');
    setView('hub');
  };

  const [hubTab, setHubTab] = useState<'upgrades' | 'chassis' | 'achievements' | 'stats'>('upgrades');

  const buyGlobalUpgrade = (upgradeId: string) => {
    const upgrade = GLOBAL_UPGRADES.find(u => u.id === upgradeId);
    if (!upgrade) return;

    const currentLevel = saveData.globalUpgrades[upgradeId] || 0;
    if (currentLevel >= upgrade.maxLevel) return;
    
    if (upgrade.prerequisites && !upgrade.prerequisites.every(pre => (saveData.globalUpgrades[pre] || 0) > 0)) return;

    const cost = calculateUpgradeCost(upgrade.baseCost, upgrade.costMultiplier, currentLevel);
    
    if (saveData.nanites >= cost) {
      playSound('levelup');
      const newData = {
        ...saveData,
        nanites: saveData.nanites - cost,
        globalUpgrades: {
          ...saveData.globalUpgrades,
          [upgradeId]: currentLevel + 1
        }
      };
      setSaveData(newData);
      saveGameData(newData);
    } else {
      playSound('hit');
    }
  };

  const buyOrSelectChassis = (chassisId: ChassisId) => {
    if (saveData.unlockedChassis.includes(chassisId)) {
      playSound('click');
      const newData = { ...saveData, selectedChassis: chassisId };
      setSaveData(newData);
      saveGameData(newData);
      return;
    }

    const chassis = CHASSIS_LIST.find(c => c.id === chassisId);
    if (!chassis) return;

    if (saveData.nanites >= chassis.unlockCost) {
      playSound('levelup');
      const newData = {
        ...saveData,
        nanites: saveData.nanites - chassis.unlockCost,
        unlockedChassis: [...saveData.unlockedChassis, chassisId],
        selectedChassis: chassisId
      };
      setSaveData(newData);
      saveGameData(newData);
    } else {
      playSound('hit');
    }
  };

  const claimAchievement = (achievementId: string, currentStats?: any) => {
    if (saveData.claimedAchievements.includes(achievementId)) return;
    
    const ach = ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!ach || !ach.check(currentStats || saveData.stats)) return;

    playSound('levelup');
    
    const newUnlockedChassis = [...saveData.unlockedChassis];
    if (ach.rewardChassis && !newUnlockedChassis.includes(ach.rewardChassis)) {
      newUnlockedChassis.push(ach.rewardChassis);
    }

    const newData = {
      ...saveData,
      stats: currentStats ? { ...saveData.stats, ...currentStats } : saveData.stats,
      nanites: saveData.nanites + ach.rewardNanites,
      unlockedChassis: newUnlockedChassis,
      claimedAchievements: [...saveData.claimedAchievements, achievementId]
    };
    
    setSaveData(newData);
    saveGameData(newData);
  };

  const handleStateUpdate = () => {
    const state = gameStateRef.current;
    
    if (xp !== state.xp) setXp(state.xp);
    if (xpToNext !== state.xpToNext) setXpToNext(state.xpToNext);
    if (level !== state.level) setLevel(state.level);
    if (health !== state.playerStats.health) setHealth(state.playerStats.health);
    if (maxHealth !== state.playerStats.maxHealth) setMaxHealth(state.playerStats.maxHealth);
    
    if (state.isGameOver && !isGameOver) {
      setIsGameOver(true);
      // Award nanites
      const earned = Math.floor(state.time / 10) + Math.floor(state.level * 2) + Math.floor(state.kills / 100);
      
      const currentMaxCombo = Math.max(maxComboThisRun, state.combo);
      
      setRunSummary({
        time: state.time,
        level: state.level,
        kills: state.kills,
        maxCombo: currentMaxCombo,
        earnedNanites: earned,
        isNewTimeRecord: state.time > saveData.stats.longestRun,
        isNewLevelRecord: state.level > saveData.stats.highestLevel,
        isNewKillsRecord: state.kills > (saveData.stats.highestKillsInRun || 0),
        isNewComboRecord: currentMaxCombo > saveData.stats.highestCombo,
        prevTime: saveData.stats.longestRun,
        prevLevel: saveData.stats.highestLevel,
        prevKills: saveData.stats.highestKillsInRun || 0,
        prevCombo: saveData.stats.highestCombo
      });

      const newStats = {
        ...saveData.stats,
        highestCombo: Math.max(saveData.stats.highestCombo, currentMaxCombo),
        longestRun: Math.max(saveData.stats.longestRun, state.time),
        highestLevel: Math.max(saveData.stats.highestLevel, state.level),
        totalEnemiesDefeated: saveData.stats.totalEnemiesDefeated + state.kills,
        highestKillsInRun: Math.max(saveData.stats.highestKillsInRun || 0, state.kills),
        gamesPlayed: (saveData.stats.gamesPlayed || 0) + 1,
        totalNanitesEarned: (saveData.stats.totalNanitesEarned || 0) + earned,
        totalDamageDealt: (saveData.stats.totalDamageDealt || 0) + Math.floor(state.runStats?.damageDealt || 0),
        totalDamageTaken: (saveData.stats.totalDamageTaken || 0) + Math.floor(state.runStats?.damageTaken || 0),
        totalTimePlayed: (saveData.stats.totalTimePlayed || 0) + Math.floor(state.time),
        chassisPlayCounts: {
           ...(saveData.stats.chassisPlayCounts || {}),
           [saveData.selectedChassis]: ((saveData.stats.chassisPlayCounts || {})[saveData.selectedChassis] || 0) + 1
        },
        enemyKillsByType: { ...(saveData.stats.enemyKillsByType || {}) }
      };

      if (state.runStats?.killsByType) {
         Object.entries(state.runStats.killsByType).forEach(([type, count]) => {
            newStats.enemyKillsByType[type] = (newStats.enemyKillsByType[type] || 0) + count;
         });
      }

      const newData = { 
        ...saveData, 
        nanites: saveData.nanites + earned,
        stats: newStats
      };
      setSaveData(newData);
      saveGameData(newData);
    } else if (isGameOver !== state.isGameOver) {
      setIsGameOver(state.isGameOver);
    }

    if (combo !== state.combo) {
      setCombo(state.combo);
      setMaxComboThisRun(prev => Math.max(prev, state.combo));
    }
    
    setTime(Math.floor(state.time));

    const currentStatsForAch = {
       ...saveData.stats,
       highestCombo: Math.max(saveData.stats.highestCombo, maxComboThisRun, state.combo),
       longestRun: Math.max(saveData.stats.longestRun, state.time),
       highestLevel: Math.max(saveData.stats.highestLevel, state.level),
       highestKillsInRun: Math.max(saveData.stats.highestKillsInRun || 0, state.kills)
    };

    // Check achievements continuously
    ACHIEVEMENTS.forEach(ach => {
      if (!saveData.claimedAchievements.includes(ach.id) && ach.check(currentStatsForAch)) {
        claimAchievement(ach.id, currentStatsForAch);
      }
    });

    if (state.isLevelingUp && !isLevelingUpRef.current) {
      isLevelingUpRef.current = true;
      setIsLevelingUp(true);
      generateUpgradeChoices();
    }

    if (state.chestRewards !== null && !isChestOpenRef.current && !isLevelingUpRef.current) {
      isChestOpenRef.current = true;
      setIsChestOpen(true);
      generateChestRewards(state.chestRewards);
    }
  };

  const generateChestRewards = (count: number) => {
    const available = upgradesState.filter(u => {
      if (u.level >= u.maxLevel) return false;
      if (u.prerequisites && u.prerequisites.length > 0) {
         return u.prerequisites.every(preId => {
           const pre = upgradesState.find(x => x.id === preId);
           return pre && pre.level > 0;
         });
      }
      return true;
    });

    if (available.length === 0) {
      gameStateRef.current.chestRewards = null;
      isChestOpenRef.current = false;
      setIsChestOpen(false);
      return;
    }

    const shuffled = [...available].sort(() => 0.5 - Math.random());
    setChestChoices(shuffled.slice(0, count));
  };

  const pushEnemiesAway = (state: GameState) => {
    state.enemies.forEach(e => {
       const dx = e.pos.x - state.playerPos.x;
       const dy = e.pos.y - state.playerPos.y;
       const dist = Math.sqrt(dx*dx + dy*dy);
       if (dist < 400 && dist > 0) {
          e.pos.x += (dx / dist) * 200;
          e.pos.y += (dy / dist) * 200;
       }
    });
  };

  const collectChestRewards = () => {
    playSound('powerup');
    const state = gameStateRef.current;

    chestChoices.forEach(choice => {
      const upgradeToApply = upgradesState.find(u => u.id === choice.id);
      if (upgradeToApply) {
        upgradeToApply.apply(state.playerStats);
        const newUpgrades = upgradesState.map(u => u.id === choice.id ? { ...u, level: u.level + 1 } : u);
        setUpgradesState(newUpgrades);
      }
    });

    state.chestRewards = null;
    isChestOpenRef.current = false;
    setIsChestOpen(false);
    setChestChoices([]);
    pushEnemiesAway(state);
  };

  const generateUpgradeChoices = () => {
    const available = upgradesState.filter(u => {
      if (u.level >= u.maxLevel) return false;
      if (u.prerequisites && u.prerequisites.length > 0) {
         // Check if all prerequisites have at least level 1
         return u.prerequisites.every(preId => {
            const preUpgrade = upgradesState.find(upg => upg.id === preId);
            return preUpgrade && preUpgrade.level > 0;
         });
      }
      return true;
    });
    
    if (available.length === 0) {
      gameStateRef.current.isLevelingUp = false;
      isLevelingUpRef.current = false;
      setIsLevelingUp(false);
      return;
    }

    const shuffled = [...available].sort(() => 0.5 - Math.random());
    setChoices(shuffled.slice(0, 3));
  };

  const selectUpgrade = (upgradeId: string) => {
    playSound('click');
    const state = gameStateRef.current;
    const newUpgrades = [...upgradesState];
    const index = newUpgrades.findIndex(u => u.id === upgradeId);
    
    if (index !== -1) {
      newUpgrades[index].level += 1;
      newUpgrades[index].apply(state.playerStats);
      setUpgradesState(newUpgrades);
    }

    state.isLevelingUp = false;
    isLevelingUpRef.current = false;
    setIsLevelingUp(false);
    setChoices([]);
    pushEnemiesAway(state);
  };

  const restartGame = () => {
    setView('menu');
  };

  const formatTime = (seconds: number) => {
    const sTotal = Math.ceil(seconds);
    const m = Math.floor(sTotal / 60);
    const s = sTotal % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const togglePause = () => {
     playSound('click');
     setIsPaused(prev => !prev);
  };

  const triggerAbility = () => {
      import('./gameEngine').then(engine => {
          if (!isPaused && !isGameOver && !isLevelingUpRef.current) {
             engine.triggerActiveAbility(gameStateRef.current);
          }
      });
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'text-amber-400 border-amber-400/50 shadow-amber-400/20';
      case 'epic': return 'text-purple-400 border-purple-400/50 shadow-purple-400/20';
      case 'rare': return 'text-cyan-400 border-cyan-400/50 shadow-cyan-400/20';
      default: return 'text-slate-300 border-slate-600 shadow-transparent';
    }
  };

  const canAffordUpgrades = GLOBAL_UPGRADES.some(u => {
    const currentLevel = saveData.globalUpgrades[u.id] || 0;
    const isMax = currentLevel >= u.maxLevel;
    const cost = calculateUpgradeCost(u.baseCost, u.costMultiplier, currentLevel);
    const hasPrereqs = !u.prerequisites || u.prerequisites.every(preId => (saveData.globalUpgrades[preId] || 0) > 0);
    return saveData.nanites >= cost && !isMax && hasPrereqs;
  });

  const canAffordChassis = CHASSIS_LIST.some(c => 
    !saveData.unlockedChassis.includes(c.id) && saveData.nanites >= c.unlockCost
  );

  const hasUnclaimedAchievements = ACHIEVEMENTS.some(ach => 
    !saveData.claimedAchievements.includes(ach.id) && ach.check(saveData.stats)
  );

  const hubNotification = canAffordUpgrades || canAffordChassis || hasUnclaimedAchievements;

  return (
    <div className="fixed inset-0 bg-slate-950 text-slate-100 font-sans selection:bg-cyan-900 touch-none select-none overscroll-none flex flex-col">
      
      {needRefresh && (
        <div className="absolute top-4 left-4 right-4 z-[100] bg-cyan-950 border border-cyan-500 rounded-xl p-4 shadow-[0_0_20px_rgba(34,211,238,0.2)] flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-bold text-cyan-50">Update Available</span>
            <span className="text-sm text-cyan-200">A new version of the game is ready.</span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => updateServiceWorker(true)}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2 rounded-lg transition-colors"
            >
              Restart
            </button>
            <button 
              onClick={() => setNeedRefresh(false)}
              className="bg-cyan-950 hover:bg-cyan-900 border border-cyan-500 text-cyan-400 font-bold px-4 py-2 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {view === 'menu' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 px-6">
           <div className="absolute top-6 right-6 flex gap-3">
             <button 
               onClick={() => { setHubTab('stats'); setView('hub'); }} 
               className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all shadow-lg"
             >
                <BarChart2 className="w-6 h-6" />
             </button>
             <button 
               onClick={() => { setHubTab('achievements'); setView('hub'); }} 
               className="relative w-12 h-12 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all shadow-lg"
             >
                <Trophy className="w-6 h-6" />
                {hasUnclaimedAchievements && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-950 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]" />}
             </button>
           </div>
           
           <Zap className="w-16 h-16 text-cyan-400 mb-6 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
           <h1 className="text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-br from-white to-cyan-200 tracking-tighter text-center">
             NEON SURVIVOR
           </h1>
           <p className="text-slate-400 mb-8 text-center max-w-sm">
             A high-octane infinite rogue-lite. Drag to move, auto-fire. Survive the horde.
           </p>
           
           <div className="flex flex-col gap-4">
             <button 
               onClick={startGame}
               className="group flex items-center justify-center gap-3 bg-cyan-400 text-slate-950 px-10 py-4 rounded-full font-black text-xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(34,211,238,0.4)]"
             >
               <Play className="w-6 h-6 fill-slate-950" />
               INITIALIZE
             </button>
             
             <button 
               onClick={openHub}
               className="group flex items-center justify-center gap-2 bg-slate-800 text-cyan-400 px-10 py-4 rounded-full font-bold text-lg border border-slate-700 transition-all hover:bg-slate-700 active:scale-95"
             >
               <Cpu className="w-5 h-5" />
               ARMORY
             </button>
           </div>
        </div>
      )}

      {view === 'hub' && (
        <div className="absolute inset-0 z-50 flex flex-col bg-slate-950 overflow-y-auto">
          <div className="sticky top-0 z-20 w-full bg-slate-950/80 backdrop-blur-md border-b border-slate-800 p-4 px-6 flex justify-between items-center">
             <button onClick={() => setView('menu')} className="flex items-center gap-2 text-slate-400 hover:text-white font-bold transition-colors">
               <ArrowLeft className="w-5 h-5" />
               BACK
             </button>
             <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Nanites</span>
                <span className="text-xl font-mono font-black text-emerald-400">{saveData.nanites}</span>
             </div>
          </div>
          <div className="max-w-2xl mx-auto w-full px-6 py-8">
            <div className="mb-6">
              <h1 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3">
                {hubTab === 'stats' ? <BarChart2 className="text-cyan-400" /> : hubTab === 'achievements' ? <Trophy className="text-cyan-400" /> : <Cpu className="text-cyan-400" />}
                {hubTab === 'stats' ? 'STATISTICS' : hubTab === 'achievements' ? 'ACHIEVEMENTS' : 'ARMORY'}
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                {hubTab === 'stats' ? 'Analyze your combat data.' : hubTab === 'achievements' ? 'Unlock rewards for milestones.' : 'Enhance your base stats permanently.'}
              </p>
            </div>

            {(hubTab === 'upgrades' || hubTab === 'chassis') && (
              <div className="grid grid-cols-2 sm:flex gap-2 mb-8 bg-slate-900 p-1 rounded-xl">
                <button 
                  onClick={() => setHubTab('upgrades')}
                  className={`relative flex-1 py-3 text-sm font-bold rounded-lg transition-all ${hubTab === 'upgrades' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  TALENT MATRIX
                  {canAffordUpgrades && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
                </button>
                <button 
                  onClick={() => setHubTab('chassis')}
                  className={`relative flex-1 py-3 text-sm font-bold rounded-lg transition-all ${hubTab === 'chassis' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  CHASSIS BAY
                  {canAffordChassis && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
                </button>
              </div>
            )}

            {hubTab === 'upgrades' && (
              <div className="flex flex-col gap-4 mb-8">
                {GLOBAL_UPGRADES.map(upgrade => {
                  const currentLevel = saveData.globalUpgrades[upgrade.id] || 0;
                  const isMax = currentLevel >= upgrade.maxLevel;
                  const cost = calculateUpgradeCost(upgrade.baseCost, upgrade.costMultiplier, currentLevel);
                  
                  const hasPrereqs = !upgrade.prerequisites || upgrade.prerequisites.every(preId => (saveData.globalUpgrades[preId] || 0) > 0);
                  const canAfford = saveData.nanites >= cost && !isMax && hasPrereqs;

                  return (
                    <div key={upgrade.id} className={`border p-4 rounded-xl flex items-center justify-between gap-4 transition-all ${hasPrereqs ? 'bg-slate-900 border-slate-800' : 'bg-slate-950 border-slate-900 opacity-50'}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-white">{upgrade.name}</h3>
                          <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                            {isMax ? 'MAX' : `LVL ${currentLevel}/${upgrade.maxLevel}`}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400">{upgrade.description(currentLevel)}</p>
                        {!hasPrereqs && upgrade.prerequisites && (
                          <p className="text-xs text-red-400 mt-1 font-bold">
                            Requires: {upgrade.prerequisites.map(p => GLOBAL_UPGRADES.find(u => u.id === p)?.name).join(', ')}
                          </p>
                        )}
                      </div>
                      
                      <button
                        onClick={() => buyGlobalUpgrade(upgrade.id)}
                        disabled={!canAfford || isMax || !hasPrereqs}
                        className={`px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-all ${
                          isMax 
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            : canAfford
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30 active:scale-95'
                              : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                        }`}
                      >
                        {isMax ? 'MAXED' : (
                          <>
                            <span>{cost}</span>
                            <span className="text-xs">NANITES</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {hubTab === 'chassis' && (
              <div className="flex flex-col gap-4 mb-8">
                {CHASSIS_LIST.map(chassis => {
                  const isUnlocked = saveData.unlockedChassis.includes(chassis.id);
                  const isSelected = saveData.selectedChassis === chassis.id;
                  const canAfford = saveData.nanites >= chassis.unlockCost;

                  return (
                    <div key={chassis.id} className={`bg-slate-900 border p-4 rounded-xl flex items-center justify-between gap-4 transition-all ${isSelected ? 'border-cyan-500 shadow-[0_0_15px_rgba(34,211,238,0.1)]' : 'border-slate-800'}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: chassis.color }} />
                          <h3 className="font-bold text-white">{chassis.name}</h3>
                          {isSelected && (
                            <span className="text-xs font-bold bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/30">SELECTED</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-400 pl-6">{chassis.description}</p>
                      </div>
                      
                      <button
                        onClick={() => buyOrSelectChassis(chassis.id)}
                        disabled={!isUnlocked && !canAfford}
                        className={`px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-all ${
                          isSelected 
                            ? 'bg-cyan-500/10 text-cyan-500 border border-cyan-500/30 cursor-default'
                            : isUnlocked
                              ? 'bg-slate-800 text-white hover:bg-slate-700 active:scale-95'
                              : canAfford
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30 active:scale-95'
                                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                        }`}
                      >
                        {isSelected ? 'EQUIPPED' : isUnlocked ? 'SELECT' : (
                          <>
                            <span>{chassis.unlockCost}</span>
                            <span className="text-xs">NANITES</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {hubTab === 'achievements' && (
              <div className="flex flex-col gap-4 mb-8">
                {ACHIEVEMENTS.map(ach => {
                  const isClaimed = saveData.claimedAchievements.includes(ach.id);
                  const isCompleted = ach.check(saveData.stats);
                  
                  return (
                    <div key={ach.id} className={`p-4 rounded-xl flex items-center justify-between gap-4 border transition-all ${isClaimed ? 'bg-slate-900 border-slate-800 opacity-60' : isCompleted ? 'bg-emerald-950/40 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-slate-900 border-slate-800'}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          {isClaimed ? <Star className="w-5 h-5 text-emerald-500" fill="currentColor" /> : <Star className="w-5 h-5 text-slate-600" />}
                          <h3 className="font-bold text-white">{ach.name}</h3>
                        </div>
                        <p className="text-sm text-slate-400 pl-8">{ach.description}</p>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end text-sm">
                          <span className="font-bold text-emerald-400">+{ach.rewardNanites} Nanites</span>
                          {ach.rewardChassis && (
                            <span className="text-cyan-400">Unlock: {CHASSIS_LIST.find(c => c.id === ach.rewardChassis)?.name}</span>
                          )}
                        </div>
                        {!isClaimed && isCompleted && (
                          <span className="text-emerald-400 font-bold px-3 py-1 bg-emerald-500/20 rounded border border-emerald-500/30">CLAIMED!</span>
                        )}
                        {isClaimed && (
                          <span className="text-slate-500 font-bold px-3 py-1 bg-slate-800 rounded">COMPLETED</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {hubTab === 'stats' && (
              <div className="flex flex-col gap-6 mb-8 text-white">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard title="Games Played" value={saveData.stats.gamesPlayed || 0} />
                  <StatCard title="Time Played" value={formatTime(saveData.stats.totalTimePlayed || 0)} />
                  <StatCard title="Total Kills" value={(saveData.stats.totalEnemiesDefeated || 0).toLocaleString()} />
                  <StatCard title="Nanites Earned" value={(saveData.stats.totalNanitesEarned || 0).toLocaleString()} />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl flex flex-col justify-center">
                      <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-4">Combat Performance</h3>
                      <div className="flex justify-between text-sm mb-1">
                         <span className="text-amber-400 font-mono">Damage Dealt</span>
                         <span className="text-rose-400 font-mono">Damage Taken</span>
                      </div>
                      <div className="flex justify-between font-black text-xl sm:text-2xl mb-3">
                         <span className="text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]">{Math.floor(saveData.stats.totalDamageDealt || 0).toLocaleString()}</span>
                         <span className="text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]">{Math.floor(saveData.stats.totalDamageTaken || 0).toLocaleString()}</span>
                      </div>
                      <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex">
                         {(() => {
                            const dealt = saveData.stats.totalDamageDealt || 0;
                            const taken = saveData.stats.totalDamageTaken || 0;
                            const total = dealt + taken;
                            const dealtPct = total === 0 ? 50 : (dealt / total) * 100;
                            const takenPct = total === 0 ? 50 : (taken / total) * 100;
                            return (
                              <>
                                <div className="h-full bg-amber-400" style={{ width: `${dealtPct}%` }} />
                                <div className="h-full bg-rose-500" style={{ width: `${takenPct}%` }} />
                              </>
                            );
                         })()}
                      </div>
                   </div>
                   
                   <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl">
                      <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-4">Chassis Usage</h3>
                      <div className="flex flex-col gap-3">
                        {CHASSIS_LIST.map(c => {
                          const plays = (saveData.stats.chassisPlayCounts || {})[c.id] || 0;
                          const maxPlays = Math.max(...(Object.values(saveData.stats.chassisPlayCounts || {}) as number[]), 1);
                          const pct = (plays / maxPlays) * 100;
                          if (plays === 0 && !saveData.unlockedChassis.includes(c.id)) return null;
                          return (
                            <div key={c.id} className="flex items-center gap-3">
                               <div className="w-24 text-xs font-bold text-slate-400 truncate">{c.name}</div>
                               <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                                 <div className="h-full bg-cyan-500 transition-all duration-1000 ease-out" style={{ width: `${pct}%` }} />
                               </div>
                               <div className="w-12 text-right font-mono text-sm text-cyan-400 font-bold">{plays}</div>
                            </div>
                          );
                        })}
                      </div>
                   </div>
                </div>
                
                <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl">
                    <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-4 text-center">Target Analysis</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                       {['basic', 'tank', 'swarm', 'dasher', 'sniper', 'summoner', 'flocker', 'worm_head', 'boss'].map(type => {
                         const kills = (saveData.stats.enemyKillsByType || {})[type] || 0;
                         if (kills === 0) return null;
                         const colors: Record<string, string> = {
                            basic: '#f87171', tank: '#fca5a5', swarm: '#fca5a5', dasher: '#fbbf24', sniper: '#fb923c', summoner: '#c084fc', flocker: '#fca5a5', worm_head: '#10b981', boss: '#ef4444'
                         };
                         return (
                           <div key={type} className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                             <div className="flex items-center gap-2">
                               <div className="relative rounded-full shadow-[0_0_8px_currentColor]" style={{ width: '14px', height: '14px', backgroundColor: colors[type] || '#fff', color: colors[type] || '#fff' }}>
                                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/40" style={{ width: '60%', height: '60%' }} />
                               </div>
                               <span className="text-xs font-bold uppercase text-slate-300">{type.replace('_', ' ')}</span>
                             </div>
                             <span className="font-mono text-sm font-black text-white">{kills.toLocaleString()}</span>
                           </div>
                         );
                       })}
                    </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard title="Best Run" value={formatTime(saveData.stats.longestRun)} />
                  <StatCard title="Highest Level" value={saveData.stats.highestLevel} />
                  <StatCard title="Max Combo" value={`${saveData.stats.highestCombo}x`} />
                  <StatCard title="Highest Kills" value={(saveData.stats.highestKillsInRun || 0).toLocaleString()} />
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {view === 'playing' && (
        <>
          <div className="absolute inset-0 z-0">
            <GameCanvas 
              gameStateRef={gameStateRef} 
              onStateUpdate={handleStateUpdate}
              isPaused={isPaused}
            />
          </div>

          {/* Danger Aura for Low Health */}
          {health / maxHealth <= 0.4 && (
             <div 
               className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-300 mix-blend-screen"
               style={{
                 opacity: Math.min(1, (0.4 - (health / maxHealth)) * 2.5),
                 background: 'radial-gradient(circle, transparent 40%, rgba(220, 38, 38, 0.2) 70%, rgba(220, 38, 38, 0.8) 100%)',
                 boxShadow: 'inset 0 0 200px rgba(220, 38, 38, 0.8), inset 0 0 80px rgba(220, 38, 38, 0.5)'
               }}
             >
                <div className="absolute inset-0 bg-red-600/10 animate-pulse" style={{ animationDuration: '0.8s' }} />
             </div>
          )}

          <header className="relative z-10 w-full pt-4 px-4 pb-2 pointer-events-none">
            
             <div className="flex justify-between items-start mb-3 max-w-3xl mx-auto pointer-events-auto">
              {/* Level & Time */}
              <div className="flex flex-col gap-1 drop-shadow-md">
                 <div className="flex items-center gap-2">
                    <button 
                      onClick={togglePause}
                      className="bg-slate-800/80 p-1.5 rounded-md border border-slate-700/50 backdrop-blur-md hover:bg-slate-700 active:scale-95 transition-all text-slate-300"
                    >
                      {isPaused ? <Play className="w-5 h-5" /> : <div className="w-5 h-5 flex items-center justify-center font-bold text-xs">||</div>}
                    </button>
                    <div className="bg-cyan-500/20 p-1.5 rounded-md border border-cyan-500/30 backdrop-blur-md">
                      <Star className="w-5 h-5 text-cyan-400 fill-cyan-400" />
                    </div>
                    <span className="text-2xl font-black italic tracking-wider text-white drop-shadow">LVL {level}</span>
                 </div>
                 <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-widest pl-12 drop-shadow-md">
                   {formatTime(time)}
                 </span>
              </div>
              
              {/* Combo & Health */}
              <div className="flex flex-col items-end gap-2">
                 {combo > 5 && (
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-right"
                    >
                      <span className={`text-xs font-bold uppercase tracking-widest drop-shadow-lg ${combo >= 50 ? 'text-yellow-400' : 'text-amber-400'}`}>
                        {combo >= 50 ? 'OVERDRIVE' : 'Combo'}
                      </span>
                      <div className={`text-2xl font-black italic text-transparent bg-clip-text drop-shadow-xl ${combo >= 50 ? 'bg-gradient-to-b from-yellow-200 to-yellow-500 animate-pulse' : 'bg-gradient-to-b from-amber-200 to-amber-500'}`}>
                        {combo}x
                      </div>
                    </motion.div>
                 )}
                 <div className="flex items-center gap-3 bg-slate-900 px-4 py-2 rounded-full border-2 border-slate-700 shadow-[0_0_15px_rgba(0,0,0,0.5)] mt-auto">
                    <Activity className="w-5 h-5 text-emerald-400" />
                    <div className="flex flex-col">
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Integrity</span>
                       <span className="font-mono font-black text-xl text-emerald-400 leading-none mt-1">
                         {Math.max(0, Math.ceil(health))} <span className="text-sm text-emerald-600">/ {maxHealth}</span>
                       </span>
                    </div>
                 </div>
              </div>
            </div>

            {/* XP Bar */}
            <div className="max-w-3xl mx-auto drop-shadow-lg relative">
              <div className="w-full h-3 bg-slate-900/80 rounded-full border border-slate-700/50 overflow-hidden backdrop-blur-sm">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(100, (xp / xpToNext) * 100)}%` }}
                />
              </div>
            </div>
          </header>

          {gameStateRef.current?.playerStats?.abilityType !== 'none' && !isLevelingUp && !isGameOver && (
             <div className="absolute bottom-6 right-6 z-10">
               <button
                 onClick={triggerAbility}
                 disabled={gameStateRef.current.playerStats.abilityCooldownTimer > 0}
                 className={`w-16 h-16 rounded-full flex items-center justify-center font-black text-xl shadow-lg border-2 transition-all active:scale-95
                   ${gameStateRef.current.playerStats.abilityCooldownTimer > 0 
                     ? 'bg-slate-800 border-slate-700 text-slate-500' 
                     : 'bg-cyan-500 text-slate-900 border-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.5)]'}`}
               >
                 {gameStateRef.current.playerStats.abilityCooldownTimer > 0 
                   ? Math.ceil(gameStateRef.current.playerStats.abilityCooldownTimer)
                   : 'EMP'}
               </button>
             </div>
          )}

          <AnimatePresence>
            {isPaused && !isLevelingUp && !isGameOver && (
               <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm pointer-events-auto"
               >
                 <h2 className="text-4xl font-black text-white tracking-widest mb-8 drop-shadow-lg">PAUSED</h2>
                 <div className="flex flex-col gap-4">
                   <button 
                     onClick={togglePause}
                     className="px-8 py-3 bg-cyan-500 text-slate-900 font-bold rounded-lg hover:bg-cyan-400 transition-all active:scale-95 shadow-lg shadow-cyan-500/20"
                   >
                     RESUME
                   </button>
                   <button 
                     onClick={restartGame}
                     className="px-8 py-3 bg-slate-800 text-slate-300 font-bold rounded-lg border border-slate-700 hover:bg-slate-700 transition-all active:scale-95"
                   >
                     ABORT RUN
                   </button>
                 </div>
                 
                 <div className="mt-8 max-w-lg w-full bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                    <h3 className="text-cyan-400 font-bold mb-4 uppercase tracking-widest text-sm">System Diagnostics</h3>
                    <div className="grid grid-cols-2 gap-8">
                      <div className="flex flex-col gap-2">
                        <span className="text-slate-500 text-xs font-bold uppercase tracking-widest border-b border-slate-800 pb-2 mb-2">Base Stats</span>
                        <div className="text-sm text-slate-300 flex justify-between"><span>Damage</span> <span className="text-white font-mono">{gameStateRef.current.playerStats.damage.toFixed(1)}</span></div>
                        <div className="text-sm text-slate-300 flex justify-between"><span>Fire Rate</span> <span className="text-white font-mono">{(gameStateRef.current.playerStats.attackSpeed).toFixed(1)}/s</span></div>
                        <div className="text-sm text-slate-300 flex justify-between"><span>Speed</span> <span className="text-white font-mono">{Math.floor(gameStateRef.current.playerStats.moveSpeed)}</span></div>
                        <div className="text-sm text-slate-300 flex justify-between"><span>Crit Chance</span> <span className="text-white font-mono">{Math.floor(gameStateRef.current.playerStats.baseCritChance * 100)}%</span></div>
                        <div className="text-sm text-slate-300 flex justify-between"><span>Crit Multiplier</span> <span className="text-white font-mono">x{gameStateRef.current.playerStats.baseCritMultiplier.toFixed(1)}</span></div>
                        <div className="text-sm text-slate-300 flex justify-between"><span>Projectiles</span> <span className="text-white font-mono">{1 + gameStateRef.current.playerStats.multiShot}</span></div>
                        <div className="text-sm text-slate-300 flex justify-between"><span>Pierce</span> <span className="text-white font-mono">{gameStateRef.current.playerStats.pierce}</span></div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <span className="text-slate-500 text-xs font-bold uppercase tracking-widest border-b border-slate-800 pb-2 mb-2">Active Modules</span>
                        {upgradesState.filter(u => u.level > 0).map(u => (
                          <div key={u.id} className="text-sm text-slate-300 flex justify-between"><span>{u.name}</span> <span className="text-emerald-400 font-mono">Lv.{u.level}</span></div>
                        ))}
                        {upgradesState.filter(u => u.level > 0).length === 0 && <span className="text-sm text-slate-600 italic">No modules installed</span>}
                      </div>
                    </div>
                 </div>
               </motion.div>
            )}

            {isLevelingUp && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xl p-4 sm:p-6"
              >
                <motion.div 
                  initial={{ y: -20, scale: 0.9 }}
                  animate={{ y: 0, scale: 1 }}
                  className="flex items-center gap-3 mb-6"
                >
                  <ArrowUpCircle className="w-8 h-8 text-cyan-400" />
                  <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400 uppercase tracking-tight">
                    System Upgrade
                  </h2>
                </motion.div>

                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-4xl">
                  {choices.map((upgrade, index) => (
                    <motion.button
                      key={upgrade.id}
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => selectUpgrade(upgrade.id)}
                      className={`flex-1 flex flex-col p-5 rounded-2xl bg-slate-900 border-2 text-left group transition-all duration-300 shadow-xl ${getRarityColor(upgrade.rarity)} hover:bg-slate-800 active:scale-95`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-slate-950/50">
                          {upgrade.rarity}
                        </span>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs font-mono text-slate-400">
                            LVL {upgrade.level + 1}
                          </span>
                          {upgrade.prerequisites && upgrade.prerequisites.length > 0 && (
                            <span className="text-[9px] font-bold text-amber-500/80 uppercase bg-amber-500/10 px-1 rounded border border-amber-500/20">
                              Evolution
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <h3 className="text-lg font-bold text-white mb-2 leading-tight">{upgrade.name}</h3>
                      <p className="text-slate-400 text-sm leading-relaxed mb-4 flex-1">
                        {upgrade.description}
                      </p>
                      
                      <div className="w-full py-2.5 bg-slate-950/50 text-center rounded-xl font-bold group-hover:bg-white/10 transition-colors text-sm">
                        ACQUIRE
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {isChestOpen && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4 sm:p-6"
              >
                <motion.div 
                  initial={{ y: -20, scale: 0.8 }}
                  animate={{ y: 0, scale: 1 }}
                  className="flex flex-col items-center gap-3 mb-8"
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-amber-400 blur-xl opacity-50 rounded-full animate-pulse"></div>
                    <div className="w-16 h-12 bg-amber-500 rounded-lg border-2 border-amber-300 flex items-center justify-center relative z-10 shadow-[0_0_30px_rgba(251,191,36,0.6)]">
                      <div className="w-4 h-2 bg-slate-900 rounded-sm"></div>
                    </div>
                  </div>
                  <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500 uppercase tracking-tight mt-2">
                    Loot Extracted
                  </h2>
                </motion.div>

                <div className="flex flex-col sm:flex-row justify-center gap-4 w-full max-w-4xl mb-8">
                  {chestChoices.map((upgrade, index) => (
                    <motion.div
                      key={upgrade.id}
                      initial={{ opacity: 0, y: 50, rotateX: 90 }}
                      animate={{ opacity: 1, y: 0, rotateX: 0 }}
                      transition={{ delay: 0.5 + index * 0.2, type: 'spring' }}
                      className={`flex-1 flex flex-col p-5 rounded-2xl bg-slate-900 border-2 text-center shadow-xl ${getRarityColor(upgrade.rarity)}`}
                    >
                      <div className="flex justify-center mb-3">
                        <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-slate-950/80">
                          {upgrade.rarity}
                        </span>
                      </div>
                      
                      <h3 className="text-xl font-black text-white mb-2 leading-tight">{upgrade.name}</h3>
                      <p className="text-slate-400 text-sm leading-relaxed mb-4 flex-1">
                        {upgrade.description}
                      </p>
                      
                      <span className="text-xs font-mono text-slate-500">
                        LVL {upgrade.level + 1}
                      </span>
                    </motion.div>
                  ))}
                </div>

                <motion.button 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.5 }}
                  onClick={collectChestRewards}
                  className="bg-amber-500 text-amber-950 px-12 py-4 rounded-full font-black text-xl hover:bg-amber-400 hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(251,191,36,0.4)] tracking-widest"
                >
                  COLLECT
                </motion.button>
              </motion.div>
            )}

            {isGameOver && runSummary && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md p-6 pointer-events-auto"
              >
                <h2 className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-red-500 to-rose-700 mb-6 tracking-tighter text-center">
                  CORE DESTROYED
                </h2>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-3xl mb-8">
                  <StatCard title="Time Survived" value={formatTime(runSummary.time)} isNewRecord={runSummary.isNewTimeRecord} prevBest={formatTime(runSummary.prevTime)} />
                  <StatCard title="Level Reached" value={runSummary.level} isNewRecord={runSummary.isNewLevelRecord} prevBest={runSummary.prevLevel} />
                  <StatCard title="Enemies Defeated" value={runSummary.kills} isNewRecord={runSummary.isNewKillsRecord} prevBest={runSummary.prevKills} />
                  <StatCard title="Max Combo" value={`${runSummary.maxCombo}x`} isNewRecord={runSummary.isNewComboRecord} prevBest={`${runSummary.prevCombo}x`} />
                </div>

                <div className="flex flex-col items-center mb-10">
                   <p className="text-emerald-500/70 text-sm font-bold uppercase tracking-widest mb-1">Nanites Extracted</p>
                   <p className="text-4xl font-black text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">+{runSummary.earnedNanites}</p>
                </div>

                <button 
                  onClick={restartGame}
                  className="group flex items-center justify-center gap-3 bg-white hover:bg-cyan-400 text-slate-950 px-8 py-4 rounded-full font-black text-lg transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_40px_rgba(34,211,238,0.5)] w-full max-w-xs mb-4"
                >
                  <RefreshCw className="w-6 h-6 group-hover:-rotate-180 transition-transform duration-700" />
                  REBOOT
                </button>
                <button 
                  onClick={() => setView('hub')}
                  className="group relative flex items-center justify-center gap-3 bg-slate-900 text-emerald-400 px-8 py-4 rounded-full font-black text-lg transition-all hover:bg-slate-800 active:scale-95 border border-emerald-500/30 w-full max-w-xs"
                >
                  {hubNotification && (
                    <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-slate-950 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                  )}
                  <Cpu className="w-6 h-6" />
                  SPEND NANITES
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
