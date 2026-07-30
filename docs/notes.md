# 好习惯积分表 — 开发笔记

> ⚠️ **历史参考，已过时。** 本文档描述的是 V3 架构（`habitTableV3` localStorage key、BrewPage 存储、GitHub Gist 同步等），当前已迁移至 `habitRatV4` + Upstash Redis + Vercel。保留此文件仅用于记录架构演变过程。当前权威设计文档请查阅：[HabitRat_产品设计指南.md](./HabitRat_产品设计指南.md)。

> 项目目录：`habit-tracker/`（独立子项目，可单独部署到 Vercel）
> 主应用：`index.html`（纯前端单页应用）
> 跨设备同步：`api/habit-sync.js` → Upstash Redis（Vercel 集成）

---

## 目录

- [架构概览](#架构概览)
- [同步机制](#同步机制)
- [数据格式](#数据格式)
- [配置指南](#配置指南)
- [常见问题](#常见问题)
- [修改记录](#修改记录)

---

## 架构概览

```
┌─────────────────────┐     POST /api/habit-sync     ┌──────────────┐    PUT     ┌──────────┐
│  浏览器 (电脑/手机)   │ ────────────────────────────→ │ Vercel API   │ ─────────→ │ BrewPage │
│  habit-tracker.html  │                              │ habit-sync   │            │ 存储     │
│                      │ ←──────────────────────────── │              │ ←───────── │          │
│  localStorage 本地缓存│     GET /api/habit-sync       └──────────────┘    GET     └──────────┘
└─────────────────────┘      页面加载/刷新时拉取
```

- **纯前端单页应用**，无框架依赖，不参与 Vite/React 构建
- 所有操作先写入 **localStorage**（`habitTableV3` 键），离线可用
- 后台 3 秒防抖后自动同步到**服务端**（BrewPage）
- 其他设备刷新页面时自动拉取最新数据

---

## 同步机制

### 写入流程（任何数据变更）

```
用户操作（打钩、取消、积分、投票、兑换……）
    │
    ▼
cycleStatus() / addTransaction() / saveVoteResult() 等
    │
    ▼
saveData()
    ├── localStorage.setItem('habitTableV3', ...)
    └── debounceSyncToServer()      ← 3 秒防抖
            │
            ▼
        syncToServer()
            ├── getSyncData()       ← 组装全部数据 + _updatedAt
            ├── POST /api/habit-sync
            │       └── api/habit-sync.js
            │               ├── 添加 _serverUpdatedAt（服务端时间戳）
            │               └── PUT → BrewPage
            └── localStorage.setItem('habitTableV3_lastUpdate', serverUpdatedAt)
```

### 读取流程（页面加载/刷新）

```
页面加载
    │
    ▼
initSync()
    │
    ▼
loadFromServer()
    ├── GET /api/habit-sync?_t=时间戳    ← 缓存破坏
    ├── 解析 _serverUpdatedAt（服务端时间戳）
    ├── 与本地 habitTableV3_lastUpdate 比较
    │   └── 服务端更新 → eval() 覆盖内存变量 → 写入 localStorage
    └── 无更新 → 跳过
```

### 关键要点

| 规则 | 说明 |
|------|------|
| **时间比较基准** | 用 `_serverUpdatedAt`（服务端写入时生成），不用设备本地时间，避免各设备时钟差异 |
| **加载后不回传** | `initSync()` 中调用 `saveData(true)` 跳过自动回传，防止加载后重新上传引发竞争 |
| **缓存破坏** | GET 请求加 `?_t=时间戳` + `Cache-Control: no-cache`，避免 BrewPage CDN 边缘缓存 |
| **防抖** | 每次变更后 3 秒才推送，批量操作（连续打钩）最后只推送一次 |
| **幂等写入** | 整量替换（非增量），每次都上传完整数据 |
| **同步状态指示** | 顶栏显示 ✅/⚠️/🔄，仅在 `syncToServer()` 调用时更新 |

---

## 数据格式

### localStorage 结构

```jsonc
// 键: habitTableV3
{
  "checks": { /* 周/习惯/日 勾选状态 */ },
  "streakState": { /* 连续计数 */ },
  "effectiveLog": { /* 生效积分记录 */ },
  "transactions": [ /* 积分流水 */ ],
  "dateConfig": { "vacationRanges": [...] },
  "voteRecords": [ /* 豁免投票记录 */ ],
  "exchangeItems": [ /* 兑换项目 */ ]
}

// 键: habitTableV3_lastUpdate
// 值: 服务端时间戳字符串（ISO 8601）
```

### 同步到 BrewPage 的数据（`getSyncData()`）

```jsonc
{
  "checks":           { /* 同上 */ },
  "streakState":      { /* 同上 */ },
  "effectiveLog":     { /* 同上 */ },
  "transactions":     [ /* 同上 */ ],
  "dateConfig":       { /* 同上 */ },
  "voteRecords":      [ /* 同上 */ ],
  "exchangeItems":    [ /* 同上 */ ],
  "_version":         1,
  "_updatedAt":       "2026-07-25T10:00:00.000Z",  // 客户端时间（仅供参考）
  "_serverUpdatedAt": "2026-07-25T10:00:01.000Z"   // 服务端写入时生成（比较基准）
}
```

### checks 数据结构

```javascript
checks = {
  "2026-W30": {                // 周维度（ISO 周）
    "mom_bf": ["○","✓","✓","○","✗","○","○"],  // 7 天对应位置
    "xm_brush": ["✓","✓","✓","✓","✗","—","—"],
    // ...
  },
  "2026-W31": { /* ... */ },
}
```

---

## 配置指南

### 习惯配置（`HABITS` 数组，约第 803 行）

```javascript
{ id:'mom_bf', personKey:'mom', emoji:'🥣', name:'吃早饭', pts:10, streakNeed:3,
  rule:'8:30前吃完早饭', ruleVacation:'9:00前吃完早饭', applicable:'all' },
```

| 字段 | 说明 | 可选值 |
|------|------|--------|
| `id` | 唯一 ID | 习惯名缩写 |
| `personKey` | 人物 | `mom` 或 `xiaomei` |
| `emoji` | 显示图标 | 任意 emoji |
| `name` | 名称 | 中文 |
| `pts` | 单次分值 | 正整数 |
| `streakNeed` | 连续达标次数 | 正整数 |
| `rule` | 工作日细则 | 字符串 |
| `ruleVacation` | 假期细则 | 字符串（可选） |
| `applicable` | 适用日 | `all`=每天 / `noschool`=非工作日 |

**`noschool` 行为**：`mode !== 'workday'`，即节假日和寒暑假才显示，工作日不显示。

### 人物标签映射（`PERSON_LABEL`，约第 824 行）

```javascript
const PERSON_LABEL = { mom:'👩妈妈', xiaomei:'👧小美' };
```

移动端周视图卡片和日视图行中会自动显示在人名旁边。

### 法定节假日（`HOLIDAYS_2026`，约第 827 行）

每年更新，格式为 `"YYYY-MM-DD": 1`。包含：
- 元旦、春节、清明、劳动节、端午、中秋、国庆

### 调休工作日（`MAKEUP_2026`，约第 846 行）

法定假日前后的补班日期。

### 寒暑假（日期配置，界面可配置）

默认值：
- 暑假：`2026-07-01` ~ `2026-08-31`
- 寒假：`2027-01-18` ~ `2027-02-28`

用户在设置面板中可增删改。

---

## 服务端 API

### `api/habit-sync.js`

| 方法 | 行为 |
|------|------|
| `GET` | 从 BrewPage 读取数据，返回 `body.content` |
| `POST` | 接收同步数据，添加 `_serverUpdatedAt`，写入 BrewPage |
| `OPTIONS` | CORS 预检 |

**BrewPage 凭证**（硬编码在文件中）：
- ID: `6eDqDTFDmO`
- Token: `B6xSK5btOrBwV4G78jyGLdcZDaC9ZC8b`

> 注意：数据公开可见（BrewPage public namespace），习惯打卡数据非敏感信息。每次写入自动续期 15 天。

---

## 常见问题

### Q: 双向不同步，只有一边能同步？

**原因**：设备时钟差异导致 `_updatedAt` 比较失效。手机时钟慢了几秒 → 手机上传的数据时间戳更"旧" → 另一端认为无更新。

**修复**：改用服务端写入时生成的 `_serverUpdatedAt` 做比较基准，与设备本地时间无关。

### Q: 打开页面仍然显示旧数据？

可能原因：
1. **CDN 缓存**：BrewPage 边缘节点未刷新 → 加 `?_t=时间戳` 破坏缓存
2. **浏览器缓存**：`Ctrl+Shift+R` 强制刷新
3. **Vercel 未部署完**：`git push` 后等 1-3 分钟

### Q: 如何添加新习惯？

编辑 `HABITS` 数组，添加一个对象。注意 `id` 要唯一，`personKey` 匹配 `mom` 或 `xiaomei`。

### Q: 同步失败怎么办？

打开浏览器控制台（F12 → Console），查看是否有 `Server sync fail` 或 `Server load fail` 错误信息。检查 BrewPage 是否可访问。

---

## 修改记录

| 日期 | 改动 |
|------|------|
| 2026-07-24 | 初始创建，用 GitHub Gist 跨设备同步 |
| 2026-07-24 | 修复 `isDesktop()` 重复定义、章节编号合理化 |
| 2026-07-24 | `noschool` 适用性改为节假日+寒暑假 |
| 2026-07-24 | 移动端周视图/日视图添加人物标签（👩妈妈/👧小美） |
| 2026-07-24 | 废弃 Gist 同步，改用 Vercel API + GitHub Repo 存储 |
| 2026-07-25 | 改用 BrewPage 免费 JSON 存储，彻底摆脱 GITHUB_TOKEN |
| 2026-07-25 | 改用服务端时间戳 `_serverUpdatedAt` 做比较基准 |
| 2026-07-25 | 添加缓存破坏参数、`saveData(true)` 避免加载后自动回传 |
| 2026-07-25 | 周视图每列添加日期数字 |
