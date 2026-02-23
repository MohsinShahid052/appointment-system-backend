# Brevo (Sendinblue) API Setup Instructions

## Environment Variables Required

Add these to your `.env` file or Railway environment variables:

```bash
# Required: Brevo API Key
# Get it from: https://app.brevo.com/settings/keys/api
BREVO_API_KEY=your_brevo_api_key_here
# OR use the old variable name (also supported)
# SENDINBLUE_API_KEY=your_brevo_api_key_here

# Required: From email address (must be verified in Brevo)
# This should be an email address you've verified in your Brevo account
EMAIL_FROM=noreply@yourdomain.com
# OR if using Brevo's test domain (for testing only)
# EMAIL_FROM=test@example.com

# Optional: From name (display name for emails)
EMAIL_FROM_NAME=Appointment System

# Required: Backend URL for email links (cancel buttons, password reset, etc.)
BACKEND_URL=https://your-backend-domain.railway.app
# OR use frontend URL
FRONTEND_URL=https://your-frontend-domain.com
```

## Quick Setup Steps

1. **Sign up at Brevo**: https://www.brevo.com (formerly Sendinblue)
2. **Get API Key**: 
   - Go to https://app.brevo.com/settings/keys/api
   - Click "Generate a new API key"
   - Give it a name (e.g., "Appointment System")
   - Copy the API key
3. **Verify Sender Email**:
   - Go to https://app.brevo.com/settings/senders/smtp
   - Add and verify your sender email address
   - This is required for sending emails
4. **Add to Railway**: Copy the environment variables above to Railway project settings
5. **Install dependencies**: Run `npm install` (this will install @getbrevo/brevo package)
6. **Deploy**: Push your code and deploy

## Features Preserved

✅ **All email features work exactly as before:**
- ✅ Confirmation emails with ICS calendar attachments
- ✅ Reminder emails (cron job)
- ✅ Cancellation emails
- ✅ Password reset emails
- ✅ Cancel buttons in emails (same functionality)
- ✅ All email templates unchanged

## ICS File Support

The system automatically attaches ICS calendar files to confirmation emails. Brevo fully supports this functionality.

## Cron Job Compatibility

The reminder cron job works perfectly with Brevo. No changes needed to the cron job setup.

## Testing

After setup, check Railway logs for:
- `Brevo Configuration: { apiKey: 'x***', from: '...' }`
- `✅ Email sent successfully! Message ID: ...`

Create a test appointment to verify:
1. Confirmation email is received
2. ICS file is attached (can be added to calendar)
3. Cancel button works correctly
4. Reminder email is sent via cron job

## Free Tier Limits

Brevo free tier includes:
- 300 emails/day
- Unlimited contacts
- Email support

## Support

- Brevo Docs: https://developers.brevo.com
- Brevo Dashboard: https://app.brevo.com
- API Keys: https://app.brevo.com/settings/keys/api
- Transactional Emails API: https://developers.brevo.com/reference/sendtransacemail
