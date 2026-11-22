import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("web app manifest", () => {
  it("makes the app installable as SpendWise Auto", () => {
    const m = manifest();
    expect(m).toMatchObject({
      name: "SpendWise Auto",
      short_name: "SpendWise",
      start_url: "/",
      display: "standalone",
      theme_color: "#065f46",
      background_color: "#f7f9f8",
    });
  });

  it("has the 192px, 512px and maskable icons browsers need", () => {
    const icons = manifest().icons ?? [];
    expect(icons.map((i) => [i.src, i.sizes, i.purpose ?? "any"])).toEqual([
      ["/icons/icon-192", "192x192", "any"],
      ["/icons/icon-512", "512x512", "any"],
      ["/icons/maskable-512", "512x512", "maskable"],
    ]);
  });
});
