// Once a browser has been told no, it never asks again — it just fails. The
// only way back is the settings menu. These routes are deliberately all
// menu-based: no "tap the icon in the address bar", because nobody knows
// which icon that is and every version of Chrome draws it differently.

export type Unblock = { where: string; steps: string[] };

function site(): string {
  if (typeof window === "undefined") return "this site";
  return window.location.hostname;
}

export function unblockSteps(): Unblock {
  if (typeof navigator === "undefined") {
    return { where: "your browser", steps: ["Allow the microphone for this site, then reload."] };
  }

  const ua = navigator.userAgent;
  const host = site();
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const isFirefox = /Firefox\//.test(ua);
  const isEdge = /Edg\//.test(ua);
  const isChrome = /Chrome\//.test(ua) && !isEdge;
  const isSafari = /Safari\//.test(ua) && !/Chrome|Chromium|Edg|CriOS|FxiOS/.test(ua);

  const standalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true);

  if (isAndroid) {
    return {
      where: "Chrome on Android",
      steps: [
        "Tap the three dots at the top right of Chrome",
        "Tap Settings",
        "Scroll down and tap Site settings",
        "Tap Microphone",
        `Under Blocked, tap ${host}`,
        "Tap Allow",
        "Come back here and reload the page",
        "If it isn't listed: Android Settings \u2192 Apps \u2192 Chrome \u2192 Permissions \u2192 Microphone \u2192 Allow",
      ],
    };
  }

  if (isIOS) {
    if (standalone) {
      return {
        where: "iPhone Settings",
        steps: [
          "Open the Settings app",
          "Tap Privacy & Security",
          "Tap Microphone",
          "Turn on the switch for this app",
          "Reopen it from your home screen",
        ],
      };
    }
    return {
      where: "Safari on iPhone",
      steps: [
        "Open the Settings app",
        "Tap Apps, then Safari (on older iPhones, scroll down to Safari)",
        "Scroll to the bottom and tap Microphone",
        "Choose Allow",
        "Come back here and reload the page",
        "Also check Settings \u2192 Privacy & Security \u2192 Microphone \u2192 Safari is on",
      ],
    };
  }

  if (isFirefox) {
    return {
      where: "Firefox",
      steps: [
        "Open the menu (three lines, top right) and click Settings",
        "Click Privacy & Security in the left column",
        "Scroll to Permissions and click Settings next to Microphone",
        `Select ${host} and click Remove Website`,
        "Click Save Changes, then reload this page",
        "Tap the record button again and choose Allow",
      ],
    };
  }

  if (isEdge) {
    return {
      where: "Edge",
      steps: [
        "Open the menu (three dots, top right) and click Settings",
        "Click Cookies and site permissions",
        "Scroll down and click Microphone",
        `Under Block, find ${host} and click the three dots next to it`,
        "Click Allow, then reload this page",
        "Also check Windows Settings \u2192 Privacy & security \u2192 Microphone is on",
      ],
    };
  }

  if (isChrome) {
    return {
      where: "Chrome",
      steps: [
        "Open the menu (three dots, top right) and click Settings",
        "Click Privacy and security in the left column",
        "Click Site settings, then Microphone",
        `Under "Not allowed to use your microphone", click ${host}`,
        "Change Microphone from Block to Allow",
        "Come back here and reload the page",
        "Also check Windows Settings \u2192 Privacy & security \u2192 Microphone is on",
      ],
    };
  }

  if (isSafari) {
    return {
      where: "Safari on Mac",
      steps: [
        "Open the Safari menu and click Settings",
        "Click the Websites tab",
        "Click Microphone in the left column",
        `Find ${host} and set it to Allow`,
        "Close Settings and reload this page",
        "Also check System Settings \u2192 Privacy & Security \u2192 Microphone \u2192 Safari",
      ],
    };
  }

  return {
    where: "your browser",
    steps: [
      "Open your browser's settings menu",
      "Find Site settings or Permissions",
      "Find Microphone and set this site to Allow",
      "Reload this page",
    ],
  };
}
