/**
 * OFUSCA Google Apps Script Web App endpoint.
 * Purpose: receive website registration/payment/publicity form submissions
 * and save them into a Google Sheet database.
 *
 * Setup:
 * 1. Create a Google Sheet named "OFUSCA Member Database".
 * 2. Create tabs: Raw Form Responses, Birthday Calendar, Member Spotlight Queue,
 *    Business Directory, Dues & Donations, Volunteers, Do Not Publish List.
 * 3. Extensions > Apps Script, paste this code.
 * 4. Replace SPREADSHEET_ID with your Sheet ID.
 * 5. Deploy > New deployment > Web App.
 * 6. Execute as: Me. Who has access: Anyone.
 * 7. Copy the Web App URL into assets/js/integrations-config.js.
 */

const SPREADSHEET_ID = 'PASTE_YOUR_GOOGLE_SHEET_ID_HERE';
const RAW_TAB = 'Raw Form Responses';
const SPOTLIGHT_TAB = 'Member Spotlight Queue';
const DUES_TAB = 'Dues & Donations';
const DO_NOT_PUBLISH_TAB = 'Do Not Publish List';

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const raw = getOrCreateSheet_(ss, RAW_TAB);

    appendObjectRow_(raw, {
      timestamp: new Date(),
      source: payload.source || 'website',
      full_name: payload.full_name || '',
      preferred_name: payload.preferred_name || '',
      email: payload.email || '',
      phone: payload.phone || '',
      whatsapp: payload.whatsapp || '',
      country: payload.country || '',
      state_province: payload.state_province || '',
      city: payload.city || '',
      birthday_month: payload.birthday_month || '',
      birthday_day: payload.birthday_day || '',
      marital_status: payload.marital_status || '',
      spouse_name: payload.spouse_name || '',
      number_of_children: payload.number_of_children || '',
      profession: payload.profession || '',
      employer_business: payload.employer_business || '',
      industry: payload.industry || '',
      publicity_interest: payload.publicity_interest || '',
      consent_records: payload.consent_records || '',
      consent_publicity: payload.consent_publicity || '',
      contact_before_public_use: payload.contact_before_public_use || '',
      raw_json: JSON.stringify(payload)
    });

    if ((payload.publicity_interest || '').toLowerCase().includes('yes') || payload.spotlight_details) {
      appendObjectRow_(getOrCreateSheet_(ss, SPOTLIGHT_TAB), {
        timestamp: new Date(),
        member_name: payload.full_name || '',
        title: payload.spotlight_title || '',
        profession: payload.profession || '',
        business: payload.employer_business || '',
        details: payload.spotlight_details || payload.business_description || '',
        platform: payload.publicity_platform || '',
        consent_publicity: payload.consent_publicity || '',
        status: 'Needs Review'
      });
    }

    if (payload.payment_type || payload.payment_amount || payload.payment_reference) {
      appendObjectRow_(getOrCreateSheet_(ss, DUES_TAB), {
        timestamp: new Date(),
        member_name: payload.full_name || '',
        email: payload.email || '',
        payment_type: payload.payment_type || '',
        payment_amount: payload.payment_amount || '',
        payment_reference: payload.payment_reference || '',
        payment_method: payload.payment_method || '',
        status: 'Needs Verification'
      });
    }

    if (payload.contact_before_public_use || !payload.consent_publicity) {
      appendObjectRow_(getOrCreateSheet_(ss, DO_NOT_PUBLISH_TAB), {
        timestamp: new Date(),
        member_name: payload.full_name || '',
        email: payload.email || '',
        instruction: payload.privacy_notes || 'Contact before public use / no publicity consent recorded'
      });
    }

    return json_({ ok: true, message: 'Submission saved successfully.' });
  } catch (error) {
    return json_({ ok: false, message: error.message });
  }
}

function parsePayload_(e) {
  if (e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); } catch (err) {}
  }
  return e.parameter || {};
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function appendObjectRow_(sheet, obj) {
  const headers = sheet.getLastRow() === 0 ? [] : sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const keys = Object.keys(obj);
  const finalHeaders = headers.length ? headers.slice() : keys.slice();
  keys.forEach(k => { if (!finalHeaders.includes(k)) finalHeaders.push(k); });
  if (!headers.length) sheet.appendRow(finalHeaders);
  const row = finalHeaders.map(h => obj[h] || '');
  sheet.appendRow(row);
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
