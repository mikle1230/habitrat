# HabitRat 风格设计

> **HabitRat 唯一的视觉 / 美术规范权威文档。** 供前端 UI 开发、AI 出图、素材生产统一使用。
> 配套文档：[HabitRat_产品逻辑.md](./HabitRat_产品逻辑.md)（功能与规则）。

---

## 1. 视觉基调

- **风格**：精致奇幻写实——写实的光影和材质，但线条干净、色彩讲究，**没有脏乱 / 惊悚的负面细节**。
- **参考**：《原神》角色设计、《明日方舟》干员立绘、《双影奇境（It Takes Two / Split Fiction）》的魔幻 + 精致美术方向；场景视角参考《动物森友会》。
- **红线**：拒绝低幼可爱风。这是 10-12 岁孩子「愿意用」而非「觉得幼稚」的前提。
- **氛围关键词**：温暖、安全、有魔法感——不是阴暗洞穴。
- **设计关键词**：坚持 Persistence / 成长 Growth / 勇气 Courage / 善良 Kindness / 探索 Explore。

---

## 2. 配色系统

### 2.1 品牌色（CSS 变量，已落地到 styles.css）

| 变量 | 色值 | 用途 |
|---|---|---|
| `--paper` | `#F6F1E6` | 页面背景，暖米白 |
| `--paper-deep` | `#E0D9CB` | 深层面板 / 次级背景 |
| `--ink` | `#2D3340` | 深色背景基调 / 深色文字 |
| `--ink-soft` | `#5C6F8E` | 蓝灰主色（次要文字） |
| `--leather` | `#A38F7A` | 皮革 / 木质中性色 |
| `--amber` | `#C89D4A` | 金色点缀（勋章 / 强调） |
| `--amber-deep` | `#A67C2E` | 深金（强调文字） |
| `--glow` | `#4FC3FF` | 发光蓝，核心识别色（进度条 / 符文） |
| `--teal` | `#1FAE9F` | 青绿（完成态） |
| `--coral` | `#FF6B6B` | 珊瑚（失败 / 危险态） |
| `--text-sub` | `#7A7367` | 次级文字 |
| `--mascot-fur` | `#C97B4A` | 小瑞毛发 |
| `--mascot-ear` | `#F3D9C4` | 小瑞内耳 |

> 旧版紫色系（`#e0568b` 等）已废弃。强调色统一到金色 / 蓝灰，避免和「危险 / 错误」语义色（珊瑚）混淆。

### 2.2 语义约束

- 进度条填充：`--amber` → `--glow` 渐变。
- 完成 / 成功：`--teal`；失败 / 删除 / 错误：`--coral`。
- 深色背景上的正文用 `--hero-text: #EFEAE0`，次要文字用 `--text-muted: #C9C2B4`，更淡的用 `--text-dim: #B9B2A4`。

---

## 3. 吉祥物视觉规范

### 3.1 成长阶段（五阶，替换旧「XX 鼠」谐音命名）

| 等级 | 称号 | 关键词 / 表现 |
|---|---|---|
| Lv.1 | 新手冒险者 | 初入旅程 / 装备简陋 / 暗显疲惫 / 正在学习 |
| Lv.5 | 坚毅探险家 | 开始坚持 / 逐渐适应 / 更有信心 / 不再放弃 |
| Lv.10 | 勇敢挑战者 | 迎接挑战 / 勇敢前行 / 帮助他人 / 收获成长 |
| Lv.20 | 荣耀守护者 | 守护伙伴 / 能力提升 / 影响更多人 / 成为榜样 |
| Lv.MAX | 传奇领航者 | 光芒闪耀 / 引领方向 / 实现梦想 |

**视觉反差**：Lv.1 简陋皮甲、姿态青涩 → Lv.MAX 黄金铠甲 + 法杖 + 全身光效。

> 待定：是否在后续版本为小瑞重新加入「经历风雨的印记」（处理成干净的裂纹 / 勋章式疤痕，而非脏乱破洞）。

### 3.2 形象定稿（Ratty 三视图已定稿）

- **干净整洁的护甲**，材质写实但无脏乱感。
- 深色底 + 高饱和点缀色（发光蓝符文、金色金属），提升高级感和小尺寸可辨识度。
- 护甲纹路、符文、金属配件光泽——「冒险者装备」质感。
- 已产出资产：三视图、成长阶段图、表情 / 动作（思考、开心、加油、记录、胜利）。

### 3.3 装备图标集（装扮系统设计语言基础）

冒险者徽章、符文护肩、多功能腰带、探险背包、习惯笔记本 —— 这 5 个图标风格统一、有分类感（配饰 / 护甲 / 腰带 / 背包 / 道具）。**材质语言：皮革 + 金属 + 发光符文石**，后续装扮新道具延续这套图标语言。

**品牌延展已验证可行**：App 图标、成就徽章、贴纸、习惯手册封面，各场景保持辨识度和质感。

### 3.4 技术产出要求

1. **三视图 + 5 个成长阶段 + 表情包（开心 / 坚定 / 思考 / 倦怠 / 加油 / 满足）**，风格严格一致（AI 多次生成易跑偏，需可复现提示词 / 参考图锁定风格）。
2. **角色主体与装饰物干净分层**：换装系统需要「基础形象 + 可替换配件」的图层结构，边缘干净（避免写实毛发边缘抠图脏）。
3. **小尺寸可辨识性**：头像 / 小图标等小尺寸场景，缩小后轮廓依然清晰不糊。

---

## 4. 全局 UI 规范

### 4.1 写实插画分层使用（核心原则）

> 这是「风格混乱」的根因：底部导航用了高细节写实插画图标，而页面其余部分仍是通用扁平风格。**写实插画要分层使用，不能不分场合全部套用。**

| 场景 | 使用方式 |
|---|---|
| 头像、等级展示、装扮场景、成就徽章弹窗、品牌延展物料 | ✅ 用高细节写实插画（Ratty 全套资源） |
| 底部导航栏、任务列表小图标、按钮内嵌图标等高频 / 小尺寸 / 快速识别场景 | ❌ 不用写实插画，用**简化线性 / 剪影图标**（统一线条粗细、统一容器形状尺寸，保留品牌色，去掉复杂细节） |

> 通用 UI 原则，不止 HabitRat 适用——原神、明日方舟这类重美术产品，导航栏也都用极简图标，写实插画留给大展示位。

### 4.2 首页风格要点（当前实现即参考）

- 顶部英雄区：深蓝灰渐变（`--ink` → `--ink-soft`）+ 金色细线收边，小瑞头像用经验环（conic-gradient）环绕，头像略高于环、有立体感。
- 任务卡片：圆形勾选指示器（完成变青绿）、习惯名称 + 负责人标签 + 连续天数 🔥、EXP/Coin 奖励标签、点击整张卡片切换状态。
- 底部导航：磨砂玻璃滑块跟随选中 Tab 滑动，选中项图标字体放大、略抬高、居中突出。
- 暖米白 `--paper` 页面底色，与写实插画暖色调呼应。

---

## 5. 文案与措辞基调

现有文案偏低幼向，需与视觉风格一起「长大」：

| 现状 | 建议方向 |
|---|---|
| 「宝贝」 | 直接用孩子名字，或更中性称呼 |
| 「今天也要加油鸭！」 | 更简洁、有游戏感的激励语，减少幼态拟声词 |
| 大量可爱 emoji 堆砌（🐹💰🎁） | 逐步替换为游戏化 UI 图标风格（徽章、勋章、装备图标），emoji 仅作点缀 |
| 「今日任务」/「连续打卡」/「金币」 | 可考虑更有世界观感的包装（「每日任务」「连击 / Streak」「晶石 / 能量石」等，需与世界观统一设计，非最终命名） |
| 成就文案 | 延迟完成等负面场景用鼓励性语言（「虽然晚了一点，但你做到了！」），避免挫败感 |

---

## 6. 场景美术规范

### 6.1 场景层级（从底到顶）

```
背景图（场景图.jpg，4:3 横版）
  └─ 环境光效层（蜡烛光、呼吸光晕、窗光、灰尘粒子、魔法粒子、阴影）
     └─ 装饰层（成就关联物品：地毯、旗帜、奖杯、书架、盆栽等）
        └─ 微事件层（书滑落、徽章闪光、魔法微光、Ratty 微笑文字、萤火虫）
           └─ Ratty 角色层（场景页用小老鼠.png + CSS 待机动画）
              └─ 前景框层（仅「窗外」子场景：窗外2.png 窗框覆盖）
                 └─ 返回按钮（子场景左上角）
```

### 6.2 视角规范

| 场景类型 | 视角 | 说明 |
|---|---|---|
| 主场景（树洞小屋全景） | 正面微俯视 | 看到房间地面、墙壁、天花板，接近《动物森友会》房间视角 |
| 子场景（床/书桌/餐桌/洗脸区/窗外） | Ratty 平视 | 以 Ratty 视线高度为准的水平视角 |

### 6.3 成就弹窗视觉（三级 + 特殊）

| 等级 | 底板风格 | 边框 | 装饰元素 |
|---|---|---|---|
| 🥉 铜 | 暖铜色卡片 | 铜色描边 | 无粒子 |
| 🥈 银 | 银色微光卡片 | 银色描边 + 微光 | 少量银色粒子 |
| 🥇 金 | 金色光芒卡片 | 金色描边 + 外发光 | 金色粒子飘落 |
| ⭐ 特殊 | 星光 / 彩虹卡片 | 炫彩边框 | 星光粒子 |

弹窗结构：成就图标 → 名称 · 等级 → 达成条件 → 🎁 解锁物品 → 「去 Ratty 的家看看吧~」 → [太棒了！] 按钮。

---

## 7. 美术素材清单（AI 出图 brief）

### 7.0 场景背景图

| 素材 | 文件名 | 格式 | 尺寸 | 比例 | 视角 |
|---|---|---|---|---|---|
| 树洞小屋主场景 | `场景图.jpg` | JPG | ≥1600×1200 | 4:3 | 微俯视 |
| 书桌特写 | `书桌.jpg` | JPG | ≥1600×1200 | 4:3 | 平视 |
| 洗脸区特写 | `洗脸区.jpg` | JPG | ≥1600×1200 | 4:3 | 平视 |
| 睡觉区特写 | `睡觉.jpg` | JPG | ≥1600×1200 | 4:3 | 平视 |
| 餐桌特写 | `餐桌.jpg` | JPG | ≥1600×1200 | 4:3 | 平视 |
| 窗外前景框 | `窗外2.png` | PNG 透明底 | ≥1600×1200 | 4:3 | 平视 |

**主场景 Prompt：**
> A cozy tree hollow interior room for a small mouse adventurer, warm lighting from candles and a window, wooden furniture including a small desk, a sink/washbasin area, a bed in the corner, and a dining table. Fantasy but clean and inviting, similar to Genshin Impact interior design quality. Slightly overhead perspective like Animal Crossing room view. Warm color palette: dark blue-grey shadows (#2D3340), warm amber highlights (#C89D4A), cream paper walls (#F6F1E6). No clutter, no dirty textures. Magic rune glow accents (#4FC3FF). Aspect ratio 4:3.

**子场景公用 Prompt 模版：**
> [场景描述——如 "A wooden desk with a notebook and quill, seen from a small mouse's eye level"]. Eye-level perspective, warm candle lighting. Same cozy fantasy interior style as the main tree hollow room. Clean lines, no clutter. Color palette: dark blue-grey (#2D3340), warm amber (#C89D4A), cream (#F6F1E6), magic blue accents (#4FC3FF). Aspect ratio 4:3, minimum 1600x1200px.

### 7.1 装饰物品（成就关联，透明底 PNG，与主场景风格一致）

| 物品 | 对应成就 | 位置 | 尺寸(@2x) |
|---|---|---|---|
| 小盆栽 | 初露锋芒 | 书桌角落 | 120×160 |
| 书架 | 坚不可摧 | 靠墙中下 | 240×200 |
| 金色挂毯 | 传奇毅力 | 墙上中上 | 200×160 |
| 小地毯 | 百次冲刺 | 地面中央 | 280×120 |
| 落地灯 | 千锤百炼 | 角落左下 | 80×280 |
| 水晶吊灯 | 万次传说 | 天花板上方 | 160×200 |
| 风铃 | 面面俱到 | 窗边 | 60×200 |
| 靠垫 | 十项全能 | 床/地毯旁 | 160×100 |
| 阳光窗户光效 | 完美之日 | 全场景叠加 | 全景尺寸（screen 混合） |

**装饰物统一 Prompt 前缀：**
> Fantasy interior prop for a cozy mouse adventurer's tree hollow home. Same style as Genshin Impact interior design — clean, warm, magical but not cluttered. Color palette: dark blue-grey (#2D3340), warm amber (#C89D4A), cream (#F6F1E6), magic blue accents (#4FC3FF). Transparent background PNG. 2x resolution.

### 7.2 Ratty 配饰（成就关联，透明底 PNG，与 Ratty 形象比例对齐）

| 物品 | 对应成就 | 位置 | 尺寸(@2x) |
|---|---|---|---|
| 小徽章 | 专注者 | 胸前 | 48×48 |
| 银色装备架 | 大师之路 | 身旁 | 100×160 |
| 金色王冠 | 登峰造极 | 头上 | 80×60 |
| 小鸟伙伴 | 早起鸟儿 | 肩上 | 48×48 |
| 宝剑 | 周末战士 | 墙上/斜靠 | 60×180 |
| 凤凰羽毛 | 归来英雄 | 帽子上/身后 | 40×80 |

**配饰统一 Prompt 前缀：**
> Small accessory item for a mouse adventurer character named Ratty. Ratty is a tiny mouse knight wearing leather armor. The accessory should be sized proportionally for a small mouse. Fantasy adventure style, clean lines, matches Genshin Impact character accessory quality. Transparent background PNG. 2x resolution.

### 7.3 场景背景（成就关联）

| 素材 | 成就 | 格式 | 尺寸 | 说明 |
|---|---|---|---|---|
| 度假主题背景 | 寒暑假之王 | JPG | ≥1600×1200 | 替换主场景为海滩 / 夏日小屋主题 |

### 7.4 Ratty 动作表情图（可选增强）

Ratty 移动用 CSS 过渡（位置 + 透明度），不需要逐帧动画。可选增加 2-3 个情绪静帧：

| 表情 | 文件名建议 | 尺寸(@2x) | Prompt 要点 |
|---|---|---|---|
| 待机（默认） | `场景页用小老鼠.png` | 160×160 | 已有，正面站立，略微上下浮动 |
| 开心 | `ratty_happy.png` | 160×160 | smiling, arms raised in celebration, same pose as idle, excited but not exaggerated |
| 加油 | `ratty_cheer.png` | 160×160 | fist pump / cheering pose, determined, ready-for-adventure |

**Ratty 动作图统一 Prompt：**
> Ratty, a tiny mouse adventurer knight. Wearing leather armor with subtle rune patterns. Clean fantasy style like Genshin Impact character design — detailed but not cluttered. Standing pose, full body, facing forward. Transparent background PNG. 160x160px at 2x. Keep the same character design and proportions as the reference image.

### 7.5 成就弹窗底板

| 素材 | 格式 | 尺寸(@2x) |
|---|---|---|
| 铜级弹窗底板 | PNG | 640×800 |
| 银级弹窗底板 | PNG | 640×800（+微光） |
| 金级弹窗底板 | PNG | 640×800（+外发光） |
| 特殊成就弹窗底板 | PNG | 640×800（星光彩虹边框） |
| 金色粒子 | PNG | 40×40 单颗（3-4 种变体） |

---

## 8. 加载与转场规范

### 8.1 加载顺序（场景切换）

**先加载完背景图，最后才显示 Ratty。**

1. 背景图 `new Image()` 预加载，`onload` 后再设置 `src`
2. 过渡期 Ratty 保持 `opacity: 0`
3. 背景图加载完成后 Ratty `opacity: 1`，渐入过渡（0.3s）
4. 切换子场景时 Ratty 先隐藏，等新背景图 onload 后再显示

### 8.2 转场效果

| 转场类型 | 效果 | 时长 |
|---|---|---|
| 主场景 ↔ 子场景 | 背景模糊(6px) + 半透明(0.5) → 换图 → 恢复清晰 | 0.35s |
| 子场景 → 子场景 | 同上（需先回主场景再进，后续可优化直跳） | 0.35s |
| 成就弹窗 | 从底部弹入 + 粒子飘落 | 0.4s |

---

## 9. 给 AI 出图的统一要求（速查）

### 必须保持一致

1. **色彩范围**：主体色在 `#2D3340` → `#C89D4A` → `#F6F1E6` 区间，点缀色 `#4FC3FF`
2. **材质语言**：皮革 + 金属 + 发光符文石（延续装备图标集风格）
3. **光源**：暖色调，烛光 + 自然光混合，从窗 / 上方来光
4. **氛围**：温暖、安全、有魔法感的小窝
5. **线条**：干净利落，无脏乱 / 惊悚细节
6. **风格参考**：《原神》角色质感 + 《双影奇境》场景氛围

### 不同视角分别处理

- 主场景（微俯视）：参考《动物森友会》房间视角
- 子场景（平视）：Ratty 视线高度

### 交付格式

| 类型 | 格式 | 尺寸要求 |
|---|---|---|
| 场景背景图 | JPG | ≥1600×1200，4:3 |
| 装饰物品 | PNG 透明底 | @2x |
| Ratty 配饰 | PNG 透明底 | @2x，需与形象位置对齐 |
| 弹窗底板 | PNG | @2x，640×800 |
| 光效 / 粒子 | PNG 透明底 | @2x |

---

> 素材文件存放于 `docs/design/`（当前被 index.html / app.js 引用的：头像.png、场景图.jpg、场景页用小老鼠.png、书桌.jpg、洗脸区.jpg、窗外.jpg、餐桌.jpg、睡觉.jpg）。
