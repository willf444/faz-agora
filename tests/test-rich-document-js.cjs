const fs = require('fs');
const { spawnSync } = require('child_process');
const vm = require('vm');
const babel = require('@babel/core');

const transformed = babel.transformFileSync('src/utils/richDocument.js', {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
const moduleUnderTest = { exports: {} };
vm.runInNewContext(transformed, {
  module: moduleUnderTest,
  exports: moduleUnderTest.exports,
  require,
});

const {
  editorHtmlToRichDocument,
  markdownToRichDocument,
  normalizeRichDocument,
  richDocumentToEditorHtml,
  richDocumentToMarkdown,
} = moduleUnderTest.exports;
const fixtures = JSON.parse(fs.readFileSync('tests/rich-document-fixtures.json', 'utf8'));
const canonicalDocuments = JSON.parse(fs.readFileSync('tests/rich-document-canonical.json', 'utf8'));
const javascriptDocuments = fixtures.map(markdownToRichDocument);
const pythonDump = spawnSync('python3', ['tests/test_rich_document.py', '--dump-json'], {
  encoding: 'utf8',
  env: { ...process.env, QT_QPA_PLATFORM: 'offscreen' },
});
if (pythonDump.status !== 0) {
  throw new Error(`Falha ao comparar o contrato Python: ${pythonDump.stderr || pythonDump.stdout}`);
}
const pythonDocuments = JSON.parse(pythonDump.stdout);
if (JSON.stringify(javascriptDocuments) !== JSON.stringify(pythonDocuments)) {
  throw new Error('Android e Linux migraram o mesmo Markdown legado de formas diferentes.');
}

for (const source of fixtures) {
  const expected = markdownToRichDocument(source);
  let current = expected;
  for (let cycle = 0; cycle < 25; cycle += 1) {
    current = editorHtmlToRichDocument(richDocumentToEditorHtml(current));
  }
  if (JSON.stringify(current) !== JSON.stringify(expected)) {
    throw new Error(`Documento Android mudou após 25 ciclos: ${JSON.stringify(source)}`);
  }
}

for (const expected of canonicalDocuments) {
  let current = expected;
  for (let cycle = 0; cycle < 25; cycle += 1) {
    current = editorHtmlToRichDocument(richDocumentToEditorHtml(current));
  }
  if (JSON.stringify(current) !== JSON.stringify(expected)) {
    throw new Error('Documento canônico Android mudou após 25 ciclos.');
  }
}

if (process.env.RICH_DOCUMENT_SAMPLE_FILE) {
  const tasks = JSON.parse(fs.readFileSync(process.env.RICH_DOCUMENT_SAMPLE_FILE, 'utf8'));
  const latest = [...tasks].sort((left, right) => String(
    right.updated_at || right.created_at || ''
  ).localeCompare(String(left.updated_at || left.created_at || '')))[0];
  const expected = normalizeRichDocument(latest?.details_doc, latest?.details_md || '');
  let current = expected;
  for (let cycle = 0; cycle < 50; cycle += 1) {
    current = editorHtmlToRichDocument(richDocumentToEditorHtml(current));
  }
  if (JSON.stringify(current) !== JSON.stringify(expected)) {
    throw new Error('A nota real mudou durante os ciclos do editor Android.');
  }
}

const webViewCases = [
  ['Linha 1\nLinha 2', 'Linha 1<div>Linha 2</div>'],
  ['Linha 1\n\nLinha 2', '<div>Linha 1</div><div><br></div><div>Linha 2</div>'],
  ['Linha 1\n\n\nLinha 2', '<div>Linha 1</div><div><br></div><div><br></div><div>Linha 2</div>'],
  ['- Lista 1\n- Lista 2\nTexto normal', '<div><ul><li>Lista 1</li><li>Lista 2</li></ul><div>Texto normal</div></div>'],
  ['- Lista 1\n- Lista 2\nTexto normal', '<div><ul><li><div>Lista 1</div></li><li><p>Lista 2</p></li></ul><div>Texto normal</div></div>'],
  ['**negrito** e *itálico* e [link](https://example.com)', '<div><b>negrito</b> e <i>itálico</i> e <a href="https://example.com">link</a></div>'],
  ['**forte** normal *itálico* comum', '<div><b>forte<span style="font-weight: normal"> normal</span></b> <i>itálico<span style="font-style: normal"> comum</span></i></div>'],
  ['# Título 1\n## Título 2\nNormal', '<h1>Título 1</h1><h2>Título 2</h2><div>Normal</div>'],
  ['Linha 1\n\n\nLinha 2', '<div>Linha 1<br><br><br>Linha 2</div>'],
];

for (const [expected, html] of webViewCases) {
  const actual = richDocumentToMarkdown(editorHtmlToRichDocument(html));
  if (actual !== expected) {
    throw new Error(`HTML Android divergente. Esperado ${JSON.stringify(expected)}, recebido ${JSON.stringify(actual)}`);
  }
}

const webDavCode = babel.transformFileSync('src/services/webDavService.js', {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
const webDavModule = { exports: {} };
const asyncStorageMock = {};
vm.runInNewContext(webDavCode, {
  module: webDavModule,
  exports: webDavModule.exports,
  AbortController,
  fetch,
  setTimeout,
  clearTimeout,
  require: (name) => {
    if (name === '@react-native-async-storage/async-storage') {
      return { __esModule: true, default: asyncStorageMock };
    }
    if (name === 'expo-secure-store') return {};
    if (name === './storageService') return { storageService: {} };
    if (name === '../utils/richDocument') return moduleUnderTest.exports;
    return require(name);
  },
});

const legacyTask = {
  id: 'task-1',
  title: 'Contrato de sincronização',
  details_md: 'Linha 1\n\n- Lista 1\n- Lista 2',
  subtasks: [{ id: 'sub-1', title: '# Subtarefa\nTexto', completed: false }],
};
const migratedTask = webDavModule.exports.webDavInternals.normalizeRemoteTask(legacyTask);
if (!migratedTask.details_doc || !migratedTask.subtasks[0].content_doc) {
  throw new Error('A sincronização não migrou o documento legado para o formato estruturado.');
}
const normalizedAgain = webDavModule.exports.webDavInternals.normalizeRemoteTask(migratedTask);
if (JSON.stringify(normalizedAgain) !== JSON.stringify(migratedTask)) {
  throw new Error('A normalização WebDAV modificou o documento na segunda passagem.');
}

const localWithNotification = {
  ...normalizedAgain,
  due_at: '2026-09-12T12:00:00.000Z',
  notificationId: 'local-notification',
};
const sharedBaseline = webDavModule.exports.webDavInternals.taskWithoutLocalFields(
  localWithNotification
);
const mergedUnchanged = webDavModule.exports.webDavInternals.mergeTasks(
  [localWithNotification],
  [sharedBaseline],
  [sharedBaseline]
);
if (mergedUnchanged[0]?.notificationId !== 'local-notification') {
  throw new Error('O merge WebDAV perdeu a notificação local de uma tarefa inalterada.');
}
if ('notificationId' in webDavModule.exports.webDavInternals.taskWithoutLocalFields(localWithNotification)) {
  throw new Error('O WebDAV tentou publicar o identificador local da notificação.');
}

const freshUrl = webDavModule.exports.webDavInternals.freshTaskFileUrl(
  'https://example.com/dav/',
  123456
);
if (freshUrl !== 'https://example.com/dav/task.json?_willdo_sync=123456') {
  throw new Error('A leitura WebDAV pode reutilizar uma resposta antiga em cache.');
}

const beforeDesktopReminder = {
  ...localWithNotification,
  reminded_at: '',
};
const afterDesktopReminder = {
  ...localWithNotification,
  reminded_at: '2026-09-12T12:00:00.000Z',
  notificationId: null,
};
if (
  webDavModule.exports.webDavInternals.tasksFingerprint([beforeDesktopReminder])
  !== webDavModule.exports.webDavInternals.tasksFingerprint([afterDesktopReminder])
) {
  throw new Error('O lembrete de um dispositivo ainda invalida o alarme do outro.');
}
const mergedAfterOtherDeviceReminder = webDavModule.exports.webDavInternals.mergeTasks(
  [beforeDesktopReminder],
  [afterDesktopReminder],
  [beforeDesktopReminder]
);
if (mergedAfterOtherDeviceReminder[0]?.notificationId !== 'local-notification') {
  throw new Error('O lembrete do Debian cancelou a notificação já agendada no Android.');
}

console.log('Android: editor e WebDAV estáveis em 25 ciclos.');
