# Amplo Consulting — Claude Code Build Brief

## Context

I'm rebuilding amploconsulting.com from scratch in code. The previous attempt was a WordPress + Elementor build that was too slow to iterate on. I want a static marketing site, deployed to Vercel, free hosting, fast load times.

I am the office manager at Amplo Consulting (Miami legal and business consulting firm, owner: Roger Jacknin). I am not a developer, but I am sharp on content and design direction. Treat me as a beginner on tooling but capable of running commands you give me. Default to clear step-by-step instructions when I need to run something locally, deploy, or hit a snag.

## Goal

Build a one-page editorial marketing site for a legal/compliance consulting firm. Five main sections plus header and footer. Deploy to Vercel. Point amploconsulting.com at it.

## Tech Stack (locked)

- **Astro** (latest stable) — content-focused static site framework, zero JS by default, great for marketing sites
- **Tailwind CSS** — utility-first, fast iteration, easy to encode the design tokens below
- **Google Fonts** — Cormorant Garamond (display) + Inter (UI/body), self-hosted via Astro's font integration or `@fontsource`
- **Formspree** for the contact form — free tier, drop-in form action URL, no backend code needed (alternative: Vercel Functions + Resend, but Formspree is simpler for now)
- **Vercel** deployment via GitHub integration

If you have strong reason to recommend a different stack (e.g., Next.js, vanilla HTML, etc.), say so upfront with reasoning — but Astro is the default unless I agree otherwise.

## Design System

### Colors

| Token | Hex | Usage |
|---|---|---|
| Navy (background) | `#0B1936` | Site background, primary surface |
| Navy Elevated | `#13234A` | Cards, raised surfaces (services cards) |
| Cream (Primary text) | `#EDE5D2` | All display headings, primary UI text |
| Periwinkle (Secondary) | `#B8C2DC` | Italic accent words inside headings (e.g., "together", "growth and success", "next chapter") |
| Text Muted | `#A6B0C8` | Body paragraphs, descriptions, captions |
| Gold (Accent) | `#C9A961` | Primary button bg, eyebrow labels, dividers, diamond bullet markers, service-card top accent bars |
| Gold Hover | `#B79752` | Hover state on primary buttons |

### Typography

- **Headings:** Cormorant Garamond, weight 500. Italic accent words are the same family/weight, just italicized. Example: `We grow <em>together</em> — that's our promise.`
- **Body:** Inter, weight 400, line-height 1.65, color text-muted
- **UI / Buttons / Eyebrows / Nav:** Inter, weight 600, uppercase, letter-spacing ~0.15em
- **Eyebrow labels** (e.g., "ABOUT AMPLO", "WHAT WE DO", "LET'S BEGIN") are small-caps gold, accompanied by a short thin gold horizontal line

Type scale (suggested, adjust as needed):
- H1 hero: ~64-72px desktop / 40-48px mobile
- H2 section: ~48-56px desktop / 32-40px mobile  
- H3 card: ~24-28px
- Body: 16-18px
- Eyebrow: 12px
- Nav: 12px, uppercase, letter-spacing 0.15em
- Button: 14px, uppercase, letter-spacing 0.15em

### Layout

- Generous whitespace, editorial spacing — this is a premium consulting firm, not a SaaS landing page
- Max content width ~1280-1320px
- Section vertical padding: ~120-160px desktop, scaled down on mobile
- Thin gold horizontal dividers (1px, gold #C9A961, ~40px wide) for eyebrow accents
- Cards: rounded corners (subtle, ~4-8px), Navy Elevated background, a gold top-bar accent (~4px thick, ~40px wide, top-left)

### Tone

Editorial. Confidential. Premium. Moving away from generic consulting template. Think editorial magazine more than tech startup.

## Content (source of truth)

```markdown
## Header
- Amplo.  (text wordmark, Cormorant Garamond 500, Cream, period in Gold)
- About
- Services
- Contact
- CTA: Get in Touch

## Hero
Eyebrow: WELCOME TO AMPLO CONSULTING
Headline: We help companies grow with purpose.
  (italic accent on "grow with purpose")
Description: Comprehensive legal, compliance, and business strategy for startups and technology companies navigating complex environments.
CTAs: 
  - Our Services (primary, gold bg, navy text)
  - Get in Touch (secondary, outlined, cream text + 1.5px cream border)

## Scroll Animation Strip
A horizontal marquee under the hero with these keywords cycling, each separated by short gold horizontal lines:
- COMPLIANCE ASSESSMENTS
- GOVERNANCE ADVISORY
- RISK MANAGEMENT
- IP PROTECTION
- BUSINESS STRATEGY
(loop infinitely, slow scroll, ~30-60s per full cycle, pause on hover)

## About
Eyebrow: ABOUT AMPLO
Headline: We grow together — that's our promise.
  (italic accent on "together")
Description: As catalysts of innovation, we stand shoulder-to-shoulder with startups and tech companies, turning aspirations into achievements and pioneering the future, together.
Bullet list (gold diamond ◆ markers, items separated by thin gold horizontal dividers):
  - Tailored engagements with transparent scope
  - Fractional general counsel for any growth stage
  - Specialists in tech, fintech, and data-intensive sectors

## Services
Eyebrow: WHAT WE DO
Headline: Tailored solutions designed to drive your growth and success.
  (italic accent on "growth and success")
6 numbered cards in a 3-column grid (desktop), 2-column (tablet), 1-column (mobile). Each card has:
  - A gold top-bar accent
  - Number "01" — "06" in large Cormorant Garamond, gold
  - "SERVICE" label top-right, small-caps gold
  - Service name in Cormorant Garamond, Cream
  - Description in Inter, text-muted
  - Navy Elevated background

01 — Compliance Assessments
Thorough assessments to ensure your business meets data protection, privacy, and industry-specific compliance requirements.

02 — Governance Advisory
Establishing effective governance frameworks, policies, and procedures aligned to your legal and regulatory obligations.

03 — Risk Management
Proactive identification and mitigation of operational, legal, and strategic risk across your organization.

04 — Regulatory Compliance
Guidance and hands-on support for navigating complex, industry-specific regulatory environments.

05 — Data Protection
Privacy-by-design audits and frameworks for data-intensive technology platforms (GDPR, CCPA, and more).

06 — Legal Contracts & IP
Reviewing, drafting, and negotiating contracts, plus trademarks, copyrights, and patent protection strategies.

## Contact
Eyebrow: LET'S BEGIN
Headline: Ready to architect your next chapter?
  (italic accent on "next chapter")
Description: Tell us about your project — we'll respond within one business day.
Form fields:
  - Name (text, placeholder "Your name", required)
  - Email (email, placeholder "you@company.com", required)
  - Mobile (tel, placeholder "+1 (555) 555-5555", optional)
  - Message (textarea, placeholder "Tell us about your project...", required)
CTA: Send Message (gold bg primary button)
Note: secondary CTA pattern from hero (gold + outlined) also appears in the final contact CTA panel in AC_New_contact.jpg with "Book a Consultation" + "Email Us Directly" — implement if it fits, otherwise just the form is fine.

## Footer
- Left: Amplo. wordmark (same style as header)
- Right: Privacy Policy link · © 2026 Amplo Consulting, LLC — Miami, FL
Slim, navy, thin top border in muted gold or cream.
```

## Visual References

Attached screenshots show the target design. They are the authoritative visual reference — if I describe something and the screenshots disagree, follow the screenshots and flag the discrepancy.

- `web_images\AC_New_hero.jpg` — header, hero, scroll marquee
- `web_images\AC_New_about.jpg` — about section with eyebrow, headline, italic accent, diamond bullets
- `web_images\AC_New_services.jpg` — 6 numbered service cards layout
- `web_images\AC_New_contact.jpg` — contact CTA panel + footer

## House Style Rules

- **No em dashes in copy** except where they appear in the approved Site_Content above as part of editorial headlines ("We grow together — that's our promise") — those are intentional. Don't add new em dashes elsewhere; use commas, colons, or parentheses.
- Sentence case for body and most UI. UPPERCASE for nav items, button labels, and eyebrow tags only.
- All buttons and nav items uppercase with letter-spacing.
- Italic accent words inside headings should be subtle — same font, just italicized, slightly lighter optical weight if the typeface allows. Color them Periwinkle (`#B8C2DC`).

## File Structure (suggested)

```
amplo/
├── src/
│   ├── pages/
│   │   └── index.astro          # single-page site, all sections imported here
│   ├── components/
│   │   ├── Header.astro
│   │   ├── Hero.astro
│   │   ├── ScrollMarquee.astro
│   │   ├── About.astro
│   │   ├── Services.astro
│   │   ├── ServiceCard.astro     # used 6x inside Services
│   │   ├── Contact.astro
│   │   ├── ContactForm.astro
│   │   └── Footer.astro
│   ├── styles/
│   │   └── global.css            # @tailwind directives, design tokens, font imports
│   └── content/
│       └── services.json         # the 6 services as data, mapped into ServiceCard
├── public/
│   ├── favicon.svg
│   └── og-image.jpg              # social share image (build later)
├── astro.config.mjs
├── tailwind.config.mjs           # color/font/spacing tokens
└── package.json
```

## Functionality Requirements

- **Smooth scroll** on nav anchor links (`#about`, `#services`, `#contact`) and on hero CTAs.
- **Sticky header** with subtle background opacity change on scroll (navy stays navy, but slight backdrop-blur or shadow can appear).
- **Mobile menu** — hamburger reveal, navy backdrop, links stack vertically with generous spacing. On mobile the GET IN TOUCH button can collapse into the menu or remain as a compact icon-button; either is fine, follow the AC_New_hero.jpg if it shows mobile (it doesn't, so use your judgment).
- **Scroll-triggered fade-ups** on section entrance (subtle, ~600ms ease-out, ~20px translation). Use Intersection Observer or `@view-transitions` if appropriate. Keep animations premium and minimal — no bounce, no playful motion.
- **Hover states** on service cards: subtle elevation, top-bar accent extends slightly. On buttons: gold → gold hover.
- **Form submission** via Formspree — I'll create a Formspree account and give you the endpoint URL; until then, use a placeholder `https://formspree.io/f/YOUR_FORM_ID`.

## Accessibility

- Semantic HTML throughout (`<header>`, `<main>`, `<section>`, `<nav>`, `<footer>`, proper heading hierarchy H1 → H2 → H3).
- Color contrast meets WCAG AA against the Navy bg. Cream and Gold both clear AA on Navy. Verify text-muted (`#A6B0C8`) on Navy hits AA for normal text (should — but check).
- Focus states visible (gold outline on buttons and links).
- Alt text on any images (decorative ones get `alt=""`).
- Form fields have proper labels (visually hidden if needed for the placeholder-only design).

## SEO Basics

- `<title>`: "Amplo Consulting — Legal, Compliance & Business Strategy for Startups | Miami"
- `<meta name="description">`: "Comprehensive legal, compliance, and business strategy for startups and technology companies navigating complex environments. Based in Miami."
- Open Graph + Twitter card meta tags
- Structured data: `LegalService` schema (JSON-LD) with name, address, phone, services
- Sitemap.xml (Astro has a built-in integration)
- Robots.txt allowing all

## Deployment Plan

1. **Local dev**: `npm create astro@latest`, scaffold the project, build the site locally, run on `http://localhost:4321` to preview.
2. **GitHub**: push the repo to a new GitHub repo (private is fine).
3. **Vercel**: connect the GitHub repo to a new Vercel project. Auto-detect Astro. Free tier.
4. **Vercel preview URL**: confirms it works on `*.vercel.app`.
5. **Custom domain**: in Vercel project settings → Domains, add `amploconsulting.com` and `www.amploconsulting.com`.
6. **DNS update**: Vercel will give me the exact records to add. I'll update DNS at the domain registrar OR in SiteGround's DNS panel (whichever currently manages the zone — likely SiteGround since the site is hosted there). Vercel typically needs:
   - `A` record on apex `amploconsulting.com` → `76.76.21.21` (Vercel anycast IP)
   - `CNAME` on `www` → `cname.vercel-dns.com`
7. **Wait for DNS propagation** (usually minutes, can take up to 48 hours but rare).
8. **Verify**: https://amploconsulting.com loads the new site, HTTPS auto-issued by Vercel.

I will keep the SiteGround WordPress install running until DNS is fully cut over and the new site is verified live. After that, I'll decide whether to keep SiteGround (e.g., if email lives there) or cancel it.

## What I Want You to Do Right Now (first session)

1. Acknowledge you've read this brief.
2. Confirm Astro + Tailwind + Formspree + Vercel is the right call (or push back with reasoning if not).
3. Walk me through scaffolding the Astro project locally. Step-by-step. Commands I run, what I should see after each one. Assume I have Node.js installed (or tell me how to install it if not — I'm on a Mac/Windows, ask me which).
4. Once the empty Astro project is running on localhost, build Section 1 (Header) end-to-end — components, styles, design tokens wired up, responsive behavior. Show me the result, then we iterate.

We'll build section-by-section the same way — one section per chunk, with me previewing locally between each.

## What I Don't Want

- Generic SaaS landing-page aesthetic (gradients, glassmorphism, oversized blob shapes, big rounded "card" everything).
- Bouncy or playful animations.
- A heavy framework when Astro will do.
- Auth, accounts, a CMS, a database. This is a static marketing site.

## Reference Files (in this project)

- `Site_Content.md` — copy source of truth (already captured in this brief above)
- `AC_New_hero.jpg`, `AC_New_about.jpg`, `AC_New_services.jpg`, `AC_New_contact.jpg` — target design
- `AC_Current_*.jpg` — old site, for context only, don't copy

Let's build.
