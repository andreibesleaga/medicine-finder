export function jsonResponse(body: unknown, status = 200, type = "application/json"): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": type } });
}

export type Route = [string | RegExp, (url: string) => Response | Promise<Response>];

/** A fetch stub that answers by URL; unknown URLs fail like a network error. */
export function stubFetch(routes: Route[]) {
  const calls: string[] = [];
  const fn = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    for (const [m, reply] of routes) if (typeof m === "string" ? url.includes(m) : m.test(url)) return reply(url);
    throw new TypeError("Failed to fetch");
  }) as typeof fetch & { calls: string[] };
  fn.calls = calls;
  return fn;
}
