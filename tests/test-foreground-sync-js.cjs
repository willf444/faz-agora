const vm = require('vm');
const babel = require('@babel/core');

const transformed = babel.transformFileSync('src/utils/foregroundSync.js', {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
const moduleUnderTest = { exports: {} };
vm.runInNewContext(transformed, {
  module: moduleUnderTest,
  exports: moduleUnderTest.exports,
  setInterval,
});

const {
  FOREGROUND_SYNC_INTERVAL_MS,
  shouldRescheduleAfterSync,
  startForegroundSync,
  SYNC_SUCCESS_MESSAGE,
} = moduleUnderTest.exports;

let receivedInterval = null;
let scheduledCallback = null;
const timerToken = {};
const returnedToken = startForegroundSync(
  () => {
    scheduledCallback.called = true;
  },
  (callback, interval) => {
    scheduledCallback = callback;
    scheduledCallback.called = false;
    receivedInterval = interval;
    return timerToken;
  }
);

if (FOREGROUND_SYNC_INTERVAL_MS !== 3000 || receivedInterval !== 3000) {
  throw new Error('A sincronização em primeiro plano não foi configurada para 3 segundos.');
}
if (returnedToken !== timerToken || typeof scheduledCallback !== 'function') {
  throw new Error('O temporizador de sincronização não foi iniciado corretamente.');
}
scheduledCallback();
if (!scheduledCallback.called) {
  throw new Error('O temporizador não executou a sincronização configurada.');
}
if (!shouldRescheduleAfterSync({ changed: true }, true)) {
  throw new Error('Uma alteração recebida não reagendaria as notificações do Android.');
}
if (shouldRescheduleAfterSync({ changed: false }, true)) {
  throw new Error('Uma consulta sem mudança recriaria alarmes desnecessariamente.');
}
if (!shouldRescheduleAfterSync({ changed: false }, false)) {
  throw new Error('O sync manual não restauraria as notificações locais.');
}
if (SYNC_SUCCESS_MESSAGE !== 'As tarefas foram sincronizadas com sucesso.') {
  throw new Error('A mensagem de sincronização não corresponde ao texto aprovado.');
}

console.log('Android: sincronização periódica em primeiro plano passou.');
