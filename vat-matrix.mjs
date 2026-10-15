/**
 * Pure EU yacht pre-deposit matrix evaluator.
 * Inputs are option ids from data/matrix.json — no network, no DB.
 */

/** @typedef {'ok'|'gap'|'risk'} AxisStatus */
/** @typedef {'go'|'hold'|'stop'} Overall */

/**
 * @typedef {object} MatrixAnswers
 * @property {string} vat_evidence
 * @property {string} buyer_context
 * @property {string} ce_status
 */

/**
 * @typedef {object} AxisResult
 * @property {AxisStatus} status
 * @property {string} label
 * @property {string} detail
 */

/**
 * @typedef {object} MatrixVerdict
 * @property {Overall} overall
 * @property {string} headline
 * @property {string} summary
 * @property {AxisResult} vat
 * @property {AxisResult} t2l
 * @property {AxisResult} ce
 * @property {string[]} before_deposit
 * @property {string[]} doors
 */

const DOORS = Object.freeze({
  capex: "capex_scanner",
  listing: "listing_review",
});

/**
 * @param {MatrixAnswers} answers
 * @returns {MatrixVerdict}
 */
export function evaluate(answers) {
  const vat = scoreVat(answers);
  const t2l = scoreT2l(answers);
  const ce = scoreCe(answers);

  const ranks = { ok: 0, gap: 1, risk: 2 };
  const worst = Math.max(ranks[vat.status], ranks[t2l.status], ranks[ce.status]);
  /** @type {Overall} */
  const overall = worst === 0 ? "go" : worst === 1 ? "hold" : "stop";

  const before_deposit = buildBeforeDeposit(answers, vat, t2l, ce, overall);
  const doors = [DOORS.capex, DOORS.listing];

  return {
    overall,
    headline: headlineFor(overall),
    summary: summaryFor(overall, answers),
    vat,
    t2l,
    ce,
    before_deposit,
    doors,
  };
}

/**
 * @param {MatrixAnswers} a
 * @returns {AxisResult}
 */
function scoreVat(a) {
  switch (a.vat_evidence) {
    case "invoice_vat":
      return {
        status: "ok",
        label: "VAT evidence",
        detail:
          "Original invoice with VAT line and payment trail — strong fiscal trail if HIN/CIN matches.",
      };
    case "import_vat":
      return {
        status: "ok",
        label: "VAT evidence",
        detail:
          "Import declaration + import VAT/duty receipt — strong free-circulation fiscal trail.",
      };
    case "t2l_only":
      return {
        status: "gap",
        label: "VAT evidence",
        detail:
          "T2L proves Union-goods status after customs checks; still ask for first-sale or import VAT papers if available.",
      };
    case "broker_claim":
      return {
        status: "risk",
        label: "VAT evidence",
        detail:
          "“VAT paid” on a listing is not evidence. Hold the deposit until primary documents appear.",
      };
    case "none":
    default:
      if (a.buyer_context === "non_eu_temp") {
        return {
          status: "gap",
          label: "VAT evidence",
          detail:
            "Non-EU temporary-admission paths differ. Confirm regime limits and that you are not treating yourself as an EU-resident importer by mistake.",
        };
      }
      if (a.buyer_context === "eu_resident_outside") {
        return {
          status: "risk",
          label: "VAT evidence",
          detail:
            "EU-resident buyer + boat outside the Union usually means an import path. Price the import VAT before any deposit.",
        };
      }
      return {
        status: "risk",
        label: "VAT evidence",
        detail:
          "No fiscal trail. EU-resident use without proof can trigger import VAT at the first serious customs check.",
      };
  }
}

/**
 * @param {MatrixAnswers} a
 * @returns {AxisResult}
 */
function scoreT2l(a) {
  if (a.buyer_context === "non_eu_temp") {
    return {
      status: "gap",
      label: "T2L / Union goods",
      detail:
        "Temporary admission is not the same as Union goods. Keep the regime paperwork; do not assume T2L language applies.",
    };
  }

  if (a.buyer_context === "eu_resident_outside") {
    return {
      status: "risk",
      label: "T2L / Union goods",
      detail:
        "Boat is not yet in free circulation for you. Plan import clearance; T2L comes after Union status is established.",
    };
  }

  switch (a.vat_evidence) {
    case "invoice_vat":
    case "import_vat":
      return {
        status: "ok",
        label: "T2L / Union goods",
        detail:
          "Primary fiscal papers usually support Union status. Keep originals; request T2L only if a specific customs move needs it.",
      };
    case "t2l_only":
      return {
        status: "ok",
        label: "T2L / Union goods",
        detail:
          "T2L/T2LF on file is the classic Union-goods proof. Still reconcile HIN/CIN and keep a copy aboard when moving.",
      };
    case "broker_claim":
      return {
        status: "risk",
        label: "T2L / Union goods",
        detail:
          "No Union-goods document. Ask for T2L/T2LF or import/first-sale papers before deposit.",
      };
    case "none":
    default:
      return {
        status: "risk",
        label: "T2L / Union goods",
        detail:
          "Missing Union-goods proof. Do not treat registration or flag papers as fiscal substitutes.",
      };
  }
}

/**
 * @param {MatrixAnswers} a
 * @returns {AxisResult}
 */
function scoreCe(a) {
  switch (a.ce_status) {
    case "doc_and_plate":
      return {
        status: "ok",
        label: "CE / RCD",
        detail:
          "Plate + Declaration of Conformity present. Match builder, HIN/CIN, and category to the hull in front of you.",
      };
    case "plate_only":
      return {
        status: "gap",
        label: "CE / RCD",
        detail:
          "Plate without DoC is incomplete. Demand the Declaration of Conformity (and technical file pointer) before deposit.",
      };
    case "pre_directive":
      return {
        status: "gap",
        label: "CE / RCD",
        detail:
          "Legacy pre-directive craft can be usable, but flag/registry and insurer rules still matter. Document build year honestly.",
      };
    case "missing":
    default:
      if (a.buyer_context === "eu_resident_outside" || a.buyer_context === "eu_resident_eu_berth") {
        return {
          status: "risk",
          label: "CE / RCD",
          detail:
            "No CE trail on a craft that must be placed on the Union market often means post-construction assessment — time and CapEx risk.",
        };
      }
      return {
        status: "gap",
        label: "CE / RCD",
        detail:
          "CE paperwork unclear. Confirm whether RCD applies to this hull length and intended EU use.",
      };
  }
}

/**
 * @param {Overall} overall
 */
function headlineFor(overall) {
  if (overall === "go") return "Documents look deposit-ready — still condition the contract";
  if (overall === "hold") return "Hold the deposit until the named gaps close";
  return "Do not deposit yet — fiscal or CE trail is too thin";
}

/**
 * @param {Overall} overall
 * @param {MatrixAnswers} a
 */
function summaryFor(overall, a) {
  if (overall === "go") {
    return "VAT / Union-goods evidence and CE paperwork are in a workable shape for a careful EU purchase. Make completion conditional on originals that match the hull.";
  }
  if (a.buyer_context === "eu_resident_outside") {
    return "An EU-resident buyer facing a boat outside the Union should price import VAT, CE conformity, and delivery CapEx before wiring money.";
  }
  if (overall === "hold") {
    return "One or more axes need a concrete paper, not a broker assurance. Put the missing items in the offer as conditions precedent.";
  }
  return "Listing language is not enough. Reconstruct VAT / Union status and CE conformity before any non-refundable deposit.";
}

/**
 * @param {MatrixAnswers} a
 * @param {AxisResult} vat
 * @param {AxisResult} t2l
 * @param {AxisResult} ce
 * @param {Overall} overall
 */
function buildBeforeDeposit(a, vat, t2l, ce, overall) {
  /** @type {string[]} */
  const steps = [];

  if (vat.status !== "ok") {
    steps.push(
      "Require primary VAT / import evidence matched to HIN/CIN — not only “VAT paid” wording.",
    );
  } else {
    steps.push("Keep originals of the VAT / import trail and verify they name this hull.");
  }

  if (t2l.status === "risk") {
    steps.push(
      "Ask for T2L/T2LF or other Union-goods proof before deposit if the boat will move under customs scrutiny.",
    );
  } else if (t2l.status === "gap") {
    steps.push("Clarify temporary-admission vs Union-goods regime in writing.");
  }

  if (ce.status !== "ok") {
    steps.push(
      "Obtain CE Declaration of Conformity or a written plan for post-construction assessment / legacy status.",
    );
  }

  if (a.buyer_context === "eu_resident_outside") {
    steps.push("Run CapEx on import VAT band, PCA/CE, and delivery before any deposit.");
  }

  if (overall !== "go") {
    steps.push(
      "Use a €49 listing review on the public URL if papers are thin or the advert is vague.",
    );
  } else {
    steps.push("Still paste the listing into CapEx for unstated survey CapEx before you travel.");
  }

  return steps;
}

/**
 * Evaluate every scenario row from matrix.json.
 * @param {{ scenarios: Array<MatrixAnswers & { id: string, title: string }> }} matrix
 */
export function evaluateScenarios(matrix) {
  return matrix.scenarios.map((row) => ({
    id: row.id,
    title: row.title,
    verdict: evaluate({
      vat_evidence: row.vat_evidence,
      buyer_context: row.buyer_context,
      ce_status: row.ce_status,
    }),
  }));
}

export const DOOR_IDS = DOORS;
