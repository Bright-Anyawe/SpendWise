import { describe, expect, it } from "vitest";
import { pushSupport, vapidKeyToBytes, type BrowserTraits } from "./push-client";

const capable: BrowserTraits = {
  userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/131.0 Mobile",
  maxTouchPoints: 5,
  standalone: false,
  hasServiceWorker: true,
  hasPushManager: true,
  hasNotification: true,
};

const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Version/18.1 Mobile/15E148 Safari/604.1";
const ipad = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.1 Safari/605.1.15";

describe("pushSupport", () => {
  it("is supported in a capable browser", () => {
    expect(pushSupport(capable)).toBe("supported");
  });

  it("asks iPhone and iPad users to add the app to the Home Screen first", () => {
    expect(pushSupport({ ...capable, userAgent: iphone, hasPushManager: false })).toBe("ios-needs-install");
    expect(pushSupport({ ...capable, userAgent: ipad, maxTouchPoints: 5 })).toBe("ios-needs-install");
  });

  it("works on iPhone once opened from the Home Screen", () => {
    expect(pushSupport({ ...capable, userAgent: iphone, standalone: true })).toBe("supported");
  });

  it("treats a Mac without a touch screen as a desktop", () => {
    expect(pushSupport({ ...capable, userAgent: ipad, maxTouchPoints: 0 })).toBe("supported");
  });

  it("is unsupported without the Push API", () => {
    expect(pushSupport({ ...capable, hasPushManager: false })).toBe("unsupported");
  });
});

describe("vapidKeyToBytes", () => {
  it("decodes base64url without padding", () => {
    // "hello?" → base64 "aGVsbG8/" → base64url "aGVsbG8_"
    expect(Array.from(vapidKeyToBytes("aGVsbG8_"))).toEqual([104, 101, 108, 108, 111, 63]);
    expect(Array.from(vapidKeyToBytes("aGk"))).toEqual([104, 105]);
  });
});
