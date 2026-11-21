# Application fixes reviewed on 23 October 2026

- Fixed false stale-bill errors when legacy null rates are displayed as zero. Actual database values still guard concurrent saves.
- Enforced human-only Again Audit in both worker routing and shared AI transitions. Human rejection returns to Tally Entry; resubmission clears stale final-review remarks.
- Added explicit non-submit types to Close/Cancel buttons across 17 screens.
- Reset Issue Data approval fields when opening a different issue, and validate Yes/No in the save service.
- Refresh loading now lasts until requests settle. Background polls avoid overlap; manual refresh after saving waits for an older poll and then fetches fresh data.
- Daily noon IST cron now submits a targeted request for every eligible Audit/Reaudit entry. Human and completed stages are excluded. No accounting records were changed during verification.
- Removed obsolete types and an unused import from the shared table, keeping row selection and table metadata typed.

Validation: 52 tests, frontend and worker TypeScript checks, production build, focused lint, deployed worker health, and live cron schedule verification. Worker version 14 is deployed. Browser interaction was unavailable because no browser surfaces were connected.

Repository-wide lint still reports existing typing, unused-code and hook warnings in other components. The production build also retains its existing large-bundle advisory. These checks do not establish that every application flow is free of defects.
