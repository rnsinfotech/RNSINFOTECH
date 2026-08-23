const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email) {
  return EMAIL_RE.test((email || "").trim());
}

/**
 * Password rules: 8+ chars, at least one lowercase, one uppercase,
 * one digit, one symbol. Returns an array of unmet rules so the UI
 * can show a live checklist instead of one opaque error.
 */
const PASSWORD_RULES = [
  { id: "length", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { id: "lower", label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { id: "upper", label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { id: "digit", label: "One number", test: (p) => /\d/.test(p) },
  { id: "symbol", label: "One symbol", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function getPasswordChecklist(password) {
  const pw = password || "";
  return PASSWORD_RULES.map((rule) => ({ id: rule.id, label: rule.label, met: rule.test(pw) }));
}

export function isPasswordValid(password) {
  return getPasswordChecklist(password).every((r) => r.met);
}

export function passwordStrengthScore(password) {
  const checklist = getPasswordChecklist(password);
  return checklist.filter((r) => r.met).length; // 0-5
}

/**
 * hashPassword — NOT real cryptography. There's no backend here, so
 * there's no way to do this properly client-side (anything stored in
 * localStorage is inherently readable by the user's own browser).
 * This just avoids keeping the raw password string around in plain
 * form. A production build must do real password hashing (bcrypt /
 * argon2) on a server — this function exists purely so the demo
 * doesn't literally write "password: 'hunter2'" into localStorage.
 */
export function hashPassword(password) {
  let hash = 0;
  const str = `rns::${password}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `h${hash}`;
}

export function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
