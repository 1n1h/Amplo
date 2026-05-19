export interface LeadInput {
  name: string;
  email: string;
  mobile: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  data?: LeadInput;
  error?: string;
  // Honeypot tripped — treat as success client-side but never store/notify.
  spam?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function trimStr(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}

export function validateLead(input: Record<string, unknown>): ValidationResult {
  // Honeypot: bots fill all fields. Real users never see this one.
  if (typeof input.company_website === 'string' && input.company_website.trim().length > 0) {
    return { ok: true, spam: true };
  }

  const name = trimStr(input.name, 200);
  const email = trimStr(input.email, 320).toLowerCase();
  const mobile = trimStr(input.mobile, 50);
  const message = trimStr(input.message, 5000);

  if (!name) return { ok: false, error: 'Please enter your name.' };
  if (!email) return { ok: false, error: 'Please enter your email.' };
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Please enter a valid email address.' };
  if (!message) return { ok: false, error: 'Please tell us about your project.' };

  return { ok: true, data: { name, email, mobile, message } };
}
