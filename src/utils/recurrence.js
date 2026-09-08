export const RECURRENCE_OPTIONS = [
  'Sem recorrência',
  'Diariamente',
  'Semanalmente',
  'Mensalmente no mesmo dia',
  'Anualmente no mesmo dia',
  'Personalizado',
];

export const CUSTOM_RECURRENCE_UNITS = [
  { value: 'hours', label: 'Horas', singular: 'hora', plural: 'horas' },
  { value: 'days', label: 'Dias', singular: 'dia', plural: 'dias' },
  { value: 'weeks', label: 'Semanas', singular: 'semana', plural: 'semanas' },
];

export function formatCustomRecurrence(interval, unit) {
  const safeInterval = Math.max(1, Number.parseInt(interval, 10) || 1);
  const unitConfig = CUSTOM_RECURRENCE_UNITS.find(item => item.value === unit)
    || CUSTOM_RECURRENCE_UNITS[1];
  const unitLabel = safeInterval === 1 ? unitConfig.singular : unitConfig.plural;
  return `A cada ${safeInterval} ${unitLabel}`;
}

export function parseCustomRecurrence(recurrence) {
  if (typeof recurrence !== 'string') return null;

  const match = recurrence.trim().match(/^A cada (\d+) (hora|horas|dia|dias|semana|semanas)$/i);
  if (!match) return null;

  const normalizedUnit = match[2].toLowerCase();
  const unit = normalizedUnit.startsWith('hora')
    ? 'hours'
    : normalizedUnit.startsWith('semana')
      ? 'weeks'
      : 'days';

  return {
    interval: Math.max(1, Number.parseInt(match[1], 10)),
    unit,
  };
}

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Calcula a próxima data de vencimento com base na regra de recorrência
 * Equivalente ao calculate_next_due de willdo.py
 * @param {Date|string} oldDate 
 * @param {string} recurrence 
 * @returns {Date}
 */
export function calculateNextDue(oldDate, recurrence) {
  const d = new Date(oldDate);
  if (isNaN(d.getTime())) return new Date();

  const customRecurrence = parseCustomRecurrence(recurrence);
  if (customRecurrence) {
    const next = new Date(d);
    if (customRecurrence.unit === 'hours') {
      next.setHours(next.getHours() + customRecurrence.interval);
    } else if (customRecurrence.unit === 'weeks') {
      next.setDate(next.getDate() + (customRecurrence.interval * 7));
    } else {
      next.setDate(next.getDate() + customRecurrence.interval);
    }
    return next;
  }

  switch (recurrence) {
    case 'Diariamente': {
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      return next;
    }

    case 'Semanalmente': {
      const next = new Date(d);
      next.setDate(next.getDate() + 7);
      return next;
    }

    case 'Mensalmente no mesmo dia': {
      const currentMonth = d.getMonth();
      const currentYear = d.getFullYear();
      const originalDay = d.getDate();

      const targetYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const targetMonth = (currentMonth + 1) % 12;

      // Último dia do mês alvo
      const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
      const targetDay = Math.min(originalDay, daysInTargetMonth);

      const next = new Date(d);
      next.setDate(1); // Previne overflow de mês do JavaScript (ex: 31 de jan -> fev)
      next.setFullYear(targetYear);
      next.setMonth(targetMonth);
      next.setDate(targetDay);
      return next;
    }

    case 'Anualmente no mesmo dia': {
      const targetYear = d.getFullYear() + 1;
      let targetMonth = d.getMonth();
      let targetDay = d.getDate();

      // Caso especial para 29 de fevereiro em anos não bissextos
      if (targetMonth === 1 && targetDay === 29 && !isLeapYear(targetYear)) {
        targetDay = 28;
      }

      const next = new Date(d);
      next.setDate(1);
      next.setFullYear(targetYear);
      next.setMonth(targetMonth);
      next.setDate(targetDay);
      return next;
    }

    default:
      return d;
  }
}
