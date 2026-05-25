/**
 * Phone Formatter Utility
 * Normalizes and validates Pakistani phone numbers to standard 360dialog format (923XXXXXXXXX).
 */

/**
 * Normalizes a Pakistani phone number from various formats to 923XXXXXXXXX format.
 * Strips formatting (spaces, dashes, brackets, plus signs) and performs validation.
 * 
 * Valid inputs include:
 * - 03001234567
 * - 3001234567
 * - +923001234567
 * - 0092-300-1234567
 * - 92-300-1234567
 * - 300-1234567
 * - (0300) 1234567
 * 
 * @param {string|number} phoneNumber - The raw phone number string or number.
 * @returns {string} The normalized phone number starting with '923'.
 * @throws {Error} If the phone number is invalid or cannot be normalized.
 */
function normalizePhone(phoneNumber) {
  if (!phoneNumber) {
    throw new Error('Phone number is required');
  }

  // Convert to string and strip all spaces, dashes, brackets, plus signs, and other non-digits
  const cleaned = phoneNumber.toString().replace(/[\s\-\(\)\+]/g, '');

  // Regex validation patterns for Pakistani mobile numbers
  // Format 1: 11 digits starting with 03 (e.g., 03001234567)
  const is11Digit03 = /^03\d{9}$/.test(cleaned);
  
  // Format 2: 10 digits starting with 3 (e.g., 3001234567)
  const is10Digit3 = /^3\d{9}$/.test(cleaned);
  
  // Format 3: 12 digits starting with 923 (e.g., 923001234567)
  const is12Digit923 = /^923\d{9}$/.test(cleaned);
  
  // Format 4: 13 digits starting with 923 (e.g., 9230012345678 - to support scotch/user request pattern)
  const is13Digit923 = /^923\d{10}$/.test(cleaned);

  // Format 5: 14 digits starting with 00923 (e.g., 00923001234567)
  const is14Digit00923 = /^00923\d{9}$/.test(cleaned);

  // Format 6: 15 digits starting with 00923 (e.g., 009230012345678)
  const is15Digit00923 = /^00923\d{10}$/.test(cleaned);

  // If the cleaned input doesn't match any valid pattern, throw an error
  if (!(is11Digit03 || is10Digit3 || is12Digit923 || is13Digit923 || is14Digit00923 || is15Digit00923)) {
    throw new Error(`Invalid Pakistani phone number format: "${phoneNumber}"`);
  }

  // Perform normalization
  let normalized = cleaned;

  if (is14Digit00923 || is15Digit00923) {
    // Convert 00923XXXXXXXXX to 923XXXXXXXXX
    normalized = '92' + cleaned.substring(4);
  } else if (is11Digit03) {
    // Convert 03XXXXXXXXX to 923XXXXXXXXX
    normalized = '92' + cleaned.substring(1);
  } else if (is10Digit3) {
    // Convert 3XXXXXXXXX to 923XXXXXXXXX
    normalized = '92' + cleaned;
  }

  return normalized;
}

module.exports = {
  normalizePhone
};
