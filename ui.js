/** 切换今日/周/月时联动更新：统计行小字 + 完成进度行显隐 + 进度条数值 */
function updatePeriodSummary(period) {
  const childId = getChildMembers()[0]?.id || selectedMemberId || members[0]?.id;
  if (!childId) return;
  const today = new Date(); const todayStr = fmtDateFull(today);
  let earned = 0, refunded = 0, spent = 0, totalDone = 0, totalAll = 0;
  let label = '', rangeStart, rangeEnd;
  if (period === 'today') {
    earned = transactions.filter(t => t.memberId === childId && (t.type === 'earn_coin' || t.type === 'bonus_coin') && t.createdAt === todayStr).reduce((s, t) => s + t.amount, 0);
    refunded = transactions.filter(t => t.memberId === childId && t.type === 'refund_coin' && t.createdAt === todayStr).reduce((s, t) => s + t.amount, 0);
    spent = transactions.filter(t => t.memberId === childId && (t.type === 'spend_coin' || t.type === 'deduct_coin') && t.createdAt === todayStr).reduce((s, t) => s + t.amount, 0);
    label = '今日'; rangeStart = todayStr; rangeEnd = todayStr;
    getActiveHabits().forEach(h => { if (isDayApplicable(h, today)) { totalAll++; if (getDayStatus(h, today) === '✓') totalDone++; } });
    document.getElementById('completionRow').style.display = 'none';
  } else if (period === 'week') {
    const mon = getMonday(today); const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    rangeStart = fmtDateFull(mon); rangeEnd = fmtDateFull(sun);
    earned = transactions.filter(t => t.memberId === childId && (t.type === 'earn_coin' || t.type === 'bonus_coin') && t.createdAt >= rangeStart && t.createdAt <= rangeEnd).reduce((s, t) => s + t.amount, 0);
    refunded = transactions.filter(t => t.memberId === childId && t.type === 'refund_coin' && t.createdAt >= rangeStart && t.createdAt <= rangeEnd).reduce((s, t) => s + t.amount, 0);
    spent = transactions.filter(t => t.memberId === childId && (t.type === 'spend_coin' || t.type === 'deduct_coin') && t.createdAt >= rangeStart && t.createdAt <= rangeEnd).reduce((s, t) => s + t.amount, 0);
    label = '本周';
    for (let i = 0; i < 7; i++) { const d = new Date(mon); d.setDate(mon.getDate() + i); if (fmtDateFull(d) > todayStr) break; getActiveHabits().forEach(h => { if (!isDayApplicable(h, d)) return; totalAll++; if (getDayStatus(h, d) === '✓') totalDone++; }); }
    document.getElementById('completionRow').style.display = 'flex';
    document.getElementById('completionLabel').textContent = '本周';
  } else if (period === 'month') {
    const ym = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
    earned = transactions.filter(t => t.memberId === childId && (t.type === 'earn_coin' || t.type === 'bonus_coin') && t.createdAt && t.createdAt.startsWith(ym)).reduce((s, t) => s + t.amount, 0);
    refunded = transactions.filter(t => t.memberId === childId && t.type === 'refund_coin' && t.createdAt && t.createdAt.startsWith(ym)).reduce((s, t) => s + t.amount, 0);
    spent = transactions.filter(t => t.memberId === childId && (t.type === 'spend_coin' || t.type === 'deduct_coin') && t.createdAt && t.createdAt.startsWith(ym)).reduce((s, t) => s + t.amount, 0);
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
  const memberName = member ? member.name : getChildDisplayName()

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
  if (SCENE_EDITOR_ENABLED) setTimeout(function() { var b = document.getElementById('btnSceneEditor'); if (b) b.style.display = 'block'; }, 300);
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
const SCENE_EDITOR_ENABLED = false; // 暂时隐藏「编辑热区」按钮（功能保留），需要时改为 true 恢复

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
  var rat = document.getElementById('sceneRat');
  var isMain = scene === 'main';
  // 过渡期间先隐藏 Ratty，等背景图加载完成（模糊结束）后再显示，避免在模糊背景上提前出现
  if (rat) rat.style.display = 'none';
  if (bg) {
    bg.classList.add('switching');
    var url = sceneImages[scene] || sceneImages.main;
    var done = false;
    function finish() {
      if (done) return; done = true;
      bg.src = url;
      bg.classList.remove('switching');
      if (rat && isMain) rat.style.display = '';
    }
    var img = new Image();
    img.onload = finish;
    img.onerror = finish;
    // 至少保持模糊过渡 200ms 可见（图片缓存命中时 onload 会立即触发，避免瞬间切换）
    setTimeout(finish, 200);
    img.src = url;
  } else if (rat && isMain) {
    rat.style.display = '';
  }
  currentScene = scene;
  var back = document.getElementById('sceneBackBtn');
  var room = document.getElementById('sceneRoom');
  var decos = document.getElementById('sceneDecos');
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
  document.querySelectorAll('.shop-spend-btn').forEach(btn => { btn.addEventListener('click', async function(e) { e.stopPropagation();
    const idx = parseInt(this.dataset.idx); const items = rewardItems.filter(r => r.kind === 'consumable');
    const item = items[idx]; if (!item) return;
    const qty = parseInt(document.querySelector('.psi-qty-input[data-idx="'+idx+'"]')?.value) || 1;
    const total = qty * item.cost;
    if (total <= 0 || total > getCoinBalance(selectedMemberId)) { showToast(total<=0?'请输入有效数量':'😅 Coin不够哦'); return; }
    // 兑换前确认，防止误操作
    const ok = await showConfirm('兑换「' + item.title + '」x' + qty + '，扣除 ' + total + ' 金币？', false);
    if (!ok) return;
    transactions.push({ id: genId(), memberId: selectedMemberId, type: 'spend_coin', amount: total, reason: item.title+' x'+qty, createdAt: fmtDateFull(new Date()), time: fmtDateTime(new Date()) });
    logOp(getMemberName(selectedMemberId), '兑换', item.title+' x'+qty+' (-'+total+' Coin)');
    saveData(); showToast('🎉 兑换成功！'); updatePointsSheet(); updateHeader();
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
      const label = t.type === 'spend_coin' ? '🛍️ 兑换' : t.type === 'refund_coin' ? '↩️ 退回' : t.type === 'deduct_coin' ? '⚠️ 扣分' : t.type === 'bonus_coin' ? '✨ 加分' : t.type === 'bonus_exp' ? '⭐ EXP奖励' : t.type === 'earn_exp' ? '📈 经验' : t.type === 'earn_coin' ? '💰 金币' : '📋 其他';
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
      // 补填现金兑换项（同步后确保存在）
      if (rewardItems && !rewardItems.some(function(r) { return r.unit === '元'; })) {
        getDefaultCashItems().forEach(function(c) { rewardItems.push(c); });
      }
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
  var savedName=getChildDisplayName()
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
  var savedName = getChildDisplayName()

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
  let pendingCoin = 0;
  getActiveHabits().forEach(h => {
    const meta = getHabitMeta(h.id);
    if (meta.ownerMemberId !== childId) return;
    const sc = getStreakCount(h.id);
    if (sc > 0) pendingCoin += (h.coinValue || meta.coinValue || 10) * sc;
  });
  const spentCoin = transactions.filter(t => t.memberId === childId && (t.type === 'spend_coin' || t.type === 'deduct_coin')).reduce((s, t) => s + t.amount, 0);
  document.getElementById('statusCoinBal').textContent = coin;
  document.getElementById('statusPendingCoin').textContent = pendingCoin;
  document.getElementById('statusSpentVal').textContent = spentCoin;
  // XP ring
  const ring = document.getElementById('mascotRing');
  if (ring) ring.style.setProperty('--xp-pct', prog.progress);
  // SVG mascot — 暂时关闭，Hero 区使用静态 PNG
  // renderMascotSvg(childId, 'mascotSvg');
  // Mascot name + avatar
  const mnEl = document.getElementById('mascotName');
  if (mnEl) mnEl.textContent = getChildDisplayName()
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
function showSpentHistory() {
  var childId = getChildMembers()[0]?.id || selectedMemberId || members[0]?.id
  if (!childId) return
  var records = transactions.filter(function(t) {
    return t.memberId === childId && (t.type === 'spend_coin' || t.type === 'deduct_coin' || t.type === 'refund_coin')
  }).sort(function(a, b) { return (b.createdAt || '').localeCompare(a.createdAt || '') })
  var html = ''
  if (records.length === 0) {
    html = '<div style="text-align:center;color:var(--ink-soft);padding:20px;">暂无兑换记录</div>'
  } else {
    var totalSpent = 0, totalRefunded = 0
    records.forEach(function(t) {
      var dateStr = t.createdAt ? t.createdAt.slice(0, 10) : ''
      var isRefund = t.type === 'refund_coin'
      var isDeduct = t.type === 'deduct_coin'
      if (isRefund) {
        totalRefunded += t.amount
        html += '<div class="css-row"><div style="min-width:0;"><div class="css-reason" style="color:var(--teal);">↩️ ' + (t.reason || '退回') + '</div><div class="css-date">' + dateStr + '</div></div><span class="css-amt" style="color:var(--teal);">+' + t.amount + '</span></div>'
      } else if (isDeduct) {
        totalSpent += t.amount
        html += '<div class="css-row"><div style="min-width:0;"><div class="css-reason">⚠️ ' + (t.reason || '扣分') + '</div><div class="css-date">' + dateStr + '</div></div><span class="css-amt" style="color:var(--coral);">-' + t.amount + '</span></div>'
      } else {
        totalSpent += t.amount
        var refunded = t.refundedAmount || 0
        var refundMark = refunded > 0 ? ' <span style="font-size:10px;color:var(--teal);">(已退' + refunded + ')</span>' : ''
        html += '<div class="css-row"><div style="min-width:0;"><div class="css-reason">🛍️ ' + (t.reason || '兑换') + refundMark + '</div><div class="css-date">' + dateStr + '</div></div><span class="css-amt">-' + t.amount + '</span></div>'
      }
    })
    var netSpent = totalSpent - totalRefunded
    html += '<div class="css-total"><span>合计支出 ' + totalSpent + ' · 退回 ' + totalRefunded + '</span><span style="color:var(--coral);">🛍️ ' + netSpent + '</span></div>'
  }
  document.getElementById('cssTitle').textContent = '🛍️ 兑换记录'
  document.getElementById('cssBody').innerHTML = html
  document.getElementById('coinSourceOverlay').classList.add('show')
  document.getElementById('coinSourceSheet').classList.add('show')
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
  if (cnInput) cnInput.value = getChildDisplayName()
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
  setupBackfillSection();
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
function setupBackfillSection() {
  var today = new Date(); today.setHours(0,0,0,0);
  var todayStr = fmtDateFull(today);
  var maxPast = new Date(today); maxPast.setDate(today.getDate() - 45);
  var maxPastStr = fmtDateFull(maxPast);
  var yesterdayStr = fmtDateFull(new Date(today.getTime() - 86400000));

  // 设置日期输入限制
  var startEl = document.getElementById('ssBackfillStart');
  var endEl = document.getElementById('ssBackfillEnd');
  if (startEl) { startEl.min = maxPastStr; startEl.max = yesterdayStr; startEl.value = maxPastStr; }
  if (endEl) { endEl.min = maxPastStr; endEl.max = yesterdayStr; endEl.value = yesterdayStr; }

  // 渲染习惯多选框
  var habitsContainer = document.getElementById('ssBackfillHabits');
  if (!habitsContainer) return;
  var activeHabits = getActiveHabits();
  var html = '';
  activeHabits.forEach(function(h) {
    html += '<label style="display:flex;align-items:center;gap:4px;font-size:12px;padding:4px 8px;background:var(--paper);border-radius:6px;cursor:pointer;">'
      + '<input type="checkbox" class="ss-backfill-habit" value="' + h.id + '" checked>'
      + (h.emoji || '📌') + ' ' + h.title + '</label>';
  });
  habitsContainer.innerHTML = html;

  // 按钮事件
  var btn = document.getElementById('ssBackfillBtn');
  if (!btn) return;
  // 移除旧事件避免重复绑定
  var newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', async function() {
    var startVal = document.getElementById('ssBackfillStart').value;
    var endVal = document.getElementById('ssBackfillEnd').value;
    if (!startVal || !endVal) { showToast('请选择日期范围'); return; }
    if (startVal > endVal) { showToast('开始日期不能晚于结束日期'); return; }

    var selectedIds = [];
    document.querySelectorAll('.ss-backfill-habit:checked').forEach(function(cb) { selectedIds.push(cb.value); });
    if (selectedIds.length === 0) { showToast('请至少选择一个习惯'); return; }

    // 确认
    var startD = new Date(startVal + 'T00:00:00');
    var endD = new Date(endVal + 'T00:00:00');
    var dayCount = Math.floor((endD - startD) / 86400000) + 1;
    var habitNames = selectedIds.map(function(id) {
      var h = habitTemplates.find(function(x) { return x.id === id; });
      return h ? h.title : id;
    }).join('、');
    if (!await showConfirm('将「' + habitNames + '」\n从 ' + startVal + ' 到 ' + endVal + '（共 ' + dayCount + ' 天）\n全部设为 ✓ 完成？\n\n完成后会自动重算积分。', true)) return;

    // 执行：遍历每一天、每个习惯，设为 ✓
    var cursor = new Date(startD);
    while (cursor <= endD) {
      var ds = fmtDateFull(cursor);
      selectedIds.forEach(function(hid) {
        var h = habitTemplates.find(function(x) { return x.id === hid; });
        if (h && isDayApplicable(h, cursor)) {
          // 使用 setDayStatus 直接写入
          var wk = getWeekKey(cursor);
          var di = getDayOfWeek(cursor);
          if (!checks[wk]) checks[wk] = {};
          if (!checks[wk][hid]) checks[wk][hid] = ['○','○','○','○','○','○','○'];
          checks[wk][hid][di] = '✓';
        }
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    saveData();
    recomputeStreaks();
    updateHeader();
    showToast('✅ 已补充 ' + dayCount + ' 天 × ' + selectedIds.length + ' 项打卡，积分已重算');
  });
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
    btn.addEventListener('click', async function() {
      const idx = parseInt(this.dataset.idx);
      const items = rewardItems.filter(r => r.kind === 'consumable');
      const item = items[idx]; if (!item) return;
      const qty = parseInt(conGrid.querySelector('.shop-qty-input[data-idx="' + idx + '"]')?.value) || 1;
      const total = item.cost * qty;
      if (total <= 0 || total > getCoinBalance(childId)) { showToast(total <= 0 ? '请输入数量' : '😅 金币不够哦'); return; }
      // 兑换前确认，防止误操作
      const ok = await showConfirm('兑换「' + item.title + '」x' + qty + '，扣除 ' + total + ' 金币？', false);
      if (!ok) return;
      transactions.push({ id: genId(), memberId: childId, type: 'spend_coin', amount: total, reason: item.title + ' x' + qty, createdAt: fmtDateFull(new Date()), time: fmtDateTime(new Date()) });
      logOp(getMemberName(childId), '兑换', item.title + ' x' + qty + ' (-' + total + ' Coin)');
      saveData(); showToast('🎉 兑换成功！'); renderShopView(); updateHeader();
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

  // 兑换记录（含退回记录）
  const recordsContainer = document.getElementById('shopRecords');
  if (recordsContainer) {
    const records = transactions.filter(t => t.memberId === childId && (t.type === 'spend_coin' || t.type === 'refund_coin'))
      .sort((a, b) => String(b.time || b.createdAt || '').localeCompare(String(a.time || a.createdAt || '')));
    if (records.length === 0) {
      recordsContainer.innerHTML = '<div style="margin-top:16px;"><div style="font-size:13px;font-weight:700;margin-bottom:8px;">📜 兑换记录</div><div style="font-size:12px;color:var(--ink-soft);padding:8px 0;">还没有兑换记录</div></div>';
    } else {
      let html = '<div style="margin-top:16px;"><div style="font-size:13px;font-weight:700;margin-bottom:8px;">📜 兑换记录（' + records.length + '）</div>'
        + '<div style="max-height:300px;overflow-y:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--paper-deep);border-radius:10px;background:var(--card);">';
      records.forEach(t => {
        const time = t.time || (t.createdAt || '');
        if (t.type === 'refund_coin') {
          // 退回记录
          html += '<div style="padding:9px 12px;border-bottom:1px solid var(--paper-deep);">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;">'
            + '<span style="color:var(--ink-soft);white-space:nowrap;">' + time + '</span>'
            + '<span style="font-weight:700;color:var(--teal);white-space:nowrap;">+' + (t.amount || 0) + '</span>'
            + '</div>'
            + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px;font-size:13px;">'
            + '<span style="flex:1;min-width:0;word-break:break-all;">' + (t.reason || '') + (t.note ? '（' + t.note + '）' : '') + '</span>'
            + '<span style="color:var(--teal);font-size:11px;white-space:nowrap;">↩️ 退回</span>'
            + '</div>'
            + '</div>';
        } else {
          // 兑换记录
          var refundedAmt = t.refundedAmount || 0;
          var fullyRefunded = refundedAmt >= t.amount;
          var txTime = t.time ? new Date(t.time) : null;
          var refundExpired = txTime && (new Date() - txTime > 3600000);
          var canRefund = !fullyRefunded && !refundExpired;
          html += '<div style="padding:9px 12px;border-bottom:1px solid var(--paper-deep);' + (fullyRefunded ? 'opacity:.6;' : '') + '">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;">'
            + '<span style="color:var(--ink-soft);white-space:nowrap;">' + time + '</span>'
            + '<span style="font-weight:700;color:var(--coral);white-space:nowrap;">-' + (t.amount || 0) + '</span>'
            + '</div>'
            + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px;font-size:13px;">'
            + '<span style="flex:1;min-width:0;word-break:break-all;">' + (t.reason || '') + (refundedAmt > 0 ? '（已退：' + refundedAmt + '/' + t.amount + ' 🪙）' : '') + '</span>'
            + (fullyRefunded
                ? '<span style="color:var(--teal);font-size:11px;white-space:nowrap;">↩️ 已全退</span>'
                : refundedAmt > 0
                  ? '<button class="shop-refund-btn" data-tid="' + t.id + '" style="border:none;border-radius:6px;background:var(--paper-deep);color:var(--ink);padding:3px 8px;font-size:11px;cursor:pointer;white-space:nowrap;">退剩余(' + (t.amount - refundedAmt) + '🪙)</button>'
                  : (canRefund
                      ? '<button class="shop-refund-btn" data-tid="' + t.id + '" style="border:none;border-radius:6px;background:var(--paper-deep);color:var(--ink);padding:3px 8px;font-size:11px;cursor:pointer;white-space:nowrap;">退回</button>'
                      : (refundExpired ? '<span style="color:var(--ink-soft);font-size:11px;white-space:nowrap;">已超时</span>' : '')))
            + '</div>'
            + '</div>';
        }
      });
      html += '</div></div>';
      recordsContainer.innerHTML = html;
      // 绑定退回按钮
      recordsContainer.querySelectorAll('.shop-refund-btn').forEach(b => {
        b.addEventListener('click', function() {
          const t = transactions.find(x => x.id === this.dataset.tid);
          if (t) refundExchange(t);
        });
      });
    }
  }

}

// 退回弹窗（含金额输入 + 理由；返回 {amount, note}；取消返回 null）
function askRefundReason(t) {
  var maxRefund = t.amount - (t.refundedAmount || 0);
  return new Promise(function(resolve) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.innerHTML = '<div class="modal-card" style="max-width:320px;padding:20px;text-align:left;">'
      + '<div style="font-size:16px;font-weight:700;margin-bottom:4px;">↩️ 退回金币</div>'
      + '<div style="font-size:12px;color:var(--ink-soft);margin-bottom:10px;">退回「' + (t.reason || '') + '」（总额 ' + (t.amount || 0) + ' 🪙，已退 ' + (t.refundedAmount || 0) + ' 🪙，剩余可退 ' + maxRefund + ' 🪙）</div>'
      + '<div style="margin-bottom:10px;display:flex;gap:6px;align-items:center;">'
      + '<span style="font-size:13px;white-space:nowrap;">退回数量</span>'
      + '<input id="refundAmountInput" type="number" value="' + maxRefund + '" min="1" max="' + maxRefund + '" style="flex:1;width:60px;padding:8px;border:2px solid var(--paper-deep);border-radius:8px;font-size:14px;text-align:center;">'
      + '<span style="font-size:13px;white-space:nowrap;">🪙</span></div>'
      + '<textarea id="refundReasonInput" rows="2" placeholder="例如：误操作、奖励未享受" style="width:100%;padding:8px;border:2px solid var(--paper-deep);border-radius:8px;font-size:14px;resize:vertical;box-sizing:border-box;"></textarea>'
      + '<div style="display:flex;gap:8px;margin-top:12px;">'
      + '<button id="refundCancel" style="flex:1;padding:10px;border:2px solid var(--paper-deep);border-radius:10px;background:none;font-size:14px;cursor:pointer;">取消</button>'
      + '<button id="refundOk" style="flex:1;padding:10px;border:none;border-radius:10px;background:var(--amber);color:var(--ink);font-size:14px;font-weight:700;cursor:pointer;">确定退回</button>'
      + '</div></div>';
    document.body.appendChild(overlay);
    function close(r) { overlay.remove(); resolve(r); }
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(null); });
    document.getElementById('refundCancel').onclick = function() { close(null); };
    document.getElementById('refundOk').onclick = function() {
      var amount = parseInt(document.getElementById('refundAmountInput').value) || 0;
      var note = document.getElementById('refundReasonInput').value.trim();
      if (!note) { showToast('请填写退回理由'); return; }
      if (amount < 1 || amount > maxRefund) { showToast('退回数量需在 1~' + maxRefund + ' 之间'); return; }
      close({ amount: amount, note: note });
    };
  });
}

// 家长退回兑换（支持部分退款 + 1 小时时效；需 PIN + 填写理由）
async function refundExchange(t) {
  if (!t || t.type !== 'spend_coin') return;
  var refunded = t.refundedAmount || 0;
  if (refunded >= t.amount) return; // 已全退
  // 1 小时时效检查
  var txTime = t.time ? new Date(t.time) : null;
  if (txTime && (new Date() - txTime > 3600000)) {
    showToast('⏰ 已超过 1 小时退款时效，无法退回');
    return;
  }
  // 家长 PIN 验证（未设置 PIN 则直接允许）
  if (parentPin) {
    var p = await showPinModal({
      title: '🔐 家长验证',
      validate: function(v) { return v === parentPin ? null : '❌ PIN 不正确'; }
    });
    if (!p) return;
  }
  // 填写退回金额和理由
  var result = await askRefundReason(t);
  if (result === null) return; // 取消
  var partialAmount = result.amount;
  var note = result.note;
  if (!await showConfirm('退回「' + (t.reason || '') + '」的 ' + partialAmount + ' / ' + t.amount + ' 金币？' + (note ? '（' + note + '）' : ''), true)) return;
  t.refundedAmount = (t.refundedAmount || 0) + partialAmount;
  t.refundNote = (t.refundNote ? t.refundNote + '; ' : '') + note;
  var reasonText = '退回：' + (t.reason || '') + (partialAmount < t.amount ? '（部分 ' + partialAmount + '/' + t.amount + '）' : '');
  transactions.push({ id: genId(), memberId: t.memberId, type: 'refund_coin', amount: partialAmount, reason: reasonText, note: note, createdAt: fmtDateFull(new Date()), time: fmtDateTime(new Date()) });
  logOp(getMemberName(t.memberId), '退回', (t.reason || '') + ' (+' + partialAmount + '/' + t.amount + ' Coin)' + '（' + note + '）');
  saveData();
  showToast('↩️ 已退回 ' + partialAmount + ' 金币' + (t.refundedAmount >= t.amount ? '（已全额退回）' : '（剩余可退 ' + (t.amount - t.refundedAmount) + ' 🪙）'));
  renderShopView(); updateHeader();
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

