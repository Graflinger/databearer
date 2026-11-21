// This is article attribution, not an image URL to fetch or descriptive alt text.
module.exports = function photoCredit(value) {
  if (value == null) return null;
  const fields = ['photographer', 'sourceUrl', 'license', 'licenseUrl', 'changes'];
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('imageCredit must be a mapping with a photographer');
  }
  const credit = {};
  for (const [key, input] of Object.entries(value)) {
    if (!fields.includes(key)) throw new Error(`Unknown imageCredit field: ${key}`);
    if (typeof input !== 'string' || !input.trim()) throw new Error(`imageCredit.${key} must be non-empty text`);
    credit[key] = input.trim();
  }
  if (!credit.photographer) throw new Error('imageCredit.photographer is required');
  if (credit.licenseUrl && !credit.license) throw new Error('imageCredit.licenseUrl requires a license label');
  for (const key of ['sourceUrl', 'licenseUrl']) {
    if (!credit[key]) continue;
    let url;
    try { url = new URL(credit[key]); } catch { /* Report the field below. */ }
    if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new Error(`imageCredit.${key} must be a public HTTP(S) URL`);
    }
    credit[key] = url.href;
  }
  return credit;
};
