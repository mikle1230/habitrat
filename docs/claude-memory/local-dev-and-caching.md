---
name: local-dev-and-caching
description: HabitRat 本地开发流程、python http.server 的 no-cache 配置、剪贴板降级与端口残留处理
metadata:
  node_type: memory
  type: project
  tags: [dev, local-server, caching, git]
  originSessionId: f71c4b5c-ef45-449a-afbf-0e47a42ad95c
---

# 本地开发与缓存

## 本地服务器

- 纯静态单页应用，本地用 **`python -m http.server`** 跑在 `http://127.0.0.1:3000`；node 和 python 都可用。
- **python 服务器必须加 `Cache-Control: no-cache` 头**，否则浏览器缓存旧 JS/CSS，改动不生效（这是反复出现的坑）。用户强刷用 `Ctrl+Shift+R`（Mac `Cmd+Shift+R`）。
- **端口残留**：停止旧服务器后可能仍有残留 python 进程占着 3000 端口继续服务旧代码——用 `netstat` 找 PID 并 kill。

## 本地 vs 线上

- 本地没有 `/api/habit-sync` 接口 → 请求 404 / POST 501，**不是 bug**；检测到 `localhost`/`127.0.0.1` 时**跳过所有云端同步请求**，静默处理，控制台不再报错；部署到 Vercel 后 `api/habit-sync.js` 自动生效。
- 线上地址 `habitrat.vercel.app` 与本地**代码不同步**：本地改动不会自动部署，需 git push，Vercel 自动部署（通常 1~3 分钟），上线后可能还有 CDN 缓存需强刷。
- 本地与线上**数据不互通**（本地测试页不会同步云端），操作真实数据前先确认在哪端。

## 剪贴板降级

- `navigator.clipboard` 在 `http://127.0.0.1` 非 HTTPS 环境会被拒绝权限，点击复制静默失败。
- 方案：全局 **`copyText()`** 三层保障——① 优先 `navigator.clipboard.writeText` ② 失败降级 `execCommand('copy')`（临时 textarea）③ 成功 toast 提示「📋 已复制」。

## Git

- git 仓库曾损坏，**重新初始化并强制推送**恢复（`b670f97` — UI redesign + `.gitignore`）。
- 定期小版本提交：用户会要求总结最近改动以便提交小版本更新。

相关：[[project-overview]] [[cross-platform-compat]] [[scene-ratty-and-hotzones]]
