export const RECURRENCE_OPTIONS = [
  'Sem recorrência',
  'Diariamente',
  'Semanalmente',
  'Mensalmente no mesmo dia',
  'Anualmente no mesmo dia',
];

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
