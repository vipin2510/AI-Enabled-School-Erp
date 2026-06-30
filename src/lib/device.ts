// Tiny user-agent device classifier (no dependency). Used to tailor the demo:
// a real phone only gets the mobile view; desktops AND tablets (incl. iPad) get
// both the laptop and mobile demo frames.

export type DeviceClass = "mobile" | "tablet" | "desktop";

export function deviceClass(ua: string | null | undefined): DeviceClass {
  const s = ua ?? "";
  // iPad (incl. iPadOS reporting as Mac with touch is treated as desktop here)
  // and Android tablets (Android without "Mobile") count as tablet.
  if (/\b(iPad|Tablet)\b/.test(s) || (/Android/.test(s) && !/Mobile/.test(s))) {
    return "tablet";
  }
  if (/(iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|Opera Mini|IEMobile)/i.test(s)) {
    return "mobile";
  }
  return "desktop";
}

// Only true phones are restricted to the mobile-only demo.
export function isPhone(ua: string | null | undefined): boolean {
  return deviceClass(ua) === "mobile";
}
