// Small CSV parser: quoted fields, doubled quotes, any one-character delimiter, CRLF or LF.

/** Returns an array of rows (arrays of strings). */
export function parseCsv(text, delimiter = ",") {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Turns rows into objects keyed by the header row (header names trimmed). */
export function toRecords(rows) {
  const [header, ...body] = rows;
  const keys = (header ?? []).map((h) => h.replace(/^\uFEFF/, "").trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}
