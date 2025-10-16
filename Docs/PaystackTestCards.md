# Paystack Test Cards

Use these test cards in **Sandbox mode** to test different payment scenarios:

## Successful Payments

### Visa Success
- **Card Number**: `4084 0840 8408 4081`
- **Expiry**: Any future date (e.g., 12/26)
- **CVV**: Any 3 digits (e.g., 408)
- **OTP**: `123456`

### Mastercard Success
- **Card Number**: `5060 6666 6666 6666 666`
- **Expiry**: Any future date
- **CVV**: Any 3 digits
- **OTP**: `123456`

### Verve Success
- **Card Number**: `5061 0201 0000 0000 19`
- **Expiry**: Any future date
- **CVV**: Any 3 digits
- **OTP**: `123456`

## Failed/Test Scenarios

### Insufficient Funds
- **Card Number**: `5060 0000 0000 0000 04`
- **Expiry**: Any future date
- **CVV**: Any 3 digits
- **OTP**: `123456`
- **Result**: Transaction will be declined

### Do Not Honor
- **Card Number**: `5060 0000 0000 0000 95`
- **Expiry**: Any future date
- **CVV**: Any 3 digits
- **OTP**: `123456`
- **Result**: Bank declines transaction

## Testing Flow

1. Navigate to `/pricing` in your app
2. Click "Subscribe" on any paid plan
3. You'll be redirected to Paystack payment page
4. Use one of the test cards above
5. Complete the payment flow
6. Webhook will process the payment and update subscription
7. Verify in app that subscription is active

## Switching to Live Mode

When ready to accept real payments:

1. Get your **Live Secret Key** from Paystack Dashboard
2. Update `PAYSTACK_SECRET_KEY` secret in Supabase to use live key
3. Update `PAYSTACK_PUBLIC_KEY` secret to use live public key
4. Update webhook URL in Super Admin Settings to use live endpoint
5. Configure live webhook in Paystack Dashboard → Settings → Webhooks

## Webhook Configuration

### Sandbox URL
```
https://diclwatocrixibjpajuf.supabase.co/functions/v1/subscriptions/paystack/webhook
```

### Events to Subscribe
- `charge.success` - When payment succeeds

### Webhook Security
- Webhook endpoint verifies signature using HMAC SHA-512
- Only processes events with valid signatures
- Automatically updates user subscriptions on successful charge

## Monitoring

Check webhook logs in:
- Paystack Dashboard → Developers → Event Logs
- Supabase Dashboard → Edge Functions → subscriptions → Logs
