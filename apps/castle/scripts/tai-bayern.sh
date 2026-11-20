#!/usr/bin/env bash
# TẢI DỮ LIỆU ĐO ĐẠC MỞ CỦA BAVARIA cho ô chứa lâu đài (Bayerische Vermessungsverwaltung, geodaten.bayern.de/opengeodata, CC BY 4.0) — 20/11/2026.
# Neuschwanstein: UTM32 E 631637 · N 5268615 → ô 1 km 631_5268, ô LoD2 2 km 630_5268. Tệp lớn (≈ 70 MB) không vào git; chạy lại lệnh này để có.
set -euo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")/../du-lieu-goc/bayern" && pwd)"
tai() { [ -s "$D/$1" ] || curl -fsS -m 600 -o "$D/$1" "$2"; ls -la "$D/$1" | awk '{print $5, $9}'; }
tai lod2-630_5268.gml      https://download1.bayernwolke.de/a/lod2/citygml/630_5268.gml           # mô hình nhà LoD2 (214 mặt mái của lâu đài)
tai dom20-32631_5268.tif   https://download1.bayernwolke.de/a/dom20/DOM/32631_5268_20_DOM.tif     # mặt trên 20 cm
tai dop20-32631_5268.tif   https://download1.bayernwolke.de/a/dop20/data/32631_5268.tif           # ảnh trực giao 20 cm (sân trước cổng, mép rừng)
tai dgm1-631_5268.tif      https://download1.bayernwolke.de/a/dgm/dgm1/631_5268.tif               # địa hình 1 m
