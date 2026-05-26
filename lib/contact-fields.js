export function normalizeContactFields(raw = {}) {
  const email = String(raw.contact_email || raw.contactEmail || "").trim();
  let phone = String(raw.contact_phone || raw.contactPhone || "").trim();
  phone = phone.replace(/\s*\([^)]*(mobile|移动|电话|phone)[^)]*\)\s*$/i, "").trim();

  return {
    contactEmail: email,
    contactPhone: phone,
  };
}
