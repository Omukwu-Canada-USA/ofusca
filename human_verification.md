# OFUSCA Human Verification Layer

This version adds a human/robot verification layer to all public submission forms:

- Member registration/profile update form
- Payment confirmation form
- Contact form

## What is included

1. **Netlify reCAPTCHA integration**
   - Forms include `data-netlify-recaptcha="true"`.
   - Each protected form includes `<div data-netlify-recaptcha="true"></div>`.
   - When deployed on Netlify, this displays a reCAPTCHA challenge to help verify human users.

2. **Honeypot anti-spam field**
   - Bots often fill hidden fields. If the hidden `bot-field` is filled, the submission is blocked.

3. **Human confirmation checkbox**
   - Users must confirm they are human and submitting for official OFUSCA purposes.

4. **JavaScript timing check**
   - The form records when the page loaded and blocks extremely fast automated submissions.

5. **Security header updates**
   - The Content Security Policy now permits Google reCAPTCHA scripts and frames.

## Netlify deployment note

For the CAPTCHA to work properly, deploy this site on Netlify and confirm that Netlify Forms detects the forms after deployment. The local preview at `localhost:8080` will show the placeholder area, but Netlify processes the CAPTCHA after deployment.

## Important limitation

No public website can completely prevent every bot, cyberattack, clone, or malicious copy. This layer reduces automated spam and abuse, but the strongest protection also requires:

- Private GitHub repository
- Two-factor authentication on GitHub, Netlify, Google, and payment accounts
- Official payment processors only
- No storage of card numbers on the site
- Regular review of form submissions
- Admin approval before publishing member information
