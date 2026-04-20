#!/usr/bin/env bash
# export-png.sh — конвертирует HTML-лист в PNG через headless Chrome.
#
# Использование:
#   ./export-png.sh <input.html> [output.png]
#   ./export-png.sh                            # без аргументов — экспортирует все
#                                              # *.html в корне (sheet, night-order, …)
#
# Если установлен poppler (brew install poppler) — используется pdftoppm для
# максимального качества (200 DPI). Иначе — встроенный в macOS sips.

set -euo pipefail

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [[ ! -x "$CHROME" ]]; then
  CHROME="$(command -v google-chrome 2>/dev/null || command -v chromium 2>/dev/null || true)"
fi

if [[ -z "${CHROME}" ]] || [[ ! -x "${CHROME}" ]]; then
  echo "✗ Не найден Google Chrome / Chromium." >&2
  echo "  Установи Chrome или поправь путь в скрипте." >&2
  exit 1
fi

abs_path() {
  local p="$1"
  case "$p" in
    /*) printf '%s\n' "$p" ;;
    *)  printf '%s/%s\n' "$(cd "$(dirname "$p")" && pwd)" "$(basename "$p")" ;;
  esac
}

export_one() {
  local input="$1"
  local output="${2:-}"

  if [[ ! -f "$input" ]]; then
    echo "✗ Не найден файл: $input" >&2
    return 1
  fi

  local input_abs
  input_abs="$(abs_path "$input")"

  # По умолчанию складываем в generated/png/<name>.png (папка в .gitignore).
  if [[ -z "$output" ]]; then
    local out_dir="$(cd "$(dirname "$input")" && pwd)/generated/png"
    mkdir -p "$out_dir"
    output="$out_dir/$(basename "${input%.html}.png")"
  fi

  local output_abs
  output_abs="$(abs_path "$output")"
  mkdir -p "$(dirname "$output_abs")"

  local tmp_pdf
  tmp_pdf="$(mktemp -t botc_export).pdf"

  echo "→ $(basename "$input"): HTML → PDF…"
  "$CHROME" \
    --headless=new \
    --disable-gpu \
    --no-pdf-header-footer \
    --hide-scrollbars \
    --virtual-time-budget=10000 \
    --print-to-pdf="$tmp_pdf" \
    "file://$input_abs" >/dev/null 2>&1

  local pages=1
  if command -v pdfinfo >/dev/null 2>&1; then
    pages="$(pdfinfo "$tmp_pdf" 2>/dev/null | awk '/^Pages:/ {print $2; exit}')"
    pages="${pages:-1}"
  fi

  echo "→ $(basename "$input"): PDF → PNG (страниц: $pages)…"
  local output_base="${output_abs%.png}"
  local output_dir
  output_dir="$(dirname "$output_abs")"

  if command -v pdftoppm >/dev/null 2>&1; then
    if [[ "$pages" -le 1 ]]; then
      pdftoppm -r 300 -png -singlefile "$tmp_pdf" "$output_base"
      echo "✓ $(basename "$output") (pdftoppm @ 300 DPI)"
    else
      pdftoppm -r 300 -png "$tmp_pdf" "$output_base"
      # pdftoppm создаёт <base>-1.png, <base>-2.png, …
      # переименуем для короткой 1-страничной нумерации если надо — оставим как есть
      local i
      for ((i = 1; i <= pages; i++)); do
        local padded
        padded="$(printf '%d' "$i")"
        local src="${output_base}-${padded}.png"
        [[ -f "$src" ]] && echo "✓ $(basename "$src") (pdftoppm @ 300 DPI, стр. $i/$pages)"
      done
    fi
  elif command -v magick >/dev/null 2>&1; then
    if [[ "$pages" -le 1 ]]; then
      magick -density 300 "$tmp_pdf" -quality 95 "$output_abs"
      echo "✓ $(basename "$output") (ImageMagick @ 300 DPI)"
    else
      magick -density 300 "$tmp_pdf" -quality 95 "${output_base}-%d.png"
      echo "✓ ${output_base}-*.png (ImageMagick @ 300 DPI, $pages стр.)"
    fi
  elif command -v convert >/dev/null 2>&1; then
    if [[ "$pages" -le 1 ]]; then
      convert -density 300 "$tmp_pdf" -quality 95 "$output_abs"
      echo "✓ $(basename "$output") (convert @ 300 DPI)"
    else
      convert -density 300 "$tmp_pdf" -quality 95 "${output_base}-%d.png"
      echo "✓ ${output_base}-*.png (convert @ 300 DPI, $pages стр.)"
    fi
  elif command -v qlmanage >/dev/null 2>&1; then
    qlmanage -t -s 2480 -o "$output_dir" "$tmp_pdf" >/dev/null 2>&1
    mv "$output_dir/$(basename "$tmp_pdf").png" "$output_abs"
    echo "✓ $(basename "$output") (qlmanage @ ~2480 px, только 1-я страница)"
    [[ "$pages" -gt 1 ]] && echo "  ⚠ PDF содержит $pages страниц, qlmanage сохранил только первую. Установи: brew install poppler"
  else
    sips -s format png -s formatOptions best "$tmp_pdf" --out "$output_abs" >/dev/null
    echo "✓ $(basename "$output") (sips, низкое качество, только 1-я страница)"
    echo "  ⓘ для нормального качества: brew install poppler"
  fi

  rm -f "$tmp_pdf"
}

cd "$(dirname "$0")"

if [[ $# -eq 0 ]]; then
  for f in sheet.html night-order.html jinxes.html tokens-print.html; do
    [[ -f "$f" ]] && export_one "$f"
  done
else
  export_one "$@"
fi
