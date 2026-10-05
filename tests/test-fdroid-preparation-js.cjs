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
const abiByVersionCode = new Map([
  [331, 'armeabi-v7a'],
  [332, 'arm64-v8a'],
]);
assert.strictEqual(metadata.Binaries, undefined);
assert.deepStrictEqual(metadata.Builds.map((build) => build.versionCode), [...abiByVersionCode.keys()]);
assert.ok(metadata.Builds.every((build) => build.versionName === '2.3.13'));
assert.ok(metadata.Builds.every((build) => build.commit === 'b43eeeb0111cd35e2dfb8b0253c1ee2dec958587'));
assert.deepStrictEqual(metadata.VercodeOperation, [
  '10 * %c + 1',
  '10 * %c + 2',
]);
assert.strictEqual(metadata.CurrentVersion, '2.3.13');
assert.strictEqual(metadata.CurrentVersionCode, 332);
for (const build of metadata.Builds) {
  assert.strictEqual(build.prebuild[0], 'cd ../..');
  assert.strictEqual(build.prebuild[1], 'bash scripts/prepare-fdroid-node-modules.sh $$firebase-stub$$');
  assert.deepStrictEqual(build.gradleprops, ['android.enableProguardInReleaseBuilds=true']);
}
const originalRecipeCommands = [
  `sed -i -e '1a "expo":{"autolinking":{"android":{"buildFromSource":[".*"]}}},' package.json`,
  `sed -i -e '/installreferrer/d' node_modules/expo-application/android/build.gradle`,
  `sed -i -e '/com.android.installreferrer.api/d' -e '/StringBuilder()/,/^      })/d' -e '/getInstallReferrerAsync/apromise.resolve("")' node_modules/expo-application/android/src/main/java/expo/modules/application/ApplicationModule.kt`,
  `sed -i -e '/firebase/d' node_modules/expo-notifications/android/build.gradle`,
  'cp -a $$firebase-stub$$/firebase-messaging/src node_modules/expo-notifications/android',
];
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
  for (const command of originalRecipeCommands) {
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

  for (const [versionCode, abi] of abiByVersionCode) {
    const abiRoot = path.join(temp, `abi-${versionCode}`);
    fs.mkdirSync(path.join(abiRoot, 'android/app'), { recursive: true });
    fs.copyFileSync('android/app/build.gradle', path.join(abiRoot, 'android/app/build.gradle'));
    fs.copyFileSync('android/gradle.properties', path.join(abiRoot, 'android/gradle.properties'));
    const build = metadata.Builds.find((candidate) => candidate.versionCode === versionCode);
    for (const command of build.prebuild.slice(2)) {
      run(command.replaceAll('$$VERCODE$$', String(versionCode)), abiRoot);
    }
    assert.match(
      fs.readFileSync(path.join(abiRoot, 'android/app/build.gradle'), 'utf8'),
      new RegExp(`^        versionCode ${versionCode}$`, 'm')
    );
    assert.match(
      fs.readFileSync(path.join(abiRoot, 'android/app/build.gradle'), 'utf8'),
      new RegExp(`^\\s*ndk \\{ abiFilters '${abi}' \\}$`, 'm')
    );
    assert.match(
      fs.readFileSync(path.join(abiRoot, 'android/gradle.properties'), 'utf8'),
      new RegExp(`^reactNativeArchitectures=${abi}$`, 'm')
    );
  }
  console.log('Preparação local idêntica aos comandos originais F-Droid.');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
