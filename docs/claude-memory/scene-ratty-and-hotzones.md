---
name: scene-ratty-and-hotzones
description: HabitRat Ratty 场景页、可交互热区编辑器（自由画圈+磁性吸附）与热区-场景映射
metadata:
  node_type: memory
  type: project
  tags: [scene, hotzone, canvas, editor]
  originSessionId: f71c4b5c-ef45-449a-afbf-0e47a42ad95c
---

# Ratty 场景与热区编辑器

## Ratty 页设计

- 以**场景为中心**的交互：进入直接看到场景房间，所有操作按钮围绕画面设计（游戏化），**去掉「我的等级/装扮」子 Tab**；装扮为**弹窗**（不是展开），入口统一为场景下方装扮汇总卡片。
- 页面顺序（简洁版）：**场景图 → 📜 游戏规则卡片 → 装扮入口**（场景图与规则之间的文字/进度条已删除）。
- 场景可**随等级进化**（Lv.4 窗台小花盆、Lv.7 暖灯、Lv.10 星空、Lv.15 金框，纯 CSS）；但**所有光晕层已全部清除**（蜡烛光晕、暖灯光晕、呼吸环境光、状态栏 `::after` 装饰光晕），需要时再按需添加。
- **书桌场景**：点击书桌进入书桌背景 → 点击**正中央 30% 区域**（`top:35%; left:35%; width:30%; height:30%`）弹出 20 个等级徽章收藏弹窗；仅该区域 hover 变手型 + 显示「🏆 查看徽章」，**周边不可点击**。
- 随机微事件保留 3 个：萤火虫闪过（35~55s）、魔法微光（60~90s）、徽章闪光（80~120s）；已删除书滑落、小瑞对你笑了、雨天死代码。

## 热区编辑器（场景热区）

- 入口：「✎ 编辑热区」按钮，页面加载 **300ms 后**出现在场景图右上角；现通过开关 **`SCENE_EDITOR_ENABLED = false`** 隐藏入口（**功能保留**，改回 `true` 即恢复），另加 CSS `#btnSceneEditor { display: none !important }` 兜底。
- **编辑模式禁用一切场景交互**：`handleSceneClick`/`handleSceneHover` 开头 `if (sceneEditorActive) return;`——否则画热区时点床会切场景。
- 绘制方式从「拉矩形框」改为**自由画圈**：按住鼠标涂抹 → 松开自动首尾闭合 → 形成不规则多边形热区。
- 坐标**抽稀**用 **Douglas-Peucker 算法**；命中判定用**射线法点内判断 `pointInPoly`**（矩形 + 多边形都支持）。
- **磁性吸附**：画新热区笔迹碰到已有热区边界时，自动**吸附投影到边界最近处**（`applyZoneSnap` + `closestPointOnSegment`），吸附段轨迹显示**绿色**；两热区共享边界、绝不重叠。整圈画在已有热区内 → toast「⚠️ 该区域已在其他热区内，无法新增」。
- **自动命名** `zone-1`、`zone-2`…（递增不重复）+ 自动保存；支持**选中并删除**任意热区。
- **持久化**：`sceneZones` 为模块级顶层变量，`saveData`/`getSyncData`/`loadFromServer`/`importBackup` 显式接入（含 `SCENE_NAME_MAP` 兼容新画 zone-N 与旧默认名）。
- 热区坐标输出：编辑后左下角显示 `pts: x,y x,y x,y ...` 百分比坐标，点击复制（用 `copyText` 降级方案）。

## 热区 ↔ 场景映射（重要配置）

| 热区 | 场景 | 背景图 |
|---|---|---|
| zone-1 | 🚿 洗脸区 | 洗脸区.jpg |
| zone-2 | 🛏 床 | 睡觉.jpg |
| zone-3 | 🪟 窗户 | 窗外.jpg |
| zone-4 | 🎒 宝箱 | 打开装扮面板 |
| zone-5 | 🏆 成就室2 | 成就室2.png |
| zone-6 | 📖 书桌 | 书桌.jpg |
| zone-7 | 🍽 餐桌 | 餐桌.jpg |
| zone-8 / zone-9 | ⏳ 待定（图未做） | 保留，点击提示「尚未关联场景」 |

## 场景切换时序（关键）

- `switchScene`：过渡期间**先隐藏 Ratty** → `new Image()` **预加载背景图** → 等 **onload + 至少 200ms** 模糊过渡结束 → 才切背景 src 并显示 Ratty（带 0.3s 淡入）。避免「Ratty 先于场景出现」的违和感，网络慢时也不会提前冒出来。

相关：[[settings-page-design]] [[local-dev-and-caching]]
