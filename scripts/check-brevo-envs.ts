// Simple script to call deployed edge function health endpoints to verify BREVO env presence
// Usage: `deno run --allow-net scripts/check-brevo-envs.ts https://<your-domain>/functions/v1/send-signup-confirmation https://<your-domain>/functions/v1/send-invite-confirmation`

// Provide a lightweight Deno declaration so editors don't complain when typechecking
declare const Deno: {
  args: string[];
  exit(code?: number): never;
};

if (Deno.args.length < 1) {
  console.error('Usage: deno run --allow-net scripts/check-brevo-envs.ts <signup_fn_url> [invite_fn_url]');
  Deno.exit(2);
}

const signupUrl = Deno.args[0];
const inviteUrl = Deno.args[1] || null;

async function check(url: string) {
  try {
    const resp = await fetch(url.replace(/\/$/, '') + '/health', { method: 'GET' });
    const body = await resp.json();
    console.log(url, '->', JSON.stringify(body, null, 2));
  } catch (e) {
    console.error('Error contacting', url, e);
  }
}

export {};

await check(signupUrl);
if (inviteUrl) await check(inviteUrl);
