import assert from 'node:assert/strict';

// Import our TypeScript source files directly or verify logic
import { computeOrderQuote, STUDIO_WALLET_PACKAGE } from '../src/lib/pricing.ts';
import {
  getUserBalance,
  setUserBalance,
  adjustUserBalance,
  getLedger,
  getProjects,
  addProject,
  recordPaidProject,
  recordWalletFundedProject,
} from '../src/lib/store.ts';

console.log('--- TEST SUITE 1: Pricing Engine Verification ---');

// Test 1: Wallet quote computation ($0 USD)
const walletQuoteResult = computeOrderQuote({
  fundingSource: 'wallet',
  packageId: 'studio-wallet',
  walletBalance: 200,
  selections: [
    { id: 'logo', level: 1, quantity: 1 }, // 88 CR
    { id: 'banner', level: 0, quantity: 1 }, // 44 CR
  ],
  additions: [],
});

assert.equal(walletQuoteResult.ok, true, 'Wallet quote should succeed');
if (walletQuoteResult.ok) {
  assert.equal(walletQuoteResult.quote.fundingSource, 'wallet');
  assert.equal(walletQuoteResult.quote.priceUSD, 0, 'Wallet quote must be $0.00 USD');
  assert.equal(walletQuoteResult.quote.usedCredits, 88 + 28, 'Used credits must be 116');
  assert.equal(walletQuoteResult.quote.remainingCredits, 200 - 116, 'Remaining credits must be 84');
  assert.equal(walletQuoteResult.quote.remainingWalletCredits, 84);
  console.log('✓ Wallet quote computed correctly: $0 USD due, 116 CR used, 84 CR remaining');
}

// Test 2: Wallet quote rejects when balance is insufficient
const insufficientWalletQuote = computeOrderQuote({
  fundingSource: 'wallet',
  packageId: 'studio-wallet',
  walletBalance: 50,
  selections: [{ id: 'logo', level: 1, quantity: 1 }], // 88 CR
  additions: [],
});
assert.equal(insufficientWalletQuote.ok, false, 'Should reject when walletBalance < usedCredits');
console.log('✓ Pricing engine authoritatively rejects insufficient wallet balance');

// Test 3: Package quote computation with rollover
const packageQuoteResult = computeOrderQuote({
  fundingSource: 'package',
  packageId: 'creator-forge', // 660 CR, $1,500
  selections: [{ id: 'logo', level: 1, quantity: 1 }], // 88 CR
  additions: [],
});
assert.equal(packageQuoteResult.ok, true);
if (packageQuoteResult.ok) {
  assert.equal(packageQuoteResult.quote.fundingSource, 'package');
  assert.equal(packageQuoteResult.quote.priceUSD, 1500);
  assert.equal(packageQuoteResult.quote.totalCredits, 660);
  assert.equal(packageQuoteResult.quote.usedCredits, 88);
  assert.equal(packageQuoteResult.quote.remainingCredits, 572, 'Rollover credits must be 572');
  console.log('✓ Package quote computed correctly: $1,500 USD, 88 CR used, 572 CR surplus rollover');
}

console.log('\n--- TEST SUITE 2: Ledger & Wallet Balance Precision ---');

const testEmail = `test-${Date.now()}@humantek.test`;

// Initial balance for a fresh account must be 0
const initialBal = getUserBalance(testEmail);
assert.equal(initialBal, 0, 'New account starts with 0 balance');
console.log(`✓ Initial balance for ${testEmail}: 0 CR`);

// Deposit 150 CR via voucher/promo topup
adjustUserBalance(testEmail, 150, 'Redeemed voucher TEST150');
const balAfterVoucher = getUserBalance(testEmail);
assert.equal(balAfterVoucher, 150, 'Balance must be 150 CR after promo voucher');
console.log(`✓ Balance after 150 CR voucher: ${balAfterVoucher} CR`);

// Launch a project funded 100% from wallet using 70 CR
const walletProject = {
  id: `proj-test-${Date.now()}`,
  projectCode: 'HT-TEST-WALLET',
  packageId: 'studio-wallet',
  packageName: 'Studio Wallet Balance',
  packagePrice: 0,
  packageCredits: 150,
  usedCredits: 70,
  remainingCredits: 80,
  status: 'pending_review',
  paymentStatus: 'paid',
  paymentMethod: 'credits',
  fundingSource: 'wallet',
  clientName: 'Test Creator',
  channelName: 'TestChannel',
  email: testEmail,
  platform: 'Twitch',
  style: 'Anime',
  colors: '#ff0000',
  instructions: 'Test instructions for brief',
  additions: [],
  selections: [{ id: 'logo', name: 'Logo', level: 1, quantity: 1, credits: 70 }],
  uploadedFiles: [],
  createdAt: new Date().toISOString(),
};

recordWalletFundedProject(walletProject);
const balAfterWalletProject = getUserBalance(testEmail);
assert.equal(balAfterWalletProject, 80, 'Balance must be exactly 80 CR (150 - 70 = 80). No double deduction!');
console.log(`✓ Balance after 70 CR wallet project launch: ${balAfterWalletProject} CR (exact mathematical match)`);

// Now buy a package (200 CR for $500), using 160 CR (surplus 40 CR)
const paidProject = {
  id: `proj-test-paid-${Date.now()}`,
  projectCode: 'HT-TEST-PAID',
  packageId: 'creator-starter',
  packageName: 'Creator Starter',
  packagePrice: 500,
  packageCredits: 200,
  usedCredits: 160,
  remainingCredits: 40,
  status: 'payment_confirmed',
  paymentStatus: 'paid',
  paymentMethod: 'paypal',
  fundingSource: 'package',
  clientName: 'Test Creator',
  channelName: 'TestChannel',
  email: testEmail,
  platform: 'Twitch',
  style: 'Anime',
  colors: '#ff0000',
  instructions: 'Test instructions for brief',
  additions: [],
  selections: [{ id: 'banner', name: 'Banner', level: 1, quantity: 2, credits: 160 }],
  uploadedFiles: [],
  createdAt: new Date().toISOString(),
};

recordPaidProject(paidProject, 'PAY-TEST-999');
const balAfterPackagePurchase = getUserBalance(testEmail);
assert.equal(
  balAfterPackagePurchase,
  120,
  'Balance must be exactly 120 CR (80 previous + 40 rollover = 120). No double counting!'
);
console.log(
  `✓ Balance after package purchase with 40 CR rollover: ${balAfterPackagePurchase} CR (80 + 40 = 120)`
);

// Verify ledger entries for this user
const userLedger = getLedger().filter((e) => e.userEmail === testEmail);
const ledgerSum = userLedger.reduce((sum, e) => sum + e.creditsDelta, 0);
assert.equal(
  ledgerSum,
  balAfterPackagePurchase,
  'Sum of all ledger entries must EXACTLY match user wallet balance'
);
console.log(`✓ Ledger audit verification: sum of ledger entries (${ledgerSum} CR) === wallet balance (${balAfterPackagePurchase} CR)`);

console.log('\n--- TEST SUITE 3: Server API Route Authorization & Fraud Prevention ---');

import { POST as redeemRoute } from '../src/app/api/wallet/redeem/route.ts';
import { POST as projectsRoute } from '../src/app/api/projects/route.ts';
import { POST as paypalCreateRoute } from '../src/app/api/paypal/create-order/route.ts';
import { NextRequest } from 'next/server';

const apiUserEmail = `creator-${Date.now()}@humantek.test`;

// 3.1: Redeem a voucher via /api/wallet/redeem
const redeemReq1 = new NextRequest('http://localhost:3000/api/wallet/redeem', {
  method: 'POST',
  body: JSON.stringify({ code: 'LAUNCH150', email: apiUserEmail }),
  headers: { 'Content-Type': 'application/json' },
});
const redeemRes1 = await redeemRoute(redeemReq1);
const redeemData1 = await redeemRes1.json();

assert.equal(redeemRes1.status, 200);
assert.equal(redeemData1.success, true);
assert.equal(redeemData1.creditsAdded, 150);
assert.equal(redeemData1.newWalletBalance, 150);
console.log('✓ POST /api/wallet/redeem successfully added 150 CR to wallet');

// 3.2: Re-redeeming the same code must be rejected with 409 (Idempotency)
const redeemReq2 = new NextRequest('http://localhost:3000/api/wallet/redeem', {
  method: 'POST',
  body: JSON.stringify({ code: 'LAUNCH150', email: apiUserEmail }),
  headers: { 'Content-Type': 'application/json' },
});
const redeemRes2 = await redeemRoute(redeemReq2);
assert.equal(redeemRes2.status, 409, 'Duplicate redemption must return HTTP 409 Conflict');
console.log('✓ POST /api/wallet/redeem rejected duplicate redemption with HTTP 409');

// 3.3: Redeem a custom parsed voucher HT-300CR-PROMO
const redeemReq3 = new NextRequest('http://localhost:3000/api/wallet/redeem', {
  method: 'POST',
  body: JSON.stringify({ code: 'HT-300CR-PROMO', email: apiUserEmail }),
  headers: { 'Content-Type': 'application/json' },
});
const redeemRes3 = await redeemRoute(redeemReq3);
const redeemData3 = await redeemRes3.json();
assert.equal(redeemRes3.status, 200);
assert.equal(redeemData3.creditsAdded, 300);
assert.equal(redeemData3.newWalletBalance, 450); // 150 + 300 = 450
console.log('✓ POST /api/wallet/redeem parsed 300 CR from code. Balance now 450 CR');

// 3.4: Launch a wallet project via POST /api/projects requiring 116 CR (88 logo + 28 banner)
const walletProjectReq = new NextRequest('http://localhost:3000/api/projects', {
  method: 'POST',
  body: JSON.stringify({
    projectId: `proj-${Date.now()}-ok`,
    packageId: 'studio-wallet',
    fundingSource: 'wallet',
    clientName: 'Alice Creator',
    channelName: 'AliceOfficial',
    email: apiUserEmail,
    platform: 'Twitch',
    style: 'Modern Cyberpunk',
    colors: '#00ffcc, #ff0077',
    instructions: 'Please design a crisp vector logo and matching banner for my stream launch.',
    selections: [
      { id: 'logo', level: 1, quantity: 1 },
      { id: 'banner', level: 0, quantity: 1 },
    ],
    additions: [],
  }),
  headers: { 'Content-Type': 'application/json' },
});
const walletProjectRes = await projectsRoute(walletProjectReq);
const walletProjectData = await walletProjectRes.json();

assert.equal(walletProjectRes.status, 200);
assert.equal(walletProjectData.success, true);
assert.equal(walletProjectData.project.paymentStatus, 'paid');
assert.equal(walletProjectData.project.paymentMethod, 'credits');
assert.equal(walletProjectData.project.packagePrice, 0);
assert.equal(walletProjectData.newWalletBalance, 450 - 116); // 334
console.log(`✓ POST /api/projects created wallet project for $0 USD, debited 116 CR. Balance now ${walletProjectData.newWalletBalance} CR`);

// 3.5: Fraud prevention attack vector: An attacker with 0 credits sends forged walletBalance: 999999
const attackerEmail = `attacker-${Date.now()}@humantek.test`;
const forgedProjectReq = new NextRequest('http://localhost:3000/api/projects', {
  method: 'POST',
  body: JSON.stringify({
    projectId: `proj-${Date.now()}-hacked`,
    packageId: 'studio-wallet',
    fundingSource: 'wallet',
    walletBalance: 999999, // Forged client balance!
    clientName: 'Malicious Attacker',
    channelName: 'AttackerChannel',
    email: attackerEmail,
    platform: 'YouTube',
    style: 'Dark',
    colors: '#000000',
    instructions: 'Attempting to launch project without having server balance.',
    selections: [{ id: 'logo', level: 1, quantity: 1 }],
    additions: [],
  }),
  headers: { 'Content-Type': 'application/json' },
});
const forgedProjectRes = await projectsRoute(forgedProjectReq);
assert.ok(
  forgedProjectRes.status === 400 || forgedProjectRes.status === 422,
  'Server must reject forged wallet balance with HTTP 400 or 422'
);
console.log(`✓ POST /api/projects authoritatively rejected forged walletBalance: 999999 with HTTP ${forgedProjectRes.status}`);

// 3.6: PayPal create-order route must reject wallet-funded orders
const paypalWalletReq = new NextRequest('http://localhost:3000/api/paypal/create-order', {
  method: 'POST',
  body: JSON.stringify({
    projectId: `proj-${Date.now()}-pp-reject`,
    packageId: 'studio-wallet',
    fundingSource: 'wallet',
    clientName: 'Alice Creator',
    channelName: 'AliceOfficial',
    email: apiUserEmail,
    platform: 'Twitch',
    style: 'Modern Cyberpunk',
    colors: '#00ffcc',
    instructions: 'Testing PayPal rejection of wallet funding source.',
    selections: [{ id: 'logo', level: 1, quantity: 1 }],
    additions: [],
  }),
  headers: { 'Content-Type': 'application/json' },
});
const paypalWalletRes = await paypalCreateRoute(paypalWalletReq);
assert.equal(paypalWalletRes.status, 400, 'PayPal create-order must reject wallet-funded orders');
console.log('✓ POST /api/paypal/create-order rejected wallet-funded order with HTTP 400');

console.log('\n=============================================');
console.log('ALL VERIFICATION TEST SUITES PASSED (100%)!');
console.log('=============================================');
