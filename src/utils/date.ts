import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import isBetween from 'dayjs/plugin/isBetween.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);

export { dayjs };

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export function hebrewDay(date: dayjs.Dayjs): string {
  return HEBREW_DAYS[date.day()];
}

export function formatDateHebrew(date: dayjs.Dayjs): string {
  return `יום ${hebrewDay(date)}, ${date.format('DD/MM')}`;
}

export function formatTime(date: dayjs.Dayjs): string {
  return date.format('HH:mm');
}

/** Parse relative Hebrew date references */
export function parseHebrewDate(text: string, tz: string): dayjs.Dayjs | null {
  const now = dayjs().tz(tz);

  if (/היום/.test(text)) return now;
  if (/מחר/.test(text)) return now.add(1, 'day');
  if (/מחרתיים/.test(text)) return now.add(2, 'day');

  // Day names: "ביום שני", "יום רביעי"
  for (let i = 0; i < HEBREW_DAYS.length; i++) {
    if (text.includes(HEBREW_DAYS[i])) {
      let target = now;
      while (target.day() !== i) {
        target = target.add(1, 'day');
      }
      // If it's today and user said the day name, assume next week
      if (target.isSame(now, 'day')) {
        target = target.add(7, 'day');
      }
      return target;
    }
  }

  // Try DD/MM or DD.MM format
  const dateMatch = text.match(/(\d{1,2})[\/\.](\d{1,2})/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1]);
    const month = parseInt(dateMatch[2]) - 1;
    let result = now.month(month).date(day);
    if (result.isBefore(now, 'day')) {
      result = result.add(1, 'year');
    }
    return result;
  }

  return null;
}

/** Parse time from Hebrew text */
export function parseHebrewTime(text: string): string | null {
  // "10:30", "10.30"
  const timeMatch = text.match(/(\d{1,2})[:\.](\d{2})/);
  if (timeMatch) {
    return `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
  }

  // "ב10", "בשעה 14"
  const hourMatch = text.match(/(?:ב|בשעה\s*)(\d{1,2})/);
  if (hourMatch) {
    return `${hourMatch[1].padStart(2, '0')}:00`;
  }

  return null;
}
