# Email Setup for Railway Production - Using Resend API

## ✅ Solution: Resend API (Implemented)

The system now uses Resend API instead of SMTP, which works perfectly with Railway and doesn't have connection timeout issues.

## Setup Instructions

### Step 1: Sign up for Resend
1. Go to https://resend.com
2. Sign up for a free account (100 emails/day free)
3. Verify your email address

### Step 2: Get Your API Key
1. Go to https://resend.com/api-keys
2. Click "Create API Key"
3. Give it a name (e.g., "Appointment System")
4. Copy the API key (starts with `re_`)

### Step 3: Verify Your Domain (Optional but Recommended)
1. Go to https://resend.com/domains
2. Add your domain
3. Add the DNS records provided by Resend
4. Wait for verification (usually takes a few minutes)

**OR** use Resend's default domain for testing:
- Use `onboarding@resend.dev` as your FROM email (no verification needed)

### Step 4: Set Environment Variables in Railway

Add these to your Railway project environment variables:

```bash
# Required: Resend API Key
RESEND_API_KEY=re_your_api_key_here

# Required: From email address
# Option 1: Use your verified domain
EMAIL_FROM=noreply@yourdomain.com

# Option 2: Use Resend's default domain (for testing)
EMAIL_FROM=onboarding@resend.dev

# Required: Backend URL for email links (cancel buttons, etc.)
BACKEND_URL=https://your-backend-domain.railway.app
# OR use frontend URL
FRONTEND_URL=https://your-frontend-domain.com
```

### Step 5: Install Dependencies

The package.json has been updated. Run:
```bash
npm install
```

This will install the `resend` package.

## Features Preserved

✅ **All email features work exactly as before:**
- ✅ Confirmation emails with ICS calendar attachments
- ✅ Reminder emails (cron job)
- ✅ Cancellation emails
- ✅ Password reset emails
- ✅ Cancel buttons in emails
- ✅ All email templates unchanged

## Testing

After setting up:
1. Deploy to Railway
2. Check Railway logs for:
   - `✅ Resend Configuration: { apiKey: 're_***', from: '...' }`
   - `✅ Email sent successfully! Message ID: ...`
3. Create a test appointment to verify emails are sent

## Benefits of Resend

- ✅ **No connection timeouts** - Uses HTTP API instead of SMTP
- ✅ **Fast delivery** - Optimized for cloud platforms
- ✅ **Better reliability** - Built for modern applications
- ✅ **Easy setup** - Just an API key, no SMTP configuration
- ✅ **Free tier** - 100 emails/day free
- ✅ **Great for Railway** - Works perfectly with Railway's network

## Troubleshooting

### Emails not sending?
1. Check `RESEND_API_KEY` is set correctly
2. Check `EMAIL_FROM` is verified in Resend
3. Check Railway logs for error messages
4. Verify your API key is active in Resend dashboard

### Domain not verified?
- Use `onboarding@resend.dev` for testing
- Or verify your domain in Resend dashboard

### Need more emails?
- Resend free tier: 100 emails/day
- Upgrade plan: https://resend.com/pricing
