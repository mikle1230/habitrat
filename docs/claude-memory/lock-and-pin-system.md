---
name: lock-and-pin-system
description: HabitRat 每日锁定机制、23:59 自动锁定、过去日期只读与 PIN 解锁、密保问题找回
metadata:
  node_type: memory
  type: project
  tags: [lock, pin, security, rules]
  originSessionId: f71c4b5c-ef45-449a-afbf-0e47a42ad95c
---

# 每日锁定与 PIN 系统

## 从 PIN 到每日锁定

- **移除家长 PIN 管理整个历史打卡验证**，改为 **`lockedDates`** 数据模型 + 每日锁定按钮：锁定后当天所有打卡**无法修改**，解锁后恢复，状态持久化到 localStorage。
- 锁定按钮**悬浮在事项区域右下角**（圆形浮动按钮）：**锁定不需要 PIN**，**解锁需要 PIN**。
- **每天 23:59 自动锁定当天所有事项**：每 30 秒检查一次。

## 视图只读规则

- **周视图 / 月视图仅可查看**，不可直接修改事项状态；点击日期区域进入**日详情**。
- **过去日期日详情只读**，需 **PIN 临时解锁**才能编辑（`tempUnlocked = true` 覆盖锁定状态）。
- 过去日期详情中，**🔐 PIN 按钮放在该日期右边**（简约按钮 + PIN 即可），点击输入密码解锁；解锁后变为「🔒 锁定」可重锁。按钮文案为**「输入pin解锁」**，且要保留锁头图标。
- **点击今天** → 回到今日任务视图；**点击未来日期** → 提示英文 **"The day is in the future!"**（不能查看/不能记录未来）。

## editable 判定（关键逻辑）

- `editable` 判断曾踩坑：PIN 解锁后 `tempUnlocked = true`，但 `lockedDates[ds]` 仍存在导致 `!locked` 为 false、`editable = false`——**必须让 tempUnlocked 优先于锁定状态**：
  - 今天：没锁可编辑，锁了不可编辑；
  - 过去某天 + 已锁定：输入 PIN 后 `tempUnlocked = true` → 可编辑。

## PIN 与密保问题

- **PIN 为 4 位数字**；设置 PIN 需**两次确认**（两次不一致留在弹窗内报错 + 抖动重置，**弹窗不关闭**），修改 PIN 需先输入当前 PIN 验证 → 新 PIN → 再确认。
- **忘记 PIN**：通过**密保问题**（设置 PIN 时设定，问题+答案各输一次即可）重置——答对 → 设置新 PIN → **自动解锁进入设置页**；未设置密保问题会在 PIN 区提示「⚠️ 未设置密保问题 — 忘记 PIN 时将无法找回」。
- 所有 PIN 弹窗（设置/修改/解锁）错误提示都**留在弹窗内重输**，避免重开弹窗。

相关：[[data-model-and-economy]] [[settings-page-design]]
