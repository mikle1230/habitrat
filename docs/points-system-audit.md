# HabitRat 积分系统全面审计报告

> 生成日期：2026-08-08 | 基于 app.js 当前代码

---

## 1. 系统架构总览

```
用户操作（打卡/兑换/加分/编辑/补打卡）
    │
    ▼
┌──────────────────────────────────────────────┐
│              recomputeStreaks()               │
│  Phase 1: 孤儿检测 → 删除无效交易              │
│  Phase 2: 遍历历史 → 补发缺失交易              │
│  Phase 3: 重算 totalExp → 检测升级            │
│  → saveData() 持久化                          │
└──────────────────────────────────────────────┘
    │
    ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│ 状态栏    │  │ 分析页    │  │ 记录页    │
│ coin/exp │  │ 统计图表  │  │ 交易明细  │
└──────────┘  └──────────┘  └──────────┘
```

---

## 2. 数据结构

### 2.1 核心存储

```
localStorage['habitrat:v4'] → {
  habitTemplates[]   — 习惯定义（id, title, emoji, expValue, coinValue, streakNeed,
                        applicable, ruleText, ruleVacation, archived, ruleChangedAt）
  transactions[]     — 所有金币/经验流水（id, habitId?, memberId, type, amount,
                        reason, createdAt, time?, snapshot?, refundedAmount?, note?）
  members[]          — 家庭成员（id, name, role, totalExp）
  checks{}           — 打卡状态 checks[weekKey][habitId] = ['○','✓','✗',...] (7天数组)
  weekKey            — ISO 周编号 "YYYY-WNN"
  rewardItems[]      — 兑换/收藏物品
  customEvents[]     — 自定义事件（按日期存储状态）
  dateConfig         — 假期配置
  parentPin          — 家长 PIN
  securityQuestion   — 密保问题
}
```

### 2.2 交易类型（10 种）

| type | 触发者 | amount 含义 | reason 格式 | 有 habitId | 有 snapshot |
|------|--------|------------|-------------|-----------|-------------|
| `earn_exp` | 每日打卡 ✓ | 单次经验值 | `[单次] {title}` | ✅ | ✅ |
| `earn_coin` | 连续达标 | coinValue × streakNeed | `{title} 连续达标` | ✅ | ✅ |
| `spend_coin` | 商店兑换 | item.cost × qty | `{title} x{qty}` | ❌ | ❌ |
| `refund_coin` | 退回兑换 | 退回金额 | `退回：{reason}` | ❌ | ❌ |
| `deduct_coin` | 家长扣分 | 扣分数 | 手动填写 | ❌ | ❌ |
| `bonus_coin` | 家长加分 | 加分值 | 手动填写 | ❌ | ❌ |
| `bonus_exp` | 家长加 EXP | 经验值 | `{note} (额外EXP)` | ❌ | ❌ |
| `earn_exp` [C] | 自定义事件 ✓ | expValue | `[自定义] {title}` | ❌ | ❌ |
| `earn_coin` [C] | 自定义事件 ✓ | coinValue | `[自定义] {title}` | ❌ | ❌ |

> [C] = 自定义事件的 reason 前缀为 `[自定义] `，区别于习惯的 `[单次] `，孤儿过滤器自动放行。

---

## 3. recomputeStreaks() 引擎（app.js:960-1182）

### 3.0 预处理

1. `migrateTxHabitIds()` — 为历史交易补填 habitId（idempotent，按 reason 匹配当前习惯 title）
2. 构建 `allHabitsById` 索引（含归档习惯）
3. 遍历所有 transactions，构建 `earnedExpSet` / `earnedCoinSet`（key: `date|habitId`）
   - 对无 habitId 的遗留交易，按 title 匹配后补填

### 3.1 Phase 1 — 孤儿检测

**目的**：找出打卡状态已变为 ✗/○ 但交易仍在的条目。

```
扫描起点: findEarliestDataDate()（动态，覆盖全部数据）
扫描终点: today

对每天 × 每个习惯（含归档）:
  - 如果 getDayStatus === '✓':
    → validExpKeys[date|habitId] = true
    → 累计连续计数，达到 streakNeed 时 validCoinKeys[date|habitId] = true
  - 如果状态为 ✗ 或过去的 ○:
    → 重置连续计数
```

**孤儿过滤规则**（逐个交易检查）：

| 交易类型 | 条件 | 行为 |
|---------|------|------|
| `earn_exp` + habitId | 习惯已归档/删除 | 保留 |
| `earn_exp` + habitId | 习惯活跃 + key 在 validExpKeys 中 | 保留 |
| `earn_exp` + habitId | 习惯活跃 + key 不在 validExpKeys 中 | **删除** |
| `earn_coin` + habitId | 习惯已归档/删除 | 保留 |
| `earn_coin` + habitId | 习惯活跃 | 调用 `verifyCoinStreak()` 验证 |
| 遗留 earn_exp `[单次]` | title 匹配到习惯 | 按 validExpKeys 判断 |
| 遗留 earn_coin `连续达标` | title 匹配到习惯 | 调用 `verifyCoinStreak()` 验证 |
| 其他所有交易 | — | **保留**（自定义事件、加减分、兑换等） |

### 3.2 verifyCoinStreak() — Bug D 修复

不依赖 Phase 1 计算的 `validCoinKeys`（因当前 streakNeed 可能已变），而是**直接验证底层 ✓ 连续天数**：

```
输入: 交易 t, 习惯 habit
1. 取 streakNeed = t.snapshot.streakNeed || habit.streakNeed || 5
2. 从 t.createdAt 向后扫描，最多 120 天:
   - 跳过非 applicable 日（假期/周末不打断连续）
   - ✓ → cons++
   - ✗/○ → 中断
3. cons >= streakNeed → 保留交易，否则删除
```

**与 Phase 1 原始算法的差异**：
- Phase 1 用 **当前** streakNeed 判断哪些日期"应该"触发 coin
- verifyCoinStreak 用 **交易时的** snapshot.streakNeed 验证"实际 ✓ 连续是否存在"
- 这保证了：修改 streakNeed 不会删除已有的 earn_coin（Bug D 修复）

### 3.3 Phase 2 — 补发缺失交易

**预计算 `oldRules[h.id]`**：
- 对每个有 `ruleChangedAt` 的习惯，找 ruleChangedAt 之前最近一笔交易的 snapshot
- 提取旧规则 { streakNeed, expValue, coinValue }

**逐日扫描**（使用 `findEarliestDataDate()` 起点）：

```
对每天 × 每个活跃习惯:
  1. 判断该日期应使用哪套规则:
     如果 h.ruleChangedAt 存在且 ds < h.ruleChangedAt 且有 oldRules:
       → 使用旧规则 (effStreakNeed, effExpValue, effCoinValue)
     否则:
       → 使用当前规则

  2. 如果 status === '✓' 且 earnedExpSet 中没有:
       → 创建 earn_exp (amount=effExpValue, snapshot=当前有效规则)

  3. 累计连续天数

  4. 如果连续天数 >= effStreakNeed 且 earnedCoinSet 中没有:
       → 创建 earn_coin (amount=effCoinValue × effStreakNeed, snapshot=当前有效规则)
```

### 3.4 Phase 3 — 重算 EXP

```
遍历所有 child 成员:
  totalExp = SUM(earn_exp + bonus_exp 交易的 amount)
  
检测升级 → checkLevelUps()
```

### 3.5 持久化

`saveData()` 在 recomputeStreaks 末尾调用（Bug F 修复）。

---

## 4. 余额公式

### 4.1 Coin 余额（app.js:258-262）

```
coinBalance = SUM(earn_coin + bonus_coin + refund_coin)
            - SUM(spend_coin + deduct_coin)

所有视图（状态栏、分析页、记录页）统一使用此公式。
```

### 4.2 EXP / 等级（app.js:263-270）

```
totalExp = SUM(earn_exp + bonus_exp)
level    = floor(sqrt(totalExp / 50))
title    = LEVEL_TITLES[level]
```

---

## 5. 交易创建点（全部调用位置）

| 位置 | 触发操作 | 创建的交易 |
|------|---------|-----------|
| Phase 2 recompute | ✓ 打卡（无对应交易时） | `earn_exp` |
| Phase 2 recompute | 连续达标（无对应交易时） | `earn_coin` |
| 商店 `renderShopView` | 点击兑换 | `spend_coin` |
| `refundExchange()` | 家长退回兑换 | `refund_coin` |
| 家长操作 `showQuickActions` | 扣分 | `deduct_coin` |
| 家长操作 `showQuickActions` | 加分 | `bonus_coin` + `bonus_exp`（可选）|
| 自定义事件 toggle | ✓ 自定义事件 | `earn_exp` + `earn_coin`（reason: `[自定义]`）|
| 迁移 `migrateData` | 旧数据迁移 | `earn_exp` + `earn_coin`（reason: `{name} 连续达标`）|

---

## 6. 交易删除点

| 位置 | 触发条件 | 删除方式 |
|------|---------|---------|
| Phase 1 孤儿过滤 | 活跃习惯 + 打卡状态变为 ✗/○ | filter 过滤 |
| 自定义事件 toggle off | 用户取消 ✓ 自定义事件 | `filter(reason + createdAt 匹配)` |
| 自定义事件删除 | 删除整个自定义事件 | `filter(reason + createdAt 匹配)` |

---

## 7. 保护机制总结

### 7.1 数据完整性保护

| 机制 | 保护什么 | 实现位置 |
|------|---------|---------|
| `earnedExpSet` / `earnedCoinSet` | 同一 date+habitId 不重复创建交易 | Phase 2 创建前检查 |
| habitId 作为 dedup key | 习惯改名不丢失历史积分 | earnedSet key = `date\|habitId` |
| 归档习惯交易保留 | 归档不删历史 | 孤儿过滤: `!activeHabitIds → return true` |
| `verifyCoinStreak()` | 修改 streakNeed 不删除已有 earn_coin | Phase 1 孤儿过滤 |
| `ruleChangedAt` + `oldRules` | 修改规则不补发历史 earn_coin | Phase 2 有效规则选择 |
| 交易 `snapshot` 字段 | 记录发放时的规则，可追溯 | Phase 2 创建交易时写入 |
| 动态扫描窗口 | 不限制 365 天，覆盖全部历史数据 | `findEarliestDataDate()` |
| recompute 后 saveData | 重算结果不丢失 | Phase 3 末尾 |

### 7.2 业务规则保护

| 机制 | 限制 |
|------|------|
| 退款时效 | 兑换后 1 小时内可退 |
| 部分退款 | 同一条兑换可多次部分退，refundedAmount 追踪 |
| 退款需理由 | `askRefundReason()` 必填理由 |
| 退款 PIN 保护 | 有 PIN 时需验证 |
| 补打卡范围 | 最多 45 天内 |
| 编辑警告 | 编辑有记录的习惯时显示黄色警告 |
| 非 applicable 日跳过 | 连续计算跳过假期/周末，不打断也不累加 |

---

## 8. 已知问题 / 残余风险

### 8.1 迁移数据没有 habitId 和 snapshot（低风险）

**影响**：从 v3 迁移的 transactions 没有 `habitId` 和 `snapshot`：
- `migrateTxHabitIds()` 按 reason 匹配补填 habitId（idempotent），但依赖 title 匹配
- 如果迁移后习惯改了名，这些交易永久没有 habitId
- 没有 snapshot 意味着 Bug D 保护和 Phase 2 旧规则回退都依赖当前值做 fallback

**风险等级**：🟢 低 — 迁移是一次性操作，且改名后 habitId 匹配会失败，但 orphan filter 会保留无 habitId 的交易

### 8.2 迁移 earn_exp 的 reason 格式不一致（低风险）

**问题**：迁移代码（line 421-422）将 earn_exp 的 reason 设为 `{name} 连续达标` 而非 `[单次] {name}`。这导致：
- 这些 earn_exp 不会被 `earnedExpSet` 识别
- 首次 recomputeStreaks 会为相同日期创建新的 `[单次] ` earn_exp
- 用户会获得双倍 EXP（迁移交易 + 新创建的交易）

**风险等级**：🟡 中 — 但只影响首次 recomputeStreaks 后的数据。后续 recompute 中，新交易有了 habitId，旧交易无 habitId 但保留。已迁移用户的 totalExp 可能略高。

### 8.3 自定义事件不经过 recomputeStreaks 治理（低风险）

**问题**：
- 自定义事件 toggle 直接 push/filter 交易，不走 recomputeStreaks
- 没有 habitId，没有 snapshot
- 删除靠 reason + createdAt 匹配（存在同名事件互相干扰的微小风险）
- 自定义事件改名后，旧交易用旧名，无法被删除

**风险等级**：🟢 低 — reason 格式 `[自定义] ` 与习惯交易格式不冲突，孤儿过滤器放行

### 8.4 在线同步未验证（未知风险）

**问题**：本文档仅分析本地 localStorage 逻辑。V4 云同步（`/api/habit-sync`）的上传/下载/合并逻辑未纳入审查。

**风险等级**：🟡 待评估

---

## 9. 调用链路图

### 打卡操作

```
用户点击 quest-card
  → cycleStatus(habit, date)
    → setDayStatus(habit, date, '✓')
    → recomputeStreaks()
      → Phase 1: 检测并删除无效交易
      → Phase 2: 补发缺失的 earn_exp / earn_coin
      → Phase 3: 重算 totalExp → checkLevelUps()
      → saveData()
    → renderHomeView()
    → updateHeader()
```

### 兑换操作

```
用户点击兑换
  → renderShopView() 中的点击事件
    → 确认弹窗
    → transactions.push(spend_coin)
    → saveData()
    → updateHeader()
```

### 退款操作

```
家长点击退回按钮
  → refundExchange(t)
    → 1 小时时效检查
    → PIN 验证（如有）
    → askRefundReason(t)
      → 显示金额输入框（默认=剩余可退）
    → t.refundedAmount += partialAmount
    → transactions.push(refund_coin)
    → saveData()
    → updateHeader()
```

### 补打卡操作

```
设置页 → 📅 补充历史打卡
  → 选择日期范围 + 多选习惯
  → 确认弹窗
  → 逐日逐习惯: checks[wk][hid][di] = '✓'
  → saveData()
  → recomputeStreaks()
  → updateHeader()
```

### 编辑习惯规则

```
设置页 → ✎ 编辑习惯
  → showHabitEditForm(h)
    → 统计已有 checkDays / streakRewards
    → 显示警告（如有历史记录）
    → 保存前记录旧规则值
    → 保存时比较: 有变更 + 有历史 → h.ruleChangedAt = today
    → saveData()
```

---

## 10. 关键函数索引

| 函数 | 行号 | 职责 |
|------|------|------|
| `findEarliestDataDate()` | 925 | 从 checks + transactions 找最早数据日期 |
| `migrateTxHabitIds()` | 954 | 按 reason 匹配为遗留交易补填 habitId |
| `verifyCoinStreak()` | 1043 | 验证 earn_coin 的底层 ✓ 连续是否存在 |
| `recomputeStreaks()` | 960 | 核心引擎：三阶段重算 + 持久化 |
| `getCoinBalance()` | 258 | Coin 余额公式 |
| `getMemberExp()` | 263 | EXP 公式 |
| `getMemberLevel()` | 265 | 等级公式 |
| `cycleStatus()` | 377 | 打卡状态 ○→✓→✗→○ |
| `setDayStatus()` | 370 | 写入 checks 数据 |
| `getDayStatus()` | 364 | 读取打卡状态（'na' / '✓' / '✗' / '○'）|
| `isDayApplicable()` | 351 | 判断某日习惯是否适用 |
| `refundExchange()` | 4063 | 退回兑换（部分退款 + 1h 时效） |
| `showHabitEditForm()` | 759 | 编辑习惯（含 ruleChangedAt 追踪）|
| `setupBackfillSection()` | 3411 | 补打卡 UI 设置 |
| `updatePeriodSummary()` | 1194 | 今日/周/月统计更新 |
| `updateStatusBar()` | 3180 | 顶部状态栏更新 |
| `showCoinSources()` | 3220 | 分析页金币来源详情 |
