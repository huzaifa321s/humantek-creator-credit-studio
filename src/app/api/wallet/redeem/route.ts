import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, isSupabaseConfigured } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { createNotification, notifyAdmins } from '@/lib/notifications';
import { reportStudioError } from '@/lib/error-reporter';
import {
  parseGiftPromoMetadata,
  buildGiftCodeRedeemedOwnerEmailTemplate,
  buildGiftCodeRedeemedSenderEmailTemplate,
  buildGiftCodeRedeemedRecipientEmailTemplate,
  sendStudioEmail,
  type StudioEmailDispatchResult,
} from '@/lib/email';
import {
  adjustUserBalance,
  getClientGiftPromoByCode,
  markClientGiftPromoRedeemed,
} from '@/lib/store';

// Rate limiting: in-memory sliding window for brute-force protection
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(identifier: string, limit = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (record.count >= limit) {
    return true;
  }

  record.count += 1;
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.role === 'admin') {
      return NextResponse.json(
        { error: 'Administrators cannot redeem promo codes.' },
        { status: 403 }
      );
    }

    if (!user.emailConfirmed) {
      return NextResponse.json(
        { error: 'Please confirm your email address before redeeming promotional credits.' },
        { status: 403 }
      );
    }

    // Rate limiting per authenticated user AND per IP
    const userIdentifier = user.id || user.email.toLowerCase().trim();
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || userIdentifier;
    if (isRateLimited(`redeem:user:${userIdentifier}`) || isRateLimited(`redeem:ip:${clientIp}`)) {
      return NextResponse.json(
        { error: 'Too many redemption attempts. Please wait a minute and try again.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawCode = typeof body.code === 'string' ? body.code : '';
    const cleanCode = rawCode.trim().toUpperCase();

    if (!cleanCode || cleanCode.length < 3 || cleanCode.length > 32) {
      return NextResponse.json({ error: 'Please enter a valid promo code' }, { status: 400 });
    }

    const cleanUserEmail = user.email.trim().toLowerCase();
    const recipientName = user.name || cleanUserEmail.split('@')[0] || 'Creator';
    const ownerEmail =
      (process.env.STUDIO_OWNER_EMAIL || '').trim().toLowerCase() || 'admin-credits@humantekart.com';

    // 1. Production / Real Supabase Path (Atomic PostgreSQL RPC)
    if (isSupabaseConfigured() && user.id && !user.isDevFallback) {
      const adminClient = createAdminClient();

      // Ensure wallet row exists before redeeming promo code
      await adminClient
        .from('wallets')
        .upsert(
          { user_id: user.id },
          { onConflict: 'user_id', ignoreDuplicates: true }
        );

      // Pre-check if this promo code is a Client-to-Client Gift Code with recipient restrictions
      const { data: promoRow } = await adminClient
        .from('promo_codes')
        .select('id, code, credits, max_uses, used_count, is_active, description')
        .eq('code', cleanCode)
        .maybeSingle();

      const giftMeta = parseGiftPromoMetadata(promoRow?.description);

      if (giftMeta) {
        if (giftMeta.senderId === user.id || giftMeta.senderEmail === cleanUserEmail) {
          return NextResponse.json(
            { error: 'You cannot redeem a gift promo code that you generated yourself.' },
            { status: 400 }
          );
        }
        if (giftMeta.recipientEmail && giftMeta.recipientEmail !== cleanUserEmail) {
          return NextResponse.json(
            {
              error: `This gift promo code was created exclusively for ${giftMeta.recipientEmail}. Please sign in with that email to claim it.`,
            },
            { status: 403 }
          );
        }
      }

      const { data, error } = await adminClient.rpc('redeem_promo', {
        p_user: user.id,
        p_raw_code: cleanCode,
      });

      if (error) {
        const errorMsg = error.message || '';
        if (errorMsg.includes('email_not_confirmed')) {
          return NextResponse.json(
            { error: 'Please confirm your email address before redeeming promotional credits.' },
            { status: 403 }
          );
        }
        if (errorMsg.includes('already_redeemed')) {
          return NextResponse.json(
            { error: 'You have already redeemed this promo voucher.' },
            { status: 400 }
          );
        }
        if (errorMsg.includes('invalid_or_exhausted_code') || errorMsg.includes('invalid_code')) {
          return NextResponse.json(
            { error: 'Invalid, expired, or already claimed promo code.' },
            { status: 400 }
          );
        }
        await reportStudioError({
          area: 'Promo Redemption RPC Failed',
          route: 'POST /api/wallet/redeem',
          severity: 'ERROR',
          error,
          user,
          context: { code: cleanCode },
        });
        return NextResponse.json(
          { error: 'Unable to redeem code. Please verify and try again.' },
          { status: 400 }
        );
      }

      const result = data as {
        success: boolean;
        credits_granted: number;
        new_balance: number;
        code: string;
      };

      const emailsDispatched: StudioEmailDispatchResult[] = [];

      if (giftMeta) {
        // 1A. Inner Dashboard Notification -> Recipient (Client B)
        await createNotification({
          userId: user.id,
          type: 'wallet_credit',
          title: `Gift Credits Added · +${result.credits_granted} Credits`,
          message: `+${result.credits_granted} Credits shared by ${giftMeta.senderName} (${giftMeta.senderEmail}) via code ${result.code} have been added to your Studio Wallet.`,
          link: '/redeem-code',
          actionLabel: 'View Balance',
          entityType: 'wallet',
          entityId: result.code,
        });

        // 1B. Inner Dashboard Notification -> Sender (Client A)
        if (giftMeta.senderId) {
          await createNotification({
            userId: giftMeta.senderId,
            type: 'wallet_credit',
            title: `Your ${result.credits_granted} Credits Gift Code Was Claimed!`,
            message: `${recipientName} (${cleanUserEmail}) claimed your shared promo code ${result.code} (+${result.credits_granted} Credits).`,
            link: '/redeem-code?tab=share',
            actionLabel: 'View Shared Codes',
            entityType: 'wallet',
            entityId: result.code,
          });
        }

        // 1C. Inner Dashboard Notification -> Studio Owner & Management Team
        await notifyAdmins({
          type: 'wallet_credit',
          title: `Client Gift Code Claimed · ${result.credits_granted} Credits`,
          message: `${recipientName} (${cleanUserEmail}) redeemed promo code ${result.code} (+${result.credits_granted} Credits) shared by ${giftMeta.senderName} (${giftMeta.senderEmail}).`,
          link: `/management/ledger?customer=${encodeURIComponent(cleanUserEmail)}`,
          actionLabel: 'View Ledger',
          entityType: 'wallet',
          entityId: result.code,
        });

        // 1D. Email Dispatches (Studio Owner, Sender, and Recipient)
        const [ownerEmailRes, senderEmailRes, recipientEmailRes] = await Promise.all([
          sendStudioEmail(
            buildGiftCodeRedeemedOwnerEmailTemplate({
              ownerEmail,
              code: result.code,
              credits: result.credits_granted,
              senderName: giftMeta.senderName,
              senderEmail: giftMeta.senderEmail,
              recipientName,
              recipientEmail: cleanUserEmail,
            })
          ),
          sendStudioEmail(
            buildGiftCodeRedeemedSenderEmailTemplate({
              senderName: giftMeta.senderName,
              senderEmail: giftMeta.senderEmail,
              recipientName,
              recipientEmail: cleanUserEmail,
              code: result.code,
              credits: result.credits_granted,
            })
          ),
          sendStudioEmail(
            buildGiftCodeRedeemedRecipientEmailTemplate({
              recipientName,
              recipientEmail: cleanUserEmail,
              senderName: giftMeta.senderName,
              senderEmail: giftMeta.senderEmail,
              code: result.code,
              credits: result.credits_granted,
              newBalance: result.new_balance,
            })
          ),
        ]);
        emailsDispatched.push(ownerEmailRes, senderEmailRes, recipientEmailRes);
      } else {
        // Standard Studio Promo Code Notifications (Recipient + Studio Owner/Admins + Owner Email)
        await createNotification({
          userId: user.id,
          type: 'wallet_credit',
          title: `Credits added · +${result.credits_granted} Credits`,
          message: `+${result.credits_granted} Credits from promo code ${result.code} added to your studio wallet.`,
          link: '/redeem-code',
          actionLabel: 'View Balance',
          entityType: 'wallet',
          entityId: result.code,
        });

        await notifyAdmins({
          type: 'wallet_credit',
          title: `Promo Code Redeemed · ${result.credits_granted} Credits`,
          message: `${recipientName} (${cleanUserEmail}) redeemed studio promo code ${result.code} (+${result.credits_granted} Credits).`,
          link: `/management/ledger?customer=${encodeURIComponent(cleanUserEmail)}`,
          actionLabel: 'View Ledger',
          entityType: 'wallet',
          entityId: result.code,
        });

        const ownerEmailRes = await sendStudioEmail(
          buildGiftCodeRedeemedOwnerEmailTemplate({
            ownerEmail,
            code: result.code,
            credits: result.credits_granted,
            senderName: 'Studio Promo Grant',
            senderEmail: ownerEmail,
            recipientName,
            recipientEmail: cleanUserEmail,
          })
        );
        emailsDispatched.push(ownerEmailRes);
      }

      return NextResponse.json({
        success: true,
        code: result.code,
        creditsAdded: result.credits_granted,
        newWalletBalance: result.new_balance,
        sharedBy: giftMeta
          ? { name: giftMeta.senderName, email: giftMeta.senderEmail, note: giftMeta.note }
          : null,
        emailsDispatched,
        message: giftMeta
          ? `Successfully claimed ${result.credits_granted} Credits shared by ${giftMeta.senderName}!`
          : `Successfully redeemed ${result.credits_granted} Credits to your studio wallet!`,
      });
    }

    // 2. Development / Offline Fallback Path
    const offlineGift = getClientGiftPromoByCode(cleanCode);
    if (offlineGift) {
      if (offlineGift.status === 'claimed') {
        return NextResponse.json(
          { error: 'This gift promo code has already been claimed.' },
          { status: 400 }
        );
      }
      if (offlineGift.senderEmail.toLowerCase() === cleanUserEmail) {
        return NextResponse.json(
          { error: 'You cannot redeem a gift promo code that you generated yourself.' },
          { status: 400 }
        );
      }
      if (
        offlineGift.recipientEmail &&
        offlineGift.recipientEmail.toLowerCase() !== cleanUserEmail
      ) {
        return NextResponse.json(
          {
            error: `This gift promo code was created exclusively for ${offlineGift.recipientEmail}.`,
          },
          { status: 403 }
        );
      }

      markClientGiftPromoRedeemed(cleanCode, cleanUserEmail);
      const newBalance = adjustUserBalance(
        user.email,
        offlineGift.credits,
        `Claimed gift promo code ${cleanCode} from ${offlineGift.senderName} (${offlineGift.senderEmail})`
      );

      const ownerEmailRes = await sendStudioEmail(
        buildGiftCodeRedeemedOwnerEmailTemplate({
          ownerEmail,
          code: cleanCode,
          credits: offlineGift.credits,
          senderName: offlineGift.senderName,
          senderEmail: offlineGift.senderEmail,
          recipientName,
          recipientEmail: cleanUserEmail,
        })
      );

      return NextResponse.json({
        success: true,
        code: cleanCode,
        creditsAdded: offlineGift.credits,
        newWalletBalance: newBalance,
        sharedBy: {
          name: offlineGift.senderName,
          email: offlineGift.senderEmail,
          note: offlineGift.note,
        },
        emailsDispatched: [ownerEmailRes],
        message: `Successfully claimed ${offlineGift.credits} Credits shared by ${offlineGift.senderName}!`,
      });
    }

    // Parse credits from patterns like HT-150CR-XXXX or default to 80 CR
    let grantedCredits = 80;
    const match = cleanCode.match(/(\d+)\s*CR/i);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (parsed > 0 && parsed <= 5000) grantedCredits = parsed;
    }

    const newBalance = adjustUserBalance(
      user.email,
      grantedCredits,
      `Redeemed promotional code ${cleanCode}`
    );

    return NextResponse.json({
      success: true,
      code: cleanCode,
      creditsAdded: grantedCredits,
      newWalletBalance: newBalance,
      sharedBy: null,
      message: `Successfully redeemed ${grantedCredits} Credits to your studio wallet!`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    await reportStudioError({
      area: 'Promo Redemption Exception',
      route: 'POST /api/wallet/redeem',
      severity: 'CRITICAL',
      error,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
