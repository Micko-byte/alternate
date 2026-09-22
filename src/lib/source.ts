const KEY = "vaa-source";

/**
 * Where a visitor came from, remembered from the first link they opened.
 * Put ?s=tiktok-bio (or utm_source) on every link in an ad or a bio, and the account
 * that link produces carries the tag, so a campaign can be judged by sign-ups and
 * paid try-ons rather than by guesswork.
 */
export function captureSource(search: string) {
  const p = new URLSearchParams(search);
  const tag = p.get("s") || p.get("utm_source");
  if (!tag) return;
  const campaign = p.get("c") || p.get("utm_campaign");
  const value = [tag, campaign].filter(Boolean).join(":").slice(0, 60);
  try {
    if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, value); // first touch wins
  } catch {
    /* storage blocked: the visit is simply untagged */
  }
}

export function storedSource() {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
