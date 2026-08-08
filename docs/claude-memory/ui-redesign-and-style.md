---
name: ui-redesign-and-style
description: HabitRat UI 重设计历程、配色体系演进、字体、移动端优先策略与打印版
metadata:
  node_type: memory
  type: project
  tags: [ui, design, mobile-first, css]
  originSessionId: f71c4b5c-ef45-449a-afbf-0e47a42ad95c
---

# UI 重设计与风格体系

## 设计依据

- 依据 **`habitrat-游戏化经济系统设计文档.md`** 与 **`habitrat-ui-redesign.html`**（静态原型）做完整 UI 重设计，核心玩法：双货币、等级/称号（平方根曲线）、🐹 装扮小老鼠、奖励商店、可配置数据模型。

## 配色体系（以当前实现为准）

- **深蓝灰系**（权威，与 styles.css 一致）：`#2D3340` / `#5C6F8E` / `#A38F7A` / `#C89D4A` / `#4FC3FF` / `#F6F1E6`。
- 早期紫色系（`--paper`/`--ink`/`--amber`/`--teal`/`--coral`）**已作废**。
- 旧的 CSS 变量（`--accent`/`--green`/`--blue` 等）JS 内联样式仍引用，**需保留向后兼容别名**。
- Hero 区保留深色渐变 `--ink → --steel` + 右上角微弱琥珀色光晕；XP 条用 `--gold → --glow` 渐变（琥珀过渡到冰蓝，与 XP 环配色统一）。

## 字体

- **Baloo 2**（显示）+ **Inter**（正文）+ **IBM Plex Mono**（等宽）。

## 关键布局决策

- **移动端优先**：移除 `@media (min-width: 768px)` 桌面布局，页面**始终移动端视图**；打印版保留但需手动触发（见 [[feedback-mobile-first]]）。
- **底部 5 Tab（Royal Match 式）**：日志 · Ratty · 任务 · 商店 · 设置，中间「任务」最突出（见 [[tab-bar-navigation]]）。
- Hero 区采用 **Claymorphism（软陶风格）**：圆润、弹性、半透明背景、细边框、圆角、轻微阴影，适合儿童应用（见 [[hero-area-and-animation]]）。
- 吉祥物：SVG 小老鼠 **Ratty** 带 XP 环形进度（三段进化），后改用设计图场景。

## 文档合并

- docs 下所有文档合并为 **HabitRat_产品逻辑.md** + **HabitRat_风格设计.md** 两份权威文档，冲突一律取当前实现/新版；设计图 `docs/design/`（约 8 张被代码引用）必须保留。

相关：[[project-overview]] [[hero-area-and-animation]] [[feedback-design-workflow]]
