import { differenceInCalendarDays, format } from 'date-fns';

export const applySelectedTime = (dateValue, timeValue) => {
  const updated = new Date(dateValue);
  const selectedTime = new Date(timeValue);
  updated.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
  return updated;
};

export const formatTaskDue = (value, reference = new Date()) => {
  const due = new Date(value);
  const today = new Date(reference);
  if (Number.isNaN(due.getTime()) || Number.isNaN(today.getTime())) {
    return String(value || '');
  }

  const time = format(due, 'HH:mm');
  const calendarDayDifference = differenceInCalendarDays(due, today);
  if (calendarDayDifference === -1) return `Ontem às ${time}`;
  if (calendarDayDifference === 0) return `Hoje às ${time}`;
  if (calendarDayDifference === 1) return `Amanhã às ${time}`;
  return format(due, "dd/MM/yyyy 'às' HH:mm");
};
