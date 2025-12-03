import express from 'express';
import { prisma } from '../config/prismaClient.js';
import {
  createStripeClient,
  isStripeClientConfigured,
  StripeNotConfiguredError,
} from '../utils/stripeClient.js';
import { sendEmail } from '../utils/email.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { sendError, ErrorCodes } from '../utils/errorHandler.js';

const router = express.Router();
const stripe = createStripeClient();
const stripeAvailable = isStripeClientConfigured(stripe);

const PLAN_PRICE_MAP = {
  BASIC: process.env.STRIPE_PRICE_ID_BASIC || process.env.STRIPE_PRICE_ID_STARTER, // Support both names for backward compatibility
  PROFESSIONAL: process.env.STRIPE_PRICE_ID_PROFESSIONAL,
  ENTERPRISE: process.env.STRIPE_PRICE_ID_ENTERPRISE,
};

const PRICE_PLAN_MAP = Object.entries(PLAN_PRICE_MAP).reduce((acc, [plan, priceId]) => {
  if (priceId) acc[priceId] = plan;
  return acc;
}, {});

function normalisePlan(plan) {
  if (!plan) return undefined;
  const upper = String(plan).trim().toUpperCase();
  if (upper === 'FREE_TRIAL') return upper;
  return PLAN_PRICE_MAP[upper] ? upper : undefined;
}

function resolvePlanFromPriceId(priceId, fallback) {
  if (!priceId) return normalisePlan(fallback);
  return PRICE_PLAN_MAP[priceId] || normalisePlan(fallback);
}

function mapStripeStatusToAppStatus(status, fallback = 'PENDING') {
  const normalised = typeof status === 'string' ? status.toLowerCase() : '';
  switch (normalised) {
    case 'active':
      return 'ACTIVE';
    case 'trialing':
      return 'TRIAL';
    case 'past_due':
    case 'unpaid':
    case 'paused':
      return 'SUSPENDED';
    case 'canceled':
    case 'cancelled':
    case 'incomplete_expired':
      return 'CANCELLED';
    case 'incomplete':
      return 'PENDING';
    default:
      return fallback;
  }
}

async function applySubscriptionUpdate({ userId, orgId, data }) {
  if (!data) return;

  const cleanedEntries = Object.entries(data).filter(([, value]) => value !== undefined);
  if (cleanedEntries.length === 0) return;

  const cleaned = Object.fromEntries(cleanedEntries);

  if (userId) {
    await prisma.user.update({ where: { id: userId }, data: cleaned });
    return;
  }

  if (orgId) {
    await prisma.user.updateMany({ where: { orgId }, data: cleaned });
  }
}

// POST /api/billing/checkout
router.post('/checkout', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return sendError(res, 401, 'No token', ErrorCodes.AUTH_NO_TOKEN);

    let user;
    try {
      user = verifyAccessToken(token);
    } catch {
      return sendError(res, 401, 'Invalid token', ErrorCodes.AUTH_INVALID_TOKEN);
    }

    // Get full user data to check role
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) {
      return sendError(res, 401, 'User not found', ErrorCodes.RES_USER_NOT_FOUND);
    }

    // Only property managers (and admins) can access subscription checkout
    if (dbUser.role !== 'PROPERTY_MANAGER' && dbUser.role !== 'ADMIN') {
      return sendError(
        res,
        403,
        'Only property managers can manage subscriptions. Please contact your property manager.',
        ErrorCodes.ACC_ROLE_REQUIRED
      );
    }

    const { plan = 'BASIC', successUrl, cancelUrl, addOns = [] } = req.body || {};
    const normalisedPlan = normalisePlan(plan) || 'BASIC';

    if (!stripeAvailable) {
      return sendError(res, 503, 'Stripe is not configured', ErrorCodes.EXT_STRIPE_NOT_CONFIGURED);
    }

    const priceId = PLAN_PRICE_MAP[normalisedPlan];
    if (!priceId) return sendError(res, 400, `Unknown plan or missing price id: ${plan}`, ErrorCodes.VAL_INVALID_REQUEST);

    const defaultSuccess = `${process.env.FRONTEND_URL}/subscriptions?success=1`;
    const baseSuccess = (successUrl || process.env.STRIPE_SUCCESS_URL || defaultSuccess);
    const success = `${baseSuccess}${baseSuccess.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`;
    const cancel = cancelUrl || process.env.STRIPE_CANCEL_URL || `${process.env.FRONTEND_URL}/subscriptions?canceled=1`;

    const metadata = {
      orgId: user.orgId || '',
      userId: user.id || '',
      plan: normalisedPlan,
    };

    // Build line items with main plan and any add-ons
    const lineItems = [{ price: priceId, quantity: 1 }];

    // Add-ons support (e.g., extra properties, extra team members, extra storage)
    // Add-ons should have their own Stripe price IDs configured in environment variables
    const ADD_ON_PRICE_IDS = {
      extraProperties: process.env.STRIPE_ADDON_EXTRA_PROPERTIES,
      extraTeamMembers: process.env.STRIPE_ADDON_EXTRA_TEAM_MEMBERS,
      extraStorage: process.env.STRIPE_ADDON_EXTRA_STORAGE,
      extraAutomation: process.env.STRIPE_ADDON_EXTRA_AUTOMATION,
    };

    if (Array.isArray(addOns)) {
      for (const addOn of addOns) {
        const priceId = ADD_ON_PRICE_IDS[addOn.type];
        if (priceId) {
          lineItems.push({
            price: priceId,
            quantity: addOn.quantity || 1,
          });

          // Store add-on in metadata
          metadata[`addOn_${addOn.type}`] = `${addOn.quantity || 1}`;
        }
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: lineItems,
      success_url: success,
      cancel_url: cancel,
      customer_email: dbUser.email,
      client_reference_id: dbUser.orgId || dbUser.id,
      metadata,
      subscription_data: {
        metadata: {
          ...metadata,
          addOns: JSON.stringify(addOns),
        },
      },
      allow_promotion_codes: true,
    });

    return res.json({ id: session.id, url: session.url });
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      return sendError(res, 503, err.message, ErrorCodes.EXT_STRIPE_NOT_CONFIGURED);
    }
    console.error('Stripe checkout error:', err);
    return sendError(res, 500, 'Checkout failed', ErrorCodes.EXT_STRIPE_ERROR);
  }
});

// POST /api/billing/confirm  { sessionId }
router.post('/confirm', async (req, res) => {
  try {
    if (!stripeAvailable) {
      return sendError(res, 503, 'Stripe is not configured', ErrorCodes.EXT_STRIPE_NOT_CONFIGURED);
    }

    const { sessionId } = req.body || {};
    if (!sessionId) return sendError(res, 400, 'sessionId required', ErrorCodes.VAL_MISSING_FIELD);

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription.items.data.price'],
    });

    if (session.mode !== 'subscription') {
      return sendError(res, 400, 'Not a subscription session', ErrorCodes.VAL_INVALID_REQUEST);
    }
    const isComplete = session.status === 'complete' || session.payment_status === 'paid';
    if (!isComplete) return sendError(res, 400, 'Session not complete', ErrorCodes.ERR_BAD_REQUEST);

    const userId = session.metadata?.userId;
    const orgId = session.metadata?.orgId || session.client_reference_id;
    const subscription =
      session.subscription && typeof session.subscription === 'object'
        ? session.subscription
        : null;

    const priceId = subscription?.items?.data?.[0]?.price?.id;
    const plan = resolvePlanFromPriceId(priceId, session.metadata?.plan || 'BASIC');
    const status = mapStripeStatusToAppStatus(subscription?.status, 'ACTIVE');

    const data = { subscriptionStatus: status };
    if (plan) data.subscriptionPlan = plan;
    if (status === 'ACTIVE') data.trialEndDate = null;

    await applySubscriptionUpdate({
      userId,
      orgId,
      data,
    });

    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      return sendError(res, 503, err.message, ErrorCodes.EXT_STRIPE_NOT_CONFIGURED);
    }
    console.error('Stripe confirm error:', err);
    return sendError(res, 500, 'Confirm failed', ErrorCodes.EXT_STRIPE_ERROR);
  }
});

// Helper function to authenticate requests
async function authenticateRequest(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;

  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}

// GET /api/billing/invoices - List Stripe invoices for the current user
router.get('/invoices', async (req, res) => {
  try {
    const user = await authenticateRequest(req);
    if (!user) return sendError(res, 401, 'Authentication required', ErrorCodes.AUTH_UNAUTHORIZED);

    // Verify user is a property manager or admin
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });

    if (!dbUser || (dbUser.role !== 'PROPERTY_MANAGER' && dbUser.role !== 'ADMIN')) {
      return sendError(
        res,
        403,
        'Only property managers can view invoices. Please contact your property manager.',
        ErrorCodes.ACC_ROLE_REQUIRED
      );
    }

    if (!stripeAvailable) {
      return sendError(res, 503, 'Stripe is not configured', ErrorCodes.EXT_STRIPE_NOT_CONFIGURED);
    }

    // Find user's Stripe customer ID
    const userWithSubscriptions = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        subscriptions: {
          where: {
            stripeCustomerId: { not: null },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!userWithSubscriptions || !userWithSubscriptions.subscriptions[0]?.stripeCustomerId) {
      return res.json({ invoices: [] });
    }

    const stripeCustomerId = userWithSubscriptions.subscriptions[0].stripeCustomerId;

    // Fetch invoices from Stripe
    const invoices = await stripe.invoices.list({
      customer: stripeCustomerId,
      limit: 100,
    });

    const formattedInvoices = invoices.data.map(invoice => ({
      id: invoice.id,
      number: invoice.number,
      amount: invoice.amount_paid / 100, // Convert cents to dollars
      currency: invoice.currency.toUpperCase(),
      status: invoice.status,
      created: invoice.created,
      dueDate: invoice.due_date,
      paidAt: invoice.status_transitions?.paid_at,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdf: invoice.invoice_pdf,
      description: invoice.lines?.data[0]?.description || 'Subscription',
    }));

    return res.json({ invoices: formattedInvoices });
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      return sendError(res, 503, err.message, ErrorCodes.EXT_STRIPE_NOT_CONFIGURED);
    }
    console.error('Stripe invoices error:', err);
    return sendError(res, 500, 'Failed to fetch invoices', ErrorCodes.EXT_STRIPE_ERROR);
  }
});

// POST /api/billing/payment-method - Update payment method
router.post('/payment-method', async (req, res) => {
  try {
    const user = await authenticateRequest(req);
    if (!user) return sendError(res, 401, 'Authentication required', ErrorCodes.AUTH_UNAUTHORIZED);

    // Verify user is a property manager or admin
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });

    if (!dbUser || (dbUser.role !== 'PROPERTY_MANAGER' && dbUser.role !== 'ADMIN')) {
      return sendError(
        res,
        403,
        'Only property managers can update payment methods. Please contact your property manager.',
        ErrorCodes.ACC_ROLE_REQUIRED
      );
    }

    if (!stripeAvailable) {
      return sendError(res, 503, 'Stripe is not configured', ErrorCodes.EXT_STRIPE_NOT_CONFIGURED);
    }

    // Find user's Stripe customer ID (reuse dbUser but fetch with subscriptions)
    const userWithSubscriptions = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        subscriptions: {
          where: {
            stripeCustomerId: { not: null },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!userWithSubscriptions || !userWithSubscriptions.subscriptions[0]?.stripeCustomerId) {
      return sendError(res, 404, 'No active subscription found', ErrorCodes.RES_NOT_FOUND);
    }

    const stripeCustomerId = userWithSubscriptions.subscriptions[0].stripeCustomerId;

    // Create a billing portal session for updating payment method
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/subscriptions`,
    });

    return res.json({ url: portalSession.url });
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      return sendError(res, 503, err.message, ErrorCodes.EXT_STRIPE_NOT_CONFIGURED);
    }
    console.error('Stripe payment method error:', err);
    return sendError(res, 500, 'Failed to update payment method', ErrorCodes.EXT_STRIPE_ERROR);
  }
});

// POST /api/billing/cancel - Cancel subscription
router.post('/cancel', async (req, res) => {
  try {
    const user = await authenticateRequest(req);
    if (!user) return sendError(res, 401, 'Authentication required', ErrorCodes.AUTH_UNAUTHORIZED);

    // Verify user is a property manager or admin
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });

    if (!dbUser || (dbUser.role !== 'PROPERTY_MANAGER' && dbUser.role !== 'ADMIN')) {
      return sendError(
        res,
        403,
        'Only property managers can cancel subscriptions. Please contact your property manager.',
        ErrorCodes.ACC_ROLE_REQUIRED
      );
    }

    if (!stripeAvailable) {
      return sendError(res, 503, 'Stripe is not configured', ErrorCodes.EXT_STRIPE_NOT_CONFIGURED);
    }

    const { immediate = false } = req.body || {};

    // Find user's active subscription
    const userWithSubscriptions = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        subscriptions: {
          where: {
            stripeSubscriptionId: { not: null },
            status: 'ACTIVE',
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!userWithSubscriptions || !userWithSubscriptions.subscriptions[0]?.stripeSubscriptionId) {
      return sendError(res, 404, 'No active subscription found', ErrorCodes.RES_NOT_FOUND);
    }

    const subscription = userWithSubscriptions.subscriptions[0];

    // Cancel subscription in Stripe
    const canceledSubscription = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        cancel_at_period_end: !immediate,
        ...(immediate && { cancel_at: 'now' }),
      }
    );

    // Update subscription in database if immediate cancellation
    if (immediate) {
      await applySubscriptionUpdate({
        userId: user.id,
        orgId: user.orgId,
        data: {
          subscriptionStatus: 'CANCELLED',
          subscriptionPlan: 'FREE_TRIAL',
          trialEndDate: null,
        },
      });
    }

    return res.json({
      success: true,
      cancelAtPeriodEnd: canceledSubscription.cancel_at_period_end,
      cancelAt: canceledSubscription.cancel_at,
      currentPeriodEnd: canceledSubscription.current_period_end,
    });
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      return sendError(res, 503, err.message, ErrorCodes.EXT_STRIPE_NOT_CONFIGURED);
    }
    console.error('Stripe cancel error:', err);
    return sendError(res, 500, 'Failed to cancel subscription', ErrorCodes.EXT_STRIPE_ERROR);
  }
});

// Helper function to send payment failure notification
async function sendPaymentFailureNotification(userEmail, userName, invoiceUrl) {
  const subject = 'Payment Failed - Action Required';
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Failed</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f4f4f4;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 28px;
      font-weight: bold;
      color: #1976d2;
      margin-bottom: 10px;
    }
    h1 {
      color: #d32f2f;
      font-size: 24px;
      margin-bottom: 20px;
    }
    p {
      margin-bottom: 15px;
      color: #555;
    }
    .button {
      display: inline-block;
      padding: 14px 28px;
      background-color: #d32f2f;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 5px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
    }
    .button:hover {
      background-color: #b71c1c;
    }
    .button-container {
      text-align: center;
      margin: 30px 0;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      font-size: 12px;
      color: #999;
      text-align: center;
    }
    .warning {
      background-color: #ffebee;
      border-left: 4px solid #d32f2f;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Buildstate</div>
    </div>

    <h1>Payment Failed</h1>

    <p>Hi ${userName},</p>

    <p>We were unable to process your recent payment for your Buildstate subscription. This could be due to:</p>

    <ul>
      <li>Insufficient funds</li>
      <li>Expired credit card</li>
      <li>Payment method declined by your bank</li>
      <li>Incorrect billing information</li>
    </ul>

    <div class="warning">
      <strong>Action Required:</strong> Please update your payment method to avoid interruption to your service.
    </div>

    <p>Click the button below to update your payment information:</p>

    <div class="button-container">
      <a href="${invoiceUrl || process.env.FRONTEND_URL + '/subscriptions'}" class="button">Update Payment Method</a>
    </div>

    <p>If you have any questions or need assistance, please contact our support team.</p>

    <div class="footer">
      <p>This is an automated email from Buildstate. Please do not reply to this message.</p>
      <p>&copy; ${new Date().getFullYear()} Buildstate. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  try {
    await sendEmail(userEmail, subject, html);
    console.log(`Payment failure notification sent to ${userEmail}`);
  } catch (error) {
    console.error('Failed to send payment failure notification:', error);
  }
}

/**
 * Helper function to upsert Subscription record
 */
async function upsertSubscription({
  userId,
  orgId,
  stripeCustomerId,
  stripeSubscriptionId,
  status,
  plan,
  currentPeriodEnd,
  cancelledAt,
}) {
  if (!userId && !orgId) {
    console.warn('No userId or orgId provided for subscription upsert');
    return;
  }

  try {
    // Find the user(s) to update
    let userIds = [];
    if (userId) {
      userIds = [userId];
    } else if (orgId) {
      const orgUsers = await prisma.user.findMany({
        where: { orgId },
        select: { id: true },
      });
      userIds = orgUsers.map(u => u.id);
    }

    // For each user, upsert their subscription
    for (const uid of userIds) {
      const existingSubscription = await prisma.subscription.findFirst({
        where: {
          userId: uid,
          OR: [
            { stripeSubscriptionId },
            { stripeCustomerId },
            // If no Stripe IDs, find the most recent one
            ...(!stripeSubscriptionId && !stripeCustomerId ? [{ userId: uid }] : []),
          ],
        },
        orderBy: { createdAt: 'desc' },
      });

      const subscriptionData = {
        userId: uid,
        planId: plan || 'BASIC',
        planName: plan || 'BASIC',
        status: status || 'PENDING',
        ...(stripeCustomerId && { stripeCustomerId }),
        ...(stripeSubscriptionId && { stripeSubscriptionId }),
        ...(currentPeriodEnd && { stripeCurrentPeriodEnd: new Date(currentPeriodEnd * 1000) }),
        ...(cancelledAt && { cancelledAt: new Date(cancelledAt * 1000) }),
        ...(status === 'CANCELLED' && !cancelledAt && { cancelledAt: new Date() }),
      };

      if (existingSubscription) {
        // Update existing subscription
        await prisma.subscription.update({
          where: { id: existingSubscription.id },
          data: subscriptionData,
        });
        console.log(`Updated subscription ${existingSubscription.id} for user ${uid}`);
      } else if (stripeSubscriptionId || stripeCustomerId) {
        // Only create new subscription if we have Stripe IDs
        await prisma.subscription.create({
          data: subscriptionData,
        });
        console.log(`Created new subscription for user ${uid}`);
      }
    }
  } catch (error) {
    console.error('Error upserting subscription:', error);
    throw error;
  }
}

/**
 * Stripe Webhook (This must be exported to be used in index.js)
 */
export async function webhook(req, res) {
  // This is the console.log for debugging
  console.log('>>> INSIDE billing.js webhook handler <<<');

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    if (!stripeAvailable) {
      throw new StripeNotConfiguredError();
    }
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      console.error('Stripe webhook received but Stripe is not configured.');
      return sendError(res, 503, `Stripe Error: ${err.message}`, ErrorCodes.EXT_STRIPE_NOT_CONFIGURED);
    }
    console.error('❌ Webhook signature verify failed:', err.message);
    return sendError(res, 400, `Webhook Error: ${err.message}`, ErrorCodes.EXT_STRIPE_ERROR);
  }

  // ✅ IDEMPOTENCY CHECK: Prevent duplicate webhook processing
  try {
    const existingEvent = await prisma.stripeWebhookEvent.findUnique({
      where: { eventId: event.id },
    });

    if (existingEvent && existingEvent.processed) {
      console.log(`Webhook ${event.id} already processed, skipping`);
      return res.json({ received: true, status: 'duplicate' });
    }

    // Record webhook event (or update if exists but not processed)
    await prisma.stripeWebhookEvent.upsert({
      where: { eventId: event.id },
      create: {
        eventId: event.id,
        eventType: event.type,
        processed: false,
        data: event.data,
      },
      update: {
        eventType: event.type,
        data: event.data,
      },
    });
  } catch (error) {
    console.error('Error checking webhook idempotency:', error);
    // Continue processing - don't block on idempotency check failure
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        console.log('Processing checkout.session.completed');
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const orgId  = session.metadata?.orgId || session.client_reference_id;
        const subscriptionId = session.subscription;
        const customerId = session.customer;
        let subscription;

        if (session.mode === 'subscription' && subscriptionId) {
          try {
            subscription = await stripe.subscriptions.retrieve(subscriptionId, {
              expand: ['items.data.price'],
            });
          } catch (error) {
            console.warn('Failed to retrieve subscription for checkout.session.completed', error);
          }
        }

        const priceId = subscription?.items?.data?.[0]?.price?.id;
        const plan = resolvePlanFromPriceId(priceId, session.metadata?.plan || 'BASIC');
        const status = mapStripeStatusToAppStatus(subscription?.status, 'ACTIVE');

        // Update User model
        const update = {
          subscriptionStatus: status,
        };

        if (plan) {
          update.subscriptionPlan = plan;
        }

        if (status === 'ACTIVE') {
          update.trialEndDate = null;
        }

        await applySubscriptionUpdate({ userId, orgId, data: update });

        // Create/Update Subscription record
        if (subscription && customerId) {
          await upsertSubscription({
            userId,
            orgId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            status,
            plan,
            currentPeriodEnd: subscription.current_period_end,
          });
        }

        console.log(`Checkout completed: ${subscriptionId} for user ${userId || orgId}`);
        break;
      }
      case 'customer.subscription.updated': {
        console.log('Processing customer.subscription.updated');
        const subscription = event.data.object;
        const userId = subscription.metadata?.userId;
        const orgId = subscription.metadata?.orgId;
        const customerId = subscription.customer;
        const subscriptionId = subscription.id;
        const priceId = subscription.items?.data?.[0]?.price?.id;
        const plan = resolvePlanFromPriceId(priceId, subscription.metadata?.plan);
        const newStatus = mapStripeStatusToAppStatus(subscription.status);

        // Update User model
        const data = { subscriptionStatus: newStatus };
        if (plan) data.subscriptionPlan = plan;
        if (newStatus === 'ACTIVE') data.trialEndDate = null;

        await applySubscriptionUpdate({ userId, orgId, data });

        // Update Subscription record
        await upsertSubscription({
          userId,
          orgId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          status: newStatus,
          plan,
          currentPeriodEnd: subscription.current_period_end,
          cancelledAt: subscription.canceled_at,
        });

        console.log(`Subscription updated: ${subscriptionId}, status: ${newStatus}`);
        break;
      }
      case 'customer.subscription.deleted': {
        console.log('Processing customer.subscription.deleted');
        const subscription = event.data.object;
        const userId = subscription.metadata?.userId;
        const orgId = subscription.metadata?.orgId;
        const customerId = subscription.customer;
        const subscriptionId = subscription.id;

        // Update User model
        await applySubscriptionUpdate({
          userId,
          orgId,
          data: {
            subscriptionStatus: 'CANCELLED',
            subscriptionPlan: 'FREE_TRIAL',
            trialEndDate: null,
          },
        });

        // Update Subscription record
        await upsertSubscription({
          userId,
          orgId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          status: 'CANCELLED',
          plan: 'FREE_TRIAL',
          cancelledAt: subscription.canceled_at || Date.now() / 1000,
        });

        console.log(`Subscription deleted: ${subscriptionId}`);
        break;
      }
      case 'invoice.payment_failed': {
        console.log('Processing invoice.payment_failed');
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const subscriptionId = invoice.subscription;

        try {
          // Fetch customer details from Stripe
          const customer = await stripe.customers.retrieve(customerId);

          // Get user from database via Subscription record
          let dbUser = await prisma.user.findFirst({
            where: {
              subscriptions: {
                some: {
                  stripeCustomerId: customerId,
                },
              },
            },
          });

          // Fallback: try to find by stripeSubscriptionId
          if (!dbUser && subscriptionId) {
            dbUser = await prisma.user.findFirst({
              where: {
                subscriptions: {
                  some: {
                    stripeSubscriptionId: subscriptionId,
                  },
                },
              },
            });
          }

          if (dbUser && customer.email) {
            const userName = dbUser.firstName || 'Customer';
            const invoiceUrl = invoice.hosted_invoice_url;

            // Send payment failure notification
            await sendPaymentFailureNotification(customer.email, userName, invoiceUrl);

            // Update User model to SUSPENDED
            await applySubscriptionUpdate({
              userId: dbUser.id,
              orgId: dbUser.orgId,
              data: {
                subscriptionStatus: 'SUSPENDED',
              },
            });

            // Update Subscription record
            await upsertSubscription({
              userId: dbUser.id,
              orgId: dbUser.orgId,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              status: 'SUSPENDED',
            });

            console.log(`Payment failure processed for customer ${customerId}`);
          } else {
            console.warn(`Could not find user for customer ${customerId}`);
          }
        } catch (error) {
          console.error('Error handling payment failure:', error);
        }
        break;
      }
      case 'invoice.payment_succeeded': {
        console.log('Processing invoice.payment_succeeded');
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const subscriptionId = invoice.subscription;

        try {
          // Get user from database
          let dbUser = await prisma.user.findFirst({
            where: {
              subscriptions: {
                some: {
                  stripeCustomerId: customerId,
                },
              },
            },
          });

          // Fallback: try to find by stripeSubscriptionId
          if (!dbUser && subscriptionId) {
            dbUser = await prisma.user.findFirst({
              where: {
                subscriptions: {
                  some: {
                    stripeSubscriptionId: subscriptionId,
                  },
                },
              },
            });
          }

          if (dbUser && subscriptionId) {
            // Fetch subscription to get the current status
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const newStatus = mapStripeStatusToAppStatus(subscription.status);
            const priceId = subscription.items?.data?.[0]?.price?.id;
            const plan = resolvePlanFromPriceId(priceId, subscription.metadata?.plan);

            // Update User model (e.g., from SUSPENDED back to ACTIVE)
            const updateData = {
              subscriptionStatus: newStatus,
            };
            if (plan) updateData.subscriptionPlan = plan;
            if (newStatus === 'ACTIVE') updateData.trialEndDate = null;

            await applySubscriptionUpdate({
              userId: dbUser.id,
              orgId: dbUser.orgId,
              data: updateData,
            });

            // Update Subscription record
            await upsertSubscription({
              userId: dbUser.id,
              orgId: dbUser.orgId,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              status: newStatus,
              plan,
              currentPeriodEnd: subscription.current_period_end,
            });

            console.log(`Payment succeeded for customer ${customerId}, status updated to ${newStatus}`);
          }
        } catch (error) {
          console.error('Error handling payment success:', error);
        }
        break;
      }
      case 'customer.subscription.schedule.created': {
        console.log('Processing customer.subscription.schedule.created');
        const schedule = event.data.object;
        const customerId = schedule.customer;
        const subscriptionId = schedule.subscription;

        try {
          // Get user from database
          let dbUser = null;
          if (subscriptionId) {
            dbUser = await prisma.user.findFirst({
              where: {
                subscriptions: {
                  some: {
                    stripeSubscriptionId: subscriptionId,
                  },
                },
              },
            });
          }

          // Fallback: find by customer ID
          if (!dbUser && customerId) {
            dbUser = await prisma.user.findFirst({
              where: {
                subscriptions: {
                  some: {
                    stripeCustomerId: customerId,
                  },
                },
              },
            });
          }

          if (dbUser) {
            // Extract the upcoming phase details
            const phases = schedule.phases || [];
            const nextPhase = phases.find(p => p.start_date > Date.now() / 1000);

            if (nextPhase) {
              const priceId = nextPhase.items?.[0]?.price;
              const plan = priceId ? resolvePlanFromPriceId(priceId) : null;

              console.log(`Subscription schedule created for user ${dbUser.id}, next phase starts at ${new Date(nextPhase.start_date * 1000).toISOString()}`);

              // Log for future reference, but don't update the subscription yet
              // The actual changes will be applied when the schedule executes
              if (plan) {
                console.log(`Scheduled plan change to ${plan} on ${new Date(nextPhase.start_date * 1000).toISOString()}`);
              }
            }
          } else {
            console.warn(`Could not find user for subscription schedule with customer ${customerId}`);
          }
        } catch (error) {
          console.error('Error handling subscription schedule creation:', error);
        }
        break;
      }
      default:
        // console.log(`Unhandled event type ${event.type}`);
        break;
    }

    // ✅ Mark webhook as processed
    try {
      await prisma.stripeWebhookEvent.update({
        where: { eventId: event.id },
        data: {
          processed: true,
          processedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Error marking webhook as processed:', error);
      // Continue - don't block response
    }

    res.json({ received: true });
  } catch (err) {
    console.error('⚠️ Webhook handler error:', err);
    return sendError(res, 500, 'Webhook processing failed', ErrorCodes.EXT_STRIPE_ERROR);
  }
}

export default router;