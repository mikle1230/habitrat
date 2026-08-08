---
name: cross-platform-compat
description: HabitRat 的 iOS Safari 弹窗滚动修复、emoji 兼容性选择与旧数据补丁
metadata:
  node_type: memory
  type: project
  tags: [ios-safari, emoji, compatibility, css]
  originSessionId: f71c4b5c-ef45-449a-afbf-0e47a42ad95c
---

# 跨平台兼容踩坑

## iOS Safari 弹窗滚动

- 症状：iPhone Safari 打开游戏规则弹窗，内容**不能上下滑动**。
- 根因：`html, body { height: 100%; overflow: hidden }` 全局禁 body 滚动；`.rules-modal-body { max-height: 65vh; overflow-y: auto }` 在 iOS Safari 上不可靠且缺 `-webkit-overflow-scrolling: touch`。
- **修复模式（iOS 最可靠）**：弹窗卡片改 **flex 纵向布局 + `max-height: 80vh`**；滚动区用 **`flex: 1 1 auto; min-height: 0`** 约束高度 + **`-webkit-overflow-scrolling: touch`** + **`overscroll-behavior: contain`**。

## Emoji 兼容性

- **emoji 不显示大多是编码/Unicode 版本问题**：旧版数据里 🪥（牙刷）/ 🥛（杯子）在部分浏览器显示为方块 → 换成 **💧（水滴，Unicode 6.0 古董级 emoji，所有浏览器 100% 支持）**；🪙（金币）显示失败 → 换 **💰（钱袋）**。
- **旧 localStorage 数据缺少 emoji 字段**：页面加载时自动补全并保存（刷牙→💧、洗脸→🧼、早饭→🥣、午饭→🍚、晚饭→🍜、睡觉→😴、其他→📌）。
- 让旧数据修复生效有两种途径：改模板 + 自动补丁（推荐，无需清缓存），或控制台 `localStorage.removeItem('habitRatV4'); location.reload()`（**会重置全部数据**）。

## 其他

- `navigator.clipboard` 在非 HTTPS 环境被拒 → `copyText()` 降级（见 [[local-dev-and-caching]]）。
- 反复出现「刷新后还看到旧 UI」：**先确认地址是本地还是线上**，再强制刷新；必要时加版本号查询串跳过缓存。

相关：[[local-dev-and-caching]] [[ui-redesign-and-style]] [[data-model-and-economy]]
