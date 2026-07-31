# HabitRat — Ratty 的家 场景与成就系统设计说明书

> 版本：v2 · 2026-07-31
> 用途：给 AI 设计工具出图的统一 brief，也作为前端开发的场景交互参考
> 配套文档：`HabitRat_产品设计指南.md`（全局设计规范）

---

## 一、项目背景

**HabitRat（好习惯大冒险）** 是面向 10-12 岁孩子的习惯打卡 Web 应用。

- **核心循环**：每日打卡 → 获得 EXP/金币 → 升级 → 解锁 Ratty 的装饰、配饰、场景
- **视觉基调**：精致奇幻写实，《原神》角色设计 + 《双影奇境》的魔幻精致感。拒绝低幼可爱风
- **品牌配色**：深蓝灰 `#2D3340` / 蓝灰 `#5C6F8E` / 皮革棕 `#A38F7A` / 金色 `#C89D4A` / 发光蓝 `#4FC3FF` / 暖纸色 `#F6F1E6`
- **吉祥物 Ratty**：坚韧善良的小老鼠冒险者。成长阶段：简陋皮甲(Lv.1)→符文护肩+围巾(Lv.5)→精致冒险装备(Lv.10)→黄金铠甲+法杖(Lv.MAX)

---

## 二、场景架构

### 2.1 场景层级（从底到顶）

```
背景图（`场景图.jpg`，4:3 横版）
  └─ 环境光效层（蜡烛光、呼吸光晕、窗光、灰尘粒子、魔法粒子、阴影）
     └─ 装饰层（成就关联物品，如地毯、旗帜、奖杯、书架、盆栽等）
        └─ 微事件层（书滑落、徽章闪光、魔法微光、Ratty 微笑文字、萤火虫）
           └─ Ratty 角色层（场景页用小老鼠.png + CSS 待机动画）
              └─ 前景框层（仅"窗外"子场景使用，`窗外2.png` 窗框覆盖）
                 └─ 返回按钮（子场景左上角）
```

### 2.2 视角规范

| 场景类型 | 视角 | 说明 |
|---|---|---|
| **主场景**（树洞小屋全景） | 正面微俯视 | 能看到房间的地面、墙壁、天花板，类似斜 45° 但更平，接近《动物森友会》房间视角 |
| **子场景**（床/书桌/餐桌/洗脸区/窗外） | Ratty 平视 | 以 Ratty 的视线高度为准，水平视角。比如书桌是从 Ratty 坐在桌前的角度看到桌面，床是从 Ratty 站在床边看到床铺 |

### 2.3 点击热区：坐标精准匹配方案

**不使用网格分区。** 改用像素坐标百分比定位——在背景图上定义若干命名热区，用户在图上点击时，代码计算点击位置在图片上的百分比坐标，判断落在哪个热区范围内。

实现方式：`handleSceneClick(event)` 函数已就绪，只需配置热区定义：

```js
// 热区配置示例（百分比坐标，左上角为原点）
var hotspots = {
  window:   { x: 0, y: 3,  w: 10, h: 22, scene: 'window' },
  bed:      { x: 18, y: 55, w: 16, h: 30, scene: 'sleep' },
  wash:     { x: 0, y: 50, w: 16, h: 30, scene: 'wash' },
  desk:     { x: 68, y: 5,  w: 32, h: 45, scene: 'desk' },
  dining:   { x: 70, y: 55, w: 30, h: 40, scene: 'dining' },
};
```

**这意味着你只需要给我百分比坐标（x 起点, y 起点, 宽度%, 高度%）即可精确定位每个热区，不需要把画面切成网格。** 你在设计主场景图时，可以有意识地把床、书桌、洗脸池、餐桌、窗户这些可交互元素放在背景图的不同位置，告诉我它们的百分比边界即可。

---

## 三、子场景清单

### 3.1 已实现

| 场景 | 热区 ID | 背景图文件 | 尺寸 | 视角 |
|---|---|---|---|---|
| 窗外 | `window` | Unsplash API 随机自然图 + `窗外2.png` 窗框前景 | 背景填满容器 / 窗框同主场景比例 | 平视（从窗户看出去） |
| 书桌 | `desk` | `书桌.jpg` | 4:3，建议 ≥ 1600×1200px | 平视（Ratty 坐在桌前） |
| 洗脸区 | `wash` | `洗脸区.jpg` | 4:3，建议 ≥ 1600×1200px | 平视（Ratty 站在洗脸池前） |
| 睡觉区 | `sleep` | `睡觉.jpg` | 4:3，建议 ≥ 1600×1200px | 平视（Ratty 在床边） |
| 餐桌 | `dining` | `餐桌.jpg` | 4:3，建议 ≥ 1600×1200px | 平视（Ratty 坐在餐桌前） |

### 3.2 待扩展

| 场景 | 热区 ID | 建议内容 | 优先级 |
|---|---|---|---|
| 藏宝阁/成就展示 | `trophy` | 展示已解锁成就物品的陈列架特写 | 低（等成就系统上线后） |
| 大门/外出 | `door` | 未来社区/好友功能入口 | 低（远期规划） |

---

## 四、装饰物品与成就系统

### 4.1 成就列表

| ID | 名称 | 条件 | 等级 | 解锁物品 |
|---|---|---|---|---|
| `streak_3` | 初露锋芒 | 连续 3 天全勤 | 🥉 | 🪴 小盆栽 |
| `streak_7` | 坚不可摧 | 连续 7 天全勤 | 🥈 | 📚 书架 |
| `streak_30` | 传奇毅力 | 连续 30 天全勤 | 🥇 | 🏆 金色挂毯 |
| `total_100` | 百次冲刺 | 累计 100 次打卡 | 🥉 | 🧶 小地毯 |
| `total_500` | 千锤百炼 | 累计 500 次打卡 | 🥈 | 🏮 落地灯 |
| `total_2000` | 万次传说 | 累计 2000 次打卡 | 🥇 | ✨ 水晶吊灯 |
| `single_10` | 专注者 | 单项习惯连续 10 天 | 🥉 | 📛 小徽章 |
| `single_30` | 大师之路 | 单项习惯连续 30 天 | 🥈 | ⚔️ 银色装备架 |
| `single_100` | 登峰造极 | 单项习惯连续 100 天 | 🥇 | 👑 金色王冠 |
| `daily_5` | 面面俱到 | 一天完成 5 项 | 🥉 | 🎐 彩色风铃 |
| `daily_10` | 十项全能 | 一天完成 10 项 | 🥈 | 🛋️ 豪华靠垫 |
| `daily_all` | 完美之日 | 一天内全部 ✓ | 🥇 | ☀️ 阳光窗户光效 |
| `earlybird` | 早起鸟儿 | 连续 7 天 7:00 前完成 | ⭐ | 🐦 小鸟伙伴 |
| `weekend` | 周末战士 | 连续 4 周末全勤 | ⭐ | 🗡️ 宝剑 |
| `vacation` | 寒暑假之王 | 寒暑假完成率 ≥ 90% | ⭐ | 🏖️ 度假背景 |
| `comeback` | 归来英雄 | 断连≥7天后重新连续≥3天 | ⭐ | 🪶 凤凰羽毛 |

### 4.2 成就弹窗

达成时弹出成就卡片，三级不同视觉：

| 等级 | 底板风格 | 边框 | 装饰元素 |
|---|---|---|---|
| 🥉 铜 | 暖铜色调卡片 | 铜色描边 | 无粒子 |
| 🥈 银 | 银色微光卡片 | 银色描边 + 微光 | 少量银色粒子 |
| 🥇 金 | 金色光芒卡片 | 金色描边 + 外发光 | 金色粒子飘落 |
| ⭐ 特殊 | 星光/彩虹卡片 | 炫彩边框 | 星光粒子 |

弹窗结构：
```
┌──────────────────────┐
│      [成就图标]       │
│   千锤百炼 · 银       │
│  累计完成 500 次打卡   │
│  🎁 解锁：落地灯 🏮    │
│  去 Ratty 的家看看吧~  │
│      [ 太棒了！]       │
└──────────────────────┘
```

---

## 五、需要设计的美术素材

### 5.0 热区坐标采集（场景图上的可点击区域）

**不需要手动估算坐标。** Ratty 的家页面上有一个"✎ 编辑热区"按钮（在场景描述文字旁边），点击后进入热区编辑模式：

- 在场景图上**拖拽鼠标**圈选区域
- 松开后左下角自动显示百分比坐标（x:__% y:__% w:__% h:__%）
- **点击坐标文字即可复制到剪贴板**
- 点"退出编辑"恢复正常

把你要的热区坐标直接贴给我，我更新到代码里。

### 5.1 主场景背景图

| 素材 | 文件名 | 格式 | 尺寸 | 比例 | 视角 | 说明 |
|---|---|---|---|---|---|---|
| 树洞小屋主场景 | `场景图.jpg` | JPG | ≥ 1600×1200px | 4:3 | 微俯视 | Ratty 的树洞小屋全景，包含可交互的窗户、书桌、洗脸池、床、餐桌 |

**AI Prompt：**
> A cozy tree hollow interior room for a small mouse adventurer, warm lighting from candles and a window, wooden furniture including a small desk, a sink/washbasin area, a bed in the corner, and a dining table. Fantasy but clean and inviting, similar to Genshin Impact interior design quality. Slightly overhead perspective like Animal Crossing room view. Warm color palette: dark blue-grey shadows (#2D3340), warm amber highlights (#C89D4A), cream paper walls (#F6F1E6). No clutter, no dirty textures. Magic rune glow accents (#4FC3FF). Aspect ratio 4:3.

### 5.2 子场景背景图

| 素材 | 文件名 | 格式 | 尺寸 | 比例 | 视角 | 说明 |
|---|---|---|---|---|---|---|
| 书桌特写 | `书桌.jpg` | JPG | ≥ 1600×1200px | 4:3 | 平视 | Ratty 坐在桌前写字的视角 |
| 洗脸区特写 | `洗脸区.jpg` | JPG | ≥ 1600×1200px | 4:3 | 平视 | Ratty 站在洗脸池前刷牙的视角 |
| 睡觉区特写 | `睡觉.jpg` | JPG | ≥ 1600×1200px | 4:3 | 平视 | Ratty 在床边准备睡觉的视角 |
| 餐桌特写 | `餐桌.jpg` | JPG | ≥ 1600×1200px | 4:3 | 平视 | Ratty 坐在餐桌前吃饭的视角 |
| 窗外前景框 | `窗外2.png` | PNG（透明底） | ≥ 1600×1200px | 4:3 | 平视 | 窗框+窗格，玻璃区域透明镂空 |

**子场景公用 Prompt 模版：**
> [场景描述——如 "A wooden desk with a notebook and quill, seen from a small mouse's eye level"]. Eye-level perspective, warm candle lighting. Same cozy fantasy interior style as the main tree hollow room. Clean lines, no clutter. Color palette: dark blue-grey (#2D3340), warm amber (#C89D4A), cream (#F6F1E6), magic blue accents (#4FC3FF). Aspect ratio 4:3, minimum 1600x1200px.

### 5.3 成就弹窗底板

| 素材 | 格式 | 尺寸 | 说明 |
|---|---|---|---|
| 铜级弹窗底板 | PNG | 640×800px（@2x） | 暖铜色圆角卡片，铜色边框 |
| 银级弹窗底板 | PNG | 640×800px（@2x） | 银色圆角卡片，银色描边+微光效果 |
| 金级弹窗底板 | PNG | 640×800px（@2x） | 金色圆角卡片，金色描边+外发光 |
| 特殊成就弹窗底板 | PNG | 640×800px（@2x） | 星光彩虹边框圆角卡片 |
| 金色粒子 | PNG | 40×40px 单颗 | 弹窗弹出时飘落的小光点，约需 3-4 种变体 |

### 5.4 场景装饰物品（成就关联）

所有装饰物品要求：**透明背景 PNG，与主场景风格一致的精致奇幻写实风格**。

| 物品 | 对应成就 | 位置 | 尺寸（@2x） | Prompt 要点 |
|---|---|---|---|---|---|
| 小盆栽 | 初露锋芒 | 书桌角落 | 120×160px | Small terracotta pot with a tiny green sprout, warm lighting, clean fantasy style, transparent background PNG |
| 书架 | 坚不可摧 | 靠墙中下 | 240×200px | Small wooden bookshelf with 3-5 colorful books, warm wood tones, cozy fantasy interior prop, transparent background PNG |
| 金色挂毯 | 传奇毅力 | 墙上中上 | 200×160px | Gold-framed fabric tapestry banner with subtle rune patterns, warm metallic accents, hanging on wall, transparent background PNG |
| 小地毯 | 百次冲刺 | 地面中央 | 280×120px | Round braided rug in warm amber/cream tones, woven texture, transparent background PNG |
| 落地灯 | 千锤百炼 | 角落左下 | 80×280px | Cast iron floor lamp with fabric shade, warm glow effect, cozy fantasy interior, transparent background PNG |
| 水晶吊灯 | 万次传说 | 天花板上方 | 160×200px | Small crystal chandelier with warm glowing crystals, elegant but cozy, hanging from ceiling, transparent background PNG |
| 风铃 | 面面俱到 | 窗边 | 60×200px | Colorful stained glass wind chime, hanging from window frame, transparent background PNG |
| 靠垫 | 十项全能 | 床/地毯旁 | 160×100px | Soft plush cushion in warm cream/amber tones, cozy texture, transparent background PNG |
| 阳光窗户光效 | 完美之日 | 全场景叠加 | 全景尺寸 | Semi-transparent overlay: warm golden sunbeams streaming through window, soft light rays, blend mode screen |

**装饰物统一 Prompt 前缀：**
> Fantasy interior prop for a cozy mouse adventurer's tree hollow home. Same style as Genshin Impact interior design — clean, warm, magical but not cluttered. Color palette: dark blue-grey (#2D3340), warm amber (#C89D4A), cream (#F6F1E6), magic blue accents (#4FC3FF). Transparent background PNG. 2x resolution.

### 5.5 Ratty 配饰（成就关联）

所有配饰要求：**透明背景 PNG，需与现有 Ratty 形象比例对齐**。配饰叠加在 `场景页用小老鼠.png` 之上，需要和 Ratty 的身体位置吻合。

| 物品 | 对应成就 | 位置 | 尺寸（@2x） | Prompt 要点 |
|---|---|---|---|---|---|
| 小徽章 | 专注者 | Ratty 胸前 | 48×48px | Small metal badge pin with colored enamel, adventure guild style, transparent background PNG |
| 银色装备架 | 大师之路 | Ratty 身旁 | 100×160px | Standing weapon display rack in silver finish, simple elegant, transparent background PNG |
| 金色王冠 | 登峰造极 | Ratty 头上 | 80×60px | Small golden crown, delicate design, warm metallic glow, transparent background PNG |
| 小鸟伙伴 | 早起鸟儿 | Ratty 肩上 | 48×48px | Tiny colorful songbird companion, perched pose, cute but not cartoonish, transparent background PNG |
| 宝剑 | 周末战士 | 墙上/斜靠 | 60×180px | Knight's sword with leather-wrapped hilt, clean blade, adventure weapon style, transparent background PNG |
| 凤凰羽毛 | 归来英雄 | 帽子上/身后 | 40×80px | Glowing phoenix feather with subtle magical shimmer, warm orange-gold tones, transparent background PNG |

**配饰统一 Prompt 前缀：**
> Small accessory item for a mouse adventurer character named Ratty. Ratty is a tiny mouse knight wearing leather armor. The accessory should be sized proportionally for a small mouse. Fantasy adventure style, clean lines, matches Genshin Impact character accessory quality. Transparent background PNG. 2x resolution.

### 5.6 场景背景（成就关联）

| 素材 | 成就 | 格式 | 尺寸 | 说明 |
|---|---|---|---|---|
| 度假主题背景 | 寒暑假之王 | JPG | ≥ 1600×1200px | 替换主场景为海滩/夏日小屋主题背景 |

### 5.7 Ratty 动作表情图（可选增强）

Ratty 移动用 CSS 过渡（位置+透明度），不需要逐帧动画。可选增加 2-3 个情绪静帧，打卡成功/升级时切换显示：

| 表情 | 文件名建议 | 格式 | 尺寸 | Prompt 要点 |
|---|---|---|---|---|
| 待机（默认） | `场景页用小老鼠.png` | PNG透明底 | 160×160px（@2x） | 已有，Ratty 正面站立，略微上下浮动 |
| 开心 | `ratty_happy.png` | PNG透明底 | 160×160px（@2x） | Ratty smiling, arms raised in celebration, same standing pose as idle, excited but not exaggerated |
| 加油 | `ratty_cheer.png` | PNG透明底 | 160×160px（@2x） | Ratty fist pump / cheering pose, determined expression, ready-for-adventure stance |

**Ratty 动作图统一 Prompt：**
> Ratty, a tiny mouse adventurer knight. Wearing leather armor with subtle rune patterns. Clean fantasy style like Genshin Impact character design — detailed but not cluttered. Standing pose, full body, facing forward. Transparent background PNG. 160x160px at 2x. Keep the same character design and proportions as the reference image.

---

## 六、加载顺序规范

场景切换时必须保证：**先加载完背景图，最后才显示 Ratty。**

实现方式：
1. 背景图加载：创建 `new Image()` 预加载，`onload` 后再设置 `src`
2. 过渡期 Ratty 保持 `opacity: 0`
3. 背景图加载完成后 Ratty `opacity: 1` 带渐入过渡（0.3s）
4. 切换子场景时 Ratty 先隐藏，等新背景图 onload 后再显示

```js
// 加载顺序伪代码
var img = new Image();
img.onload = function() {
  sceneBg.src = img.src;       // 背景先上
  sceneRat.style.opacity = '1'; // Ratty 后显
};
img.src = newSceneUrl;
sceneRat.style.opacity = '0';    // 先隐藏 Ratty
```

---

## 七、转场规范

| 转场类型 | 效果 | 时长 |
|---|---|---|
| 主场景 → 子场景 | 背景模糊(6px)+半透明(0.5) → 换图 → 恢复清晰 | 0.35s |
| 子场景 → 主场景 | 同上 | 0.35s |
| 子场景 → 子场景 | 同上（目前需要先回主场景再进，后续可优化为直跳） | 0.35s |
| 成就弹窗 | 从底部弹入 + 粒子飘落 | 0.4s |

---

## 八、给 AI 出图的统一要求

### 必须保持一致

1. **色彩范围**：主体色在 `#2D3340` → `#C89D4A` → `#F6F1E6` 区间，点缀色用 `#4FC3FF`
2. **材质语言**：皮革 + 金属 + 发光符文石（延续已有装备图标集风格）
3. **光源**：暖色调，烛光+自然光混合，从窗/上方来光
4. **氛围**：温暖、安全、有魔法感的小窝——不是阴暗洞穴
5. **线条**：干净利落，无脏乱/惊悚细节
6. **风格参考**：《原神》角色质感 + 《双影奇境》场景氛围

### 不同视角分别处理

- **主场景（微俯视）**：参考《动物森友会》房间视角——略俯但不过分，能看到地面、部分墙壁和天花板
- **子场景（平视）**：Ratty 的视线高度——水平视角，类似第一人称看桌面/床面/窗外

### 交付格式

| 类型 | 格式 | 尺寸要求 |
|---|---|---|
| 场景背景图 | JPG | ≥ 1600×1200px，4:3 比例 |
| 装饰物品 | PNG（透明底） | @2x 尺寸如上表所列 |
| Ratty 配饰 | PNG（透明底） | @2x，需与 Ratty 形象位置对齐 |
| 弹窗底板 | PNG | @2x，640×800px |
| 光效/粒子 | PNG（透明底） | @2x |
