import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { DOOR_IDS, evaluate, evaluateScenarios } from "./vat-matrix.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const matrix = JSON.parse(readFileSync(join(root, "data/matrix.json"), "utf8"));

test("matrix.json has doors to CapEx and listing-review", () => {
  assert.equal(
    matrix.doors.capex_scanner.url,
    "https://fairhelm.com/en/yachts/tools/capex-scanner/",
  );
  assert.equal(
    matrix.doors.listing_review.url,
    "https://fairhelm.com/en/yachts/services/listing-review/",
  );
  assert.match(matrix.doors.listing_review.label, /49/);
});

test("clean EU first sale → go on all three axes", () => {
  const v = evaluate({
    vat_evidence: "invoice_vat",
    buyer_context: "eu_resident_eu_berth",
    ce_status: "doc_and_plate",
  });
  assert.equal(v.overall, "go");
  assert.equal(v.vat.status, "ok");
  assert.equal(v.t2l.status, "ok");
  assert.equal(v.ce.status, "ok");
  assert.deepEqual(v.doors, [DOOR_IDS.capex, DOOR_IDS.listing]);
});

test("broker VAT-paid claim → stop / risk on VAT", () => {
  const v = evaluate({
    vat_evidence: "broker_claim",
    buyer_context: "eu_resident_eu_berth",
    ce_status: "plate_only",
  });
  assert.equal(v.overall, "stop");
  assert.equal(v.vat.status, "risk");
  assert.equal(v.ce.status, "gap");
  assert.ok(v.before_deposit.some((s) => /VAT/i.test(s)));
});

test("EU buyer + boat outside + no papers → stop", () => {
  const v = evaluate({
    vat_evidence: "none",
    buyer_context: "eu_resident_outside",
    ce_status: "missing",
  });
  assert.equal(v.overall, "stop");
  assert.equal(v.vat.status, "risk");
  assert.equal(v.t2l.status, "risk");
  assert.equal(v.ce.status, "risk");
});

test("T2L only → hold (VAT gap, Union ok if in EU)", () => {
  const v = evaluate({
    vat_evidence: "t2l_only",
    buyer_context: "eu_resident_eu_berth",
    ce_status: "doc_and_plate",
  });
  assert.equal(v.overall, "hold");
  assert.equal(v.vat.status, "gap");
  assert.equal(v.t2l.status, "ok");
  assert.equal(v.ce.status, "ok");
});

test("import VAT path with CE → go", () => {
  const v = evaluate({
    vat_evidence: "import_vat",
    buyer_context: "eu_resident_eu_berth",
    ce_status: "doc_and_plate",
  });
  assert.equal(v.overall, "go");
});

test("every scenario fixture evaluates and keeps door ids", () => {
  const rows = evaluateScenarios(matrix);
  assert.ok(rows.length >= 6);
  for (const row of rows) {
    assert.ok(["go", "hold", "stop"].includes(row.verdict.overall), row.id);
    assert.deepEqual(row.verdict.doors, [DOOR_IDS.capex, DOOR_IDS.listing]);
  }
});

test("axis option ids in scenarios exist in axes", () => {
  const vatIds = new Set(matrix.axes.vat_evidence.options.map((o) => o.id));
  const buyerIds = new Set(matrix.axes.buyer_context.options.map((o) => o.id));
  const ceIds = new Set(matrix.axes.ce_status.options.map((o) => o.id));
  for (const s of matrix.scenarios) {
    assert.ok(vatIds.has(s.vat_evidence), s.id);
    assert.ok(buyerIds.has(s.buyer_context), s.id);
    assert.ok(ceIds.has(s.ce_status), s.id);
  }
});
