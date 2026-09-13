const vm = require('vm');
const babel = require('@babel/core');

const transformed = babel.transformFileSync('src/utils/dateDisplay.js', {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
const moduleUnderTest = { exports: {} };
vm.runInNewContext(transformed, {
  module: moduleUnderTest,
  exports: moduleUnderTest.exports,
  Date,
  Number,
  String,
  require,
});

const { applySelectedTime, formatTaskDue } = moduleUnderTest.exports;
const reference = new Date(2026, 8, 12, 15, 0);
const cases = [
  [new Date(2026, 8, 11, 23, 55), 'Ontem às 23:55'],
  [new Date(2026, 8, 12, 16, 30), 'Hoje às 16:30'],
  [new Date(2026, 8, 13, 9, 7), 'Amanhã às 09:07'],
  [new Date(2026, 8, 14, 10, 45), '14/09/2026 às 10:45'],
  [new Date(2027, 0, 2, 6, 0), '02/01/2027 às 06:00'],
];

for (const [due, expected] of cases) {
  const actual = formatTaskDue(due, reference);
  if (actual !== expected) {
    throw new Error(`Data divergente: esperado ${expected}, recebido ${actual}`);
  }
}

const baseWithHiddenSeconds = new Date(2026, 8, 12, 10, 0, 57, 843);
const selectedMinute = new Date(2026, 8, 12, 18, 25, 41, 912);
const scheduled = applySelectedTime(baseWithHiddenSeconds, selectedMinute);
if (
  scheduled.getHours() !== 18
  || scheduled.getMinutes() !== 25
  || scheduled.getSeconds() !== 0
  || scheduled.getMilliseconds() !== 0
) {
  throw new Error('O horário escolhido manteve segundos ocultos e pode atrasar a notificação.');
}

console.log('Android: textos relativos e precisão do minuto passaram.');
