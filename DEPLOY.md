# 博客部署架构说明

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 博客框架 | Hexo | 静态博客生成器，主题 next |
| 部署平台 | Vercel | 自动构建并托管静态站点 |
| CDN / DNS | Cloudflare | 域名解析 + CDN加速 + HTTPS |
| 域名 | boomery.top | 通过 Cloudflare 解析到 Vercel |
| 源码仓库 | GitHub `boomery/hexoBlog` | Vercel 监听此仓库触发自动部署 |
| 评论系统 | Waline v3 | 独立部署在 Vercel，数据库用 Supabase |

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

## 评论系统（Waline）

### 架构
```
博客前端（boomery.top）
    ↓ 调用
comment.boomery.top  ←  Cloudflare DNS only（灰色云朵）
    ↓ 指向
Vercel 项目：walinecomment（walinecomment-ten.vercel.app）
    ↓ 连接
Supabase PostgreSQL 数据库
```

### Vercel 环境变量（walinecomment 项目）

| 变量名 | 值 |
|--------|---|
| `PG_HOST` | Supabase 连接池地址（pooler） |
| `PG_PORT` | `6543` |
| `PG_DB` | `postgres` |
| `PG_USER` | `postgres` |
| `PG_PASSWORD` | （Supabase 数据库密码） |
| `PG_PREFIX` | `wl_` |
| `PG_SSL` | `true` |

### Cloudflare DNS 配置

| 类型 | 名称 | 目标 | 代理状态 |
|------|------|------|---------|
| CNAME | `comment` | Vercel 提供的 DNS 地址 | **DNS only（灰色云朵）** |

> ⚠️ comment 子域名必须设为 **DNS only**，不能开启 Cloudflare 代理，否则会报 SSL 525 错误。

### 博客配置（themes/next/_config.yml）
```yaml
waline:
  enable: true
  serverURL: https://comment.boomery.top
```

---

## Supabase 数据表

Waline 使用以下三张表（首次部署自动创建）：
- `wl_comment` — 评论内容
- `wl_counter` — 页面访问计数
- `wl_users` — 用户信息

---

## 目录结构

```
hexoBlog/               ← 本地项目根目录（Git 仓库根）
├── myblog/             ← Hexo 项目目录
│   ├── source/         ← 博客文章（.md 文件放在 _posts/ 下）
│   │   └── gallery/    ← 图片展示墙独立 HTML 页面
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
4. **Cloudflare SSL 模式**：整站设置为 Full，避免与 Vercel 的 HTTPS 冲突
5. **comment 子域名不开代理**：`comment.boomery.top` 的 Cloudflare DNS 必须为灰色云朵（DNS only）
6. **gallery 页面跳过渲染**：`_config.yml` 中 `skip_render: gallery/index.html`，防止主题覆盖独立 HTML

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

---

## 图片展示墙（Gallery）

路径：`myblog/source/gallery/index.html`

图片数据现在通过 **API 动态加载**，不再硬编码。页面右下角有悬浮「＋」按钮，输入管理员密码后即可在线上传图片。

### 架构

```
gallery/index.html（浏览器）
    ↓ GET /api/photos（读取列表）
    ↓ POST /api/upload（上传图片）
gallery-api/（Vercel Serverless Functions 项目）
    ├── 图片文件  → Cloudinary Storage
    └── 图片元数据 → Neon gallery_photos 表
```

### gallery-api Vercel 项目

源码位于仓库的 `gallery-api/` 子目录，作为独立 Vercel 项目部署。

**Vercel 环境变量（gallery-api 项目）**

| 变量名 | 说明 |
|--------|------|
| `DATABASE_URL` | Neon 连接字符串（同 Waline 用的数据库，或单独） |
| `UPLOAD_PASSWORD` | 上传时需要的管理员密码（自行设定） |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary 控制台 Cloud Name |
| `CLOUDINARY_API_KEY` | Cloudinary API Key |
| `CLOUDINARY_API_SECRET` | Cloudinary API Secret |

**Cloudflare DNS 配置**

| 类型 | 名称 | 目标 | 代理状态 |
|------|------|------|---------|
| CNAME | `gallery-api` | Vercel 提供的 DNS 地址 | **DNS only（灰色云朵）** |

> `gallery-api.boomery.top` 同样需要设为 DNS only，避免 SSL 525。

**gallery/index.html 中的 API 地址**

```javascript
const API_BASE = 'https://gallery-api.boomery.top'; // 顶部常量，按需修改
```

### Neon 初始化 SQL

在 Neon 控制台执行一次：

```sql
CREATE TABLE IF NOT EXISTS gallery_photos (
  id         SERIAL PRIMARY KEY,
  src        TEXT         NOT NULL,
  title      VARCHAR(100) NOT NULL DEFAULT '',
  tag        VARCHAR(50)  NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

### 部署步骤（首次）

1. 注册 [Cloudinary](https://cloudinary.com)，获取 Cloud Name / API Key / API Secret
2. 在 Neon 控制台执行上方建表 SQL
3. 在 Vercel 新建项目 → 选仓库 `hexoBlog` → **Root Directory 设为 `gallery-api`**
4. 填写以上 5 个环境变量，部署
5. 在 Cloudflare 添加 CNAME `gallery-api` → Vercel DNS，设为 DNS only
6. `git push` 触发主博客重新部署（gallery 页面会自动用新 API 地址）
