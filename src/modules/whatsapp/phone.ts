/**
 * Normalize a Mexican phone number to WhatsApp format (52 + 10 digits).
 *
 * Handles:
 *  "+528281111023"      → "528281111023"
 *  "528281111023"       → "528281111023"
 *  "8281111023"         → "528281111023"
 *  "+52 1 828 111 1023" → "528281111023"  (strips spaces and legacy 1)
 *
 * Returns null if the input can't be normalized to a valid number.
 */
export function formatMexicanPhone(raw: string | null | undefined): string | null {
  if (!raw) return null

  // Strip everything that isn't a digit
  const digits = raw.replace(/\D/g, "")

  // 10 digits — local number, prepend country code
  if (digits.length === 10) {
    return `52${digits}`
  }

  // 12 digits starting with 52 — already formatted
  if (digits.length === 12 && digits.startsWith("52")) {
    return digits
  }

  // 13 digits starting with 521 — legacy format with extra "1" after country code
  if (digits.length === 13 && digits.startsWith("521")) {
    return `52${digits.slice(3)}`
  }

  // Unrecognized format
  return null
}
