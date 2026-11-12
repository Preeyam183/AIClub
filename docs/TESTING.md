# Test results — November 12, 2026

## Live app in Safari

Verified against the running app and its configured Supabase project:

- The published listing and its uploaded photo load on the detail page.
- Signed-in users can save a listing, see it under Saved, reload the page, and retain the saved listing and session.
- Unsaving removes the card and restores the empty Saved state. The saved state was restored to its original value after testing.
- My listings shows the owner's published listing, its availability, edit controls, and inquiry section.
- The edit form loads the existing title, price, address, bedroom/bathroom counts, area, dates, amenities, display name, and photo.
- Submitting a negative rent is blocked by the browser with “Value must be greater than or equal to 1.” The form value was restored without saving any changes.
- Searching the listing's city returns the listing.
- Selecting Subleases excludes the Lease listing and displays the empty-results state; resetting filters restores it.
- Combining Furnished and Pet friendly retains the matching listing.

## Live database tests

Executed the assertions in [`supabase/tests/live-rls.sql`](../supabase/tests/live-rls.sql) in Supabase's SQL editor. These run with temporary synthetic users and a synthetic listing, explicitly switching to the same `authenticated` and `anon` database roles used by the application. The transaction always ends in `ROLLBACK`.

The script passed checks for:

- Renter favorites and inquiry creation/readback.
- Rejection of duplicate inquiries.
- Rejection of another user's listing edits and deletion.
- Private favorites and inquiries hidden from unrelated users.
- Rejection of spoofed inquiry email addresses.
- Owner access to received inquiries, without access to the renter's private favorites.
- Rejection of inquiries by an owner about their own listing.
- Owner transitions between available and rented; rented listings hidden from signed-out visitors.
- Rejection of inquiries about rented listings.
- Owner deletion of a synthetic listing and cascading cleanup of its inquiries and favorites.

A separate query confirmed **0 temporary users, 0 temporary listings, 0 temporary inquiries**, with **1 original listing** remaining. No passwords, login sessions, notification emails, or persistent test accounts were created. The original listing was not edited or deleted.

Public API checks also confirmed the listing schema is accessible, the uploaded photo returns HTTP 200 with an image content type, and signed-out requests return no private favorites or inquiries.

## Automated checks

`npm test`: **26 tests passed** across search/validation, page rendering/ownership gates, and Postgres RLS tests. The live SQL script also runs in embedded Postgres during the automated suite, and the suite verifies that its synthetic Auth users are rolled back.

`npm run build`: **passed**. Vite reports a nonblocking JavaScript bundle-size warning (about 544 kB minified).

## Limits

- The live renter/owner inquiry checks exercise database authorization with simulated authenticated roles. A second person's email-link sign-in and sending an inquiry through the browser were not exercised.
- Magic-link delivery, SMTP configuration, and external email replies were not tested.
- Desktop Safari was checked. Mobile layouts and other browsers were not visually verified.
- Price/date/bedroom filtering is covered by automated tests. A native browser automation interruption prevented completing the price-dropdown interaction check.
- Owner status changes and deletion were exercised on synthetic database records, not by changing the original listing through the browser.

No functional failures were found in the paths exercised above.
