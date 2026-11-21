# OFUSCA International Website

This package contains a responsive static website for Omukwu Family USA & Canada Association (OFUSCA).

## New membership and payment features

- `register.html`: full member registration/profile update form.
- `dues-donations.html`: registration fee, annual dues, donation categories, and payment confirmation form.
- `membership.html`: membership overview linking members to registration and payment pages.
- `gallery.html`: updated member photo gallery.

## How to preview locally

```bash
cd ofusca-international-website
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## How to make the forms live

### Option A: Netlify Forms
This site already includes `data-netlify="true"` forms. When deployed on Netlify, submissions can be collected in the Netlify dashboard under Forms.

### Option B: Google Forms / Google Sheets
Create a Google Form with the same fields and embed it inside the placeholder on `register.html`, or connect this HTML form to Google Sheets using Google Apps Script, Zapier, Make, or Netlify form notifications.

## Payment links

Before publishing, replace placeholder links such as `YOUR_PAYMENT_LINK_FOR_FAMILY_DUES` with official OFUSCA-approved Stripe, PayPal, Zelle/Interac instruction pages, or other approved payment links.

## Privacy

Full date of birth, children’s details, phone numbers, and family details should be treated as private administrative information. Public birthday posts and member spotlight posts should use only information approved by the member.

## New in this version: database and authentication readiness

This version adds:

- `integrations.html` — Google Forms, Google Sheets, Apps Script and Supabase setup guidance.
- `member-portal.html` — Supabase-ready member portal placeholder.
- `admin.html` — future executive dashboard placeholder.
- `OFUSCA_DATABASE_SETUP.md` — step-by-step database setup guide.
- `assets/docs/google-apps-script-member-database.js` — Google Apps Script endpoint for sending website form submissions to Google Sheets.
- `assets/docs/supabase-schema.sql` — starter Supabase schema with Row Level Security enabled.
- `assets/js/integrations-config.js` — safe public configuration placeholder. Do not put private keys here.
- `assets/js/supabase-placeholder.js` — future portal connection placeholder.

Recommended launch path:

1. Launch the public site with Netlify Forms and reCAPTCHA.
2. Create Google Form/Sheet for the OFUSCA Member Database.
3. Use `integrations.html` to embed the form or connect Apps Script.
4. Build Supabase Auth only when OFUSCA is ready for member login and admin dashboard.
