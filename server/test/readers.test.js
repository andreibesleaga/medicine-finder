import { describe, it, expect } from "vitest";
import { parseCsv, toRecords } from "../lib/csv.js";
import { readFirstSheet, columnIndex } from "../lib/xlsx.js";
import { makeZip } from "./zipfixture.js";

describe("CSV", () => {
  it("handles quotes, doubled quotes, delimiters inside quotes and CRLF", () => {
    const text = 'a;"b;c";"say ""hi"""\r\n1;2;3\r\n\r\n';
    expect(parseCsv(text, ";")).toEqual([
      ["a", "b;c", 'say "hi"'],
      ["1", "2", "3"],
    ]);
  });

  it("keeps quoted line breaks and maps records by header", () => {
    const rows = parseCsv('﻿Name|Note\nX|"two\nlines"', "|");
    expect(toRecords(rows)).toEqual([{ Name: "X", Note: "two\nlines" }]);
  });
});

describe("XLSX reader", () => {
  it("reads shared and inline strings, numbers and sparse cells", () => {
    const sheet =
      '<worksheet><sheetData>' +
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>' +
      '<row r="2"><c r="A2"><v>450</v></c><c r="B2" t="inlineStr"><is><t>Vivotif &amp; co</t></is></c></row>' +
      "</sheetData></worksheet>";
    const shared = "<sst><si><t>Zulassungs-nummer</t></si><si><r><t>Wirk</t></r><r><t>stoff</t></r></si></sst>";
    const buf = makeZip({ "xl/worksheets/sheet1.xml": sheet, "xl/sharedStrings.xml": shared });
    expect(readFirstSheet(buf)).toEqual([
      ["Zulassungs-nummer", "", "Wirkstoff"],
      ["450", "Vivotif & co"],
    ]);
  });

  it("reads sheets whose tags carry a namespace prefix, and empty <v /> cells", () => {
    const sheet =
      '<x:worksheet><x:sheetData>' +
      '<x:row r="1"><x:c r="A1" t="str"><x:v>Läkemedel</x:v></x:c><x:c r="B1" t="str"><x:v /></x:c><x:c r="C1"><x:v>40606</x:v></x:c></x:row>' +
      "</x:sheetData></x:worksheet>";
    expect(readFirstSheet(makeZip({ "xl/worksheets/sheet1.xml": sheet }))).toEqual([["Läkemedel", "", "40606"]]);
  });

  it("converts column letters", () => {
    expect([columnIndex("A1"), columnIndex("Q7"), columnIndex("AB3")]).toEqual([0, 16, 27]);
  });

  it("rejects files that are not zips", () => {
    expect(() => readFirstSheet(Buffer.from("not a zip at all, definitely not"))).toThrow("not a zip file");
  });
});
