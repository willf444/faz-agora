#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_SDK_DIR="${ANDROID_HOME:-/home/willian/Android/Sdk}"
BUILD_KIND="${1:-apk}"
APP_VERSION="$(node -p "require('${PROJECT_DIR}/app.json').expo.version")"

if [[ ! -f "${PROJECT_DIR}/credentials.json" ]]; then
  echo "Erro: credentials.json não encontrado."
  exit 1
fi

if [[ ! -f "${PROJECT_DIR}/credentials/android/keystore.jks" ]]; then
  echo "Erro: chave Android local não encontrada."
  exit 1
fi

if [[ ! -d "$ANDROID_SDK_DIR" ]]; then
  echo "Erro: Android SDK não encontrado em $ANDROID_SDK_DIR."
  exit 1
fi

export ANDROID_HOME="$ANDROID_SDK_DIR"
export ANDROID_SDK_ROOT="$ANDROID_SDK_DIR"
export ANDROID_NDK_HOME="$ANDROID_SDK_DIR/ndk/26.1.10909125"
export EXPO_NO_TELEMETRY=1
export NODE_ENV=production

cd "$PROJECT_DIR/android"

case "$BUILD_KIND" in
  apk)
    ./gradlew assembleRelease
    install -m 0644 app/build/outputs/apk/release/app-release.apk "$PROJECT_DIR/faz-agora-v${APP_VERSION}.apk"
    echo "APK criado em: $PROJECT_DIR/faz-agora-v${APP_VERSION}.apk"
    ;;
  aab)
    ./gradlew bundleRelease
    install -m 0644 app/build/outputs/bundle/release/app-release.aab "$PROJECT_DIR/faz-agora-v${APP_VERSION}.aab"
    echo "AAB criado em: $PROJECT_DIR/faz-agora-v${APP_VERSION}.aab"
    ;;
  *)
    echo "Uso: $0 apk|aab"
    exit 1
    ;;
esac
