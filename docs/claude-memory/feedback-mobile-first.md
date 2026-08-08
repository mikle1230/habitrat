---
name: feedback-mobile-first
description: 用户明确要求只做移动端版本、保留手动生成的打印版，不要随浏览器宽度变化布局
metadata:
  node_type: memory
  type: feedback
  tags: [feedback, mobile, print]
  originSessionId: f71c4b5c-ef45-449a-afbf-0e47a42ad95c
---

# 移动端优先与打印版反馈

## 只做移动端

- **取消随浏览器宽度变化的响应式桌面布局**，专注移动端版本；`@media (min-width: 768px)` 桌面布局已移除，页面**始终显示移动端视图**（`isDesktop()` 恒返回 false）。
- 用 **iPhone Safari** 实测验证。

## 打印版保留但手动触发

- 保留**打印版**作为导出/打印使用，但**每次手动生成、日常不显示**。
- 入口：设置 Tab 的「生成打印版周表」按钮 → 手动点击后显示完整打印版，右上角「✕ 关闭」退回正常视图；打印时（Ctrl+P）自动应用 **A4 横版**打印样式。

## 其他界面偏好（顺带记录）

- 习惯列表：刷牙需用兼容性好的 emoji（💧）；妈妈的习惯在名称上加「妈妈」前缀（妈妈吃早饭、妈妈早睡觉）。
- 今日任务区子 Tab：**今日任务 · 周 · 月**，去掉与今日任务重复的「日」视图。
- 删除顶部「今天」按钮和日期左右 ◀▶ 箭头——看其他日期进周/月视图选择即可；顶部只显示今天日期 + 星期 + 右侧属性标签（工作日/节假日/寒暑假，各色胶囊）。

相关：[[ui-redesign-and-style]] [[feedback-design-workflow]] [[lock-and-pin-system]]
