const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
process.chdir(root);
const architectures = process.env.UCHASTKI_ANDROID_ARCHS || 'arm64-v8a';
if (!/^(arm64-v8a|x86_64)(,(arm64-v8a|x86_64))*$/.test(architectures))
  throw new Error('UCHASTKI_ANDROID_ARCHS must contain arm64-v8a and/or x86_64.');
const apkName =
  architectures === 'arm64-v8a'
    ? 'uchastki-android-arm64.apk'
    : architectures === 'x86_64'
      ? 'uchastki-android-emulator.apk'
      : 'uchastki-android-universal.apk';
const javaHome = process.env.JAVA_HOME;
const sdk =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  (process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'));
if (
  !javaHome ||
  !fs.existsSync(path.join(javaHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'))
) {
  throw new Error('Set JAVA_HOME to a JDK 21 installation (Android Studio includes jbr).');
}
if (!sdk || !fs.existsSync(sdk)) throw new Error('Set ANDROID_HOME to your installed Android SDK.');

const credentialsDir = path.join(root, '.credentials');
const credentialsPath = path.join(credentialsDir, 'android-signing.json');
const keystorePath = path.join(credentialsDir, 'uchastki-release.p12');
fs.mkdirSync(credentialsDir, { recursive: true });
let credentials;
if (fs.existsSync(credentialsPath)) {
  credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  if (!fs.existsSync(keystorePath))
    throw new Error(
      'Signing configuration exists but its keystore is missing. Restore your signing backup.',
    );
} else {
  if (fs.existsSync(keystorePath))
    throw new Error(
      'A keystore already exists without its configuration. Restore android-signing.json; do not replace the original key.',
    );
  credentials = { alias: 'uchastki', password: crypto.randomBytes(24).toString('hex') };
  const keytool = path.join(
    javaHome,
    'bin',
    process.platform === 'win32' ? 'keytool.exe' : 'keytool',
  );
  const result = spawnSync(
    keytool,
    [
      '-genkeypair',
      '-keystore',
      keystorePath,
      '-storetype',
      'PKCS12',
      '-alias',
      credentials.alias,
      '-keyalg',
      'RSA',
      '-keysize',
      '2048',
      '-validity',
      '10000',
      '-dname',
      'CN=Uchastki, OU=Mobile, O=Uchastki, C=BY',
      '-storepass:env',
      'UCHASTKI_KEYSTORE_PASSWORD',
      '-keypass:env',
      'UCHASTKI_KEYSTORE_PASSWORD',
    ],
    { stdio: 'inherit', env: { ...process.env, UCHASTKI_KEYSTORE_PASSWORD: credentials.password } },
  );
  if (result.error || result.status !== 0)
    throw new Error('Could not generate the local signing key.');
  fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2), { mode: 0o600 });
  console.log(
    'Created a private release signing key in .credentials/. Keep this directory for future APK updates.',
  );
}

const env = {
  ...process.env,
  ANDROID_HOME: sdk,
  UCHASTKI_KEYSTORE_PATH: keystorePath,
  UCHASTKI_KEYSTORE_PASSWORD: credentials.password,
  UCHASTKI_KEY_ALIAS: credentials.alias,
  UCHASTKI_LOCAL_SIGNING: '1',
};
const prebuild = spawnSync(
  process.execPath,
  [require.resolve('expo/bin/cli'), 'prebuild', '--platform', 'android', '--no-install'],
  { cwd: root, env, stdio: 'inherit' },
);
if (prebuild.error || prebuild.status !== 0) process.exit(prebuild.status || 1);
const args = [
  'assembleRelease',
  `-PreactNativeArchitectures=${architectures}`,
  '--max-workers=2',
  '--console=plain',
];
const result =
  process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/c', 'gradlew.bat', ...args], {
        cwd: path.join(root, 'android'),
        env,
        stdio: 'inherit',
      })
    : spawnSync('./gradlew', args, { cwd: path.join(root, 'android'), env, stdio: 'inherit' });
if (result.error || result.status !== 0) process.exit(result.status || 1);
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
fs.copyFileSync(
  path.join(root, 'android/app/build/outputs/apk/release/app-release.apk'),
  path.join(root, 'artifacts', apkName),
);
console.log(`APK ready: artifacts/${apkName}`);
