const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const yaml = require('js-yaml');

const files = [
  'package.json',
  'node_modules/expo-application/android/build.gradle',
  'node_modules/expo-application/android/src/main/java/expo/modules/application/ApplicationModule.kt',
  'node_modules/expo-notifications/android/build.gradle',
];
const metadata = yaml.load(fs.readFileSync('packaging/fdroid/com.willian.willdo.yml', 'utf8'));
const prebuild = metadata.Builds[0].prebuild.slice(1);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'faz-fdroid-prep-test-'));

try {
  const scripted = path.join(temp, 'scripted');
  const recipe = path.join(temp, 'recipe');
  const stub = path.join(temp, 'stub');
  fs.mkdirSync(path.join(stub, 'firebase-messaging/src'), { recursive: true });
  fs.writeFileSync(path.join(stub, 'firebase-messaging/src/Stub.java'), 'class Stub {}\n');

  for (const root of [scripted, recipe]) {
    for (const source of files) {
      const target = path.join(root, source);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
    }
    fs.mkdirSync(path.join(root, 'node_modules/expo-notifications/android/src'), { recursive: true });
  }

  const run = (command, cwd) => {
    const result = spawnSync('bash', ['-e', '-c', command], { cwd, encoding: 'utf8' });
    assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  };
  run(`bash ${JSON.stringify(path.resolve('scripts/prepare-fdroid-node-modules.sh'))} ${JSON.stringify(stub)}`, scripted);
  for (const command of prebuild) {
    run(command.replaceAll('$$firebase-stub$$', stub), recipe);
  }

  for (const source of files) {
    assert.strictEqual(
      fs.readFileSync(path.join(scripted, source), 'utf8'),
      fs.readFileSync(path.join(recipe, source), 'utf8'),
      `Diferenca na preparacao F-Droid: ${source}`
    );
  }
  assert.strictEqual(
    fs.readFileSync(path.join(scripted, 'node_modules/expo-notifications/android/src/Stub.java'), 'utf8'),
    fs.readFileSync(path.join(recipe, 'node_modules/expo-notifications/android/src/Stub.java'), 'utf8')
  );
  console.log('Preparação local idêntica à receita F-Droid atual.');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
