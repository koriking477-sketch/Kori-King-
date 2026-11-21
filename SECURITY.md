# Security notes

This document lists the issues found during the security review and the manual
steps that must be completed in Supabase. Everything that could be fixed in code
has been fixed.

## Manual steps (required)

1. **Disable public sign-ups.** Dashboard → Authentication → Providers → Email:
   turn off “Allow new users to sign up”. The app no longer offers a sign-up UI,
   but the Supabase Auth API can still create accounts while this is enabled.
2. **Create the admin yourself.** Dashboard → Authentication → Users → Add user.
   Then register that user as an admin:

   ```sql
   insert into public.admin_members (user_id, email)
   values ('<auth-user-uuid>', '<admin-email>')
   on conflict (user_id) do update set email = excluded.email;
   ```

   The application has no bootstrap/first-admin route anymore.
3. **Apply the migration** `supabase/migrations/20261121020000_security_hardening.sql`.
   It removes direct browser access to `reservations`, `admin_members` and
   `booking_rounds`, and makes `number_slots` read-only for the public key.
4. **Set environment variables** from `.env.example`. Keep
   `SUPABASE_SERVICE_ROLE_KEY` server-only (never `NEXT_PUBLIC_`).
5. **Rotate the Supabase keys** if the old `.env` was ever committed or shared.
6. Optional: enable leaked-password protection and MFA in Supabase Auth, and add
   `ADMIN_EMAIL` as a second lock on admin sign-in.

## Issues found and fixed

| Issue | Fix |
| --- | --- |
| Anyone with the configured admin email could create an admin record through `/api/admin/bootstrap` (“First-time setup”) | Removed the route, the sign-up form and the bootstrap call. Admin access now comes only from `admin_members`. |
| Supabase sign-up was reachable from the admin login screen | Admin login is sign-in only. Disable sign-ups in the dashboard as well (step 1). |
| A signed-in non-admin saw an unhelpful state, and login errors could be swallowed | Login now verifies access against `/api/admin/overview` and signs the account out with a clear message if it is not an admin. |
| Back button restored a cached admin dashboard after sign-out | Admin page is `force-dynamic` with `Cache-Control: no-store`; sign-out clears cookies server-side and does a full `location.replace`; a `pageshow` handler revalidates when a page comes from the back/forward cache; `onAuthStateChange` drops to login when the session ends. |
| Rate limits were keyed only on a client-controlled IP header | Rate limits now apply to both the IP and the mobile number, using HMAC-SHA256 keys with a server secret. |
| IPs and hold tokens were hashed with plain SHA-256 (IPs are brute-forceable) | Switched to HMAC-SHA256 keyed by `RATE_LIMIT_SECRET`/service-role key. |
| No CSRF protection on admin mutations | Same-origin check (`Origin` / `Sec-Fetch-Site`) on every admin POST/PATCH/DELETE route. |
| `reset_booking_round` could be called directly without a saved report | The reset API now requires `report_downloaded_at`, matching the UI and delete guard. |
| Customer and round names accepted control characters and odd whitespace | Names are sanitised and length-checked on the server. |
| Number fields accepted booleans/strings via `Number()` coercion | Strict integer validation on round and slot inputs. |
| Admin overview accepted arbitrary `roundId` values | Validated as a UUID. |
| No Content-Security-Policy or clickjacking protection | CSP, `X-Frame-Options: DENY`, COOP/CORP, `nosniff`, permissions policy and HSTS (production) added in `next.config.mjs`. |
| API responses could be cached | `Cache-Control: no-store` for `/api/*` and `/admin*`; all JSON handlers set it too. |
| Password change did not require the current password | Re-authenticates with the current password before updating, then signs out other sessions. |
| Admin dashboard read customer PII directly from the browser (realtime subscription), requiring broad RLS policies | Realtime subscription removed; the dashboard polls the authenticated API every 12 seconds. The public grid keeps read-only slot updates. |
| `createClient()` could throw before the login `try` block | Moved inside the error handling; login shows a friendly message. |
| JSON parse failures on HTML/error responses produced confusing errors | Safe JSON parsing in admin and booking clients. |
| Auth callback ignored exchange failures | Invalid/expired links now redirect to `/admin?authError=1` and the login screen explains it. |
| Selecting a different set of numbers while a hold existed could fail (reserve on top of own hold) | The old hold is released before reserving the new selection. |
| Phone number and name stayed in the form after a booking (shared-device privacy) | Cleared after a successful booking. |
| 29 vulnerable packages (2 high) were in production dependencies | `shadcn` is a build-time CLI and was moved to `devDependencies`; `pnpm audit --prod` is clean. |
| Unused/overbroad middleware ran auth refresh on every route | Matcher narrowed to admin/auth routes. |
| Admin page and metadata could be indexed | `noindex` metadata, `X-Robots-Tag`, and `app/robots.ts`. |
| No `.env.example`; `.env*` ignored it too | Added `.env.example` with all required variables and documented secrets. |

## Notes

- `ADMIN_EMAIL` is optional. When set, the signed-in user's email must match it
  **and** the user must exist in `admin_members`. When unset, `admin_members`
  alone decides access.
- The public site intentionally exposes slot availability (number, status, hold
  countdown). It does not expose names, mobile numbers or reservations.
- If you later re-enable browser-side realtime for `reservations`, add a
  restrictive RLS policy that checks `admin_members` instead of revoking access.
