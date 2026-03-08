# PLANR — Complete Launch Guide
## From zero to live, paid PWA on all devices

Estimated time: **2–3 hours** (mostly waiting for accounts to verify)

---

## What you'll set up
1. **Supabase** — user accounts + database (free)
2. **Stripe** — subscription payments (free until you earn money)
3. **Vercel** — hosting + serverless webhook (free)
4. **GitHub** — source code (you already have this)
5. **Domain** — optional but recommended (~$12/year)

---

## STEP 1 — Set up Supabase (10 min)

### 1.1 Create project
1. Go to **https://supabase.com** → Sign up / Log in
2. Click **New Project**
3. Name it `planr` → choose a region close to you → set a strong database password → **Create Project**
4. Wait ~2 minutes for it to spin up

### 1.2 Run the database schema
1. In your Supabase project → click **SQL Editor** (left sidebar)
2. Click **New Query**
3. Open the file `supabase/schema.sql` from this project
4. Copy the entire contents → paste into the SQL editor → click **Run**
5. You should see "Success. No rows returned."

### 1.3 Get your API keys
1. In Supabase → go to **Settings** → **API**
2. Copy these two values — you'll need them later:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon / public key** (long string starting with `eyJ...`)

### 1.4 Enable email confirmations (optional but recommended)
1. Supabase → **Authentication** → **Email Templates**
2. Customize the confirmation email with your app name if you want

---

## STEP 2 — Set up Stripe (15 min)

### 2.1 Create Stripe account
1. Go to **https://stripe.com** → Create account
2. Complete business verification (takes 1–2 days for full activation, but you can test immediately)

### 2.2 Create your subscription product
1. Stripe Dashboard → **Products** → **Add Product**
2. Name: `PLANR Pro`
3. Pricing: **Recurring** → set your price (e.g. $9.99/month)
4. Click **Save Product**
5. Optionally add a yearly price too

### 2.3 Create a Payment Link
1. Stripe → **Payment Links** → **New**
2. Select your PLANR Pro product
3. Under **After payment** → set redirect URL to: `https://your-domain.com/?subscribed=true`
4. Click **Create Link**
5. **Copy the Payment Link URL** — it looks like `https://buy.stripe.com/xxxxx`

### 2.4 Get your API keys
1. Stripe → **Developers** → **API Keys**
2. Copy:
   - **Publishable key** (starts with `pk_live_` or `pk_test_`)
   - **Secret key** (starts with `sk_live_` or `sk_test_`)
   ⚠️ Use test keys while building, switch to live when ready

---

## STEP 3 — Push to GitHub (5 min)

1. Go to **https://github.com** → **New Repository**
2. Name: `planr-app` → **Private** → **Create**
3. On your computer, open Terminal in the `planr-app` folder and run:

```bash
git init
git add .
git commit -m "Initial PLANR commit"
git remote add origin https://github.com/YOUR_USERNAME/planr-app.git
git push -u origin main
```

---

## STEP 4 — Deploy to Vercel (10 min)

### 4.1 Connect repo
1. Go to **https://vercel.com** → Sign up with GitHub
2. Click **Add New Project** → Import your `planr-app` repo
3. Framework: **Vite**
4. Click **Deploy** (it will fail on first deploy — that's OK, we need to add env vars next)

### 4.2 Add environment variables
1. Vercel → your project → **Settings** → **Environment Variables**
2. Add each of these (copy from your `.env.example` file):

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `VITE_STRIPE_PAYMENT_LINK` | Your Stripe Payment Link URL |
| `VITE_PRICE_MONTHLY` | e.g. `9.99` |
| `VITE_PRICE_YEARLY` | e.g. `79.99` |
| `STRIPE_SECRET_KEY` | Your Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | (get this in Step 5 below) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key |

3. After adding all vars → **Redeploy** (Deployments tab → three dots → Redeploy)

### 4.3 Get your live URL
After deploying, Vercel gives you a URL like `https://planr-app.vercel.app`  
This is your app — it already works! Optionally connect a custom domain in Vercel → Settings → Domains.

---

## STEP 5 — Set up Stripe Webhook (10 min)

The webhook tells your app when someone pays.

1. Stripe → **Developers** → **Webhooks** → **Add Endpoint**
2. Endpoint URL: `https://planr-app.vercel.app/api/stripe-webhook`
   (replace with your actual Vercel URL or custom domain)
3. Events to listen for — select:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Click **Add Endpoint**
5. Click on the webhook you just created → **Reveal** the **Signing Secret** (`whsec_...`)
6. Copy this → go to Vercel → add it as `STRIPE_WEBHOOK_SECRET`
7. Redeploy Vercel once more

---

## STEP 6 — Get a domain (optional, ~$12/year)

1. Go to **https://www.namecheap.com** or **https://domains.google**
2. Search for your desired name (e.g. `getplanr.com`, `planr.app`, `useplanr.com`)
3. Buy it
4. In Vercel → your project → **Settings** → **Domains** → add your domain
5. Vercel will show you DNS records to add — go to your domain registrar's DNS settings and add them
6. Done — usually propagates within 1 hour

---

## STEP 7 — Test the full flow

1. Open your app URL
2. Click **Start Free Trial** → create an account
3. Check your email for confirmation → confirm
4. Log in → you should see the planner (7-day trial active)
5. To test payments: use Stripe test card `4242 4242 4242 4242`, any future date, any CVC
6. After "paying", the webhook fires → your profile updates → full access granted

---

## Making it installable on phones (PWA)

### iPhone / iPad
1. Open your app URL in **Safari** (must be Safari)
2. Tap the **Share** button (box with arrow up)
3. Scroll down → tap **Add to Home Screen**
4. Tap **Add** → the app icon appears on the home screen
5. Open it — it runs full-screen like a native app

### Android
1. Open your app URL in **Chrome**
2. Chrome will show a banner: **"Add PLANR to Home Screen"** → tap it
3. Or: tap the three-dot menu → **Install App**

---

## Going live checklist

- [ ] Supabase schema applied
- [ ] All environment variables set in Vercel
- [ ] Stripe webhook set up and verified
- [ ] Test sign-up → trial works
- [ ] Test payment → subscription activates
- [ ] App installs on iPhone and Android
- [ ] Switch Stripe from test keys to live keys when ready
- [ ] (Optional) Custom domain connected

---

## Revenue math

At $9.99/month:
- 10 subscribers = **$99/month** (~$96 after Stripe fees)
- 50 subscribers = **$499/month** (~$484 after Stripe fees)
- 100 subscribers = **$999/month** (~$969 after Stripe fees)

Stripe takes 2.9% + $0.30 per transaction. No Apple/Google cut. No middleman.

---

## Getting help

If you get stuck on any step, the best resources are:
- **Supabase docs**: docs.supabase.com
- **Stripe docs**: stripe.com/docs
- **Vercel docs**: vercel.com/docs
- **Vite PWA plugin**: vite-pwa-org.netlify.app
