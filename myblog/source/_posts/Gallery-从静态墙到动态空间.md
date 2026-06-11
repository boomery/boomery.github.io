---
title: Gallery：从静态墙到动态空间
date: 2026-06-11 11:00:00
categories: 技术
featured: true
tags:
  - build-log
  - AI
  - boomery
  - Gallery
---

MVP 方案里写：数字人格需要「审美的具象化」。Gallery 就是 boomery 这一层的载体——不是图床，而是**人格的外显层**。这篇记录它如何从静态 HTML 演进到四种视图 + 动态 API。

<!-- more -->

## 设计意图：四种视图 = 四种表达

| 模式 | 体验 | 表达 |
|------|------|------|
| 飘落 | 全屏粒子背景 + 缓慢下落 | 沉浸、诗意 |
| 柱廊 | 3D 绕轴自转，可拨转 | 展览、凝视 |
| 胶片 | 横向 scroll-snap | 叙事、连续 |
| 网格 | 整页单滚动平铺 | 浏览、检索 |

模式偏好存入 `localStorage`，灯箱浏览全模式共用。网格模式刻意避免「容器内滚动 + 页面滚动」的双层冲突——展开为整页单滚动，顶栏 sticky。

## 架构：前端 + Serverless API

```
gallery/index.html
    ↓ GET /api/photos
    ↓ POST /api/upload（需密码）
gallery-api/（Vercel 独立项目，Root: gallery-api）
    ├── 图片 → Cloudinary
    └── 元数据 → Neon gallery_photos 表
```

Gallery 页在 `_config.yml` 中配置了 `skip_render`，Hexo 不会用主题模板覆盖这份独立 HTML，从而保留完全自定义的交互与样式。

## 与 MVP 的对应关系

MVP 文章定义的三层空间：

- **认知层** → 博客 Tech / About / Now
- **审美层** → Gallery（本篇）
- **互动层** → Waline 评论 + 未来 AI 对话

Gallery 顶部的策展引言说明：每一张图都是 boomery 审美判断的切片，tag 分布反映当前主题倾向——这是「人格」而非「相册」。

## 工程细节

- 右下角「＋」上传：先调 `/api/auth` 校验密码，再打开上传面板
- 柱廊模式用 CSS 3D `rotateY` + `translateZ`，Pointer 事件实现惯性拨转
- 视觉对齐首页：浅色玻璃拟态、蓝紫主色、`boomery-logo` 品牌锚点

## 亲自看看

打开 [/gallery/](/gallery/)，切换四种模式。若你有管理员密码，可以在线上传——空间会随内容生长。

相关阅读：[用 AI 和 Cursor 搭建 boomery 数字空间](/2026/06/11/用-AI-和-Cursor-搭建-boomery-数字空间/)、[MVP 产品方案](/2026/05/20/AI人格化数字空间：一个-MVP-产品方案/)。
