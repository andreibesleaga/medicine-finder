import { describe, it, expect } from "vitest";
import { coverageFrom, loadCoverage } from "@/lib/search/coverage";
import type { ServerSourceInfo } from "@/lib/search/serverApi";
import { jsonResponse, stubFetch } from "./helpers";

const src = (id: string, countries: string[], over: Partial<ServerSourceInfo> = {}): ServerSourceInfo => ({
  id,
  name: id,
  kind: "official",
  coverage: "",
  homepage: "",
  enabled: true,
  state: "ready",
  countries,
  ...over,
});

describe("coverage", () => {
  it("counts countries of official sources that are ready or live, the EU apart", () => {
    const c = coverageFrom([
      src("ema", ["European Union"]),
      src("a57", ["Germany", "Austria"]),
      src("cima", ["Spain"], { state: "live" }),
      src("bdpm", ["France"], { state: "loading" }),
      src("fimea", ["Finland"], { enabled: false, state: "disabled" }),
      src("curated", ["Italy"], { kind: "curated" }),
      src("dup", ["Germany"]),
    ]);
    expect(c).toEqual({ countries: ["Austria", "Germany", "Spain"], eu: true });
  });

  it("is null without a search server, and asks again next time", async () => {
    const down = stubFetch([[/./, () => jsonResponse("<!doctype html>", 200, "text/html")]]);
    expect(await loadCoverage(down)).toBeNull();
    const up = stubFetch([["/api/sources", () => jsonResponse({ sources: [src("x", ["Norway"])] })]]);
    expect(await loadCoverage(up)).toEqual({ countries: ["Norway"], eu: false });
  });
});
