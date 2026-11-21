# OFUSCA Member Database, Google Sheets, and Supabase Setup

This site is prepared for two stages:

1. **Immediate stage:** Google Forms or website form → Google Sheets.
2. **Advanced stage:** Supabase Auth + Supabase Database → protected member portal and admin dashboard.

## A. Recommended Google Sheet tabs

Create a Google Sheet called **OFUSCA Member Database** with these tabs:

- Raw Form Responses
- Birthday Calendar
- Member Spotlight Queue
- Business Directory
- Dues & Donations
- Volunteers
- Do Not Publish List

Use the Google Sheet for secretary, PRO, treasurer, financial secretary, welfare and committee coordination.

## B. Easiest setup: embed Google Form

1. Create a Google Form titled **OFUSCA Member Information & Publicity Form**.
2. Add the registration/profile questions from `register.html`.
3. In Google Forms, click **Responses** → link to a new Google Sheet.
4. Click **Send** → **Embed HTML**.
5. Paste the iframe into `integrations.html` or replace the registration form on `register.html` with the Google Form iframe.

This is the safest and easiest method for OFUSCA officers who prefer Google Sheets.

## C. Website form to Google Sheet using Apps Script

1. Create the Google Sheet and tabs above.
2. Open **Extensions → Apps Script**.
3. Paste the code from `assets/docs/google-apps-script-member-database.js`.
4. Replace `PASTE_YOUR_GOOGLE_SHEET_ID_HERE` with your actual Sheet ID.
5. Deploy as **Web App**.
6. Copy the deployment URL.
7. Paste it into `assets/js/integrations-config.js`.

Do not place Google account passwords or private credentials in the website files.

## D. Supabase portal setup for later

Use Supabase when OFUSCA is ready for real login and member-only pages.

1. Create a Supabase project.
2. Run `assets/docs/supabase-schema.sql` in the Supabase SQL editor.
3. Enable email authentication.
4. Confirm Row Level Security is enabled.
5. Create admin/executive roles.
6. Use the Supabase public URL and anon public key only after RLS is tested.
7. Never expose the Supabase service role key in frontend code.

## E. Privacy and consent

- Full date of birth should be administrative only.
- Public birthday posts should use month/day only unless the member approves otherwise.
- Keep a **Do Not Publish List** for members who opt out.
- Contact members before publicizing professional, business or family details if they request it.

## F. Payments

The website should link to approved external payment options such as PayPal, Stripe, Zelle, Interac or bank transfer. OFUSCA should store payment confirmation/reference only. Do not collect card details directly on the site.
