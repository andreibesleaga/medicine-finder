# Test fixtures

- `fhir-r4.schema.json.gz`: HL7's official FHIR R4 JSON Schema, from
  https://hl7.org/fhir/R4/fhir.schema.json.zip (downloaded 26 October 2026, gzip-compressed here).
  `tests/fhir-xlsx.test.ts` validates the FHIR export against it with Ajv. It checks structure and
  data types, not terminology bindings; check a release once with https://validator.fhir.org.
  The file is unchanged (only gzip-compressed). FHIR is © HL7 and licensed under Creative Commons
  "No Rights Reserved" (CC0): https://hl7.org/fhir/R4/license.html (read 27 October 2026).
