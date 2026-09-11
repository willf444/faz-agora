#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(python3 -c 'import json, pathlib, sys; print(json.loads(pathlib.Path(sys.argv[1]).read_text())["expo"]["version"])' "$PROJECT_DIR/app.json")"
OUTPUT_DIR="$PROJECT_DIR/dist"
BUILD_DIR="$(mktemp -d /tmp/faz-agora-deb.XXXXXX)"
PACKAGE_ROOT="$BUILD_DIR/faz-agora_${VERSION}_all"

cleanup() {
  rm -rf -- "$BUILD_DIR"
}
trap cleanup EXIT

cd "$PROJECT_DIR"
install -d "$OUTPUT_DIR"
install -d "$PACKAGE_ROOT/DEBIAN"
install -d "$PACKAGE_ROOT/usr/bin"
install -d "$PACKAGE_ROOT/usr/share/faz-agora/assets"
install -d "$PACKAGE_ROOT/usr/share/applications"
install -d "$PACKAGE_ROOT/usr/share/metainfo"
install -d "$PACKAGE_ROOT/usr/share/icons/hicolor/1024x1024/apps"
install -d "$PACKAGE_ROOT/usr/share/doc/faz-agora"

install -m 0755 packaging/debian/faz-agora "$PACKAGE_ROOT/usr/bin/faz-agora"
install -m 0644 faz-agora.py "$PACKAGE_ROOT/usr/share/faz-agora/faz-agora.py"
install -m 0644 assets/icon.png "$PACKAGE_ROOT/usr/share/faz-agora/assets/icon.png"
install -m 0644 assets/check-white.svg "$PACKAGE_ROOT/usr/share/faz-agora/assets/check-white.svg"
install -m 0644 assets/icon.png "$PACKAGE_ROOT/usr/share/icons/hicolor/1024x1024/apps/men.whats.FazAgora.png"
install -m 0644 packaging/linux/men.whats.FazAgora.desktop "$PACKAGE_ROOT/usr/share/applications/men.whats.FazAgora.desktop"
install -m 0644 packaging/linux/men.whats.FazAgora.metainfo.xml "$PACKAGE_ROOT/usr/share/metainfo/men.whats.FazAgora.metainfo.xml"
install -m 0644 LICENSE "$PACKAGE_ROOT/usr/share/doc/faz-agora/copyright"

INSTALLED_SIZE="$(du -sk "$PACKAGE_ROOT/usr" | cut -f1)"
cat >"$PACKAGE_ROOT/DEBIAN/control" <<EOF
Package: faz-agora
Version: $VERSION
Section: utils
Priority: optional
Architecture: all
Depends: python3, python3-pyqt6
Installed-Size: $INSTALLED_SIZE
Maintainer: Willian Ferreira <adm@whats.men>
Homepage: https://github.com/willf444/faz-agora
Description: Gerenciador de tarefas com sincronização WebDAV
 Faz agora! organiza tarefas, subtarefas, recorrências e lembretes.
 Funciona offline e permite sincronização por um servidor WebDAV escolhido
 pelo usuário.
EOF

dpkg-deb --root-owner-group --build "$PACKAGE_ROOT" "$OUTPUT_DIR/faz-agora_${VERSION}_all.deb"
echo "Pacote criado em: $OUTPUT_DIR/faz-agora_${VERSION}_all.deb"
