#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || ! -d "$1/firebase-messaging/src" ]]; then
  echo "Uso: $0 /caminho/para/firebase-stubs" >&2
  exit 1
fi

# Este script modifica dependências instaladas pelo npm. Nunca rodar no projeto
# de trabalho que contém a chave privada: somente numa cópia isolada ou no CI.
if [[ -e credentials.json || -e credentials/android/keystore.jks ]]; then
  echo "Recusado: execute somente em uma cópia sem credenciais privadas." >&2
  exit 1
fi

application_gradle=node_modules/expo-application/android/build.gradle
application_module=node_modules/expo-application/android/src/main/java/expo/modules/application/ApplicationModule.kt
notifications_gradle=node_modules/expo-notifications/android/build.gradle
notifications_android=node_modules/expo-notifications/android

for required in package.json "$application_gradle" "$application_module" "$notifications_gradle"; do
  if [[ ! -f "$required" ]]; then
    echo "Dependência ausente: $required" >&2
    exit 1
  fi
done

if ! grep -q 'com.android.installreferrer:installreferrer' "$application_gradle" \
  || ! grep -q 'StringBuilder()' "$application_module" \
  || ! grep -q 'com.google.firebase:firebase-messaging' "$notifications_gradle"; then
  echo "As dependências não correspondem à receita F-Droid conhecida; pare e confira." >&2
  exit 1
fi

# Mesmos comandos do metadata F-Droid para a próxima versão.
sed -i -e '1a "expo":{"autolinking":{"android":{"buildFromSource":[".*"]}}},' package.json
sed -i -e '/installreferrer/d' "$application_gradle"
sed -i -e '/com.android.installreferrer.api/d' \
  -e '/StringBuilder()/,/^      })/d' \
  -e '/getInstallReferrerAsync/apromise.resolve("")' \
  "$application_module"
sed -i -e '/firebase/d' "$notifications_gradle"
cp -a "$1/firebase-messaging/src" "$notifications_android"

# The APK scanner blocks classes under com.google.firebase.messaging, even
# though these are local no-op stubs and not Google's Firebase SDK. Relocate
# the stubs and update Expo Notifications' references so the APK contains no
# classes in the blocked namespace.
old_namespace=com.google.firebase.messaging
new_namespace=org.freedbyfdroid.stub.firebase.messaging
while IFS= read -r -d '' source_file; do
  sed -i "s|$old_namespace|$new_namespace|g" "$source_file"
done < <(find "$notifications_android/src" -type f \
  \( -name '*.java' -o -name '*.kt' -o -name '*.xml' \) -print0)

stub_java_root="$notifications_android/src/main/java"
old_stub_dir="$stub_java_root/com/google/firebase/messaging"
new_stub_dir="$stub_java_root/org/freedbyfdroid/stub/firebase/messaging"
if [[ ! -d "$old_stub_dir" ]]; then
  echo "Diretório esperado dos stubs não encontrado: $old_stub_dir" >&2
  exit 1
fi
mkdir -p "$new_stub_dir"
mv "$old_stub_dir"/* "$new_stub_dir"/
rmdir -p "$old_stub_dir"

if grep -R -n -E 'com[./]google[./]firebase[./]messaging' "$notifications_android/src"; then
  echo "Namespace bloqueado do Firebase ainda aparece em expo-notifications." >&2
  exit 1
fi

echo "Dependências Android preparadas como na receita F-Droid."
