import { describe, it, expect } from "vitest";
import { linkSearch, searchParams } from "@/lib/search/searchLink";

describe("search links", () => {
  it("reads the term and a known country or region from the address", () => {
    expect(linkSearch(new URLSearchParams("q=ibuprofen&country=Germany"))).toEqual({ term: "ibuprofen", country: "Germany" });
    expect(linkSearch(new URLSearchParams("q=Nurofen%20%20Junior&country=region%3AAsia"))).toEqual({ term: "Nurofen Junior", country: "region:Asia" });
  });

  it("falls back to all countries for an unknown country, and ignores a missing or invalid term", () => {
    expect(linkSearch(new URLSearchParams("q=ibuprofen&country=Atlantis"))).toEqual({ term: "ibuprofen", country: "all" });
    expect(linkSearch(new URLSearchParams(""))).toBeNull();
    expect(linkSearch(new URLSearchParams("q=x"))).toBeNull();
    expect(linkSearch(new URLSearchParams(`q=${"x".repeat(81)}`))).toBeNull();
  });

  it("writes the country only when one is chosen", () => {
    expect(searchParams("ibuprofen", "all")).toEqual({ q: "ibuprofen" });
    expect(searchParams("ibuprofen", "Italy")).toEqual({ q: "ibuprofen", country: "Italy" });
  });
});

describe("search links, any term the box accepts", () => {
  it("keeps symbols and combining marks the search box allows", () => {
    expect(linkSearch(new URLSearchParams("q=Nurofen%C2%AE"))?.term).toBe("Nurofen®");
    expect(linkSearch(new URLSearchParams("q=5%25%20dextrose"))?.term).toBe("5% dextrose");
    // line breaks fold into spaces; other control characters make the link invalid
    expect(linkSearch(new URLSearchParams("q=a%0Ab"))?.term).toBe("a b");
    expect(linkSearch(new URLSearchParams("q=a%00b"))).toBeNull();
  });
});
