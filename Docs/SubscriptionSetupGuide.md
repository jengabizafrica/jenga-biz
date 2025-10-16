# Subscription System Setup Guide

## Overview
This guide covers the complete B2C subscription system with multi-billing cycles, custom email confirmation, and organization approval flows.

## Features Implemented

### 1. Subscription Tiers
- **Free**: 14-day full access trial, then limited features
  - 1 strategy project
  - Up to 20 milestones (concept + early stage)
  - 100 receipts/month with OCR
  - Unlimited lite AI summaries
  - 5 downloads/month

- **Essential**: $5/month (or $13/quarter, $48/year)
  - All templates + start from scratch
  - 1 project
  - Up to 20 milestones with AI suggestions
  - 100 receipts/month with OCR + categorization
  - Unlimited lite summaries
  - Unlimited sharing, 5 downloads/month

- **Pro**: $12/month (or $33/quarter, $120/year)
  - Multiple strategy projects
  - Unlimited milestones with AI suggestions
  - Unlimited receipts with OCR + auto-categorization
  - Unlimited advanced AI summaries
  - Unlimited sharing and downloads

### 2. Auto-Assignment
- Free tier is automatically assigned to all new users on registration
- 14-day trial period with full access

### 3. Subscription Gating
- Features are gated based on subscription tier
- Gating logic in `useSubscriptionStatus` hook
- Use `<SubscriptionGate>`, `<EssentialFeature>`, or `<ProFeature>` components

### 4. Maintenance Mode
- Super admins can enable maintenance mode in Settings tab
- When enabled, all subscription gating is bypassed
- Useful for maintenance, testing, or special promotions

### 5. Multi-Currency Support
- Configurable allowed currencies in app settings
- Default: USD, KES, EUR, GBP
- Users can switch between allowed currencies
- Use `<CurrencySelector>` component or `useCurrencies()` hook

### 6. Custom Email Confirmation
- Uses Brevo SMTP instead of default Supabase emails
- Implements PKCE flow with `token_hash` for security
- Custom confirmation endpoint at `/confirm-email`
- Email template branded with Jenga Biz colors

### 7. Organization Approval Flow
- Organization accounts require super admin approval
- Pending organizations cannot interact with the system
- `<ApprovalBlocker>` component enforces this
- Auto-approve can be toggled in Settings

## Configuration Steps

### Step 1: Configure Supabase Auth Hook (Email Sending)

1. Go to Supabase Dashboard → Authentication → Hooks
2. Select "Send Email" hook
3. Choose "HTTP" as the hook type
4. Set the endpoint URL:
   ```
   https://diclwatocrixibjpajuf.supabase.co/functions/v1/send-signup-confirmation
   ```
5. Click "Save"

This routes all signup emails through your custom Brevo SMTP function.

### Step 2: Configure Paystack Webhook

1. Go to Paystack Dashboard → Settings → Webhooks
2. Add webhook URL (found in Super Admin → Settings tab):
   ```
   https://diclwatocrixibjpajuf.supabase.co/functions/v1/subscriptions/paystack/webhook
   ```
3. Select events to monitor: `charge.success`
4. Save and test the webhook

**Switching from Sandbox to Live:**
- Update the webhook URL in Super Admin → Settings → Paystack Webhook URL
- Update `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` secrets in Supabase
- Copy and configure the new webhook URL in Paystack live dashboard

### Step 3: Create Subscription Plans

1. Log in as super admin
2. Navigate to Super Admin Dashboard → Subscription Plans tab
3. Create plans for each tier and billing cycle:

**Free Plan** (already created by migration):
- Name: Free
- Price: 0 USD
- Billing Cycle: monthly
- Features: (pre-configured)

**Essential Plans**:
- Essential Monthly: $5/month
- Essential Quarterly: $13/quarter ($4.33/month)
- Essential Yearly: $48/year ($4/month)

**Pro Plans**:
- Pro Monthly: $12/month
- Pro Quarterly: $33/quarter ($11/month)
- Pro Yearly: $120/year ($10/month)

### Step 4: Configure System Settings

Navigate to Super Admin Dashboard → Settings tab to configure:

1. **Auto-approve Organizations**: Toggle to enable/disable automatic approval
2. **Maintenance Mode**: Toggle to bypass subscription gating
3. **Allowed Currencies**: Add/remove currency codes (comma-separated)
4. **Paystack Webhook URL**: View and update webhook URL

## Testing

### Test User Registration
1. Register a new business account
2. Check that free tier is automatically assigned
3. Confirm email via Brevo email
4. Verify 14-day trial is active

### Test Organization Registration
1. Register as organization
2. Verify pending approval is created
3. Confirm blocked from dashboard access
4. Super admin approves from Approvals tab
5. Verify access is granted after approval

### Test Subscription Upgrade
1. Navigate to /pricing
2. Select Essential or Pro plan
3. Complete Paystack payment (use test cards in sandbox)
4. Verify webhook updates subscription
5. Confirm feature access is granted

### Test Maintenance Mode
1. Enable maintenance mode in Settings
2. Verify all features are accessible regardless of subscription
3. Disable maintenance mode
4. Verify gating is restored

## API Endpoints

### Subscriptions API
- `GET /subscriptions/plans` - List active plans
- `POST /subscriptions/plans` - Create plan (super admin)
- `PATCH /subscriptions/plans?id={id}` - Update plan (super admin)
- `DELETE /subscriptions/plans?id={id}` - Deactivate plan (super admin)
- `GET /subscriptions/me` - Get user's active subscription
- `POST /subscriptions/paystack/initiate` - Initiate Paystack payment
- `POST /subscriptions/paystack/webhook` - Paystack webhook handler

### Email Confirmation
- `GET /confirm-email?token_hash={hash}&type=signup` - Verify email and return session

## Database Functions

- `assign_free_tier_on_signup()` - Trigger to auto-assign free tier
- `is_org_approved(uuid)` - Check if organization is approved
- `user_can_interact()` - Check if user can interact with system
- `set_system_setting(text, text, text)` - Update app settings (super admin only)

## Frontend Components

- `<SubscriptionGate>` - Gate content by subscription tier
- `<EssentialFeature>` - Shorthand for essential tier gating
- `<ProFeature>` - Shorthand for pro tier gating
- `<ApprovalBlocker>` - Block org users pending approval
- `<CurrencySelector>` - Multi-currency dropdown

## Hooks

- `useSubscriptionStatus()` - Get subscription status and feature access
- `useMaintenanceMode()` - Check maintenance mode status
- `useCurrencies()` - Get allowed currencies and handle selection
- `useAppSettings()` - Manage all app settings (super admin)

## Notes

- Free tier provides 14 days of full access as trial period
- After trial, users are prompted to upgrade for premium features
- Maintenance mode is useful for testing without payment
- Organization accounts are blocked until approved by super admin
- All subscription changes are audited in `settings_audit` table
