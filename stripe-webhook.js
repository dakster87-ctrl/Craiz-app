// api/stripe-webhook.js
// Vercel serverless function — handles Stripe subscription events
// Deploy path: /api/stripe-webhook  →  add this URL as your Stripe webhook endpoint

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

// Initialize clients
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // service role bypasses RLS
);

// Stripe requires the raw body to verify webhook signatures
export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end",  () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method not allowed");

  const sig  = req.headers["stripe-signature"];
  const body = await getRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ── Helper: update profile by Stripe customer ID ─────────────────────────
  async function updateProfile(stripeCustomerId, fields) {
    const { error } = await supabase
      .from("profiles")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("stripe_customer_id", stripeCustomerId);
    if (error) console.error("Supabase update error:", error);
  }

  // ── Helper: set customer ID on profile by email ───────────────────────────
  async function linkCustomer(stripeCustomerId, email) {
    // Find the auth user by email
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const user = users.find(u => u.email === email);
    if (!user) { console.error("No user found for email:", email); return; }
    await supabase.from("profiles").update({ stripe_customer_id: stripeCustomerId }).eq("id", user.id);
  }

  // ── Handle events ─────────────────────────────────────────────────────────
  const obj = event.data.object;

  switch (event.type) {
    // New subscription created (first payment succeeded)
    case "customer.subscription.created":
    case "invoice.payment_succeeded": {
      const customerId = obj.customer;
      // Make sure customer is linked to a profile
      const customer = await stripe.customers.retrieve(customerId);
      await linkCustomer(customerId, customer.email);
      await updateProfile(customerId, {
        subscription_status:    "active",
        stripe_subscription_id: obj.subscription || obj.id,
      });
      break;
    }

    // Subscription updated (e.g. plan change, renewal)
    case "customer.subscription.updated": {
      await updateProfile(obj.customer, {
        subscription_status:    obj.status,  // active | trialing | past_due | canceled
        stripe_subscription_id: obj.id,
      });
      break;
    }

    // Subscription cancelled or payment failed
    case "customer.subscription.deleted":
    case "invoice.payment_failed": {
      await updateProfile(obj.customer, {
        subscription_status: "canceled",
      });
      break;
    }

    default:
      // Ignore other events
      break;
  }

  res.status(200).json({ received: true });
}
