// Once a browser has been told no, it never asks again — it just fails. The
// only way back is the settings menu, and that menu is in a different place
// in every browser. So work out which one this is and say exactly where.

export type Unblock = { where: string; steps: string[] };

export function unblockSteps(): Unblock {
  if (typeof navigator === "undefined") {
    return { where: "your browser", steps: ["Allow the microphone for this site, then reload."] };
  }

  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const isFirefox = /Firefox\//.test(ua);
  const isEdge = /Edg\//.test(ua);
  const isChrome = /Chrome\//.test(ua) && !isEdge;
  const isSafari = /Safari\//.test(ua) && !/Chrome|Chromium|Edg|CriOS|FxiOS/.test(ua);

  // Home-screen web apps get their own permissions, separate from the browser.
  const standalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true);

  if (isIOS) {
    if (standalone) {
      return {
        where: "iPhone Settings",
        steps: [
          "Open the Settings app",
          "Scroll down and tap Privacy & Security",
          "Tap Microphone",
          "Turn on the switch for this app",
          "Come back and reopen it",
        ],
      };
    }
    return {
      where: "Safari",
      steps: [
        "Tap the AA button on the left of the address bar",
        "Tap Website Settings",
        "Set Microphone to Allow",
        "Tap Done, then reload the page",
        "If Microphone isn't listed: Settings app → Safari → Microphone → Allow",
      ],
    };
  }

  if (isAndroid) {
    return {
      where: "Chrome",
      steps: [
        "Tap the icon on the left of the address bar (a padlock or sliders)",
        "Tap Permissions",
        "Tap Microphone and choose Allow",
        "Reload the page",
        "Still stuck? Android Settings → Apps → Chrome → Permissions → Microphone",
      ],
    };
  }

  if (isFirefox) {
    return {
      where: "Firefox",
      steps: [
        "Click the padlock on the left of the address bar",
        "Find Microphone and click the X to clear the blocked setting",
        "Reload the page",
        "Tap the record button again and choose Allow when asked",
      ],
    };
  }

  if (isChrome || isEdge) {
    return {
      where: isEdge ? "Edge" : "Chrome",
      steps: [
        "Click the icon on the left of the address bar (sliders, padlock or info)",
        "Click Site settings, or find Microphone in the list",
        "Change Microphone to Allow",
        "Reload the page",
        "Also check Windows Settings → Privacy & security → Microphone is on",
      ],
    };
  }

  if (isSafari) {
    return {
      where: "Safari",
      steps: [
        "Open the Safari menu and choose Settings for This Website",
        "Set Microphone to Allow",
        "Reload the page",
        "Also check System Settings → Privacy & Security → Microphone → Safari",
      ],
    };
  }

  return {
    where: "your browser",
    steps: [
      "Open the site permissions for this page, usually via the icon in the address bar",
      "Set Microphone to Allow",
      "Reload the page",
    ],
  };
}
