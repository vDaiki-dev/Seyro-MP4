#!/usr/bin/env bash
# Regenera los iconos de Tauri desde el SVG maestro. Sin red y sin dependencias extra.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

command -v rsvg-convert >/dev/null || { echo 'Falta rsvg-convert' >&2; exit 1; }
command -v python3 >/dev/null || { echo 'Falta python3' >&2; exit 1; }
if command -v magick >/dev/null; then
  png32=(magick)
elif command -v convert >/dev/null; then
  png32=(convert)
else
  echo 'Falta ImageMagick (magick o convert)' >&2
  exit 1
fi

source_svg="src/frontend/favicon.svg"
out_dir="src-tauri/icons"
mkdir -p "$out_dir"

for size in 32 128 256 512; do
  case "$size" in
    32) target="$out_dir/32x32.png" ;;
    128) target="$out_dir/128x128.png" ;;
    256) target="$out_dir/128x128@2x.png" ;;
    512) target="$out_dir/icon.png" ;;
  esac
  rsvg-convert -w "$size" -h "$size" "$source_svg" -o "$target"
  "${png32[@]}" "$target" "PNG32:$target"
done

python3 - "$out_dir" <<'PY'
import pathlib
import struct
import sys

out = pathlib.Path(sys.argv[1])

# ICNS: contenedor con entradas PNG, sin herramientas propietarias.
entries = [("ic07", "128x128.png"), ("ic08", "128x128@2x.png"), ("ic09", "icon.png")]
body = b""
for kind, name in entries:
    payload = (out / name).read_bytes()
    body += kind.encode("ascii") + struct.pack(">I", len(payload) + 8) + payload
(out / "icon.icns").write_bytes(b"icns" + struct.pack(">I", len(body) + 8) + body)

# ICO: dos entradas PNG (32 y 128 px), válido en Windows Vista y posterior.
images = [(32, "32x32.png"), (128, "128x128.png")]
payloads = [(size, (out / name).read_bytes()) for size, name in images]
directory = b""
offset = 6 + 16 * len(payloads)
for size, payload in payloads:
    dimension = size if size < 256 else 0
    directory += struct.pack("<BBBBHHII", dimension, dimension, 0, 0, 1, 32, len(payload), offset)
    offset += len(payload)
(out / "icon.ico").write_bytes(
    struct.pack("<HHH", 0, 1, len(payloads)) + directory + b"".join(p for _, p in payloads)
)
PY

echo "OK: iconos regenerados en $out_dir"
