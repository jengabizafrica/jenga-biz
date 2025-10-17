import { corsHeaders } from "../_shared/responses.ts";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
const APP_URL = Deno.env.get("APP_URL") || "https://jengabiz.africa";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const reference = url.searchParams.get("reference");
    const trxref = url.searchParams.get("trxref");
    const status = url.searchParams.get("status");

    console.log("Paystack callback received:", { reference, trxref, status });

    // Use reference or trxref
    const paymentReference = reference || trxref;

    if (!paymentReference) {
      console.error("No reference provided in callback");
      return Response.redirect(
        `${APP_URL}/billing/error?reason=no_reference`,
        302
      );
    }

    // If Paystack already indicates failure, redirect immediately
    if (status === "cancelled" || status === "failed") {
      console.log("Payment cancelled or failed:", status);
      return Response.redirect(
        `${APP_URL}/billing/error?reason=${status}`,
        302
      );
    }

    // Verify the transaction with Paystack
    console.log("Verifying transaction with Paystack:", paymentReference);
    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${paymentReference}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const verifyData = await verifyResponse.json();
    console.log("Paystack verification response:", verifyData);

    if (!verifyData.status || verifyData.data.status !== "success") {
      console.error("Payment verification failed:", verifyData);
      return Response.redirect(
        `${APP_URL}/billing/error?reason=verification_failed`,
        302
      );
    }

    // Payment verified successfully
    console.log("Payment verified successfully");
    
    // The webhook should handle DB updates, but we can add a small delay
    // to allow webhook processing before redirecting
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Redirect to success page
    return Response.redirect(
      `${APP_URL}/billing/success?reference=${paymentReference}`,
      302
    );

  } catch (error) {
    console.error("Error in paystack-confirm:", error);
    return Response.redirect(
      `${APP_URL}/billing/error?reason=server_error`,
      302
    );
  }
});
