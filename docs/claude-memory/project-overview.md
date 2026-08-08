---
name: project-overview
description: HabitRat（好习惯大冒险）儿童习惯养成应用的项目概况、技术架构、部署方式与目录结构
metadata:
  node_type: memory
  type: project
  tags: [project, architecture, deploy, vercel]
  originSessionId: f71c4b5c-ef45-449a-afbf-0e47a42ad95c
---

# HabitRat 项目概况

**HabitRat（好习惯大冒险 · Ratty的家）** 是一个面向儿童的习惯打卡 + 游戏化经济系统应用（孩子打卡赚 EXP/金币，家长做审批人）。核心目标人群是**孩子**（主用户）和**家长**（审批人/管理员），产品里常见的昵称是 **小美 / 小瑞（Ratty，小老鼠吉祥物）**。

## 技术架构

- 工作目录：`E:\Claude\habitrat`
- 已从单文件 `index.html` 拆分为 **`index.html` + `app.js` + `styles.css`** 三件套（纯静态单页应用，无构建步骤）
- GitHub 仓库：`https://github.com/mikle1230/habitrat`（分支 main）
- **线上部署在 Vercel**：`habitrat.vercel.app`；云端同步依赖 Vercel 的 `api/habit-sync.js` + **Upstash Redis**
- 本地开发：`python -m http.server` 跑在 `http://127.0.0.1:3000`，本地无 `/api/habit-sync` 接口

## 目录结构

```
habitrat/
├── index.html + app.js + styles.css   # 主应用
├── docs/
│   ├── design/                        # 图片素材库（代码引用，不可删）
│   ├── HabitRat_产品逻辑.md            # 权威产品文档（13 章）
│   └── HabitRat_风格设计.md            # 权威视觉/美术文档
└── index.html.bak                     # 备份
```

## 关键决策

- 网页标题最后简化为 **"HabitRat"**（用户明确要求）。
- docs 目录**已合并为「产品逻辑」+「风格设计」两份权威文档**，其余 md 和不需要的 html 已删除；合并时以**当前实现/最新设计为权威**，冲突一律取新版（详见 [[ui-redesign-and-style]]）。
- 本地与线上**数据不互通**（本地测试页不会同步云端），操作真实数据前必须先确认数据在哪端。

相关：[[data-model-and-economy]] [[local-dev-and-caching]]
