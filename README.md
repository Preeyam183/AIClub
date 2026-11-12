# RentCheck

A straightforward apartment marketplace for leases, subleases, and rentals. React + TypeScript + Vite, with Supabase for authentication, database, and listing photos. No AI services or AI features.

## Run locally

Requires Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

Without Supabase environment variables, the app runs in **demo mode** with six fictional listings around New Brunswick, NJ. Click **Log in → Continue with demo account** to save places, post a listing, edit it, mark it rented, and send demo inquiries. Demo changes persist only in this browser. Demo photos are limited to 2 MB combined per upload to accommodate browser storage. No real people receive demo inquiries. Clear the `rentcheck-*-v1` localStorage entries to reset the demo.

## Connect your existing Supabase project

1. Copy `.env.example` to `.env.local`.
2. Set your project URL and **publishable key** (a legacy anon key also works). Never use a secret/service-role key in this frontend.

   ```dotenv
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

3. Run [`supabase/migrations/202611070001_initial_rentcheck.sql`](supabase/migrations/202611070001_initial_rentcheck.sql) once in your project's SQL editor. Alternatively, link this repo to your project with the Supabase CLI and apply it using `supabase db push`. The migration creates namespaced tables, indexes, row-level security policies, and a public `rentcheck-photos` storage bucket. It does not replace existing app tables. If this project already uses Supabase migrations, integrate the migration into that workflow first.
4. In **Authentication → URL Configuration**, set the Site URL to `http://localhost:5173` and add `http://localhost:5173` to the redirect allow list. When deploying, use your deployed origin and add that exact origin to the allow list. Email authentication must be enabled.
5. Restart the dev server after editing environment variables. The demo label disappears once credentials are configured. The connected app starts with your real database, without fictional listings.
6. Sign in by email link and post your first place. Use a second account to test saving a place and contacting its owner. Owners see received inquiries under **My listings** and can use **Reply by email** to open their mail app.

If a Supabase request fails, the app shows the actual connection/database error; it does not silently fall back to sample data. Supabase's email delivery/rate limits and SMTP configuration apply to magic links. The connected flow and database policies need to be verified against your actual project after configuration; credentials were not present during initial development.

Reference: [Supabase client setup](https://supabase.com/docs/reference/javascript/initializing), [email magic links](https://supabase.com/docs/reference/javascript/auth-signinwithotp), and [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Included

- Browse and search by address, neighborhood, city, or region.
- Filter leases, subleases, and rentals by monthly budget, bedrooms, move-in date, furnished status, and pet policy.
- Sort by newest or rent; responsive layouts, loading states, errors, and empty states.
- Listing detail pages with a photo gallery, amenities, dates, and host information.
- Email-link sign-in, persistent sessions, and private saved places.
- Create and edit listings with up to five uploaded photos; mark listings rented or available and delete listings with confirmation.
- Send a private inquiry, share your reply email with the owner, and view received inquiries in the owner's dashboard.

This is a marketplace for discovering places and making contact. It does not collect payments, sign leases, or verify ownership. Addresses and uploaded listing photos are public; inquiries and account emails are restricted by database policies. There is no in-app conversation thread or automatic inquiry notification email; owners check My listings and reply using their email app.

## Checks and production build

```sh
npm test
npm run build
npm run preview
```

The build outputs `dist/`. Deploy it on a static host with SPA fallback: all unknown routes must serve `index.html` (a Netlify/Cloudflare Pages `_redirects` file is included). Set the two public Supabase variables in the build environment. This app does not need a separate application server.

Tests cover search and validation, page rendering and ownership gates, and the actual SQL migration running in embedded Postgres (PGlite) with minimal Supabase Auth/Storage shims. Database tests verify public browsing, private favorites and inquiries, sender spoofing prevention, listing ownership, photo folder access, rented-listing restrictions, constraints, and deletion cascades. They do not replace a live Supabase authentication and upload test. Browser-based visual QA was unavailable in the initial development environment.

See [the November 12 live test results](docs/TESTING.md) for subsequent Safari checks, live Supabase authorization tests, cleanup verification, and the remaining test limits. A repeatable rollback-only database test is available in `supabase/tests/live-rls.sql`.

## Structure

```text
src/
  components/          Shared navigation, dialogs, and listing cards
  context/             Authentication, listings, saved places, and inquiries
  data/                Fictional demo data
  lib/                 Supabase client, search, formatting, validation, tests
  pages/               Browse, detail, saved, listing form, and owner dashboard
  styles.css           Responsive visual system
public/images/         Bundled example apartment photography
supabase/migrations/   Database schema, RLS, and photo storage policies
```

Example photos: [Unsplash](https://unsplash.com), with source photo IDs `photo-1600210492486-724fe5c67fb0`, `photo-1522708323590-d24dbb6b0267`, `photo-1600607687920-4e2a09cf159d`, `photo-1502672260266-1c1ef2d93688`, `photo-1616486338812-3dadae4b4ace`, and `photo-1600566753086-00f18fb6b3ea`. Typography uses Google Fonts with local system fallbacks. Example photos are fictional listing illustrations, not evidence of actual availability.
