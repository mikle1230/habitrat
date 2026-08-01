/* ================================================================
 * HabitRat — Data Model
 * ================================================================
 * Single JSON blob in localStorage('habitrat:v4'):
 *   family / members / habitTemplates / rewardItems / transactions
 *   checks (per-week habit status) / streakState / effectiveLog
 *   customItems / dateConfig / outfitState / roomState
 *   _levelConfig / _dataVersion / _schemaVersion
 *
 * Core loop: user action → cycleStatus() → recomputeStreaks()
 *   → saveData() → debounceSyncToServer() (Upstash Redis)
 * ================================================================ */

// ---- 吉祥物 SVG 三阶段 ----
const mascotStages = {
  base: `<ellipse cx="18" cy="22" rx="12" ry="9" fill="#C97B4A"/><circle cx="10" cy="10" r="5" fill="#C97B4A"/><circle cx="26" cy="10" r="5" fill="#C97B4A"/><circle cx="10" cy="10" r="2.4" fill="#F3D9C4"/><circle cx="26" cy="10" r="2.4" fill="#F3D9C4"/><circle cx="14" cy="19" r="1.6" fill="#2B2250"/><circle cx="22" cy="19" r="1.6" fill="#2B2250"/><ellipse cx="18" cy="24" rx="2.2" ry="1.6" fill="#A85F32"/>`,
  scarf: `<ellipse cx="18" cy="22" rx="12" ry="9" fill="#C97B4A"/><circle cx="10" cy="10" r="5" fill="#C97B4A"/><circle cx="26" cy="10" r="5" fill="#C97B4A"/><circle cx="10" cy="10" r="2.4" fill="#F3D9C4"/><circle cx="26" cy="10" r="2.4" fill="#F3D9C4"/><circle cx="14" cy="19" r="1.6" fill="#2B2250"/><circle cx="22" cy="19" r="1.6" fill="#2B2250"/><ellipse cx="18" cy="24" rx="2.2" ry="1.6" fill="#A85F32"/><rect x="8" y="24" width="20" height="5" rx="2.5" fill="#1FAE9F"/>`,
  crown: `<ellipse cx="18" cy="22" rx="12" ry="9" fill="#C97B4A"/><circle cx="10" cy="10" r="5" fill="#C97B4A"/><circle cx="26" cy="10" r="5" fill="#C97B4A"/><circle cx="10" cy="10" r="2.4" fill="#F3D9C4"/><circle cx="26" cy="10" r="2.4" fill="#F3D9C4"/><circle cx="14" cy="19" r="1.6" fill="#2B2250"/><circle cx="22" cy="19" r="1.6" fill="#2B2250"/><ellipse cx="18" cy="24" rx="2.2" ry="1.6" fill="#A85F32"/><rect x="8" y="24" width="20" height="5" rx="2.5" fill="#1FAE9F"/><polygon points="12,6 15,1 18,6 21,1 24,6" fill="#C89D4A"/>`
};

// ---- 装扮系统 ----
const OUTFIT_CATEGORIES = ['clothing', 'companion', 'background'];
const OUTFIT_CATEGORY_LABELS = { clothing: '服饰', companion: '伙伴', background: '背景' };
let outfitState = {}; // { memberId: { clothing: 'scarf_green', companion: null, background: null } }
let sceneZones = []; // 场景热区：{ name, points:[{x,y}] } 百分比坐标多边形，可增删，自动持久化

const OUTFIT_DEFINITIONS = {
  clothing: [
    { id:'scarf_green', name:'小绿围巾', unlockLevel:2, svg:'<rect x="8" y="24" width="20" height="5" rx="2.5" fill="#1FAE9F"/>' },
    { id:'bowtie', name:'蝴蝶结', unlockLevel:3, svg:'<polygon points="14,27 18,29 22,27 22,30 18,32 14,30" fill="#FF6B6B"/>' },
    { id:'crown_gold', name:'金皇冠', unlockLevel:5, svg:'<polygon points="12,6 15,1 18,6 21,1 24,6" fill="#C89D4A"/>' },
    { id:'cape_hero', name:'英雄披风', unlockLevel:9, svg:'<path d="M6 20 Q18 8 30 20" fill="var(--steel)" stroke="#5A3E9E" stroke-width="1"/>' },
    { id:'glasses_cool', name:'酷墨镜', unlockLevel:12, svg:'<circle cx="13" cy="13" r="3" fill="#2D3340"/><circle cx="23" cy="13" r="3" fill="#2D3340"/><line x1="16" y1="13" x2="20" y2="13" stroke="#2D3340" stroke-width="1.5"/>' },
    { id:'wings_angel', name:'天使翅膀', unlockLevel:16, svg:'<ellipse cx="6" cy="14" rx="4" ry="6" fill="#FFF9C4" transform="rotate(-15 6 14)"/><ellipse cx="30" cy="14" rx="4" ry="6" fill="#FFF9C4" transform="rotate(15 30 14)"/>' },
  ],
  companion: [
    { id:'bird', name:'小鸟', unlockLevel:3, emoji:'🐦', x:30, y:8 },
    { id:'butterfly', name:'蝴蝶', unlockLevel:6, emoji:'🦋', x:4, y:6 },
    { id:'cat', name:'小猫咪', unlockLevel:10, emoji:'🐱', x:28, y:6 },
    { id:'puppy', name:'小狗狗', unlockLevel:14, emoji:'🐶', x:5, y:8 },
    { id:'dragon', name:'小火龙', unlockLevel:18, emoji:'🐲', x:30, y:4 },
  ],
  background: [
    { id:'forest', name:'森林', unlockLevel:4, svg:'<rect width="36" height="36" fill="#E8F5E9" rx="18"/>' },
    { id:'sunset', name:'日落', unlockLevel:7, svg:'<rect width="36" height="36" fill="#F5EDDC" rx="18"/><circle cx="18" cy="28" r="10" fill="#C89D4A" opacity="0.3"/>' },
    { id:'ocean', name:'海洋', unlockLevel:11, svg:'<rect width="36" height="36" fill="#E3F2FD" rx="18"/><path d="M0 24 Q9 20 18 24 Q27 28 36 24 L36 36 L0 36Z" fill="#90CAF9" opacity="0.4"/>' },
    { id:'galaxy', name:'银河', unlockLevel:15, svg:'<rect width="36" height="36" fill="#1A237E" rx="18"/><circle cx="8" cy="8" r="2" fill="#FFF9C4"/><circle cx="24" cy="6" r="1.5" fill="#CE93D8"/><circle cx="14" cy="20" r="1" fill="#B3E5FC"/><circle cx="28" cy="22" r="1.5" fill="#FFE082"/>' },
    { id:'volcano', name:'火山', unlockLevel:19, svg:'<rect width="36" height="36" fill="#3E2723" rx="18"/><polygon points="0,34 8,10 18,4 28,10 36,34" fill="#5D4037"/><circle cx="18" cy="6" r="3" fill="#FF6D00"/>' },
  ]
};

function renderMascotSvg(memberId, containerId) {
  const level = getMemberLevel(memberId);
  const state = outfitState[memberId] || { clothing: null, companion: null, background: null };
  const stage = level >= 5 ? 'crown' : (level >= 2 ? 'scarf' : 'base');
  let svg = mascotStages[stage];
  // Overlay clothing
  if (state.clothing) {
    const item = OUTFIT_DEFINITIONS.clothing.find(c => c.id === state.clothing);
    if (item) svg += item.svg;
  }
  // Add companion
  if (state.companion) {
    const item = OUTFIT_DEFINITIONS.companion.find(c => c.id === state.companion);
    if (item) svg += `<text x="${item.x}" y="${item.y}" font-size="10">${item.emoji}</text>`;
  }
  // Add background (first)
  if (state.background) {
    const item = OUTFIT_DEFINITIONS.background.find(c => c.id === state.background);
    if (item) svg = item.svg + svg;
  }
  const el = document.getElementById(containerId || 'mascotSvg');
  if (el) el.innerHTML = svg;
}

function getUnlockedOutfits(memberId) {
  const level = getMemberLevel(memberId);
  const result = [];
  Object.keys(OUTFIT_DEFINITIONS).forEach(cat => {
    OUTFIT_DEFINITIONS[cat].forEach(item => {
      result.push({ ...item, category: cat, unlocked: level >= item.unlockLevel });
    });
  });
  return result;
}

function equipOutfit(memberId, category, itemId) {
  if (!outfitState[memberId]) outfitState[memberId] = { clothing: null, companion: null, background: null };
  const current = outfitState[memberId][category];
  outfitState[memberId][category] = current === itemId ? null : itemId;
  saveData();
  renderDressupView();
  renderMascotSvg(memberId, 'mascotSvg');
  renderMascotSvg(memberId, 'dressupMascotSvg');
}

// ================================================================
// 游戏规则说明（想改规则内容，直接改这里的文字即可）
// 每个 section 是一个板块：emoji+标题+多条规则+可选的温馨提示
// ================================================================
const GAME_RULES = [
  {
    emoji: '📅',
    title: '每天做什么',
    lines: [
      '每天打开「任务」页，把今天该做的事情完成，点一下就打上卡。',
      '每个习惯有三种状态：<b>✅ 完成</b>、<b>✗ 没完成</b>、<b>○ 还没做</b>。',
      '完成了就获得经验（EXP）和金币（💰），没完成不计分。'
    ]
  },
  {
    emoji: '⭐',
    title: 'EXP 和升级',
    lines: [
      '经验攒够了就会<b>升级</b>，等级越高，称号越厉害。',
      '每升一级，就能解锁新的装扮、伙伴和场景，把 Ratty 的家打扮得越来越漂亮。'
    ]
  },
  {
    emoji: '💰',
    title: '金币和奖励',
    lines: [
      '金币可以用来在「商店」里兑换奖励。',
      '奖励是爸爸妈妈和你一起商量好的，兑换前记得先问问哦。'
    ],
    tip: '金币花掉了还能再赚，每天坚持打卡就有金币啦！'
  },
  {
    emoji: '🔥',
    title: '连续打卡',
    lines: [
      '每天<b>全部完成</b>所有习惯，就算「全勤」一天。',
      '连续全勤的天数越多，解锁的奖励越丰厚。',
      '如果有一天没完成，连续天数就会从头开始算。'
    ],
    tip: '不用怕断掉，重新开始也是一种坚持！'
  },
  {
    emoji: '🔒',
    title: '每天结束后自动锁定',
    lines: [
      '每天到 <b>23:59</b>，当天内容会自动锁定，不能再改。',
      '这样能保证记录是真实的，避免不小心误操作。',
      '如果当天真的需要修改，可以让爸爸妈妈用 PIN 码解锁。'
    ]
  },
  {
    emoji: '🏖️',
    title: '节假日和寒暑假',
    lines: [
      '在假期里，有些习惯的时间要求会放松一点。',
      '寒暑假的时间段会在「设置」里由爸爸妈妈配置，当天顶部会有提示。'
    ]
  }
];

// 1. Legacy Data
const HABITS_LEGACY = [
  { id:'mom_bf', personKey:'xiaomei', emoji:'🥣', name:'妈妈吃早饭', pts:10, streakNeed:3, rule:'8:30前', ruleVacation:'9:00前', applicable:'all' },
  { id:'xm_brush', personKey:'xiaomei', emoji:'💧', name:'刷牙', pts:1, streakNeed:5, rule:'7:30前', ruleVacation:'8:00前', applicable:'all' },
  { id:'xm_wash', personKey:'xiaomei', emoji:'🧼', name:'洗脸', pts:2, streakNeed:5, rule:'7:30前', ruleVacation:'8:00前', applicable:'all' },
  { id:'xm_bf', personKey:'xiaomei', emoji:'🥣', name:'吃早饭', pts:5, streakNeed:5, rule:'7:40前', ruleVacation:'8:30前', applicable:'all' },
  { id:'xm_lunch', personKey:'xiaomei', emoji:'🍚', name:'吃午饭', pts:5, streakNeed:5, rule:'11:30-13:30', ruleVacation:'11:30-13:30', applicable:'noschool' },
  { id:'xm_dinner', personKey:'xiaomei', emoji:'🍜', name:'吃晚饭', pts:5, streakNeed:5, rule:'17:00-19:30', ruleVacation:'17:00-19:30', applicable:'all' },
  { id:'xm_sleep1', personKey:'xiaomei', emoji:'😴', name:'睡觉（目标一）', pts:10, streakNeed:5, rule:'21:30前', ruleVacation:'22:00前', applicable:'all' },
  { id:'xm_sleep2', personKey:'xiaomei', emoji:'🌙', name:'睡觉（目标二）', pts:5, streakNeed:5, rule:'22:00前', ruleVacation:'22:30前', applicable:'all' },
  { id:'mom_sleep', personKey:'xiaomei', emoji:'😴', name:'妈妈早睡觉', pts:10, streakNeed:3, rule:'22:30前', ruleVacation:'23:00前', applicable:'all' },
];
const FAMILY_LEGACY = ['爸爸','妈妈','小美','爷爷','奶奶','外公','外婆'];
const FAMILY_EMOJI = {'爸爸':'👨','妈妈':'👩','小美':'👧','爷爷':'👴','奶奶':'👵','外公':'👴','外婆':'👵'};

// 2. UUID
function genId() { return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8); }

// 3. Data Model State — 单一状态树
const state = {
  // 核心数据模型
  family: null,
  members: [],
  habitTemplates: [],
  rewardItems: [],
  _levelConfig: { coefficient: 50, titles: ['新手冒险者','新手冒险者','新手冒险者','新手冒险者','坚毅探险家','坚毅探险家','坚毅探险家','坚毅探险家','坚毅探险家','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','荣耀守护者','传奇领航者'] },
  selectedMemberId: null,
  _lastKnownLevels: {},
  roomState: {},
  // 打卡数据
  checks: {},
  streakState: {},
  effectiveLog: {},
  transactions: [],
  dateConfig: { vacationRanges: [
    { name: '暑假', start: '2026-07-01', end: '2026-08-31' },
    { name: '寒假', start: '2027-01-18', end: '2027-02-28' },
  ]},
  customItems: [],
  operationLog: [],
  // 同步与安全
  syncStatus: 'idle',
  _dataVersion: 0,
  familyCode: localStorage.getItem('habitrat:familyCode') || localStorage.getItem('ht_familyCode') || '',
  lastSyncTime: null,
  lockedDates: {},
  parentPin: '',
  securityQuestion: '',
  securityAnswer: '',
  unlockedForEdit: {},
  // 导航
  currentView: 'week',
  currentHomeTab: 'today',
  currentMonth: (() => { const d = new Date(); d.setDate(1); return d; })(),
  currentWeek: null,
  currentDay: null,
};
// 导出为顶层变量别名（对象/数组共享引用，原语值在 saveData 前同步回 state）
let family, members, habitTemplates, rewardItems, _levelConfig, selectedMemberId, _lastKnownLevels, roomState;
let checks, streakState, effectiveLog, transactions, dateConfig, customItems, operationLog;
let syncStatus, _dataVersion, familyCode, lastSyncTime, lockedDates, parentPin, securityQuestion, securityAnswer, unlockedForEdit;
let currentView, currentHomeTab, currentMonth, currentWeek, currentDay;
/** 将所有 state 属性复制到顶层变量（对象保持引用传递） */
function _syncFromState() {
  ({ family, members, habitTemplates, rewardItems, _levelConfig, selectedMemberId, _lastKnownLevels, roomState,
     checks, streakState, effectiveLog, transactions, dateConfig, customItems, operationLog,
     syncStatus, _dataVersion, familyCode, lastSyncTime, lockedDates, parentPin, securityQuestion, securityAnswer, unlockedForEdit,
     currentView, currentHomeTab, currentMonth, currentWeek, currentDay } = state);
}
/** 将原语值从顶层变量同步回 state（对象/数组已共享引用，无需回写） */
function _syncToState() {
  state._dataVersion = _dataVersion; state.familyCode = familyCode; state.syncStatus = syncStatus;
  state.parentPin = parentPin; state.securityQuestion = securityQuestion; state.securityAnswer = securityAnswer;
  state.selectedMemberId = selectedMemberId;
  state.currentView = currentView; state.currentHomeTab = currentHomeTab;
  state.currentMonth = currentMonth; state.currentWeek = currentWeek; state.currentDay = currentDay;
  state.lastSyncTime = lastSyncTime;
}
_syncFromState(); // 初始化

const DEVICE_ID = (() => { let id = localStorage.getItem('habitrat:deviceId') || localStorage.getItem('ht_deviceId'); if (!id) { id = 'D'+Math.random().toString(36).slice(2,8); localStorage.setItem('habitrat:deviceId', id); } return id; })();
function logOp(person, action, detail) { operationLog.unshift({ id: Date.now().toString(36), time: new Date().toISOString(), device: DEVICE_ID, person, action, detail }); if (operationLog.length > 200) operationLog.length = 200; saveData(); }
const FAMILY_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateFamilyCode() { let code = ''; for (let i = 0; i < 6; i++) { code += FAMILY_CODE_CHARS[Math.floor(Math.random() * FAMILY_CODE_CHARS.length)]; } return code; }


// 5. Helper functions
function getActiveHabits() {
  const active = habitTemplates.filter(h => !h.archived);
  const legacyOrder = HABITS_LEGACY.map(l => l.id);
  active.sort((a, b) => {
    const ai = legacyOrder.indexOf(a.id); const bi = legacyOrder.indexOf(b.id);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
  return active;
}
function getMemberById(id) { return members.find(m => m.id === id) || null; }
function getChildMembers() { return members.filter(m => m.role === 'child'); }
function getGuardianMembers() { return members.filter(m => m.role === 'guardian'); }
function getMemberName(id) { const m = getMemberById(id); return m ? m.name : '未知'; }
function getMemberEmoji(id) { const m = getMemberById(id); if (!m) return '👤'; if (m.role === 'guardian') return '👩'; return '👧'; }
function getCoinBalance(memberId) {
  const earn = transactions.filter(t => t.memberId === memberId && (t.type === 'earn_coin' || t.type === 'bonus_coin')).reduce((s, t) => s + t.amount, 0);
  const spent = transactions.filter(t => t.memberId === memberId && (t.type === 'spend_coin' || t.type === 'deduct_coin')).reduce((s, t) => s + t.amount, 0);
  return earn - spent;
}
function getTotalExp(memberId) {
  return transactions.filter(t => t.memberId === memberId && (t.type === 'earn_exp' || t.type === 'bonus_exp')).reduce((s, t) => s + t.amount, 0);
}
function getMemberLevel(memberId) {
  const exp = getTotalExp(memberId);
  return Math.floor(Math.sqrt(exp / (_levelConfig.coefficient || 50))) + 1;
}
function getTitleForLevel(level) {
  const titles = _levelConfig.titles || ['新手冒险者','新手冒险者','新手冒险者','新手冒险者','坚毅探险家','坚毅探险家','坚毅探险家','坚毅探险家','坚毅探险家','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','荣耀守护者','传奇领航者'];
  if (level < 1) return titles[0];
  const idx = Math.min(level - 1, titles.length - 1);
  return titles[idx] || ('Lv.' + level);
}
function getExpForLevel(level) { return (_levelConfig.coefficient || 50) * (level - 1) * (level - 1); }
function getExpProgress(memberId) {
  const exp = getTotalExp(memberId);
  const lv = getMemberLevel(memberId);
  const currentLvExp = getExpForLevel(lv);
  const nextLvExp = getExpForLevel(lv + 1);
  return { level: lv, currentExp: exp, currentLvExp, nextLvExp, progress: Math.min(100, Math.round((exp - currentLvExp) / (nextLvExp - currentLvExp) * 100)), needExp: nextLvExp - exp };
}
function getMemberCollectibles(memberId) {
  const level = getMemberLevel(memberId);
  return rewardItems.filter(r => r.kind === 'collectible').map(r => ({ ...r, unlocked: level >= r.unlockLevel }));
}
function getDefaultCollectibles() {
  return [
    { level: 1, emoji: '🌱', name: '萌芽徽章' }, { level: 2, emoji: '🌿', name: '幼苗徽章' },
    { level: 3, emoji: '🪴', name: '成长徽章' }, { level: 4, emoji: '🌳', name: '小树徽章' },
    { level: 5, emoji: '⭐', name: '明星徽章' }, { level: 6, emoji: '🌟', name: '闪耀徽章' },
    { level: 7, emoji: '💎', name: '宝石徽章' }, { level: 8, emoji: '👑', name: '皇冠徽章' },
    { level: 9, emoji: '🔥', name: '烈焰徽章' }, { level: 10, emoji: '❄️', name: '冰霜徽章' },
    { level: 11, emoji: '⚡', name: '雷电徽章' }, { level: 12, emoji: '🌀', name: '风暴徽章' },
    { level: 13, emoji: '🌈', name: '彩虹徽章' }, { level: 14, emoji: '🦄', name: '独角兽徽章' },
    { level: 15, emoji: '🐉', name: '神龙徽章' }, { level: 16, emoji: '🦅', name: '雄鹰徽章' },
    { level: 17, emoji: '🐺', name: '狼王徽章' }, { level: 18, emoji: '🦁', name: '狮王徽章' },
    { level: 19, emoji: '🏆', name: '冠军徽章' }, { level: 20, emoji: '🌌', name: '银河徽章' },
  ];
}
function getHabitMeta(habitId) {
  const h = habitTemplates.find(x => x.id === habitId);
  if (!h) return { expValue: 10, coinValue: 10, ownerMemberId: members[0]?.id || '' };
  return { expValue: h.expValue || 10, coinValue: h.coinValue || 10, ownerMemberId: h.ownerMemberId || members[0]?.id || '' };
}

// Backward compat
function getTotalEarned_old() {
  return Object.values(effectiveLog).reduce((s, log) => s + log.reduce((ss, e) => ss + e.pts, 0), 0)
    + transactions.filter(t => t.type === 'bonus_coin' || t.type === 'bonus').reduce((s, t) => s + t.amount, 0);
}
function getTotalSpent_old() {
  return transactions.filter(t => t.type === 'spend_coin' || t.type === 'deduct_coin' || t.type === 'spend' || t.type === 'deduct').reduce((s, t) => s + t.amount, 0);
}
function getRemain_old() { return getTotalEarned_old() - getTotalSpent_old(); }


// ========== Date utilities ==========
function fmtDateFull(d) { const y = d.getFullYear(), m = d.getMonth()+1, dd = d.getDate(); return y+'-'+String(m).padStart(2,'0')+'-'+String(dd).padStart(2,'0'); }
function fmtDate(d) { return (d.getMonth()+1)+'/'+d.getDate(); }
function fmtDateCN(d) { return d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日'; }
function getMonday(date) { const d = new Date(date); d.setHours(0,0,0,0); const day = d.getDay(); const diff = day === 0 ? -6 : 1 - day; d.setDate(d.getDate() + diff); return d; }
function getWeekKey(d) { const date = new Date(d); date.setHours(0,0,0,0); const thu = new Date(date); thu.setDate(date.getDate() + 3); const yr = thu.getFullYear(); const jan1 = new Date(yr,0,1); const doy = Math.floor((thu - jan1) / 86400000); const wk = Math.ceil((doy + jan1.getDay() + 1) / 7); return yr+'-W'+String(wk).padStart(2,'0'); }
function getDayOfWeek(d) { const day = d.getDay(); return day === 0 ? 6 : day - 1; }
function getMonthDays(year, month) { return new Date(year, month + 1, 0).getDate(); }
function getCalendarGrid(year, month) { const first = new Date(year, month, 1); const last = new Date(year, month + 1, 0); const start = getMonday(first); const totalDays = Math.ceil((last - start + 86400000) / 86400000); const weeks = Math.ceil(totalDays / 7); const grid = []; for (let w = 0; w < weeks; w++) { const row = []; for (let d = 0; d < 7; d++) { const date = new Date(start); date.setDate(start.getDate() + w * 7 + d); row.push(date); } grid.push(row); } return grid; }
function datesConsecutive(d1, d2) { const a = new Date(d1), b = new Date(d2); a.setHours(0,0,0,0); b.setHours(0,0,0,0); return (b - a) === 86400000; }

// ========== Holidays & Mode ==========
const HOLIDAYS_2026 = {
  '2026-01-01':1,'2026-01-02':1,'2026-01-03':1,'2026-02-15':1,'2026-02-16':1,'2026-02-17':1,'2026-02-18':1,'2026-02-19':1,'2026-02-20':1,'2026-02-21':1,'2026-02-22':1,'2026-02-23':1,
  '2026-04-04':1,'2026-04-05':1,'2026-04-06':1,'2026-05-01':1,'2026-05-02':1,'2026-05-03':1,'2026-05-04':1,'2026-05-05':1,
  '2026-06-19':1,'2026-06-20':1,'2026-06-21':1,'2026-09-25':1,'2026-09-26':1,'2026-09-27':1,
  '2026-10-01':1,'2026-10-02':1,'2026-10-03':1,'2026-10-04':1,'2026-10-05':1,'2026-10-06':1,'2026-10-07':1,
};
const MAKEUP_2026 = { '2026-01-04':1, '2026-02-14':1,'2026-02-28':1, '2026-05-09':1, '2026-09-20':1,'2026-10-10':1 };
function getModeForDate(date) {
  const ds = fmtDateFull(date);
  for (const r of dateConfig.vacationRanges) { if (ds >= r.start && ds <= r.end) return 'vacation'; }
  if (HOLIDAYS_2026[ds]) return 'holiday';
  const dow = date.getDay();
  if ((dow === 0 || dow === 6) && !MAKEUP_2026[ds]) return 'holiday';
  return 'workday';
}
function getModeLabel(m) { return { workday:'工作日', holiday:'节假日', vacation:'寒暑假' }[m] || ''; }
function getModeClass(m) { return { workday:'mode-workday', holiday:'mode-holiday', vacation:'mode-vacation' }[m] || ''; }

// ========== Habit status ==========
function isDayApplicable(habit, date) {
  if (!habit) return false;
  const mode = getModeForDate(date);
  const applicable = habit.applicable || (habit.rule && habit.rule.applicable) || 'all';
  if (applicable === 'all') return true;
  if (applicable === 'noschool') return mode !== 'workday';
  return true;
}
function getRuleText(habit, date) {
  const mode = getModeForDate(date);
  if (mode === 'vacation' && (habit.ruleVacation || (habit.rule && habit.rule.ruleVacation))) return habit.ruleVacation || (habit.rule && habit.rule.ruleVacation);
  return habit.ruleText || habit.rule || (habit.rule && habit.rule.ruleWorkday) || '';
}
function getDayStatus(habit, date) {
  const wk = getWeekKey(date); const di = getDayOfWeek(date);
  if (!isDayApplicable(habit, date)) return 'na';
  if (checks[wk] && checks[wk][habit.id] && checks[wk][habit.id][di]) return checks[wk][habit.id][di];
  return '○';
}
function setDayStatus(habit, date, status) {
  const wk = getWeekKey(date); const di = getDayOfWeek(date);
  if (!checks[wk]) checks[wk] = {};
  if (!checks[wk][habit.id]) checks[wk][habit.id] = ['○','○','○','○','○','○','○'];
  checks[wk][habit.id][di] = status;
  saveData();
}
function cycleStatus(habit, date) {
  const cur = getDayStatus(habit, date);
  if (cur === 'na') return;
  const meta = getHabitMeta(habit.id);
  if (cur === '○' || cur === '') { setDayStatus(habit, date, '✓'); logOp(getMemberName(meta.ownerMemberId), '✓ '+habit.title, fmtDate(date)); return '✓'; }
  if (cur === '✓') { setDayStatus(habit, date, '✗'); logOp(getMemberName(meta.ownerMemberId), '✗ '+habit.title, fmtDate(date)); return '✗'; }
  if (cur === '✗') { setDayStatus(habit, date, '○'); logOp(getMemberName(meta.ownerMemberId), '○ '+habit.title, fmtDate(date)); return '○'; }
}


// ========== Migration ==========
function migrateData(oldData) {

  // Create family
  result.family = { id: genId(), inviteCode: oldData.familyCode || generateFamilyCode(), createdAt: new Date().toISOString() };

  // Create members from FAMILY_LEGACY
  result.members = FAMILY_LEGACY.map((name, i) => ({ id: genId(), name, role: i < 2 ? 'guardian' : (i === 2 ? 'child' : 'viewer'), totalExp: 0 }));

  // Create habitTemplates from HABITS_LEGACY
  const childMemberId = result.members.find(m => m.role === 'child')?.id || result.members[0]?.id;
  result.habitTemplates = HABITS_LEGACY.map(h => ({
    id: h.id, ownerMemberId: childMemberId,
    title: h.name, emoji: h.emoji,
    expValue: h.pts, coinValue: h.pts,
    streakNeed: h.streakNeed, ruleText: h.rule, ruleVacation: h.ruleVacation, applicable: h.applicable,
    archived: false,
  }));

  // Migrate transactions
  const oldTxs = oldData.transactions || [];
  result.transactions = oldTxs.map(t => {
    const newType = t.type === 'bonus' ? 'bonus_coin' : t.type === 'spend' ? 'spend_coin' : t.type === 'deduct' ? 'deduct_coin' : t.type;
    return { id: t.id || genId(), memberId: result.members[2]?.id || '', type: newType, amount: t.amount, reason: t.note || t.reason || '', createdAt: t.date || t.createdAt || '' };
  });

  // Migrate effectiveLog -> earn_exp + earn_coin transactions
  const effLog = oldData.effectiveLog || {};
  let effCount = 0;
  Object.entries(effLog).forEach(([habitId, entries]) => {
    const hab = HABITS_LEGACY.find(h => h.id === habitId);
    if (!hab) return;
    const mid = childMemberId;
    entries.forEach(e => {
      result.transactions.push({ id: genId(), memberId: mid, type: 'earn_exp', amount: e.pts, reason: hab.name + ' 连续达标', createdAt: e.date });
      result.transactions.push({ id: genId(), memberId: mid, type: 'earn_coin', amount: e.pts, reason: hab.name + ' 连续达标', createdAt: e.date });
      effCount++;
    });
  });

  // Set totalExp for each member
  result.members.forEach(m => {
    m.totalExp = result.transactions.filter(t => t.memberId === m.id && (t.type === 'earn_exp' || t.type === 'bonus_exp')).reduce((s, t) => s + t.amount, 0);
  });

  // Migrate exchangeItems -> rewardItems
  result.rewardItems = (oldData.exchangeItems || [{ id:'game', name:'🎮 玩游戏', cost:1, unit:'分钟' }]).map(ei => ({
    id: ei.id || genId(), kind: 'consumable', title: ei.name, cost: ei.cost, unit: ei.unit || '次',
  }));
  // Add default collectibles
  const collectibles = getDefaultCollectibles();
  collectibles.forEach(c => {
    result.rewardItems.push({ id: genId(), kind: 'collectible', title: c.name, emoji: c.emoji, unlockLevel: c.level });
  });

  // Level config
  result._levelConfig = oldData._levelConfig || { coefficient: 50, titles: ['新手冒险者','新手冒险者','新手冒险者','新手冒险者','坚毅探险家','坚毅探险家','坚毅探险家','坚毅探险家','坚毅探险家','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','荣耀守护者','传奇领航者'] };
  result._schemaVersion = 2;
  result._migratedAt = new Date().toISOString();
  return result;
}

// ========== Data Persistence ==========
/** 从 localStorage 加载数据，自动处理 V3→V4 迁移。返回 true=发生了迁移 */
function loadData() {
  try {
    const raw = localStorage.getItem('habitrat:v4') || localStorage.getItem('habitRatV4');
    if (raw) {
      const d = JSON.parse(raw);
      checks = d.checks || {};
      streakState = d.streakState || {};
      effectiveLog = d.effectiveLog || {};
      transactions = d.transactions || [];
      dateConfig = d.dateConfig || { vacationRanges: [] };
      customItems = d.customItems || [];
      operationLog = d.operationLog || [];
      familyCode = d.familyCode || '';
      lockedDates = d.lockedDates || {};
      parentPin = d.parentPin || '';
      securityQuestion = d.securityQuestion || '';
      securityAnswer = d.securityAnswer || '';
      family = d.family || null;
      members = d.members || [];
      habitTemplates = d.habitTemplates || [];
      rewardItems = d.rewardItems || [];
      _levelConfig = d._levelConfig || { coefficient: 50, titles: ['新手冒险者','新手冒险者','新手冒险者','新手冒险者','坚毅探险家','坚毅探险家','坚毅探险家','坚毅探险家','坚毅探险家','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','荣耀守护者','传奇领航者'] };
      if (_levelConfig.titles.length < 21) { _levelConfig.titles = ['新手冒险者','新手冒险者','新手冒险者','新手冒险者','坚毅探险家','坚毅探险家','坚毅探险家','坚毅探险家','坚毅探险家','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','勇敢挑战者','荣耀守护者','传奇领航者']; }
      outfitState = d.outfitState || {};
      roomState = d.roomState || {};
      sceneZones = d.sceneZones !== undefined ? d.sceneZones : defaultSceneZones();
      _dataVersion = d._dataVersion || 0;

      // 补丁：旧数据中习惯模板可能缺 emoji 或用旧 emoji
      let emojiPatched = false;
      habitTemplates.forEach(h => {
        if (!h.emoji || h.emoji === '🪥' || h.emoji === '🥛') {
          const leg = HABITS_LEGACY.find(l => l.id === h.id);
          h.emoji = leg ? leg.emoji : (h.title.includes('刷牙') ? '💧' : h.title.includes('洗脸') ? '🧼' : h.title.includes('早饭') ? '🥣' : h.title.includes('午饭') ? '🍚' : h.title.includes('晚饭') ? '🍜' : h.title.includes('睡觉') ? '😴' : '📌');
          emojiPatched = true;
        }
      });
      if (emojiPatched) saveData(true);

      // 补丁：旧名称改为新名称 + 旧时间值修正为24小时制
      let namePatched = false;
      habitTemplates.forEach(h => {
        if (h.id === 'mom_bf' && h.title === '吃早饭') { h.title = '妈妈吃早饭'; namePatched = true; }
        if (h.id === 'mom_sleep' && h.title === '早睡觉') { h.title = '妈妈早睡觉'; namePatched = true; }
        if (h.id === 'xm_sleep1' && /目标一.*\d/.test(h.title)) { h.title = '睡觉（目标一）'; namePatched = true; }
        if (h.id === 'xm_sleep2' && /目标二.*\d/.test(h.title)) { h.title = '睡觉（目标二）'; namePatched = true; }
        // 时间格式规范化：去掉"前xxx"后缀，统一为时间 + "前"
        const normTime = [
          { id:'mom_bf', oldR:'8:30前吃完早饭', newR:'8:30前', oldV:'9:00前吃完早饭', newV:'9:00前' },
          { id:'mom_sleep', oldR:'22:30前睡觉', newR:'22:30前', oldV:'23:00前睡觉', newV:'23:00前' },
          { id:'mom_sleep', oldR:'10:30前睡觉', newR:'22:30前', oldV:'11:00前睡觉', newV:'23:00前' },
          { id:'xm_brush', oldR:'7:30前刷牙', newR:'7:30前', oldV:'8:00前刷牙', newV:'8:00前' },
          { id:'xm_wash', oldR:'7:30前洗脸', newR:'7:30前', oldV:'8:00前洗脸', newV:'8:00前' },
          { id:'xm_bf', oldR:'7:40前吃完早饭', newR:'7:40前', oldV:'8:30前吃完早饭', newV:'8:30前' },
          { id:'xm_sleep1', oldR:'21:30前睡觉', newR:'21:30前', oldV:'22:00前睡觉', newV:'22:00前' },
          { id:'xm_sleep2', oldR:'22:00前睡觉', newR:'22:00前', oldV:'22:30前睡觉', newV:'22:30前' },
        ];
        normTime.forEach(p => { if (h.id === p.id && h.ruleText === p.oldR) { h.ruleText = p.newR; namePatched = true; } if (h.id === p.id && h.ruleVacation === p.oldV) { h.ruleVacation = p.newV; namePatched = true; } });
        // 修正妈妈习惯的归属到孩子
        const childId3 = members.find(m => m.role === 'child')?.id;
        if (childId3 && (h.id === 'mom_bf' || h.id === 'mom_sleep') && h.ownerMemberId !== childId3) { h.ownerMemberId = childId3; namePatched = true; }
      });
      if (namePatched) saveData(true);

      if (transactions.length > 0 && !transactions[0].memberId) {
        // Fix old migrated data
        const child = members.find(m => m.role === 'child');
        transactions.forEach(t => { if (!t.memberId) t.memberId = child?.id || members[0]?.id || ''; });
      }
      if (rewardItems.length === 0) {
        rewardItems = (d.rewardItems || d.exchangeItems || []).map(ei => ({ id: ei.id || genId(), kind: 'consumable', title: ei.name || ei.title, cost: ei.cost, unit: ei.unit }));
        getDefaultCollectibles().forEach(c => { rewardItems.push({ id: genId(), kind: 'collectible', title: c.name, emoji: c.emoji, unlockLevel: c.level }); });
      }
      // 补丁：确保所有默认徽章都存在（支持等级扩展）
      getDefaultCollectibles().forEach(c => {
        if (!rewardItems.some(r => r.kind === 'collectible' && r.title === c.name)) {
          rewardItems.push({ id: genId(), kind: 'collectible', title: c.name, emoji: c.emoji, unlockLevel: c.level });
        }
      });
      if (dateConfig.vacationRanges.length === 0) { dateConfig.vacationRanges = [{ name:'暑假',start:'2026-07-01',end:'2026-08-31'},{ name:'寒假',start:'2027-01-18',end:'2027-02-28'}]; }
      if (!family) { family = { id: genId(), inviteCode: familyCode || generateFamilyCode(), createdAt: new Date().toISOString() }; }
      if (members.length === 0) { members = FAMILY_LEGACY.map((name, i) => ({ id: genId(), name, role: i < 2 ? 'guardian' : (i === 2 ? 'child' : 'viewer'), totalExp: 0 })); }
      if (habitTemplates.length === 0) {
        const childMemberId2 = members.find(m => m.role === 'child')?.id || members[0]?.id;
        habitTemplates = HABITS_LEGACY.map(h => ({ id: h.id, ownerMemberId: childMemberId2, title: h.name, emoji: h.emoji, expValue: h.pts, coinValue: h.pts, streakNeed: h.streakNeed, ruleText: h.rule, ruleVacation: h.ruleVacation, applicable: h.applicable, archived: false }));
      }
      if (!selectedMemberId) selectedMemberId = getChildMembers()[0]?.id || members[0]?.id;

      // Clean CI transactions
      const ciCheckedIds = new Set(customItems.filter(ci => ci.status === '✓').map(ci => ci.id));
      transactions = transactions.filter(t => { if (t.type !== 'bonus_coin' && t.type !== 'bonus') return true; if (!t.reason || !t.reason.startsWith('CI:')) return true; const ciId = t.reason.slice(3).split(' ')[0]; return ciCheckedIds.has(ciId); });
      return false; // already V4, no migration needed
    }
    // Try V3 migration
    const v3raw = localStorage.getItem('habitTableV3');
    if (v3raw) {
      const oldData = JSON.parse(v3raw);
      const migrated = migrateData(oldData);
      // Apply migration
      checks = migrated.checks; streakState = migrated.streakState;
      effectiveLog = migrated.effectiveLog; transactions = migrated.transactions;
      dateConfig = migrated.dateConfig;
      customItems = migrated.customItems; operationLog = migrated.operationLog;
      familyCode = migrated.familyCode;
      family = migrated.family; members = migrated.members;
      habitTemplates = migrated.habitTemplates; rewardItems = migrated.rewardItems;
      _levelConfig = migrated._levelConfig;
      if (!selectedMemberId) selectedMemberId = getChildMembers()[0]?.id || members[0]?.id;
      // Backup V3
      if (!localStorage.getItem('habitTableV3_backup')) localStorage.setItem('habitTableV3_backup', v3raw);
      saveData(true);
      return true; // migrated
    }
  } catch(e) { console.error('loadData error:', e); }
  // Initialize defaults
  if (!family) { family = { id: genId(), inviteCode: familyCode || generateFamilyCode(), createdAt: new Date().toISOString() }; }
  if (members.length === 0) { members = [{ id: genId(), name: '妈妈', role: 'guardian', totalExp: 0 }, { id: genId(), name: '小美', role: 'child', totalExp: 0 }]; }
  if (habitTemplates.length === 0) {
    const childMemberId3 = members.find(m => m.role === 'child')?.id || members[0]?.id;
    habitTemplates = HABITS_LEGACY.map(h => ({ id: h.id, ownerMemberId: childMemberId3, title: h.name, emoji: h.emoji, expValue: h.pts, coinValue: h.pts, streakNeed: h.streakNeed, ruleText: h.rule, ruleVacation: h.ruleVacation, applicable: h.applicable, archived: false }));
  }
  if (rewardItems.length === 0) {
    rewardItems = [{ id: genId(), kind: 'consumable', title: '🎮 玩游戏', cost: 1, unit: '分钟' }];
    getDefaultCollectibles().forEach(c => { rewardItems.push({ id: genId(), kind: 'collectible', title: c.name, emoji: c.emoji, unlockLevel: c.level }); });
  }
  if (!selectedMemberId) selectedMemberId = getChildMembers()[0]?.id || members[0]?.id;
  return false;
}

/** 持久化全部状态到 localStorage，自动触发服务端同步（可 skipSync 跳过） */
function saveData(skipSync) {
  _syncToState();
  _dataVersion++;
  state._dataVersion = _dataVersion;
  localStorage.setItem('habitrat:v4', JSON.stringify({
    checks, streakState, effectiveLog, transactions, dateConfig, customItems, operationLog,
    familyCode, parentPin, securityQuestion, securityAnswer, lockedDates, family, members, habitTemplates, rewardItems, _levelConfig, outfitState, roomState, sceneZones, _schemaVersion: 2, _dataVersion,
  }));
  if (!skipSync) debounceSyncToServer();
}

// ========== 自定义事件编辑弹窗 ==========
// ========== 通用弹窗骨架 ==========
/** 创建居中弹窗：overlay + form 容器 + 取消/保存按钮。onConfirm 返回 false 阻止关闭 */
function showModalForm(title, fieldsHtml, onConfirm) {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:400;display:flex;align-items:center;justify-content:center;';
  var form = document.createElement('div');
  form.style.cssText = 'background:#fff;border-radius:16px;padding:20px;width:90%;max-width:360px;';
  form.innerHTML = '<div style="font-size:16px;font-weight:700;margin-bottom:14px;">'+title+'</div>'
    + fieldsHtml
    + '<div style="display:flex;gap:8px;"><button id="modalCancel" style="flex:1;padding:12px;border:2px solid var(--paper-deep);border-radius:10px;background:none;font-size:14px;font-weight:600;cursor:pointer;">取消</button><button id="modalSave" style="flex:1;padding:12px;border:none;border-radius:10px;background:var(--amber);color:var(--ink);font-size:14px;font-weight:700;cursor:pointer;">保存</button></div>';
  overlay.appendChild(form);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
  document.getElementById('modalCancel').addEventListener('click', function() { overlay.remove(); });
  document.getElementById('modalSave').addEventListener('click', function() {
    var data = onConfirm();
    if (data === false) return; // validation failed, don't close
    overlay.remove();
  });
}

// ========== 自定义事件编辑弹窗 ==========
function showCiEditForm(ci, onSave) {
  showModalForm('✎ 编辑自定义事件',
    '<input id="ciEditTitle" value="'+(ci.title||'')+'" placeholder="事件名称" style="width:100%;padding:10px;border:2px solid var(--paper-deep);border-radius:8px;font-size:14px;margin-bottom:8px;">'
    + '<input id="ciEditDetail" value="'+(ci.detail||'')+'" placeholder="内容说明（可选）" style="width:100%;padding:10px;border:2px solid var(--paper-deep);border-radius:8px;font-size:14px;margin-bottom:8px;">'
    + '<div style="display:flex;gap:8px;margin-bottom:14px;align-items:center;"><span style="font-size:13px;white-space:nowrap;">EXP</span><input id="ciEditExp" type="number" value="'+(ci.expValue??5)+'" min="0" style="width:70px;padding:10px;border:2px solid var(--paper-deep);border-radius:8px;font-size:14px;"><span style="font-size:13px;white-space:nowrap;">💰</span><input id="ciEditCoin" type="number" value="'+(ci.coinValue??5)+'" min="0" style="width:70px;padding:10px;border:2px solid var(--paper-deep);border-radius:8px;font-size:14px;"></div>',
    function() {
      var t = document.getElementById('ciEditTitle').value.trim();
      if (!t) { showToast('请输入事件名称'); return false; }
      ci.title = t;
      ci.detail = document.getElementById('ciEditDetail').value.trim();
      ci.expValue = parseInt(document.getElementById('ciEditExp').value) || 0;
      ci.coinValue = parseInt(document.getElementById('ciEditCoin').value) || 0;
      saveData(); showToast('✅ 已更新');
      if (onSave) onSave();
    });
}

function editMascotName() {
  var cur = (localStorage.getItem('habitrat:childName') || localStorage.getItem('habitTable_childName')) || '小美';
  var name = prompt('宝贝名字', cur);
  if (name !== null && name.trim()) {
    localStorage.setItem('habitrat:childName', name.trim());
    document.getElementById('mascotName').textContent = name.trim();
    showToast('✅ 已更新');
  }
}
function changeAvatar() {
  document.getElementById('avatarFileInput').click();
}
function handleAvatarUpload(input) {
  var file = input.files[0]; if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    localStorage.setItem('habitrat:avatar', e.target.result);
    updateAvatarDisplay();
    showToast('✅ 头像已更新');
  };
  reader.readAsDataURL(file);
}
function updateAvatarDisplay() {
  var url = (localStorage.getItem('habitrat:avatar') || localStorage.getItem('habitTable_avatar')) || '';
  var img = document.getElementById('mascotAvatar');
  var svg = document.getElementById('mascotSvg');
  if (url) {
    img.src = url; img.style.display = 'block'; svg.style.display = 'none';
  } else {
    img.src = 'docs/design/头像.png'; img.style.display = 'block'; svg.style.display = 'none';
  }
}

// ========== 习惯编辑弹窗 ==========
// 常用习惯 emoji 候选
const HABIT_EMOJI_OPTIONS = ['🥣','🍚','🍜','💧','🧼','😴','🌙','📚','✏️','🎵','🏃','🚴','🧘','📖','🎨','🧹','🛏','⏰','💊','🥗','🏊','🎮','📵','🧸','📌'];

function _renderHabitFormFields(h, prefix) {
  var curEmoji = h ? (h.emoji||'📌') : '📌';
  var emojiGrid = '<div style="margin-bottom:8px;"><div style="font-size:12px;color:var(--ink-soft);margin-bottom:4px;">图标</div><div style="display:flex;flex-wrap:wrap;gap:4px;" id="'+prefix+'EmojiGrid">';
  HABIT_EMOJI_OPTIONS.forEach(function(e) {
    emojiGrid += '<span style="font-size:20px;cursor:pointer;padding:3px 5px;border-radius:6px;'+(e===curEmoji?'background:var(--surface-tab);border:2px solid var(--steel);':'border:2px solid transparent;')+'" data-emoji="'+e+'" onclick="var g=document.getElementById(\''+prefix+'EmojiGrid\');g.querySelectorAll(\'span\').forEach(function(s){s.style.background=\'\';s.style.border=\'2px solid transparent\'});this.style.background=\'var(--surface-tab)\';this.style.border=\'2px solid var(--steel)\';document.getElementById(\''+prefix+'Emoji\').value=this.dataset.emoji">'+e+'</span>';
  });
  emojiGrid += '</div><input type="hidden" id="'+prefix+'Emoji" value="'+curEmoji+'"></div>';

  var memberOpts = members.map(function(m){return '<option value="'+m.id+'"'+(h&&m.id===h.ownerMemberId?' selected':'')+'>'+m.name+'</option>';}).join('');
  var html = '<input id="'+prefix+'Title" value="'+(h?h.title||'':'')+'" placeholder="习惯名称" style="width:100%;padding:10px;border:2px solid var(--paper-deep);border-radius:8px;font-size:14px;margin-bottom:8px;">'
    + emojiGrid
    + '<div style="display:flex;gap:8px;margin-bottom:8px;align-items:center;">'
    + '<span style="font-size:12px;color:var(--ink-soft);white-space:nowrap;">归属</span><select id="'+prefix+'Member" style="flex:1;padding:10px;border:2px solid var(--paper-deep);border-radius:8px;font-size:14px;">'+memberOpts+'</select>'
    + '<span style="font-size:12px;color:var(--ink-soft);white-space:nowrap;">连续</span><input id="'+prefix+'Streak" type="number" value="'+(h?h.streakNeed||5:5)+'" min="1" max="30" style="width:50px;padding:10px;border:2px solid var(--paper-deep);border-radius:8px;font-size:14px;text-align:center;">'
    + '<span style="font-size:12px;color:var(--ink-soft);">天</span></div>'
    + '<div style="display:flex;gap:8px;margin-bottom:8px;align-items:center;">'
    + '<span style="font-size:12px;color:var(--ink-soft);">EXP</span><input id="'+prefix+'Exp" type="number" value="'+(h?h.expValue||10:10)+'" min="1" style="width:60px;padding:10px;border:2px solid var(--paper-deep);border-radius:8px;font-size:14px;">'
    + '<span style="font-size:12px;color:var(--ink-soft);">💰</span><input id="'+prefix+'Coin" type="number" value="'+(h?h.coinValue||10:10)+'" min="1" style="width:60px;padding:10px;border:2px solid var(--paper-deep);border-radius:8px;font-size:14px;">'
    + '<select id="'+prefix+'Applicable" style="flex:1;padding:10px;border:2px solid var(--paper-deep);border-radius:8px;font-size:14px;"><option value="all"'+(h&&h.applicable==='all'?' selected':'')+'>所有模式</option><option value="noschool"'+(h&&h.applicable==='noschool'?' selected':'')+'>仅假期</option></select></div>'
    + _renderTimeRule(prefix+'Rule', '平时细则', h?h.ruleText||'':'')
    + _renderTimeRule(prefix+'RuleVacation', '寒暑假细则', h?h.ruleVacation||'':'');
  return html;
}

function _parseTime(val) {
  if (!val) return { type:'before', h:8, m:0, h2:12, m2:0 };
  var m = val.match(/^(\d{1,2}):(\d{2})前$/);
  if (m) return { type:'before', h:parseInt(m[1]), m:parseInt(m[2]) };
  m = val.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
  if (m) return { type:'range', h:parseInt(m[1]), m:parseInt(m[2]), h2:parseInt(m[3]), m2:parseInt(m[4]) };
  return { type:'text', text:val };
}
function _buildHourOpts(sel) { var s=''; for (var i=0;i<24;i++) s+='<option value="'+i+'"'+(i===sel?' selected':'')+'>'+String(i).padStart(2,'0')+'</option>'; return s; }
function _buildMinOpts(sel) { var s=''; [0,15,30,45].forEach(function(v){ s+='<option value="'+v+'"'+(v===sel?' selected':'')+'>'+String(v).padStart(2,'0')+'</option>'; }); return s; }

function _renderTimeRule(id, label, val) {
  var p = _parseTime(val);
  return '<div style="margin-bottom:6px;"><div style="font-size:12px;color:var(--ink-soft);margin-bottom:3px;">'+label+'</div>'
    + '<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;" id="'+id+'Row">'
    + '<select id="'+id+'Type" onchange="_toggleTimeType(\''+id+'\')" style="padding:8px 6px;border:2px solid var(--paper-deep);border-radius:8px;font-size:13px;flex-shrink:0;">'
    + '<option value="before"'+(p.type==='before'?' selected':'')+'>时间前</option>'
    + '<option value="range"'+(p.type==='range'?' selected':'')+'>时间段</option>'
    + '<option value="text"'+(p.type==='text'?' selected':'')+'>文字</option></select>'
    + '<span id="'+id+'TimePick" style="display:'+(p.type==='text'?'none':'flex')+';gap:3px;align-items:center;">'
    + '<select id="'+id+'H" style="padding:8px 2px;border:2px solid var(--paper-deep);border-radius:8px;font-size:13px;">'+_buildHourOpts(p.h)+'</select>'
    + '<span style="font-size:13px;">:</span>'
    + '<select id="'+id+'M" style="padding:8px 2px;border:2px solid var(--paper-deep);border-radius:8px;font-size:13px;">'+_buildMinOpts(p.m)+'</select>'
    + '<span id="'+id+'Suffix1" style="font-size:13px;color:var(--ink-soft);">'+(p.type==='range'?'':'前')+'</span>'
    + '<span id="'+id+'RangeExt" style="display:'+(p.type==='range'?'inline':'none')+';">'
    + '<span style="font-size:13px;margin:0 2px;">至</span>'
    + '<select id="'+id+'H2" style="padding:8px 2px;border:2px solid var(--paper-deep);border-radius:8px;font-size:13px;">'+_buildHourOpts(p.h2||12)+'</select>'
    + '<span style="font-size:13px;">:</span>'
    + '<select id="'+id+'M2" style="padding:8px 2px;border:2px solid var(--paper-deep);border-radius:8px;font-size:13px;">'+_buildMinOpts(p.m2||0)+'</select>'
    + '</span></span>'
    + '<input id="'+id+'Text" value="'+(p.text||'')+'" placeholder="如 刷牙2分钟" style="display:'+(p.type==='text'?'block':'none')+';flex:1;padding:8px 10px;border:2px solid var(--paper-deep);border-radius:8px;font-size:13px;min-width:100px;">'
    + '</div></div>';
}
function _toggleTimeType(id) {
  var type = document.getElementById(id+'Type').value;
  document.getElementById(id+'TimePick').style.display = type==='text'?'none':'flex';
  document.getElementById(id+'Text').style.display = type==='text'?'block':'none';
  document.getElementById(id+'Suffix1').textContent = type==='range'?'':'前';
  document.getElementById(id+'RangeExt').style.display = type==='range'?'inline':'none';
}
function _readTimeRule(id) {
  var type = document.getElementById(id+'Type').value;
  if (type==='text') return document.getElementById(id+'Text').value.trim();
  var h = document.getElementById(id+'H').value, m = document.getElementById(id+'M').value;
  if (type==='range') {
    var h2 = document.getElementById(id+'H2').value, m2 = document.getElementById(id+'M2').value;
    return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+'-'+String(h2).padStart(2,'0')+':'+String(m2).padStart(2,'0');
  }
  return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+'前';
}

function _readHabitFormFields(prefix, h) {
  var t = document.getElementById(prefix+'Title').value.trim();
  if (!t) { showToast('请输入习惯名称'); return false; }
  h.title = t;
  h.emoji = document.getElementById(prefix+'Emoji').value || '📌';
  h.ownerMemberId = document.getElementById(prefix+'Member').value;
  h.streakNeed = parseInt(document.getElementById(prefix+'Streak').value) || 5;
  h.expValue = parseInt(document.getElementById(prefix+'Exp').value) || 10;
  h.coinValue = parseInt(document.getElementById(prefix+'Coin').value) || 10;
  h.applicable = document.getElementById(prefix+'Applicable').value;
  h.ruleText = _readTimeRule(prefix+'Rule');
  h.ruleVacation = _readTimeRule(prefix+'RuleVacation');
  return true;
}

function showHabitEditForm(h, onSave) {
  showModalForm('✎ 编辑习惯', _renderHabitFormFields(h, 'he'), function() {
    if (!_readHabitFormFields('he', h)) return false;
    saveData(); showToast('✅ 已更新');
    if (onSave) onSave();
  });
}

// ========== Level-Up Celebration ==========
function checkLevelUps() {
  const children = getChildMembers();
  children.forEach(m => {
    const newLevel = getMemberLevel(m.id);
    const prevLevel = _lastKnownLevels[m.id] || 0;
    if (newLevel > prevLevel && prevLevel > 0) {
      showLevelUp(m.id, newLevel);
    }
    _lastKnownLevels[m.id] = newLevel;
  });
}
function showLevelUp(memberId, level) {
  const el = document.getElementById('lvlupOverlay'); if (!el) return;
  document.getElementById('lvlupBadge').textContent = 'Lv.' + level;
  document.getElementById('lvlupTitle').textContent = getTitleForLevel(level);
  // Find unlocked collectible
  const collectible = rewardItems.find(r => r.kind === 'collectible' && r.unlockLevel === level);
  const unlockDiv = document.getElementById('lvlupUnlock');
  let unlockHtml = '<div class="lu-label">🎁 新物品解锁</div>';
  let hasUnlock = false;
  if (collectible) {
    unlockHtml += '<div class="lu-item">' + (collectible.emoji || '🎁') + '</div><div class="lu-name">' + collectible.title + '</div>';
    hasUnlock = true;
  }
  // Find newly unlocked outfit item
  Object.keys(OUTFIT_DEFINITIONS).forEach(cat => {
    OUTFIT_DEFINITIONS[cat].forEach(item => {
      if (item.unlockLevel === level) {
        unlockHtml += '<div class="lu-item">' + (item.emoji || '👕') + '</div><div class="lu-name">🎨 ' + item.name + '</div>';
        hasUnlock = true;
      }
    });
  });
  if (hasUnlock) {
    unlockDiv.style.display = 'block';
    unlockDiv.innerHTML = unlockHtml;
  } else { unlockDiv.style.display = 'none'; }
  // Add description
  document.getElementById('lvlupDesc').textContent = hasUnlock ? 'HabitRat 获得了新装扮，继续保持哦！' : '继续加油，养成好习惯！';
  // Confetti
  spawnConfetti();
  el.classList.add('show');
  document.getElementById('lvlupClose').textContent = '太棒了！';
  document.getElementById('lvlupClose').onclick = function() { el.classList.remove('show'); };
  // Auto close after 4s
  setTimeout(function() { el.classList.remove('show'); }, 4000);
}

function showLevelInfo(targetLevel) {
  const el = document.getElementById('lvlupOverlay'); if (!el) return;
  const memberId = selectedMemberId || (getChildMembers()[0] || {}).id;
  if (!memberId) return;
  const prog = getExpProgress(memberId);
  const level = targetLevel || prog.level;
  const isCurrentLevel = level === prog.level;
  document.getElementById('lvlupBadge').textContent = 'Lv.' + level;
  document.getElementById('lvlupTitle').textContent = getTitleForLevel(level);
  if (isCurrentLevel) {
    document.getElementById('lvlupDesc').textContent = '总EXP: ' + prog.currentExp + ' · 距下一级还需 ' + prog.needExp + ' EXP (' + prog.progress + '%)';
  } else if (level < prog.level) {
    document.getElementById('lvlupDesc').textContent = '✅ 已于 Lv.' + level + ' 解锁 · 当前等级 Lv.' + prog.level;
  } else {
    document.getElementById('lvlupDesc').textContent = '🔒 尚未解锁 · 当前等级 Lv.' + prog.level + ' · 距解锁还需 ' + (getExpForLevel(level) - prog.currentExp) + ' EXP';
  }
  // Show unlocked collectibles and outfits at this level
  const unlockDiv = document.getElementById('lvlupUnlock');
  const items = [];
  // Collectibles unlocked at exactly this level
  rewardItems.filter(r => r.kind === 'collectible' && r.unlockLevel === level).forEach(r => {
    items.push({ emoji: r.emoji || '🎁', name: r.title, tag: '徽章' });
  });
  // Outfits unlocked at exactly this level
  Object.keys(OUTFIT_DEFINITIONS).forEach(cat => {
    OUTFIT_DEFINITIONS[cat].forEach(item => {
      if (item.unlockLevel === level) items.push({ emoji: item.emoji || '👕', name: item.name, tag: '🎨装扮' });
    });
  });
  // Also show items from previous levels
  const prevItems = [];
  const currentLevel = level;
  // All collectibles
  rewardItems.filter(r => r.kind === 'collectible' && r.unlockLevel < currentLevel).forEach(r => {
    prevItems.push({ emoji: '✅', name: r.title, tag: 'Lv.' + r.unlockLevel });
  });
  // All outfits
  Object.keys(OUTFIT_DEFINITIONS).forEach(cat => {
    OUTFIT_DEFINITIONS[cat].forEach(item => {
      if (item.unlockLevel < currentLevel) prevItems.push({ emoji: '✅', name: item.name, tag: 'Lv.' + item.unlockLevel + '·🎨' });
    });
  });

  let unlockHtml = '';
  if (items.length > 0) {
    unlockHtml += '<div class="lu-label">🎁 本级别解锁</div>';
    items.forEach(it => {
      unlockHtml += '<div class="lu-item" style="font-size:24px;">' + it.emoji + '</div><div class="lu-name">' + it.tag + ' ' + it.name + '</div>';
    });
  }
  if (prevItems.length > 0) {
    const recentPrev = prevItems.slice(-6);
    unlockHtml += '<div class="lu-label" style="margin-top:8px;">🏆 已解锁 (' + prevItems.length + '件)</div>';
    recentPrev.forEach(it => {
      unlockHtml += '<div style="display:inline-block;margin:2px 4px;font-size:11px;color:rgba(255,255,255,0.65);">' + it.emoji + ' ' + it.name + '</div>';
    });
    if (prevItems.length > 6) unlockHtml += '<div style="font-size:10px;color:rgba(255,255,255,0.4);">...等</div>';
  }
  if (!unlockHtml) {
    unlockHtml = '<div class="lu-label">🌱 继续打卡升级来解锁物品吧！</div>';
  }
  unlockDiv.style.display = 'block';
  unlockDiv.innerHTML = unlockHtml;
  // Change close button
  document.getElementById('lvlupClose').textContent = '太好啦！';
  // Show overlay, no auto-close
  el.classList.add('show');
  document.getElementById('lvlupClose').onclick = function() { el.classList.remove('show'); };
}
function spawnConfetti() {
  const emojis = ['🎉','✨','🌟','💫','🎊','⭐','🎀','💎'];
  const overlay = document.getElementById('lvlupOverlay');
  for (let i = 0; i < 8; i++) {
    const span = document.createElement('span');
    span.className = 'lvlup-confetti';
    span.textContent = emojis[i % emojis.length];
    span.style.left = (10 + Math.random() * 80) + '%';
    span.style.top = (5 + Math.random() * 30) + '%';
    span.style.animation = 'confettiFall ' + (1 + Math.random() * 1.5) + 's ease forwards';
    span.style.animationDelay = (Math.random() * .5) + 's';
    overlay.appendChild(span);
    setTimeout(function() { span.remove(); }, 2500);
  }
}

// ========== recomputeStreaks (dual-currency) ==========
/** 核心引擎：遍历一年内的打卡数据，重算连续天数、发放 EXP/Coin、检测升级。每次打卡/编辑后必须调用 */
function recomputeStreaks() {
  streakState = {}; effectiveLog = {};
  const todayStr = fmtDateFull(new Date());

  // 建立已处理记录索引：已发过 EXP/Coin 的日期+习惯 不再重复发放，保留历史分值
  var earnedExpSet = {};
  var earnedCoinSet = {};
  transactions.forEach(function(t) {
    if (t.type === 'earn_exp' && t.reason && t.reason.startsWith('[单次] ')) {
      var key = t.createdAt + '|' + t.reason.slice(4); // date|habitTitle
      earnedExpSet[key] = true;
    }
    if (t.type === 'earn_coin' && t.reason && t.reason.indexOf(' 连续达标') > -1) {
      earnedCoinSet[t.createdAt + '|' + t.reason] = true;
    }
  });

  // 清除孤儿交易：打卡状态已变为 ✗/○ 但交易还在的
  var validExpKeys = {};
  var validCoinKeys = {};
  const cursor2 = new Date(); cursor2.setFullYear(cursor2.getFullYear() - 1);
  while (fmtDateFull(cursor2) <= todayStr) {
    var ds2 = fmtDateFull(cursor2);
    getActiveHabits().forEach(function(h) {
      if (!isDayApplicable(h, cursor2)) return;
      if (getDayStatus(h, cursor2) === '✓') {
        validExpKeys[ds2 + '|' + h.title] = true;
        // Check if this day completes a streak (same logic as below)
        var sc = (streakState[h.id] && streakState[h.id].count) || 0;
        var prevDate = (streakState[h.id] && streakState[h.id].lastDate) || null;
        if (prevDate && datesConsecutive(new Date(prevDate), cursor2)) { sc++; }
        else if (prevDate && prevDate === ds2) {}
        else { sc = 1; }
        if (!streakState[h.id]) streakState[h.id] = { count: 0, lastDate: null };
        streakState[h.id].count = sc;
        streakState[h.id].lastDate = ds2;
        if (sc >= (h.streakNeed || 5)) {
          validCoinKeys[ds2 + '|' + h.title + ' 连续达标'] = true;
          streakState[h.id].count = 0;
          streakState[h.id].lastDate = null;
        }
      } else if (getDayStatus(h, cursor2) === '✗' || (getDayStatus(h, cursor2) === '○' && ds2 < todayStr)) {
        if (streakState[h.id]) { streakState[h.id].count = 0; streakState[h.id].lastDate = null; }
      }
    });
    cursor2.setDate(cursor2.getDate() + 1);
  }
  // Remove orphan transactions (status changed but old tx remains)
  transactions = transactions.filter(function(t) {
    if (t.type === 'earn_exp' && t.reason && t.reason.startsWith('[单次] ')) {
      return validExpKeys[t.createdAt + '|' + t.reason.slice(4)];
    }
    if (t.type === 'earn_coin' && t.reason && t.reason.indexOf(' 连续达标') > -1) {
      return validCoinKeys[t.createdAt + '|' + t.reason];
    }
    return true;
  });

  // Reset for the actual computation pass
  streakState = {}; effectiveLog = {};
  members.forEach(function(m) { if (m.role === 'child') m.totalExp = 0; });

  getActiveHabits().forEach(function(h) {
    streakState[h.id] = { count: 0, lastDate: null };
    effectiveLog[h.id] = [];
  });

  // Main computation pass: only add NEW transactions for unprocessed dates
  var cursor = new Date(); cursor.setFullYear(cursor.getFullYear() - 1);
  while (fmtDateFull(cursor) <= todayStr) {
    var ds = fmtDateFull(cursor);
    getActiveHabits().forEach(function(h) {
      if (!isDayApplicable(h, cursor)) return;
      var status = getDayStatus(h, cursor);
      if (status === '✓') {
        var meta = getHabitMeta(h.id);
        var singleExp = h.expValue || meta.expValue || 10;
        var expKey = ds + '|' + h.title;
        // Only add earn_exp if not already processed (preserves historical value)
        if (!earnedExpSet[expKey]) {
          transactions.push({ id: genId(), memberId: meta.ownerMemberId, type: 'earn_exp', amount: singleExp, reason: '[单次] ' + h.title, createdAt: ds });
        }
        // Recalculate member totalExp from ALL earn_exp transactions (not just new ones)
        var mem = getMemberById(meta.ownerMemberId);
        if (mem && !earnedExpSet[expKey]) mem.totalExp += singleExp;

        var prev = streakState[h.id].lastDate;
        if (prev && datesConsecutive(new Date(prev), cursor)) { streakState[h.id].count++; }
        else if (prev && prev === ds) {}
        else { streakState[h.id].count = 1; }
        streakState[h.id].lastDate = ds;

        if (streakState[h.id].count >= (h.streakNeed || 5)) {
          effectiveLog[h.id].push({ date: ds, pts: (h.expValue || h.coinValue || 10) * (h.streakNeed || 5) });
          var earnCoin = (h.coinValue || meta.coinValue || 10) * (h.streakNeed || 5);
          var coinKey = ds + '|' + h.title + ' 连续达标';
          // Only add earn_coin if not already processed
          if (!earnedCoinSet[coinKey]) {
            transactions.push({ id: genId(), memberId: meta.ownerMemberId, type: 'earn_coin', amount: earnCoin, reason: h.title + ' 连续达标', createdAt: ds });
          }
          streakState[h.id].count = 0;
          streakState[h.id].lastDate = null;
        }
      } else if (status === '✗' || (status === '○' && ds < todayStr)) {
        streakState[h.id].count = 0; streakState[h.id].lastDate = null;
      }
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  // Recompute totalExp from ALL earn_exp transactions
  members.forEach(function(m) {
    if (m.role === 'child') {
      m.totalExp = transactions.filter(function(t) { return t.memberId === m.id && (t.type === 'earn_exp' || t.type === 'bonus_exp'); }).reduce(function(s, t) { return s + t.amount; }, 0);
    }
  });
  checkLevelUps();
}

function getEffPts(habitId) { return (effectiveLog[habitId]||[]).reduce((s,e) => s + e.pts, 0); }
function getStreakCount(habitId) { return (streakState[habitId]||{}).count || 0; }



/** 切换今日/周/月时联动更新：统计行小字 + 完成进度行显隐 + 进度条数值 */
function updatePeriodSummary(period) {
  const childId = getChildMembers()[0]?.id || selectedMemberId || members[0]?.id;
  if (!childId) return;
  const today = new Date(); const todayStr = fmtDateFull(today);
  let earned = 0, spent = 0, totalDone = 0, totalAll = 0;
  let label = '', rangeStart, rangeEnd;
  if (period === 'today') {
    earned = transactions.filter(t => t.memberId === childId && (t.type === 'earn_coin' || t.type === 'bonus_coin') && t.createdAt === todayStr).reduce((s, t) => s + t.amount, 0);
    spent = transactions.filter(t => t.memberId === childId && t.type === 'spend_coin' && t.createdAt === todayStr).reduce((s, t) => s + t.amount, 0);
    label = '今日'; rangeStart = todayStr; rangeEnd = todayStr;
    getActiveHabits().forEach(h => { if (isDayApplicable(h, today)) { totalAll++; if (getDayStatus(h, today) === '✓') totalDone++; } });
    document.getElementById('completionRow').style.display = 'none';
  } else if (period === 'week') {
    const mon = getMonday(today); const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    rangeStart = fmtDateFull(mon); rangeEnd = fmtDateFull(sun);
    earned = transactions.filter(t => t.memberId === childId && (t.type === 'earn_coin' || t.type === 'bonus_coin') && t.createdAt >= rangeStart && t.createdAt <= rangeEnd).reduce((s, t) => s + t.amount, 0);
    spent = transactions.filter(t => t.memberId === childId && t.type === 'spend_coin' && t.createdAt >= rangeStart && t.createdAt <= rangeEnd).reduce((s, t) => s + t.amount, 0);
    label = '本周';
    for (let i = 0; i < 7; i++) { const d = new Date(mon); d.setDate(mon.getDate() + i); if (fmtDateFull(d) > todayStr) break; getActiveHabits().forEach(h => { if (!isDayApplicable(h, d)) return; totalAll++; if (getDayStatus(h, d) === '✓') totalDone++; }); }
    document.getElementById('completionRow').style.display = 'flex';
    document.getElementById('completionLabel').textContent = '本周';
  } else if (period === 'month') {
    const ym = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
    earned = transactions.filter(t => t.memberId === childId && (t.type === 'earn_coin' || t.type === 'bonus_coin') && t.createdAt && t.createdAt.startsWith(ym)).reduce((s, t) => s + t.amount, 0);
    spent = transactions.filter(t => t.memberId === childId && t.type === 'spend_coin' && t.createdAt && t.createdAt.startsWith(ym)).reduce((s, t) => s + t.amount, 0);
    label = '本月';
    const cursor = new Date(today.getFullYear(), today.getMonth(), 1);
    while (cursor.getMonth() === today.getMonth()) { const ds = fmtDateFull(cursor); if (ds > todayStr) break; getActiveHabits().forEach(h => { if (!isDayApplicable(h, cursor)) return; totalAll++; if (getDayStatus(h, cursor) === '✓') totalDone++; }); cursor.setDate(cursor.getDate() + 1); }
    document.getElementById('completionRow').style.display = 'flex';
    document.getElementById('completionLabel').textContent = '本月';
  }
  // Update stat period subtotals
  const earnPeriod = document.getElementById('statusEarnedPeriod');
  if (earnPeriod) earnPeriod.textContent = label + '+' + earned;
  const spentPeriod = document.getElementById('statusSpentPeriod');
  if (spentPeriod) spentPeriod.textContent = label + '+' + spent;
  // Update completion row
  const pct = totalAll > 0 ? Math.round(totalDone / totalAll * 100) : 0;
  document.getElementById('completionFill').style.width = pct + '%';
  document.getElementById('completionCount').textContent = totalDone + '/' + totalAll + ' 已完成';
}

// ========== Month View ==========
function renderMonthView() {
  const grid = getCalendarGrid(currentMonth.getFullYear(), currentMonth.getMonth());
  const today = fmtDateFull(new Date());
  const monthKey = currentMonth.getFullYear()+'-'+String(currentMonth.getMonth()+1).padStart(2,'0');
  let html = '<table><thead><tr><th>一</th><th>二</th><th>三</th><th>四</th><th>五</th><th>六</th><th>日</th></tr></thead><tbody>';
  grid.forEach(row => {
    html += '<tr>';
    row.forEach(date => {
      const ds = fmtDateFull(date); const isOther = date.getMonth() !== currentMonth.getMonth();
      const isToday = ds === today; const cls = isOther ? 'other-month' : '';
      let dotHtml = '', dotCls = 'dot-future';
      if (ds <= today && !isOther) {
        let total = 0, done = 0;
        getActiveHabits().forEach(h => { if (!isDayApplicable(h, date)) return; total++; if (getDayStatus(h, date) === '✓') done++; });
        if (total === 0) { dotHtml = '—'; dotCls = 'dot-na'; }
        else if (done === total) { dotHtml = '●'; dotCls = 'dot-all'; }
        else if (done > 0) { dotHtml = '◎'; dotCls = 'dot-partial'; }
        else { dotHtml = '◌'; dotCls = 'dot-none'; }
      } else if (!isOther) { dotHtml = '○'; dotCls = 'dot-future'; }
      html += '<td class="'+cls+(isToday?' today':'')+'" data-date="'+ds+'"><div class="day-num">'+date.getDate()+'</div>';
      if (dotHtml) html += '<div class="day-dot '+dotCls+'">'+dotHtml+'</div>';
      html += '</td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  document.getElementById('monthCalendar').innerHTML = html;
  document.getElementById('monthLabel').textContent = currentMonth.getFullYear() + '年' + (currentMonth.getMonth() + 1) + '月';
  // 月导航条
  const thisMonth = new Date(); thisMonth.setDate(1);
  const isThisMonth = currentMonth.getFullYear() === thisMonth.getFullYear() && currentMonth.getMonth() === thisMonth.getMonth();
  document.getElementById('mnPrev').onclick = function() { changeMonth(-1); };
  const mnNext = document.getElementById('mnNext');
  mnNext.disabled = isThisMonth;
  mnNext.onclick = isThisMonth ? null : function() { changeMonth(1); };
  const mnToday = document.getElementById('mnToday');
  mnToday.disabled = isThisMonth;
  mnToday.onclick = isThisMonth ? null : function() { currentMonth = new Date(); currentMonth.setDate(1); renderMonthView(); updateHeader(); };
  renderWeekProgress();
  renderMonthProgress();
  document.querySelectorAll('#monthCalendar td[data-date]').forEach(td => {
    td.addEventListener('click', function() { const ds = this.dataset.date; const todayStr2 = fmtDateFull(new Date()); if (ds > todayStr2) { showToast('⏳ The day is in the future!'); return; } const d = new Date(ds + 'T00:00:00'); if (ds === todayStr2) { goToday(); } else { showDayDetail(d); } });
  });
  document.getElementById('weekProgress').onclick = function() { goToWeek(new Date()); };
}
function renderWeekProgress() {
  const today = new Date(); const monday = getMonday(today); let total = 0, done = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i); const ds = fmtDateFull(d);
    if (ds > fmtDateFull(today)) break;
    getActiveHabits().forEach(h => { if (!isDayApplicable(h, d)) return; total++; if (getDayStatus(h, d) === '✓') done++; });
  }
  const pct = total > 0 ? Math.round(done/total*100) : 0;
  document.getElementById('wpFill').style.width = pct + '%';
  document.getElementById('wpText').textContent = done + '/' + total;
  // 标题和日期范围
  const wkKey = getWeekKey(monday);
  const wkNum = wkKey.split('-W')[1] || '';
  const sun = new Date(monday); sun.setDate(monday.getDate() + 6);
  document.getElementById('wpTitle').textContent = '第' + wkNum + '周';
  document.getElementById('wpRange').textContent = fmtDate(monday) + ' - ' + fmtDate(sun);
}

function renderMonthProgress() {
  const today = new Date(); const todayStr = fmtDateFull(today);
  const ym = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  let total = 0, done = 0;
  const cursor = new Date(today.getFullYear(), today.getMonth(), 1);
  while (cursor.getMonth() === today.getMonth()) {
    const ds = fmtDateFull(cursor);
    if (ds > todayStr) break;
    getActiveHabits().forEach(h => { if (!isDayApplicable(h, cursor)) return; total++; if (getDayStatus(h, cursor) === '✓') done++; });
    cursor.setDate(cursor.getDate() + 1);
  }
  const pct = total > 0 ? Math.round(done/total*100) : 0;
  document.getElementById('mpFill').style.width = pct + '%';
  document.getElementById('mpText').textContent = done + '/' + total;
}

// ========== Week View ==========
function renderWeekView() {
  if (!currentWeek) currentWeek = getMonday(new Date());
  const weekStart = currentWeek; const dates = [];
  for (let i = 0; i < 7; i++) { const d = new Date(weekStart); d.setDate(weekStart.getDate()+i); dates.push(d); }
  // 周导航条
  const thisMonday = getMonday(new Date());
  const wkKey = getWeekKey(weekStart);
  const wkNum = wkKey.split('-W')[1] || '';
  document.getElementById('wnTitle').textContent = '第' + wkNum + '周';
  document.getElementById('wnPrev').onclick = function() { changeWeek(-1); };
  const isThisWeek = fmtDateFull(weekStart) === fmtDateFull(thisMonday);
  const wnNext = document.getElementById('wnNext');
  wnNext.disabled = isThisWeek;
  wnNext.onclick = isThisWeek ? null : function() { changeWeek(1); };
  const wnToday = document.getElementById('wnToday');
  wnToday.disabled = isThisWeek;
  wnToday.onclick = isThisWeek ? null : function() { currentWeek = getMonday(new Date()); renderWeekView(); updateHeader(); };
  const today = fmtDateFull(new Date()); const DOW = ['一','二','三','四','五','六','日'];
  let cards = '';
  getActiveHabits().forEach(h => {
    let hasAny = false;
    for (let i = 0; i < 7; i++) { if (isDayApplicable(h, dates[i])) { hasAny = true; break; } }
    if (!hasAny) return;
    const streak = getStreakCount(h.id); const effPts = getEffPts(h.id);
    const meta = getHabitMeta(h.id);
    let dotsHtml = '';
    for (let i = 0; i < 7; i++) {
      const ds = fmtDateFull(dates[i]); const status = getDayStatus(h, dates[i]);
      let pillCls;
      if (status === '✓') { pillCls = 'pill-done'; }
      else if (status === '✗') { pillCls = 'pill-miss'; }
      else if (status === 'na') { pillCls = 'pill-na'; }
      else { pillCls = 'pill-pending'; }
      const pillText = dates[i].getDate();
      dotsHtml += '<div class="dot-item" data-habit="'+h.id+'" data-day="'+i+'" data-date="'+ds+'"><span class="dow-label">'+DOW[i]+'</span><div class="pill-status '+pillCls+'">'+pillText+'</div></div>';
    }
    let ruleText = getRuleText(h, dates[0]);
    for (let i = 0; i < 7; i++) { if (getModeForDate(dates[i]) === 'vacation' && (h.ruleVacation || (h.rule && h.rule.ruleVacation))) { ruleText = h.ruleVacation || h.rule.ruleVacation; break; } }
    const barPct = h.streakNeed > 0 ? Math.min(100, streak/h.streakNeed*100) : 0;
    const nearTarget = streak >= h.streakNeed - 1 && streak > 0;
    const cardCls = nearTarget ? ' streak-hot' : (streak > 0 ? ' streak-active' : '');
    // Fire emoji combo
    let fireHtml = '';
    if (streak > 0) { const fires = Math.min(streak, 5); for (let f = 0; f < fires; f++) fireHtml += '🔥'; }
    const streakDisplay = streak > 0 ? '<span class="streak-fire">'+fireHtml+'</span> <span class="streak-count">'+streak+'</span><span class="streak-target">/'+h.streakNeed+'</span>' : '<span class="streak-count">0</span><span class="streak-target">/'+h.streakNeed+'</span>';
    const timeCls = h.id === 'xm_sleep1' ? 'sl-goal1' : (h.id === 'xm_sleep2' ? 'sl-goal2' : 'sl-time');
    const timeSuffix = ' <span class="' + timeCls + '">' + ruleText + '</span>';
    cards += '<div class="habit-card'+cardCls+'" data-habit="'+h.id+'" data-week-start="'+fmtDateFull(weekStart)+'"><div class="card-head"><div class="ch-left"><span class="ch-emoji">'+(h.emoji||'')+'</span><span class="ch-name">'+h.title+timeSuffix+'</span></div><span class="ch-pts"><span class="cp-exp">EXP +'+(h.expValue||meta.expValue)+'</span><span class="cp-coin">💰 +'+(h.coinValue||meta.coinValue)+'</span></span></div>';
    cards += '<div class="card-dots">'+dotsHtml+'</div>';
    cards += '<div class="card-footer"><span class="streak">'+streakDisplay+'</span><div class="streak-bar"><div class="sb-fill'+(nearTarget?' hot':'')+'" style="width:'+barPct+'%"></div></div>';
    if (effPts > 0) cards += '<span class="eff-pts">✅ +'+effPts+'</span>';
    cards += '</div></div>';
  });
  document.getElementById('weekCards').innerHTML = cards;
  // 本周金币汇总
  const childId = getChildMembers()[0]?.id || selectedMemberId || members[0]?.id;
  // Bind events
  bindWeekViewEvents(dates, today);
}
function bindWeekViewEvents(dates, today) {
  // 周视图只读：点列头，过去→日详情，今天→回今日任务
  document.querySelectorAll('.habit-card .dot-item').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', function(e) {
      const dateStr = this.dataset.date;
      if (dateStr > today) { showToast('⏳ The day is in the future!'); return; }
      if (dateStr === today) {
        currentHomeTab = 'today';
        document.querySelectorAll('.home-tab[data-home]').forEach(b => b.classList.remove('active'));
        document.querySelector('.home-tab[data-home="today"]').classList.add('active');
        document.querySelectorAll('.home-pane').forEach(p => p.style.display = 'none');
        document.getElementById('homeToday').style.display = 'block';
        renderHomeView();
      } else {
        showDayDetail(new Date(dateStr + 'T00:00:00'));
      }
    });
  });
}

// ========== Day View ==========
function renderDayView() {
  if (!currentDay) currentDay = new Date();
  const d = currentDay; const ds = fmtDateFull(d); const today = fmtDateFull(new Date());
  const mode = getModeForDate(d); const modeLabel = getModeLabel(mode); const modeClass = getModeClass(mode);
  const DOW = ['一','二','三','四','五','六','日'];
  document.getElementById('dayDate').textContent = fmtDateCN(d) + ' 星期' + DOW[getDayOfWeek(d)];
  const dayModeEl = document.getElementById('dayMode'); dayModeEl.textContent = modeLabel; dayModeEl.className = 'dh-mode mode-badge ' + modeClass;
  const canEdit = ds <= today;
  let html = ''; let doneCount = 0, totalCount = 0, ptsToday = 0;
  getActiveHabits().forEach(h => {
    const status = getDayStatus(h, d); const applicable = isDayApplicable(h, d);
    const ruleText = applicable ? getRuleText(h, d) : '今天不计分';
    const meta = getHabitMeta(h.id);
    if (applicable) totalCount++;
    if (status === '✓') { doneCount++; ptsToday += (h.expValue||h.coinValue||10); }
    let statusBtn, statusCls;
    if (status === '✓') { statusBtn = '✔'; statusCls = 'status-checked'; }
    else if (status === '✗') { statusBtn = '✗'; statusCls = 'status-void'; }
    else { statusBtn = '○'; statusCls = 'status-pending'; }
    const timeClsHr = h.id === 'xm_sleep1' ? 'sl-goal1' : (h.id === 'xm_sleep2' ? 'sl-goal2' : 'sl-time');
    const timeSuffixHr = applicable ? ' <span class="' + timeClsHr + '">' + ruleText + '</span>' : '';
    html += '<div class="habit-row" data-habit="'+h.id+'" data-date="'+ds+'"><span class="hr-emoji">'+(h.emoji||'')+'</span><div class="hr-info"><div class="hr-name">'+h.title+timeSuffixHr+' <span class="hr-person">'+getMemberName(meta.ownerMemberId)+'</span></div></div>';
    html += '<span class="hr-pts"><span class="hr-exp">EXP +'+(h.expValue||meta.expValue)+'</span><span class="hr-coin">Coin +'+(h.coinValue||meta.coinValue)+'</span></span>';
    html += '<span class="hr-status '+statusCls+'">'+statusBtn+'</span>';
    html += '</div>';
  });
  document.getElementById('dayHabits').innerHTML = html;
  const streakDays = calcDayStreak(d);
  document.getElementById('dsDone').textContent = doneCount; document.getElementById('dsTotal').textContent = totalCount - doneCount;
  document.getElementById('dsPts').textContent = '+' + ptsToday; document.getElementById('dsStreak').textContent = streakDays;
  if (canEdit) {
    document.querySelectorAll('.habit-row').forEach(row => { row.addEventListener('click', function(e) {
      const habitId = this.dataset.habit; const dateStr = this.dataset.date;
      const habit = getActiveHabits().find(h => h.id === habitId); if (!habit) return;
      const date = new Date(dateStr + 'T00:00:00');
      if (getDayStatus(habit, date) === 'na') { showToast('今天不计分'); return; }
      const todayStr = fmtDateFull(new Date()); const isToday = dateStr === todayStr;
      function doCycle() { cycleStatus(habit, date); recomputeStreaks(); renderDayView(); showToast('✅'); }
      if (isToday) { doCycle(); } else { dayLockCheck(dateStr, '修改历史打卡', doCycle); }
    }); });
    }
}
function calcDayStreak(date) {
  let count = 0; const cursor = new Date(date); cursor.setHours(0,0,0,0); const today = new Date(); today.setHours(0,0,0,0);
  const limit = fmtDateFull(cursor);
  for (let i = 0; i < 365; i++) {
    const d = new Date(cursor); d.setDate(cursor.getDate() - i); const ds = fmtDateFull(d);
    if (ds > limit) continue; if (ds > fmtDateFull(today)) continue;
    let anyApplicable = false, allDone = true;
    getActiveHabits().forEach(h => { if (!isDayApplicable(h, d)) return; anyApplicable = true; if (getDayStatus(h, d) !== '✓') allDone = false; });
    if (!anyApplicable) continue;
    if (allDone) count++; else break;
  }
  return count;
}


// ========== Growth View ==========
// ========== 数据分析引擎 ==========
function getAnalyticsData(memberId) {
  const today = new Date(); today.setHours(0,0,0,0);
  const habits = getActiveHabits();
  const DOW = ['日','一','二','三','四','五','六'];
  const member = getMemberById(memberId);
  const memberName = member ? member.name : '小美';

  // --- 今天每个习惯的状态 ---
  const todayStr = fmtDateFull(today);
  const todayItems = habits.map(h => ({
    emoji: h.emoji || '📌',
    name: h.title,
    status: isDayApplicable(h, today) ? getDayStatus(h, today) : 'na',
  }));

  // --- 近7天每个习惯的完成情况（排行榜）---
  const habitsRanked = habits.map(h => {
    let done = 0, total = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      if (!isDayApplicable(h, d)) continue;
      total++;
      if (getDayStatus(h, d) === '✓') done++;
    }
    const rate = total ? Math.round(done / total * 100) : 0;
    let mood = rate >= 90 ? '😊' : (rate >= 70 ? '🙂' : (rate >= 40 ? '😐' : '😅'));
    return { emoji: h.emoji || '📌', name: h.title, done, total, rate, mood };
  });
  habitsRanked.sort((a, b) => b.rate - a.rate);

  const goodHabits = habitsRanked.filter(h => h.rate >= 70);
  const weakHabits = habitsRanked.filter(h => h.rate < 70 && h.total > 0);

  // --- 近7天每天的心情（整体完成率）---
  const dailyMoods = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    let done = 0, total = 0;
    habits.forEach(h => { if (!isDayApplicable(h, d)) return; total++; if (getDayStatus(h, d) === '✓') done++; });
    const rate = total ? Math.round(done / total * 100) : 0;
    const mood = total === 0 ? '—' : (rate >= 90 ? '😊' : (rate >= 70 ? '🙂' : (rate >= 40 ? '😐' : '😢')));
    dailyMoods.push({ dow: DOW[d.getDay()], mood, rate, total, done, isToday: i === 0, label: i === 0 ? '今天' : DOW[d.getDay()] });
  }

  // --- 连续全勤天数 ---
  let currentStreak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    let any = false, allDone = true;
    habits.forEach(h => {
      if (!isDayApplicable(h, d)) return;
      any = true;
      if (getDayStatus(h, d) !== '✓') allDone = false;
    });
    if (!any) { if (i === 0) continue; else break; }
    if (allDone) currentStreak++;
    else break;
  }

  // --- 今日统计 ---
  const todayDone = todayItems.filter(i => i.status === '✓').length;
  const todayTotal = todayItems.filter(i => i.status !== 'na').length;
  const allDoneToday = todayTotal > 0 && todayDone === todayTotal;

  // --- 鼓励语（简单自然）---
  let encourage = '';
  if (allDoneToday) {
    encourage = '今天全部完成，太棒啦！🎉';
  } else if (todayDone > 0) {
    encourage = '今天完成了 ' + todayDone + '/' + todayTotal + '，继续加油！👍';
  } else {
    encourage = '今天还没开始呢，一起动起来吧！💪';
  }

  // --- 弱习惯改善建议 ---
  function getWeakTip(habit, rate) {
    if (rate < 30) {
      const tips = [
        '试试把「' + habit.title + '」放在早上做吧 ☀️',
        '今天就开始「' + habit.title + '」，哪怕一次也好 🌱',
        '定个闹钟提醒自己「' + habit.title + '」⏰'
      ];
      return tips[habit.id.charCodeAt(habit.id.length - 1) % tips.length];
    } else {
      const tips = [
        '离目标不远了，这周再努力几次就能达标！🎯',
        '已经做了一半多，坚持下去就会变习惯 ⭐',
        '给自己一个小目标：连续完成3天「' + habit.title + '」🔥'
      ];
      return tips[habit.id.charCodeAt(habit.id.length - 1) % tips.length];
    }
  }

  return { todayItems, todayDone, todayTotal, allDoneToday, habitsRanked, goodHabits, weakHabits, currentStreak, dailyMoods, memberName, encourage, getWeakTip };
}

function renderAnalyticsView(memberId) {
  const ad = getAnalyticsData(memberId);
  const DOW = ['日','一','二','三','四','五','六'];
  const now = new Date();
  const dateStr = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 星期' + DOW[now.getDay()];
  let html = '';

  // === 1. 日期 + 标题 ===
  html += '<div class="aj-date">' + dateStr + '</div>';
  html += '<div class="analytics-section"><div class="aj-today-card">';
  html += '<div class="aj-today-title">🌟 ' + ad.memberName + '的成长周记</div>';

  // === 2. 今日检查清单 ===
  html += '<div style="margin:4px 0 2px;font-size:13px;font-weight:600;color:var(--ink-soft);">📋 今天</div>';
  ad.todayItems.forEach(function(item) {
    if (item.status === 'na') return;
    let statusIcon = item.status === '✓' ? '✅' : (item.status === '✗' ? '❌' : '⏳');
    let statusLabel = item.status === '✓' ? '' : (item.status === '✗' ? ' 没完成' : ' 还没做');
    html += '<div class="aj-today-item">'
      + '<div class="aj-ti-emoji">' + item.emoji + '</div>'
      + '<div class="aj-ti-name">' + item.name + '</div>'
      + '<div class="aj-ti-status">' + statusIcon + statusLabel + '</div>'
      + '</div>';
  });
  // 今日总结
  let summaryText = '';
  if (ad.allDoneToday) {
    summaryText = '🎉 今天 ' + ad.todayDone + '/' + ad.todayTotal + ' 全部完成！你是最棒的！';
  } else if (ad.todayDone > 0) {
    summaryText = '👍 今天完成 ' + ad.todayDone + '/' + ad.todayTotal + '，还有 ' + (ad.todayTotal - ad.todayDone) + ' 项没做，加油！';
  } else {
    summaryText = '💪 今天还没开始打卡，现在做起来吧！';
  }
  html += '<div class="aj-today-summary">' + summaryText + '</div>';
  html += '</div></div>';

  // === 3. 习惯排行榜 ===
  html += '<div class="analytics-section"><div class="aj-rank-card">';
  html += '<div class="aj-rank-title">⭐ 这周的坚持之星</div>';
  ad.habitsRanked.forEach(function(h) {
    if (h.total === 0) return;
    const barCls = h.rate >= 80 ? 'good' : (h.rate >= 50 ? 'ok' : 'low');
    html += '<div class="aj-rank-item">'
      + '<div class="aj-rank-emoji">' + h.emoji + '</div>'
      + '<div class="aj-rank-name">' + h.name + '</div>'
      + '<div class="aj-rank-bar-wrap"><div class="aj-rank-bar ' + barCls + '" style="width:' + h.rate + '%"></div></div>'
      + '<div class="aj-rank-stat">' + h.done + '/' + h.total + '</div>'
      + '<div class="aj-rank-mood">' + h.mood + '</div>'
      + '</div>';
  });
  html += '</div></div>';

  // === 4. 需要加加油 ===
  if (ad.weakHabits.length > 0) {
    html += '<div class="analytics-section"><div class="aj-weak-card">';
    html += '<div class="aj-weak-title">💪 需要多练练</div>';
    ad.weakHabits.forEach(function(h) {
      html += '<div class="aj-weak-item">'
        + '<div class="aj-weak-emoji">' + h.emoji + '</div>'
        + '<div class="aj-weak-info">'
        + '<div class="aj-weak-name">' + h.name + '</div>'
        + '<div class="aj-weak-tip">' + ad.getWeakTip({ title: h.name, id: h.name }, h.rate) + '</div>'
        + '</div>'
        + '<div class="aj-weak-stat">' + h.done + '/' + h.total + '</div>'
        + '</div>';
    });
    html += '</div></div>';
  }

  // === 5. 连续天数 ===
  if (ad.currentStreak > 0) {
    const streakText = ad.currentStreak >= 7
      ? '🔥 连续 ' + ad.currentStreak + ' 天全勤打卡！你太厉害了！'
      : (ad.currentStreak >= 3
        ? '🔥 已经连续 ' + ad.currentStreak + ' 天全部完成，保持住！'
        : '🔥 连续 ' + ad.currentStreak + ' 天全勤，好势头！');
    html += '<div class="analytics-section"><div class="aj-streak-card">'
      + '<div class="aj-streak-fire">🔥</div>'
      + '<div class="aj-streak-text">' + streakText + '</div>'
      + '<div class="aj-streak-sub">每天完成所有习惯就能增加连续天数</div>'
      + '</div></div>';
  }

  // === 6. 每日心情 ===
  html += '<div class="analytics-section"><div style="font-size:13px;font-weight:600;color:var(--ink-soft);margin-bottom:6px;">📅 最近一周</div>';
  html += '<div class="aj-mood-row">';
  ad.dailyMoods.forEach(function(d) {
    html += '<div class="aj-mood-day">'
      + '<div class="aj-mood-emoji">' + d.mood + '</div>'
      + '<div class="aj-mood-label">' + d.label + '</div>'
      + '</div>';
  });
  html += '</div></div>';

  document.getElementById('analyticsScroll').innerHTML = html;
}

function renderGrowthView() {
  const childMembers = getChildMembers();
  if (childMembers.length === 0) {
    document.getElementById('growthView').innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);">还没有添加孩子成员，请去设置中添加</div>';
    return;
  }
  if (!selectedMemberId || !getMemberById(selectedMemberId) || getMemberById(selectedMemberId)?.role !== 'child') {
    selectedMemberId = childMembers[0].id;
  }
  // Member tabs (多孩子时显示)
  let tabHtml = '';
  childMembers.forEach(m => {
    tabHtml += '<button class="gmt-btn'+(m.id === selectedMemberId ? ' active' : '')+'" data-mid="'+m.id+'">'+getMemberName(m.id)+'</button>';
  });
  var mtabs = document.getElementById('growthMemberTabs');
  mtabs.innerHTML = tabHtml;
  mtabs.style.display = childMembers.length > 1 ? 'flex' : 'none';
  // Render scene inline
  const prog = getExpProgress(selectedMemberId);
  renderScene(selectedMemberId);
  switchScene('main'); // reset to main view
  setTimeout(function() { var b = document.getElementById('btnSceneEditor'); if (b) b.style.display = 'block'; }, 300);
  // 收藏品已集成到场景中（徽章墙），隐藏旧网格
  const gcGrid = document.getElementById('gcGrid');
  if (gcGrid) gcGrid.innerHTML = '';
  // 装扮快捷入口
  const childId4Scene = selectedMemberId;
  const sceneOutfits = getUnlockedOutfits(childId4Scene).filter(i => i.unlocked);
  const sceneState = outfitState[childId4Scene] || { clothing: null, companion: null, background: null };


  // Dress-up collection summary
  var dressupSection = document.getElementById('growthRecent');
  if (dressupSection) {
    var outfitCount = sceneOutfits.length;
    var totalOutfits = Object.values(OUTFIT_DEFINITIONS).reduce(function(s, arr) { return s + arr.length; }, 0);
    var equippedCount = [sceneState.clothing, sceneState.companion, sceneState.background].filter(Boolean).length;
    dressupSection.innerHTML = '<div style="display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="toggleDressupPanel()">'
      + '<div style="font-size:24px;">🎀</div>'
      + '<div style="flex:1;"><div style="font-weight:700;font-size:14px;">装扮</div>'
      + '<div style="font-size:12px;color:var(--ink-soft);">已解锁 ' + outfitCount + '/' + totalOutfits + ' · 穿着中 ' + equippedCount + ' 件</div></div>'
      + '<div style="font-size:16px;color:var(--ink-soft);">›</div>'
      + '</div>';
  }
  // 装扮已改为弹窗，旧元素已移除
  // Bind member tabs
  document.querySelectorAll('.gmt-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      selectedMemberId = this.dataset.mid;
      renderGrowthView();
      closeDressupPanel();
    });
  });
  startMicroEventTimer();
}

// ========== 场景切换 ==========
var currentScene = 'main';
// ========== 场景热区编辑器（?editor=1 启用） ==========
var sceneEditorActive = false;

// Show editor button (called after scene renders)
setTimeout(function() {
  var btn = document.getElementById('btnSceneEditor');
  if (btn) btn.style.display = 'block';
}, 500);

function initSceneEditor() {
  var canvas = document.getElementById('sceneEditorCanvas');
  var output = document.getElementById('sceneEditorOutput');
  var bg = document.getElementById('sceneBgImg');
  var btn = document.getElementById('btnSceneEditor');
  if (!canvas || !bg) return;
  if (sceneEditorActive) {
    // Exit edit mode
    sceneEditorActive = false;
    canvas.style.display = 'none';
    output.style.display = 'none';
    output.innerHTML = '';
    if (btn) { btn.textContent = '✎ 编辑热区'; btn.style.background = 'rgba(45,51,64,.8)'; btn.style.color = 'var(--gold)'; }
    return;
  }
  sceneEditorActive = true;
  canvas.style.display = 'block';
  output.style.display = 'block';
  canvas.width = bg.clientWidth;
  canvas.height = bg.clientHeight;
  if (btn) { btn.textContent = '退出编辑'; btn.style.background = 'rgba(200,157,74,.9)'; btn.style.color = '#2D3340'; }
  var ctx = canvas.getContext('2d');
  var drawing = false;
  var editorPts = [];
  var selectedName = null;
  var hadFree = false; // 本次绘制是否经过已有热区之外的自由区域

  function zoneNameAt(xPct, yPct) {
    for (var i = 0; i < sceneZones.length; i++) {
      if (pointInPoly(sceneZones[i].points, xPct, yPct)) return sceneZones[i].name;
    }
    return null;
  }
  function nextZoneName() {
    var max = 0;
    sceneZones.forEach(function(z) {
      var m = /^zone-(\d+)$/.exec(z.name || '');
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return 'zone-' + (max + 1);
  }
  function drawAll() { drawSceneZones(canvas, ctx, selectedName); }
  function refreshOutput() {
    if (selectedName) {
      output.innerHTML = '<div style="display:flex;align-items:center;gap:8px;background:rgba(255,107,107,.15);color:#FF6B6B;padding:8px 12px;border-radius:8px;font-size:13px;">'
        + '🎯 已选中：<b>' + selectedName + '</b>'
        + '<button onclick="deleteZone(\'' + selectedName + '\')" style="margin-left:auto;border:none;border-radius:6px;background:#FF6B6B;color:#fff;padding:4px 10px;font-size:12px;cursor:pointer;">🗑 删除</button></div>';
    } else {
      output.innerHTML = '<div style="background:rgba(45,51,64,.85);color:#EFEAE0;padding:8px 14px;border-radius:8px;font-size:12px;">'
        + '📌 在热区外按住画圈 = 新增 · 点已有热区 = 选中/删除</div>';
    }
  }

  canvas.onmousedown = function(e) {
    e.stopPropagation();
    var rect = canvas.getBoundingClientRect();
    var xPct = (e.clientX - rect.left) / rect.width * 100;
    var yPct = (e.clientY - rect.top) / rect.height * 100;
    var hitName = zoneNameAt(xPct, yPct);
    if (hitName) {
      // 点选已有热区（选中/删除）
      selectedName = hitName;
      drawing = false;
      editorPts = [];
      drawAll();
      refreshOutput();
      return;
    }
    // 空白处开始画圈（新增）
    selectedName = null;
    drawing = true;
    hadFree = true;
    editorPts = [{ x: xPct, y: yPct, snap: false }];
    refreshOutput();
  };
  canvas.onmousemove = function(e) {
    if (!drawing) return;
    var rect = canvas.getBoundingClientRect();
    var x = (e.clientX - rect.left) / rect.width * 100;
    var y = (e.clientY - rect.top) / rect.height * 100;
    var last = editorPts[editorPts.length - 1];
    // 轨迹点过密时跳过，减少数据量
    if (last && Math.abs(x - last.x) < 0.3 && Math.abs(y - last.y) < 0.3) return;
    var sp = applyZoneSnap(x, y);
    if (sp.x !== x || sp.y !== y) {
      // 吸附到已有热区边界：贴近上一吸附点时跳过，避免边界点堆积
      if (last && Math.abs(sp.x - last.x) < 0.3 && Math.abs(sp.y - last.y) < 0.3) return;
      editorPts.push({ x: sp.x, y: sp.y, snap: true });
    } else {
      hadFree = true;
      editorPts.push({ x: x, y: y, snap: false });
    }
    drawAll();
    drawStroke();
  };
  canvas.onmouseup = function() {
    if (!drawing) return;
    drawing = false;
    if (editorPts.length >= 4) {
      var pts = simplifyPath(editorPts, 0.8);
      if (pts.length >= 3) {
        if (hadFree) {
          var name = nextZoneName();
          sceneZones.push({ name: name, points: pts });
          saveData();
          showToast('✅ 已添加热区「' + name + '」');
          selectedName = name;
        } else {
          showToast('⚠️ 该区域已在其他热区内，无法新增');
        }
      }
    }
    editorPts = [];
    hadFree = false;
    drawAll();
    refreshOutput();
  };
  function drawStroke() {
    if (editorPts.length < 2) return;
    var hasSnap = editorPts.some(function(p) { return p.snap; });
    ctx.strokeStyle = hasSnap ? '#1FAE9F' : '#C89D4A'; // 吸附段绿色
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(editorPts[0].x / 100 * canvas.width, editorPts[0].y / 100 * canvas.height);
    for (var i = 1; i < editorPts.length; i++) {
      ctx.lineTo(editorPts[i].x / 100 * canvas.width, editorPts[i].y / 100 * canvas.height);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(200,157,74,0.25)';
    ctx.closePath();
    ctx.fill();
  }

  drawAll();
  refreshOutput();
}

// 绘制全部热区（金色描边 + 半透明填充 + 名称标签；选中为红色）
function drawSceneZones(canvas, ctx, selectedName) {
  if (!canvas || !ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  sceneZones.forEach(function(z) {
    var pts = z.points;
    if (!pts || pts.length < 2) return;
    var isSel = z.name === selectedName;
    var color = isSel ? '#FF6B6B' : '#C89D4A';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pts[0].x / 100 * canvas.width, pts[0].y / 100 * canvas.height);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x / 100 * canvas.width, pts[i].y / 100 * canvas.height);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = isSel ? 'rgba(255,107,107,0.3)' : 'rgba(200,157,74,0.25)';
    ctx.fill();
    var cx = 0, cy = 0;
    pts.forEach(function(p) { cx += p.x; cy += p.y; });
    ctx.fillStyle = color;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(z.name, cx / pts.length / 100 * canvas.width, cy / pts.length / 100 * canvas.height - 4);
  });
}

// 若点位于某个已有热区内，吸附到该热区边界上最近的点；否则返回原坐标
function applyZoneSnap(x, y) {
  var best = null, bestDist = Infinity;
  for (var i = 0; i < sceneZones.length; i++) {
    var pts = sceneZones[i].points;
    if (!pts || pts.length < 3) continue;
    if (!pointInPoly(pts, x, y)) continue;
    for (var j = 0; j < pts.length; j++) {
      var a = pts[j], b = pts[(j + 1) % pts.length];
      var proj = closestPointOnSegment(a, b, { x: x, y: y });
      var d = (proj.x - x) * (proj.x - x) + (proj.y - y) * (proj.y - y);
      if (d < bestDist) { bestDist = d; best = proj; }
    }
  }
  return best || { x: x, y: y };
}
function closestPointOnSegment(a, b, p) {
  var dx = b.x - a.x, dy = b.y - a.y;
  var len2 = dx * dx + dy * dy;
  if (len2 === 0) return { x: a.x, y: a.y };
  var t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

// 删除热区（供编辑器选中条调用）
function deleteZone(name) {
  var idx = -1;
  for (var i = 0; i < sceneZones.length; i++) { if (sceneZones[i].name === name) { idx = i; break; } }
  if (idx < 0) return;
  sceneZones.splice(idx, 1);
  saveData();
  showToast('🗑 已删除热区「' + name + '」');
  var canvas = document.getElementById('sceneEditorCanvas');
  var output = document.getElementById('sceneEditorOutput');
  if (canvas) {
    var ctx = canvas.getContext('2d');
    drawSceneZones(canvas, ctx, null);
  }
  if (output) output.innerHTML = '<div style="background:rgba(45,51,64,.85);color:#EFEAE0;padding:8px 14px;border-radius:8px;font-size:12px;">📌 在热区外按住画圈 = 新增 · 点已有热区 = 选中/删除</div>';
  var btn = document.getElementById('btnSceneEditor');
  if (btn && sceneEditorActive) { btn.textContent = '退出编辑'; btn.style.background = 'rgba(200,157,74,.9)'; btn.style.color = '#2D3340'; }
}

// ===== 复制到剪贴板（Clipboard API + execCommand 降级）=====
function copyText(txt) {
  function fallback() {
    var ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      if (typeof showToast === 'function') showToast('📋 已复制');
    } catch (e) {
      if (typeof showToast === 'function') showToast('⚠️ 复制失败，请手动选择文本复制');
    }
    document.body.removeChild(ta);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(function() {
      if (typeof showToast === 'function') showToast('📋 已复制');
    }).catch(function() { fallback(); });
  } else {
    fallback();
  }
}

// ===== 路径抽稀（Douglas-Peucker）=====
function simplifyPath(points, tol) {
  if (points.length < 3) return points;
  var a = points[0], b = points[points.length - 1];
  var dmax = 0, idx = 0;
  for (var i = 1; i < points.length - 1; i++) {
    var d = perpDist(points[i], a, b);
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax > tol) {
    var l = simplifyPath(points.slice(0, idx + 1), tol);
    var r = simplifyPath(points.slice(idx), tol);
    return l.slice(0, l.length - 1).concat(r);
  }
  return [a, b];
}
function perpDist(p, a, b) {
  var dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.sqrt((p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y));
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / Math.sqrt(dx * dx + dy * dy);
}

// ===== 点在多边形内判定（射线法）=====
function pointInPoly(pts, x, y) {
  var inside = false;
  for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    var xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

// 默认热区（首次使用时初始化；之后以用户编辑保存的为准）
const DEFAULT_SCENE_ZONES = [
  { name: 'zone-1', points: [{x:4,y:51},{x:12,y:51},{x:12,y:75},{x:4,y:75}] },    // 洗脸区
  { name: 'zone-2', points: [{x:13,y:47},{x:31,y:47},{x:31,y:61},{x:13,y:61}] }, // 床
  { name: 'zone-3', points: [{x:4,y:28},{x:20,y:28},{x:20,y:48},{x:4,y:48}] },   // 窗户
  { name: 'zone-4', points: [{x:31,y:51},{x:40,y:51},{x:40,y:63},{x:31,y:63}] }, // 宝箱
  { name: 'zone-5', points: [{x:35,y:28},{x:47,y:28},{x:47,y:45},{x:35,y:45}] }, // 成就室2（占位）
  { name: 'zone-6', points: [{x:59,y:29},{x:78,y:29},{x:78,y:66},{x:59,y:66}] }, // 书桌
  { name: 'zone-7', points: [{x:72,y:70},{x:97,y:70},{x:97,y:95},{x:72,y:95}] }, // 餐桌
];
// 热区名 → 跳转目标场景（'dressup' = 打开装扮面板）。zone-8 / zone-9 待定，暂不关联。
const SCENE_NAME_MAP = {
  // 用户自定义热区
  'zone-1': 'wash', 'zone-2': 'sleep', 'zone-3': 'window', 'zone-4': 'dressup',
  'zone-5': 'trophy', 'zone-6': 'desk', 'zone-7': 'dining',
  // 兼容旧默认热区名
  window: 'window', 'wash-1': 'wash', 'wash-2': 'wash', sleep: 'sleep',
  chest: 'dressup', desk: 'desk', dining: 'dining'
};
// 深拷贝默认热区，避免共享引用
function defaultSceneZones() {
  return DEFAULT_SCENE_ZONES.map(z => ({ name: z.name, points: z.points.map(p => ({ x: p.x, y: p.y })) }));
}
function hitZone(xPct, yPct) {
  for (var i = 0; i < sceneZones.length; i++) {
    var z = sceneZones[i];
    if (z.points && pointInPoly(z.points, xPct, yPct)) return true;
  }
  return false;
}
function handleSceneHover(e) {
  if (sceneEditorActive) return; // 编辑热区时禁用场景手势
  if (currentScene !== 'main') return;
  var room = document.getElementById('sceneRoom');
  var rect = room.getBoundingClientRect();
  var xPct = (e.clientX - rect.left) / rect.width * 100;
  var yPct = (e.clientY - rect.top) / rect.height * 100;
  room.style.cursor = hitZone(xPct, yPct) ? 'pointer' : 'default';
}

function handleSceneClick(e) {
  if (sceneEditorActive) return; // 编辑热区时禁用场景切换
  if (e.target.tagName === 'BUTTON') return;
  var room = document.getElementById('sceneRoom');
  var rect = room.getBoundingClientRect();
  var xPct = (e.clientX - rect.left) / rect.width * 100;
  var yPct = (e.clientY - rect.top) / rect.height * 100;
  if (currentScene === 'main') {
    for (var i = 0; i < sceneZones.length; i++) {
      var z = sceneZones[i];
      if (z.points && pointInPoly(z.points, xPct, yPct)) {
        var target = SCENE_NAME_MAP[z.name];
        if (target === 'dressup') { toggleDressupPanel(); return; }
        if (target) { switchScene(target); return; }
        showToast('「' + z.name + '」尚未关联场景'); return;
      }
    }
  } else if (currentScene === 'desk') {
    // 点击书桌中央弹出徽章收藏
    if (xPct > 30 && xPct < 70 && yPct > 20 && yPct < 60) showBadgeCollection();
  }
}

function showBadgeCollection() {
  const childId = getChildMembers()[0]?.id || selectedMemberId || members[0]?.id;
  if (!childId) return;
  const level = getMemberLevel(childId);
  const badges = getDefaultCollectibles();
  var overlay = document.getElementById('badgeOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'badgeOverlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = '<div class="modal-card" style="max-width:340px;padding:20px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">'
      + '<span style="font-size:16px;font-weight:700;">🏆 徽章收藏</span>'
      + '<button id="badgeClose" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--ink-soft);padding:4px 8px;">✕</button>'
      + '</div><div id="badgeGrid"></div></div>';
    document.body.appendChild(overlay);
    document.getElementById('badgeClose').onclick = function() { overlay.classList.remove('show'); };
    overlay.onclick = function(e) { if (e.target === overlay) overlay.classList.remove('show'); };
  }
  var html = '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;padding:8px 0;">';
  badges.forEach(function(b) {
    var unlocked = level >= b.level;
    html += '<div style="width:56px;text-align:center;padding:8px 4px;border-radius:12px;background:' + (unlocked ? 'var(--paper)' : 'rgba(0,0,0,0.04)') + ';">'
      + '<div style="font-size:28px;line-height:1.2;' + (unlocked ? '' : 'filter:grayscale(1);opacity:.3') + '">' + b.emoji + '</div>'
      + '<div style="font-size:10px;color:var(--ink-soft);margin-top:2px;' + (unlocked ? '' : 'opacity:.4') + '">' + (unlocked ? b.name : 'Lv.' + b.level) + '</div>'
      + '</div>';
  });
  html += '</div>';
  document.getElementById('badgeGrid').innerHTML = html;
  overlay.classList.add('show');
}

var sceneImages = {
  main: 'docs/design/场景图.jpg',
  wash: 'docs/design/洗脸区.jpg',
  window: 'docs/design/窗外.jpg',
  dining: 'docs/design/餐桌.jpg',
  sleep: 'docs/design/睡觉.jpg',
  desk: 'docs/design/书桌.jpg',
  trophy: 'docs/design/成就室2.png'
};
function switchScene(scene) {
  var bg = document.getElementById('sceneBgImg');
  if (bg) {
    bg.classList.add('switching');
    setTimeout(function() {
      bg.src = sceneImages[scene] || sceneImages.main;
      bg.classList.remove('switching');
    }, 200);
  }
  currentScene = scene;
  var back = document.getElementById('sceneBackBtn');
  var room = document.getElementById('sceneRoom');
  var decos = document.getElementById('sceneDecos');
  var rat = document.getElementById('sceneRat');
  var isMain = scene === 'main';
  if (room) {
    room.classList.toggle('scene-main', isMain);
    room.classList.toggle('scene-desk', scene === 'desk');
    room.style.cursor = '';
  }
  // 书桌场景：中央可点击区域指示
  var deskZone = document.getElementById('deskClickZone');
  if (scene === 'desk') {
    if (!deskZone) {
      deskZone = document.createElement('div');
      deskZone.id = 'deskClickZone';
      deskZone.className = 'desk-click-zone';
      deskZone.style.cssText = 'position:absolute;top:35%;left:35%;width:30%;height:30%;z-index:10;cursor:pointer;border-radius:12px;pointer-events:auto;';
      // 提示文字用 ::after 实现（hover 时显示）
      deskZone.onclick = function(e) { e.stopPropagation(); showBadgeCollection(); };
      room.appendChild(deskZone);
    }
    deskZone.style.display = 'flex';
  } else if (deskZone) {
    deskZone.style.display = 'none';
  }
  if (back) back.style.display = isMain ? 'none' : 'block';
  if (decos) decos.style.display = isMain ? '' : 'none';
  if (rat) rat.style.display = isMain ? '' : 'none';
  // 场景提示
  var zhTL = document.getElementById('zoneHintTl');
  var zhTR = document.getElementById('zoneHintTr');
  var zhBL = document.getElementById('zoneHintBl');
  var zhBR = document.getElementById('zoneHintBr');
  var zhShow = isMain ? '' : 'none';
  if (zhTL) zhTL.style.display = zhShow;
  if (zhTR) zhTR.style.display = zhShow;
  if (zhBL) zhBL.style.display = zhShow;
  if (zhBR) zhBR.style.display = zhShow;
}

function openRulesModal() {
  var body = document.getElementById('rulesModalBody');
  var overlay = document.getElementById('rulesOverlay');
  if (!body || !overlay) return;
  var html = '';
  GAME_RULES.forEach(function(section) {
    html += '<div class="rule-section">'
      + '<div class="rule-title">' + section.emoji + ' ' + section.title + '</div>';
    section.lines.forEach(function(line) {
      html += '<div class="rule-line">' + line + '</div>';
    });
    if (section.tip) {
      html += '<div class="rule-tip">💡 ' + section.tip + '</div>';
    }
    html += '</div>';
  });
  body.innerHTML = html;
  overlay.classList.add('show');
}
function closeRulesModal() {
  var overlay = document.getElementById('rulesOverlay');
  if (overlay) overlay.classList.remove('show');
}

let _dressupOpen = false;
function toggleDressupPanel() {
  _dressupOpen = !_dressupOpen;
  var overlay = document.getElementById('dressupOverlay');
  if (!overlay) return;
  overlay.classList.toggle('show', _dressupOpen);
  if (_dressupOpen) renderDressupView();
}
function closeDressupPanel() {
  _dressupOpen = false;
  var overlay = document.getElementById('dressupOverlay');
  if (overlay) overlay.classList.remove('show');
}

// ========== 小老鼠的家 场景渲染 ==========
function renderScene(memberId) {
  const prog = getExpProgress(memberId);
  const level = prog.level;
  // Level evolution: room decorations
  toggleEvo('evoFlower', level >= 4);
  toggleEvo('evoStars', level >= 10);
  toggleEvo('evoFrame', level >= 15);

  // Milestone decorations
  checkMilestones(memberId, level);
  // Weather & seasonal
  checkWeatherAndSeason();
  // Particles
  spawnDustParticles();
  spawnMagicParticles(level);
  spawnFireflies();

}
function toggleEvo(id, show) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('unlocked', show);
}
// ---- Milestone System ----
function getStreakDays(memberId) {
  var today = new Date(); today.setHours(0,0,0,0);
  var count = 0;
  for (var i = 0; i < 365; i++) {
    var d = new Date(today); d.setDate(d.getDate() - i); var ds = fmtDateFull(d);
    var any = false, allDone = true;
    getActiveHabits().forEach(function(h) {
      if (!isDayApplicable(h, d)) return; any = true;
      if (getDayStatus(h, d) !== '✓') allDone = false;
    });
    if (!any) continue;
    if (allDone) count++; else break;
  }
  return count;
}

function checkMilestones(memberId, level) {
  if (!roomState[memberId]) roomState[memberId] = { flags: 0, trophies: 0, lastStreak: 0 };
  var rs = roomState[memberId];
  var streak = getStreakDays(memberId);
  // Track peak streak
  if (streak > rs.lastStreak) { rs.lastStreak = streak; saveData(true); }
  // 7-day: rug
  var rug = document.getElementById('decoRug');
  if (rug) { if (rs.lastStreak >= 7) rug.classList.add('unlocked'); else rug.classList.remove('unlocked'); }
  // 30-day: flag (one-time unlock)
  var flag = document.getElementById('decoFlag');
  if (flag && rs.flags === 0 && rs.lastStreak >= 30) { rs.flags = 1; saveData(true); }
  if (flag) { if (rs.flags >= 1) flag.classList.add('unlocked'); }
  // 100-day: trophy
  var trophy = document.getElementById('decoTrophy');
  if (trophy && rs.trophies === 0 && rs.lastStreak >= 100) { rs.trophies = 1; saveData(true); }
  if (trophy) { if (rs.trophies >= 1) trophy.classList.add('unlocked'); }
  // Level furniture
  var books = document.getElementById('decoBooks');
  if (books) { if (level >= 5) books.classList.add('unlocked'); else books.classList.remove('unlocked'); }
  var plant = document.getElementById('decoPlant');
  if (plant) { if (level >= 10) plant.classList.add('unlocked'); else plant.classList.remove('unlocked'); }
}

// ---- Weather & Seasonal ----
function checkWeatherAndSeason() {
  var now = new Date();
  var month = now.getMonth() + 1, date = now.getDate();
  // Christmas lights: Dec 15 - Jan 5
  var lights = document.getElementById('xmasLights');
  if (lights) {
    var isXmas = (month === 12 && date >= 15) || (month === 1 && date <= 5);
    if (isXmas) {
      if (!lights.innerHTML) { for (var i = 0; i < 12; i++) lights.innerHTML += '<div class="light-bulb"></div>'; }
      lights.classList.add('active');
    } else { lights.classList.remove('active'); }
  }
  // Halloween: Oct 25-31
  // (future: spider web overlay, etc.)
}

// ---- Micro Event Timer ----
var microEventTimer = null;
function startMicroEventTimer() {
  stopMicroEventTimer();
  scheduleNextMicroEvent();
}
function stopMicroEventTimer() {
  if (microEventTimer) { clearTimeout(microEventTimer); microEventTimer = null; }
}
function scheduleNextMicroEvent() {
  var events = [
    { id: 'microFirefly', min: 35, max: 55 },
    { id: 'microMagic', min: 60, max: 90 },
    { id: 'microGlint', min: 80, max: 120 },
  ];
  var ev = events[Math.floor(Math.random() * events.length)];
  var delay = (ev.min + Math.random() * (ev.max - ev.min)) * 1000;
  microEventTimer = setTimeout(function() {
    triggerMicroEvent(ev.id);
    scheduleNextMicroEvent();
  }, delay);
}
function triggerMicroEvent(id) {
  var el = document.getElementById(id); if (!el) return;
  el.classList.remove('fire');
  void el.offsetWidth; // force reflow
  el.classList.add('fire');
  // Cleanup after animation
  setTimeout(function() { el.classList.remove('fire'); }, 3000);
}

// ---- Particle generators ----
function spawnDustParticles() {
  var container = document.getElementById('sceneDust'); if (!container) return;
  var html = '';
  for (var i = 0; i < 15; i++) {
    var size = (1.5 + Math.random() * 3).toFixed(1);
    var startX = (Math.random() * 90).toFixed(1) + '%';
    var startY = (40 + Math.random() * 55).toFixed(1) + '%';
    var endX = ((parseFloat(startX) + (Math.random() - .5) * 60)).toFixed(1) + '%';
    var endY = ((parseFloat(startY) - 30 - Math.random() * 50)).toFixed(1) + '%';
    var dur = (20 + Math.random() * 20).toFixed(1);
    var delay = (Math.random() * 25).toFixed(1);
    var op = (.12 + Math.random() * .2).toFixed(2);
    html += '<div class="dust-particle" style="width:' + size + 'px;height:' + size + 'px;left:' + startX + ';top:' + startY + ';--drift-dur:' + dur + 's;--drift-delay:-' + delay + 's;--start-x:0px;--start-y:0px;--end-x:' + (parseFloat(endX)-parseFloat(startX)).toFixed(0) + 'px;--end-y:' + (parseFloat(endY)-parseFloat(startY)).toFixed(0) + 'px;--dust-op:' + op + ';"></div>';
  }
  container.innerHTML = html;
}
function spawnMagicParticles(level) {
  var container = document.getElementById('sceneMagic'); if (!container) return;
  var count = level >= 10 ? 6 : (level >= 5 ? 3 : 1);
  var html = '';
  for (var i = 0; i < count; i++) {
    var x = (10 + Math.random() * 75).toFixed(0) + '%';
    var y = (20 + Math.random() * 50).toFixed(0) + '%';
    var dur = (8 + Math.random() * 14).toFixed(1);
    var delay = (Math.random() * 10).toFixed(1);
    var dx1 = ((Math.random() - .5) * 40).toFixed(0);
    var dy1 = (-10 - Math.random() * 30).toFixed(0);
    var dx2 = ((Math.random() - .5) * 50).toFixed(0);
    var dy2 = (-25 - Math.random() * 30).toFixed(0);
    var dx3 = ((Math.random() - .5) * 30).toFixed(0);
    var dy3 = (-40 - Math.random() * 25).toFixed(0);
    html += '<div class="magic-particle" style="width:3px;height:3px;left:' + x + ';top:' + y + ';--m-dur:' + dur + 's;--m-delay:-' + delay + 's;--m-dx1:' + dx1 + 'px;--m-dy1:' + dy1 + 'px;--m-dx2:' + dx2 + 'px;--m-dy2:' + dy2 + 'px;--m-dx3:' + dx3 + 'px;--m-dy3:' + dy3 + 'px;"></div>';
  }
  container.innerHTML = html;
}
function spawnFireflies() {
  var container = document.getElementById('sceneDust'); if (!container) return;
  var existing = container.innerHTML;
  for (var i = 0; i < 3; i++) {
    var x = (10 + Math.random() * 80).toFixed(0) + '%';
    var y = (15 + Math.random() * 60).toFixed(0) + '%';
    var dur = (18 + Math.random() * 15).toFixed(1);
    var delay = (Math.random() * 20).toFixed(1);
    var rx1 = ((Math.random() - .5) * 80).toFixed(0);
    var ry1 = (-5 - Math.random() * 35).toFixed(0);
    var rx2 = ((Math.random() - .5) * 100).toFixed(0);
    var ry2 = (-20 - Math.random() * 40).toFixed(0);
    var rx3 = ((Math.random() - .5) * 60).toFixed(0);
    var ry3 = (-10 - Math.random() * 30).toFixed(0);
    var rx4 = ((Math.random() - .5) * 70).toFixed(0);
    var ry4 = (-30 - Math.random() * 25).toFixed(0);
    var rx5 = ((Math.random() - .5) * 40).toFixed(0);
    var ry5 = (-40 - Math.random() * 30).toFixed(0);
    existing += '<div class="firefly" style="left:' + x + ';top:' + y + ';--ff-dur:' + dur + 's;--ff-delay:-' + delay + 's;--ff-x1:' + rx1 + 'px;--ff-y1:' + ry1 + 'px;--ff-x2:' + rx2 + 'px;--ff-y2:' + ry2 + 'px;--ff-x3:' + rx3 + 'px;--ff-y3:' + ry3 + 'px;--ff-x4:' + rx4 + 'px;--ff-y4:' + ry4 + 'px;--ff-x5:' + rx5 + 'px;--ff-y5:' + ry5 + 'px;"></div>';
  }
  container.innerHTML = existing;
}

// ========== Points Sheet ==========
function showPointsSheet(defaultTab) {
  document.getElementById('pointsOverlay').classList.add('show');
  document.getElementById('pointsSheet').classList.add('show');
  updatePointsSheet();
  // Switch to default tab if specified
  if (defaultTab) {
    document.querySelectorAll('[data-ps-tab]').forEach(b => b.classList.remove('active'));
    const targetBtn = document.querySelector('[data-ps-tab="' + defaultTab + '"]');
    if (targetBtn) {
      targetBtn.classList.add('active');
      document.getElementById('psFormSpend').style.display = defaultTab === 'spend' ? 'block' : 'none';
      document.getElementById('psFormCollect').style.display = defaultTab === 'collect' ? 'block' : 'none';
    }
  }
}
function hidePointsSheet() {
  document.getElementById('pointsOverlay').classList.remove('show');
  document.getElementById('pointsSheet').classList.remove('show');
}
function updatePointsSheet() {
  updateStatusBar();
  if (!selectedMemberId || !getMemberById(selectedMemberId)) selectedMemberId = getChildMembers()[0]?.id || members[0]?.id;
  renderExchangeItems();
  renderCollectItems();
  renderPointsLog(new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0'));
}
function renderExchangeItems() {
  const consumables = rewardItems.filter(r => r.kind === 'consumable');
  const c = document.getElementById('psItems'); let html = '';
  consumables.forEach((item, i) => {
    html += '<div class="shop-item-card" data-idx="'+i+'">';
    html += '<div class="shop-item-top"><span class="psi-name">'+item.title+'</span><span class="psi-cost-tag">💰 '+item.cost+' / '+(item.unit||'次')+'</span></div>';
    html += '<div class="shop-item-mid"><span class="psi-qty">数量 <input type="number" class="psi-qty-input" value="1" min="1" data-idx="'+i+'"></span><span class="psi-total" id="psiTotal'+i+'">= <b>'+item.cost+'</b> 💰</span></div>';
    html += '<button class="psi-spend shop-spend-btn" data-idx="'+i+'">兑换</button>';
    html += '<button class="psi-del shop-del-btn" data-idx="'+i+'" title="删除">✕</button>';
    html += '</div>';
  });
  // 自定义添加项目
  html += '<div class="shop-custom" style="margin-top:12px;padding:12px;border:2px dashed var(--paper-deep);border-radius:12px;">';
  html += '<div style="font-size:13px;font-weight:700;margin-bottom:8px;">＋ 自定义兑换项目</div>';
  html += '<input id="newItemName" placeholder="项目名称" style="width:100%;padding:8px 10px;border:2px solid var(--paper-deep);border-radius:8px;font-size:13px;margin-bottom:6px;">';
  html += '<input id="newItemDetail" placeholder="内容说明（可选）" style="width:100%;padding:8px 10px;border:2px solid var(--paper-deep);border-radius:8px;font-size:13px;margin-bottom:6px;">';
  html += '<input id="newItemCost" type="number" placeholder="消耗金币（必填）" min="1" value="10" style="width:100%;padding:8px 10px;border:2px solid var(--paper-deep);border-radius:8px;font-size:13px;margin-bottom:6px;">';
  html += '<div style="display:flex;gap:6px;"><input id="newItemUnit" placeholder="单位" value="次" style="width:80px;padding:8px 10px;border:2px solid var(--paper-deep);border-radius:8px;font-size:13px;"><button id="btnAddItem" style="flex:1;padding:8px;background:var(--ink);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">添加</button></div>';
  html += '</div>';
  c.innerHTML = html;
  // Bind qty input
  document.querySelectorAll('.psi-qty-input').forEach(inp => { inp.addEventListener('input', function() {
    const idx = parseInt(this.dataset.idx); const item = consumables[idx]; if (!item) return;
    const qty = parseInt(this.value) || 1;
    const el = document.getElementById('psiTotal'+idx); if (el) el.innerHTML = '= <b>'+(qty*item.cost)+'</b> 💰';
  }); });
  // Bind exchange button
  document.querySelectorAll('.shop-spend-btn').forEach(btn => { btn.addEventListener('click', function(e) { e.stopPropagation();
    const idx = parseInt(this.dataset.idx); const items = rewardItems.filter(r => r.kind === 'consumable');
    const item = items[idx]; if (!item) return;
    const qty = parseInt(document.querySelector('.psi-qty-input[data-idx="'+idx+'"]')?.value) || 1;
    const total = qty * item.cost;
    if (total <= 0 || total > getCoinBalance(selectedMemberId)) { showToast(total<=0?'请输入有效数量':'😅 Coin不够哦'); return; }
    transactions.push({ id: genId(), memberId: selectedMemberId, type: 'spend_coin', amount: total, reason: item.title+' x'+qty, createdAt: fmtDateFull(new Date()) });
    logOp(getMemberName(selectedMemberId), '兑换', item.title+' x'+qty+' (-'+total+' Coin)');
    saveData(); showToast('🎉 兑换成功！'); updatePointsSheet();
  }); });
  // Bind delete
  document.querySelectorAll('.shop-del-btn').forEach(btn => { btn.addEventListener('click', async function(e) { e.stopPropagation();
    const idx = parseInt(btn.dataset.idx); const items = rewardItems.filter(r => r.kind === 'consumable'); const item = items[idx];
    if (item && await showConfirm('删除「' + item.title + '」？', true)) { rewardItems = rewardItems.filter(r => r !== item); saveData(); updatePointsSheet(); }
  }); });
  // Bind add
  const addBtn = document.getElementById('btnAddItem'); if (addBtn) addBtn.addEventListener('click', function() {
    const name = document.getElementById('newItemName').value.trim(); const cost = parseInt(document.getElementById('newItemCost').value) || 0;
    const unit = document.getElementById('newItemUnit').value.trim() || '次';
    if (!name || cost <= 0) { showToast('请填写项目名称和金币值'); return; }
    rewardItems.push({ id: genId(), kind: 'consumable', title: name, cost, unit });
    saveData(); showToast('✅ 已添加');
    document.getElementById('newItemName').value = ''; document.getElementById('newItemCost').value = '';
    document.getElementById('newItemDetail').value = '';
    updatePointsSheet();
  });
}
function renderCollectItems() {
  const collectibles = rewardItems.filter(r => r.kind === 'collectible');
  const level = getMemberLevel(selectedMemberId);
  const c = document.getElementById('psCollectItems'); let html = '';
  collectibles.forEach(item => {
    const unlocked = level >= item.unlockLevel;
    html += '<div class="ps-collect-item '+(unlocked ? 'unlocked' : 'locked')+'"><span class="psc-emoji">'+(unlocked ? (item.emoji||'🎁') : '🔒')+'</span><div class="psc-info"><div class="psc-name">'+item.title+'</div><div class="psc-level">Lv.'+item.unlockLevel+' 解锁</div></div><span class="psc-status '+(unlocked ? 'unlocked' : 'locked')+'">'+(unlocked ? '✅ 已解锁' : '🔒 未解锁')+'</span></div>';
  });
  c.innerHTML = html || '<div style="text-align:center;color:var(--text2);padding:12px;">暂无收藏品</div>';
}
function renderPointsLog(monthKey) {
  const log = transactions.filter(t => t.createdAt && t.createdAt.startsWith(monthKey)).sort((a, b) => (b.createdAt||'').localeCompare(a.createdAt||'') || (b.id||'').localeCompare(a.id||''));
  const container = document.getElementById('psLog'); let html = '<div class="psl-title">📋 本月流水</div>';
  if (log.length === 0) { html += '<div style="font-size:13px;color:var(--text2);padding:8px 0;">暂无记录</div>'; }
  else {
    log.forEach(t => {
      const isExp = t.type === 'earn_exp' || t.type === 'bonus_exp';
      const isNeg = t.type === 'spend_coin' || t.type === 'deduct_coin';
      const amtCls = isNeg ? 'negative' : (isExp ? 'exp' : 'positive');
      const sign = isNeg ? '-' : '+';
      const label = t.type === 'spend_coin' ? '🛍️ 兑换' : t.type === 'deduct_coin' ? '⚠️ 扣分' : t.type === 'bonus_coin' ? '✨ 加分' : t.type === 'bonus_exp' ? '⭐ EXP奖励' : t.type === 'earn_exp' ? '📈 经验' : t.type === 'earn_coin' ? '💰 金币' : '📋 其他';
      html += '<div class="psl-item"><span class="psl-date">'+(t.createdAt||'').slice(5)+'</span><span class="psl-note">'+(getMemberName(t.memberId)||'')+' '+label+' '+(t.reason||'')+'</span><span class="psl-amount '+amtCls+'">'+sign+(t.amount||0)+'</span></div>';
    });
  }
  container.innerHTML = html;
}


// ========== Sync ==========
function getSyncData() {
  return { checks, streakState, effectiveLog, transactions, dateConfig, customItems, operationLog,
    familyCode, parentPin, securityQuestion, securityAnswer, lockedDates, family, members, habitTemplates, rewardItems, _levelConfig, outfitState, roomState, sceneZones, _schemaVersion: 2, _dataVersion };
}
let syncTimer = null, syncPending = false, syncPollInterval = null;
function debounceSyncToServer() { clearTimeout(syncTimer); syncPending = true; syncTimer = setTimeout(() => { syncPending = false; syncToServer(); }, 500); }
function flushSync() { if (syncPending) { clearTimeout(syncTimer); syncPending = false; syncToServer(); } }
// 页面隐藏时立即发送
document.addEventListener('visibilitychange', () => { if (document.hidden) flushSync(); });
// 页面关闭时用 sendBeacon 兜底（比 fetch 更可靠）
window.addEventListener('pagehide', () => { if (syncPending) { clearTimeout(syncTimer); syncPending = false; const data = getSyncData(); data.familyCode = familyCode; navigator.sendBeacon('/api/habit-sync', JSON.stringify(data)); } });

async function syncToServer() {
  if (!familyCode) return;
  if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') return;
  syncStatus = 'syncing'; updateSyncIndicator();
  try {
    const data = getSyncData(); data.familyCode = familyCode;
    const res = await fetch('/api/habit-sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error || res.status); }
    const result = await res.json();
    syncStatus = 'ok'; updateSyncIndicator();
  } catch(e) { syncStatus = 'error'; updateSyncIndicator(); }
}

async function loadFromServer() {
  if (!familyCode) return false;
  if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') return false;
  try {
    const res = await fetch('/api/habit-sync?code=' + familyCode);
    if (!res.ok) return false;
    const r = await res.json();
    if (r.exists === false) { syncStatus = 'unpaired'; updateSyncIndicator(); return false; }
    const serverVer = r._dataVersion || 0;
    if (serverVer > _dataVersion) {
      if (r.checks) checks = r.checks; if (r.streakState) streakState = r.streakState; if (r.effectiveLog) effectiveLog = r.effectiveLog;
      if (r.transactions) transactions = r.transactions;
      if (r.dateConfig) dateConfig = r.dateConfig;
      if (r.customItems) customItems = r.customItems; if (r.operationLog) operationLog = r.operationLog;
      if (r.familyCode) familyCode = r.familyCode; if (r.parentPin !== undefined) parentPin = r.parentPin;
      if (r.securityQuestion !== undefined) securityQuestion = r.securityQuestion; if (r.securityAnswer !== undefined) securityAnswer = r.securityAnswer;
      if (r.lockedDates) lockedDates = r.lockedDates;
      if (r.family) family = r.family; if (r.members) members = r.members;
      if (r.habitTemplates) habitTemplates = r.habitTemplates; if (r.rewardItems) rewardItems = r.rewardItems;
      if (r._levelConfig) _levelConfig = r._levelConfig;
      if (r.outfitState) outfitState = r.outfitState;
      if (r.roomState) roomState = r.roomState;
      if (r.sceneZones) sceneZones = r.sceneZones;
      _dataVersion = serverVer;
      localStorage.setItem('habitrat:familyCode', familyCode);
      lastSyncTime = new Date(); syncStatus = 'ok'; updateSyncIndicator();
      if (!selectedMemberId && members.length > 0) selectedMemberId = getChildMembers()[0]?.id || members[0]?.id;
      return true;
    }
  } catch(e) { /* server unavailable, use local data */ }
  return false;
}

// 30 秒轮询：检查服务器是否有新版本
function startSyncPolling() {
  if (syncPollInterval) clearInterval(syncPollInterval);
  syncPollInterval = setInterval(async () => {
    if (!familyCode) return;
    if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') return;
    const updated = await loadFromServer();
    if (updated) { saveData(true); recomputeStreaks(); refreshCurrentView(); }
  }, 30000);
}
function updateSyncIndicator() {
  const el = document.getElementById('syncIndicator'); if (!el) return;
  const fill = document.getElementById('statusExpFill');
  const baseCls = function() { if (fill) { fill.classList.remove('sync-syncing', 'sync-ok', 'sync-error'); } };
  if (syncStatus === 'syncing') { el.style.display = 'inline'; el.textContent = '🔄'; el.title = '同步中...'; baseCls(); if (fill) fill.classList.add('sync-syncing'); }
  else if (syncStatus === 'ok') { el.style.display = 'inline'; el.textContent = '✅'; el.title = '已同步'; baseCls(); if (fill) { fill.classList.add('sync-ok'); setTimeout(function() { fill.classList.remove('sync-ok'); }, 1500); } }
  else if (syncStatus === 'error') { el.style.display = 'inline'; el.textContent = '⚠️'; el.title = '同步异常'; baseCls(); if (fill) { fill.classList.add('sync-error'); setTimeout(function() { fill.classList.remove('sync-error'); }, 2000); } }
  else if (syncStatus === 'unpaired') { el.style.display = 'inline'; el.textContent = '🔗'; el.title = '未配对'; baseCls(); }
  else { el.style.display = 'none'; baseCls(); }
}

// ========== Log/Backup/Toast ==========
function toggleLog() { const ov = document.getElementById('logOverlay'); if (ov.classList.contains('show')) { ov.classList.remove('show'); } else { renderLog(); ov.classList.add('show'); } }
function renderLog() {
  const list = document.getElementById('logList'); if (!list) return;
  if (operationLog.length === 0) { list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text2)">暂无操作记录</div>'; return; }
  list.innerHTML = operationLog.map(function(e) { var t = new Date(e.time); var timeStr = (t.getMonth()+1)+'/'+t.getDate()+' '+String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0'); return '<div class="log-item"><span class="li-time">'+timeStr+'</span><span class="li-device">'+e.device+'</span><span class="li-person">'+e.person+'</span><span class="li-action">'+e.action+'</span><span class="li-detail">'+e.detail+'</span></div>'; }).join('');
}

// ========== 回顾页面（底部"日志"tab） ==========
function renderReviewPage() {
  var container = document.getElementById('reviewContent');
  if (!container) return;
  var habits = getActiveHabits();
  if (!habits.length) { container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text2)">还没有习惯，去设置中添加吧</div>'; return; }
  var today = new Date(); today.setHours(0,0,0,0);
  var stats = [];
  habits.forEach(function(h) {
    var total = 0, done = 0, streak = 0;
    for (var i = 0; i < 7; i++) {
      var d = new Date(today); d.setDate(today.getDate() - i);
      if (!isDayApplicable(h, d)) continue;
      total++; if (getDayStatus(h, d) === '✓') done++;
    }
    for (var j = 0; j < 60; j++) {
      var d2 = new Date(today); d2.setDate(today.getDate() - j);
      if (!isDayApplicable(h, d2)) continue;
      if (getDayStatus(h, d2) === '✓') streak++; else break;
    }
    var rate = total ? Math.round(done / total * 100) : 0;
    stats.push({ habit: h, rate: rate, done: done, total: total, streak: streak });
  });
  stats.sort(function(a, b) { return b.rate - a.rate; });
  var best = stats.slice(0, 2);
  var worst = stats.slice(-2).reverse();
  var todayTotal = 0, todayDone = 0;
  habits.forEach(function(h) {
    if (!isDayApplicable(h, today)) return;
    todayTotal++; if (getDayStatus(h, today) === '✓') todayDone++;
  });
  var overallRate = 0, overallTotal = 0;
  stats.forEach(function(s) { overallRate += s.rate; overallTotal++; });
  overallRate = overallTotal ? Math.round(overallRate / overallTotal) : 0;

  var html = '';
  html += '<div class="review-summary">'
    + '<div class="rs-card"><div class="rs-val">'+todayDone+'/'+todayTotal+'</div><div class="rs-label">今日完成</div></div>'
    + '<div class="rs-card"><div class="rs-val">'+overallRate+'%</div><div class="rs-label">7天完成率</div></div>'
    + '</div>';

  html += '<div class="review-section"><div class="review-label">⭐ 表现亮眼</div>';
  best.forEach(function(s) {
    html += '<div class="review-item">'
      + '<div class="ri-emoji">'+(s.habit.emoji||'📌')+'</div>'
      + '<div class="ri-info"><div class="ri-name">'+s.habit.title+'</div><div class="ri-msg">'+(s.streak>1?'连续 '+s.streak+' 天坚持，很棒！':'近7天完成 '+s.done+'/'+s.total+' 次')+'</div></div>'
      + '<div class="ri-stat good">'+s.rate+'%</div>'
      + '</div>';
  });
  html += '</div>';

  html += '<div class="review-section"><div class="review-label">💪 继续加油</div>';
  worst.forEach(function(s) {
    var tip = s.rate < 30 ? '试试调整时间，找到合适的节奏' : (s.rate < 60 ? '再坚持一下就能看到变化' : '只差一点点了，加油！');
    html += '<div class="review-item">'
      + '<div class="ri-emoji">'+(s.habit.emoji||'📌')+'</div>'
      + '<div class="ri-info"><div class="ri-name">'+s.habit.title+'</div><div class="ri-msg">'+tip+'</div></div>'
      + '<div class="ri-stat warm">'+s.rate+'%</div>'
      + '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}
function exportFullBackup() {
  const data = getSyncData(); const filename = '好习惯积分表_备份_' + fmtDateFull(new Date()) + '.json';
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url); showToast('📤 完整备份已导出');
}
async function importBackup(file) {
  if (!await showConfirm('⚠️ 当前数据会被覆盖，确定恢复？', true)) return;
  const reader = new FileReader();
  reader.onload = async function(e) { try {
    const data = JSON.parse(e.target.result);
    if (!data.checks && !data.transactions) { showToast('❌ 文件格式不正确'); return; }
    if (!await showConfirm('⚠️ 当前数据会被覆盖，建议先导出一份。确定要恢复吗？', true)) return;
    checks = data.checks || {}; transactions = data.transactions || []; dateConfig = data.dateConfig || { vacationRanges: [] };
    customItems = data.customItems || []; operationLog = data.operationLog || [];
    if (data.familyCode) { familyCode = data.familyCode; localStorage.setItem('habitrat:familyCode', familyCode); }
    if (data.parentPin !== undefined) parentPin = data.parentPin;
    if (data.securityQuestion !== undefined) securityQuestion = data.securityQuestion;
    if (data.securityAnswer !== undefined) securityAnswer = data.securityAnswer;
    if (data.family) family = data.family; if (data.members) members = data.members;
    if (data.habitTemplates) habitTemplates = data.habitTemplates; if (data.rewardItems) rewardItems = data.rewardItems;
    if (data._levelConfig) _levelConfig = data._levelConfig;
    if (data.roomState) roomState = data.roomState;
    if (data.sceneZones) sceneZones = data.sceneZones;
    saveData(); recomputeStreaks();
    refreshCurrentView(); updateHeader(); syncToServer(); showToast('✅ 数据已恢复');
    if (currentView === 'settings') renderSettings();
  } catch(err) { showToast('❌ 文件解析失败'); } }; reader.readAsText(file);
}
function isDateLocked(dateStr) { return !!lockedDates[dateStr]; }
async function toggleTodayLock() {
  const todayStr = fmtDateFull(new Date());
  const locked = isDateLocked(todayStr);
  if (locked) {
    // 解锁需要 PIN
    if (!parentPin) { showToast('⚠️ 请先在设置中设定 PIN'); return; }
    var p = await showPinModal({
      title: '🔐 输入 PIN 解锁当天',
      validate: function(v) { return v === parentPin ? null : '❌ PIN 不正确'; }
    });
    if (!p) return;
    delete lockedDates[todayStr]; saveData(); updateLockButton();
    showToast('🔓 已解锁，可以修改');
  } else {
    // 锁定不需要 PIN
    lockedDates[todayStr] = true; saveData(); updateLockButton();
    showToast('🔒 已锁定，内容固定');
  }
}
function updateLockButton() {
  const btn = document.getElementById('btnDayLock');
  if (!btn) return;
  const todayStr = fmtDateFull(new Date());
  const locked = isDateLocked(todayStr);
  btn.textContent = locked ? '🔒' : '🔓';
  btn.style.color = locked ? 'var(--coral)' : 'var(--text-dim)';
}
function dayLockCheck(dateStr, action, callback) {
  if (isDateLocked(dateStr)) { showToast('🔒 当天已锁定，无法修改'); return; }
  callback();
}
async function unlockWithPin(ds) {
  if (!parentPin) { showToast('⚠️ 请在设置中设定 PIN'); return; }
  var p = await showPinModal({
    title: '🔐 输入 PIN 解锁编辑',
    validate: function(v) { return v === parentPin ? null : '❌ PIN 不正确'; }
  });
  if (!p) return;
  unlockedForEdit[ds] = true;
  showDayDetail(new Date(ds + 'T00:00:00'));
  showToast('🔓 已临时解锁，可编辑');
}
function relockDay(ds) {
  delete unlockedForEdit[ds];
  showDayDetail(new Date(ds + 'T00:00:00'));
}
const _origUpdateStatusBar = updateStatusBar;
updateStatusBar = function() { _origUpdateStatusBar(); updateLockButton(); };
let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  // 智能判断：重要提示3s，错误/警告2.5s，普通2s
  let dur = 2000;
  if (msg.includes('🎉') || msg.includes('解锁') || msg.includes('升级') || msg.includes('恢复') || msg.includes('同步')) dur = 3000;
  else if (msg.includes('❌') || msg.includes('不够') || msg.includes('不正确') || msg.includes('未来') || msg.includes('锁定') || msg.includes('⚠️')) dur = 2500;
  toastTimer = setTimeout(() => el.classList.remove('show'), dur);
}
let _confirmResolve = null;
function showConfirm(msg, isDanger) {
  return new Promise(resolve => {
    _confirmResolve = resolve;
    document.getElementById('confirmMsg').textContent = msg;
    const okBtn = document.getElementById('confirmOk');
    okBtn.className = 'modal-btn modal-ok' + (isDanger ? ' danger' : '');
    document.getElementById('confirmOverlay').classList.add('show');
  });
}
function closeConfirm(result) {
  document.getElementById('confirmOverlay').classList.remove('show');
  if (_confirmResolve) { _confirmResolve(result); _confirmResolve = null; }
}
// 确认弹窗按钮事件（在 init 中绑定）
let _pinResolve = null, _pinValue = '', _pinMode = '';
let _pinValidate = null;
let _secQOnSave = null;

// ===== 密保问题 =====
function openSecQModal(onSave) {
  _secQOnSave = onSave || null;
  var overlay = document.getElementById('secQOverlay');
  if (!overlay) return;
  document.getElementById('secQuestion').value = securityQuestion || '';
  document.getElementById('secAnswer').value = '';
  overlay.classList.add('show');
  setTimeout(function() { var q = document.getElementById('secQuestion'); if (q) q.focus(); }, 50);
}
function saveSecQ() {
  var q = document.getElementById('secQuestion').value.trim();
  var a = document.getElementById('secAnswer').value.trim();
  if (!q) { showToast('⚠️ 请输入密保问题'); return; }
  if (!a) { showToast('⚠️ 请输入答案'); return; }
  securityQuestion = q;
  securityAnswer = a;
  saveData();
  document.getElementById('secQOverlay').classList.remove('show');
  showToast('✅ 密保问题已保存');
  if (_secQOnSave) { var cb = _secQOnSave; _secQOnSave = null; cb(); }
}
function closeSecQModal() {
  var overlay = document.getElementById('secQOverlay');
  if (overlay) overlay.classList.remove('show');
  _secQOnSave = null;
}

// ===== 忘记 PIN 重置 =====
function openForgotPin() {
  var overlay = document.getElementById('forgotPinOverlay');
  if (!overlay) return;
  var qEl = document.getElementById('forgotPinQuestion');
  if (securityQuestion) {
    qEl.textContent = '❓ ' + securityQuestion;
    document.getElementById('forgotPinAnswer').value = '';
    overlay.classList.add('show');
    setTimeout(function() { var a = document.getElementById('forgotPinAnswer'); if (a) a.focus(); }, 50);
  } else {
    // 没设密保问题，无法找回
    showToast('⚠️ 未设置密保问题，无法找回 PIN');
  }
}
function verifyForgotPin() {
  var ans = document.getElementById('forgotPinAnswer').value.trim();
  if (!securityAnswer || ans !== securityAnswer) { showToast('❌ 答案不正确'); return; }
  document.getElementById('forgotPinOverlay').classList.remove('show');
  showToast('✅ 验证通过，请设置新 PIN');
  // 复用设置 PIN 流程
  (async function() {
    var p = await showPinModal({
      title: '🔐 设置新 PIN',
      validate: function(v) { return /^\d{4}$/.test(v) ? null : '⚠️ PIN 必须是 4 位数字'; }
    });
    if (!p) return;
    var p2 = await showPinModal({
      title: '🔐 请再次输入 PIN 确认',
      validate: function(v) { return v === p ? null : '❌ 两次输入不一致，请重试'; }
    });
    if (!p2) return;
    parentPin = p; saveData(); showToast('✅ PIN 已重置');
    settingsUnlocked = true;
    applySettingsLock();
    renderSettings();
  })();
}
function closeForgotPin() {
  var overlay = document.getElementById('forgotPinOverlay');
  if (overlay) overlay.classList.remove('show');
}

function showPinModal(options) {
  return new Promise(resolve => {
    _pinResolve = resolve; _pinValue = ''; _pinMode = options.mode || 'unlock';
    _pinValidate = options.validate || null;
    document.getElementById('pinTitle').textContent = options.title || '🔐 输入 PIN';
    document.getElementById('pinError').textContent = '';
    document.querySelectorAll('.pin-dot').forEach(d => d.className = 'pin-dot');
    document.getElementById('pinOverlay').classList.add('show');
  });
}
function closePinModal(result) {
  document.getElementById('pinOverlay').classList.remove('show');
  _pinValidate = null;
  if (_pinResolve) { _pinResolve(result); _pinResolve = null; }
}
function handlePinKey(key) {
  if (_pinValue.length >= 4) return;
  _pinValue += key;
  const dots = document.querySelectorAll('.pin-dot');
  dots[_pinValue.length - 1].className = 'pin-dot filled';
  document.getElementById('pinError').textContent = '';
  if (_pinValue.length === 4) {
    // 校验回调：返回错误文字则留在弹窗内报错并重置，返回 null 则关闭
    if (_pinValidate) {
      var err = _pinValidate(_pinValue);
      if (err) { handlePinError(err); return; }
    }
    closePinModal(_pinValue);
  }
}
function handlePinDel() {
  if (_pinValue.length === 0) return;
  const dots = document.querySelectorAll('.pin-dot');
  dots[_pinValue.length - 1].className = 'pin-dot';
  _pinValue = _pinValue.slice(0, -1);
  document.getElementById('pinError').textContent = '';
}
function handlePinError(msg) {
  document.getElementById('pinError').textContent = msg;
  document.querySelectorAll('.pin-dot').forEach(d => d.className = 'pin-dot error');
  setTimeout(() => document.querySelectorAll('.pin-dot').forEach(d => d.className = 'pin-dot'), 500);
  _pinValue = '';
}

// ========== Desktop ==========
function isDesktop() { return false; } // 始终移动端，打印通过手动按钮触发
// --- 手机版周报 ---
function renderMobileWeekReport() {
  if (!currentWeek) currentWeek = getMonday(new Date());
  var dates = []; for (var i=0;i<7;i++){var dd=new Date(currentWeek);dd.setDate(currentWeek.getDate()+i);dates.push(dd);}
  var DOW=['一','二','三','四','五','六','日'];
  var mode=getModeForDate(currentWeek);
  var wkNum=getWeekKey(currentWeek).split('-W')[1];
  var savedName=(localStorage.getItem('habitrat:childName')||localStorage.getItem('habitTable_childName'))||'小美';
  var today=fmtDateFull(new Date());

  var S=' style="';
  var css={
    page:'font-family:-apple-system,PingFang SC,Microsoft YaHei,sans-serif;color:#2D3340;max-width:420px;margin:0 auto;padding:16px;background:#F6F1E6;min-height:100vh;',
    h1:'font-size:20px;font-weight:900;text-align:center;margin:0 0 4px;',
    sub:'font-size:12px;color:#7A7367;text-align:center;margin:0 0 14px;',
    statRow:'display:flex;gap:8px;margin-bottom:14px;',
    statBox:'flex:1;background:#fff;border-radius:10px;padding:12px 8px;text-align:center;box-shadow:0 1px 4px rgba(45,51,64,.06);',
    statVal:'font-size:20px;font-weight:800;',
    statLbl:'font-size:10px;color:#7A7367;margin-top:2px;',
    memberTitle:'font-size:13px;font-weight:700;color:#5C6F8E;margin:14px 0 8px;padding-left:4px;',
    card:'background:#fff;border-radius:10px;padding:12px 14px;margin-bottom:8px;box-shadow:0 1px 4px rgba(45,51,64,.06);',
    cardTop:'display:flex;align-items:center;gap:8px;margin-bottom:8px;',
    cardName:'font-size:14px;font-weight:600;flex:1;',
    cardRule:'font-size:11px;color:#5C6F8E;',
    cardMeta:'font-size:11px;color:#7A7367;display:flex;gap:12px;',
    dots:'display:flex;gap:4px;margin-top:8px;',
    dot:'width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-direction:column;',
    dotDone:'background:#E8F8F5;color:#1FAE9F;',
    dotMiss:'background:#FDE8E8;color:#FF6B6B;',
    dotPend:'background:#F0EDE5;color:#B9B2A4;',
    dotNA:'background:#F8F7F4;color:#ddd;',
    dotLabel:'font-size:8px;margin-top:-1px;',
    legend:'display:flex;gap:10px;font-size:10px;color:#7A7367;justify-content:center;margin-top:16px;padding-top:8px;border-top:1px solid #E0D9CB;',
  };

  var totalDone=0,totalAll=0;
  getActiveHabits().forEach(function(hb){for(var d=0;d<7;d++){if(!isDayApplicable(hb,dates[d]))continue;totalAll++;if(getDayStatus(hb,dates[d])==='✓')totalDone++;}});
  var totalExp=getChildMembers().reduce(function(s,m){return s+getTotalExp(m.id);},0);
  var totalCoin=getChildMembers().reduce(function(s,m){return s+getCoinBalance(m.id);},0);

  var h='<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>周报</title></head><body style="'+css.page+'">';
  h+='<div style="'+css.h1+'">📋 周报</div>';
  h+='<div style="'+css.sub+'">'+savedName+' · 第'+wkNum+'周 · '+getModeLabel(mode)+'</div>';
  h+='<div style="'+css.statRow+'">';
  h+='<div style="'+css.statBox+'"><div style="'+css.statVal+'color:#1FAE9F;">'+totalDone+'/'+totalAll+'</div><div style="'+css.statLbl+'">完成率</div></div>';
  h+='<div style="'+css.statBox+'"><div style="'+css.statVal+'">'+totalExp+'</div><div style="'+css.statLbl+'">EXP</div></div>';
  h+='<div style="'+css.statBox+'"><div style="'+css.statVal+'color:#C89D4A;">'+totalCoin+'</div><div style="'+css.statLbl+'">金币</div></div>';
  h+='</div>';

  var memberGroups={};
  getActiveHabits().forEach(function(hb){var m=hb.ownerMemberId;if(!memberGroups[m])memberGroups[m]=[];memberGroups[m].push(hb);});
  Object.entries(memberGroups).forEach(function(entry){
    var mid=entry[0],habits=entry[1];
    h+='<div style="'+css.memberTitle+'">'+getMemberName(mid)+'</div>';
    habits.forEach(function(hb){
      var sc=getStreakCount(hb.id);
      var ruleText=(mode==='vacation'&&hb.ruleVacation)?hb.ruleVacation:(hb.ruleText||'');
      h+='<div style="'+css.card+'">';
      h+='<div style="'+css.cardTop+'"><span style="font-size:20px;">'+(hb.emoji||'📌')+'</span><span style="'+css.cardName+'">'+hb.title+'</span></div>';
      if(ruleText)h+='<div style="'+css.cardRule+'">'+ruleText+'</div>';
      h+='<div style="'+css.cardMeta+'"><span>🔥 '+sc+'/'+hb.streakNeed+'</span><span>EXP '+hb.expValue+'</span><span>💰 '+hb.coinValue+'</span></div>';
      h+='<div style="'+css.dots+'">';
      for(var d=0;d<7;d++){
        var st=getDayStatus(hb,dates[d]);
        var dotCls,dotChar;
        if(st==='✓'){dotCls=css.dotDone;dotChar='✔';}
        else if(st==='✗'){dotCls=css.dotMiss;dotChar='✗';}
        else if(st==='na'){dotCls=css.dotNA;dotChar='—';}
        else{dotCls=css.dotPend;dotChar='○';}
        h+='<div style="'+css.dot+dotCls+'"><span>'+dotChar+'</span><span style="'+css.dotLabel+'">'+DOW[d]+'</span></div>';
      }
      h+='</div></div>';
    });
  });
  h+='<div style="'+css.legend+'"><span>✔ 完成</span><span>✗ 未完成</span><span>○ 待完成</span><span>— 不适用</span></div>';
  h+='</body></html>';
  document.getElementById('printableView').innerHTML = h;
}
// --- A4打印版周报 ---
function renderPrintableWeek() {
  if (!currentWeek) currentWeek = getMonday(new Date());
  var dates = []; for (var i = 0; i < 7; i++) { var dd = new Date(currentWeek); dd.setDate(currentWeek.getDate()+i); dates.push(dd); }
  var today = fmtDateFull(new Date());
  var DOW = ['一','二','三','四','五','六','日'];
  var mode = getModeForDate(currentWeek);
  var wkNum = getWeekKey(currentWeek).split('-W')[1];
  var savedName = (localStorage.getItem('habitrat:childName') || localStorage.getItem('habitTable_childName')) || '小美';

  // Build inline-styled HTML
  var S = ' style="';
  var css = {
    page: 'font-family:-apple-system,PingFang SC,Microsoft YaHei,sans-serif;color:#2D3340;max-width:210mm;margin:0 auto;padding:12mm 14mm;background:#fff;',
    h1: 'font-size:22px;font-weight:900;text-align:center;margin:0 0 2mm;letter-spacing:1px;',
    sub: 'font-size:11px;color:#7A7367;text-align:center;margin:0 0 6mm;',
    statRow: 'display:flex;gap:3mm;margin-bottom:6mm;',
    statBox: 'flex:1;border:2px solid #E0D9CB;border-radius:6px;padding:3mm 4mm;text-align:center;',
    statVal: 'font-size:18px;font-weight:800;',
    statLbl: 'font-size:10px;color:#7A7367;margin-top:1mm;',
    table: 'width:100%;border-collapse:collapse;font-size:11px;',
    th: 'background:#2D3340;color:#EFEAE0;padding:2mm 1.5mm;font-size:10px;font-weight:600;text-align:center;',
    td: 'border:1px solid #E0D9CB;padding:2mm 2mm;text-align:center;vertical-align:middle;',
    tdName: 'text-align:left;font-weight:600;font-size:11px;',
    tdRule: 'text-align:left;font-size:9px;color:#5C6F8E;',
    tdStreak: 'background:#FBF7EF;',
    tdPts: 'font-size:10px;color:#C89D4A;font-weight:600;',
    memberRow: 'background:#F6F1E6;font-weight:700;font-size:12px;text-align:left;',
    dotDone: 'color:#1FAE9F;font-weight:900;font-size:13px;',
    dotMiss: 'color:#FF6B6B;font-weight:900;font-size:12px;',
    dotPend: 'color:#ccc;font-size:12px;',
    dotNA: 'color:#ddd;font-size:11px;',
    legend: 'display:flex;gap:10px;font-size:10px;color:#7A7367;margin-top:4mm;padding-top:2mm;border-top:1px solid #E0D9CB;',
    sign: 'display:flex;gap:10mm;justify-content:flex-end;font-size:11px;margin-top:6mm;',
    signLine: 'border-bottom:1px solid #2D3340;min-width:60px;padding:0 8px;',
  };

  // --- Build HTML ---
  var h = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>好习惯周报</title></head><body style="'+css.page+'">';

  // Header
  h += '<h1 style="'+css.h1+'">🌟 好习惯周报</h1>';
  h += '<div style="'+css.sub+'">'+savedName+' · 第'+wkNum+'周 · '+fmtDate(dates[0])+' — '+fmtDate(dates[6])+' · '+getModeLabel(mode)+'</div>';

  // Stats
  var totalDone = 0, totalAll = 0;
  getActiveHabits().forEach(function(hb) {
    for (var d = 0; d < 7; d++) {
      if (!isDayApplicable(hb, dates[d])) continue;
      totalAll++; if (getDayStatus(hb, dates[d]) === '✓') totalDone++;
    }
  });
  var totalExp = getChildMembers().reduce(function(s,m){return s+getTotalExp(m.id);},0);
  var totalCoin = getChildMembers().reduce(function(s,m){return s+getCoinBalance(m.id);},0);
  h += '<div style="'+css.statRow+'">';
  h += '<div style="'+css.statBox+'"><div style="'+css.statVal+'color:#1FAE9F;">'+totalDone+'/'+totalAll+'</div><div style="'+css.statLbl+'">本周完成</div></div>';
  h += '<div style="'+css.statBox+'"><div style="'+css.statVal+'">'+totalExp+'</div><div style="'+css.statLbl+'">总EXP</div></div>';
  h += '<div style="'+css.statBox+'"><div style="'+css.statVal+'color:#C89D4A;">'+totalCoin+'</div><div style="'+css.statLbl+'">可用金币</div></div>';
  h += '</div>';

  // Table
  h += '<table style="'+css.table+'"><thead><tr>';
  h += '<th style="'+css.th+'">习惯</th>';
  h += '<th style="'+css.th+'">细则</th>';
  h += '<th style="'+css.th+'">连续</th>';
  h += '<th style="'+css.th+'">分值</th>';
  for (var d = 0; d < 7; d++) h += '<th style="'+css.th+'">周'+DOW[d]+'<br>'+dates[d].getDate()+'日</th>';
  h += '</tr></thead><tbody>';

  var memberGroups = {};
  getActiveHabits().forEach(function(hb){var m=hb.ownerMemberId;if(!memberGroups[m])memberGroups[m]=[];memberGroups[m].push(hb);});
  Object.entries(memberGroups).forEach(function(entry) {
    var mid = entry[0], habits = entry[1];
    h += '<tr><td colspan="'+(11)+'" style="'+css.memberRow+'">'+getMemberName(mid)+'</td></tr>';
    habits.forEach(function(hb) {
      var sc = getStreakCount(hb.id);
      var ruleText = (mode==='vacation'&&hb.ruleVacation)?hb.ruleVacation:(hb.ruleText||'');
      h += '<tr>';
      h += '<td style="'+css.td+';'+css.tdName+'">'+(hb.emoji||'')+' '+hb.title+'</td>';
      h += '<td style="'+css.td+';'+css.tdRule+'">'+(ruleText||'—')+'</td>';
      h += '<td style="'+css.td+';'+css.tdStreak+'"><b>'+(sc>0?sc:'0')+'</b>/'+hb.streakNeed+'</td>';
      h += '<td style="'+css.td+';'+css.tdPts+'">E'+hb.expValue+'<br>C'+hb.coinValue+'</td>';
      for (var d = 0; d < 7; d++) {
        var st = getDayStatus(hb, dates[d]);
        var dot, dotStyle = css.td;
        if (st === '✓') { dot = '✔'; dotStyle += css.dotDone; }
        else if (st === '✗') { dot = '✗'; dotStyle += css.dotMiss; }
        else if (st === 'na') { dot = '—'; dotStyle += css.dotNA; }
        else { dot = '○'; dotStyle += css.dotPend; }
        h += '<td style="'+dotStyle+'">'+dot+'</td>';
      }
      h += '</tr>';
    });
  });
  h += '</tbody></table>';

  // Legend & sign
  h += '<div style="'+css.legend+'"><span>✔ 已完成</span><span>✗ 未完成</span><span>○ 待完成</span><span>— 不适用</span></div>';
  h += '<div style="'+css.sign+'"><span>宝贝签字：<span style="'+css.signLine+'"></span></span><span>家长签字：<span style="'+css.signLine+'"></span></span></div>';
  h += '</body></html>';

  document.getElementById('printableView').innerHTML = h;
}


// ========== View Switching ==========
function updateTabPill() {
  var active = document.querySelector('.tabbar .tab.active');
  var pill = document.getElementById('tabbarPill');
  if (!active || !pill) return;
  var bar = active.parentElement;
  var tabs = bar.querySelectorAll('.tab');
  var idx = Array.prototype.indexOf.call(tabs, active);
  if (idx < 0) return;
  var n = tabs.length;
  // 获取 bar 的实际内容宽度（不含 padding）
  var barStyle = window.getComputedStyle(bar);
  var barW = bar.getBoundingClientRect().width - parseFloat(barStyle.paddingLeft) - parseFloat(barStyle.paddingRight);
  // 每个 tab 的实际宽度
  var tabW = barW / n;
  // pill 宽度 = tab 宽度的 85%
  var iw = Math.round(tabW * 0.98);
  // pill 左边缘 = idx * tabW + (tabW - iw) / 2
  var left = Math.round(idx * tabW + (tabW - iw) / 2 + parseFloat(barStyle.paddingLeft));
  pill.style.left = left + 'px';
  pill.style.width = iw + 'px';
}

let settingsUnlocked = false;
function switchView(view) {
  if (view !== 'settings') settingsUnlocked = false;
  currentView = view;
  document.querySelectorAll('#homeView,#growthView,#shopView,#settingsView,#analyticsView').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.tabbar .tab').forEach(t => t.classList.remove('active'));

  if (view === 'home') {
    document.getElementById('homeView').style.display = 'block';
    document.querySelector('.tab[data-tab="home"]').classList.add('active');
    renderHomeView();
  } else if (view === 'growth') {
    document.getElementById('growthView').style.display = 'block';
    document.querySelector('.tab[data-tab="growth"]').classList.add('active');
    document.getElementById('growthLevelPane').style.display = 'block';
    renderGrowthView();
  } else if (view === 'shop') {
    document.getElementById('shopView').style.display = 'block';
    document.querySelector('.tab[data-tab="shop"]').classList.add('active');
    renderShopView();
  } else if (view === 'settings') {
    document.getElementById('settingsView').style.display = 'block';
    document.querySelector('.tab[data-tab="settings"]').classList.add('active');
    applySettingsLock();
    renderSettings();
  } else if (view === 'analytics') {
    document.getElementById('analyticsView').style.display = 'block';
    document.querySelector('.tab[data-tab="analytics"]').classList.add('active');
    renderReviewPage();
  }
  updateHeader();
  updateTabPill();
}
/** 根据 PIN 状态决定设置页是否显示锁屏 */
function applySettingsLock() {
  var lock = document.getElementById('settingsLock');
  var content = document.getElementById('settingsContent');
  if (!lock || !content) return;
  if (!parentPin || settingsUnlocked) {
    lock.classList.remove('show');
    content.style.display = 'block';
  } else {
    lock.classList.add('show');
    content.style.display = 'none';
  }
}
/** 输入 PIN 解锁设置页 */
async function unlockSettings() {
  if (!parentPin) { settingsUnlocked = true; applySettingsLock(); showToast('✅ 设置已解锁'); return; }
  var p = await showPinModal({
    title: '🔐 输入 PIN 解锁设置',
    validate: function(v) { return v === parentPin ? null : '❌ PIN 不正确'; }
  });
  if (!p) return;
  settingsUnlocked = true;
  applySettingsLock();
  showToast('🔓 设置已解锁');
}
function goToWeek(date) {
  currentWeek = getMonday(date); currentHomeTab = 'week';
  // Switch to week sub-tab in home
  document.querySelectorAll('.home-tab[data-home]').forEach(b => b.classList.remove('active'));
  const wkTab = document.querySelector('.home-tab[data-home="week"]');
  if (wkTab) wkTab.classList.add('active');
  document.querySelectorAll('.home-pane').forEach(p => p.style.display = 'none');
  const wkPane = document.getElementById('homeWeek');
  if (wkPane) wkPane.style.display = 'block';
  updatePeriodSummary('week'); renderWeekView(); updateHeader();
}
function goToDay(date) {
  currentDay = new Date(date); currentHomeTab = 'day';
  // Switch to day sub-tab in home
  document.querySelectorAll('.home-tab[data-home]').forEach(b => b.classList.remove('active'));
  const dayTab = document.querySelector('.home-tab[data-home="day"]');
  if (dayTab) dayTab.classList.add('active');
  document.querySelectorAll('.home-pane').forEach(p => p.style.display = 'none');
  const dayPane = document.getElementById('homeDay');
  if (dayPane) dayPane.style.display = 'block';
  renderDayView(); updateHeader();
}
function updateHeader() {
  updateStatusBar();
  const today = new Date();
  const dow = ['日','一','二','三','四','五','六'][today.getDay()];
  const mode = getModeForDate(today);
  const titleEl = document.getElementById('headerTitle');
  if (titleEl) titleEl.innerHTML = fmtDateCN(today) + ' <span class="nav-weekday">星期' + dow + '</span> <span class="mode-tag ' + getModeClass(mode) + '">' + getModeLabel(mode) + '</span>';
  // mode标签已内联在标题中
}
/** 更新 Hero 区域：等级、称号、XP 环、进度百分比、金币统计、每日问候语 */
function updateStatusBar() {
  const childId = getChildMembers()[0]?.id || selectedMemberId || members[0]?.id;
  if (!childId) return;
  const prog = getExpProgress(childId);
  const coin = getCoinBalance(childId);
  // 等级与称号
  const levelEl = document.getElementById('statusLevel');
  if (levelEl) levelEl.textContent = prog.level;
  const titleEl = document.getElementById('statusTitle');
  if (titleEl) titleEl.textContent = getTitleForLevel(prog.level);
  // XP 进度条 + 百分比
  const fillEl = document.getElementById('statusExpFill');
  if (fillEl) { fillEl.style.setProperty('--xp-pct', prog.progress + '%'); fillEl.style.width = prog.progress + '%'; }
  const pctEl = document.getElementById('statusExpPct');
  if (pctEl) pctEl.textContent = prog.progress + '%';
  // 剩余 EXP（跟随进度条位置）
  const needEl = document.getElementById('statusExpNeed');
  if (needEl) {
    needEl.textContent = '还需 ' + prog.needExp + ' EXP';
    var p = prog.progress;
    if (p < 0) p = 0;
    if (p > 100) p = 100;
    if (p > 80) {
      needEl.style.left = 'auto';
      needEl.style.right = '0';
      needEl.style.textAlign = 'right';
    } else {
      needEl.style.left = p + '%';
      needEl.style.right = 'auto';
      needEl.style.textAlign = 'left';
    }
  }
  // 自然语言提示：再做 X 个好习惯就能升级
  const hintEl = document.getElementById('statusExpHint');
  if (hintEl) {
    const avgHabits = Math.max(1, getActiveHabits().length || 1);
    const tasksNeeded = Math.ceil(prog.needExp / Math.max(1, avgHabits));
    if (prog.needExp <= 0) {
      hintEl.textContent = '🎉 已达到满级！太厉害了！';
    } else if (tasksNeeded <= 3) {
      hintEl.textContent = '🔥 再做 ' + tasksNeeded + ' 个好习惯就能升级！';
    } else if (tasksNeeded <= 10) {
      hintEl.textContent = '💪 再做 ' + tasksNeeded + ' 个好习惯，加油！';
    } else {
      hintEl.textContent = '🌟 继续坚持，好习惯在改变你！';
    }
  }
  // 金币相关
  const earnedCoin = transactions.filter(t => t.memberId === childId && (t.type === 'earn_coin' || t.type === 'bonus_coin')).reduce((s, t) => s + t.amount, 0);
  let pendingCoin = 0;
  getActiveHabits().forEach(h => {
    const meta = getHabitMeta(h.id);
    if (meta.ownerMemberId !== childId) return;
    const sc = getStreakCount(h.id);
    if (sc > 0) pendingCoin += (h.coinValue || meta.coinValue || 10) * sc;
  });
  const spentCoin = transactions.filter(t => t.memberId === childId && t.type === 'spend_coin').reduce((s, t) => s + t.amount, 0);
  document.getElementById('statusCoinBal').textContent = coin;
  document.getElementById('statusPendingCoin').textContent = pendingCoin;
  document.getElementById('statusSpentVal').textContent = spentCoin;
  // XP ring
  const ring = document.getElementById('mascotRing');
  if (ring) ring.style.setProperty('--xp-pct', prog.progress);
  // SVG mascot
  renderMascotSvg(childId, 'mascotSvg');
  // Mascot name + avatar
  const mnEl = document.getElementById('mascotName');
  if (mnEl) mnEl.textContent = (localStorage.getItem('habitrat:childName') || localStorage.getItem('habitTable_childName')) || getMemberName(childId) || '小美';
  updateAvatarDisplay();
  // Daily greeting
  const greeting = document.getElementById('dailyGreeting');
  if (greeting) {
    const hour = new Date().getHours();
    if (hour < 6) greeting.textContent = '🌙 夜深了，今天辛苦了';
    else if (hour < 9) greeting.textContent = '🌅 早安！新的一天，新的冒险';
    else if (hour < 12) greeting.textContent = '☀️ 上午好，继续前进';
    else if (hour < 14) greeting.textContent = '🌤️ 中午好，记得休息';
    else if (hour < 18) greeting.textContent = '🌻 下午好，坚持就是力量';
    else greeting.textContent = '🌆 傍晚了，复盘今天的收获吧';
  }
}

function showCoinSources() {
  const childId = getChildMembers()[0]?.id || selectedMemberId || members[0]?.id;
  if (!childId) return;
  const txns = transactions.filter(t => t.memberId === childId && (t.type === 'earn_coin' || t.type === 'bonus_coin')).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  let html = '';
  if (txns.length === 0) {
    html = '<div style="text-align:center;color:var(--ink-soft);padding:20px;">暂无金币记录</div>';
  } else {
    const total = txns.reduce((s, t) => s + t.amount, 0);
    txns.forEach(t => {
      const dateStr = t.createdAt ? t.createdAt.slice(0, 10) : '';
      html += '<div class="css-row"><div style="min-width:0;"><div class="css-reason">' + (t.reason || t.type) + '</div><div class="css-date">' + dateStr + '</div></div><span class="css-amt">💰 +' + t.amount + '</span></div>';
    });
    html += '<div class="css-total"><span>合计</span><span style="color:var(--amber-deep);">💰 ' + total + '</span></div>';
  }
  document.getElementById('cssTitle').textContent = '💰 金币来源';
  document.getElementById('cssBody').innerHTML = html;
  document.getElementById('coinSourceOverlay').classList.add('show');
  document.getElementById('coinSourceSheet').classList.add('show');
}
function hideCoinSources() {
  document.getElementById('coinSourceOverlay').classList.remove('show');
  document.getElementById('coinSourceSheet').classList.remove('show');
}

function showPendingCoins() {
  const childId = getChildMembers()[0]?.id || selectedMemberId || members[0]?.id;
  if (!childId) return;
  let html = '';
  let totalPending = 0;
  getActiveHabits().forEach(h => {
    const meta = getHabitMeta(h.id);
    if (meta.ownerMemberId !== childId) return;
    const sc = getStreakCount(h.id);
    if (sc <= 0) return;
    const coinVal = h.coinValue || meta.coinValue || 10;
    const pending = coinVal * sc;
    totalPending += pending;
    const pct = h.streakNeed > 0 ? Math.min(100, sc / h.streakNeed * 100) : 0;
    html += '<div style="padding:10px 0;border-bottom:1px solid var(--paper-deep);">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
      + '<span style="font-size:13px;font-weight:600;">' + (h.emoji||'') + ' ' + h.title + '</span>'
      + '<span style="font-size:13px;font-weight:700;color:var(--amber-deep);white-space:nowrap;">💰 ' + pending + '</span>'
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:8px;">'
      + '<div style="flex:1;height:6px;background:var(--paper-deep);border-radius:3px;overflow:hidden;">'
      + '<div style="height:100%;background:linear-gradient(90deg,var(--teal),var(--amber));border-radius:3px;width:' + pct + '%;"></div>'
      + '</div>'
      + '<span style="font-size:11px;color:var(--ink-soft);white-space:nowrap;">' + sc + '/' + h.streakNeed + ' 天</span>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--ink-soft);margin-top:4px;">还需连续 <b>' + Math.max(0, h.streakNeed - sc) + '</b> 天可获得 💰' + (coinVal * h.streakNeed) + '</div>'
      + '</div>';
  });
  if (!html) {
    html = '<div style="text-align:center;color:var(--ink-soft);padding:20px;">暂无进行中的连续打卡</div>';
  } else {
    html = '<div style="font-size:12px;color:var(--ink-soft);margin-bottom:8px;">连续达成目标天数后发放金币，中断则清零重计</div>' + html;
    html += '<div class="css-total"><span>待生效合计</span><span style="color:var(--amber-deep);">💰 ' + totalPending + '</span></div>';
  }
  document.getElementById('cssTitle').textContent = '⏳ 待生效金币';
  document.getElementById('cssBody').innerHTML = html;
  document.getElementById('coinSourceOverlay').classList.add('show');
  document.getElementById('coinSourceSheet').classList.add('show');
}

function changeMonth(delta) { currentMonth.setMonth(currentMonth.getMonth() + delta); renderMonthView(); updateHeader(); }
function changeWeek(delta) { currentWeek.setDate(currentWeek.getDate() + delta * 7); renderWeekView(); updateHeader(); }
function changeDay(delta) { currentDay.setDate(currentDay.getDate() + delta); renderDayView(); updateHeader(); }
function goToday() {
  if (currentView === 'home') {
    // Switch to today sub-tab
    currentHomeTab = 'today';
    document.querySelectorAll('.home-tab[data-home]').forEach(b => b.classList.remove('active'));
    const todayBtn = document.querySelector('.home-tab[data-home="today"]');
    if (todayBtn) { todayBtn.classList.add('active'); }
    document.querySelectorAll('.home-pane').forEach(p => p.style.display = 'none');
    document.getElementById('homeToday').style.display = 'block';
    updatePeriodSummary('today'); renderHomeView();
  } else if (currentView === 'week' || (document.getElementById('homeWeek') && document.getElementById('homeWeek').style.display !== 'none')) { currentWeek = getMonday(new Date()); renderWeekView(); updateHeader(); }
  else if (currentView === 'growth') { renderGrowthView(); updateHeader(); }
  else { currentMonth = new Date(); currentMonth.setDate(1); renderMonthView(); updateHeader(); }
}

// ========== 刷新当前视图 ==========
function refreshCurrentView() {
  if (currentView === 'home') renderHomeView();
  else if (currentView === 'growth') renderGrowthView();
  else if (currentView === 'shop') renderShopView();
  else if (currentView === 'settings') renderSettings();
  else if (currentView === 'analytics') { renderReviewPage(); }
  else renderHomeView();
  updateStatusBar();
}

// ========== Settings ==========
/** 自动保存假期配置：读取设置页中的假期行并保存 */
function saveVacationConfig(showTip) {
  const ranges = [];
  document.querySelectorAll('#settingsView .vacation-row').forEach(row => {
    const nameEl = row.querySelector('.v-name'); const startEl = row.querySelector('.v-start'); const endEl = row.querySelector('.v-end');
    if (nameEl && startEl && endEl && startEl.value && endEl.value) {
      ranges.push({ name: nameEl.tagName === 'INPUT' ? nameEl.value : nameEl.textContent, start: startEl.value, end: endEl.value });
    }
  });
  dateConfig.vacationRanges = ranges;
  saveData();
  updateHeader();
  if (showTip !== false) showToast('✅ 已自动保存');
}
function renderSettings() {
  // Child name
  var cnInput = document.getElementById('ssChildName');
  if (cnInput) cnInput.value = (localStorage.getItem('habitrat:childName') || localStorage.getItem('habitTable_childName')) || '小美';
  // Vacation（编辑后自动保存）
  const container = document.getElementById('vacationList'); container.innerHTML = '';
  if (dateConfig.vacationRanges.length === 0) { dateConfig.vacationRanges = [{ name:'暑假',start:'2026-07-01',end:'2026-08-31'},{ name:'寒假',start:'2027-01-18',end:'2027-02-28'}]; }
  function bindVacationRow(row) {
    row.querySelectorAll('.v-name, .v-start, .v-end').forEach(function(input) {
      input.addEventListener('change', function() { saveVacationConfig(); });
    });
    row.querySelector('.del-vacation').addEventListener('click', function() { row.remove(); saveVacationConfig(); });
  }
  dateConfig.vacationRanges.forEach((r, i) => {
    const row = document.createElement('div'); row.className = 'vacation-row';
    row.innerHTML = '<span class="v-name">'+r.name+'</span><input type="date" class="v-start" value="'+r.start+'"><span>至</span><input type="date" class="v-end" value="'+r.end+'"><button class="del-vacation">✕</button>';
    container.appendChild(row);
    bindVacationRow(row);
  });
  document.getElementById('addVacation').onclick = function() {
    const row = document.createElement('div'); row.className = 'vacation-row';
    row.innerHTML = '<input class="v-name" value="自定义假期" style="width:80px;border:2px solid var(--paper-deep);border-radius:8px;padding:6px;font-size:13px;"><input type="date" class="v-start" value=""><span>至</span><input type="date" class="v-end" value=""><button class="del-vacation">✕</button>';
    container.appendChild(row);
    bindVacationRow(row);
  };
  // Members
  renderMemberSettings();
  // Habits
  renderHabitSettings();
  // Family code & invite
  if (!familyCode) { familyCode = generateFamilyCode(); localStorage.setItem('habitrat:familyCode', familyCode); saveData(true); }
  var fcEl = document.getElementById('ssFamilyCode'); if (fcEl) fcEl.textContent = familyCode;
  var inviteLink = 'https://www.habitrat.com/join/' + familyCode;
  var invEl = document.getElementById('ssInviteSection');
  if (invEl) invEl.innerHTML = '<div class="ss-invite-link" style="margin-bottom:4px;">'+inviteLink+'</div><button id="ssCopyLink" style="font-size:12px;padding:6px 12px;background:var(--teal);color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">🔗 复制邀请链接</button>';
  setTimeout(function() {
    var cl = document.getElementById('ssCopyLink'); if (cl) cl.onclick = function() { navigator.clipboard.writeText(inviteLink).then(function() { showToast('📋 已复制'); }).catch(function() { prompt('手动复制:', inviteLink); }); };
    var cc = document.getElementById('ssCopyCode'); if (cc) cc.onclick = function() { navigator.clipboard.writeText(familyCode).then(function() { showToast('📋 已复制家庭码'); }).catch(function() { prompt('手动复制:', familyCode); }); };
    var jb = document.getElementById('ssJoinBtn'); if (jb) jb.onclick = async function() {
      var code = document.getElementById('ssJoinCode').value.toUpperCase().trim();
      if (code.length !== 6) { showToast('请输入 6 位家庭码'); return; }
      try {
        var res = await fetch('/api/habit-sync?code=' + code);
        var data = await res.json();
        if (data.exists === false) { showToast('❌ 未找到该家庭'); return; }
        if (!await showConfirm('找到该家庭的数据，确定加入？\n\n⚠️ 当前本机数据将被覆盖。', true)) return;
        familyCode = code; localStorage.setItem('habitrat:familyCode', familyCode); family.inviteCode = code;
        saveData(true);
        var updated = await loadFromServer();
        if (updated) { saveData(true); recomputeStreaks(); refreshCurrentView(); updateHeader(); showToast('✅ 已加入并同步'); }
        else { showToast('✅ 已加入'); }
        renderSettings();
      } catch(e) { showToast('❌ 网络错误，请确认已部署到 Vercel'); }
    };
  }, 100);
  // PIN
  var secQStatus = securityQuestion
    ? '密保问题：<b>' + securityQuestion + '</b>'
    : '⚠️ 未设置密保问题 — 忘记 PIN 时将无法找回';
  document.getElementById('ssPinInfo').innerHTML = parentPin
    ? '<span style="font-size:13px;">当前 PIN：<b>●●●●</b></span> <button id="ssChangePin" class="add-btn" style="padding:4px 12px;border-style:solid;">修改</button><br><span style="font-size:12px;color:var(--ink-soft);margin-top:4px;display:inline-block;">' + secQStatus + '</span> <button id="ssEditSecQ" class="add-btn" style="padding:4px 12px;border-style:solid;">修改密保</button>'
    : '<span style="font-size:13px;color:var(--amber-deep);">⚠️ 未设置 PIN — 锁定当天后需 PIN 才能解锁编辑</span><br><button id="ssSetPin" style="margin-top:6px;font-size:12px;padding:6px 16px;border:2px solid var(--amber);border-radius:8px;background:var(--nav-active-bg);color:var(--ink);cursor:pointer;font-weight:600;">🔐 设置 PIN</button>';
  setTimeout(() => {
    const setPinBtn = document.getElementById('ssSetPin'); if (setPinBtn) setPinBtn.onclick = async function() {
      var p = await showPinModal({
        title: '🔐 设置 4 位 PIN',
        validate: function(v) { return /^\d{4}$/.test(v) ? null : '⚠️ PIN 必须是 4 位数字'; }
      });
      if (!p) return;
      var p2 = await showPinModal({
        title: '🔐 请再次输入 PIN 确认',
        validate: function(v) { return v === p ? null : '❌ 两次输入不一致，请重试'; }
      });
      if (!p2) return;
      parentPin = p; saveData(); showToast('✅ PIN 已设置'); renderSettings();
      // 引导设置密保问题（用于忘记 PIN 时找回）
      if (!securityQuestion) {
        setTimeout(function() { openSecQModal(); }, 400);
      }
    };
    const changePinBtn = document.getElementById('ssChangePin'); if (changePinBtn) changePinBtn.onclick = async function() {
      var old = await showPinModal({
        title: '🔐 请输入当前 PIN',
        validate: function(v) { return v === parentPin ? null : '❌ PIN 不正确'; }
      });
      if (!old) return;
      var p1 = await showPinModal({
        title: '🔐 请输入新 PIN（4位数字）',
        validate: function(v) { return /^\d{4}$/.test(v) ? null : '⚠️ PIN 必须是 4 位数字'; }
      });
      if (!p1) return;
      var p1b = await showPinModal({
        title: '🔐 请再次输入新 PIN 确认',
        validate: function(v) { return v === p1 ? null : '❌ 两次输入不一致，请重试'; }
      });
      if (!p1b) return;
      parentPin = p1; saveData(); showToast('✅ PIN 已更新'); renderSettings();
    };
    const editSecQBtn = document.getElementById('ssEditSecQ'); if (editSecQBtn) editSecQBtn.onclick = function() { openSecQModal(); };
  }, 100);
}
function renderMemberSettings() {
  const c = document.getElementById('ssMembers'); let html = '';
  members.forEach((m, i) => {
    html += '<div class="ss-item-row" data-midx="'+i+'"><span class="ssi-name">'+m.name+'</span><select data-mfield="role" data-midx="'+i+'"><option value="guardian"'+(m.role==='guardian'?' selected':'')+'>👩 家长</option><option value="child"'+(m.role==='child'?' selected':'')+'>👧 孩子</option><option value="viewer"'+(m.role==='viewer'?' selected':'')+'>👤 旁观</option></select><div class="ssi-actions"><button class="danger" data-mdel="'+i+'">✕</button></div></div>';
  });
  html += '<div id="ssAddMemberForm" style="display:none;margin-top:8px;"><div style="display:flex;gap:6px;flex-wrap:wrap;"><input id="ssNewMemberName" placeholder="成员姓名" style="padding:6px 8px;border:2px solid var(--paper-deep);border-radius:8px;font-size:13px;width:100px;flex:1;min-width:80px;"><select id="ssNewMemberRole"><option value="child">👧 孩子</option><option value="guardian">👩 家长</option><option value="viewer">👤 旁观</option></select><button id="ssConfirmAddMember" style="padding:6px 12px;background:var(--amber);color:var(--ink);border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">确定</button><button id="ssCancelAddMember" style="padding:6px 12px;border:2px solid var(--paper-deep);border-radius:6px;background:var(--card);font-size:13px;cursor:pointer;">取消</button></div></div>';
  c.innerHTML = html;
  document.querySelectorAll('[data-mdel]').forEach(b => b.addEventListener('click', function() {
    const idx = parseInt(this.dataset.mdel);
    (async function() { if (await showConfirm('删除成员「'+members[idx].name+'」？相关数据不会丢失。', true)) { members.splice(idx, 1); saveData(); renderSettings(); } })();
  }));
  // Role change handler
  document.querySelectorAll('[data-mfield="role"]').forEach(s => s.addEventListener('change', function() {
    members[parseInt(this.dataset.midx)].role = this.value; saveData();
  }));
  document.getElementById('ssAddMember').onclick = function() {
    const form = document.getElementById('ssAddMemberForm'); form.style.display = 'block';
    document.getElementById('ssCancelAddMember').onclick = function() { form.style.display = 'none'; };
    document.getElementById('ssConfirmAddMember').onclick = function() {
      const name = document.getElementById('ssNewMemberName').value.trim();
      if (!name) { showToast('请输入姓名'); return; }
      const role = document.getElementById('ssNewMemberRole').value;
      members.push({ id: genId(), name, role, totalExp: 0 });
      saveData(); renderSettings(); showToast('✅ 已添加');
    };
  };
}
function renderHabitSettings() {
  const c = document.getElementById('ssHabits'); let html = '';
  habitTemplates.forEach((h, i) => {
    if (h.archived) return;
    const ownerName = getMemberName(h.ownerMemberId) || '未分配';
    html += '<div class="ss-item-row" data-hidx="'+i+'"><span class="ssi-name">'+(h.emoji||'')+' '+h.title+'</span><span style="font-size:11px;color:var(--ink-soft);">'+ownerName+'</span><span style="font-size:11px;">连续'+h.streakNeed+'天</span><span style="font-size:11px;color:var(--steel);">E+'+(h.expValue||10)+'</span><span style="font-size:11px;color:var(--amber-deep);">💰'+(h.coinValue||10)+'</span><div class="ssi-actions"><button data-hedit="'+i+'" style="border:1px solid var(--paper-deep);border-radius:6px;padding:2px 8px;font-size:12px;cursor:pointer;background:var(--card);">✎</button><button class="danger" data-hdel="'+i+'" style="border:1px solid var(--coral);border-radius:6px;padding:2px 8px;font-size:12px;cursor:pointer;background:var(--card);color:var(--coral);">✕</button></div></div>';
  });
  html += '<div id="ssAddHabitForm" style="display:none;margin-top:8px;padding:12px;background:var(--paper);border-radius:8px;">'
    + _renderHabitFormFields(null, 'ssNew')+'<button id="ssConfirmAddHabit" style="padding:8px 20px;background:var(--amber);color:var(--ink);border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;width:100%;">确定添加</button></div>';
  c.innerHTML = html;
  document.querySelectorAll('[data-hedit]').forEach(b => b.addEventListener('click', function() {
    const idx = parseInt(this.dataset.hedit); const h = habitTemplates[idx];
    showHabitEditForm(h, function() { saveData(); renderSettings(); showToast('✅ 已更新'); });
  }));
  // Delete habit
  document.querySelectorAll('[data-hdel]').forEach(b => b.addEventListener('click', async function() {
    const idx = parseInt(this.dataset.hdel); const h = habitTemplates[idx];
    if (await showConfirm('删除习惯「'+h.title+'」？\n打卡记录不会丢失，但习惯将不再显示。', true)) { habitTemplates.splice(idx, 1); saveData(); renderSettings(); showToast('已删除'); }
  }));
  document.getElementById('ssAddHabit').onclick = function() {
    document.getElementById('ssAddHabitForm').style.display = 'block';
    document.getElementById('ssConfirmAddHabit').onclick = function() {
      var nh = { id: genId(), archived: false };
      if (!_readHabitFormFields('ssNew', nh)) return;
      habitTemplates.push(nh);
      saveData(); renderSettings(); showToast('✅ 已添加习惯');
      document.getElementById('ssAddHabitForm').style.display = 'none';
    };
  };
}
function renderRewardSettings() {
  const c = document.getElementById('ssRewards'); let html = '';
  rewardItems.forEach((r, i) => {
    html += '<div class="ss-item-row"><span class="ssi-name">'+(r.emoji||'')+' '+r.title+'</span><span style="font-size:11px;color:var(--text2);">'+(r.kind==='consumable'?'🛍️兑换 ('+r.cost+' Coin)':'🎁收藏 Lv.'+r.unlockLevel)+'</span><button class="danger" data-rdel="'+i+'" style="font-size:12px;">✕</button></div>';
  });
  html += '<div id="ssAddRewardForm" style="display:none;margin-top:8px;padding:10px;background:#f9f9f5;border-radius:8px;"><select id="ssRewardKind" style="padding:6px;border:2px solid var(--border);border-radius:6px;margin-right:6px;"><option value="consumable">🛍️ 消耗型</option><option value="collectible">🎁 收藏型</option></select><input id="ssRewardTitle" placeholder="名称" style="padding:6px;border:2px solid var(--border);border-radius:6px;width:100px;"><input id="ssRewardCost" type="number" placeholder="Coin/等级" value="1" min="1" style="padding:6px;border:2px solid var(--border);border-radius:6px;width:70px;"><input id="ssRewardEmoji" placeholder="emoji" value="🎁" style="padding:6px;border:2px solid var(--border);border-radius:6px;width:50px;"><button id="ssConfirmAddReward" style="padding:6px 12px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer;">添加</button></div>';
  c.innerHTML = html;
  document.querySelectorAll('[data-rdel]').forEach(b => b.addEventListener('click', async function() {
    const idx = parseInt(this.dataset.rdel); if (await showConfirm('删除「'+rewardItems[idx].title+'」？', true)) { rewardItems.splice(idx, 1); saveData(); renderSettings(); }
  }));
  document.getElementById('ssAddReward').onclick = function() { document.getElementById('ssAddRewardForm').style.display = 'block';
    document.getElementById('ssConfirmAddReward').onclick = function() {
      const kind = document.getElementById('ssRewardKind').value;
      const title = document.getElementById('ssRewardTitle').value.trim();
      if (!title) { showToast('请输入名称'); return; }
      const cost = parseInt(document.getElementById('ssRewardCost').value) || 1;
      const emoji = document.getElementById('ssRewardEmoji').value.trim() || '🎁';
      rewardItems.push({ id: genId(), kind, title, emoji, cost: kind==='consumable'?cost:undefined, unlockLevel: kind==='collectible'?cost:undefined });
      saveData(); renderSettings(); showToast('✅ 已添加');
      document.getElementById('ssAddRewardForm').style.display = 'none';
    };
  };
}


// ========== 通用 Quest Card 渲染 ==========
/** 生成 quest-card HTML。options: showStreak/showReward/showFlame/editable/filterApplicable/timeClass */
function renderQuestCard(habit, date, options) {
  var o = options || {};
  var status = getDayStatus(habit, date);
  var applicable = isDayApplicable(habit, date);
  if (o.filterApplicable && !applicable) return null;
  var meta = getHabitMeta(habit.id);
  var isDone = status === '✓';
  var isMiss = status === '✗';
  var ptsExp = habit.expValue || meta.expValue || 10;
  var ptsCoin = habit.coinValue || meta.coinValue || 10;
  // 状态文字
  var subText = '';
  if (o.showStreak) {
    if (isDone) { var days=1, c=new Date(date); for (var i=1;i<60;i++) { c.setDate(date.getDate()-i); if (getDayStatus(habit,c)==='✓' && isDayApplicable(habit,c)) days++; else break; } subText='✅ 连续第 '+days+' 天'; }
    else if (isMiss) subText='✗ 今天未完成';
    else if (!applicable) subText='今天不计分';
    else subText='今天还没开始';
  } else {
    subText = isDone ? '✅ 已完成' : (isMiss ? '✗ 未完成' : '未完成');
  }
  // 时间标签
  var ruleText = applicable ? getRuleText(habit, date) : '';
  var tc = o.timeClass || 'quest-time';
  var timeSuffix = ruleText ? ' <span class="'+tc+'">'+ruleText+'</span>' : '';
  // 组装
  var cls = (isDone?' done':(isMiss?' miss':'')) + (!o.editable?' no-edit':'');
  var chk = isDone?'✓':(isMiss?'✗':'');
  var ds = fmtDateFull(date);
  var html = '<div class="quest-card'+cls+'" data-habit="'+habit.id+'" data-date="'+ds+'">'
    + '<div class="quest-check">'+chk+'</div>'
    + '<div class="quest-icon">'+(habit.emoji||'📌')+'</div>'
    + '<div class="quest-info">'
    + '<div class="quest-title">'+habit.title+timeSuffix+'</div>'
    + '<div class="quest-sub-row"><div class="quest-sub">'+subText+'</div>';
  if (o.showReward) html += '<div class="quest-reward"><span class="qr-exp">EXP+'+ptsExp+'</span><span class="qr-coin">💰+'+ptsCoin+'</span></div>';
  html += '</div></div>';
  if (o.showFlame && isDone) { var sc=getStreakCount(habit.id); html += '<div class="streak-flame">'+'🔥'.repeat(Math.min(sc||1,5))+'</div>'; }
  html += '</div>';
  return { html:html, isDone:isDone, isMiss:isMiss, applicable:applicable };
}

function renderCustomEventCard(ci, options) {
  var o = options || {};
  var isDone = ci.status === '✓', isMiss = ci.status === '✗';
  var cls = (isDone?' done':(isMiss?' miss':'')) + (!o.editable?' no-edit':'');
  var chk = isDone?'✓':(isMiss?'✗':'');
  var html = '<div class="quest-card custom-event'+cls+'" data-custom="'+ci.id+'" data-date="'+ci.date+'">'
    + '<div class="quest-check">'+chk+'</div>'
    + '<div class="quest-icon">📌</div>'
    + '<div class="quest-info">'
    + '<div class="quest-title">'+ci.title+'</div>'
    + '<div class="quest-sub-row"><div class="quest-sub">'+(ci.detail||'')+'</div>';
  if (o.showReward) html += '<div class="quest-reward"><span class="qr-exp">EXP+'+(ci.expValue??5)+'</span><span class="qr-coin">💰+'+(ci.coinValue??5)+'</span></div>';
  html += '</div></div>';
  if (o.editable) html += '<div style="display:flex;gap:4px;margin-left:auto;"><button class="ci-edit-btn" data-ci="'+ci.id+'" style="border:none;background:none;font-size:14px;cursor:pointer;color:var(--ink-soft);padding:2px 4px;">✎</button><button class="ci-del-btn" data-ci="'+ci.id+'" style="border:none;background:none;font-size:14px;cursor:pointer;color:var(--coral);padding:2px 4px;">✕</button></div>';
  html += '</div>';
  return { html:html, isDone:isDone, isMiss:isMiss };
}

function renderCustomEventAddForm(prefix) {
  return '<div id="'+prefix+'AddRow" style="margin-top:8px;">'
    + '<button id="'+prefix+'ShowForm" style="width:100%;padding:10px;border:2px dashed var(--paper-deep);border-radius:12px;background:none;font-size:13px;color:var(--ink-soft);cursor:pointer;">＋ 添加自定义事件</button>'
    + '<div id="'+prefix+'Form" style="display:none;padding:12px;border:2px solid var(--paper-deep);border-radius:12px;margin-top:6px;">'
    + '<input id="'+prefix+'Title" placeholder="事件名称" style="width:100%;padding:8px 10px;border:2px solid var(--paper-deep);border-radius:8px;font-size:13px;margin-bottom:6px;">'
    + '<input id="'+prefix+'Detail" placeholder="内容说明（可选）" style="width:100%;padding:8px 10px;border:2px solid var(--paper-deep);border-radius:8px;font-size:13px;margin-bottom:6px;">'
    + '<div style="display:flex;gap:6px;"><span style="font-size:12px;">EXP</span><input id="'+prefix+'Exp" type="number" value="5" min="0" style="width:60px;padding:8px;border:2px solid var(--paper-deep);border-radius:8px;font-size:13px;"><span style="font-size:12px;">💰</span><input id="'+prefix+'Coin" type="number" value="5" min="0" style="width:60px;padding:8px;border:2px solid var(--paper-deep);border-radius:8px;font-size:13px;"><button id="'+prefix+'Save" style="padding:8px 16px;background:var(--amber);color:var(--ink);border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">添加</button></div>'
    + '</div></div>';
}

function bindCustomEventAddForm(prefix, dateStr, onSaved) {
  var sf = document.getElementById(prefix+'ShowForm');
  if (sf) sf.addEventListener('click', function() { document.getElementById(prefix+'Form').style.display='block'; sf.style.display='none'; });
  var sv = document.getElementById(prefix+'Save');
  if (sv) sv.addEventListener('click', function() {
    var t = document.getElementById(prefix+'Title').value.trim();
    if (!t) { showToast('请输入事件名称'); return; }
    var d = document.getElementById(prefix+'Detail').value.trim();
    var ex = parseInt(document.getElementById(prefix+'Exp').value)||0;
    var co = parseInt(document.getElementById(prefix+'Coin').value)||0;
    customItems.push({ id:genId(), date:dateStr, title:t, detail:d, expValue:ex, coinValue:co, status:'○' });
    saveData(); showToast('✅ 已添加');
    if (onSaved) onSaved();
  });
}

// ========== 日详情视图 ==========
function showDayDetail(date) {
  const d = date || new Date();
  const ds = fmtDateFull(d);
  const weekdays = ['日','一','二','三','四','五','六'];
  const todayStr = fmtDateFull(new Date());
  const isPast = ds < todayStr;
  const isToday = ds === todayStr;
  const locked = isDateLocked(ds);
  const tempUnlocked = !!unlockedForEdit[ds];
  const editable = (isToday && !locked) || tempUnlocked;

  let titleHtml = fmtDateCN(d) + ' 星期' + weekdays[d.getDay()];
  if (isPast && !tempUnlocked && !isToday) {
    titleHtml += ' <button onclick="unlockWithPin(\'' + ds + '\')" style="font-size:11px;padding:2px 8px;border:1px solid var(--ink-soft);border-radius:4px;background:transparent;color:var(--ink-soft);cursor:pointer;vertical-align:middle;">🔐 输入PIN解锁</button>';
  } else if (isPast && tempUnlocked) {
    titleHtml += ' <button onclick="relockDay(\'' + ds + '\')" style="font-size:11px;padding:2px 8px;border:1px solid var(--coral);border-radius:4px;background:transparent;color:var(--coral);cursor:pointer;vertical-align:middle;">🔒 锁定</button>';
  }
  document.getElementById('dayDetailTitle').innerHTML = titleHtml;
  let html = '';
  let doneCount = 0, totalCount = 0;
  getActiveHabits().forEach(h => {
    const card = renderQuestCard(h, d, { showStreak:false, showReward:false, showFlame:false, editable:editable, filterApplicable:true, timeClass:'quest-time' });
    if (!card) return;
    totalCount++;
    if (card.isDone) doneCount++;
    html += card.html;
  });
  // 自定义事件
  const dayItems = customItems.filter(ci => ci.date === ds);
  dayItems.forEach(ci => {
    const card = renderCustomEventCard(ci, { showReward:false, editable:editable });
    if (card.isDone) doneCount++; totalCount++;
    html += card.html;
  });
  // 添加自定义事件表单
  if (editable) html += renderCustomEventAddForm('ciDay');

  document.getElementById('dayDetailHabits').innerHTML = html;
  document.getElementById('ddDone').textContent = doneCount;
  document.getElementById('ddTotal').textContent = totalCount - doneCount;
  document.querySelectorAll('.home-pane').forEach(p => p.style.display = 'none');
  document.getElementById('homeDayDetail').style.display = 'block';

  if (editable) {
    bindCustomEventAddForm('ciDay', ds, function() { showDayDetail(d); });
    // 编辑/删除/勾选
    document.querySelectorAll('#dayDetailHabits .ci-edit-btn').forEach(btn => {
      btn.addEventListener('click', function(e) { e.stopPropagation();
        const ci = customItems.find(c => c.id === this.dataset.ci); if (!ci) return;
        showCiEditForm(ci, function() { showDayDetail(d); });
      });
    });
    document.querySelectorAll('#dayDetailHabits .ci-del-btn').forEach(btn => {
      btn.addEventListener('click', async function(e) { e.stopPropagation();
        const ci = customItems.find(c => c.id === this.dataset.ci); if (!ci) return;
        if (!await showConfirm('删除「'+ci.title+'」？', true)) return;
        if (ci.status === '✓') { transactions = transactions.filter(t => !(t.reason==='[自定义] '+ci.title && t.createdAt===ci.date)); recomputeStreaks(); }
        customItems = customItems.filter(c => c.id !== ci.id);
        saveData(); showDayDetail(d); updateStatusBar();
      });
    });
    document.querySelectorAll('#dayDetailHabits .custom-event').forEach(card => {
      card.addEventListener('click', function(e) {
        if (e.target.closest('button')) return;
        const ci = customItems.find(c => c.id === this.dataset.custom); if (!ci) return;
        const childId = getChildMembers()[0]?.id || selectedMemberId || members[0]?.id;
        // Three-way cycle: ○ → ✓ → ✗ → ○
        if (ci.status === '○' || ci.status === '') {
          ci.status = '✓';
          transactions.push({ id: genId(), memberId: childId, type: 'earn_exp', amount: ci.expValue ?? 5, reason: '[自定义] '+ci.title, createdAt: ci.date });
          transactions.push({ id: genId(), memberId: childId, type: 'earn_coin', amount: ci.coinValue ?? 5, reason: '[自定义] '+ci.title, createdAt: ci.date });
          const mem = getMemberById(childId); if (mem) mem.totalExp += (ci.expValue ?? 5);
          recomputeStreaks(); saveData(); showDayDetail(d); updateStatusBar(); checkLevelUps();
        } else if (ci.status === '✓') {
          ci.status = '✗';
          transactions = transactions.filter(t => !(t.reason==='[自定义] '+ci.title && t.createdAt===ci.date));
          recomputeStreaks(); saveData(); showDayDetail(d); updateStatusBar();
        } else {
          ci.status = '○';
          saveData(); showDayDetail(d); updateStatusBar();
        }
      });
    });
    // Regular habits — three-way cycle ○→✓→✗→○
    document.querySelectorAll('#dayDetailHabits .quest-card:not(.custom-event)').forEach(card => {
      card.addEventListener('click', function() {
        const habitId = this.dataset.habit;
        const dateStr = this.dataset.date;
        const habit = getActiveHabits().find(h => h.id === habitId);
        if (!habit) return;
        const newStatus = cycleStatus(habit, d);
        recomputeStreaks(); showDayDetail(d); updateStatusBar();
        if (newStatus === '✓') { showToast('✅ 打卡成功！'); checkLevelUps(); }
        else if (newStatus === '✗') { showToast('✗ 标记为未完成'); }
        else { showToast('↩ 已重置'); }
      });
    });
  }
}

// ========== 首页今日任务渲染 ==========
function renderHomeView() {
  updateStatusBar();
  updateHeader();
  updatePeriodSummary('today');
  const activeHabits = getActiveHabits();
  const container = document.getElementById('questList');
  if (!container || !activeHabits.length) {
    if (container) container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--ink-soft);font-size:14px;line-height:1.8;">👋 欢迎来到 HabitRat！<br><br>🎯 还没有习惯哦<br><button onclick="switchView(\'settings\')" style="margin-top:12px;padding:10px 24px;border:none;border-radius:12px;background:var(--ink);color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:var(--font-body);">➕ 去添加习惯</button><br><br>或者先去商店看看有什么奖励 🛍️</div>';
    return;
  }
  const today = new Date();
  const todayStr = fmtDateFull(today);
  let html = '';
  activeHabits.forEach(h => {
    const card = renderQuestCard(h, today, { showStreak:true, showReward:true, showFlame:true, editable:true, filterApplicable:false, timeClass:'quest-time' });
    if (!card) return;
    html += card.html;
  });
  // 自定义事件
  const todayItems = customItems.filter(ci => ci.date === todayStr);
  todayItems.forEach(ci => {
    html += renderCustomEventCard(ci, { showReward:true, editable:true }).html;
  });
  // 添加自定义事件按钮
  html += renderCustomEventAddForm('ci');

  container.innerHTML = html;

  bindCustomEventAddForm('ci', todayStr, function() { renderHomeView(); });
  // 自定义事件：编辑（内联表单）
  container.querySelectorAll('.ci-edit-btn').forEach(btn => {
    btn.addEventListener('click', function(e) { e.stopPropagation();
      const ci = customItems.find(c => c.id === this.dataset.ci); if (!ci) return;
      showCiEditForm(ci, function() { renderHomeView(); });
    });
  });
  // 自定义事件：删除
  container.querySelectorAll('.ci-del-btn').forEach(btn => {
    btn.addEventListener('click', async function(e) { e.stopPropagation();
      const ci = customItems.find(c => c.id === this.dataset.ci); if (!ci) return;
      if (!await showConfirm('删除「' + ci.title + '」？', true)) return;
      // 如果已完成则退回 EXP 和 Coin
      if (ci.status === '✓') {
        const childId = getChildMembers()[0]?.id || selectedMemberId || members[0]?.id;
        transactions = transactions.filter(t => !(t.reason === '[自定义] ' + ci.title && t.createdAt === ci.date));
        recomputeStreaks();
      }
      customItems = customItems.filter(c => c.id !== ci.id);
      saveData(); showToast('已删除'); renderHomeView(); updateStatusBar();
    });
  });
  // 自定义事件：勾选/取消
  container.querySelectorAll('.custom-event').forEach(card => {
    card.addEventListener('click', function(e) {
      if (e.target.closest('button')) return;
      const ciId = this.dataset.custom;
      const ci = customItems.find(c => c.id === ciId); if (!ci) return;
      const dateStr = this.dataset.date;
      if (isDateLocked(dateStr)) { showToast('🔒 当天已锁定，无法修改'); return; }
      const childId = getChildMembers()[0]?.id || selectedMemberId || members[0]?.id;
      // Three-way cycle: ○ → ✓ → ✗ → ○
      if (ci.status === '○' || ci.status === '') {
        ci.status = '✓';
        const exp = ci.expValue ?? 5; const coin = ci.coinValue ?? 5;
        transactions.push({ id: genId(), memberId: childId, type: 'earn_exp', amount: exp, reason: '[自定义] ' + ci.title, createdAt: ci.date });
        transactions.push({ id: genId(), memberId: childId, type: 'earn_coin', amount: coin, reason: '[自定义] ' + ci.title, createdAt: ci.date });
        const mem = getMemberById(childId); if (mem) mem.totalExp += exp;
        recomputeStreaks();
        saveData(); renderHomeView(); updateStatusBar(); showToast('✅ 完成！');
        checkLevelUps();
      } else if (ci.status === '✓') {
        ci.status = '✗';
        transactions = transactions.filter(t => !(t.reason === '[自定义] ' + ci.title && t.createdAt === ci.date));
        recomputeStreaks();
        saveData(); renderHomeView(); updateStatusBar(); showToast('✗ 标记为未完成');
      } else {
        ci.status = '○';
        saveData(); renderHomeView(); updateStatusBar(); showToast('↩ 已重置');
      }
    });
  });

  // Bind click: three-way cycle ○→✓→✗→○
  container.querySelectorAll('.quest-card:not(.custom-event)').forEach(card => {
    card.addEventListener('click', function() {
      const habitId = this.dataset.habit;
      const dateStr = this.dataset.date;
      const habit = getActiveHabits().find(h => h.id === habitId);
      if (!habit) return;
      const d = new Date(dateStr + 'T00:00:00');
      if (!isDayApplicable(habit, d)) { showToast('今天不计分'); return; }
      if (isDateLocked(dateStr)) { showToast('🔒 当天已锁定，无法修改'); return; }
      const newStatus = cycleStatus(habit, d);
      recomputeStreaks();
      renderHomeView();
      updateStatusBar();
      if (newStatus === '✓') { showToast('✅ 打卡成功！'); checkLevelUps(); }
      else if (newStatus === '✗') { showToast('✗ 标记为未完成'); }
      else { showToast('↩ 已重置'); }
    });
  });
}

// ========== 商店视图渲染 ==========
function renderShopView() {
  const childId = getChildMembers()[0]?.id || selectedMemberId || members[0]?.id;
  if (!childId) return;
  const level = getMemberLevel(childId);

  // Consumable grid — 兑换按钮在卡片内下方
  const consumables = rewardItems.filter(r => r.kind === 'consumable');
  const conGrid = document.getElementById('shopGrid');
  let conHtml = '';
  consumables.forEach((item, i) => {
    conHtml += '<div class="shop-item">'
      + '<button class="shop-item-del" data-idx="' + i + '" title="删除" style="position:absolute;top:6px;right:6px;border:none;background:none;font-size:14px;cursor:pointer;color:var(--ink-soft);padding:2px;">✕</button>'
      + '<button class="shop-item-edit" data-idx="' + i + '" title="编辑" style="position:absolute;top:6px;right:28px;border:none;background:none;font-size:13px;cursor:pointer;color:var(--ink-soft);padding:2px;">✎</button>'
      + '<div class="shop-item-emoji">' + (item.emoji || '🎁') + '</div>'
      + '<div class="shop-item-title">' + item.title + '</div>'
      + '<div class="shop-item-cost">💰 ' + item.cost + ' / ' + (item.unit || '次') + '</div>'
      + '<div style="display:flex;align-items:center;gap:4px;margin-top:6px;">'
      + '<input type="number" class="shop-qty-input" value="1" min="1" data-idx="' + i + '" style="width:40px;padding:4px;border:1px solid var(--paper-deep);border-radius:6px;font-size:12px;text-align:center;">'
      + '<button class="shop-buy-btn" data-idx="' + i + '" style="flex:1;padding:6px 8px;border:none;border-radius:8px;background:var(--amber);color:var(--ink);font-size:13px;font-weight:700;cursor:pointer;">兑换</button>'
      + '</div></div>';
  });
  conGrid.innerHTML = conHtml || '<div style="text-align:center;color:var(--ink-soft);padding:30px;grid-column:1/-1;line-height:1.8;">🛍️ 商店还没有奖励项目<br><span style="font-size:12px;">去设置中添加吧！</span><br><button onclick="switchView(\'settings\')" style="margin-top:10px;padding:8px 20px;border:none;border-radius:10px;background:var(--ink);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:var(--font-body);">⚙️ 去设置</button></div>';
  // Edit buttons
  conGrid.querySelectorAll('.shop-item-edit').forEach(btn => {
    btn.addEventListener('click', function(e) { e.stopPropagation();
      const idx = parseInt(this.dataset.idx);
      const items = rewardItems.filter(r => r.kind === 'consumable');
      const item = items[idx]; if (!item) return;
      const title = prompt('项目名称', item.title); if (title === null) return;
      const cost = parseInt(prompt('消耗金币', item.cost)); if (isNaN(cost) || cost <= 0) { showToast('请输入有效的金币值'); return; }
      const unit = prompt('单位（次/分钟等）', item.unit || '次') || '次';
      item.title = title; item.cost = cost; item.unit = unit;
      saveData(); showToast('✅ 已更新'); renderShopView();
    });
  });
  // Delete buttons
  conGrid.querySelectorAll('.shop-item-del').forEach(btn => {
    btn.addEventListener('click', async function(e) { e.stopPropagation();
      const idx = parseInt(this.dataset.idx);
      const items = rewardItems.filter(r => r.kind === 'consumable');
      const item = items[idx]; if (!item) return;
      if (await showConfirm('删除「' + item.title + '」？', true)) { rewardItems = rewardItems.filter(r => r !== item); saveData(); showToast('已删除'); renderShopView(); }
    });
  });
  // Buy buttons
  conGrid.querySelectorAll('.shop-buy-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = parseInt(this.dataset.idx);
      const items = rewardItems.filter(r => r.kind === 'consumable');
      const item = items[idx]; if (!item) return;
      const qty = parseInt(conGrid.querySelector('.shop-qty-input[data-idx="' + idx + '"]')?.value) || 1;
      const total = item.cost * qty;
      if (total <= 0 || total > getCoinBalance(childId)) { showToast(total <= 0 ? '请输入数量' : '😅 金币不够哦'); return; }
      transactions.push({ id: genId(), memberId: childId, type: 'spend_coin', amount: total, reason: item.title + ' x' + qty, createdAt: fmtDateFull(new Date()) });
      logOp(getMemberName(childId), '兑换', item.title + ' x' + qty + ' (-' + total + ' Coin)');
      saveData(); showToast('🎉 兑换成功！'); renderShopView();
    });
  });

  // 自定义添加项目表单
  const customForm = document.getElementById('shopCustomForm');
  if (customForm) {
    customForm.innerHTML = '<div style="margin-top:16px;padding:12px;border:2px dashed var(--paper-deep);border-radius:12px;">'
      + '<div style="font-size:13px;font-weight:700;margin-bottom:8px;">＋ 自定义兑换项目</div>'
      + '<input id="newItemName" placeholder="项目名称" style="width:100%;padding:8px 10px;border:2px solid var(--paper-deep);border-radius:8px;font-size:13px;margin-bottom:6px;">'
      + '<input id="newItemDetail" placeholder="内容说明（可选）" style="width:100%;padding:8px 10px;border:2px solid var(--paper-deep);border-radius:8px;font-size:13px;margin-bottom:6px;">'
      + '<input id="newItemCost" type="number" placeholder="消耗金币（必填）" min="1" value="10" style="width:100%;padding:8px 10px;border:2px solid var(--paper-deep);border-radius:8px;font-size:13px;margin-bottom:6px;">'
      + '<div style="display:flex;gap:6px;"><input id="newItemUnit" placeholder="单位" value="次" style="width:80px;padding:8px 10px;border:2px solid var(--paper-deep);border-radius:8px;font-size:13px;"><button id="btnAddShopItem" style="flex:1;padding:8px;background:var(--amber);color:var(--ink);border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">添加</button></div>'
      + '</div>';
    document.getElementById('btnAddShopItem').addEventListener('click', function() {
      const name = document.getElementById('newItemName').value.trim();
      const cost = parseInt(document.getElementById('newItemCost').value) || 0;
      const unit = document.getElementById('newItemUnit').value.trim() || '次';
      if (!name || cost <= 0) { showToast('请填写项目名称和金币值'); return; }
      rewardItems.push({ id: genId(), kind: 'consumable', title: name, cost, unit });
      saveData(); showToast('✅ 已添加');
      renderShopView();
    });
  }

}

// ========== 装扮视图渲染 ==========
function renderDressupView() {
  const childId = getChildMembers()[0]?.id || selectedMemberId || members[0]?.id;
  if (!childId) return;
  const level = getMemberLevel(childId);
  const state = outfitState[childId] || { clothing: null, companion: null, background: null };
  renderMascotSvg(childId, 'dressupMascotSvg');

  // Determine which category is active
  const activeCatEl = document.querySelector('.dressup-cat.active');
  const cat = activeCatEl ? activeCatEl.dataset.cat : 'clothing';
  const items = getUnlockedOutfits(childId).filter(i => i.category === cat);
  const grid = document.getElementById('dressupGrid');
  let html = '';
  items.forEach(item => {
    const isEquipped = state[cat] === item.id;
    const isLocked = !item.unlocked;
    const btnClass = isLocked ? 'locked-btn' : (isEquipped ? 'unequip' : 'equip');
    const btnText = isLocked ? '🔒 Lv.' + item.unlockLevel : (isEquipped ? '✓ 穿着中' : '穿戴');
    html += '<div class="dressup-item' + (isLocked ? ' locked' : '') + (isEquipped ? ' equipped' : '') + '">'
      + '<div class="di-emoji">' + (item.emoji || (cat === 'clothing' ? '👕' : cat === 'companion' ? '🐾' : '🌄')) + '</div>'
      + '<div class="di-name">' + item.name + '</div>'
      + '<button class="di-btn ' + btnClass + '" data-cat="' + cat + '" data-id="' + item.id + '"' + (isLocked ? ' disabled' : '') + '>' + btnText + '</button></div>';
  });
  grid.innerHTML = html || '<div style="text-align:center;color:var(--ink-soft);padding:20px;grid-column:1/-1;">暂无此分类物品</div>';
  // Bind equip
  grid.querySelectorAll('.di-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', function() {
      equipOutfit(childId, this.dataset.cat, this.dataset.id);
    });
  });
}

// ========== Init ==========
async function initSync() {
  const updated = await loadFromServer();
  if (updated) { saveData(true); recomputeStreaks(); refreshCurrentView(); }
  startSyncPolling();
}

function init() {
  loadData();
  recomputeStreaks();
  currentMonth = new Date(); currentMonth.setDate(1);
  currentWeek = getMonday(new Date());

  // Tab switching - new 4 tabs
  document.querySelectorAll('.tabbar .tab').forEach(tab => {
    tab.addEventListener('click', function() {
      const v = this.dataset.tab;
      switchView(v);
    });
  });

  // Home sub-tab switching
  document.querySelectorAll('.home-tab[data-home]').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.home-tab[data-home]').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const pane = this.dataset.home;
      currentHomeTab = pane;
      document.querySelectorAll('.home-pane').forEach(p => p.style.display = 'none');
      if (pane === 'today') {
        document.getElementById('homeToday').style.display = 'block';
        updatePeriodSummary('today'); renderHomeView(); updateHeader();
      } else if (pane === 'week') {
        document.getElementById('homeWeek').style.display = 'block';
        currentWeek = getMonday(new Date());
        updatePeriodSummary('week'); renderWeekView(); updateHeader();
      } else if (pane === 'month') {
        document.getElementById('homeMonth').style.display = 'block';
        currentMonth = new Date(); currentMonth.setDate(1);
        updatePeriodSummary('month'); renderMonthView(); updateHeader();
      }
    });
  });

  // Dressup switching (kept for future use)
  // Growth sub-tab removed — scene is now embedded in growthLevelPane

  // Dressup category switching
  document.querySelectorAll('.dressup-cat').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.dressup-cat').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      renderDressupView();
    });
  });

  // Shop tab switching
  document.querySelectorAll('.shop-tab').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.shop-tab').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
    });
  });

  // Day detail back button
  document.getElementById('dayDetailBack').addEventListener('click', function() {
    document.getElementById('homeDayDetail').style.display = 'none';
    if (currentHomeTab === 'week') { document.getElementById('homeWeek').style.display = 'block'; updateHeader(); }
    else if (currentHomeTab === 'month') { document.getElementById('homeMonth').style.display = 'block'; updateHeader(); }
    else { document.getElementById('homeToday').style.display = 'block'; }
  });

  // Touch swipe
  let touchStartX = 0;
  function addSwipe(el, cbLeft, cbRight) {
    if (!el) return;
    el.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
    el.addEventListener('touchend', e => { const diff = touchStartX - e.changedTouches[0].screenX; if (Math.abs(diff) > 50) { if (diff > 0) cbLeft(); else cbRight(); } }, { passive: true });
  }
  addSwipe(document.getElementById('dayHabits'), () => changeDay(1), () => changeDay(-1));
  addSwipe(document.getElementById('weekCards'), () => changeWeek(1), () => changeWeek(-1));
  addSwipe(document.getElementById('monthCalendar'), () => changeMonth(1), () => changeMonth(-1));

  // Points sheet overlay (for bonus/deduct from shop)
  document.getElementById('pointsOverlay').addEventListener('click', hidePointsSheet);
  document.querySelectorAll('[data-ps-tab]').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('[data-ps-tab]').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const t = this.dataset.psTab;
      document.getElementById('psFormSpend').style.display = t === 'spend' ? 'block' : 'none';
      document.getElementById('psFormCollect').style.display = t === 'collect' ? 'block' : 'none';
      if (t === 'items') { renderPointsLog(new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0')); }
      if (t === 'spend') updatePointsSheet();
      if (t === 'collect') renderCollectItems();
    });
  });

  // Deduct
  const btnDeduct = document.getElementById('btnDeduct'); if (btnDeduct) btnDeduct.addEventListener('click', async function() {
    if (!await showConfirm('确定要扣分吗？', true)) return;
      const pts = parseInt(document.getElementById('psDeductPts').value) || 0;
      if (pts <= 0) { showToast('请输入有效分值'); return; }
      if (pts > getCoinBalance(selectedMemberId)) { showToast('😅 Coin不够扣'); return; }
      const reason = document.getElementById('psDeductReason').value;
      transactions.push({ id: genId(), memberId: selectedMemberId, type: 'deduct_coin', amount: pts, reason: reason, createdAt: fmtDateFull(new Date()) });
      logOp(getMemberName(selectedMemberId), '扣分', reason+' (-'+pts+' Coin)');
      saveData(); showToast('⚠️ 已扣 ' + pts + ' Coin（EXP不受影响）');
      document.getElementById('psDeductPts').value = '5'; updatePointsSheet();
  });

  // Bonus (hidden, kept for compatibility)
  const btnBonus = document.getElementById('btnBonus'); if (btnBonus) btnBonus.addEventListener('click', async function() {
    if (!await showConfirm('确定要加分吗？')) return;
      const name = document.getElementById('psBonusName').value.trim();
      const detail = document.getElementById('psBonusDetail').value.trim();
      const coinPts = parseInt(document.getElementById('psBonusPts').value) || 0;
      if (!name) { showToast('请输入事件名称'); return; }
      if (coinPts <= 0) { showToast('请输入有效分值'); return; }
      const note = detail ? name + '（' + detail + '）' : name;
      transactions.push({ id: genId(), memberId: selectedMemberId, type: 'bonus_coin', amount: coinPts, reason: note, createdAt: fmtDateFull(new Date()) });
      logOp(getMemberName(selectedMemberId), '加分', note+' (+'+coinPts+' Coin)');
      if (document.getElementById('psBonusExp').checked) {
        const expPts = parseInt(document.getElementById('psBonusExpVal').value) || coinPts;
        transactions.push({ id: genId(), memberId: selectedMemberId, type: 'bonus_exp', amount: expPts, reason: note + ' (额外EXP)', createdAt: fmtDateFull(new Date()) });
        const mem = getMemberById(selectedMemberId); if (mem) mem.totalExp += expPts;
        logOp(getMemberName(selectedMemberId), 'EXP奖励', note+' (+'+expPts+' EXP)');
      }
      saveData(); showToast('✨ 已加分！');
      document.getElementById('psBonusName').value = ''; document.getElementById('psBonusDetail').value = '';
      document.getElementById('psBonusPts').value = '10'; updatePointsSheet();
  });

  // Other buttons
  ['btnPoints','btnLog'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (id === 'btnPoints') el.addEventListener('click', function() { switchView('shop'); });
    else if (id === 'btnLog') el.addEventListener('click', toggleLog);
  });
  const btnRecalcH = document.getElementById('btnRecalc');
  if (btnRecalcH) btnRecalcH.addEventListener('click', function() {
    recomputeStreaks(); saveData(); showToast('✅ 积分已重算');
  });
  // Settings tab (no PIN needed - day lock replaces PIN)
  document.getElementById('btnMobileWeek').addEventListener('click', function() {
    if (!currentWeek) currentWeek = getMonday(new Date());
    renderMobileWeekReport();
    var w = window.open('about:blank', '_blank');
    w.document.write(document.getElementById('printableView').innerHTML);
    w.document.close();
  });
  document.getElementById('btnPrintView').addEventListener('click', function() {
    if (!currentWeek) currentWeek = getMonday(new Date());
    renderPrintableWeek();
    var w = window.open('about:blank', '_blank');
    w.document.write(document.getElementById('printableView').innerHTML);
    w.document.close();
  });
  // Child name save
  var ssSaveCN = document.getElementById('ssSaveChildName'); if (ssSaveCN) ssSaveCN.addEventListener('click', function() {
    var name = document.getElementById('ssChildName').value.trim();
    if (name) { localStorage.setItem('habitrat:childName', name); updateStatusBar(); showToast('✅ 名称已保存'); }
  });
  // Sync-related (removed from settings, keep null-safe)
  var ssCopy = document.getElementById('ssCopyCode'); if (ssCopy) ssCopy.addEventListener('click', function() {
    navigator.clipboard.writeText(familyCode).then(() => showToast('📋 已复制家庭码')).catch(() => prompt('手动复制:', familyCode));
  });
  var ssJoin = document.getElementById('ssJoinBtn'); if (ssJoin) ssJoin.addEventListener('click', async function() {
    var code = document.getElementById('ssJoinCode').value.toUpperCase().trim();
    if (code.length !== 6) { showToast('请输入 6 位家庭码'); return; }
    try { var res = await fetch('/api/habit-sync?code=' + code); var data = await res.json();
      if (data.exists === false) { showToast('❌ 未找到该家庭'); return; }
      if (!await showConfirm('找到该家庭的数据，确定加入？当前本机数据将被覆盖。', true)) return;
      familyCode = code; localStorage.setItem('habitrat:familyCode', familyCode);
      var updated = await loadFromServer();
      if (updated) { saveData(true); recomputeStreaks(); refreshCurrentView(); updateHeader(); renderSettings(); showToast('✅ 已加入家庭，数据已同步');
      } else { showToast('✅ 已加入家庭'); renderSettings(); }
    } catch(e) { showToast('❌ 网络错误，请重试'); }
  });
  document.getElementById('ssExportBackup').addEventListener('click', exportFullBackup);
  document.getElementById('ssImportBackup').addEventListener('click', function() { document.getElementById('ssImportFile').click(); });
  document.getElementById('ssImportFile').addEventListener('change', function(e) { if (e.target.files && e.target.files[0]) { importBackup(e.target.files[0]); e.target.value = ''; } });
  var btnRecalc2 = document.getElementById('btnRecalc'); if (btnRecalc2) btnRecalc2.addEventListener('click', function() { recomputeStreaks(); saveData(); showToast('✅ 积分已重新计算'); });
  document.getElementById('btnResetData').addEventListener('click', function() {
    (async function() { if (await showConfirm('⚠️ 确定要清除所有数据？此操作不可撤销！', true)) { localStorage.removeItem('habitrat:v4'); localStorage.removeItem('habitRatV4'); localStorage.removeItem('habitRatV4_lastUpdate'); localStorage.removeItem('ht_familyCode'); location.reload(); } })();
  });
  // 金币弹窗
  document.getElementById('statusEarnedBox').addEventListener('click', showCoinSources);
  document.getElementById('statusPendingBox').addEventListener('click', showPendingCoins);
  document.getElementById('coinSourceOverlay').addEventListener('click', hideCoinSources);
  document.getElementById('cssClose').addEventListener('click', hideCoinSources);

  // 确认弹窗按钮
  document.getElementById('confirmOk').addEventListener('click', function() { closeConfirm(true); });
  document.getElementById('confirmCancel').addEventListener('click', function() { closeConfirm(false); });
  // PIN 键盘
  document.querySelectorAll('.pin-key[data-pin]').forEach(btn => {
    btn.addEventListener('click', function() { handlePinKey(this.dataset.pin); });
  });
  document.getElementById('pinDel').addEventListener('click', handlePinDel);
  document.getElementById('pinCancel').addEventListener('click', function() { closePinModal(null); });
  // 密保问题弹窗
  var secQSave = document.getElementById('secQSave'); if (secQSave) secQSave.addEventListener('click', saveSecQ);
  var secQSkip = document.getElementById('secQSkip'); if (secQSkip) secQSkip.addEventListener('click', closeSecQModal);
  // 忘记 PIN 弹窗
  var forgotConfirm = document.getElementById('forgotPinConfirm'); if (forgotConfirm) forgotConfirm.addEventListener('click', verifyForgotPin);
  var forgotCancel = document.getElementById('forgotPinCancel'); if (forgotCancel) forgotCancel.addEventListener('click', closeForgotPin);
  // No responsive layout - mobile only

  // URL invite detection
  const pathMatch = window.location.pathname.match(/^\/join\/([A-Z0-9]{6})$/i);
  if (pathMatch) {
    const code = pathMatch[1].toUpperCase();
    document.getElementById('ssJoinCode').value = code;
    setTimeout(() => { showToast('🔗 检测到邀请链接，请在设置中确认加入'); }, 500);
  }

  // 23:59 自动锁定当天
  function autoLockCheck() {
    const now = new Date();
    const todayStr = fmtDateFull(now);
    if (!isDateLocked(todayStr)) {
      const h = now.getHours(), m = now.getMinutes();
      if (h >= 23 && m >= 59) {
        lockedDates[todayStr] = true; saveData(true); updateLockButton();
      }
    }
  }
  autoLockCheck();
  setInterval(autoLockCheck, 30000); // 每30秒检查

  // Init - start at home
  if (!familyCode) { familyCode = generateFamilyCode(); localStorage.setItem('habitrat:familyCode', familyCode); family = { id: genId(), inviteCode: familyCode, createdAt: new Date().toISOString() }; }
  // Render initial SVG
  const childId = getChildMembers()[0]?.id || members[0]?.id;
  if (childId) renderMascotSvg(childId, 'mascotSvg');
  // lvlupOverlay 背景点击关闭
  document.getElementById('lvlupOverlay').addEventListener('click', function(e) { if (e.target === this) this.classList.remove('show'); });
  switchView('home');
  // XP 进度条 + 数字倒计时动画
  requestAnimationFrame(function() {
    var fill = document.getElementById('statusExpFill');
    var need = document.getElementById('statusExpNeed');
    var cid = getChildMembers()[0]?.id || selectedMemberId || members[0]?.id;
    if (!cid) { updateTabPill(); return; }
    var p = getExpProgress(cid);
    // 本级总需 EXP = 剩余 + 已获得（用于倒计时起始值）
    var lvlExp = getExpForLevel(p.level);
    var nextExp = getExpForLevel(p.level + 1);
    var totalNeed = nextExp - lvlExp;
    var startVal = totalNeed;
    var endVal = p.needExp;
    // 先归零
    if (fill) { fill.style.transition = 'none'; fill.style.width = '0%'; fill.style.setProperty('--xp-pct', '0'); }
    if (need) {
      need.style.transition = 'none'; need.style.left = '0%';
      need.textContent = '还需 ' + startVal + ' EXP';
    }
    if (fill) void fill.offsetWidth;
    // 恢复过渡，进度条先动
    if (fill) { fill.style.transition = ''; fill.style.width = p.progress + '%'; fill.style.setProperty('--xp-pct', p.progress); }
    // 数字倒计时（ease-out 0.6s）
    if (need && startVal !== endVal) {
      need.style.transition = '';
      var pv = p.progress;
      if (pv > 80) { need.style.left = 'auto'; need.style.right = '0'; need.style.textAlign = 'right'; }
      else { need.style.left = pv + '%'; need.style.right = 'auto'; need.style.textAlign = 'left'; }
      var startTime = performance.now();
      var range = startVal - endVal;
      function countStep(ts) {
        var elapsed = ts - startTime;
        var frac = Math.min(elapsed / 2000, 1);
        var eased = 1 - Math.pow(1 - frac, 3);
        need.textContent = '还需 ' + Math.round(startVal - range * eased) + ' EXP';
        if (frac < 1) requestAnimationFrame(countStep);
        else need.textContent = '还需 ' + endVal + ' EXP';
      }
      requestAnimationFrame(countStep);
    } else if (need) {
      need.style.transition = '';
      need.textContent = '还需 ' + endVal + ' EXP';
      var pv2 = p.progress;
      if (pv2 > 80) { need.style.left = 'auto'; need.style.right = '0'; need.style.textAlign = 'right'; }
      else { need.style.left = pv2 + '%'; need.style.right = 'auto'; need.style.textAlign = 'left'; }
    }
    updateTabPill();
  });
  window.addEventListener('resize', function() { updateTabPill(); });
  updatePeriodSummary('today');
  initSync();
	// Clock
	function updateClock() {
	  var el = document.getElementById("headerClock");
	  if (!el) return;
	  var now = new Date();
	  el.textContent = [now.getHours(), now.getMinutes(), now.getSeconds()].map(function(n) { return String(n).padStart(2,"0"); }).join(":");
	}
	updateClock();
	setInterval(updateClock, 1000);
}
init();
