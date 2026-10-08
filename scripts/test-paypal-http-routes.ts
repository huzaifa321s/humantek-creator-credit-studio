import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BASE_URL = 'http://localhost:3000';

function extractCookies(res: Response): string {
  const raw = res.headers.get('set-cookie');
  if (!raw) return '';
  return raw
    .split(',')
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

async function runPayPalHttpRoutesAudit() {
  console.log('========================================================================');
  console.log('HUMANTEK CREATOR STUDIO - PAYPAL HTTP-LEVEL ROUTE HANDLERS AUDIT');
  console.log('Testing real HTTP requests, session cookies, JSON & raw bodies on :3000');
  console.log('========================================================================\n');

  const timestamp = Date.now();
  const aliceEmail = `http_alice_${timestamp}@humantek.art`;
  const bobEmail = `http_bob_${timestamp}@humantek.art`;
  const defaultPass = 'HttpPass2026!';

  try {
    // 1. Provision Alice & Bob
    console.log('[Setup] Registering verified test users Alice and Bob...');
    const userA = await admin.auth.admin.createUser({
      email: aliceEmail,
      password: defaultPass,
      email_confirm: true,
      user_metadata: { full_name: 'Alice HTTP' },
    });
    const userB = await admin.auth.admin.createUser({
      email: bobEmail,
      password: defaultPass,
      email_confirm: true,
      user_metadata: { full_name: 'Bob HTTP' },
    });

    if (userA.error || userB.error) {
      throw new Error(`User provisioning error: ${userA.error?.message || userB.error?.message}`);
    }

    // 2. Real HTTP Login via /api/auth/login to obtain native @supabase/ssr session cookies
    console.log('[Step 1] Logging in via real HTTP route /api/auth/login...');
    const loginResAlice = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: aliceEmail, password: defaultPass }),
    });
    if (!loginResAlice.ok) throw new Error(`Alice login failed: ${loginResAlice.status}`);
    const aliceCookie = extractCookies(loginResAlice);

    const loginResBob = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: bobEmail, password: defaultPass }),
    });
    if (!loginResBob.ok) throw new Error(`Bob login failed: ${loginResBob.status}`);
    const bobCookie = extractCookies(loginResBob);

    console.log('  -> Alice and Bob authenticated. Real Supabase session cookies captured.\n');

    // -------------------------------------------------------------------------
    // TEST 1: POST /api/paypal/create-order UNAUTHENTICATED
    // -------------------------------------------------------------------------
    console.log('[Test 1] POST /api/paypal/create-order without authentication:');
    const unauthCreate = await fetch(`${BASE_URL}/api/paypal/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId: 'creator-forge' }),
    });

    if (unauthCreate.status !== 401) {
      throw new Error(`Expected 401 Unauthorized, got: ${unauthCreate.status}`);
    }
    console.log('  -> Unauthenticated request rejected with HTTP 401.\n');

    // -------------------------------------------------------------------------
    // TEST 2: POST /api/paypal/create-order WITH TAMPERED PRICE IN REQUEST
    // -------------------------------------------------------------------------
    console.log('[Test 2] POST /api/paypal/create-order with client price tampering:');
    // Client sends spoofed price: $1.00 USD for a $1500 package
    const tamperedCreate = await fetch(`${BASE_URL}/api/paypal/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: aliceCookie,
      },
      body: JSON.stringify({
        packageId: 'creator-forge',
        priceUSD: 1.0,
        expectedAmountCents: 100,
        fakeDiscount: 99.9,
      }),
    });

    if (!tamperedCreate.ok) {
      const errBody = await tamperedCreate.text();
      throw new Error(`Create order failed: ${tamperedCreate.status} - ${errBody}`);
    }

    const orderData = await tamperedCreate.json();
    if (orderData.priceUSD !== 1500 || orderData.credits !== 660) {
      throw new Error(`Vulnerability: Client tampered price was accepted! ${JSON.stringify(orderData)}`);
    }

    const { data: dbOrder } = await admin.from('orders').select('*').eq('id', orderData.internalOrderId).single();
    if (dbOrder.expected_amount_cents !== 150000) {
      throw new Error(`DB order price tampered! Expected 150000, got ${dbOrder.expected_amount_cents}`);
    }

    console.log(`  -> Client tampered body ignored.`);
    console.log(`  -> Server catalog enforced: priceUSD=${orderData.priceUSD}, credits=${orderData.credits}, DB cents=${dbOrder.expected_amount_cents}.\n`);

    // -------------------------------------------------------------------------
    // TEST 3: POST /api/paypal/capture-order CROSS-TENANT DEFENSE (Bob captures Alice's order)
    // -------------------------------------------------------------------------
    console.log('[Test 3] POST /api/paypal/capture-order cross-tenant attack (Bob captures Alice\'s order):');
    const attackCapture = await fetch(`${BASE_URL}/api/paypal/capture-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: bobCookie, // Bob's session
      },
      body: JSON.stringify({
        orderId: orderData.orderId,
        internalOrderId: orderData.internalOrderId, // Alice's order
      }),
    });

    if (attackCapture.status !== 403) {
      throw new Error(`Security breach: Cross-tenant capture was not blocked with 403! Status: ${attackCapture.status}`);
    }
    const attackBody = await attackCapture.json();
    console.log(`  -> Cross-tenant capture blocked: HTTP ${attackCapture.status} - "${attackBody.error}".\n`);

    // -------------------------------------------------------------------------
    // TEST 4: POST /api/paypal/capture-order LEGITIMATE OWNER
    // -------------------------------------------------------------------------
    console.log('[Test 4] POST /api/paypal/capture-order legitimate owner capture:');
    const legitCapture = await fetch(`${BASE_URL}/api/paypal/capture-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: aliceCookie, // Alice's session
      },
      body: JSON.stringify({
        orderId: orderData.orderId,
        internalOrderId: orderData.internalOrderId,
      }),
    });

    if (!legitCapture.ok) {
      const errText = await legitCapture.text();
      throw new Error(`Legitimate capture failed: ${legitCapture.status} - ${errText}`);
    }

    const captureData = await legitCapture.json();
    if (!captureData.success || captureData.status !== 'fulfilled' || captureData.creditsGranted !== 660) {
      throw new Error(`Capture response invalid: ${JSON.stringify(captureData)}`);
    }

    // Verify wallet
    const { data: aliceWallet } = await admin.from('wallets').select('*').eq('user_id', userA.data.user!.id).single();
    if (aliceWallet.balance_purchased !== 660) {
      throw new Error(`Wallet balance was not credited! Balance: ${aliceWallet.balance_purchased}`);
    }

    console.log(`  -> Capture succeeded: status=${captureData.status}, creditsGranted=${captureData.creditsGranted}.`);
    console.log(`  -> Alice's wallet verified: ${aliceWallet.balance_purchased} purchased CR.\n`);

    // -------------------------------------------------------------------------
    // TEST 5: POST /api/paypal/webhook FORGED SIGNATURE DEFENSE
    // -------------------------------------------------------------------------
    console.log('[Test 5] POST /api/paypal/webhook forged raw signature defense:');
    const forgedWebhook = await fetch(`${BASE_URL}/api/paypal/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'paypal-transmission-sig': 'forged-signature',
        'paypal-transmission-id': 'hack-1',
      },
      body: JSON.stringify({
        id: `WH-HACK-${timestamp}`,
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: { id: 'HACK-CAP' },
      }),
    });

    if (forgedWebhook.status !== 401) {
      throw new Error(`Expected 401 Unauthorized for forged webhook, got: ${forgedWebhook.status}`);
    }
    console.log(`  -> Forged signature rejected with HTTP 401.\n`);

    console.log('========================================================================');
    console.log('ALL PAYPAL HTTP ROUTE AUDIT TESTS PASSED WITH 100% SUCCESS!');
    console.log('========================================================================');
  } catch (err: any) {
    console.error('\n❌ PAYPAL HTTP ROUTE AUDIT FAILED:', err.message || err);
    process.exit(1);
  }
}

runPayPalHttpRoutesAudit();
