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
      '奖励是家长和你一起商量好的，兑换前记得先问问。'
    ],
    tip: '金币花掉了还能再赚，每天坚持打卡就有金币。'
  },
  {
    emoji: '🔥',
    title: '连续打卡',
    lines: [
      '每天<b>全部完成</b>所有习惯，就算「全勤」一天。',
      '连续全勤的天数越多，解锁的奖励越丰厚。',
      '如果有一天没完成，连续天数就会从头开始算。'
    ],
    tip: '不用怕断掉，重新开始也是一种坚持。'
  },
  {
    emoji: '🔒',
    title: '每天结束后自动锁定',
    lines: [
      '每天到 <b>23:59</b>，当天内容会自动锁定，不能再改。',
      '这样能保证记录是真实的，避免不小心误操作。',
      '如果当天真的需要修改，可以让家长用 PIN 码解锁。'
    ]
  },
  {
    emoji: '🏖️',
    title: '节假日和寒暑假',
    lines: [
      '在假期里，有些习惯的时间要求会放松一点。',
      '寒暑假的时间段会在「设置」里由家长配置，当天顶部会有提示。'
    ]
  }
];

// 1. Legacy Data
const HABITS_LEGACY = [
  { id:'mom_bf', personKey:'xiaomei', emoji:'🥣', name:'家长吃早饭', pts:10, streakNeed:3, rule:'8:30前', ruleVacation:'9:00前', applicable:'all' },
  { id:'xm_brush', personKey:'xiaomei', emoji:'💧', name:'刷牙', pts:1, streakNeed:5, rule:'7:30前', ruleVacation:'8:00前', applicable:'all' },
  { id:'xm_wash', personKey:'xiaomei', emoji:'🧼', name:'洗脸', pts:2, streakNeed:5, rule:'7:30前', ruleVacation:'8:00前', applicable:'all' },
  { id:'xm_bf', personKey:'xiaomei', emoji:'🥣', name:'吃早饭', pts:5, streakNeed:5, rule:'7:40前', ruleVacation:'8:30前', applicable:'all' },
  { id:'xm_lunch', personKey:'xiaomei', emoji:'🍚', name:'吃午饭', pts:5, streakNeed:5, rule:'11:30-13:30', ruleVacation:'11:30-13:30', applicable:'noschool' },
  { id:'xm_dinner', personKey:'xiaomei', emoji:'🍜', name:'吃晚饭', pts:5, streakNeed:5, rule:'17:00-19:30', ruleVacation:'17:00-19:30', applicable:'all' },
  { id:'xm_sleep1', personKey:'xiaomei', emoji:'😴', name:'睡觉（目标一）', pts:10, streakNeed:5, rule:'21:30前', ruleVacation:'22:00前', applicable:'all' },
  { id:'xm_sleep2', personKey:'xiaomei', emoji:'🌙', name:'睡觉（目标二）', pts:5, streakNeed:5, rule:'22:00前', ruleVacation:'22:30前', applicable:'all' },
  { id:'mom_sleep', personKey:'xiaomei', emoji:'😴', name:'家长早睡觉', pts:10, streakNeed:3, rule:'22:30前', ruleVacation:'23:00前', applicable:'all' },
]
// 仅通用习惯（新用户默认，排除家庭特定习惯）
function getDefaultHabits() {
  return HABITS_LEGACY.filter(function(h) { return h.id !== 'mom_bf' && h.id !== 'mom_sleep' })
}
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
const DEFAULT_CHILD_NAME = '宝贝'
const DEFAULT_GUARDIAN_NAME = '家长'
function getChildDisplayName() {
  const stored = localStorage.getItem('habitrat:childName') || localStorage.getItem('habitTable_childName')
  if (stored) return stored
  const child = members.find(function(m) { return m.role === 'child' })
  if (child) return child.name
  return DEFAULT_CHILD_NAME
}
function getCoinBalance(memberId) {
  const earned = transactions.filter(t => t.memberId === memberId && (t.type === 'earn_coin' || t.type === 'bonus_coin')).reduce((s, t) => s + t.amount, 0);
  const refunded = transactions.filter(t => t.memberId === memberId && t.type === 'refund_coin').reduce((s, t) => s + t.amount, 0);
  const spent = transactions.filter(t => t.memberId === memberId && (t.type === 'spend_coin' || t.type === 'deduct_coin')).reduce((s, t) => s + t.amount, 0);
  return earned + refunded - spent;
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
function getDefaultCashItems() {
  return [
    { id: genId(), kind: 'consumable', title: '💵 兑换零花钱', cost: 1, unit: '元' },
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
function fmtDateTime(d) { return fmtDateFull(d) + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ':' + String(d.getSeconds()).padStart(2,'0'); }
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

