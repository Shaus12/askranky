// Decides what the scan form does when Turnstile has not produced a token yet.
// "wait" keeps the in-progress challenge (resetting it is what makes a fast first tap fail in a slow webview).
// "reset" is only for a failed widget, or a ready widget whose token is already empty.
// "send" still goes through the server Turnstile check. This never skips it.
export function turnstileSubmitAction(siteKey, token, state) {
  if (!siteKey || token) return "send";
  // "off" is the frame before the widget reports "loading". Resetting either one throws away a challenge that is still starting.
  if (state === "loading" || state === "off") return "wait";
  return "reset";
}
