// Сборка веб-версии для nginx: https://10.22.5.53/scanner/
//
//   npm run build:web
//
// 1. expo export во временную папку вне проекта (рабочая dist/ тем временем
//    продолжает раздаваться; а папки внутри проекта держит вотчер Metro —
//    на Windows их не переименовать и не удалить)
// 2. манифест, иконка и service worker со списком файлов (шаблоны — в pwa/)
// 3. копирование в dist/: сначала новые бандлы, index.html и sw.js последними —
//    сайт не пропадает и не ссылается на ещё не скопированные файлы
const { execSync } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const root = path.join(__dirname, '..')
const BASE = require(path.join(root, 'app.json')).expo.experiments?.baseUrl ?? ''
const OUT = path.join(os.tmpdir(), 'inventory-scanner-web')
const DIST = path.join(root, 'dist')

fs.rmSync(OUT, { recursive: true, force: true })
execSync(`npx expo export -p web --output-dir "${OUT}"`, {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' },
})

fs.copyFileSync(path.join(root, 'pwa', 'manifest.json'), path.join(OUT, 'manifest.json'))
fs.copyFileSync(path.join(root, 'assets', 'images', 'icon-zhapirak.png'), path.join(OUT, 'icon.png'))

// index.html: манифест и мета-теги для «На экран Домой» (iOS читает только их)
const indexPath = path.join(OUT, 'index.html')
const html = fs.readFileSync(indexPath, 'utf8')
if (!html.includes('</head>')) throw new Error('В index.html нет </head> — формат expo export изменился')
const head = [
  `<link rel="manifest" href="${BASE}/manifest.json">`,
  `<link rel="apple-touch-icon" href="${BASE}/icon.png">`,
  '<meta name="theme-color" content="#0f172a">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-title" content="1C NIS">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
].join('')
fs.writeFileSync(indexPath, html.replace('</head>', `${head}</head>`))

// Service worker: все файлы сборки в кэш браузера; версия — хэш содержимого,
// чтобы новая сборка вытеснила старый кэш
const files = []
const walk = dir => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else files.push(path.relative(OUT, p).split(path.sep).join('/'))
  }
}
walk(OUT)
files.sort()
const precache = files.filter(f => !f.endsWith('.map')).map(f => `${BASE}/${f}`)
const hash = crypto.createHash('sha256')
for (const f of files) hash.update(f).update(fs.readFileSync(path.join(OUT, f)))
const version = hash.digest('hex').slice(0, 12)

const sw = fs.readFileSync(path.join(root, 'pwa', 'sw.js'), 'utf8')
  .replace("const VERSION = '__VERSION__'", `const VERSION = '${version}'`)
  .replace("const BASE = '__BASE__'", `const BASE = '${BASE}'`)
  .replace('const PRECACHE = __PRECACHE__', `const PRECACHE = ${JSON.stringify(precache, null, 2)}`)
if (sw.includes("= '__") || sw.includes('= __')) throw new Error('pwa/sw.js: не все метки подставлены')
fs.writeFileSync(path.join(OUT, 'sw.js'), sw)

// Выкладка в dist/
const LAST = new Set(['index.html', 'sw.js'])
const fresh = [...files, 'sw.js']
const copy = f => {
  fs.mkdirSync(path.dirname(path.join(DIST, f)), { recursive: true })
  fs.copyFileSync(path.join(OUT, f), path.join(DIST, f))
}
fresh.filter(f => !LAST.has(f)).forEach(copy)
fresh.filter(f => LAST.has(f)).forEach(copy)

// Файлы прошлых сборок (бандлы со старым хэшем) — убрать
const keep = new Set(fresh)
const prune = dir => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    const rel = path.relative(DIST, p).split(path.sep).join('/')
    if (e.isDirectory()) prune(p)
    else if (!keep.has(rel)) fs.rmSync(p)
  }
}
prune(DIST)
fs.rmSync(OUT, { recursive: true, force: true })

console.log(`\nВеб-версия собрана: dist/ — ${precache.length} файлов, версия ${version}`)
