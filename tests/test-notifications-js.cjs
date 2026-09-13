const vm = require('vm');
const babel = require('@babel/core');
const fs = require('fs');

const transformed = babel.transformFileSync('src/services/notificationService.js', {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;

let permissionStatus = 'granted';
let nextIdentifier = 1;
let scheduled = [];
let savedTasks = null;
const sourceTasks = [
  {
    id: 'future',
    title: 'Notificação futura',
    due_at: new Date(Date.now() + 3600000).toISOString(),
    completed: false,
    reminded_at: new Date(Date.now() + 3600000).toISOString(),
    notificationId: 'identificador-antigo',
  },
  {
    id: 'past',
    title: 'Notificação vencida',
    due_at: new Date(Date.now() - 3600000).toISOString(),
    completed: false,
  },
  {
    id: 'completed',
    title: 'Notificação concluída',
    due_at: new Date(Date.now() + 3600000).toISOString(),
    completed: true,
  },
];

const notificationsMock = {
  AndroidImportance: { MAX: 'max' },
  setNotificationHandler: () => {},
  setNotificationChannelAsync: async () => {},
  getPermissionsAsync: async () => ({ status: permissionStatus }),
  requestPermissionsAsync: async () => ({ status: permissionStatus }),
  scheduleNotificationAsync: async request => {
    const identifier = `scheduled-${nextIdentifier++}`;
    scheduled.push({ identifier, request });
    return identifier;
  },
  cancelScheduledNotificationAsync: async identifier => {
    scheduled = scheduled.filter(item => item.identifier !== identifier);
  },
  cancelAllScheduledNotificationsAsync: async () => {
    scheduled = [];
  },
};

const storageMock = {
  getTasks: async () => savedTasks || sourceTasks,
  saveTasks: async tasks => {
    savedTasks = tasks;
    return tasks;
  },
};

const moduleUnderTest = { exports: {} };
vm.runInNewContext(transformed, {
  module: moduleUnderTest,
  exports: moduleUnderTest.exports,
  console,
  Date,
  require: name => {
    if (name === 'expo-notifications') return notificationsMock;
    if (name === 'react-native') return { Platform: { OS: 'android' } };
    if (name === './storageService') return { storageService: storageMock };
    return require(name);
  },
});

(async () => {
  const appConfig = JSON.parse(fs.readFileSync('app.json', 'utf8'));
  const permissions = appConfig.expo.android.permissions || [];
  const manifest = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
  if (!permissions.includes('USE_EXACT_ALARM') || !manifest.includes('android.permission.USE_EXACT_ALARM')) {
    throw new Error('O Android não declarou a permissão automática para alarmes exatos.');
  }
  if (permissions.includes('SCHEDULE_EXACT_ALARM') || manifest.includes('android.permission.SCHEDULE_EXACT_ALARM')) {
    throw new Error('A permissão revogável de alarme exato ainda está declarada.');
  }

  const service = moduleUnderTest.exports.notificationService;
  await service.restoreScheduledTasks();
  if (scheduled.length !== 1 || scheduled[0].request.content.data.taskId !== 'future') {
    throw new Error('A restauração não agendou somente a tarefa futura pendente.');
  }
  if (!savedTasks[0].notificationId.startsWith('scheduled-')) {
    throw new Error('O novo identificador da notificação não foi salvo.');
  }

  // Simula atualização do APK: o armazenamento mantém o ID, mas o alarme
  // desapareceu do sistema. A inicialização deve criá-lo novamente.
  scheduled = [];
  const previousIdentifier = savedTasks[0].notificationId;
  await service.restoreScheduledTasks();
  if (scheduled.length !== 1 || savedTasks[0].notificationId === previousIdentifier) {
    throw new Error('A atualização do APK não reconstruiu o alarme perdido.');
  }

  permissionStatus = 'denied';
  const tasksBeforeDeniedAttempt = savedTasks;
  const deniedResult = await service.rescheduleTasks(savedTasks);
  if (deniedResult !== tasksBeforeDeniedAttempt || scheduled.length !== 1) {
    throw new Error('Permissão negada removeu um agendamento já existente.');
  }

  console.log('Android: restauração e reagendamento de notificações passaram.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
