import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js/max';

export const callingCodes = Object.fromEntries(getCountries().map(code => [code, getCountryCallingCode(code)]));

export function contactDetails(body) {
  const method = body.contactMethod ?? 'email';
  if (method === 'email') {
    const email = String(body.email ?? '').trim();
    return email.length <= 200 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? { method, email, phone: '' } : null;
  }
  if (!['whatsapp', 'telegram'].includes(method)) return null;
  const phone = String(body.phone ?? '').trim().replace(/[٠-٩۰-۹]/g, digit =>
    String(digit.charCodeAt(0) % 16));
  if (!/^\+?[\d\s().-]+$/.test(phone) || phone.length > 40) return null;
  const international = phone.replace(/^00/, '+');
  const country = typeof body.country === 'string' ? body.country.toUpperCase() : '';
  if (!international.startsWith('+') && !Object.hasOwn(callingCodes,country)) return null;
  const number = parsePhoneNumberFromString(international,{
    defaultCountry: Object.hasOwn(callingCodes,country) ? country : undefined,
    extract:false,
  });
  return number?.isValid() ? { method, email:'', phone:number.number } : null;
}

export async function ensureMessageDetails(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS message_details (
    id TEXT PRIMARY KEY, method TEXT NOT NULL DEFAULT 'email',
    phone TEXT NOT NULL DEFAULT '', ip TEXT, user_agent TEXT,
    archived INTEGER NOT NULL DEFAULT 0
  )`).run();
}

export function deviceInfo(userAgent) {
  const ua = userAgent ?? '';
  const os = /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Android/i.test(ua) ? 'Android'
    : /Windows/i.test(ua) ? 'Windows' : /CrOS/i.test(ua) ? 'ChromeOS'
    : /Macintosh|Mac OS/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : '';
  const device = /iPad|Tablet/i.test(ua) || (os === 'Android' && !/Mobile/i.test(ua)) ? 'Tablet'
    : /Mobile|iPhone|iPod/i.test(ua) ? 'Phone' : os ? 'Computer' : '';
  return { os, device };
}

export async function readMessages(db) {
  await ensureMessageDetails(db);
  const { results = [] } = await db.prepare(`SELECT m.id,m.name,m.email,m.message,m.is_read,m.created_at,
    d.method,d.phone,d.ip,d.user_agent,d.archived FROM messages m
    LEFT JOIN message_details d ON d.id=m.id ORDER BY m.created_at DESC LIMIT 250`).all();
  return results.map(({ is_read, archived, method, user_agent, ...row }) => ({
    ...row, contactMethod: method || 'email', read: Boolean(is_read), archived: Boolean(archived),
    ...deviceInfo(user_agent),
  }));
}
