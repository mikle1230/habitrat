# 任务：把 HabitRat 加上 PWA 支持

## 背景

HabitRat 目前是纯网页应用。这次要加一层 PWA（Progressive Web App）能力，让用户可以"添加到主屏幕"，获得接近原生 App 的体验（全屏、图标、启动画面），不改动现有业务逻辑。

**前置条件**：这个任务在双货币经济改造（上一个任务）验收通过之后再做，不要跟那个任务混在一起。

## 具体任务

### 1. Manifest 文件

新增 `manifest.json`，包含：
- `name`: "HabitRat 好习惯积分表"，`short_name`: "HabitRat"
- `icons`: 至少提供 192x192 和 512x512 两个尺寸的 PNG（先用现有的产品配色/emoji 风格做一版简单图标即可，不需要请设计师）
- `start_url`: "/"，`display`: "standalone"，`background_color` / `theme_color` 跟现在页面的主色调一致
- 在 `index.html` 的 `<head>` 里引入这个 manifest

### 2. iOS 专属处理（iOS 不完全遵循 manifest 标准，需要单独加 meta 标签）

- `<meta name="apple-mobile-web-app-capable" content="yes">`
- `<meta name="apple-mobile-web-app-status-bar-style" content="default">`
- `<link rel="apple-touch-icon" href="...">` 指向 180x180 的图标
- 注意：iOS 上"添加到主屏幕"没有系统级的安装提示 UI，需要在页面里做一个引导（比如首次访问检测到是 iOS Safari 且未安装时，展示一个简单提示条："点击分享按钮 → 添加到主屏幕"）

### 3. Service Worker（离线缓存）

- 加一个基础的 service worker，缓存静态资源（HTML/CSS/JS/图标），保证弱网/离线时打开 App 至少能看到界面（不要求离线时能打卡同步，同步功能本来就依赖网络，这个不用做离线队列那么复杂）。
- 缓存策略用"network-first, fallback to cache"即可，避免更新代码后用户长期看到旧版本缓存不刷新的问题。
- 每次部署要能让 service worker 感知到版本更新并提示用户刷新（一个简单的版本号比对+"有新版本，点击刷新"提示条就够）。

### 4. 安卓安装引导

- 监听 `beforeinstallprompt` 事件，安卓 Chrome 上可以自定义一个"安装到桌面"按钮（放在设置页或者首次访问的提示条里），点击触发系统安装弹窗。

### 5. 测试清单（改完你自己走一遍）

- 安卓 Chrome：确认能弹出安装提示，安装后图标、启动全屏体验正常
- iOS Safari：手动"添加到主屏幕"，确认全屏无浏览器地址栏、图标正常
- 断网状态下打开已安装的 PWA，确认至少能看到界面（不白屏）
- 更新代码部署后，确认已安装的用户能收到"有新版本"提示，刷新后拿到最新代码

## 明确不要做的事

- 不做离线打卡队列（断网时打卡、联网后自动补同步）——这个复杂度这次不需要，同步功能本来就要求联网。
- 不做推送通知（这个放到下一步单独做，且 iOS 推送限制较多，需要先确认用户量和场景是否值得投入）。

## 验收标准

1. 安卓和 iOS 都能"添加到主屏幕"，体验接近原生 App（无浏览器 UI）。
2. 离线打开不白屏。
3. 部署新版本后，已安装用户能被提示更新，不会卡在旧版本缓存里出不来。
