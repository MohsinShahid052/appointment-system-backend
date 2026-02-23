# Resend API Setup Instructions

## Environment Variables Required

Add these to your `.env` file or Railway environment variables:

```bash
# Required: Resend API Key
# Get it from: https://resend.com/api-keys
RESEND_API_KEY=re_your_api_key_here

# Required: From email address
# Option 1: Use your verified domain email
EMAIL_FROM=noreply@yourdomain.com

# Option 2: Use Resend's default domain (for testing - no verification needed)
EMAIL_FROM=onboarding@resend.dev

# Required: Backend URL for email links (cancel buttons, password reset, etc.)
BACKEND_URL=https://your-backend-domain.railway.app
# OR
FRONTEND_URL=https://your-frontend-domain.com
```

## Quick Setup Steps

1. **Sign up at Resend**: https://resend.com
2. **Get API Key**: https://resend.com/api-keys → Create API Key
3. **Verify Domain** (optional): https://resend.com/domains
   - Or use `onboarding@resend.dev` for testing
4. **Add to Railway**: Copy the environment variables above to Railway project settings
5. **Install dependencies**: `npm install` (resend package is already in package.json)
6. **Deploy**: Push your code and deploy

## What's Changed

- ✅ Replaced nodemailer with Resend API
- ✅ All email features preserved (ICS files, cancel buttons, templates)
- ✅ Cron job for reminders still works
- ✅ No SMTP connection issues
- ✅ Faster and more reliable

## Testing

After setup, check Railway logs for:
- `Resend Configuration: { apiKey: 're_***', from: '...' }`
- `✅ Email sent successfully! Message ID: ...`

Create a test appointment to verify everything works!
