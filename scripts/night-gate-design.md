# 槐安夜雨入口

## 视觉方向

参考《影之刃零》单机官网 https://pbz.s-game.cn/ 的全屏叙事画面、书法标题与克制导航。未使用其图片、音频、字体或代码。入口围绕旧渡口、夜行人、冷雨和灯火设计；背景为原创生成概念图，不是游戏实机截图。

入口：`myblog/source/night/index.html`。样式：`gate.css`。动效和音频：`gate-atmosphere.js`。Godot 导出脚本仍只更新原有版本、日期和包体字段。

## 资源与许可

- `art/ferry-night.webp`：使用内置 imagegen 生成，原始 PNG 转为 WebP，1672 × 941，约 221 KB。生成提示词见下文。
- `fonts/night-calligraphy.ttf`：Ma Shan Zheng / 马善政毛笔楷体，Google Fonts 官方按需字符子集，约 11 KB。SIL OFL 1.1 授权见 `fonts/OFL.txt`。标题或按钮增加新汉字时需要更新子集。
- `vendor/gsap.min.js`：GSAP 3.12.5，保留上游授权头。https://gsap.com/standard-license/
- `vendor/howler.min.js`：Howler 2.2.4，MIT，见 `vendor/howler.LICENSE`。
- `vendor/raindrop-fx.js`：RaindropFX 1.0.8，MIT，见 `vendor/raindrop-fx.LICENSE`。只在桌面两侧叠加少量折射水滴；WebGL2 不可用时保留轻量雨层。
- `audio/rain.mp3`、`audio/title.mp3`：沿用项目既有素材。
- `audio/thunder.mp3`：Mysid 的公有领域录音 [Tonitrus.ogg](https://commons.wikimedia.org/wiki/File:Tonitrus.ogg)，2007-08-15。截取前 12 秒，淡入 0.15 秒、最后 3 秒淡出，转 MP3。雷光后延迟约 1.2–2.2 秒播放。

## 动画与运行约束

GSAP 负责分层斜雨、漂雾、低频闪电与水滴的撞击、分流、沿侧边滑落；水滴使用固定 DOM 池，循环不追加节点。Howler 只在手势后创建音频并渐入；静音状态保存在本地。雷雨可单独关闭，也遵循系统减少动态效果设置。切换标签暂停声音和动画；游戏启动成功后释放入口时间线、监听器、音频和 WebGL 资源。手机不运行玻璃折射层。

本地预览：在仓库根目录运行 `python3 -m http.server 4178 --bind 127.0.0.1 --directory myblog/source`，访问 http://127.0.0.1:4178/night/。

## 最终生成提示词（内置 imagegen）

Use case: stylized-concept. Asset type: original cinematic background for a Chinese single-player wuxia revenge game's landing page. Create an exquisitely art-directed, atmospheric realistic film still, ultra-wide landscape 16:9. Ancient riverside ferry landing at midnight in a rainstorm. A lone wandering swordsman in a soaked charcoal cloak and conical bamboo hat, seen from behind, occupies the right third, at x=72%, standing on a wet stone jetty leading toward a dilapidated Chinese wooden pavilion with elegant upturned tiled roof near the right edge. A single small vermilion lantern casts a muted warm reflection on rain-slick stones. Distant layered mountains and river fog, branches near upper right, brooding storm clouds. Strong cinematic depth, cold silver-blue mist and ink-black shadows, very desaturated palette, tiny rust-red accent. Left 45% consists of dark low-detail mist and open water, intentionally quiet negative space for large Chinese calligraphy to be typeset separately; no prominent subject on left. Rich real textures in fabric, weathered wood, wet stone. Restrained film grain, dramatic high-end historical wuxia cinema photography, tragic lonely tense atmosphere, painterly tonal control but photoreal material detail. Subtle silver backlight separates silhouette and distant architecture. No text, no letters, no logos, no UI, no borders, no watermark, no fantasy magic, no neon, no oversized moon, no lightning bolt baked into image. Broad composition with enough scenery around subject for a portrait mobile crop of the right half.

## 验证记录（2026-09-22）

- 浏览器检查：1280×720、390×844、320×568；小屏没有横向溢出，按钮在可视范围内。
- 音乐/雨声开启、静音、再次开启及雷雨开关已验证。
- 使用临时测试页模拟减少动态效果偏好，确认雷雨按钮禁用、画面静态、入口仍可使用；测试页已删除。
- JS 语法、DOM ID/脚本引用、本地资源完整性、git diff 空白检查通过。Hexo 已生成新版 night 入口且关键文件与源文件一致。
- 全站构建仍报告既有 `source/_data/styles.styl:358` 的 `$sidebar-desktop` 变量错误；本次没有改动博客主题。
- 在线 CDN 包请求在测试环境失败，入口重试界面正常。临时以本地现有 night.pck 测试，Godot 启动回调正常、入口隐藏并停止效果；游戏仍报 `res://assets/backgrounds/inn_hall.png` 等资源缺失，未验证到正常游戏画面。本次未改动游戏包或 CDN 配置。
