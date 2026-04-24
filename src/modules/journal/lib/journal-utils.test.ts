import { describe, it, expect } from 'vitest';
import {
  toDateStr,
  formatEntryDate,
  getPreview,
  getCurrentWeekDays,
  getMonthGrid,
} from './journal-utils';

// ── toDateStr ──────────────────────────────────────────────────────────────

describe('toDateStr', () => {
  it('formats a date to YYYY-MM-DD', () => {
    expect(toDateStr(new Date(2026, 3, 24))).toBe('2026-04-24'); // April = month 3
  });

  it('pads single-digit month and day', () => {
    expect(toDateStr(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('handles end of year', () => {
    expect(toDateStr(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

// ── formatEntryDate ────────────────────────────────────────────────────────

describe('formatEntryDate', () => {
  it('formats a date string to a human-readable date', () => {
    const result = formatEntryDate('2026-04-24');
    expect(result).toContain('April');
    expect(result).toContain('24');
    expect(result).toContain('2026');
  });

  it('does not shift the date due to UTC (timezone-safe)', () => {
    // '2026-01-01' parsed as UTC would show Dec 31 in UTC+N timezones
    const result = formatEntryDate('2026-01-01');
    expect(result).toContain('January');
    expect(result).toContain('1');
    expect(result).toContain('2026');
  });
});

// ── getPreview ─────────────────────────────────────────────────────────────

describe('getPreview', () => {
  it('returns the first line', () => {
    expect(getPreview('Hello\nSecond line')).toBe('Hello');
  });

  it('truncates at 100 chars by default', () => {
    const long = 'a'.repeat(120);
    const result = getPreview(long);
    expect(result).toBe('a'.repeat(100) + '...');
  });

  it('respects custom maxLength', () => {
    const result = getPreview('Hello world', 5);
    expect(result).toBe('Hello...');
  });

  it('returns full line when shorter than maxLength', () => {
    expect(getPreview('Short line')).toBe('Short line');
  });

  it('returns empty string for empty content', () => {
    expect(getPreview('')).toBe('');
  });
});

// ── getCurrentWeekDays ─────────────────────────────────────────────────────

describe('getCurrentWeekDays', () => {
  it('returns 7 days', () => {
    expect(getCurrentWeekDays(new Date(2026, 3, 24))).toHaveLength(7);
  });

  it('starts on Monday when today is Wednesday', () => {
    const wednesday = new Date(2026, 3, 22); // April 22 = Wednesday
    const week = getCurrentWeekDays(wednesday);
    expect(toDateStr(week[0])).toBe('2026-04-20'); // Monday
    expect(toDateStr(week[6])).toBe('2026-04-26'); // Sunday
  });

  it('starts on Monday when today is Monday', () => {
    const monday = new Date(2026, 3, 20); // April 20 = Monday
    const week = getCurrentWeekDays(monday);
    expect(toDateStr(week[0])).toBe('2026-04-20');
    expect(toDateStr(week[6])).toBe('2026-04-26');
  });

  it('starts on Monday when today is Sunday', () => {
    const sunday = new Date(2026, 3, 26); // April 26 = Sunday
    const week = getCurrentWeekDays(sunday);
    expect(toDateStr(week[0])).toBe('2026-04-20'); // Monday
    expect(toDateStr(week[6])).toBe('2026-04-26'); // Sunday
  });
});

// ── getMonthGrid ───────────────────────────────────────────────────────────

describe('getMonthGrid', () => {
  it('returns correct days for April 2026', () => {
    const { daysInMonth, startDayOfWeek } = getMonthGrid(2026, 4);
    expect(daysInMonth).toBe(30);
    expect(startDayOfWeek).toBe(2); // April 1 2026 = Wednesday = index 2 (Mo=0)
  });

  it('returns correct days for February 2024 (leap year)', () => {
    const { daysInMonth } = getMonthGrid(2024, 2);
    expect(daysInMonth).toBe(29);
  });

  it('returns correct days for February 2026 (non-leap)', () => {
    const { daysInMonth } = getMonthGrid(2026, 2);
    expect(daysInMonth).toBe(28);
  });

  it('returns startDayOfWeek=0 when month starts on Monday', () => {
    // June 2026: June 1 = Monday
    const { startDayOfWeek } = getMonthGrid(2026, 6);
    expect(startDayOfWeek).toBe(0);
  });

  it('returns startDayOfWeek=6 when month starts on Sunday', () => {
    // March 2026: March 1 = Sunday
    const { startDayOfWeek } = getMonthGrid(2026, 3);
    expect(startDayOfWeek).toBe(6);
  });
});
