---
title: 用 AI 和 Cursor 搭建 boomery 数字空间
date: 2026-06-11 10:00:00
categories: 技术
featured: true
tags:
  - build-log
  - AI
  - boomery
  - Cursor
---

boomery 不只是一个域名下的博客，而是一次「AI 时代个人数字空间」的落地实验。这篇 Build Log 记录：为什么选这套技术栈、如何用 Cursor 迭代、以及 push 之后如何自动上线。

<!-- more -->

## 动机：从博客到空间

传统博客解决的是「发文章」。boomery 想解决的是「**构建可浏览的数字人格**」——首页要有定位、Gallery 要有审美、About 要有原则、Now 要有生长感。技术选型必须支持：**静态站点的稳定 + 独立页面的自由度 + 低成本自动部署**。

## 技术栈

| 层级 | 选择 | 原因 |
|------|------|------|
| 生成 | Hexo 5 + Next (Mist) | 成熟、Markdown 写作、主题可定制 |
| 托管 | Vercel | 绑定 GitHub，push 即构建 |
| DNS / CDN | Cloudflare | 域名解析 + HTTPS |
| 评论 | Waline v3 + Supabase | 独立部署，数据自主 |
| 迭代 | Cursor + AI | 样式、Gallery、脚本快速试错 |

仓库结构：`hexoBlog/myblog/` 是 Vercel 的 Root Directory，执行 `npm install` → `npx hexo generate` → 输出 `public/`。

## 用 Cursor 做了什么

实际迭代路径（而非一次性设计）：

1. **首页 Hero**：`scripts/index-hero.js` 注入定位文案 + `index-anim.js` 粒子与扫描线
2. **全站视觉**：`source/_data/styles.styl` 统一流体渐变、毛玻璃、侧边栏 overlay 模式
3. **Gallery 独立页**：`source/gallery/index.html` 跳过 Hexo 渲染（`skip_render`），四种视图模式 + API 动态加载
4. **品牌 Logo**：`scripts/site-logo.js` 注入顶栏与 favicon

AI 在这里的角色是**结对编程**：提需求 → 看 diff → 硬刷新验证 → 再改。空间是「长出来的」，不是模板填出来的。

## 部署链路（摘要）

```
本地改 myblog/ → git push master → Vercel Webhook → hexo generate → boomery.top
```

注意：只改仓库根目录（如 `DEPLOY.md`）**不会**触发 Hexo 构建；改动必须在 `myblog/` 下。Git 邮箱需与 GitHub 一致，否则 Vercel 可能拒绝部署。

完整说明见仓库 [DEPLOY.md](https://github.com/boomery/hexoBlog/blob/master/DEPLOY.md)。

## 下一步

- Phase 2：「问 boomery」AI 对话 demo
- 持续更新 [Now 页](/now/) 与 Build Log 系列

这个站点本身，就是 [MVP 产品方案](/2026/05/20/AI人格化数字空间：一个-MVP-产品方案/) 的第一块落地。
