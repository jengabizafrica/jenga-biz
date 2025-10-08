Invite flow implementation

This document describes the invite-code registration flows implemented in the app.

Overview
- Path 1: Manual Entry
  - Users receive an invite email with a visible code (e.g., X7B9-K2M4).
  - They can go to the PWA, open Sign Up, and paste the invite code into the Invite Code field.
  - The client validates the code using `GET /invite-codes/validate?code=...` and shows feedback.
  - On signup, the client includes `invite_code` in the Supabase signUp options. After successful signup the client calls `POST /invite-codes/consume` to mark the invite as used and link the user to the hub if applicable.

- Path 2: Direct Link
  - The invite email contains a link: https://yourapp/register?invite_code=<CODE>&email=<EMAIL>
  - The `/register` page reads the query params, validates the invite, pre-fills email, and displays the invite code in a read-only field.
  - On submit, the page signs up the user (Supabase signUp) and calls `POST /invite-codes/consume` to atomically mark the invite used and link to the hub if needed.

Server-side
- Edge functions:
  - `supabase/functions/invite-codes/index.ts` implements:
    - POST /invite-codes  (create)
    - GET /invite-codes/validate?code=...  (public validate)
    - POST /invite-codes/consume  (consume & link user)
  - `supabase/functions/send-signup-confirmation/index.ts` sends self-registration confirmation emails (uses BREVO_API_KEY env)
  - `supabase/functions/send-invite-confirmation/index.ts` sends invite emails (uses BREVO_API_KEY env)

Client-side changes
- New `src/pages/Register.tsx` handles the direct link flow.
- `src/components/auth/EnhancedAuthDialog.tsx` updated to always show invite code input (manual entry flow).
- `src/components/auth/InviteCodeManager.tsx` now attempts to email the generated invite link (best-effort). It uses `window.__FUNCTIONS_BASE__` or `REACT_APP_FUNCTIONS_BASE` to locate the functions host; fallback is `/.netlify/functions`.

Env & deployment
- For email sending from the client, set `window.__FUNCTIONS_BASE__` at runtime or `REACT_APP_FUNCTIONS_BASE` at build time to the platform's functions host that exposes the functions (e.g. `send-signup-confirmation` and `send-invite-confirmation`). Example values:
  - `https://<project>.functions.supabase.co` (for Supabase Functions)
  - `https://<site>/.netlify/functions` (for Netlify deploy)
- Ensure Edge Functions have `BREVO_API_KEY` (and optionally `BREVO_SENDER_EMAIL`) set in their environment for email sending.

Testing
1. Create an invite using Admin dashboard -> Invite Codes.
2. Copy code and try manual sign up using Sign Up dialog -> paste code -> complete flow. Verify invite is consumed in DB.
3. Use the generated link (or click email) to open `/register?invite_code=...&email=...` and complete the registration. Verify invite consumed and user linked to hub if applicable.

Notes
- Invite consumption is enforced server-side in `invite-codes/consume` and will mark `used_at` and `used_by`. The registration pages call this after a successful Supabase signUp.
- For stronger guarantees, you may implement a server-side atomic signup+consume endpoint that creates the auth user and consumes the invite under a single transaction. This implementation performs sign-up (client -> Supabase) then consume (Edge Function) which is good for current constraints but not strictly atomic.
