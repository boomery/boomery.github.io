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
git add / commit / push  →  推送到 github.com/boomery/hexoBlog（master）
    ↓
GitHub 接收新提交
    ↓
Vercel 通过 Webhook 检测到 push，自动创建一次 Deployment
    ↓
Vercel 在 Root Directory（myblog/）内执行构建
    ├── npm install          ← 安装 package.json 依赖
    └── npx hexo generate    ← 生成静态站点到 public/
    ↓
Vercel 将 public/ 发布为静态站点
    ↓
Cloudflare 解析 boomery.top → Vercel 站点（通常 1～2 分钟内生效）
```

---

## Push 触发部署：完整动作说明

以下说明「在 Cursor 中改完代码并 push」后，本地与云端分别会发生什么。

### 一、本地 Git 操作（push 前）

在仓库根目录 `/hexoBlog` 执行，典型顺序如下：

| 步骤 | 命令 / 动作 | 说明 |
|------|-------------|------|
| 1 | `git status` | 查看哪些文件被修改、哪些是未跟踪文件 |
| 2 | `git diff` | 确认本次改动内容，避免误提交无关文件 |
| 3 | `git log -3 --oneline` | 参考近期提交信息风格 |
| 4 | `git add <文件…>` | **只添加与本次改动相关的文件**（例如 `myblog/source/`、`myblog/scripts/`、`myblog/themes/next/_config.yml`） |
| 5 | `git commit -m "…"` | 写清本次改动目的；提交说明建议使用中文 |
| 6 | `git push origin master` | 推送到 GitHub 远程 `master` 分支 |
| 7 | `git status` | 确认 push 成功、工作区干净 |

**不会自动 push 的内容（需注意）：**

- 未 `git add` 的文件（如本地临时文件、`gallery-api/api/auth.js` 若未纳入提交则不会上线）
- 含密钥的文件（`.env`、数据库密码、Cloudinary Secret 等）——**禁止提交**
- 仅存在于本地的 `myblog/public/`（由构建生成，一般不提交）

**提交作者要求：**

- Git 配置的 `user.email` 需与 GitHub 账号邮箱一致，否则 Vercel 可能拒绝部署（见下方「注意事项」）

### 二、GitHub 侧

| 动作 | 说明 |
|------|------|
| 接收 push | 远程仓库 `boomery/hexoBlog` 的 `master` 分支更新 |
| 触发 Webhook | GitHub 通知已绑定的 Vercel 项目「有新 commit」 |

### 三、Vercel 自动构建（主博客项目）

Vercel 项目绑定仓库 `hexoBlog`，**Root Directory 为 `myblog`**，读取 `myblog/vercel.json`：

| 阶段 | Vercel 执行内容 |
|------|-----------------|
| Install | `npm install` — 安装 Hexo、Next 主题、Waline 等依赖 |
| Build | `npx hexo generate` — 编译 Markdown、注入自定义脚本/样式，输出到 `public/` |
| Output | 将 `public/` 作为静态资源部署到 Vercel CDN |
| 域名 | 生产环境绑定 `boomery.top`（经 Cloudflare CNAME 指向 Vercel） |

构建过程中会生效的典型改动：

- `myblog/source/_posts/` — 文章增删改
- `myblog/source/_data/styles.styl` — 全站自定义样式
- `myblog/source/gallery/index.html` — Gallery 独立页（`skip_render` 原样拷贝）
- `myblog/source/night/index.html` — 夜行镖游戏页（`skip_render` 原样拷贝；pck 需 CDN）
- `myblog/scripts/*.js` — Hexo 插件脚本（如首页 Hero 注入、自动摘要）
- `myblog/themes/next/_config.yml` — 主题配置

### 四、部署完成后的验证

1. 打开 [Vercel Dashboard](https://vercel.com) → 对应项目 → **Deployments**，确认最新一条为 **Ready**
2. 浏览器访问 `https://boomery.top`，**硬刷新**（Mac：`Cmd+Shift+R`）避免缓存
3. 若样式/脚本未更新，可再等 1～2 分钟或清 Safari/Chrome 缓存后重试

### 五、与主博客 push 无关的项目

| 项目 | 触发方式 | 说明 |
|------|----------|------|
| **主博客** `boomery.top` | push `hexoBlog` → `master` | Root Directory = `myblog` |
| **Gallery API** `gallery-api.boomery.top` | 修改 `gallery-api/` 并 push 同一仓库 | Vercel **独立项目**，Root Directory = `gallery-api` |
| **Waline 评论** `comment.boomery.top` | 修改 Waline 项目代码并 push | 独立 Vercel 项目，与 Hexo push 无关 |

> 只改 `gallery-api/` 时：会触发 gallery-api 的 Vercel 部署；**不会**自动重新构建 Hexo，除非同时改了 `myblog/` 并 push。

### 六、常用 push 示例

```bash
# 在仓库根目录
cd /path/to/hexoBlog

# 查看状态
git status
git diff

# 仅提交博客相关改动（示例）
git add myblog/source/_data/styles.styl myblog/scripts/index-hero.js
git commit -m "$(cat <<'EOF'
feat: 首页科幻感动态效果

新增 Hero 粒子动画与扫描线，提交说明用中文描述改动目的。
EOF
)"
git push origin master
```

```bash
# 推送更新（最简写法，触发 Vercel 自动部署）
git add . && git commit -m "update" && git push origin master
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
├── myblog/             ← Hexo 项目目录（Vercel 主博客 Root Directory）
│   ├── source/         ← 博客文章（.md 文件放在 _posts/ 下）
│   │   ├── _data/      ← 自定义样式 styles.styl 等
│   │   ├── gallery/    ← 图片展示墙独立 HTML 页面
│   │   ├── space/      ← 数字空间独立 HTML 页面
│   │   └── night/      ← 夜行镖 Godot Web 游戏（pck 体积过大，不入库）
│   ├── scripts/        ← Hexo 扩展脚本（首页 Hero、自动摘要等）
│   ├── themes/         ← 主题目录（当前使用 next）
│   ├── public/         ← hexo generate 生成的静态文件（部署产物，一般不提交）
│   ├── _config.yml     ← Hexo 配置文件
│   └── vercel.json     ← Vercel 构建配置
├── gallery-api/        ← Gallery API（独立 Vercel 项目，Root Directory = gallery-api）
└── DEPLOY.md           ← 本文件
```

---

## 注意事项

1. **不要用 `hexo deploy`**：当前走 Vercel 自动部署，无需执行 hexo deploy 命令
2. **推送目标仓库必须是 `hexoBlog`**：`boomery.github.io` 是旧的 GitHub Pages 仓库，Vercel 不监听
3. **git 邮箱必须设置**：邮箱为空或 Unknown 时 Vercel 会拒绝部署
4. **Cloudflare SSL 模式**：整站设置为 Full，避免与 Vercel 的 HTTPS 冲突
5. **comment 子域名不开代理**：`comment.boomery.top` 的 Cloudflare DNS 必须为灰色云朵（DNS only）
6. **独立 HTML 跳过渲染**：`_config.yml` 中 `skip_render` 包含 `gallery/index.html`、`space/index.html`、`night/**`，防止主题或 Nunjucks 覆盖独立页面 / 游戏脚本

---

## 常用命令

```bash
# 本地预览
cd myblog && npx hexo server

# 新建文章
cd myblog && npx hexo new "文章标题"

# 本地生成静态文件（不部署，仅调试）
cd myblog && npx hexo generate
```

> 线上部署只需 `git push`，无需在本地执行 `hexo generate` 后再手动上传；Vercel 会在云端自动执行构建。

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

CREATE TABLE IF NOT EXISTS site_avatar (
  id         INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  src        TEXT         NOT NULL,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS night_seals (
  token_hash TEXT PRIMARY KEY,
  active_slot INTEGER NOT NULL DEFAULT 1,
  slots JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**API 端点**

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/photos` | GET | Gallery 图片列表 |
| `/api/upload` | POST | Gallery 上传（需密码） |
| `/api/auth` | POST | 密码预校验 |
| `/api/avatar` | GET | 数字空间头像 URL |
| `/api/avatar` | POST | 上传/更新头像（同 UPLOAD_PASSWORD） |
| `/api/night-saves` | GET | 凭印信取回夜行镖云存档 |
| `/api/night-saves` | PUT | 写入夜行镖云存档（按印信哈希隔离，不存明文） |

### 部署步骤（首次）

1. 注册 [Cloudinary](https://cloudinary.com)，获取 Cloud Name / API Key / API Secret
2. 在 Neon 控制台执行上方建表 SQL
3. 在 Vercel 新建项目 → 选仓库 `hexoBlog` → **Root Directory 设为 `gallery-api`**
4. 填写以上 5 个环境变量，部署
5. 在 Cloudflare 添加 CNAME `gallery-api` → Vercel DNS，设为 DNS only
6. `git push` 触发主博客重新部署（gallery 页面会自动用新 API 地址）

---

## 夜行镖 Web 游戏（/night/）

Godot 网页导出，页面路径：`myblog/source/night/`，访问地址：`https://boomery.top/night/`。

接入方式与 Gallery 相同：独立 HTML + `skip_render`，不走主题布局。文件已改成 ASCII 名（`night.js` / `night.wasm` / `night.pck`），避免中文文件名在 CDN 上出问题。

### 体积限制（必须分开托管 .pck）

| 文件 | 约 | 能否放进本仓库 / Vercel |
|------|----|-------------------------|
| `night.js`、HTML、图标 | < 2MB | 可以 |
| `night.wasm` | 36MB | 可以（低于 GitHub 100MB 上限） |
| `night.pck` | **140MB** | **不可以**。GitHub 单文件上限 100MB，Vercel Hobby 也是 100MB |

`.pck` 已在 `myblog/.gitignore` 中排除。本地预览时文件仍会复制到 `source/night/night.pck`，`npx hexo server` 可以玩。

### 线上要能玩：pck 已放到 Cloudflare R2

桶名 `night`，位置 APAC，自定义域 `cdn.boomery.top` 已绑定。当前地址：

```js
const NIGHT_PCK = 'https://cdn.boomery.top/night.pck';
```

CORS 已允许 `https://boomery.top`、`https://www.boomery.top`、`http://localhost:4000` 的 GET/HEAD。

若希望 140MB 文件被 Cloudflare 边缘缓存，在 Cloudflare → Rules → Cache Rules 为 `cdn.boomery.top` 开启 Cache Everything。浏览器 HTTP 缓存装不下整包 pck，页面会用 Service Worker（`/night/sw.js`）把 `night.pck` / `night.wasm` 写入 Cache Storage，同一浏览器再次进入从本机读取。

### 印信云存档（换机）

每个浏览器仍有一份 IndexedDB 本地档。换机靠印信：

- 格式 `HXNY-XXXX-XXXX`（排除易混字符 0/1/I/O）
- 游戏内行囊 → 存档管理：抄录印信 / 凭印信取档
- 本地 `save_game()` 后约 2 秒上传到 `https://gallery-api.boomery.top/api/night-saves`
- 服务端只存 `SHA-256(night-seal-v1:` + 印信 `)`，不存明文

游戏逻辑改的是 Godot 源码（`Desktop/night`），不是已经导出的 `web/`。改完后在本仓库根目录执行：

```bash
bash scripts/export-night-web.sh
```

会无头导出 Web、同步到 `myblog/source/night/`（**不覆盖**自定义 `index.html`，只更新 `fileSizes`），并把 `night.pck` 传到 R2。本地预览可加 `--skip-r2`。

Godot 源码仓库是独立的 `boomery/NightEscort`（`Desktop/night`，分支 `main`）。从博客对话里改完源码后会自动 commit/push 该仓库，再跑上面的导出。
