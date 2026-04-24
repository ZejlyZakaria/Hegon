/** Format a Date to YYYY-MM-DD using local time (avoids UTC shift) */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Format a YYYY-MM-DD string to a human-readable date (timezone-safe) */
export function formatEntryDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/** Return the first line of content, truncated to maxLength chars */
export function getPreview(content: string, maxLength = 100): string {
  const firstLine = content.split('\n')[0];
  return firstLine.length > maxLength
    ? firstLine.slice(0, maxLength) + '...'
    : firstLine;
}

/** Return the 7 Date objects for Mon→Sun of the week containing `today` */
export function getCurrentWeekDays(today: Date): Date[] {
  const dayOfWeek = today.getDay(); // 0=Sun
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - daysSinceMonday + i);
    return d;
  });
}

/** Return grid metadata for a calendar month (1-based month) */
export function getMonthGrid(year: number, month: number): {
  daysInMonth: number;
  startDayOfWeek: number; // 0=Mon, 6=Sun
} {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  return { daysInMonth, startDayOfWeek };
}
