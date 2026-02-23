/** Normalize phone number to international format (e.g., 972501234567) */
export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)\+]/g, '');

  // Israeli numbers: 05X → 9725X
  if (cleaned.startsWith('05')) {
    cleaned = '972' + cleaned.slice(1);
  }
  // Already has country code with leading 0
  if (cleaned.startsWith('0972')) {
    cleaned = cleaned.slice(1);
  }

  return cleaned;
}
