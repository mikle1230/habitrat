// ========== Init ==========
async function initSync() {
  const updated = await loadFromServer();
  if (updated) { saveData(true); recomputeStreaks(); refreshCurrentView(); }
  startSyncPolling();
}

function init() {
  loadData();
  recomputeStreaks();
  // ---- 首次使用引导 ----
  (function initOnboarding() {
    var HAS_ONBOARDED = localStorage.getItem('habitrat:onboarded') === 'true'
    if (HAS_ONBOARDED) return
    var overlay = document.getElementById('onboardOverlay')
    if (!overlay) return
    overlay.style.display = 'flex'
    // Skip button for returning users
    var skipBtn = document.getElementById('onboardSkip')
    if (skipBtn) {
      skipBtn.addEventListener('click', function() {
        var childName = document.getElementById('onboardChildName').value.trim()
        if (childName) {
          var child = members.find(function(m) { return m.role === 'child' })
          if (child) child.name = childName
          localStorage.setItem('habitrat:childName', childName)
        }
        localStorage.setItem('habitrat:onboarded', 'true')
        saveData(true)
        overlay.style.display = 'none'
        renderHomeView()
        updateStatusBar()
      })
    }
    // Step 0 → Step 1
    var nextBtn = overlay.querySelector('[data-onboard-next]')
    if (nextBtn) {
      nextBtn.addEventListener('click', function() {
        overlay.querySelectorAll('.onboard-step').forEach(function(s) { s.classList.remove('active') })
        var step1 = overlay.querySelector('[data-step="1"]')
        if (step1) step1.classList.add('active')
      })
    }
    // Finish
    var finishBtn = document.getElementById('onboardFinish')
    if (finishBtn) {
      finishBtn.addEventListener('click', function() {
        var childName = document.getElementById('onboardChildName').value.trim()
        if (!childName) {
          var input = document.getElementById('onboardChildName')
          input.style.borderColor = 'var(--coral)'
          input.placeholder = '请输入宝贝的名字'
          input.focus()
          return
        }
        // 保存 child name
        localStorage.setItem('habitrat:childName', childName)
        // 更新 child member
        var child = members.find(function(m) { return m.role === 'child' })
        if (child) child.name = childName
        // 更新 guardian member（可选）
        var parentName = document.getElementById('onboardParentName').value.trim()
        if (parentName) {
          var guardian = members.find(function(m) { return m.role === 'guardian' })
          if (guardian) guardian.name = parentName
        }
        // 标记已引导
        localStorage.setItem('habitrat:onboarded', 'true')
        saveData(true)
        // 隐藏引导，刷新 UI
        overlay.style.display = 'none'
        renderHomeView()
        updateStatusBar()
      })
    }
    // Enter 键提交
    var childInput = document.getElementById('onboardChildName')
    if (childInput) {
      childInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && finishBtn) finishBtn.click()
      })
    }
  })()
  // 头像长按恢复默认
  // bindAvatarLongPress()  // 暂时关闭：头像交互功能，等新版头像设计
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
      transactions.push({ id: genId(), memberId: selectedMemberId, type: 'deduct_coin', amount: pts, reason: reason, createdAt: fmtDateFull(new Date()), time: fmtDateTime(new Date()) });
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
      transactions.push({ id: genId(), memberId: selectedMemberId, type: 'bonus_coin', amount: coinPts, reason: note, createdAt: fmtDateFull(new Date()), time: fmtDateTime(new Date()) });
      logOp(getMemberName(selectedMemberId), '加分', note+' (+'+coinPts+' Coin)');
      if (document.getElementById('psBonusExp').checked) {
        const expPts = parseInt(document.getElementById('psBonusExpVal').value) || coinPts;
        transactions.push({ id: genId(), memberId: selectedMemberId, type: 'bonus_exp', amount: expPts, reason: note + ' (额外EXP)', createdAt: fmtDateFull(new Date()), time: fmtDateTime(new Date()) });
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
  document.getElementById('statusSpentBox').addEventListener('click', showSpentHistory)
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
  if (!familyCode) { familyCode = generateFamilyCode(); localStorage.setItem('habitrat:familyCode', familyCode); family = { id: genId(), inviteCode: familyCode, createdAt: new Date().toISOString() }; saveData(true); }
  // Render initial SVG
  const childId = getChildMembers()[0]?.id || members[0]?.id;
  // 暂时关闭：Hero 区 SVG 头像，改用静态 PNG
  // if (childId) renderMascotSvg(childId, 'mascotSvg');
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
