// Minimal reader for the first worksheet of an .xlsx file (zip + XML), enough for plain data
// sheets such as Swissmedic's lists. Built on node:zlib; no npm package.

import { inflateRawSync } from "node:zlib";

/** Reads the zip central directory and returns { name -> Buffer } for the requested entries. */
export function unzip(buf, wanted) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("not a zip file");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = {};
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("bad zip directory");
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    if (wanted.includes(name)) {
      const lnameLen = buf.readUInt16LE(localOffset + 26);
      const lextraLen = buf.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + lnameLen + lextraLen;
      const data = buf.subarray(start, start + compSize);
      out[name] = method === 0 ? data : method === 8 ? inflateRawSync(data) : null;
      if (!out[name]) throw new Error(`unsupported zip compression ${method}`);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

const decodeXml = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");

const textOf = (xml) => decodeXml([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""));

/** Column letters to a 0-based index: "A" -> 0, "AB" -> 27. */
export function columnIndex(ref) {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, "")) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Returns the first worksheet as an array of rows (arrays of strings). */
export function readFirstSheet(buf) {
  const files = unzip(buf, ["xl/sharedStrings.xml", "xl/worksheets/sheet1.xml"]);
  const sheet = files["xl/worksheets/sheet1.xml"];
  if (!sheet) throw new Error("no first worksheet");
  const shared = files["xl/sharedStrings.xml"]
    ? [...files["xl/sharedStrings.xml"].toString("utf8").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]))
    : [];
  const rows = [];
  for (const rm of sheet.toString("utf8").matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const type = /\bt="(\w+)"/.exec(attrs)?.[1];
      const inner = cm[2] ?? "";
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let value = "";
      if (type === "s" && v !== undefined) value = shared[Number(v)] ?? "";
      else if (type === "inlineStr") value = textOf(inner);
      else if (v !== undefined) value = decodeXml(v);
      row[ref ? columnIndex(ref) : row.length] = value;
    }
    rows.push(Array.from(row, (x) => x ?? ""));
  }
  return rows;
}
