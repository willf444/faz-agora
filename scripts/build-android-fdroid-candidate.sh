#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
sdk_dir="${ANDROID_HOME:-/home/willian/Android/Sdk}"
version="$(node -p "require('${project_dir}/app.json').expo.version")"
version_code="$(node -p "require('${project_dir}/app.json').expo.android.versionCode")"
target_apk="${project_dir}/faz-agora-v${version}-fdroid-teste.apk"
if [[ -e "$target_apk" ]]; then
  target_apk="${project_dir}/faz-agora-v${version}-fdroid-teste-revisao.apk"
fi
stub_commit=ce90a956aacda17a85c60577ee443aeb83d876ef
expected_cert=989a3fab64a0bece165e2397a30197299b10f1cdecbf60f1f338284b3a16dc4c
# O Kotlin do Gradle 8.8 divide caminhos do classpath que contêm espaços.
# Mantenha a cópia de compilação fora do diretório "Faz Agora!".
project_parent="$(dirname "$(dirname "$project_dir")")"
candidate_root="$project_parent/faz-agora-fdroid-candidates"

if [[ "$version" != 2.3.13 || "$version_code" != 33 ]]; then
  echo "Recusado: a candidata deve ser 2.3.13/versionCode 33." >&2
  exit 1
fi
if [[ -e "$target_apk" ]]; then
  echo "Recusado: o APK de teste já existe; não vou sobrescrevê-lo: $target_apk" >&2
  exit 1
fi
if [[ ! -f "$project_dir/credentials.json" || ! -f "$project_dir/credentials/android/keystore.jks" ]]; then
  echo "Credenciais locais ausentes; nada foi construído." >&2
  exit 1
fi
if [[ ! -x "$sdk_dir/build-tools/34.0.0/apksigner" \
  || ! -x "$sdk_dir/build-tools/34.0.0/zipalign" \
  || ! -x "$sdk_dir/build-tools/34.0.0/aapt" ]]; then
  echo "Android SDK build-tools 34.0.0 ausente." >&2
  exit 1
fi

mkdir -p "$project_dir/dist" "$candidate_root"
if [[ "${1:-}" == --resume ]]; then
  if [[ $# -eq 1 ]]; then
    shopt -s nullglob
    work_candidates=("$candidate_root"/fdroid-candidate.*)
    stub_candidates=("$project_dir"/dist/firebase-stub.*/repo)
    shopt -u nullglob
    if [[ ${#work_candidates[@]} -ne 1 || ${#stub_candidates[@]} -ne 1 ]]; then
      echo "Há zero ou várias cópias; preciso dos caminhos explícitos para retomar." >&2
      exit 1
    fi
    work_dir="$(realpath -e "${work_candidates[0]}")"
    stub_repo="$(realpath -e "${stub_candidates[0]}")"
  elif [[ $# -eq 3 ]]; then
    work_dir="$(realpath -e "$2")"
    stub_repo="$(realpath -e "$3")"
  else
    echo "Uso: $0 --resume [copia/fdroid-candidate.X copia/firebase-stub.X/repo]" >&2
    exit 1
  fi
  case "$work_dir" in
    "$candidate_root"/fdroid-candidate.*) ;;
    *) echo "Cópia de trabalho fora da pasta de candidatos sem espaços: $work_dir" >&2; exit 1 ;;
  esac
  case "$stub_repo" in
    "$project_dir"/dist/firebase-stub.*/repo) ;;
    *) echo "Stub fora de dist/: $stub_repo" >&2; exit 1 ;;
  esac
  if [[ ! -d "$work_dir/node_modules/expo-application/android" \
    || "$(git -C "$stub_repo" rev-parse HEAD)" != "$stub_commit" \
    || ! -d "$stub_repo/firebase-messaging/src" \
    || "$(node -p "require('${work_dir}/app.json').expo.version")" != "$version" \
    || "$(node -p "require('${work_dir}/app.json').expo.android.versionCode")" != "$version_code" ]]; then
    echo "Cópia anterior incompleta ou diferente; não vou reutilizá-la." >&2
    exit 1
  fi
  if [[ -e "$work_dir/credentials.json" || -e "$work_dir/credentials/android/keystore.jks" ]]; then
    echo "Recusado: a cópia anterior contém credenciais privadas." >&2
    exit 1
  fi
  for source in \
    src/services/webDavService.js src/screens/WebDavSettingsScreen.js \
    src/screens/EditTaskScreen.js src/utils/editorLink.js; do
    install -D -m 644 "$project_dir/$source" "$work_dir/$source"
  done
  if grep -q '"buildFromSource"' "$work_dir/package.json"; then
    if grep -q 'com.android.installreferrer:installreferrer' "$work_dir/node_modules/expo-application/android/build.gradle" \
      || grep -q 'StringBuilder()' "$work_dir/node_modules/expo-application/android/src/main/java/expo/modules/application/ApplicationModule.kt" \
      || grep -q 'com.google.firebase:firebase-messaging' "$work_dir/node_modules/expo-notifications/android/build.gradle" \
      || [[ ! -d "$work_dir/node_modules/expo-notifications/android/src" ]]; then
      echo "Preparação anterior incompleta; não vou retomá-la." >&2
      exit 1
    fi
    prepared=true
  else
    install -m 755 "$project_dir/scripts/prepare-fdroid-node-modules.sh" \
      "$work_dir/scripts/prepare-fdroid-node-modules.sh"
    prepared=false
  fi
  echo "Retomando a cópia já baixada: $work_dir"
else
  if [[ $# -ne 0 ]]; then
    echo "Uso: $0 [--resume]" >&2
    exit 1
  fi
  work_dir="$(mktemp -d "$candidate_root/fdroid-candidate.XXXXXX")"
  chmod 700 "$work_dir"
  echo "Cópia de trabalho: $work_dir"

  # O Git fornece a base aprovada; somente os arquivos da correção local são
  # sobrepostos. Credenciais, APKs e outras alterações locais não entram na cópia.
  git -C "$project_dir" archive HEAD | tar -x -C "$work_dir"
  if [[ -e "$work_dir/credentials.json" || -e "$work_dir/credentials/android/keystore.jks" ]]; then
    echo "Recusado: a cópia de trabalho contém credenciais privadas." >&2
    exit 1
  fi
  for source in \
    app.json android/app/build.gradle package.json package-lock.json \
    android/app/src/main/AndroidManifest.xml \
    src/services/webDavService.js src/screens/WebDavSettingsScreen.js \
    src/screens/EditTaskScreen.js src/utils/editorLink.js \
    scripts/prepare-fdroid-node-modules.sh; do
    install -D -m 644 "$project_dir/$source" "$work_dir/$source"
  done
  chmod 755 "$work_dir/android/gradlew" "$work_dir/scripts/prepare-fdroid-node-modules.sh"

  cd "$work_dir"
  npm ci
  stub_dir="$(mktemp -d "$project_dir/dist/firebase-stub.XXXXXX")"
  stub_repo="$stub_dir/repo"
  git clone --quiet https://gitlab.com/freed-by-fdroid/firebase-stubs.git "$stub_repo"
  git -C "$stub_repo" checkout --quiet --detach "$stub_commit"
fi

cd "$work_dir"
if [[ "${prepared:-false}" != true ]]; then
  scripts/prepare-fdroid-node-modules.sh "$stub_repo"
fi

export ANDROID_HOME="$sdk_dir"
export ANDROID_SDK_ROOT="$sdk_dir"
export ANDROID_NDK_HOME="$sdk_dir/ndk/26.1.10909125"
export EXPO_NO_TELEMETRY=1
export NODE_ENV=production
export FAZ_AGORA_UNSIGNED_BUILD=1

cd "$work_dir/android"
./gradlew assembleRelease

unsigned_apk="$work_dir/android/app/build/outputs/apk/release/app-release-unsigned.apk"
if [[ ! -f "$unsigned_apk" ]]; then
  echo "APK unsigned não encontrado: $unsigned_apk" >&2
  exit 1
fi
"$sdk_dir/build-tools/34.0.0/zipalign" -c -p 4 "$unsigned_apk"
badging="$("$sdk_dir/build-tools/34.0.0/aapt" dump badging "$unsigned_apk" | sed -n '1p')"
if [[ "$badging" != *"name='com.willian.willdo'"* \
  || "$badging" != *"versionCode='33'"* \
  || "$badging" != *"versionName='2.3.13'"* ]]; then
  echo "Nome do pacote ou versão incorretos no APK unsigned: $badging" >&2
  exit 1
fi

keystore_rel="$(node -p "require('${project_dir}/credentials.json').android.keystore.keystorePath")"
case "$keystore_rel" in
  /*|../*|*/../*) echo "Caminho da chave inválido." >&2; exit 1 ;;
esac
keystore_path="$project_dir/$keystore_rel"
if [[ ! -f "$keystore_path" ]]; then
  echo "Chave local ausente." >&2
  exit 1
fi
key_alias="$(node -p "require('${project_dir}/credentials.json').android.keystore.keyAlias")"
export FAZ_TEST_STORE_PASS="$(node -p "require('${project_dir}/credentials.json').android.keystore.keystorePassword")"
export FAZ_TEST_KEY_PASS="$(node -p "require('${project_dir}/credentials.json').android.keystore.keyPassword")"
signed_temp="$work_dir/faz-agora-v${version}-assinado.apk"
"$sdk_dir/build-tools/34.0.0/apksigner" sign \
  --ks "$keystore_path" --ks-key-alias "$key_alias" \
  --ks-pass env:FAZ_TEST_STORE_PASS --key-pass env:FAZ_TEST_KEY_PASS \
  --out "$signed_temp" "$unsigned_apk"
unset FAZ_TEST_STORE_PASS FAZ_TEST_KEY_PASS

certificate="$("$sdk_dir/build-tools/34.0.0/apksigner" verify --print-certs "$signed_temp" \
  | sed -n 's/^Signer #1 certificate SHA-256 digest: //p')"
if [[ "$certificate" != "$expected_cert" ]]; then
  echo "Certificado diferente do APK 2.3.11; não vou copiar o candidato." >&2
  exit 1
fi
install -m 644 "$signed_temp" "$target_apk"
echo "APK de TESTE preparado segundo a receita F-Droid: $target_apk"
echo "APK unsigned para comparação posterior: $unsigned_apk"
echo "Ainda falta comparar com o build do F-Droid e testar no aparelho; não publique."
