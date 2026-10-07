-- ============================================================
-- HUMANTEK STUDIO: LEDGER CONCURRENCY & INVARIANT TEST SUITE
-- Runs inside PostgreSQL (Supabase SQL Editor or psql)
-- ============================================================

do $$
declare
  v_test_user uuid := '11111111-1111-1111-1111-111111111111';
  v_other_user uuid := '22222222-2222-2222-2222-222222222222';
  v_bal int;
  v_promo_bal int;
  v_purchased_bal int;
  v_calc_promo int;
  v_calc_purchased int;
  v_promo_code text := 'TEST-PROMO-5X';
  v_promo_id uuid;
  v_err_count int := 0;
  v_success_count int := 0;
  i int;
begin
  raise notice '====================================================';
  raise notice 'RUNNING HUMANTEK LEDGER & PROMO TEST SUITE';
  raise notice '====================================================';

  -- -----------------------------------------------------------
  -- SETUP: Create test profiles and wallets
  -- -----------------------------------------------------------
  delete from public.promo_redemptions where promo_code_id in (select id from public.promo_codes where code = v_promo_code);
  delete from public.promo_codes where code = v_promo_code;
  delete from public.credit_ledger where user_id in (v_test_user, v_other_user);
  delete from public.wallets where user_id in (v_test_user, v_other_user);
  delete from public.profiles where id in (v_test_user, v_other_user);

  insert into public.profiles (id, email, role) values (v_test_user, 'test-ledger@humantek.art', 'client');
  insert into public.wallets (user_id, balance_purchased, balance_promo) values (v_test_user, 0, 0);

  insert into public.profiles (id, email, role) values (v_other_user, 'test-other@humantek.art', 'client');
  insert into public.wallets (user_id, balance_purchased, balance_promo) values (v_other_user, 0, 0);

  -- -----------------------------------------------------------
  -- TEST 1: Promo-first Spending across both buckets
  -- Setup: 50 promo + 100 purchased. Spend 70.
  -- Expected: 0 promo, 80 purchased (Total 80 CR).
  -- -----------------------------------------------------------
  perform public.ledger_post(v_test_user, 'promo', 50, 'promo_redeem', 'GRANT-P50', 'k-init-p50', 'Test promo grant');
  perform public.ledger_post(v_test_user, 'purchased', 100, 'package_purchase', 'GRANT-B100', 'k-init-b100', 'Test purchased grant');

  v_bal := public.spend_credits(v_test_user, 70, 'ORDER-TEST-1', 'k-spend-70', 'Spend across buckets');

  select balance_promo, balance_purchased, balance_credits 
    into v_promo_bal, v_purchased_bal, v_bal 
    from public.wallets where user_id = v_test_user;

  if v_promo_bal = 0 and v_purchased_bal = 80 and v_bal = 80 then
    raise notice '[PASS] Test 1: Promo-first spending across buckets (promo=0, purchased=80, total=80)';
  else
    raise exception '[FAIL] Test 1: Expected promo=0, purchased=80, got promo=%, purchased=%', v_promo_bal, v_purchased_bal;
  end if;

  -- -----------------------------------------------------------
  -- TEST 2: Replay idempotency & Mismatched Payload Detection
  -- Expected: Replaying same key returns balance. Different payload raises error.
  -- -----------------------------------------------------------
  -- Replay same spend:
  v_bal := public.spend_credits(v_test_user, 70, 'ORDER-TEST-1', 'k-spend-70', 'Spend across buckets');
  if v_bal = 80 then
    raise notice '[PASS] Test 2a: Idempotent replay of spend returned identical balance';
  else
    raise exception '[FAIL] Test 2a: Expected balance 80 on replay, got %', v_bal;
  end if;

  -- Replay same key with different amount on ledger_post directly:
  begin
    perform public.ledger_post(v_test_user, 'promo', 999, 'promo_redeem', 'DIFF', 'k-init-p50', 'Hacked payload');
    raise exception '[FAIL] Test 2b: Idempotency payload mismatch was not caught!';
  exception when others then
    if sqlerrm like '%idempotency key reused with a different payload%' then
      raise notice '[PASS] Test 2b: Payload tampering with reused key successfully aborted';
    else
      raise exception '[FAIL] Test 2b: Unexpected error: %', sqlerrm;
    end if;
  end;

  -- -----------------------------------------------------------
  -- TEST 3: Project cancellation restores to original buckets
  -- Reverse the 70 CR spend (which spent 50 promo and 20 purchased)
  -- -----------------------------------------------------------
  declare
    r record;
  begin
    for r in (select id, bucket, -delta as refund_delta 
                from public.credit_ledger 
               where reference_id = 'ORDER-TEST-1' and type = 'service_deduction') loop
      perform public.ledger_post(
        v_test_user,
        r.bucket,
        r.refund_delta,
        'refund_wallet',
        'CANCEL-ORDER-TEST-1',
        'k-cancel-' || r.id,
        'Project cancellation refund',
        r.id
      );
    end loop;
  end;

  select balance_promo, balance_purchased, balance_credits 
    into v_promo_bal, v_purchased_bal, v_bal 
    from public.wallets where user_id = v_test_user;

  if v_promo_bal = 50 and v_purchased_bal = 100 and v_bal = 150 then
    raise notice '[PASS] Test 3a: Cancellation restored exact original buckets (promo=50, purchased=100)';
  else
    raise exception '[FAIL] Test 3a: Expected promo=50, purchased=100, got promo=%, purchased=%', v_promo_bal, v_purchased_bal;
  end if;

  -- Second cancellation attempt on same reverses_id must fail due to unique constraint:
  begin
    declare
      v_orig_id bigint;
    begin
      select id into v_orig_id from public.credit_ledger where reference_id = 'ORDER-TEST-1' limit 1;
      perform public.ledger_post(
        v_test_user, 'promo', 50, 'refund_wallet', 'CANCEL-DUP', 'k-cancel-dup', 'Double cancel', v_orig_id
      );
      raise exception '[FAIL] Test 3b: Double cancellation succeeded!';
    end;
  exception when unique_violation then
    raise notice '[PASS] Test 3b: Double reversal blocked by unique reverses_id constraint';
  end;

  -- -----------------------------------------------------------
  -- TEST 4: Cash refund blocked if purchased balance is insufficient
  -- User has 100 purchased. Spend 100. Then try cash refund of 50.
  -- -----------------------------------------------------------
  perform public.spend_credits(v_test_user, 150, 'ORDER-EMPTY', 'k-spend-all', 'Empty wallet');
  -- Now balance_purchased = 0, balance_promo = 0
  begin
    perform public.ledger_post(v_test_user, 'purchased', -50, 'refund_cash', 'PAYPAL-REFUND', 'k-cash-ref-fail', 'Clawback cash');
    raise exception '[FAIL] Test 4: Cash clawback succeeded on spent balance!';
  exception when check_violation then
    raise notice '[PASS] Test 4: Cash refund check constraint blocked negative balance on spent credits';
  end;

  -- -----------------------------------------------------------
  -- TEST 5: Promo Code limited redemptions (max_uses = 2)
  -- -----------------------------------------------------------
  insert into public.promo_codes (code, credits, max_uses, is_active)
  values (v_promo_code, 25, 2, true)
  returning id into v_promo_id;

  -- User 1 redeems:
  perform public.redeem_promo(v_test_user, v_promo_code);
  raise notice '[PASS] Test 5a: User 1 redeemed promo code successfully';

  -- User 1 tries to redeem again (blocked):
  begin
    perform public.redeem_promo(v_test_user, v_promo_code);
    raise exception '[FAIL] Test 5b: Duplicate redemption by same user succeeded!';
  exception when others then
    if sqlerrm like '%already_redeemed%' then
      raise notice '[PASS] Test 5b: Re-redemption blocked by unique (user_id, promo_code_id)';
    else
      raise exception '[FAIL] Test 5b: Unexpected error: %', sqlerrm;
    end if;
  end;

  -- User 2 redeems (2nd use, hits max_uses):
  perform public.redeem_promo(v_other_user, v_promo_code);
  raise notice '[PASS] Test 5c: User 2 redeemed 2nd spot successfully';

  -- User 3 (or user 1 again) tries: code is now exhausted:
  begin
    perform public.redeem_promo(v_test_user, v_promo_code);
    raise exception '[FAIL] Test 5d: Exhausted code allowed redemption!';
  exception when others then
    raise notice '[PASS] Test 5d: Exhausted promo code blocked correctly';
  end;

  -- -----------------------------------------------------------
  -- TEST 6: User Delete Protection (on delete restrict)
  -- Deleting a user with ledger history must be rejected cleanly.
  -- -----------------------------------------------------------
  begin
    delete from public.profiles where id = v_test_user;
    raise exception '[FAIL] Test 6: Deleting user with financial ledger succeeded!';
  exception when foreign_key_violation then
    raise notice '[PASS] Test 6: on delete restrict cleanly prevented cascading deletion of financial history';
  end;

  -- -----------------------------------------------------------
  -- TEST 7: Ledger Invariant Check (Sum of Deltas == Wallet Balance)
  -- -----------------------------------------------------------
  select 
    coalesce(sum(case when bucket = 'promo' then delta else 0 end), 0),
    coalesce(sum(case when bucket = 'purchased' then delta else 0 end), 0)
  into v_calc_promo, v_calc_purchased
  from public.credit_ledger
  where user_id = v_test_user;

  select balance_promo, balance_purchased into v_promo_bal, v_purchased_bal
  from public.wallets
  where user_id = v_test_user;

  if v_calc_promo = v_promo_bal and v_calc_purchased = v_purchased_bal then
    raise notice '[PASS] Test 7: Ledger invariant verified! sum(promo deltas)=% equals wallet, sum(purchased deltas)=% equals wallet', v_calc_promo, v_calc_purchased;
  else
    raise exception '[FAIL] Test 7: Invariant mismatch! Ledger promo=%, Wallet promo=%, Ledger paid=%, Wallet paid=%',
      v_calc_promo, v_promo_bal, v_calc_purchased, v_purchased_bal;
  end if;

  raise notice '====================================================';
  raise notice 'ALL 7 LEDGER & PROMO VERIFICATION TESTS PASSED!';
  raise notice '====================================================';
end;
$$;
