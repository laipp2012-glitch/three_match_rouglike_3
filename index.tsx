import React, { useState, useEffect, useCallback, useRef, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { GRID_SIZE, ATTACK_INTERVAL, ENRAGE_CYCLES, MANA_MAX, ENEMIES, PERKS, EMOJI_COLORS, SKILL_DATA } from './constants';
import { createInitialGrid, cloneGrid, findMatches, areAdjacent, getAffectedPositions, createTile, getRandomEmoji, loadAssets } from './utils';
import { FloatingCombatText, UltimateEffect, ParticleSystem, Stats, Board, Emoji } from './components';

// --- Main Application Component ---
const App = () => {
  const [view, setView] = useState('loading'); // Changed initial state to loading
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [grid, setGrid] = useState(createInitialGrid);
  const [selected, setSelected] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [activeUltimate, setActiveUltimate] = useState(null);
  const [effects, setEffects] = useState([]); 
  const [floatingTexts, setFloatingTexts] = useState([]);
  const [gameState, setGameState] = useState({
      floor: 1, playerHp: 100, playerMaxHp: 100, moves: ATTACK_INTERVAL,
      enemyHp: ENEMIES[0].hp, maxEnemyHp: ENEMIES[0].hp,
      activePerks: [], mana: { '🍎': 0, '🍌': 0, '🍇': 0 },
      attackCycleCount: 0
  });
  const comboRef = useRef(0);
  const gameStateRef = useRef(gameState);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Asset Preloading
  useEffect(() => {
    const init = async () => {
        await loadAssets((percent) => setLoadingProgress(percent));
        // Small delay to let the UI breathe
        setTimeout(() => setView('start'), 500);
    };
    init();
  }, []);

  const currentEnemy = ENEMIES[(gameState.floor - 1) % ENEMIES.length];
  const isEnraged = gameState.attackCycleCount >= ENRAGE_CYCLES;
  const currentMaxMoves = isEnraged ? Math.ceil(ATTACK_INTERVAL / 2) : ATTACK_INTERVAL;
  const getPerkCount = (id) => gameState.activePerks.filter(p => p === id).length;

  const addFloatingText = useCallback((text, x, y, color) => {
    setFloatingTexts(prev => [...prev, { id: Math.random(), text, x, y, color }]);
  }, []);

  const triggerParticles = (r, c, emoji) => {
    return {
      id: Math.random(),
      x: (c * 12.5) + 6.25, 
      y: (r * 12.5) + 6.25,
      color: EMOJI_COLORS[emoji] || '#fff'
    };
  };

  const applyEnemyAbility = (targetGrid, enemy) => {
    const flatIndices = [];
    for(let r=0; r<GRID_SIZE; r++) for(let c=0; c<GRID_SIZE; c++) {
      if(targetGrid[r][c].emoji !== '' && targetGrid[r][c].emoji !== '🪨') flatIndices.push({r,c});
    }

    const getRandomTiles = (count) => {
      const selected = [];
      for(let i=0; i<count; i++) {
        if(flatIndices.length === 0) break;
        const idx = Math.floor(Math.random() * flatIndices.length);
        selected.push(flatIndices[idx]);
        flatIndices.splice(idx, 1);
      }
      return selected;
    };

    if (enemy.abilityId === 'slime') { // Sticky
      getRandomTiles(6).forEach(({r, c}) => {
        targetGrid[r][c].isSticky = true;
        addFloatingText("Слизь!", (c*12.5)+5, (r*12.5)+5, '#84cc16');
      });
    } else if (enemy.abilityId === 'ghost') { // Hidden
      getRandomTiles(6).forEach(({r, c}) => {
        targetGrid[r][c].isHidden = true;
        addFloatingText("Туман", (c*12.5)+5, (r*12.5)+5, '#6366f1');
      });
    } else if (enemy.abilityId === 'gargoyle') { // Stone
      getRandomTiles(3).forEach(({r, c}) => {
        targetGrid[r][c].emoji = '🪨';
        targetGrid[r][c].modifier = 'none';
        targetGrid[r][c].isSticky = false;
        targetGrid[r][c].isHidden = false;
        targetGrid[r][c].isBurning = false;
        addFloatingText("Камень!", (c*12.5)+5, (r*12.5)+5, '#94a3b8');
      });
    } else if (enemy.abilityId === 'demon') { // Burning
      getRandomTiles(4).forEach(({r, c}) => {
        targetGrid[r][c].isBurning = true;
        addFloatingText("Ожог!", (c*12.5)+5, (r*12.5)+5, '#ef4444');
      });
    } else if (enemy.abilityId === 'dragon') { // Mana Burn
      setGameState(prev => ({
        ...prev,
        mana: { '🍎': prev.mana['🍎']*0.5, '🍌': prev.mana['🍌']*0.5, '🍇': prev.mana['🍇']*0.5 }
      }));
      addFloatingText("Мана сожжена!", 50, 50, '#ef4444');
    }
  };

  const processTurn = useCallback(async (currentGrid, isFirstPass = false) => {
    if (isFirstPass) comboRef.current = 0;
    
    const matches = findMatches(currentGrid);
    if (matches.length === 0) {
      setIsAnimating(false);
      return false;
    }
    
    comboRef.current++;
    setIsAnimating(true);
    let nextGrid = cloneGrid(currentGrid);
    let newEffects = [];

    let positionsToClear = new Set<string>();
    let bonusesToCreate = [];
    let explosionTiles = new Set();

    // --- NEW MATCH CLUSTERING LOGIC ---
    // 1. Map tiles to matches to find intersections
    const tileToMatchIds: Record<string, number[]> = {};
    matches.forEach((m, idx) => {
        m.tiles.forEach(t => {
            const key = `${t.row},${t.col}`;
            if (!tileToMatchIds[key]) tileToMatchIds[key] = [];
            tileToMatchIds[key].push(idx);
        });
    });

    // 2. Group intersecting matches (BFS)
    const processedMatchIds = new Set<number>();
    const matchGroups: typeof matches[] = [];

    matches.forEach((_, idx) => {
        if (processedMatchIds.has(idx)) return;
        const group: typeof matches = [];
        const queue = [idx];
        processedMatchIds.add(idx);

        while(queue.length > 0) {
            const curr = queue.shift()!;
            group.push(matches[curr]);
            
            // Add all connected matches
            matches[curr].tiles.forEach(t => {
                const key = `${t.row},${t.col}`;
                tileToMatchIds[key].forEach(nIdx => {
                    if (!processedMatchIds.has(nIdx)) {
                        processedMatchIds.add(nIdx);
                        queue.push(nIdx);
                    }
                });
            });
        }
        matchGroups.push(group);
    });

    // 3. Process each group to determine bonus
    matchGroups.forEach(group => {
        const uniqueTilesMap = new Map<string, {row: number, col: number}>();
        let maxLineLength = 0;
        
        // Stats for the group
        group.forEach(m => {
            if (m.tiles.length > maxLineLength) maxLineLength = m.tiles.length;
            m.tiles.forEach(t => uniqueTilesMap.set(`${t.row},${t.col}`, t));
        });

        const uniqueTiles = Array.from(uniqueTilesMap.values());
        
        // Mark for clearing
        uniqueTiles.forEach(t => positionsToClear.add(`${t.row},${t.col}`));

        // Bonus Logic:
        // Priority 1: 5+ in a straight line -> Star
        // Priority 2: 5+ total tiles but NOT straight (L-shape, T-shape) -> Lightning
        // Priority 3: 4 in straight line -> Fire
        
        let bonusType = null;
        if (maxLineLength >= 5) {
            bonusType = 'star';
        } else if (uniqueTiles.length >= 5) {
            bonusType = 'lightning';
        } else if (maxLineLength === 4) {
            bonusType = 'fire';
        }

        if (bonusType) {
            // Determine best spawn position
            let target = uniqueTiles[0];
            
            // Try to find the intersection tile (appears in >1 matches)
            if (group.length > 1) {
                const counts: Record<string, number> = {};
                group.forEach(m => m.tiles.forEach(t => {
                     const k = `${t.row},${t.col}`;
                     counts[k] = (counts[k] || 0) + 1;
                }));
                const intersection = uniqueTiles.find(t => counts[`${t.row},${t.col}`] > 1);
                if (intersection) target = intersection;
            }
            
            bonusesToCreate.push({ ...target, type: bonusType });
        }
    });
    // ----------------------------------
    
    let queue = Array.from(positionsToClear).map(s => { const [r,c]=s.split(','); return {row: +r, col: +c}; });
    while(queue.length > 0) {
      const p = queue.shift();
      const tile = currentGrid[p.row]?.[p.col];
      // Allow explosions to propagate through stones or sticky tiles if triggered by a bonus
      if(tile && tile.modifier !== 'none') {
          const affected = getAffectedPositions(p.row, p.col, tile.modifier, tile.emoji, currentGrid);
          affected.forEach(ap => {
              const key = `${ap.row},${ap.col}`;
              if(!positionsToClear.has(key)) {
                  positionsToClear.add(key);
                  queue.push(ap);
                  if(tile.modifier === 'fire') explosionTiles.add(key);
              }
          })
      }
    }
    
    const finalClear = Array.from(positionsToClear).map(s => { const [r, c] = s.split(','); return { row: +r, col: +c }; });

    const pyroCount = getPerkCount('pyro');
    const luckyCount = getPerkCount('lucky');
    const muscleCount = getPerkCount('muscle');
    
    const critChance = 0.1 + luckyCount * 0.15;
    const critMultiplier = 1.5 + luckyCount * 0.5;

    // Damage Scaling Formula
    const baseTileDamage = 10 + (gameState.floor * 2) + (muscleCount * 3);

    let turnDamage = 0, hadCrit = false, burnDamage = 0;
    
    finalClear.forEach(p => {
      const tile = currentGrid[p.row][p.col];
      
      // Burning tile logic
      if (tile.isBurning) {
        burnDamage += 5;
      }

      let baseDmg = baseTileDamage;
      if (explosionTiles.has(`${p.row},${p.col}`)) baseDmg *= Math.pow(2, pyroCount);
      if (Math.random() < critChance) { baseDmg *= critMultiplier; hadCrit = true; }
      turnDamage += baseDmg;
    });

    // Apply burn damage
    if (burnDamage > 0) {
      setGameState(prev => ({...prev, playerHp: Math.max(0, prev.playerHp - burnDamage)}));
      addFloatingText(`ОЖОГ -${burnDamage}`, 50, 70, '#ef4444');
    }

    const finalDamage = Math.round(turnDamage * (1 + (comboRef.current - 1) * 0.3));
    if (hadCrit) addFloatingText("CRIT!", 50, 30, '#facc15');
    if (comboRef.current > 1) addFloatingText(`COMBO x${comboRef.current}!`, 50, 40, '#a855f7');
    addFloatingText(`-${finalDamage}`, 50, 20, hadCrit ? '#fbbf24' : '#ef4444');

    setGameState(prev => {
      const next = { ...prev };
      next.enemyHp = Math.max(0, prev.enemyHp - finalDamage);
      
      // OLD VAMPIRE LOGIC REMOVED FROM HERE
      
      finalClear.forEach(p => {
        const tile = currentGrid[p.row]?.[p.col];
        if (tile && ['🍎', '🍌', '🍇'].includes(tile.emoji)) {
          next.mana[tile.emoji] = Math.min(MANA_MAX, (prev.mana[tile.emoji] || 0) + 5.0);
        }
      });
      return next;
    });

    finalClear.forEach(p => {
      const tile = currentGrid[p.row]?.[p.col];
      if (tile?.emoji && tile.emoji !== '🪨') newEffects.push(triggerParticles(p.row, p.col, tile.emoji));
      nextGrid[p.row][p.col] = { id: Math.random(), emoji: '', modifier: 'none' };
    });
    bonusesToCreate.forEach(b => { nextGrid[b.row][b.col] = createTile(getRandomEmoji(), b.type); });
    setEffects(prev => [...prev, ...newEffects]);
    setGrid(nextGrid);
    await new Promise(res => setTimeout(res, 500));

    for (let c = 0; c < GRID_SIZE; c++) {
      let emptyCount = 0;
      for (let r = GRID_SIZE - 1; r >= 0; r--) {
        if (nextGrid[r][c].emoji === '') emptyCount++;
        else if (emptyCount > 0) {
          nextGrid[r + emptyCount][c] = nextGrid[r][c];
          nextGrid[r][c] = { id: Math.random(), emoji: '', modifier: 'none' };
        }
      }
      for (let r = 0; r < emptyCount; r++) nextGrid[r][c] = createTile();
    }
    setGrid(cloneGrid(nextGrid));
    await new Promise(res => setTimeout(res, 400));

    await processTurn(nextGrid);
    return true;

  }, [addFloatingText, getPerkCount, gameState.floor]); 
  
  const useSkill = useCallback(async (type) => {
    if (isAnimating || gameState.mana[type] < MANA_MAX) return;
    setIsAnimating(true);
    
    setActiveUltimate(type);
    await new Promise(r => setTimeout(r, 500));

    setGameState(prev => ({...prev, mana: {...prev.mana, [type]: 0}}));

    if (type === '🍎') {
      // 15% of Max HP + scaling flat damage
      const dmg = Math.floor(gameState.maxEnemyHp * 0.15) + (gameState.floor * 50);
      addFloatingText(`ЯРОСТЬ -${dmg}`, 50, 20, "#ef4444");

      // NEW VAMPIRE LOGIC: Heal based on Vampire Perk count
      const vampireCount = getPerkCount('vampire');
      let healAmount = 0;
      if (vampireCount > 0) {
          // 5% Max HP per stack
          const healPercent = 0.05 * vampireCount;
          healAmount = Math.floor(gameState.playerMaxHp * healPercent);
      }

      setGameState(prev => ({
          ...prev, 
          enemyHp: Math.max(0, prev.enemyHp - dmg),
          playerHp: Math.min(prev.playerMaxHp, prev.playerHp + healAmount)
      }));

      if (healAmount > 0) {
          // Add delay so it pops after damage text
          setTimeout(() => addFloatingText(`+${healAmount} HP`, 50, 40, "#4ade80"), 300);
      }

    } else if (type === '🍌') {
      // Heal 35% of max HP
      const heal = Math.floor(gameState.playerMaxHp * 0.35);
      addFloatingText(`+${heal} HP`, 50, 80, "#4ade80");
      setGameState(prev => ({...prev, playerHp: Math.min(prev.playerMaxHp, prev.playerHp + heal)}));
    } else if (type === '🍇') {
      if (Math.random() < 0.3) {
        addFloatingText("ПРОВАЛ!", 50, 80, "#ef4444");
        setGameState(prev => ({...prev, playerHp: Math.max(0, prev.playerHp - 40)}));
      } else {
        addFloatingText("УДАЧА!", 50, 50, "#a855f7");
        const newGrid = cloneGrid(grid);
        for (let i = 0; i < 4; i++) {
          const r = Math.floor(Math.random() * GRID_SIZE), c = Math.floor(Math.random() * GRID_SIZE);
          newGrid[r][c].modifier = ['fire', 'lightning', 'star'][Math.floor(Math.random() * 3)];
        }
        setGrid(newGrid);
        await new Promise(r => setTimeout(r, 600));
        await processTurn(newGrid, true);
        setIsAnimating(false); return;
      }
    }
    setIsAnimating(false);
  }, [isAnimating, gameState, grid, addFloatingText, processTurn, getPerkCount]);

  const handleTileClick = useCallback(async (r, c) => {
    if (isAnimating || view !== 'playing') return;
    
    // Validate Stone or Sticky
    const targetTile = grid[r][c];
    if (targetTile.emoji === '🪨') {
      addFloatingText("Камень!", (c*12.5)+5, (r*12.5)+5, '#94a3b8');
      return;
    }
    if (targetTile.isSticky) {
      addFloatingText("Прилипло!", (c*12.5)+5, (r*12.5)+5, '#84cc16');
      return; 
    }

    if (!selected) { setSelected({ row: r, col: c }); return; }
    
    // Check if selected is sticky
    if (grid[selected.row][selected.col].isSticky) {
       addFloatingText("Прилипло!", (selected.col*12.5)+5, (selected.row*12.5)+5, '#84cc16');
       setSelected(null);
       return;
    }

    if (areAdjacent(selected, { row: r, col: c })) {
      const tempGrid = cloneGrid(grid);
      [tempGrid[selected.row][selected.col], tempGrid[r][c]] = [tempGrid[r][c], tempGrid[selected.row][selected.col]];
      setSelected(null);
      setGrid(tempGrid);

      const matched = await processTurn(tempGrid, true);
      if (matched) {
        setGameState(prev => {
          const nextMoves = prev.moves - 1;
          // Trigger attack ONLY if moves <= 0 AND enemy is still alive (hp > 0)
          if (nextMoves <= 0 && prev.enemyHp > 0) {
            // ENEMY ATTACK PHASE
            
            // Calculate Enrage State
            const currentCycles = prev.attackCycleCount;
            const isNowEnraged = currentCycles >= ENRAGE_CYCLES;
            
            const damageMult = isNowEnraged ? 2 : 1;
            const finalDamage = currentEnemy.damage * damageMult;

            addFloatingText(isNowEnraged ? `CRITICAL -${finalDamage}` : `-${finalDamage}`, 50, 80, "#ef4444");
            if (isNowEnraged) addFloatingText("ЯРОСТЬ!", 50, 70, "#f87171");

            // Update cycles
            const nextCycles = currentCycles + 1;
            
            // Next interval depends on if we WILL be enraged for the next turn
            // If we just hit 3 cycles (nextCycles = 3), the NEXT turn is fast.
            const nextIsEnraged = nextCycles >= ENRAGE_CYCLES;
            const nextInterval = nextIsEnraged ? Math.ceil(ATTACK_INTERVAL / 2) : ATTACK_INTERVAL;
            
            const currentFloor = prev.floor;
            // Trigger Ability
            setTimeout(() => {
                // GUARD CLAUSE: Do not apply ability if the enemy is dead or the floor has changed
                if (gameStateRef.current.enemyHp <= 0 || gameStateRef.current.floor !== currentFloor) return;

                setGrid(prevGrid => {
                    const g = cloneGrid(prevGrid);
                    applyEnemyAbility(g, currentEnemy);
                    return g;
                });
            }, 500); 

            return {
                ...prev, 
                playerHp: Math.max(0, prev.playerHp - finalDamage), 
                moves: nextInterval,
                attackCycleCount: nextCycles
            };
          }
          return {...prev, moves: nextMoves};
        });
      } else {
        setTimeout(() => setGrid(grid), 250);
      }
    } else {
      setSelected({ row: r, col: c });
    }
  }, [grid, selected, isAnimating, view, currentEnemy, processTurn, addFloatingText]);

  const addPerk = (perkId) => {
    const nextFloor = gameState.floor + 1;
    const enemy = ENEMIES[(nextFloor - 1) % ENEMIES.length];
    
    // Progressive Scaling Logic:
    // Base scaling multiplier increases by 0.5 per floor.
    // Flat bonus increases by 200 per floor to ensure late-game enemies are significantly tougher, 
    // effectively mitigating the "reset" feeling when cycling back to the first enemy type.
    const scaledHp = Math.round(enemy.hp * (1 + (nextFloor - 1) * 0.5) + ((nextFloor - 1) * 200));

    // No specific maxHP boost for tanks anymore, all scaling is passive or via other means
    const newMaxHp = gameState.playerMaxHp;
    const newHp = gameState.playerHp;

    setGameState({
      floor: nextFloor,
      playerHp: newHp, playerMaxHp: newMaxHp,
      enemyHp: scaledHp, maxEnemyHp: scaledHp,
      moves: ATTACK_INTERVAL,
      activePerks: [...gameState.activePerks, perkId],
      mana: { '🍎': 0, '🍌': 0, '🍇': 0 },
      attackCycleCount: 0
    });
    setEffects([]);
    setFloatingTexts([]);
    setGrid(createInitialGrid());
    setView('playing');
  };
  
  const startGame = () => {
    const firstEnemy = ENEMIES[0];
    setGameState({
      floor: 1, playerHp: 100, playerMaxHp: 100, moves: ATTACK_INTERVAL,
      enemyHp: firstEnemy.hp, maxEnemyHp: firstEnemy.hp,
      activePerks: [], mana: { '🍎': 0, '🍌': 0, '🍇': 0 },
      attackCycleCount: 0
    });
    setEffects([]);
    setFloatingTexts([]);
    setGrid(createInitialGrid());
    setView('playing');
  };

  useEffect(() => {
    if (gameState.enemyHp <= 0 && view === 'playing') {
      // Create boss explosion particles
      const color = EMOJI_COLORS[currentEnemy.emoji] || '#ef4444';
      const explosionCount = 8;
      const newEffects = [];
      for(let i=0; i<explosionCount; i++) {
           newEffects.push({
               id: Math.random(),
               // Random spread around top-right area (approx boss position)
               x: 82 + (Math.random() * 10 - 5), 
               y: 12 + (Math.random() * 10 - 5),
               color: color
           });
      }
      setEffects(prev => [...prev, ...newEffects]);

      const t = setTimeout(() => setView('reward'), 2000); // 2s delay for explosion
      return () => clearTimeout(t);
    }
    if (gameState.playerHp <= 0 && view === 'playing') setView('gameOver');
  }, [gameState.enemyHp, gameState.playerHp, view, currentEnemy]);

  // --- LOADING SCREEN ---
  if (view === 'loading') return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] p-4 bg-slate-900 text-white">
      <div className="w-16 h-16 sm:w-20 sm:h-20 mb-4 animate-bounce">
         {/* Simple fallback spinner/emoji while actual assets load */}
         <div className="text-6xl">⏳</div>
      </div>
      <h2 className="text-2xl font-black mb-2 tracking-widest">LOADING ASSETS</h2>
      <div className="w-64 h-3 bg-slate-800 rounded-full overflow-hidden border border-white/10">
        <div 
            className="h-full bg-indigo-500 transition-all duration-200 ease-out" 
            style={{ width: `${loadingProgress}%` }} 
        />
      </div>
      <div className="mt-2 text-xs text-slate-500 font-mono">{loadingProgress}%</div>
    </div>
  );

  if (view === 'start') return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] p-4 sm:p-6 text-center">
      <h1 className="text-5xl sm:text-7xl font-black mb-4 tracking-tighter bg-gradient-to-br from-indigo-400 to-purple-600 bg-clip-text text-transparent">EMOJI ROGUE</h1>
      <p className="text-slate-400 mb-8 sm:mb-12 text-sm sm:text-lg italic uppercase tracking-widest">Уничтожай. Собирай. Выживай.</p>
      <button onClick={startGame} className="px-10 py-4 sm:px-16 sm:py-5 bg-indigo-600 rounded-3xl font-black text-xl sm:text-2xl shadow-2xl hover:bg-indigo-500 transition-all active:scale-95">ИГРАТЬ</button>
    </div>
  );

  // Combine Game, Reward and GameOver in one render tree to allow overlays
  const isReward = view === 'reward';
  const isGameOver = view === 'gameOver';
  const isBossDead = gameState.enemyHp <= 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] p-2 sm:p-4 select-none relative overflow-hidden">
      <div className={`w-full max-w-md transition-all duration-700 ease-out ${isReward || isGameOver ? 'blur-md scale-95 opacity-60 brightness-50 grayscale-50' : ''}`}>
        <div className="w-full bg-slate-900/80 backdrop-blur-3xl border border-white/10 rounded-3xl sm:rounded-[3rem] p-4 sm:p-6 shadow-2xl relative">
          
          {/* Clipping Container for Particles & Effects */}
          <div className="absolute inset-0 rounded-3xl sm:rounded-[3rem] overflow-hidden pointer-events-none z-0">
             <ParticleSystem effects={effects} onClear={() => setEffects([])} />
             {activeUltimate && <UltimateEffect type={activeUltimate} onComplete={() => setActiveUltimate(null)} />}
          </div>

          <FloatingCombatText texts={floatingTexts} onComplete={(id) => setFloatingTexts(prev => prev.filter(t => t.id !== id))} />
          
          <div className="flex justify-between items-end mb-4 relative z-10">
            <div>
              <div className="text-[9px] sm:text-[10px] uppercase font-black text-slate-500 tracking-widest mb-1">Этаж {gameState.floor}</div>
              <div className="text-xl sm:text-2xl font-black">{currentEnemy.name}</div>
              <div className="text-[9px] sm:text-[10px] text-red-400 font-bold uppercase mt-1">{currentEnemy.ability}</div>
              {isEnraged && <div className="text-[10px] sm:text-xs font-black text-red-500 animate-pulse mt-1 tracking-widest border border-red-500/50 rounded px-1 inline-block bg-red-950/50">🔥 ЯРОСТЬ 🔥</div>}
            </div>
            {/* Boss Animation: Explode/Die if isBossDead, else Bounce/Pulse */}
            <div className={`w-16 h-16 sm:w-20 sm:h-20 drop-shadow-2xl transition-all duration-[2000ms] ease-out
                ${isBossDead ? 'scale-[2] opacity-0 rotate-45 filter grayscale blur-sm' : (isEnraged ? 'scale-125 animate-pulse' : 'animate-bounce')}`}>
              <Emoji emoji={currentEnemy.emoji} className="w-full h-full" />
            </div>
          </div>
          <div className="w-full h-4 sm:h-5 bg-slate-800 rounded-full mb-4 sm:mb-8 overflow-hidden border border-white/5 relative z-10 flex items-center shadow-inner">
            <div className="h-full bg-gradient-to-r from-red-600 to-orange-500 transition-all duration-500" style={{width: `${(gameState.enemyHp/gameState.maxEnemyHp)*100}%`}} />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[9px] sm:text-[11px] font-black text-white">{Math.ceil(gameState.enemyHp)} / {Math.ceil(gameState.maxEnemyHp)}</div>
          </div>
          
          <Board grid={grid} onTileClick={handleTileClick} selectedTile={selected} />
          
          <div className="mb-4 sm:mb-6 grid grid-cols-3 gap-2 relative z-10">
              {(['🍎', '🍌', '🍇']).map(type => {
                  const info = SKILL_DATA[type];
                  const isReady = gameState.mana[type] >= MANA_MAX;
                  const widthPct = (gameState.mana[type]/MANA_MAX)*100;
                  return (
                    <button key={type} disabled={!isReady || isAnimating} onClick={() => useSkill(type)}
                      className={`h-20 sm:h-24 rounded-2xl border border-white/10 flex flex-col items-center justify-center transition-all relative overflow-hidden group ${isReady ? 'bg-indigo-600 scale-105 shadow-xl brightness-125 ring-2 ring-white/20' : 'bg-slate-800/80 opacity-60 grayscale'}`}>
                        <div className="absolute bottom-0 left-0 h-1 bg-white/40 transition-all" style={{width: `${widthPct}%`}} />
                        <div className="flex flex-col items-center text-center px-1 relative z-10">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 group-active:scale-125 transition-transform mb-1">
                            <Emoji emoji={type} className="w-full h-full" />
                          </div>
                          <span className={`text-[8px] sm:text-[10px] font-black uppercase ${info.color}`}>{info.title}</span>
                          <span className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase hidden sm:block">{info.desc}</span>
                        </div>
                    </button>
                  );
              })}
          </div>

          {gameState.activePerks.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2 px-1 relative z-20">
              {Array.from(new Set(gameState.activePerks)).map((perkId) => {
                const perk = PERKS.find(p => p.id === perkId);
                const count = getPerkCount(perkId);
                return (
                  <div key={perk.id} className="relative group cursor-help">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-800 border border-white/10 rounded-lg sm:rounded-xl flex items-center justify-center p-1 shadow-lg group-hover:border-indigo-500/50 transition-colors">
                      <Emoji emoji={perk.icon} className="w-full h-full" />
                      {count > 1 && <span className="absolute -bottom-1 -right-1 bg-indigo-600 text-[8px] text-white font-black px-1 rounded-md border border-white/20">x{count}</span>}
                    </div>
                    {/* Tooltip */}
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 w-48 sm:w-64 bg-slate-900/95 backdrop-blur-xl border border-white/20 p-3 sm:p-4 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[100] scale-95 group-hover:scale-100 origin-left">
                        <div className="text-xs sm:text-sm font-black text-indigo-300 uppercase mb-1 text-center tracking-wide">{perk.name}</div>
                        <div className="text-[10px] sm:text-xs text-slate-200 text-center leading-relaxed whitespace-normal">{perk.desc}</div>
                        {/* Arrow */}
                        <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-slate-900/95"></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          <Stats playerHp={gameState.playerHp} playerMaxHp={gameState.playerMaxHp} moves={gameState.moves} attackInterval={currentMaxMoves} />
        </div>
      </div>

      {/* REWARD POPUP OVERLAY */}
      {isReward && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 modal-anim">
           <div className="bg-slate-900/90 border border-white/20 rounded-[2rem] p-6 sm:p-8 shadow-2xl w-full max-w-sm text-center backdrop-blur-xl">
              <div className="mb-4 w-20 h-20 mx-auto animate-bounce">
                <Emoji emoji="🎁" className="w-full h-full" />
              </div>
              <h2 className="text-3xl font-black mb-2 uppercase text-white tracking-widest">ПОБЕДА!</h2>
              <p className="text-slate-400 mb-6 text-sm">Выберите благословение:</p>
              <div className="space-y-3">
                {PERKS.map(perk => (
                  <button key={perk.id} onClick={() => addPerk(perk.id)} 
                    className="w-full bg-slate-800 border border-white/10 p-4 rounded-xl hover:bg-indigo-600 hover:border-indigo-400 hover:scale-105 transition-all text-left group flex items-center gap-4 shadow-lg">
                    <div className="w-10 h-10 shrink-0">
                      <Emoji emoji={perk.icon} className="w-full h-full group-hover:scale-125 transition-transform" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-base">{perk.name}</div>
                      <div className="text-xs text-slate-400 group-hover:text-indigo-100">{perk.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
        </div>
      )}

      {/* GAME OVER OVERLAY */}
      {isGameOver && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 modal-anim">
            <div className="bg-red-950/90 border border-red-500/30 rounded-[2rem] p-8 shadow-2xl w-full max-w-sm text-center backdrop-blur-xl">
              <div className="mb-6 w-24 h-24 mx-auto">
                 <Emoji emoji="💀" className="w-full h-full" />
              </div>
              <h2 className="text-4xl font-black mb-6 uppercase text-white">КОНЕЦ ИГРЫ</h2>
              <button onClick={startGame} className="w-full py-4 bg-white text-red-950 rounded-2xl font-black text-xl hover:scale-105 transition-all shadow-lg">В МЕНЮ</button>
            </div>
          </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root'));
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);