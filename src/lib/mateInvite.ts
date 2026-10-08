const INVITE_BASE_URL = "https://nuj.social";
const PENDING_INVITE_CODE_KEY = "nuj.pending_invite_code";
const INVITE_CODE_PATTERN = /^[A-Z0-9]{7}$/;

export const APP_STORE_URL = "https://apps.apple.com/gb/app/nuj-social/id6789114237";

export const normalizeInviteCode = (value?: string | null): string | null => {
  const normalized = (value ?? "").trim().toUpperCase();
  return INVITE_CODE_PATTERN.test(normalized) ? normalized : null;
};

export const buildAddMateLink = (userCode: string) =>
  `${INVITE_BASE_URL}/add/${encodeURIComponent(userCode)}`;

export const buildInviteMessage = (userCode: string) =>
  `Join me on NUJ. Stay connected.\n\nTap to add me as a mate: ${buildAddMateLink(userCode)}\n\nOr add me using my NUJ code: ${userCode}\n\nDon't have NUJ yet? ${APP_STORE_URL}`;

// Returns the in-app route for an incoming link (e.g. universal link), or null if it isn't one of ours.
export const getInAppPathFromUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host !== "nuj.social") return null;
    return `${parsed.pathname}${parsed.search}` || "/";
  } catch {
    return null;
  }
};

export const savePendingInviteCode = (code: string) => {
  try {
    window.localStorage.setItem(PENDING_INVITE_CODE_KEY, code);
  } catch {
    // Storage unavailable; the invite just won't survive the login redirect.
  }
};

export const takePendingInviteCode = (): string | null => {
  try {
    const code = window.localStorage.getItem(PENDING_INVITE_CODE_KEY);
    if (code) window.localStorage.removeItem(PENDING_INVITE_CODE_KEY);
    return normalizeInviteCode(code);
  } catch {
    return null;
  }
};
