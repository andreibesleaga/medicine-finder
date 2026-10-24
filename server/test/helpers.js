// Test helpers: a fetch stub that answers by URL and a fixed clock.

export function jsonResponse(body, { status = 200, type = "application/json" } = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": type } });
}

/** routes: Array<[RegExp | string, (url, init) => Response | Promise<Response>]> */
export function stubFetch(routes) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url: String(url), init });
    for (const [match, reply] of routes) {
      if (typeof match === "string" ? String(url).includes(match) : match.test(String(url))) return reply(String(url), init);
    }
    throw new Error(`unexpected request ${url}`);
  };
  fn.calls = calls;
  return fn;
}

export function fixedClock(start = Date.parse("2026-01-15T10:00:00Z")) {
  let t = start;
  const now = () => t;
  now.advance = (ms) => {
    t += ms;
  };
  return now;
}
