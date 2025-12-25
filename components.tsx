import React, { useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MODIFIER_CLASSES, TILE_BG_COLORS } from './constants';
import { getAssetUrl } from './utils';

// Helper component for rendering 3D Emojis using preloaded assets
export const Emoji = memo(({ emoji, className = "" }: { emoji: string, className?: string }) => {
  const url = getAssetUrl(emoji);
  
  // Fallback to text if asset hasn't loaded (shouldn't happen with preloader) 
  // or if mapping is missing
  if (!url) return <span className={className}>{emoji}</span>;
  
  return (
    <img 
      src={url} 
      alt={emoji} 
      className={`object-contain select-none pointer-events-none ${className}`} 
      draggable={false}
    />
  );
});

export const FloatingCombatText = ({ texts, onComplete }: { texts: any[], onComplete: (id: number) => void }) => (
  <div className="absolute inset-0 pointer-events-none z-[100] overflow-hidden">
    {texts.map(t => (
      <div 
        key={t.id}
        className="combat-text-anim absolute font-black text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] whitespace-nowrap"
        style={{ left: `${t.x}%`, top: `${t.y}%`, color: t.color }}
        onAnimationEnd={() => onComplete(t.id)}
      >
        {t.text}
      </div>
    ))}
  </div>
);

export const UltimateEffect = ({ type, onComplete }: { type: string, onComplete: () => void }) => {
  useEffect(() => {
    const t = setTimeout(onComplete, 600);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <div className="absolute inset-0 z-[80] flex items-center justify-center pointer-events-none">
      <div className="w-64 h-64 ult-anim filter drop-shadow-[0_0_50px_rgba(255,255,255,0.8)] relative z-10">
        <Emoji emoji={type} className="w-full h-full" />
      </div>
    </div>
  );
};

export const ParticleSystem = ({ effects, onClear }: { effects: any[], onClear: () => void }) => {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]); // Stores all active particles across all explosions

  // Add new explosions to the system
  useEffect(() => {
    if (effects.length > 0) {
      effects.forEach(eff => {
        // Generate 12 particles per explosion
        for (let i = 0; i < 12; i++) {
          particlesRef.current.push({
            x: eff.x,
            y: eff.y,
            vx: (Math.random() - 0.5) * 6, // Velocity X (in % of screen)
            vy: (Math.random() - 0.8) * 6, // Velocity Y
            vr: (Math.random() - 0.5) * 30, // Rotation speed
            rotation: Math.random() * 360,
            size: Math.random() * 5 + 3,
            color: eff.color,
            life: 1.0 // Life from 1.0 to 0.0
          });
        }
      });
      // Clear the React state queue immediately so we don't re-process these
      onClear();
    }
  }, [effects, onClear]);

  // The Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationId;
    let lastTime = 0;
    const targetFPS = 90;
    const interval = 1000 / targetFPS;

    const render = (currentTime) => {
      animationId = requestAnimationFrame(render);
      
      if (!lastTime) lastTime = currentTime;
      const deltaTime = currentTime - lastTime;

      if (deltaTime >= interval) {
        lastTime = currentTime - (deltaTime % interval);

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        
        if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
          ctx.scale(dpr, dpr);
        }

        ctx.clearRect(0, 0, rect.width, rect.height);

        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
          const p = particlesRef.current[i];
          
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.95; // Drag
          p.vy = (p.vy * 0.95) + 0.2; // Gravity
          p.rotation += p.vr;
          p.life -= 0.02; // Decay

          if (p.life <= 0) {
            particlesRef.current.splice(i, 1);
            continue;
          }

          ctx.save();
          ctx.globalAlpha = p.life;
          const px = (p.x / 100) * rect.width;
          const py = (p.y / 100) * rect.height;
          
          ctx.translate(px, py);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          
          const size = p.size * (p.life + 0.3);
          ctx.fillRect(-size / 2, -size / 2, size, size);
          ctx.restore();
        }
      }
    };

    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-40 w-full h-full" />;
};

export const Stats = ({ playerHp, playerMaxHp, moves, attackInterval }: { playerHp: number, playerMaxHp: number, moves: number, attackInterval: number }) => (
  <div className="grid grid-cols-2 gap-4">
    <div className="bg-slate-800/40 p-3 sm:p-4 rounded-3xl border border-white/5">
      <div className="text-[9px] sm:text-[10px] uppercase font-black text-slate-500 mb-1">Здоровье</div>
      <div className="text-lg sm:text-xl font-black text-emerald-400">{Math.ceil(playerHp)} HP</div>
      <div className="w-full h-1.5 bg-slate-900 rounded-full mt-2 overflow-hidden">
        <div className="h-full bg-emerald-500 transition-all duration-300" style={{width: `${(playerHp/playerMaxHp)*100}%`}} />
      </div>
    </div>
    <div className="bg-slate-800/40 p-3 sm:p-4 rounded-3xl border border-white/5">
      <div className="text-[9px] sm:text-[10px] uppercase font-black text-slate-500 mb-1">До атаки</div>
      <div className="text-lg sm:text-xl font-black text-indigo-400">{moves} ходов</div>
      <div className="flex gap-1 mt-2">
        {[...Array(attackInterval)].map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i < moves ? 'bg-indigo-500' : 'bg-slate-700'}`} />)}
      </div>
    </div>
  </div>
);

const BoardTile = memo(({ tile, row, col, isSelected, onClick }: { tile: any, row: number, col: number, isSelected: boolean, onClick: (r: number, c: number) => void }) => {
    const mod = MODIFIER_CLASSES[tile.modifier] || MODIFIER_CLASSES.none;
    const isStone = tile.emoji === '🪨';
    const displayEmoji = tile.isHidden ? '❓' : tile.emoji;
    
    // Status visual classes
    const stickyClass = tile.isSticky ? "ring-4 ring-lime-500/80 bg-lime-900/30" : "";
    const burningClass = tile.isBurning ? "ring-4 ring-red-500/80 bg-red-900/40 animate-pulse" : "";
    const stoneClass = isStone ? "bg-slate-700 brightness-75 grayscale" : "";
    const hiddenClass = tile.isHidden ? "bg-indigo-900/50 opacity-90 grayscale" : "";
    
    // Determine background color based on fruit type, fallback to default if not found
    const fruitBg = TILE_BG_COLORS[tile.emoji] || 'bg-white/5';
    
    // Combined background: Status overrides > Stone/Hidden > Fruit Color + Modifier Overlay
    const bgClass = !isStone && !tile.isHidden ? fruitBg : '';
    const combinedClasses = `${stickyClass} ${burningClass} ${stoneClass} ${hiddenClass} ${bgClass} ${!isStone && !tile.isHidden ? mod.bg : ''}`;

    // SAFARI FIX: 
    // We switched from `x/y` (transform) positioning to `left/top` (layout) positioning.
    // iOS Safari has a bug where `transform: translate(100%)` calculates 100% based on the element's current size.
    // If the element is scaled down (scale: 0 or 0.5) during animation, the translation distance becomes 0, stacking all tiles.
    // `left` and `top` percentages are calculated based on the PARENT container width/height, which is stable.
    
    return (
      <motion.div 
        // Initial state: Fall from above (row - 1). 
        // 12.5% is the width/height of one cell (100% / 8 grid size)
        initial={{ 
            opacity: 0, 
            scale: 0.5, 
            left: `${col * 12.5}%`, 
            top: `${(row - 1) * 12.5}%` 
        }}
        // Animate state: target grid position
        animate={{ 
          opacity: 1, 
          scale: isSelected ? 1.15 : 1, 
          left: `${col * 12.5}%`, 
          top: `${row * 12.5}%`,
          zIndex: isSelected ? 30 : 10
        }}
        exit={{ opacity: 0, scale: 0 }}
        transition={{ 
          left: { type: "spring", stiffness: 280, damping: 22 },
          top: { type: "spring", stiffness: 280, damping: 22 },
          scale: { type: "spring", stiffness: 400, damping: 15 },
          opacity: { duration: 0.15 }
        }}
        onClick={() => onClick(row, col)}
        // Removed 'will-change-transform' to avoid confusing the browser optimizer
        className={`absolute w-[12.5%] h-[12.5%] flex items-center justify-center cursor-pointer z-10`}
      >
        {/* Inner Visual Container - Handles the Gap and Appearance */}
        <div className={`w-[92%] h-[92%] flex items-center justify-center rounded-2xl transition-all
          ${isSelected ? 'bg-white/30 ring-4 ring-white shadow-2xl' : `hover:brightness-125`} 
          ${combinedClasses} ${mod.style} ${tile.emoji === '' ? 'pointer-events-none opacity-0' : ''}`}
        >
          
          {/* Main Emoji Content */}
          <div className={`w-[70%] h-[70%] flex items-center justify-center ${tile.modifier !== 'none' ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : ''}`}>
             <Emoji emoji={displayEmoji} className="w-full h-full drop-shadow-sm" />
          </div>
          
          {/* Status Icons */}
          {tile.isSticky && (
            <div className="absolute top-1 left-1 w-4 h-4">
               <Emoji emoji="🦠" className="w-full h-full" />
            </div>
          )}
          {tile.isBurning && (
            <div className="absolute top-1 right-1 w-4 h-4">
               <Emoji emoji="🔥" className="w-full h-full" />
            </div>
          )}

          {mod.icon && !isStone && (
            <>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-black border border-white/20 rounded-full flex items-center justify-center shadow-lg z-20 scale-90">
                <div className="w-[60%] h-[60%] flex items-center justify-center">
                   <Emoji emoji={mod.icon} className="w-full h-full" />
                </div>
              </div>
              {/* Modifier Glint Effect */}
              <div className="absolute inset-0 rounded-2xl opacity-20 pointer-events-none mix-blend-overlay bg-white"></div>
            </>
          )}
        </div>
      </motion.div>
    );
});

export const Board = memo(({ grid, onTileClick, selectedTile }: { grid: any[][], onTileClick: (r: number, c: number) => void, selectedTile: any }) => (
  // We keep the padding on the outer container, but use an inner relative div
  // so that absolute children (tiles) are positioned relative to the content box (respecting padding).
  <div className="w-full aspect-square p-2 bg-black/60 rounded-[2.5rem] border border-white/10 shadow-2xl mb-8 relative overflow-hidden">
    <div className="relative w-full h-full">
      <AnimatePresence>
        {grid.map((row, r) => row.map((tile, c) => (
           <BoardTile key={tile.id || `${r}-${c}`} tile={tile} row={r} col={c} isSelected={selectedTile?.row === r && selectedTile?.col === c} onClick={onTileClick} />
        )))}
      </AnimatePresence>
    </div>
  </div>
));