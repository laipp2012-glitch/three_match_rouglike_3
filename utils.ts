
import { GRID_SIZE, EMOJIS, EMOJI_URLS } from './constants';

// --- ASSET MANAGEMENT ---
// This store holds the generated Blob URLs (internal browser memory links)
export const assetStore: Record<string, string> = {};

export const loadAssets = async (onProgress: (percent: number) => void) => {
  const keys = Object.keys(EMOJI_URLS);
  let loaded = 0;

  const promises = keys.map(async (key) => {
    try {
      const response = await fetch(EMOJI_URLS[key]);
      const blob = await response.blob();
      // Create a local object URL (e.g., blob:http://localhost/...)
      // This allows the image to load instantly from RAM during the game
      assetStore[key] = URL.createObjectURL(blob);
    } catch (e) {
      console.error(`Failed to load asset for ${key}`, e);
      // Fallback: keep it empty or use original URL if fetch fails, 
      // but usually we just want to handle the error gracefully.
    } finally {
      loaded++;
      onProgress(Math.round((loaded / keys.length) * 100));
    }
  });

  await Promise.all(promises);
};

export const getAssetUrl = (emoji: string) => {
  return assetStore[emoji] || null;
};
// ------------------------

export const getRandomEmoji = () => EMOJIS[Math.floor(Math.random() * EMOJIS.length)];

export const createTile = (emoji = getRandomEmoji(), modifier = 'none') => ({
  id: Math.random().toString(36).substr(2, 9),
  emoji,
  modifier,
  isSticky: false,
  isHidden: false,
  isBurning: false
});

export const createInitialGrid = () => {
  // Helper to generate a grid with basic neighbor checks
  const generate = () => {
    let tempGrid = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      tempGrid[r] = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        let emoji;
        // Basic heuristic: Avoid placing 3 identical emojis in a row/col
        do {
          emoji = getRandomEmoji();
        } while (
          (r >= 2 && tempGrid[r - 1][c].emoji === emoji && tempGrid[r - 2][c].emoji === emoji) ||
          (c >= 2 && tempGrid[r][c - 1].emoji === emoji && tempGrid[r][c - 2].emoji === emoji)
        );
        tempGrid[r][c] = createTile(emoji);
      }
    }
    return tempGrid;
  };

  let grid = generate();
  let matches = findMatches(grid);
  let attempts = 0;

  // Rigorous check: Ensure absolutely no matches exist according to the game engine.
  // If the heuristic failed (rare edge cases), regenerate until clean.
  while (matches.length > 0 && attempts < 50) {
    grid = generate();
    matches = findMatches(grid);
    attempts++;
  }

  return grid;
};

export const cloneGrid = (grid) => grid.map(row => row.map(tile => ({ ...tile })));

export const findMatches = (grid) => {
  const matches = [];
  for (let r = 0; r < GRID_SIZE; r++) { // Horizontal
    for (let c = 0; c < GRID_SIZE - 2; c++) {
      if (grid[r][c].emoji && grid[r][c].emoji !== '🪨' && grid[r][c].emoji === grid[r][c+1].emoji && grid[r][c].emoji === grid[r][c+2].emoji) {
        let count = 3;
        while (c + count < GRID_SIZE && grid[r][c].emoji === grid[r][c+count].emoji) count++;
        matches.push({ type: 'row', tiles: Array.from({length: count}, (_, i) => ({ row: r, col: c + i })) });
        c += count - 1;
      }
    }
  }
  for (let c = 0; c < GRID_SIZE; c++) { // Vertical
    for (let r = 0; r < GRID_SIZE - 2; r++) {
      if (grid[r][c].emoji && grid[r][c].emoji !== '🪨' && grid[r][c].emoji === grid[r+1][c].emoji && grid[r][c].emoji === grid[r+2][c].emoji) {
        let count = 3;
        while (r + count < GRID_SIZE && grid[r][c].emoji === grid[r+count][c].emoji) count++;
        matches.push({ type: 'col', tiles: Array.from({length: count}, (_, i) => ({ row: r + i, col: c })) });
        r += count - 1;
      }
    }
  }
  return matches;
};

export const areAdjacent = (p1, p2) => Math.abs(p1.row - p2.row) + Math.abs(p1.col - p2.col) === 1;

export const getAffectedPositions = (r, c, modifier, emoji, currentGrid) => {
  let affected = [];
  if (modifier === 'fire') {
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const nr = r + i, nc = c + j;
      if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) affected.push({ row: nr, col: nc });
    }
  } else if (modifier === 'lightning') {
    for (let i = 0; i < GRID_SIZE; i++) {
      affected.push({ row: i, col: c });
      if (i !== c) affected.push({ row: r, col: i });
    }
  } else if (modifier === 'star') {
    for (let i = 0; i < GRID_SIZE; i++) for (let j = 0; j < GRID_SIZE; j++) {
      if (currentGrid[i][j].emoji === emoji) affected.push({ row: i, col: j });
    }
  }
  return affected;
};
