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
      result.transactions.push({ id: genId(), memberId: mid, type: 'earn_exp', amount: e.pts, reason: hab.name + ' 连续达标', createdAt: e.date, time: e.date + ' 00:00:00' });
      result.transactions.push({ id: genId(), memberId: mid, type: 'earn_coin', amount: e.pts, reason: hab.name + ' 连续达标', createdAt: e.date, time: e.date + ' 00:00:00' });
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
      if (members.length === 0) { members = [{ id: genId(), name: DEFAULT_GUARDIAN_NAME, role: 'guardian', totalExp: 0 }, { id: genId(), name: DEFAULT_CHILD_NAME, role: 'child', totalExp: 0 }]; }
      if (habitTemplates.length === 0) {
        const childMemberId2 = members.find(m => m.role === 'child')?.id || members[0]?.id;
        habitTemplates = HABITS_LEGACY.map(h => ({ id: h.id, ownerMemberId: childMemberId2, title: h.name, emoji: h.emoji, expValue: h.pts, coinValue: h.pts, streakNeed: h.streakNeed, ruleText: h.rule, ruleVacation: h.ruleVacation, applicable: h.applicable, archived: false }));
      }
      if (!selectedMemberId) selectedMemberId = getChildMembers()[0]?.id || members[0]?.id;

      // Clean CI transactions
      const ciCheckedIds = new Set(customItems.filter(ci => ci.status === '✓').map(ci => ci.id));
      transactions = transactions.filter(t => { if (t.type !== 'bonus_coin' && t.type !== 'bonus') return true; if (!t.reason || !t.reason.startsWith('CI:')) return true; const ciId = t.reason.slice(3).split(' ')[0]; return ciCheckedIds.has(ciId); });
      // 老用户已引导
      localStorage.setItem('habitrat:onboarded', 'true')
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
      // 老用户已引导
      localStorage.setItem('habitrat:onboarded', 'true')
      saveData(true);
      return true; // migrated
    }
  } catch(e) { console.error('loadData error:', e); }
  // Initialize defaults
  if (!family) { family = { id: genId(), inviteCode: familyCode || generateFamilyCode(), createdAt: new Date().toISOString() }; }
  if (members.length === 0) { members = [{ id: genId(), name: DEFAULT_GUARDIAN_NAME, role: 'guardian', totalExp: 0 }, { id: genId(), name: DEFAULT_CHILD_NAME, role: 'child', totalExp: 0 }]; }
  if (habitTemplates.length === 0) {
    const childMemberId3 = members.find(m => m.role === 'child')?.id || members[0]?.id;
    habitTemplates = getDefaultHabits().map(function(h) { return { id: h.id, ownerMemberId: childMemberId3, title: h.name, emoji: h.emoji, expValue: h.pts, coinValue: h.pts, streakNeed: h.streakNeed, ruleText: h.rule, ruleVacation: h.ruleVacation, applicable: h.applicable, archived: false } })
  }
  if (rewardItems.length === 0) {
    rewardItems = [{ id: genId(), kind: 'consumable', title: '🎮 玩游戏', cost: 1, unit: '分钟' }];
    getDefaultCashItems().forEach(function(c) { rewardItems.push(c); });
    getDefaultCollectibles().forEach(c => { rewardItems.push({ id: genId(), kind: 'collectible', title: c.name, emoji: c.emoji, unlockLevel: c.level }); });
  }
  // 补填现金兑换项（已有数据的老用户）
  if (!rewardItems.some(function(r) { return r.unit === '元'; })) {
    getDefaultCashItems().forEach(function(c) { rewardItems.push(c); });
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
  var curEmoji = ci.emoji || '📌';
  var isCustomEmoji = !HABIT_EMOJI_OPTIONS.includes(curEmoji);
  var emojiGrid = '<div style="margin-bottom:8px;"><div style="font-size:12px;color:var(--ink-soft);margin-bottom:4px;">图标</div><div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;" id="ciEditEmojiGrid">';
  HABIT_EMOJI_OPTIONS.forEach(function(e) {
    emojiGrid += '<span class="emoji-opt" style="font-size:20px;cursor:pointer;padding:3px 5px;border-radius:6px;'+(e===curEmoji&&!isCustomEmoji?'background:var(--surface-tab);border:2px solid var(--steel);':'border:2px solid transparent;')+'" data-emoji="'+e+'" onclick="var g=document.getElementById(\'ciEditEmojiGrid\');g.querySelectorAll(\'.emoji-opt\').forEach(function(s){s.style.background=\'\';s.style.border=\'2px solid transparent\'});this.style.background=\'var(--surface-tab)\';this.style.border=\'2px solid var(--steel)\';document.getElementById(\'ciEditEmoji\').value=this.dataset.emoji;var ci2=document.getElementById(\'ciEditEmojiCustom\');if(ci2)ci2.value=\'\'">'+e+'</span>';
  });
  emojiGrid += '<input type="text" id="ciEditEmojiCustom" value="'+(isCustomEmoji?curEmoji:'')+'" placeholder="自选" maxlength="2" style="width:42px;padding:4px 2px;border:2px solid var(--paper-deep);border-radius:6px;font-size:14px;text-align:center;" oninput="var v=this.value;document.getElementById(\'ciEditEmoji\').value=v||\''+(isCustomEmoji?curEmoji:'📌')+'\';if(v){var g=document.getElementById(\'ciEditEmojiGrid\');g.querySelectorAll(\'.emoji-opt\').forEach(function(s){s.style.background=\'\';s.style.border=\'2px solid transparent\'})}">';
  emojiGrid += '</div><input type="hidden" id="ciEditEmoji" value="'+curEmoji+'"></div>';
  var memberOpts = members.map(function(m){return '<option value="'+m.id+'"'+(m.id===(ci.ownerMemberId||(getChildMembers()[0]||{}).id||(members[0]||{}).id)?' selected':'')+'>'+m.name+'</option>';}).join('');
  showModalForm('✎ 编辑自定义事件',
    '<input id="ciEditTitle" value="'+(ci.title||'')+'" placeholder="事件名称" style="width:100%;padding:10px;border:2px solid var(--paper-deep);border-radius:8px;font-size:14px;margin-bottom:8px;">'
    + '<input id="ciEditDetail" value="'+(ci.detail||'')+'" placeholder="内容说明（可选）" style="width:100%;padding:10px;border:2px solid var(--paper-deep);border-radius:8px;font-size:14px;margin-bottom:8px;">'
    + emojiGrid
    + '<div style="display:flex;gap:8px;margin-bottom:8px;align-items:center;"><span style="font-size:12px;color:var(--ink-soft);white-space:nowrap;">归属</span><select id="ciEditMember" style="flex:1;padding:10px;border:2px solid var(--paper-deep);border-radius:8px;font-size:14px;">'+memberOpts+'</select></div>'
    + '<div style="display:flex;gap:8px;margin-bottom:14px;align-items:center;"><span style="font-size:13px;white-space:nowrap;">EXP</span><input id="ciEditExp" type="number" value="'+(ci.expValue??5)+'" min="0" style="width:70px;padding:10px;border:2px solid var(--paper-deep);border-radius:8px;font-size:14px;"><span style="font-size:13px;white-space:nowrap;">💰</span><input id="ciEditCoin" type="number" value="'+(ci.coinValue??5)+'" min="0" style="width:70px;padding:10px;border:2px solid var(--paper-deep);border-radius:8px;font-size:14px;"></div>',
    function() {
      var t = document.getElementById('ciEditTitle').value.trim();
      if (!t) { showToast('请输入事件名称'); return false; }
      ci.title = t;
      ci.detail = document.getElementById('ciEditDetail').value.trim();
      ci.emoji = document.getElementById('ciEditEmoji').value || '📌';
      ci.ownerMemberId = document.getElementById('ciEditMember').value;
      ci.expValue = parseInt(document.getElementById('ciEditExp').value) || 0;
      ci.coinValue = parseInt(document.getElementById('ciEditCoin').value) || 0;
      saveData(); showToast('✅ 已更新');
      if (onSave) onSave();
    });
}

function editMascotName() {
  var cur = getChildDisplayName()
  var name = prompt('宝贝名字', cur)
  if (name !== null && name.trim()) {
    localStorage.setItem('habitrat:childName', name.trim());
    document.getElementById('mascotName').textContent = name.trim();
    showToast('✅ 已更新');
  }
}
var _avatarPressTimer = null
function changeAvatar() {
  // 在 mousedown/touchstart 绑定时启动计时器，此处不做任何事（onclick 保留用于快速点击场景）
  document.getElementById('avatarFileInput').click()
}
// 长按恢复默认 — 在 init() 中绑定
function bindAvatarLongPress() {
  var ring = document.getElementById('mascotRing')
  if (!ring) return
  function startTimer(e) {
    _avatarPressTimer = setTimeout(async function() {
      _avatarPressTimer = null
      if (!localStorage.getItem('habitrat:avatar') && !localStorage.getItem('habitTable_avatar')) return
      var ok = await showConfirm('恢复为默认 Ratty 头像？', true)
      if (!ok) return
      localStorage.removeItem('habitrat:avatar')
      localStorage.removeItem('habitTable_avatar')
      updateAvatarDisplay()
      showToast('↩️ 已恢复默认头像')
    }, 600)
  }
  function cancelTimer() {
    if (_avatarPressTimer) { clearTimeout(_avatarPressTimer); _avatarPressTimer = null }
  }
  ring.addEventListener('mousedown', startTimer)
  ring.addEventListener('mouseup', cancelTimer)
  ring.addEventListener('mouseleave', cancelTimer)
  ring.addEventListener('touchstart', startTimer, { passive: true })
  ring.addEventListener('touchend', cancelTimer)
  ring.addEventListener('touchcancel', cancelTimer)
}
function handleAvatarUpload(input) {
  var file = input.files[0]; if (!file) return
  var reader = new FileReader()
  reader.onload = function(e) {
    localStorage.setItem('habitrat:avatar', e.target.result)
    updateAvatarDisplay()
    showToast('✅ 头像已更新')
  }
  reader.readAsDataURL(file)
  // 清空 input 使同一文件可再次选中
  input.value = ''
}
function updateAvatarDisplay() {
  var url = (localStorage.getItem('habitrat:avatar') || localStorage.getItem('habitTable_avatar')) || 'docs/design/头像.png'
  var img = document.getElementById('mascotAvatar')
  var svg = document.getElementById('mascotSvg')
  if (!img || !svg) return
  img.src = url
  img.className = 'avatar-custom'
  img.style.display = 'block'
  svg.style.display = 'none'
}

// ========== 习惯编辑弹窗 ==========
// 常用习惯 emoji 候选
const HABIT_EMOJI_OPTIONS = ['🥣','🍚','🍜','💧','🧼','😴','🌙','📚','✏️','🎵','🏃','🚴','🧘','📖','🎨','🧹','🛏','⏰','💊','🥗','🏊','🎮','📵','🧸','📌'];

function _renderHabitFormFields(h, prefix) {
  var curEmoji = h ? (h.emoji||'📌') : '📌';
  var isCustomEmoji = !HABIT_EMOJI_OPTIONS.includes(curEmoji);
  var emojiGrid = '<div style="margin-bottom:8px;"><div style="font-size:12px;color:var(--ink-soft);margin-bottom:4px;">图标</div><div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;" id="'+prefix+'EmojiGrid">';
  HABIT_EMOJI_OPTIONS.forEach(function(e) {
    emojiGrid += '<span class="emoji-opt" style="font-size:20px;cursor:pointer;padding:3px 5px;border-radius:6px;'+(e===curEmoji&&!isCustomEmoji?'background:var(--surface-tab);border:2px solid var(--steel);':'border:2px solid transparent;')+'" data-emoji="'+e+'" onclick="var g=document.getElementById(\''+prefix+'EmojiGrid\');g.querySelectorAll(\'.emoji-opt\').forEach(function(s){s.style.background=\'\';s.style.border=\'2px solid transparent\'});this.style.background=\'var(--surface-tab)\';this.style.border=\'2px solid var(--steel)\';document.getElementById(\''+prefix+'Emoji\').value=this.dataset.emoji;var ci=document.getElementById(\''+prefix+'EmojiCustom\');if(ci)ci.value=\'\'">'+e+'</span>';
  });
  emojiGrid += '<input type="text" id="'+prefix+'EmojiCustom" value="'+(isCustomEmoji?curEmoji:'')+'" placeholder="自选" maxlength="2" style="width:42px;padding:4px 2px;border:2px solid var(--paper-deep);border-radius:6px;font-size:14px;text-align:center;" oninput="var v=this.value;document.getElementById(\''+prefix+'Emoji\').value=v||\''+(isCustomEmoji?curEmoji:'📌')+'\';if(v){var g=document.getElementById(\''+prefix+'EmojiGrid\');g.querySelectorAll(\'.emoji-opt\').forEach(function(s){s.style.background=\'\';s.style.border=\'2px solid transparent\'})}">';
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
  // 统计已有打卡记录
  var checkDays = 0;
  Object.keys(checks).forEach(function(wk) {
    var weekData = checks[wk];
    if (weekData[h.id]) {
      weekData[h.id].forEach(function(st) { if (st === '✓') checkDays++; });
    }
  });
  // 统计连续达标次数
  var streakRewards = transactions.filter(function(t) {
    return t.habitId === h.id && t.type === 'earn_coin';
  }).length;

  var warningHtml = '';
  if (checkDays > 0) {
    warningHtml = '<div style="background:#fff8e1;border:1px solid var(--amber);border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:var(--amber-deep);line-height:1.6;">'
      + '⚠️ 该习惯已有 <b>' + checkDays + '</b> 天打卡记录' + (streakRewards > 0 ? '和 <b>' + streakRewards + '</b> 次连续达标奖励' : '') + '。<br>'
      + '修改 EXP/💰/连续天数仅影响<b>未来</b>打卡，历史积分保持不变。</div>';
  }

  // 保存修改前的规则值，用于检测变更
  var oldStreakNeed = h.streakNeed;
  var oldExpValue = h.expValue;
  var oldCoinValue = h.coinValue;
  var oldApplicable = h.applicable;

  showModalForm('✎ 编辑习惯', warningHtml + _renderHabitFormFields(h, 'he'), function() {
    if (!_readHabitFormFields('he', h)) return false;
    // 如果规则字段有变化且有历史记录，记录变更日期
    if (checkDays > 0) {
      if (oldStreakNeed !== h.streakNeed || oldExpValue !== h.expValue ||
          oldCoinValue !== h.coinValue || oldApplicable !== h.applicable) {
        h.ruleChangedAt = fmtDateFull(new Date());
      }
    }
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
  document.getElementById('lvlupDesc').textContent = hasUnlock ? 'HabitRat 获得了新装扮！' : '继续加油，养成好习惯';
  // Confetti
  spawnConfetti();
  el.classList.add('show');
  document.getElementById('lvlupClose').textContent = '好的！';
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
    unlockHtml = '<div class="lu-label">🌱 继续打卡升级来解锁物品</div>';
  }
  unlockDiv.style.display = 'block';
  unlockDiv.innerHTML = unlockHtml;
  // Change close button
  document.getElementById('lvlupClose').textContent = '知道了';
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
/** 核心引擎：从最早数据日期遍历打卡数据，重算连续天数、发放 EXP/Coin、检测升级。每次打卡/编辑后必须调用 */

/** 找到数据中最早的日期（从 checks + transactions），用于扫描起点 */
function findEarliestDataDate() {
  var earliest = new Date(); // 默认今天
  // 从 checks 中找最早周
  Object.keys(checks).forEach(function(wk) {
    var parts = wk.split('-W');
    if (parts.length !== 2) return;
    var year = parseInt(parts[0]), week = parseInt(parts[1]);
    // ISO 周 1 的周一：1月4日所在周的周一
    var jan4 = new Date(year, 0, 4);
    var dayOfJan4 = jan4.getDay() || 7;
    var monWeek1 = new Date(jan4);
    monWeek1.setDate(jan4.getDate() - (dayOfJan4 - 1));
    // 目标周的周一
    var mon = new Date(monWeek1);
    mon.setDate(monWeek1.getDate() + (week - 1) * 7);
    if (mon < earliest) earliest = mon;
  });
  // 从 transactions 中找最早日期
  transactions.forEach(function(t) {
    if (t.createdAt) {
      var d = new Date(t.createdAt + 'T00:00:00');
      if (!isNaN(d) && d < earliest) earliest = d;
    }
  });
  // 再往前多扫一周，确保不会漏掉跨周连续
  earliest.setDate(earliest.getDate() - 7);
  return earliest;
}

/** 为历史交易补填 habitId（迁移辅助，idempotent） */
function migrateTxHabitIds() {
  var titleToId = {};
  habitTemplates.forEach(function(h) { titleToId[h.title] = h.id; });
  transactions.forEach(function(t) {
    if (t.habitId) return; // 已有，跳过
    if (t.type === 'earn_exp' && t.reason && t.reason.startsWith('[单次] ')) {
      var title = t.reason.slice(4);
      if (titleToId[title]) t.habitId = titleToId[title];
    } else if (t.type === 'earn_coin' && t.reason && t.reason.indexOf(' 连续达标') > -1) {
      var title2 = t.reason.replace(' 连续达标', '');
      if (titleToId[title2]) t.habitId = titleToId[title2];
    }
  });
}

// 为缺少 time 字段的历史交易补填时间（idempotent）
function migrateTxTime() {
  transactions.forEach(function(t) {
    if (t.time) return;
    var ca = t.createdAt || '';
    if (ca.length === 10 && ca.indexOf('-') > -1) {
      t.time = ca + ' 00:00:00';
    } else if (ca.length >= 16) {
      t.time = ca.length === 19 ? ca : ca.slice(0, 16) + ':00';
    }
  });
}

function recomputeStreaks() {
  streakState = {}; effectiveLog = {};
  const todayStr = fmtDateFull(new Date());

  // 迁移：为历史交易补填 habitId 和 time（idempotent）
  migrateTxHabitIds();
  migrateTxTime();

  // 建立 habitId → habit 索引（含所有习惯，不限于活跃）
  var allHabitsById = {};
  habitTemplates.forEach(function(h) { allHabitsById[h.id] = h; });

  // 建立已处理记录索引：已发过 EXP/Coin 的日期+habitId 不再重复发放，保留历史分值
  var earnedExpSet = {};
  var earnedCoinSet = {};
  transactions.forEach(function(t) {
    if (t.type === 'earn_exp' && t.habitId) {
      earnedExpSet[t.createdAt + '|' + t.habitId] = true;
    } else if (t.type === 'earn_exp' && t.reason && t.reason.startsWith('[单次] ')) {
      // 遗留交易无 habitId — 尝试匹配
      var h1 = habitTemplates.find(function(x) { return x.title === t.reason.slice(4); });
      if (h1) { t.habitId = h1.id; earnedExpSet[t.createdAt + '|' + h1.id] = true; }
    }
    if (t.type === 'earn_coin' && t.habitId) {
      earnedCoinSet[t.createdAt + '|' + t.habitId] = true;
    } else if (t.type === 'earn_coin' && t.reason && t.reason.indexOf(' 连续达标') > -1) {
      var title2 = t.reason.replace(' 连续达标', '');
      var h2 = habitTemplates.find(function(x) { return x.title === title2; });
      if (h2) { t.habitId = h2.id; earnedCoinSet[t.createdAt + '|' + h2.id] = true; }
    }
  });

  // 孤儿检测：从最早数据日期开始扫描 ALL 习惯（含归档），确保已归档习惯的交易不会被误删
  // Bug C 修复：不再使用 365 天硬编码窗口，改为动态找到最早数据日期
  var validExpKeys = {};
  var validCoinKeys = {};
  var cursor2 = findEarliestDataDate();
  while (fmtDateFull(cursor2) <= todayStr) {
    var ds2 = fmtDateFull(cursor2);
    habitTemplates.forEach(function(h) {
      if (!isDayApplicable(h, cursor2)) return;
      if (getDayStatus(h, cursor2) === '✓') {
        validExpKeys[ds2 + '|' + h.id] = true;
        var sc = (streakState[h.id] && streakState[h.id].count) || 0;
        var prevDate = (streakState[h.id] && streakState[h.id].lastDate) || null;
        if (prevDate && datesConsecutive(new Date(prevDate), cursor2)) { sc++; }
        else if (prevDate && prevDate === ds2) {}
        else { sc = 1; }
        if (!streakState[h.id]) streakState[h.id] = { count: 0, lastDate: null };
        streakState[h.id].count = sc;
        streakState[h.id].lastDate = ds2;
        if (sc >= (h.streakNeed || 5)) {
          validCoinKeys[ds2 + '|' + h.id] = true;
          streakState[h.id].count = 0;
          streakState[h.id].lastDate = null;
        }
      } else if (getDayStatus(h, cursor2) === '✗' || (getDayStatus(h, cursor2) === '○' && ds2 < todayStr)) {
        if (streakState[h.id]) { streakState[h.id].count = 0; streakState[h.id].lastDate = null; }
      }
    });
    cursor2.setDate(cursor2.getDate() + 1);
  }

  // 剔除孤儿交易：仅删除「活跃习惯中打卡状态已变为 ✗/○ 但交易还在」的条目
  // 已归档/已删除习惯的交易（habitId 不在活跃列表中）不在此过滤，始终保留
  var activeHabitIds = {};
  getActiveHabits().forEach(function(h) { activeHabitIds[h.id] = true; });

  // Bug D 修复：验证 earn_coin 的底层 ✓ 连续是否存在（用 snapshot.streakNeed）
  // 避免因修改 streakNeed 导致历史金币被回退
  // 非 applicable 日跳过（与原始算法一致：假期/周末不打断连续）
  function verifyCoinStreak(t, habit) {
    if (!habit) return true; // 习惯不存在，保留
    var need = (t.snapshot && t.snapshot.streakNeed) || habit.streakNeed || 5;
    var coinDate = new Date(t.createdAt + 'T00:00:00');
    var cons = 0;
    var cursor = new Date(coinDate);
    // 向后扫描最多 120 天，跳过非 applicable 日
    for (var i = 0; i < 120; i++) {
      if (!isDayApplicable(habit, cursor)) { cursor.setDate(cursor.getDate() - 1); continue; }
      if (getDayStatus(habit, cursor) === '✓') { cons++; }
      else { break; } // ✗ 或 ○ 中断连续
      if (cons >= need) return true;
      cursor.setDate(cursor.getDate() - 1);
    }
    return cons >= need;
  }

  transactions = transactions.filter(function(t) {
    if (t.type === 'earn_exp' && t.habitId) {
      if (!activeHabitIds[t.habitId]) return true; // 已归档/已删除的习惯，保留
      return validExpKeys[t.createdAt + '|' + t.habitId];
    }
    if (t.type === 'earn_coin' && t.habitId) {
      if (!activeHabitIds[t.habitId]) return true; // 已归档/已删除的习惯，保留
      // Bug D：用实际 ✓ 连续验证，而非用当前 streakNeed 重算
      return verifyCoinStreak(t, allHabitsById[t.habitId]);
    }
    // 无 habitId 的遗留 earn_exp（兜底，保留）
    if (t.type === 'earn_exp' && t.reason && t.reason.startsWith('[单次] ')) {
      var h3 = habitTemplates.find(function(x) { return x.title === t.reason.slice(4); });
      if (h3) return validExpKeys[t.createdAt + '|' + h3.id];
      return true; // 无法匹配，保留
    }
    if (t.type === 'earn_coin' && t.reason && t.reason.indexOf(' 连续达标') > -1) {
      var title4 = t.reason.replace(' 连续达标', '');
      var h4 = habitTemplates.find(function(x) { return x.title === title4; });
      if (h4) return verifyCoinStreak(t, h4);
      return true; // 无法匹配，保留
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

  // 预计算每个习惯的「旧规则」快照（用于 ruleChangedAt 之前的日期）
  var oldRules = {};
  getActiveHabits().forEach(function(h) {
    if (!h.ruleChangedAt) return;
    var oldTx = null;
    // 找 ruleChangedAt 之前最近的一笔交易，提取旧规则
    for (var ti = transactions.length - 1; ti >= 0; ti--) {
      var tx = transactions[ti];
      if (tx.habitId === h.id && (tx.type === 'earn_exp' || tx.type === 'earn_coin') &&
          tx.snapshot && tx.createdAt < h.ruleChangedAt) {
        oldTx = tx; break;
      }
    }
    if (oldTx && oldTx.snapshot) {
      oldRules[h.id] = {
        streakNeed: oldTx.snapshot.streakNeed || h.streakNeed || 5,
        expValue: oldTx.snapshot.expValue || h.expValue || 10,
        coinValue: oldTx.snapshot.coinValue || h.coinValue || 10
      };
    }
  });

  // 主计算：从最早数据日期开始，只对活跃习惯补发未处理的日期
  // Bug C 修复：不再使用 365 天硬编码窗口
  var cursor = findEarliestDataDate();
  while (fmtDateFull(cursor) <= todayStr) {
    var ds = fmtDateFull(cursor);
    getActiveHabits().forEach(function(h) {
      if (!isDayApplicable(h, cursor)) return;

      // 根据日期选择有效规则：ruleChangedAt 之前的日期用旧规则
      var useOldRules = h.ruleChangedAt && ds < h.ruleChangedAt && oldRules[h.id];
      var effStreakNeed = useOldRules ? oldRules[h.id].streakNeed : (h.streakNeed || 5);
      var effExpValue = useOldRules ? oldRules[h.id].expValue : (h.expValue || 10);
      var effCoinValue = useOldRules ? oldRules[h.id].coinValue : (h.coinValue || 10);

      var status = getDayStatus(h, cursor);
      if (status === '✓') {
        var meta = getHabitMeta(h.id);
        var singleExp = effExpValue;
        var expKey = ds + '|' + h.id;
        if (!earnedExpSet[expKey]) {
          transactions.push({ id: genId(), habitId: h.id, memberId: meta.ownerMemberId, type: 'earn_exp', amount: singleExp, reason: '[单次] ' + h.title, createdAt: ds,
            time: fmtDateTime(new Date()),
            snapshot: { expValue: effExpValue, coinValue: effCoinValue, streakNeed: effStreakNeed } });
        }
        var mem = getMemberById(meta.ownerMemberId);
        if (mem && !earnedExpSet[expKey]) mem.totalExp += singleExp;

        var prev = streakState[h.id].lastDate;
        if (prev && datesConsecutive(new Date(prev), cursor)) { streakState[h.id].count++; }
        else if (prev && prev === ds) {}
        else { streakState[h.id].count = 1; }
        streakState[h.id].lastDate = ds;

        if (streakState[h.id].count >= effStreakNeed) {
          effectiveLog[h.id].push({ date: ds, pts: effCoinValue * effStreakNeed });
          var earnCoin = effCoinValue * effStreakNeed;
          var coinKey = ds + '|' + h.id;
          if (!earnedCoinSet[coinKey]) {
            transactions.push({ id: genId(), habitId: h.id, memberId: meta.ownerMemberId, type: 'earn_coin', amount: earnCoin, reason: h.title + ' 连续达标', createdAt: ds,
              time: fmtDateTime(new Date()),
              snapshot: { expValue: effExpValue, coinValue: effCoinValue, streakNeed: effStreakNeed } });
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
  saveData(); // 修复 Bug F：每次 recompute 后立即持久化
}

function getEffPts(habitId) { return (effectiveLog[habitId]||[]).reduce((s,e) => s + e.pts, 0); }
function getStreakCount(habitId) { return (streakState[habitId]||{}).count || 0; }



