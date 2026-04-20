export const cleanSubjectName = (rawString) => {
  if (!rawString) return '';
  let cleaned = String(rawString).trim();
  
  if (cleaned.includes('-')) {
    cleaned = cleaned.split('-').slice(1).join('-').trim();
  }
  if (cleaned.includes(':')) {
    cleaned = cleaned.split(':')[0].trim();
  }
  
  // Sanitize for Firestore Document ID (replace slashes and specific special chars with dashes)
  cleaned = cleaned.replace(/[\/\\\.\#\$\[\]]/g, '-');
  
  return cleaned || String(rawString);
};
