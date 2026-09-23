#!/usr/bin/env bash
# 从 Desktop/night 的 Godot 源码导出 Web，同步到博客 /night/，并把 pck 传到 R2。
# 不会覆盖 myblog/source/night/index.html（只改 fileSizes、版本号与更新时间）。
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

GAME_VERSION="$(grep -E '^config/version=' "$SRC/project.godot" | head -1 | sed -E 's/^config\/version="?([^"]*)"?$/\1/')"
GAME_VERSION="${GAME_VERSION:-0.0.0}"

python3 - "$HTML" "$DST" "$GAME_VERSION" <<'PY'
import pathlib, re, sys
from datetime import datetime, timedelta, timezone

html_path = pathlib.Path(sys.argv[1])
dst = pathlib.Path(sys.argv[2])
version = sys.argv[3]
built = datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d %H:%M")
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

def put_const(name, value, src):
    return re.subn(
        rf"(const {name}\s*=\s*')[^']*(')",
        lambda m, v=value: m.group(1) + v + m.group(2),
        src,
        count=1,
    )

text, n4 = put_const("NIGHT_GAME_VERSION", version, text)
text, n5 = put_const("NIGHT_BUILT_AT", built, text)
text, n6 = re.subn(r'(id="nightGameVer">)[^<]*', lambda m: m.group(1) + "v" + version, text, count=1)
text, n7 = re.subn(r'(id="nightBuiltAt">)[^<]*', lambda m: m.group(1) + built, text, count=1)
bust = f"{version}-{pck}"
text, n8 = re.subn(
    r"(const NIGHT_PCK\s*=\s*'https://cdn\.boomery\.top/night\.pck)(?:\?v=[^']*)?(')",
    lambda m: m.group(1) + f"?v={bust}" + m.group(2),
    text,
    count=1,
)
html_path.write_text(text, encoding="utf-8")
print(f"fileSizes: pck={pck} wasm={wasm} (patched {n1 + n2 + n3} 处)")
print(f"build meta: v{version} @ {built} (patched {n4 + n5 + n6 + n7} 处)")
print(f"pck url bust: ?v={bust} (patched {n8} 处)")
PY

python3 - "$DST/night.js" <<'PY'
import pathlib, re, sys
path = pathlib.Path(sys.argv[1])
js = path.read_text(encoding="utf-8")
safe_copy = ('copy_to_fs:function(path,buffer){const idx=path.lastIndexOf("/");let dir="/";if(idx>0){dir=path.slice(0,idx)}try{FS.stat(dir)}catch(e){if(e.errno!==GodotFS.ENOENT){GodotRuntime.error(e)}FS.mkdirTree(dir)}const src=buffer instanceof ArrayBuffer?new Uint8Array(buffer,0,buffer.byteLength):ArrayBuffer.isView(buffer)?new Uint8Array(buffer.buffer,buffer.byteOffset,buffer.byteLength):new Uint8Array(buffer);function report(loaded){const fn=globalThis.NightPackProgress;if(typeof fn==="function"){try{fn(loaded,src.length)}catch(err){}}}function commit(owned){FS.writeFile(path,owned,{canOwn:true});var stream=null;try{if(owned.length<4)return;stream=FS.open(path,"r");var head=new Uint8Array(4);var n=FS.read(stream,head,0,4,0);if(n===4&&head[0]===owned[0]&&head[1]===owned[1]&&head[2]===owned[2]&&head[3]===owned[3])return}catch(err){}finally{if(stream){try{FS.close(stream)}catch(err){}}}FS.writeFile(path,owned.slice())}if(src.length<=1048576){const small=src.slice();report(src.length);commit(small);return}return new Promise(function(resolve,reject){let owned=null;let offset=0;let settled=false;const chunk=2097152;function later(fn){var done=false;function go(){if(done)return;done=true;fn()}if(typeof requestAnimationFrame==="function"){requestAnimationFrame(function(){setTimeout(go,0)})}setTimeout(go,32)}function pump(){try{const end=Math.min(offset+chunk,src.length);owned.set(src.subarray(offset,end),offset);offset=end;report(offset);if(offset<src.length){later(pump);return}commit(owned);report(src.length);later(resolve)}catch(err){reject(err)}}function allocated(bytes){if(settled)return;settled=true;owned=bytes;report(0);later(pump)}function begin(){report(0);try{const url=URL.createObjectURL(new Blob(["self.onmessage=function(ev){var bytes=new Uint8Array(ev.data);self.postMessage(bytes.buffer,[bytes.buffer]);}"],{type:"application/javascript"}));const worker=new Worker(url);worker.onmessage=function(ev){worker.terminate();URL.revokeObjectURL(url);allocated(new Uint8Array(ev.data))};worker.onerror=function(){worker.terminate();URL.revokeObjectURL(url);allocated(new Uint8Array(src.length))};worker.postMessage(src.length)}catch(err){allocated(new Uint8Array(src.length))}}later(begin)})}')
stock_copy = (
    "copy_to_fs:function(path,buffer){const idx=path.lastIndexOf(\"/\");let dir=\"/\";if(idx>0){dir=path.slice(0,idx)}"
    "try{FS.stat(dir)}catch(e){if(e.errno!==GodotFS.ENOENT){GodotRuntime.error(e)}FS.mkdirTree(dir)}"
    "FS.writeFile(path,new Uint8Array(buffer))}"
)
shared_copy = (
    "copy_to_fs:function(path,buffer){const idx=path.lastIndexOf(\"/\");let dir=\"/\";if(idx>0){dir=path.slice(0,idx)}"
    "try{FS.stat(dir)}catch(e){if(e.errno!==GodotFS.ENOENT){GodotRuntime.error(e)}FS.mkdirTree(dir)}"
    "FS.writeFile(path,buffer instanceof ArrayBuffer?new Uint8Array(buffer,0,buffer.byteLength):ArrayBuffer.isView(buffer)?new Uint8Array(buffer.buffer,buffer.byteOffset,buffer.byteLength):new Uint8Array(buffer),{canOwn:true})}"
)
if "globalThis.NightPackProgress" in js:
    print("night.js 行囊写入会分段推进进度")
elif """function commit(owned){FS.writeFile(path,owned)}""" in js and stock_copy not in js:
    raise SystemExit("night.js 仍是旧的整包写入，请先同步 copy_to_fs")
elif stock_copy in js:
    js = js.replace(stock_copy, safe_copy, 1)
    print("night.js 已改为独立复制行囊")
elif shared_copy in js:
    js = js.replace(shared_copy, safe_copy, 1)
    print("night.js 已从共享内存改为独立复制")
else:
    raise SystemExit("night.js 的 copy_to_fs 变了，行囊补丁对不上")
stock_drop = "const files=[];FS.mkdir(DROP.slice(0,-1));GodotInputDragDrop.pending_files.forEach(elem=>{const path=elem[\"path\"];GodotFS.copy_to_fs(DROP+path,elem[\"data\"]);"
safe_drop = "const files=[];const copies=[];FS.mkdir(DROP.slice(0,-1));GodotInputDragDrop.pending_files.forEach(elem=>{const path=elem[\"path\"];copies.push(Promise.resolve(GodotFS.copy_to_fs(DROP+path,elem[\"data\"])));"
if "copies.push(Promise.resolve(GodotFS.copy_to_fs" in js:
    print("night.js 拖放已等待行囊写入")
elif stock_drop in js:
    js = js.replace(stock_drop, safe_drop, 1)
    js = js.replace(
        "GodotInputDragDrop.promises=[];GodotInputDragDrop.pending_files=[];callback(drops);if(GodotConfig.persistent_drops){GodotOS.atexit(function(resolve,reject){GodotInputDragDrop.remove_drop(files,DROP);resolve()})}else{GodotInputDragDrop.remove_drop(files,DROP)}",
        "GodotInputDragDrop.promises=[];GodotInputDragDrop.pending_files=[];Promise.all(copies).then(function(){callback(drops);if(GodotConfig.persistent_drops){GodotOS.atexit(function(resolve,reject){GodotInputDragDrop.remove_drop(files,DROP);resolve()})}else{GodotInputDragDrop.remove_drop(files,DROP)}})",
        1,
    )
    print("night.js 拖放会等行囊写入完成")
else:
    raise SystemExit("night.js 的拖放写入变了，补丁对不上")
stock_start = """return new Promise(function (resolve, reject) {
						for (const file of preloader.preloadedFiles) {
							me.rtenv['copyToFS'](file.path, file.buffer);
						}
						preloader.preloadedFiles.length = 0; // Clear memory
						me.rtenv['callMain'](me.config.args);
						initPromise = null;
						me.installServiceWorker();
						resolve();
					});"""
safe_start = """return new Promise(function (resolve, reject) {
						const files = preloader.preloadedFiles.slice();
						const writeNext = function (index) {
							if (index >= files.length) {
								preloader.preloadedFiles.length = 0;
								try {
									me.rtenv['callMain'](me.config.args);
								} catch (err) {
									reject(err);
									return;
								}
								initPromise = null;
								me.installServiceWorker();
								resolve();
								return;
							}
							Promise.resolve(me.rtenv['copyToFS'](files[index].path, files[index].buffer)).then(function () {
								writeNext(index + 1);
							}).catch(reject);
						};
						writeNext(0);
					});"""
if "const writeNext = function (index)" in js:
    print("night.js 启动会等行囊写入完成")
elif stock_start in js:
    js = js.replace(stock_start, safe_start, 1)
    print("night.js 启动改为等行囊写入后再进入游戏")
else:
    raise SystemExit("night.js 的启动流程变了，补丁对不上")
preload_pat = re.compile(
    r"\} else if \(pathOrBuffer instanceof ArrayBuffer\) \{\s*"
    r"buffer = new Uint8Array\(pathOrBuffer\);\s*"
    r"\} else if \(ArrayBuffer\.isView\(pathOrBuffer\)\) \{\s*"
    r"buffer = new Uint8Array\(pathOrBuffer\.buffer\);\s*"
    r"\}"
)
new_preload = (
    "} else if (pathOrBuffer instanceof ArrayBuffer || ArrayBuffer.isView(pathOrBuffer)) {\n"
    "\t\t\tbuffer = pathOrBuffer;\n"
    "\t\t}"
)
if "pathOrBuffer instanceof ArrayBuffer || ArrayBuffer.isView(pathOrBuffer)" in js:
    print("night.js 预加载已避免整包拷贝")
else:
    js, n = preload_pat.subn(new_preload, js, count=1)
    if n != 1:
        raise SystemExit("night.js 的 preload 变了，去拷贝补丁对不上")
    print("night.js 预加载已去掉整包拷贝")
path.write_text(js, encoding="utf-8")
PY

echo "本地已同步到 $DST"
echo "自定义封面页 index.html 已保留（仅更新体积数字、版本与时间）"

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
  --content-type application/octet-stream \
  --cache-control "public, max-age=300"
echo "R2 已覆盖 https://cdn.boomery.top/night.pck"
