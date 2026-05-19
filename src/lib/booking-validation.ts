// Validation + slot math for the booking flow.
// All times are reasoned about in America/New_York (Miami time).

export const BOOKING_TZ = 'America/New_York';
export const SLOT_MINUTES = 30;
export const BUFFER_MINUTES = 15;
export const WORK_START_HOUR = 9; // 9:00 AM ET — first slot starts here
export const WORK_END_HOUR = 18; // 6:00 PM ET — last slot must END by this hour
export const BOOKING_HORIZON_DAYS = 45; // how far ahead someone can book

// Internal helper: get the timezone offset (in minutes) for America/New_York
// at a given UTC instant. Accounts for DST. Returns e.g. -240 in summer, -300 in winter.
function nyOffsetMinutes(utcMs: number): number {
  // Use Intl to format the same instant in NY and figure out the wall-clock offset.
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: BOOKING_TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const y = get('year');
  const mo = get('month');
  const d = get('day');
  const h = get('hour') === 24 ? 0 : get('hour'); // Intl can render midnight as 24
  const mi = get('minute');
  const s = get('second');
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  // (NY wall clock as UTC) - (real UTC) == offset minutes
  return Math.round((asUtc - utcMs) / 60000);
}

// Build a Date for "this Y-M-D H:M in America/New_York". Handles DST.
function nyDateTimeToUtc(year: number, month1: number, day: number, hour: number, minute: number): Date {
  // Guess: pretend the wall clock IS UTC, then subtract NY's offset at that moment.
  const guessMs = Date.UTC(year, month1 - 1, day, hour, minute, 0);
  // First-pass offset using the guess. Refine once (handles DST boundary edge).
  let offset = nyOffsetMinutes(guessMs);
  let realMs = guessMs - offset * 60000;
  const refined = nyOffsetMinutes(realMs);
  if (refined !== offset) {
    offset = refined;
    realMs = guessMs - offset * 60000;
  }
  return new Date(realMs);
}

// Parse "YYYY-MM-DD" — strict.
export function parseDateString(s: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  // Round-trip check so e.g. 2026-02-31 fails.
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

// Day-of-week in America/New_York for a given Y-M-D. 0=Sun..6=Sat.
function nyWeekday(year: number, month1: number, day: number): number {
  // Noon on that date in NY is unambiguous re: DST.
  const noonNy = nyDateTimeToUtc(year, month1, day, 12, 0);
  // Use Intl to get the weekday name in that TZ.
  const wk = new Intl.DateTimeFormat('en-US', {
    timeZone: BOOKING_TZ,
    weekday: 'short',
  }).format(noonNy);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wk);
}

export interface DateValidation {
  ok: boolean;
  error?: string;
  weekday?: number;
}

export function validateBookingDate(dateStr: string, nowMs = Date.now()): DateValidation {
  const parsed = parseDateString(dateStr);
  if (!parsed) return { ok: false, error: 'Invalid date.' };
  const { year, month, day } = parsed;

  const weekday = nyWeekday(year, month, day);
  if (weekday === 0 || weekday === 6) {
    return { ok: false, error: 'Bookings are only available Monday through Friday.' };
  }

  // Must not be in the past (compare against today in NY).
  const todayNy = todayInNy(nowMs);
  const compare =
    year * 10000 + month * 100 + day - (todayNy.year * 10000 + todayNy.month * 100 + todayNy.day);
  if (compare < 0) return { ok: false, error: 'That date has already passed.' };

  // Must be within the booking horizon.
  const horizonMs = nowMs + BOOKING_HORIZON_DAYS * 24 * 60 * 60 * 1000;
  const dateNoonMs = nyDateTimeToUtc(year, month, day, 12, 0).getTime();
  if (dateNoonMs > horizonMs) {
    return {
      ok: false,
      error: `Bookings are only open ${BOOKING_HORIZON_DAYS} days in advance.`,
    };
  }

  return { ok: true, weekday };
}

export function todayInNy(nowMs = Date.now()): { year: number; month: number; day: number } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: BOOKING_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = dtf.formatToParts(new Date(nowMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

export interface Slot {
  startISO: string; // e.g. 2026-05-22T09:00:00-04:00
  endISO: string;
  label: string; // "9:00 AM"
}

// Build all candidate slots for a given local date (no availability check yet).
export function buildSlotsForDate(year: number, month1: number, day: number): Slot[] {
  const slots: Slot[] = [];
  const labelFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: BOOKING_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  for (let h = WORK_START_HOUR; h < WORK_END_HOUR; h++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      // Skip the last partial slot if start + duration > work end.
      const endH = h + Math.floor((m + SLOT_MINUTES) / 60);
      const endM = (m + SLOT_MINUTES) % 60;
      if (endH > WORK_END_HOUR || (endH === WORK_END_HOUR && endM > 0)) continue;
      const startDate = nyDateTimeToUtc(year, month1, day, h, m);
      const endDate = nyDateTimeToUtc(year, month1, day, endH, endM);
      slots.push({
        startISO: startDate.toISOString(),
        endISO: endDate.toISOString(),
        label: labelFmt.format(startDate),
      });
    }
  }
  return slots;
}

// Returns true iff the slot is bookable given a list of busy blocks (with buffer).
export function slotIsAvailable(slot: Slot, busy: { startMs: number; endMs: number }[]): boolean {
  const slotStart = new Date(slot.startISO).getTime();
  const slotEnd = new Date(slot.endISO).getTime();
  const bufferMs = BUFFER_MINUTES * 60 * 1000;
  for (const b of busy) {
    // A slot conflicts if any busy block overlaps the slot window expanded by the buffer.
    if (b.startMs < slotEnd + bufferMs && b.endMs > slotStart - bufferMs) {
      return false;
    }
  }
  return true;
}

// Returns true iff slot start is in the future (with 5 min cushion so we don't
// take bookings that start in the next 5 min — those are basically impossible to honor).
export function slotIsInFuture(slot: Slot, nowMs = Date.now()): boolean {
  return new Date(slot.startISO).getTime() > nowMs + 5 * 60 * 1000;
}

// Validate a booking submission's payload.
export interface BookingInput {
  name: string;
  email: string;
  mobile: string;
  message: string;
  startISO: string;
}

export interface BookingValidationResult {
  ok: boolean;
  data?: BookingInput;
  error?: string;
  spam?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function trimStr(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}

export function validateBookingInput(input: Record<string, unknown>): BookingValidationResult {
  if (typeof input.company_website === 'string' && input.company_website.trim().length > 0) {
    return { ok: true, spam: true };
  }

  const name = trimStr(input.name, 200);
  const email = trimStr(input.email, 320).toLowerCase();
  const mobile = trimStr(input.mobile, 50);
  const message = trimStr(input.message, 5000);
  const startISO = trimStr(input.startISO, 40);

  if (!name) return { ok: false, error: 'Please enter your name.' };
  if (!email) return { ok: false, error: 'Please enter your email.' };
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Please enter a valid email address.' };
  if (!startISO) return { ok: false, error: 'Please pick a time.' };

  const startDate = new Date(startISO);
  if (Number.isNaN(startDate.getTime())) return { ok: false, error: 'Invalid time selected.' };

  return { ok: true, data: { name, email, mobile, message, startISO: startDate.toISOString() } };
}
