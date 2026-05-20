import type { APIRoute } from 'astro';
import { streamText, stepCountIs, tool, jsonSchema, type LanguageModel } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { queryFreeBusy } from '../../lib/calendar';
import {
  buildSlotsForDate,
  parseDateString,
  slotIsAvailable,
  slotIsInFuture,
  validateBookingDate,
} from '../../lib/booking-validation';
import { performBooking } from '../../lib/booking';
import { rateLimit, getClientIp } from '../../lib/rate-limit';
import { optionalEnv } from '../../lib/env';

export const prerender = false;

// Provider selection. To swap which provider is primary, just reorder the
// checks below — whichever block runs first wins when both env vars are set.
// Today: Together AI is the working credential; AI Gateway sits as fallback
// until a Vercel project is fully linked.
function pickModel(): LanguageModel | null {
  const togetherKey = optionalEnv('TOGETHER_AI_API_KEY');
  if (togetherKey) {
    const modelId = optionalEnv('TOGETHER_MODEL', 'Qwen/Qwen2.5-7B-Instruct-Turbo');
    const together = createOpenAICompatible({
      name: 'together',
      baseURL: 'https://api.together.xyz/v1',
      apiKey: togetherKey,
    });
    return together.chatModel(modelId);
  }
  const gatewayKey = optionalEnv('AI_GATEWAY_API_KEY');
  if (gatewayKey) {
    // Gateway routes provider/model strings directly. Cheap default; can be
    // swapped to 'openai/gpt-5-mini' or 'anthropic/claude-haiku-4-5' if needed.
    return 'openai/gpt-5-nano' as unknown as LanguageModel;
  }
  return null;
}

const SYSTEM_PROMPT = `You are Amplo AI, the assistant on amploconsulting.com.

About Amplo Consulting:
- A Miami-based firm built for high-growth tech companies and creator businesses.
- Tagline: "Focus on building. We'll handle the rest."
- Service areas:
  1. Stay Compliant: data protection, privacy, and industry-specific compliance audits.
  2. Run It Like a Real Company: governance frameworks, policies, and decision structures.
  3. Stop Risks Before They Hit: proactive risk identification across operations, contracts, and exposure.
  4. Navigate the Rules: hands-on support through complex regulatory environments.
  5. Protect User Data: privacy-by-design audits (GDPR, CCPA, and more) for data-intensive platforms.
  6. Lock Down Your IP: contract drafting/negotiation, trademarks, copyrights, patents.

How to help visitors:
- Be brief, warm, and editorial. Match the firm's polished tone. No slang, no hype, no emoji.
- Answer questions about services concisely. If asked something outside the firm's scope, say so and offer to take a message via Roger@amploconsulting.com.
- IMPORTANT: Never use em dashes (—) in your responses. Use commas, periods, or restructure the sentence. Em dashes make replies feel AI-generated.

Booking, IMPORTANT RULES:
- To check availability, you MUST call the getAvailability tool. Never invent slots or claim a date is open without calling the tool.
- To book a meeting, you MUST call the bookAppointment tool. Never confirm a booking unless that tool returned ok:true. If you tell the visitor "you're booked" without calling the tool, they will not actually be on the calendar.
- Required fields for bookAppointment: startISO (from getAvailability), name, email, mobile, and industry. The notes field is optional and only included when the visitor shares specifics.
- If the visitor hasn't given you one of the required fields, ask for it before calling the tool. Ask in plain language, like "What industry are you in?" rather than presenting a long dropdown.
- Booking window: 30-minute intro calls only, Monday through Friday 9 AM to 6 PM Eastern, up to 45 days in advance.
- After bookAppointment returns ok:true, confirm the exact date/time it returned (the "when" field), then tell them to check their email for a calendar attachment.
- If bookAppointment returns ok:false, share the error message and offer to try a different slot.

Other guardrails:
- Never invent prices, fee schedules, or attorney-client claims. Amplo Consulting is a consulting firm, not a law firm. Do not provide legal advice.
- If you don't know something, say so and offer to connect them with Roger@amploconsulting.com.`;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// --- Tool: check availability for a specific date -----------------------

const getAvailabilityTool = tool({
  description:
    'Look up open 30-minute meeting slots for a specific date (M-F only, 9 AM – 6 PM ET). Returns a list of times the visitor can book.',
  inputSchema: jsonSchema<{ date: string }>({
    type: 'object',
    properties: {
      date: {
        type: 'string',
        description: 'Date in YYYY-MM-DD format, e.g. "2026-05-22"',
      },
    },
    required: ['date'],
    additionalProperties: false,
  }),
  execute: async ({ date }) => {
    console.log('[chat:tool] getAvailability called', { date });
    const dateCheck = validateBookingDate(date);
    if (!dateCheck.ok) {
      console.log('[chat:tool] getAvailability rejected', dateCheck.error);
      return { ok: false, error: dateCheck.error };
    }
    const parsed = parseDateString(date)!;
    const slots = buildSlotsForDate(parsed.year, parsed.month, parsed.day);
    if (slots.length === 0) return { ok: true, date, slots: [] };

    const windowStart = new Date(new Date(slots[0]!.startISO).getTime() - 60 * 60 * 1000);
    const windowEnd = new Date(
      new Date(slots[slots.length - 1]!.endISO).getTime() + 60 * 60 * 1000
    );

    let busy: { startMs: number; endMs: number }[];
    try {
      busy = await queryFreeBusy(windowStart.toISOString(), windowEnd.toISOString());
    } catch (err) {
      console.log('[chat:tool] getAvailability freeBusy failed', err);
      return { ok: false, error: 'Could not load availability. Please try again.' };
    }

    const available = slots
      .filter((s) => slotIsInFuture(s) && slotIsAvailable(s, busy))
      .map((s) => ({ startISO: s.startISO, label: s.label }));
    console.log('[chat:tool] getAvailability returning', { date, count: available.length });
    return { ok: true, date, slots: available };
  },
});

// --- Tool: book an appointment ------------------------------------------

const bookAppointmentTool = tool({
  description:
    "Book a 30-minute Amplo Consulting intro call. Only call this once you have the visitor's name, email, mobile, and industry. The startISO must be one of the available slots returned by getAvailability.",
  inputSchema: jsonSchema<{
    startISO: string;
    name: string;
    email: string;
    mobile: string;
    industry: string;
    notes?: string;
  }>({
    type: 'object',
    properties: {
      startISO: {
        type: 'string',
        description: 'ISO 8601 timestamp of the slot start (from getAvailability).',
      },
      name: { type: 'string', description: 'Visitor full name.' },
      email: { type: 'string', description: 'Visitor email address.' },
      mobile: { type: 'string', description: 'Visitor mobile phone.' },
      industry: {
        type: 'string',
        description:
          "Visitor's industry or role. Examples: SaaS / Software, Fintech, E-commerce / D2C, Influencer / Creator, Marketing / Advertising, Sales / Revenue Ops, Healthtech, AI / ML, Edtech, Real Estate / Proptech, Crypto / Web3, Media / Publishing, Venture Capital / Investing, Other.",
      },
      notes: {
        type: 'string',
        description:
          "Optional one or two sentence note about what the visitor wants to discuss. Only include if they shared specifics.",
      },
    },
    required: ['startISO', 'name', 'email', 'mobile', 'industry'],
    additionalProperties: false,
  }),
  execute: async (input) => {
    console.log('[chat:tool] bookAppointment called', {
      startISO: input.startISO,
      name: input.name,
      email: input.email,
      hasMobile: !!input.mobile,
      industry: input.industry,
      notesLen: input.notes?.length ?? 0,
    });
    const result = await performBooking({
      ...input,
      notes: input.notes ?? '',
    });
    if (!result.ok) {
      console.log('[chat:tool] bookAppointment failed', result.error);
      return { ok: false, error: result.error };
    }
    // Format the confirmed time back in ET so the AI can repeat it to the user.
    const when = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    }).format(new Date(result.startISO));
    console.log('[chat:tool] bookAppointment succeeded', { eventId: result.eventId, when });
    return { ok: true, when, eventId: result.eventId };
  },
});

// ------------------------------------------------------------------------

interface IncomingMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function sanitizeMessages(raw: unknown): IncomingMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: IncomingMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue;
    const role = (m as { role?: unknown }).role;
    const content = (m as { content?: unknown }).content;
    if ((role === 'user' || role === 'assistant') && typeof content === 'string') {
      // Cap each message to avoid blowing up token budget on a hostile client.
      out.push({ role, content: content.slice(0, 4000) });
    }
  }
  // Keep at most the last 20 turns.
  return out.slice(-20);
}

export const POST: APIRoute = async ({ request }) => {
  const ip = getClientIp(request.headers);
  const limited = rateLimit(`chat:${ip}`, 30, 5 * 60 * 1000);
  if (!limited.ok) {
    return json(429, { error: 'Too many messages. Please slow down.' });
  }

  let body: { messages?: unknown };
  try {
    body = (await request.json()) as { messages?: unknown };
  } catch {
    return json(400, { error: 'Invalid request body.' });
  }
  const messages = sanitizeMessages(body.messages);
  if (messages.length === 0) {
    return json(400, { error: 'No messages.' });
  }

  const model = pickModel();
  if (!model) {
    return json(500, {
      error:
        'AI is not configured. Set AI_GATEWAY_API_KEY or TOGETHER_AI_API_KEY.',
    });
  }

  try {
    const result = streamText({
      model,
      system: SYSTEM_PROMPT,
      messages,
      tools: {
        getAvailability: getAvailabilityTool,
        bookAppointment: bookAppointmentTool,
      },
      // Allow the model to run a tool, see the result, and respond with text.
      stopWhen: stepCountIs(5),
    });
    return result.toTextStreamResponse();
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('[chat] streamText failed:', e.message);
    return json(500, { error: 'AI is temporarily unavailable. Please try again.' });
  }
};
