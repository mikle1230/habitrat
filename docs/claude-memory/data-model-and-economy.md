---
name: data-model-and-economy
description: HabitRat 的双货币经济系统、等级称号、localStorage 存储结构、云同步与交易流水模型
metadata:
  node_type: memory
  type: project
  tags: [data-model, economy, storage, sync]
  originSessionId: f71c4b5c-ef45-449a-afbf-0e47a42ad95c
---

# 数据模型与经济系统

## 双货币模型

- **EXP**：经验值，用于升级；仅在进度条上体现，**状态栏不显示 EXP 文字**，该区域只显示 Coin 总量和已兑换数量。
- **Coin（金币）**：消耗型货币，用于奖励商店兑换；兑换用 `transactions` 流水记录（`spend_coin` 类型）。
- 金币统计口径：**退款计入收入**，已退款的兑换不计入支出。

## 等级/称号系统

- 等级曲线：**平方根曲线**。
- 称号五阶：**新手冒险者 → … → 传奇领航者**（新版），旧「习惯新手」作废。
- 称号/等级对场景和装扮有联动（见 [[scene-ratty-and-hotzones]]）。

## 存储与同步（V4）

- 本地存储 key：**`habitRat:v4`**（localStorage 键名 `habitRatV4`），旧 `habitTableV3` 已作废。
- 云同步：**V4 = Upstash Redis + Vercel**；旧 BrewPage / Gist 方案作废。
- **`sceneZones` 是模块级顶层变量，不进 state 对象**，由 `saveData` / `getSyncData` 显式保存（与 `outfitState` / `roomState` 同模式）。
- 习惯（habits）数据带 **emoji 字段**；旧数据缺失时页面加载会自动补全并写回。

## 家庭成员

- 家庭成员（如孩子 + 妈妈）的**所有习惯计入同一家庭成员**；如妈妈的习惯需在名称上标注（「妈妈吃早饭」「妈妈早睡觉」）。

## 锁定数据模型

- **`lockedDates`**：记录已锁定日期的数据模型（替代原 PIN 验证历史打卡），用于每日锁定（见 [[lock-and-pin-system]]）。

相关：[[project-overview]] [[lock-and-pin-system]] [[shop-exchange-and-refund]]
