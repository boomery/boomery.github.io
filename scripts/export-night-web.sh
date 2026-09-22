#!/usr/bin/env bash
# 从 Desktop/night 的 Godot 源码导出 Web，同步到博客 /night/，并把 pck 传到 R2。
# 不会覆盖 myblog/source/night/index.html（只改 fileSizes）。
set -euo pipefail

GODOT="${GODOT_BIN:-$HOME/Downloads/Godot.app/Contents/MacOS/Godot}"
SRC="${NIGHT_SRC:-$HOME/Desktop/night}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DST="$ROOT/myblog/source/night"
HTML="$DST/index.html"
STAGING="${NIGHT_STAGING:-${TMPDIR:-/tmp}/night-web-export}"
R2_BUCKET="${R2_BUCKET:-night}"
R2_KEY="${R2_KEY:-night.pck}"
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-45386376a7a0aa77621692787c29f98b}"
export PATH="$HOME/.nvm/versions/node/v18.20.7/bin:/opt/homebrew/bin:$PATH"

SKIP_R2=0
SKIP_EXPORT=0
for arg in "$@"; do
  case "$arg" in
    --skip-r2) SKIP_R2=1 ;;
    --skip-export) SKIP_EXPORT=1 ;;
    -h|--help)
      echo "用法: $0 [--skip-r2] [--skip-export]"
      echo "  --skip-export  不调用 Godot，只从已有 staging 同步"
      echo "  --skip-r2      不同步 Cloudflare R2（本地预览够用）"
      exit 0
      ;;
    *)
      echo "未知参数: $arg" >&2
      exit 2
      ;;
  esac
done

if [[ ! -x "$GODOT" ]]; then
  echo "找不到 Godot：$GODOT" >&2
  echo "可设置 GODOT_BIN 指向 Godot 可执行文件。" >&2
  exit 1
fi
if [[ ! -f "$SRC/project.godot" ]]; then
  echo "找不到游戏工程：$SRC" >&2
  exit 1
fi
if [[ ! -f "$HTML" ]]; then
  echo "找不到博客页面：$HTML" >&2
  exit 1
fi

if [[ "$SKIP_EXPORT" -eq 0 ]]; then
  rm -rf "$STAGING"
  mkdir -p "$STAGING"
  echo "Godot 导出 Web → $STAGING/night.html"
  "$GODOT" --headless --path "$SRC" --export-release "Web" "$STAGING/night.html"
fi

if [[ ! -f "$STAGING/night.pck" ]]; then
  echo "导出结果里没有 night.pck：$STAGING" >&2
  exit 1
fi

mkdir -p "$DST"
shopt -s nullglob
copied=0
for f in "$STAGING"/night.*; do
  base="$(basename "$f")"
  case "$base" in
    *.html|*.htm) continue ;;
  esac
  cp "$f" "$DST/$base"
  copied=$((copied + 1))
  echo "复制 $base"
done
if [[ "$copied" -eq 0 ]]; then
  echo "staging 里没有可复制的 night.* 文件" >&2
  exit 1
fi

python3 - "$HTML" "$DST" <<'PY'
import pathlib, re, sys

html_path = pathlib.Path(sys.argv[1])
dst = pathlib.Path(sys.argv[2])
pck = (dst / "night.pck").stat().st_size
wasm = (dst / "night.wasm").stat().st_size
text = html_path.read_text(encoding="utf-8")
text, n1 = re.subn(r"('night\.pck'\s*:\s*)\d+", rf"\g<1>{pck}", text)
text, n2 = re.subn(r"('night\.wasm'\s*:\s*)\d+", rf"\g<1>{wasm}", text)
text, n3 = re.subn(
    r"(GODOT_CONFIG\.fileSizes\[NIGHT_PCK\]\s*=\s*)\d+",
    rf"\g<1>{pck}",
    text,
)
html_path.write_text(text, encoding="utf-8")
print(f"fileSizes: pck={pck} wasm={wasm} (patched {n1 + n2 + n3} 处)")
PY

echo "本地已同步到 $DST"
echo "自定义封面页 index.html 已保留（仅更新体积数字）"

if [[ "$SKIP_R2" -eq 1 ]]; then
  echo "已跳过 R2 上传。本地可用 hexo server 预览。"
  exit 0
fi

if ! command -v wrangler >/dev/null 2>&1; then
  echo "找不到 wrangler，无法上传 pck 到 R2。" >&2
  echo "可再跑: $0 --skip-export    （在已安装 wrangler 后）" >&2
  exit 1
fi

echo "上传 $DST/night.pck → R2 $R2_BUCKET/$R2_KEY"
wrangler r2 object put "$R2_BUCKET/$R2_KEY" \
  --file "$DST/night.pck" \
  --content-type application/octet-stream
echo "R2 已覆盖 https://cdn.boomery.top/night.pck"
