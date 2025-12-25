
export const GRID_SIZE = 8;
export const ATTACK_INTERVAL = 5;
export const ENRAGE_CYCLES = 3;
export const MANA_MAX = 50;
export const EMOJIS = ['🍎', '🍊', '🍌', '🍇', '🥝'];

export const ENEMIES = [
  { name: 'Лесной Слизень', emoji: '🫠', hp: 500, damage: 10, abilityId: 'slime', ability: 'Слизь: блокирует клетки' },
  { name: 'Теневой Дух', emoji: '👻', hp: 1200, damage: 15, abilityId: 'ghost', ability: 'Туман: скрывает тайлы' },
  { name: 'Каменная Горгулья', emoji: '🗿', hp: 2500, damage: 20, abilityId: 'gargoyle', ability: 'Камень: создает препятствия' },
  { name: 'Огненный Демон', emoji: '😈', hp: 4000, damage: 25, abilityId: 'demon', ability: 'Ожог: урон при сборе' },
  { name: 'Древний Дракон', emoji: '🐲', hp: 6000, damage: 35, abilityId: 'dragon', ability: 'Рев: сжигает ману' }
];

export const PERKS = [
  { id: 'vampire', name: 'Вампиризм', desc: 'Ульта "Ярость" лечит 5% HP за стак', icon: '🧛' },
  { id: 'pyro', name: 'Пиромантия', desc: 'Взрывы 🔥 в 2 раза сильнее за стак', icon: '🔥' },
  { id: 'muscle', name: 'Сила', desc: '+3 к базовому урону тайлов', icon: '💪' },
  { id: 'lucky', name: 'Удача', desc: '+15% шанс и +0.5 к силе крита', icon: '🍀' }
];

export const EMOJI_COLORS = {
  '🍎': '#ef4444', '🍊': '#f97316', '🍌': '#facc15', '🍇': '#a855f7', '🥝': '#4ade80', '🪨': '#94a3b8'
};

export const EMOJI_URLS: Record<string, string> = {
  '🍎': 'data/emoji/red_apple_3d.png',
  '🍊': 'data/emoji/tangerine_3d.png',
  '🍌': 'data/emoji/banana_3d.png',
  '🍇': 'data/emoji/grapes_3d.png',
  '🥝': 'data/emoji/kiwi_fruit_3d.png',
  '🪨': 'data/emoji/rock_3d.png',
  '🫠': 'data/emoji/melting_face_3d.png',
  '👻': 'data/emoji/ghost_3d.png',
  '🗿': 'data/emoji/moai_3d.png',
  '😈': 'data/emoji/smiling_face_with_horns_3d.png',
  '🐲': 'data/emoji/dragon_face_3d.png',
  '🧛': 'data/emoji/man_vampire_3d_light.png',
  '🔥': 'data/emoji/fire_3d.png',
  '💪': 'data/emoji/flexed_biceps_3d_default.png',
  '🍀': 'data/emoji/four_leaf_clover_3d.png',
  '⚡': 'data/emoji/high_voltage_3d.png',
  '⭐': 'data/emoji/star_3d.png',
  '🦠': 'data/emoji/microbe_3d.png',
  '❓': 'data/emoji/white_question_mark_3d.png',
  '🎁': 'data/emoji/wrapped_gift_3d.png',
  '💀': 'data/emoji/skull_3d.png'
};

export const TILE_BG_COLORS: Record<string, string> = {
  '🍌': 'bg-gradient-to-br from-[#2E2003] to-[#714E08]/70 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] ring-1 ring-yellow-500/20',
  '🍊': 'bg-gradient-to-br from-[#451503] to-[#9A3412]/70 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] ring-1 ring-orange-500/20',
  '🍎': 'bg-gradient-to-br from-red-950 to-rose-900/60 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] ring-1 ring-red-500/20',
  '🍇': 'bg-gradient-to-br from-purple-950 to-indigo-900/60 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] ring-1 ring-purple-500/20',
  '🥝': 'bg-gradient-to-br from-lime-950 to-green-900/60 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] ring-1 ring-lime-500/20',
};

export const SKILL_DATA = {
  '🍎': { title: 'Ярость', desc: 'СИЛЬНЫЙ УДАР', color: 'text-red-400' },
  '🍌': { title: 'Свет', desc: 'ЛЕЧЕНИЕ %', color: 'text-yellow-400' },
  '🍇': { title: 'Хаос', desc: 'РИСК/БОНУС', color: 'text-purple-400' }
};

export const MODIFIER_CLASSES = {
  fire: { style: "special-fire border-red-500/50", bg: "", icon: "🔥" },
  lightning: { style: "special-lightning border-blue-400/50", bg: "", icon: "⚡" },
  star: { style: "special-star border-yellow-400/50", bg: "", icon: "⭐" },
  none: { style: "", bg: "", icon: null }
};