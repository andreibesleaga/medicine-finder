import { describe, it, expect } from "vitest";
import { webUrl } from "@/lib/utils";

describe("record links", () => {
  it("keeps web addresses and drops other schemes", () => {
    expect(webUrl("https://www.ema.europa.eu/en/medicines")).toBe("https://www.ema.europa.eu/en/medicines");
    expect(webUrl("http://example.org/x")).toBe("http://example.org/x");
    expect(webUrl("javascript:alert(1)")).toBeUndefined();
    expect(webUrl("data:text/html,x")).toBeUndefined();
    expect(webUrl("not a url")).toBeUndefined();
    expect(webUrl(undefined)).toBeUndefined();
  });
});
