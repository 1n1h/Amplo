# Amplo Consulting — Form & Admin Addendum

This is an addendum to the main Claude Code build brief. Read after the main brief. Covers: how contact form submissions are stored, how Roger gets notified, and how I manage leads from an admin page.

## Architecture Change

The site is no longer purely static. The contact form needs server-side handling (validate input, write to storage, send email). That means:

- **Astro mode:** `output: 'hybrid'` with the Vercel adapter. Marketing pages stay static (fast). API routes and admin pages opt into server-rendering.
- **Vercel Functions** handle the dynamic parts. Free tier covers this.

## Submission Flow

When someone submits the contact form on the marketing page:

1. **POST to `/api/submit-lead`** (Astro API route, runs as a Vercel Function)
2. **Validate input** — name + email + message required, email format checked, basic anti-spam (honeypot field, optional rate limit)
3. **Append a row to Google Sheets** via the Sheets API using a service account
4. **Send Roger a notification email** via Resend with the lead details and a link to the admin page
5. **Return success** to the browser; show a "Thanks, we'll be in touch within one business day" confirmation in place of the form

If any of those steps fail, log the error and still try to email Roger via a fallback (e.g., even if the Sheets write fails, the Resend email still fires so the lead isn't lost).

## Google Sheet Schema

One sheet, named `Leads`, with these columns (in this order):

| Column | Type | Notes |
|---|---|---|
| A: Timestamp | ISO 8601 string | Set on submission, server-side |
| B: Name | text | From form |
| C: Email | text | From form |
| D: Mobile | text | From form (optional, may be empty) |
| E: Message | text | From form |
| F: Status | text | One of: `New`, `Contacted`, `Qualified`, `Closed-Won`, `Closed-Lost`. Default `New`. |
| G: Notes | text | Free-text, editable from admin page |
| H: Last Updated | ISO 8601 | Auto-updated when Status or Notes change |

I will create this Sheet manually and share it with the service account email Claude Code helps me generate.

## Email Notification (Resend)

Roger gets an email per new lead:

- From: `leads@amploconsulting.com` (after I verify the domain in Resend) or Resend's onboarding domain initially
- To: Roger's email (Roger@amploconsulting.com)
- Subject: `New lead: [Name] — [Company if extractable from email domain]`
- Body: lead details + link to the admin page on amploconsulting.com/admin

## Admin Page

Route: `/admin` on amploconsulting.com

### Authentication

- Login form at `/admin/login` — single password field
- Hardcoded password (stored as env var, not in source): `Amplo123`
- On correct submission, set an HttpOnly cookie `amplo_admin_session` with a signed token (use a simple HMAC of "admin:expiry-timestamp" with a SESSION_SECRET env var)
- Session expires after 7 days
- Middleware on `/admin/*` (except `/admin/login`) checks the cookie; redirects to login if missing/invalid

**Security note to me:** This is "good enough" for a low-volume consulting lead pipeline. It is not bulletproof. A determined attacker could brute-force `Amplo123`. Mitigations Claude Code should add:
- Rate limit `/admin/login` to 5 attempts per 15 minutes per IP
- Use HTTPS (Vercel does this automatically)
- Don't echo the password back; don't include it in any error message
- Eventually I should upgrade to a real auth solution if the site stays in use long-term. Flag this in a code comment.

### Admin UI

Single page showing all leads as a table. Columns:

- Timestamp (formatted nicely, e.g., "Nov 4, 2025 · 3:42 PM")
- Name
- Email (mailto: link)
- Mobile (tel: link if present)
- Message (truncated to ~100 chars, click to expand or open a modal with full text)
- Status (dropdown: New / Contacted / Qualified / Closed-Won / Closed-Lost) — changing it writes back to the Sheet
- Notes (inline editable text field, saves on blur) — writes back to the Sheet
- Last Updated

Above the table:

- **Filter dropdown** to filter by Status
- **Search box** to filter by Name / Email / Message content
- **Download CSV** button — exports the current view (filtered + searched) as a CSV file
- **Refresh** button to re-fetch from the Sheet (in case Roger edited the Sheet directly)
- **Lead count** display (e.g., "12 leads · 3 new")

Below the table:

- **Logout** link that clears the session cookie

Visual style: keep it on-brand. Navy bg, Cream text, Gold accents — same design system as the marketing site, but more compact and data-dense. This is an internal tool, prioritize legibility and density over editorial whitespace.

### API Routes Behind the Admin

- `GET /api/admin/leads` — returns all rows from the Sheet as JSON. Requires valid session cookie.
- `PATCH /api/admin/leads/:rowId` — updates Status and/or Notes for a specific row. Writes back to the Sheet using its row index. Requires valid session cookie.
- `GET /api/admin/export` — returns CSV of all rows (or accepts query params for filtering). Requires valid session cookie.
- `POST /api/admin/logout` — clears the session cookie.

## Environment Variables

I will set these in Vercel (Project Settings → Environment Variables). Claude Code should reference them via `import.meta.env.VAR_NAME`:

| Variable | Purpose |
|---|---|
| `GOOGLE_SHEET_ID` | The ID of the Sheet (from the URL) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | The service account email from Google Cloud |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | The service account private key (PEM string) |
| `RESEND_API_KEY` | From the Resend dashboard |
| `RESEND_FROM_EMAIL` | `leads@amploconsulting.com` (or Resend's onboarding email initially) |
| `LEAD_NOTIFICATION_EMAIL` | Roger's email |
| `ADMIN_PASSWORD` | `Amplo123` |
| `SESSION_SECRET` | A random 32+ char string (Claude Code can generate one for me to paste) |

## Setup Steps I'll Need to Do (Outside of Code)

Walk me through each of these step-by-step when we get to them:

1. **Create the Google Sheet** with the schema above.
2. **Create a Google Cloud project + service account:**
   - Enable the Google Sheets API
   - Create a service account, generate a JSON key
   - Share the Sheet with the service account email (Editor permission)
   - Extract the email and private key from the JSON, paste into Vercel env vars
3. **Sign up for Resend** (resend.com)
   - Optional: verify the `amploconsulting.com` domain (lets you send from `leads@amploconsulting.com`)
   - Generate an API key, paste into Vercel
4. **Set all env vars in Vercel** Project Settings
5. **Deploy** — Vercel rebuilds with the new env vars and the dynamic routes work

## Build Order (Within the Section-by-Section Plan)

The form and admin work happens after the marketing sections are built. Suggested order:

1. Header
2. Hero
3. Scroll marquee
4. About
5. Services
6. **Contact section UI** (form layout, no submission yet)
7. Footer
8. **Hook up form submission** (`/api/submit-lead`, Sheets append, Resend email)
9. **Build admin login + auth middleware**
10. **Build admin dashboard** (leads table, status toggle, notes, CSV export)
11. **Test end-to-end:** submit a fake lead from the form, verify Sheet row, verify email, log into admin, change status, add note, download CSV
12. **Mobile responsiveness pass**
13. **Deploy + DNS cutover**

## Future Hardening (Flag as Code Comments, Don't Build Now)

- Replace hardcoded `Amplo123` with a real auth provider (Clerk, Auth.js, or even just a per-user invite system)
- Add 2FA on the admin
- Add audit log (who changed what, when)
- Add Slack/Discord webhook as a second notification channel
- Add a "convert lead to deal" workflow (export to a CRM)

Don't build any of this now — just leave `// TODO:` comments where it'd plug in, so it's obvious what to harden later.
