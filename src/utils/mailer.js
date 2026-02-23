import { TransactionalEmailsApi, SendSmtpEmail } from "@getbrevo/brevo";
import dotenv from "dotenv";
dotenv.config();

const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || process.env.BREVO_FROM_EMAIL;
const FROM_NAME = process.env.EMAIL_FROM_NAME || "Appointment System";

// Log Brevo configuration (without sensitive data)
console.log('Brevo Configuration:', {
  apiKey: BREVO_API_KEY ? `${BREVO_API_KEY.substring(0, 7)}***` : 'NOT SET',
  from: FROM_EMAIL,
  fromName: FROM_NAME,
});

// Initialize Brevo client
if (!BREVO_API_KEY) {
  console.warn('⚠️ BREVO_API_KEY not configured - email functionality will not work');
}

let brevoApiInstance = null;
if (BREVO_API_KEY) {
  const apiInstance = new TransactionalEmailsApi();
  apiInstance.authentications.apiKey.apiKey = BREVO_API_KEY;
  brevoApiInstance = apiInstance;
}

/**
 * sendMail — Using Brevo (Sendinblue) API with attachments support
 * Maintains same interface as before for easy migration
 */
export const sendMail = async ({ to, subject, html, text, attachments }) => {
  // Validate Brevo configuration
  if (!BREVO_API_KEY || !brevoApiInstance) {
    const error = new Error('Brevo API key is missing. Please check BREVO_API_KEY environment variable.');
    console.error('❌ Brevo Configuration Error:', {
      BREVO_API_KEY: BREVO_API_KEY ? 'SET' : 'MISSING',
    });
    throw error;
  }

  if (!FROM_EMAIL) {
    const error = new Error('FROM email is missing. Please check EMAIL_FROM environment variable.');
    console.error('❌ Brevo Configuration Error: EMAIL_FROM not set');
    throw error;
  }

  console.log(`📧 Attempting to send email to: ${to}, Subject: ${subject}`);

  try {
    // Convert attachments format to Brevo format
    const brevoAttachments = attachments?.map(att => {
      // Brevo expects base64 content
      let content;
      
      if (Buffer.isBuffer(att.content)) {
        // If it's a Buffer (like ICS files), convert to base64
        content = att.content.toString('base64');
      } else if (typeof att.content === 'string') {
        // If it's already a string
        if (att.encoding === 'base64') {
          // Already base64 encoded
          content = att.content;
        } else {
          // Convert string to base64 using the specified encoding or default to utf-8
          const buffer = Buffer.from(att.content, att.encoding || 'utf-8');
          content = buffer.toString('base64');
        }
      } else {
        // If it's an object or other type, convert to string then base64
        content = Buffer.from(String(att.content), 'utf-8').toString('base64');
      }

      return {
        name: att.filename || 'attachment',
        content: content,
      };
    }) || [];

    // Prepare email data for Brevo
    const sendSmtpEmail = new SendSmtpEmail();
    
    // Set sender
    sendSmtpEmail.sender = {
      name: FROM_NAME,
      email: FROM_EMAIL,
    };

    // Set recipients (Brevo expects array of objects)
    const recipients = Array.isArray(to) ? to : [to];
    sendSmtpEmail.to = recipients.map(email => ({ email }));

    // Set subject and content
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = html;
    if (text) {
      sendSmtpEmail.textContent = text;
    }

    // Set attachments if any
    if (brevoAttachments.length > 0) {
      sendSmtpEmail.attachment = brevoAttachments;
    }

    console.log(`📧 Sending email via Brevo...`);
    const response = await brevoApiInstance.sendTransacEmail(sendSmtpEmail);

    // Brevo v3 returns response.body with messageId
    const messageId = response.body?.messageId || response.messageId || 'unknown';
    console.log(`✅ Email sent successfully! Message ID: ${messageId}`);
    return {
      messageId: messageId,
      response: `Email sent via Brevo: ${messageId}`,
    };
  } catch (error) {
    console.error(`❌ Failed to send email via Brevo:`, {
      message: error.message,
      name: error.name,
      response: error.response?.body,
      stack: error.stack,
    });
    throw error;
  }
};

// Email templates remain exactly the same
export const templates = {
  confirmation: ({ clientName, shopName, serviceName, startLocal, endLocal, appointmentId }) => {
    // Use your backend API URL directly
    const backendUrl = process.env.BACKEND_URL || process.env.FRONTEND_URL || 'https://your-backend-domain.com';
    const cancelUrl = `${backendUrl}/public/${appointmentId}/cancel`;
    
    return {
      subject: `Booking confirmed — ${shopName}`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Hi ${clientName},</p>
        <p>Your appointment for <strong>${serviceName}</strong> at <strong>${shopName}</strong> is confirmed.</p>
        <p><strong>When:</strong> ${startLocal} — ${endLocal}</p>
        <p><strong>Reference:</strong> ${appointmentId}</p>
        
        <div style="margin: 25px 0; padding: 15px; background: #f8f9fa; border-radius: 8px;">
          <p style="margin: 0 0 15px 0;">Need to cancel?</p>
          <a href="${cancelUrl}" 
             style="display: inline-block; padding: 12px 24px; background: #dc3545; color: white; 
                    text-decoration: none; border-radius: 6px; font-weight: bold;">
            Cancel Appointment
          </a>
          <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">
            Click the button above to cancel your appointment anytime.
          </p>
        </div>

        <p>We look forward to seeing you!</p>
        <p>Thanks,<br/><strong>${shopName}</strong></p>
        
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #666;">
          If you did not book this appointment, please ignore this email or contact us.
        </p>
      </div>`
    };
  },

  reminder: ({ clientName, shopName, serviceName, startLocal, endLocal, appointmentId }) => {
    // Use your backend API URL directly
    const backendUrl = process.env.BACKEND_URL || process.env.FRONTEND_URL || 'https://your-backend-domain.com';
    const cancelUrl = `${backendUrl}/public/${appointmentId}/cancel`;
    
    return {
      subject: `Reminder: your appointment at ${shopName} in 24 hours`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Hi ${clientName},</p>
        <p>This is a reminder for your appointment for <strong>${serviceName}</strong> at <strong>${shopName}</strong>.</p>
        <p><strong>When:</strong> ${startLocal} — ${endLocal}</p>
        <p><strong>Reference:</strong> ${appointmentId}</p>
        
        <div style="margin: 25px 0; padding: 15px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px;">
          <p style="margin: 0 0 15px 0; color: #856404;">Need to cancel?</p>
          <a href="${cancelUrl}" 
             style="display: inline-block; padding: 10px 20px; background: #dc3545; color: white; 
                    text-decoration: none; border-radius: 6px; font-weight: bold;">
            Cancel Appointment
          </a>
          <p style="margin: 10px 0 0 0; font-size: 12px; color: #856404;">
            You can cancel your appointment anytime by clicking the button above.
          </p>
        </div>

        <p>We look forward to seeing you!</p>
        <p>Thanks,<br/><strong>${shopName}</strong></p>
      </div>`
    };
  },

  // Add cancellation confirmation template
  cancellation: ({ clientName, shopName, serviceName, startLocal }) => {
    return {
      subject: `Appointment cancelled — ${shopName}`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Hi ${clientName},</p>
        <p>Your appointment for <strong>${serviceName}</strong> scheduled for <strong>${startLocal}</strong> has been cancelled.</p>
        <p>If this was a mistake or you'd like to reschedule, please contact us.</p>
        <p>Thanks,<br/><strong>${shopName}</strong></p>
      </div>`
    };
  },

  // Password reset template
  passwordReset: ({ resetUrl, email }) => {
    return {
      subject: 'Password Reset Request',
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <p>Hello,</p>
        <p>You requested to reset your password for the account associated with <strong>${email}</strong>.</p>
        <p>Click the button below to reset your password. This link will expire in 1 hour.</p>
        
        <div style="margin: 25px 0; text-align: center;">
          <a href="${resetUrl}" 
             style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; 
                    text-decoration: none; border-radius: 6px; font-weight: bold;">
            Reset Password
          </a>
        </div>
        
        <p style="font-size: 12px; color: #666;">
          If you did not request this password reset, please ignore this email. Your password will remain unchanged.
        </p>
        <p style="font-size: 12px; color: #666;">
          If the button doesn't work, copy and paste this link into your browser:<br/>
          <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
        </p>
      </div>`
    };
  }
};
