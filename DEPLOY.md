# 博客部署架构说明

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 博客框架 | Hexo | 静态博客生成器，主题 next |
| 部署平台 | Vercel | 自动构建并托管静态站点 |
| CDN / DNS | Cloudflare | 域名解析 + CDN加速 + HTTPS |
| 域名 | boomery.top | 通过 Cloudflare 解析到 Vercel |
| 源码仓库 | GitHub `boomery/hexoBlog` | Vercel 监听此仓库触发自动部署 |

---

## 部署流程

```
本地修改文件
    ↓
git add . && git commit -m "说明"
    ↓
git push  →  推送到 github.com/boomery/hexoBlog
    ↓
Vercel 自动检测到新提交，触发构建
    ↓
Vercel 执行：npm install → npx hexo generate
    ↓
将 public/ 目录部署为静态站点
    ↓
Cloudflare 解析 boomery.top → Vercel 站点
```

---

## 关键配置

### Git 远程仓库
```
remote: https://github.com/boomery/hexoBlog.git
branch: master
```

### Vercel 构建配置（vercel.json）
```json
{
  "buildCommand": "npx hexo generate",
  "outputDirectory": "public",
  "installCommand": "npm install",
  "framework": null
}
```

### Git 本地用户配置
```
user.name  = boomery
user.email = 765007045@qq.com  （需与 GitHub 账号邮箱一致，否则 Vercel 部署会被 Block）
```

---

## 目录结构

```
hexoBlog/               ← 本地项目根目录（Git 仓库根）
├── myblog/             ← Hexo 项目目录
│   ├── source/         ← 博客文章（.md 文件放在 _posts/ 下）
│   ├── themes/         ← 主题目录（当前使用 next）
│   ├── public/         ← hexo generate 生成的静态文件（部署产物）
│   ├── _config.yml     ← Hexo 配置文件
│   └── vercel.json     ← Vercel 构建配置
└── DEPLOY.md           ← 本文件
```

---

## 注意事项

1. **不要用 `hexo deploy`**：当前走 Vercel 自动部署，无需执行 hexo deploy 命令
2. **推送目标仓库必须是 `hexoBlog`**：`boomery.github.io` 是旧的 GitHub Pages 仓库，Vercel 不监听
3. **git 邮箱必须设置**：邮箱为空或 Unknown 时 Vercel 会拒绝部署
4. **Cloudflare SSL 模式**：建议设置为 Full，避免与 Vercel 的 HTTPS 冲突

---

## 常用命令

```bash
# 本地预览
cd myblog && npx hexo server

# 新建文章
cd myblog && npx hexo new "文章标题"

# 推送更新（触发 Vercel 自动部署）
git add . && git commit -m "update" && git push
```
