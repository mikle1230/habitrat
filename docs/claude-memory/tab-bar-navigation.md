---
name: tab-bar-navigation
description: HabitRat 底部 5 Tab（Royal Match 式）布局、磨砂玻璃滑块定位与 Ratty Tab 滑块 bug 根因
metadata:
  node_type: memory
  type: project
  tags: [navigation, tabbar, css, bug]
  originSessionId: f71c4b5c-ef45-449a-afbf-0e47a42ad95c
---

# 底部 Tab 栏导航

## 5 Tab 布局（Royal Match 式）

- Tab 顺序：**日志 · Ratty · 任务 · 商店 · 设置**，模仿 Royal Match 游戏底部菜单——**中间「任务」最突出，左右依次递减重要性**（日志最左最次要）。
- 「Ratty 的家」命名过长，Tab 文案精简为 **Ratty**；「冒险日志」精简为 **日志**。
- 首页视图子 Tab（今日任务区）：**今日任务 · 周 · 月**（日视图与今日任务重复已移除）；子 Tab 标签滚动时**固定位置不跟滚**。

## 磨砂玻璃滑块

- **深灰半透明 `rgba(45,51,64,0.88)` + `backdrop-filter: blur(8px)`** 毛玻璃效果；上部圆角 `border-radius: 10px 10px 0 0`，下部贴底；顶部 `top: -6px`（略高于菜单栏背景框）。
- 激活 Tab：**图标放大 `scale(1.25)` + 金色**，**文字 12px 加粗白色**，整体 `translateY(-4px)` 上移突出，0.3s 平滑过渡。
- 滑块在激活 tab 上**居中**：宽度 = tab 宽度的 85%。

## 滑块定位（踩坑重点）

- **不要依赖 `getBoundingClientRect()` 计算滑块位置**——视图切换时布局未稳定、且受 `scale` 动画影响会偏移。改用 **`calc()` 百分比定位：`(index + 0.5) / 总数 × 100%`**，与布局无关、精确稳定。
- `.tabbar` 保持 `position: absolute; bottom: 0; left: 0; right: 0`（线上版本方案），改 `position: relative` 会破坏布局上下文引入新问题（曾回退）。

## Ratty Tab 滑块 bug（经典根因）

- 症状：**只有点 Ratty tab 时滑块不动**（其他 4 个正常），字体变金但色块不滑动。
- 根因：`dressupView` 元素已从 HTML 移除，但 `renderGrowthView()` 仍执行 `document.getElementById('dressupView').style.display` → 返回 **null 抛错**，中断了后续 `updateTabPill()`。**删除 HTML 元素后必须同步清理 JS 引用**。
- 排查方式：检查 Ratty 页视图渲染函数是否引用已删除元素。

相关：[[ui-redesign-and-style]] [[hero-area-and-animation]]
