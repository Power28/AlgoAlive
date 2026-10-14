"""把 capture.mjs 錄下的影格組成 GIF：依真實時間差設定每格延遲，使用統一調色盤避免閃色。

用法：python scripts/make_gif.py <frames_dir> <out.gif> <width>
需求：Pillow（pip install pillow）
"""
import json
import sys
from pathlib import Path

from PIL import Image

frames_dir, out, width = Path(sys.argv[1]), sys.argv[2], int(sys.argv[3])
MIN_GAP = 0.04      # 兩格最小間隔（秒），約 25fps，過密的影格合併掉
END_HOLD_MS = 2500  # 最後畫面停留時間

meta = json.loads((frames_dir / "frames.json").read_text())

# 依時間間隔挑影格：保留「距離上一個保留影格 >= MIN_GAP」的影格
kept = [meta[0]]
for f in meta[1:-1]:
    if f["t"] - kept[-1]["t"] >= MIN_GAP:
        kept.append(f)
kept.append(meta[-1])


def load(f):
    im = Image.open(f["file"]).convert("RGB")
    if im.width != width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    return im


images = [load(f) for f in kept]

# 統一調色盤：從頭、中、尾幾張影格拼起來量化
picks = sorted({0, len(images) // 4, len(images) // 2, 3 * len(images) // 4, len(images) - 1})
samples = [images[i] for i in picks]
sheet = Image.new("RGB", (width, sum(im.height for im in samples)))
y = 0
for im in samples:
    sheet.paste(im, (0, y))
    y += im.height
palette = sheet.quantize(colors=255, method=Image.Quantize.MEDIANCUT)

pframes = [im.quantize(palette=palette, dither=Image.Dither.NONE) for im in images]

durations = []
for a, b in zip(kept, kept[1:]):
    # GIF 延遲以 10ms 為單位，且瀏覽器會把 < 20ms 當成 100ms，因此至少 20ms
    durations.append(max(20, round((b["t"] - a["t"]) * 100) * 10))
durations.append(END_HOLD_MS)

pframes[0].save(out, save_all=True, append_images=pframes[1:], duration=durations, loop=0, optimize=False, disposal=1)
print(f"  {len(pframes)} frames, {sum(durations) / 1000:.1f}s, {Path(out).stat().st_size / 1024:.0f} KB")
