// src/app/core/utils/attendance-calendar.util.ts
//
// Calendar-grid generation was previously copy-pasted identically between
// student-attendance-component.ts and parent-attendance-component.ts.
// Pulled out here so both views (and any future one — teacher self-view?)
// share one implementation.

import { ReconstructedAttendanceRecord } from '../services/attendance.service';

export interface AttendanceCalendarDay {
    date: Date;
    dateStr: string;
    /** null for padding days (prev/next month) — those are never fetched. */
    record: ReconstructedAttendanceRecord | null;
    isCurrentMonth: boolean;
    isToday: boolean;
    isFuture: boolean;
}

export function toDateStr(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Builds a 7-column calendar grid (with leading/trailing padding days)
 * for the given month, attaching the matching reconstructed record to
 * each in-month day.
 */
export function buildAttendanceCalendarDays(
    year: number,
    month: number, // 1-indexed
    records: ReconstructedAttendanceRecord[]
): AttendanceCalendarDay[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const recordMap = new Map(records.map((r) => [r.date, r]));

    const days: AttendanceCalendarDay[] = [];

    const makeDay = (date: Date, isCurrentMonth: boolean): AttendanceCalendarDay => {
        const dateStr = toDateStr(date);
        return {
            date,
            dateStr,
            record: isCurrentMonth ? recordMap.get(dateStr) ?? null : null,
            isCurrentMonth,
            isToday: date.getTime() === today.getTime(),
            isFuture: date > today,
        };
    };

    // Leading padding (previous month's trailing days)
    for (let i = 0; i < firstDay.getDay(); i++) {
        days.push(makeDay(new Date(year, month - 1, -firstDay.getDay() + i + 1), false));
    }

    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
        days.push(makeDay(new Date(year, month - 1, d), true));
    }

    // Trailing padding to complete the last week row
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
        for (let i = 1; i <= remaining; i++) {
            days.push(makeDay(new Date(year, month, i), false));
        }
    }

    return days;
}