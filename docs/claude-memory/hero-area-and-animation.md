---
name: hero-area-and-animation
description: HabitRat Hero 区的最终布局结构与 XP 进度条加载动画的实现细节
metadata:
  node_type: memory
  type: project
  tags: [ui, hero, animation, css]
  originSessionId: f71c4b5c-ef45-449a-afbf-0e47a42ad95c
---

# Hero 区设计与动画

Hero 区经历**多轮大改**（三列→合并→分块→claymorphism），最终回到「大区块、易点击」的块式结构，仅做视觉微调。**教训：想清楚设计再动手，不要靠排版微调硬撑**（见 [[feedback-design-workflow]]）。

## 最终布局（自上而下）

1. **header-nav（顶部导航条）**：日期 + 时钟 + 同步状态 + 日志按钮 + 锁定。右上角顺序：⏰时钟 → 🔄同步状态 → 📋日志 → 🔓锁定。
2. **status-band**：头像（XP 环）+ 等级称号 + 昵称 + 时段问候语 + XP 进度条 + 剩余 EXP。
3. **coin-stats**：💰 金币 / ⏳ 待生效 / 🛍️ 已兑换 三个软陶色块，**整组居中**，内边距足够大以容纳多位数字（数字多时色块自动变宽，不固定宽度）。

## 关键样式细节

- 日期 **白色粗体 14px**，星期 **灰色淡色 12px + margin-left 6px**（便于区分），模式标签（工作日/节假日/寒暑假）为**彩色胶囊**放在星期之后。
- 时段问候语（如「🌙 夜深了」）放在**等级行右侧靠右对齐**。
- 金币三块用**相同高度/内边距/字号**统一（主币块 18px 金色数字稍大，次要 14px 白色），样式统一为软陶。
- 头像：经验环 **56px 不变**，内部小老鼠图 **56px** 并**高出环上部约 18px**（营造立体凸起感）；头像环整体放大到 64px 是错误方案，用户要求只放大鼠图。
- 进度条下方灰色小字显示「还需 X EXP」。

## XP 进度条加载动画

- 加载时 XP 条从 0 → 实际值，**数字从本级满额倒减到实际值**，文字「还需 XX EXP」**跟随进度条位置**滑动：0–80% 时文字在进度条右端，**超过 80% 右对齐防溢出**。
- 触发方式：`switchView` 渲染 → `requestAnimationFrame` 中临时关闭过渡、把 XP 归零 → **强制回流 `offsetWidth`** → 恢复过渡设实际值（否则过渡不触发）。
- 时长 **1.6s**，曲线 **`cubic-bezier(.15,.85,.3,1)`**（先快后慢，便于看清数字变化），用户最终要求 2 秒。

相关：[[ui-redesign-and-style]] [[data-model-and-economy]] [[tab-bar-navigation]]
