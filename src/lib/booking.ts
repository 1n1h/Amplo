// Shared booking flow: validate → re-check availability → create event → email.
// Used by both /api/book (form submission) and the Amplo AI chat tool.
import { createBookingEvent, queryFreeBusy } from './calendar';
import {
  SLOT_MINUTES,
  slotIsAvailable,
  slotIsInFuture,
  validateBookingInput,
} from './booking-validation';
import { sendBookingEmails } from './resend';
import { appendLead } from './sheets';

export interface BookingAttempt {
  name: string;
  email: string;
  mobile: string;
  message: string;
  startISO: string;
}

export type BookingOutcome =
  | { ok: true; eventId: string; startISO: string; endISO: string }
  | { ok: false; status: number; error: string };

export async function performBooking(raw: Record<string, unknown>): Promise<BookingOutcome> {
  const result = validateBookingInput(raw);
  if (!result.ok) {
    return { ok: false, status: 400, error: result.error ?? 'Invalid input.' };
  }
  if (result.spam || !result.data) {
    // Honeypot — treat as success without doing anything.
    return { ok: true, eventId: 'spam-skipped', startISO: '', endISO: '' };
  }
  const lead = result.data;

  const startMs = new Date(lead.startISO).getTime();
  const endMs = startMs + SLOT_MINUTES * 60 * 1000;
  const endISO = new Date(endMs).toISOString();
  const slot = { startISO: lead.startISO, endISO, label: '' };

  if (!slotIsInFuture(slot)) {
    return {
      ok: false,
      status: 400,
      error: 'That time has already passed. Please pick another slot.',
    };
  }

  const checkStart = new Date(startMs - 60 * 60 * 1000).toISOString();
  const checkEnd = new Date(endMs + 60 * 60 * 1000).toISOString();
  let busy: { startMs: number; endMs: number }[];
  try {
    busy = await queryFreeBusy(checkStart, checkEnd);
  } catch (err) {
    console.error('[booking] freeBusy failed:', err);
    return {
      ok: false,
      status: 502,
      error: 'Could not verify availability. Please try again.',
    };
  }
  if (!slotIsAvailable(slot, busy)) {
    return {
      ok: false,
      status: 409,
      error: 'That time was just taken. Please choose another slot.',
    };
  }

  let eventId: string;
  try {
    const event = await createBookingEvent({
      startISO: lead.startISO,
      endISO,
      name: lead.name,
      email: lead.email,
      mobile: lead.mobile,
      message: lead.message,
    });
    eventId = event.id;
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('[booking] create failed:', e.message);
    return {
      ok: false,
      status: 500,
      error: 'Booking failed. Please try again or email Roger@amploconsulting.com.',
    };
  }

  // The event is on the calendar — that's the source of truth. Email + Sheet
  // failures shouldn't undo the booking; just log them.
  try {
    await sendBookingEmails({
      name: lead.name,
      email: lead.email,
      mobile: lead.mobile,
      message: lead.message,
      startISO: lead.startISO,
      endISO,
      eventId,
    });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('[booking] email send failed (event still created):', e.message);
  }

  // Also log the booking to the Amplo Leads sheet (column I = Appointment).
  try {
    await appendLead({
      name: lead.name,
      email: lead.email,
      mobile: lead.mobile,
      message: lead.message,
      appointmentISO: lead.startISO,
    });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('[booking] sheet append failed (event still created):', e.message);
  }

  return { ok: true, eventId, startISO: lead.startISO, endISO };
}
