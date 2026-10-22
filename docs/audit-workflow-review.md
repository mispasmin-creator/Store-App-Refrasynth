# Audit/AI workflow review

Scope confirmed by the user: Audit/AI workflow only. Rectify and Tally Entry remain human-controlled. AI remarks stay short and in English.

## Fixes

- Failed Rectify/Tally timestamps no longer advance records. Final completion requires approved audit/reaudit and successful manual Tally Entry. Failed Reaudit returns to human Rectify.
- AI transitions reject human stages, mismatched report stages, incomplete results and passed reports containing failed checks. Each AI stage writes only its own remarks field. Human-stage columns hide incorrectly attributed AI reports.
- Receipt joins include firm, PO, lift, indent and product. Missing or ambiguous identities cannot silently select another firm's/product's receipt. PO price check uses the correct source field.
- Human forms reject stale bill, amount, quantity, rate, document and identity snapshots. Failed legacy Tally attempts can be resubmitted without being blocked by their earlier timestamps.
- Quantities use precision appropriate to units, rather than currency-rounding tolerance. This also applies to final voucher comparisons.
- Malformed report contents cannot crash the remarks renderer. System errors are displayed instead of stale discarded checks.
- Audit loading uses the audit dataset's actual loading state. Remarks wrap as separate numbered lines; keyboard tab changes update filtered data. Cleared numeric inputs no longer display NaN.
- Worker source reads have deterministic ordering. Queue pagination prevents completed/manual history from hiding later pending bills. Credential/model changes reset retry identity; transient failures have a cooldown instead of permanent exhaustion.

## Validation

- `npm.cmd run test:audit`: 41 regression tests passed, including partial liftings with separate invoices, cumulative excess, receipt shortage and paginated receipt sources.
- TypeScript checks passed for the frontend and standalone worker.
- ESLint passed for the Audit page, audit services, shared audit modules and worker.
- Production build passed (existing large-bundle advisory remains).
- Deployed worker health: configured/enabled, HTTP 200. A targeted read-only check confirmed a Rectify record is skipped, with no AI call or accounting update.

Existing invoice/company/quantity/rate differences remain pending for human source correction. This review does not approve those bills, rewrite their business values, replace the app's custom authentication, or claim that unrelated application-wide lint issues were fixed.
