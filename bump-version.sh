#!/bin/sh
# 公開ページでブラウザの古いキャッシュが使われないよう、読み込むファイルのバージョン番号を更新する
V=$(date +%Y%m%d%H%M)
sed -i -E "s#(js/main\.js|js/ads\.js|style\.css)(\?v=[0-9]+)?\"#\1?v=$V\"#g" index.html
sed -i -E "s#'\./(models|world|audio|i18n)\.js(\?v=[0-9]+)?'#'./\1.js?v=$V'#g" js/main.js js/world.js
echo "version $V"
