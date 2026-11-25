/* Package the game into native desktop apps. */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const pkg = require(path.join(ROOT, 'package.json'));
const iconPng = path.join(ROOT, 'assets', 'icon.png');
const iconIcns = path.join(ROOT, 'assets', 'icon.icns');
const iconIco = path.join(ROOT, 'assets', 'icon.ico');

// extract-zip@2 hangs on modern Node (stream.pipeline never settles), so use
// the host's native unzip command for Electron's runtime archive instead.
function installExtractShim() {
  try {
    const target = require.resolve('extract-zip');
    require.cache[target] = {
      id: target, filename: target, loaded: true, children: [], paths: [],
      exports: async (zipPath, options) => {
        if (process.platform === 'win32') {
          execFileSync('powershell', ['-NoProfile', '-Command',
            `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${options.dir}' -Force`], { stdio: 'ignore' });
        } else {
          execFileSync('unzip', ['-q', '-o', zipPath, '-d', options.dir], { stdio: 'ignore' });
        }
      },
    };
  } catch { /* packager will fall back to its bundled extractor */ }
}
installExtractShim();

const targets = {
  mac: [{ platform: 'darwin', arch: 'arm64' }, { platform: 'darwin', arch: 'x64' }],
  win: [{ platform: 'win32', arch: 'x64' }, { platform: 'win32', arch: 'ia32' }],
  linux: [{ platform: 'linux', arch: 'x64' }, { platform: 'linux', arch: 'arm64' }],
};

async function packageApp(platform, arch) {
  const mod = require('@electron/packager');
  const packager = typeof mod === 'function' ? mod : (mod.default || mod.packager);
  const name = `Apex Circuit-${platform}-${arch}`;
  const out = path.join(DIST, name);
  fs.mkdirSync(DIST, { recursive: true });
  console.log(`\n▶ ${name}`);
  await packager({
    dir: ROOT,
    out,
    overwrite: true,
    prune: true,
    asar: true,
    name: 'Apex Circuit',
    appVersion: pkg.version,
    appCopyright: 'Copyright © 2026 Apex Circuit',
    platform,
    arch,
    icon: platform === 'darwin' ? (fs.existsSync(iconIcns) ? iconIcns : iconPng)
      : platform === 'win32' ? (fs.existsSync(iconIco) ? iconIco : iconPng) : iconPng,
    appBundleId: 'com.apexcircuit.game',
    win32metadata: {
      CompanyName: 'Apex Circuit', FileDescription: 'Apex Circuit Racing',
      ProductName: 'Apex Circuit', InternalName: 'ApexCircuit', OriginalFilename: 'ApexCircuit.exe',
    },
    ignore: [
      /^\/node_modules\/(@electron|electron|electron-packager)/,
      /^\/dist(\/|$)/,
      /^\/\.git(\/|$)/,
      /^\/electron\/build\.js$/,
      /^\/electron\/make-icons\.py$/,
    ],
  });
  console.log(`  ✓ ${out}`);
  return out;
}

function makeArchives(built) {
  if (process.platform === 'darwin') {
    const app = built.find(b => b.platform === 'darwin' && b.arch === 'arm64');
    if (app) {
      const appPath = path.join(app.out, 'Apex Circuit-darwin-arm64', 'Apex Circuit.app');
      const dmg = path.join(DIST, 'Apex-Circuit-macOS.dmg');
      try {
        execFileSync('hdiutil', ['create', '-volname', 'Apex Circuit', '-srcfolder', appPath, '-ov', '-format', 'UDZO', dmg], { stdio: 'inherit' });
        console.log(`  ✓ ${dmg}`);
      } catch (e) { console.warn('  DMG creation skipped:', e.message); }
    }
  }
  for (const b of built) {
    const folder = path.join(b.out, `Apex Circuit-${b.platform}-${b.arch}`);
    if (!fs.existsSync(folder)) continue;
    const target = path.join(DIST, `Apex-Circuit-${b.platform}-${b.arch}.${b.platform === 'win32' ? 'zip' : 'tar.gz'}`);
    try {
      if (b.platform === 'win32') {
        execFileSync('zip', ['-qr', target, path.basename(folder)], { cwd: b.out, stdio: 'inherit' });
      } else {
        execFileSync('tar', ['-czf', target, path.basename(folder)], { cwd: b.out, stdio: 'inherit' });
      }
      console.log(`  ✓ ${target}`);
    } catch (e) { console.warn('  archive skipped:', e.message); }
  }
}

(async () => {
  const which = (process.argv[2] || 'all').toLowerCase();
  const list = which === 'all' ? [...targets.mac, ...targets.win, ...targets.linux] : targets[which];
  if (!list) { console.error('Unknown target:', which); process.exit(1); }
  const built = [];
  for (const { platform, arch } of list) {
    const out = await packageApp(platform, arch);
    built.push({ platform, arch, out });
  }
  makeArchives(built);
  console.log('\nAll builds complete →', DIST);
})().catch(err => { console.error(err); process.exit(1); });
