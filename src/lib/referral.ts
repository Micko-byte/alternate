const KEY = "alternate-ref";

/** Remember a store's referral code from ?ref= so it's used when the shopper signs up. */
export function captureReferral(search: string) {
  const code = new URLSearchParams(search).get("ref");
  if (code) {
    try {
      localStorage.setItem(KEY, code.trim().toUpperCase());
    } catch {
      /* storage blocked: referral simply isn't remembered */
    }
  }
}

export function storedReferral() {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
