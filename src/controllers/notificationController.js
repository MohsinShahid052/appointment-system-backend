import Appointment from "../models/Appointment.js";
import Barbershop from "../models/Barbershop.js";
import Client from "../models/Client.js";
import Notification from "../models/Notification.js";
import { sendMail, templates } from "../utils/mailer.js";
import { decrypt } from "../utils/crypto.js";
import { DateTime } from "luxon";
import { createICS } from "../utils/icsGenerator.js";

// ------------------------------------------------------
//  SEND CONFIRMATION EMAIL (WITH ICS)
// ------------------------------------------------------
export const sendConfirmation = async (req, res, next) => {
  try {
    const { appointmentId } = req.body;
    if (!appointmentId)
      return res.status(400).json({ message: "appointmentId required" });

    // Optimized query with selective population
    const appt = await Appointment.findById(appointmentId)
      .populate("clientId", "encryptedEmail encryptedName name")
      .populate("serviceId", "name")
      .populate("employeeId", "name email")
      .lean();

    if (!appt)
      return res.status(404).json({ message: "Appointment not found" });

    const shop = await Barbershop.findById(appt.barbershopId).lean();
    const timezone = shop?.timezone || "Europe/Amsterdam";

    const client = appt.clientId;
    if (!client)
      return res.status(400).json({ message: "Client missing" });

    // Decrypt email
    const clientEmail = client.encryptedEmail
      ? decrypt(client.encryptedEmail)
      : null;

    if (!clientEmail)
      return res.status(400).json({ message: "Client has no email" });

    const startLocal = DateTime.fromJSDate(appt.startTime)
      .setZone(timezone)
      .toLocaleString(DateTime.DATETIME_FULL);

    const endLocal = DateTime.fromJSDate(appt.endTime)
      .setZone(timezone)
      .toLocaleString(DateTime.DATETIME_FULL);

    const data = {
      clientName: client.name || "Customer",
      shopName: shop.name || "Barbershop",
      serviceName: appt.serviceId?.name || "Service",
      startLocal,
      endLocal,
      appointmentId: appt._id.toString(),
    };

    const mail = templates.confirmation(data);

    // ------------------------------
    //  CREATE ICS FILE
    // ------------------------------
    const startUTC = DateTime.fromJSDate(appt.startTime).toUTC().toJSDate();
    const endUTC = DateTime.fromJSDate(appt.endTime).toUTC().toJSDate();

    const { filename: icsFilename, content: icsContent } = createICS({
      uid: appt._id.toString(),
      title: `${shop?.name || "Barbershop"} — ${appt.serviceId?.name || "Appointment"}`,
      description: `Appointment for ${data.clientName}`,
      location: shop?.address || "",
      startUTC,
      endUTC,
      organizerEmail: shop?.email || undefined,
      attendees: [{ name: data.clientName, email: clientEmail }],
    });

    // ------------------------------
    //  SAVE NOTIFICATION LOG
    // ------------------------------
    const log = await Notification.create({
      barbershopId: appt.barbershopId,
      appointmentId: appt._id,
      clientId: client._id,
      type: "confirmation",
      channel: "email",
      status: "pending",
      payload: { to: clientEmail, subject: mail.subject },
    });

    // ------------------------------
    //  SEND EMAIL WITH ICS (Non-blocking)
    // ------------------------------
    // Send email asynchronously without blocking the response
    sendMail({
      to: clientEmail,
      subject: mail.subject,
      html: mail.html,
      attachments: [
        {
          filename: icsFilename,
          content: icsContent,
          contentType: "text/calendar; charset=utf-8; method=REQUEST",
          contentDisposition: "attachment",
          encoding: "utf-8",
        },
      ],
    })
      .then(async (info) => {
        // Update notification status on success
        await Notification.findByIdAndUpdate(log._id, {
          status: "sent",
          sentAt: new Date(),
          payload: { ...log.payload, messageId: info.messageId },
        });
        console.log(`✅ Confirmation email sent successfully:`, {
          messageId: info.messageId,
          response: info.response,
          to: clientEmail,
        });
      })
      .catch(async (err) => {
        // Update notification status on failure
        await Notification.findByIdAndUpdate(log._id, {
          status: "failed",
          error: err.message,
          errorCode: err.code,
          errorResponse: err.response,
          failedAt: new Date(),
        });
        console.error(`❌ Failed to send confirmation email:`, {
          message: err.message,
          code: err.code,
          command: err.command,
          response: err.response,
          responseCode: err.responseCode,
          stack: err.stack,
          to: clientEmail,
        });
      });

    // Return immediately without waiting for email
    return res.json({ 
      message: "Appointment confirmed. Confirmation email is being sent.",
      appointmentId: appt._id
    });
  } catch (err) {
    next(err);
  }
};

// ------------------------------------------------------
//  SEND REMINDERS (NO ICS)
// ------------------------------------------------------
export const scanAndSendReminders = async (req, res, next) => {
  try {
    const nowUTC = DateTime.utc();

    // Appointments starting 23–25 hours from now
    const lower = nowUTC.plus({ hours: 23 }).toJSDate();
    const upper = nowUTC.plus({ hours: 25 }).toJSDate();

    // Optimized query with lean() and selective population
    const appts = await Appointment.find({
      status: "scheduled",
      startTime: { $gte: lower, $lte: upper },
    })
      .populate("clientId", "encryptedEmail encryptedName")
      .populate("serviceId", "name")
      .lean();

    const results = [];

    for (const appt of appts) {
      try {
        const shop = await Barbershop.findById(appt.barbershopId).lean();
        const timezone = shop?.timezone || "Europe/Amsterdam";

        const client = appt.clientId;
        if (!client) {
          results.push({ appointmentId: appt._id, ok: false, reason: "no client" });
          continue;
        }

        const clientEmail = client.encryptedEmail
          ? decrypt(client.encryptedEmail)
          : null;

        if (!clientEmail) {
          results.push({ appointmentId: appt._id, ok: false, reason: "no email" });
          continue;
        }

        const startLocal = DateTime.fromJSDate(appt.startTime)
          .setZone(timezone)
          .toLocaleString(DateTime.DATETIME_MED_WITH_WEEKDAY);

        const endLocal = DateTime.fromJSDate(appt.endTime)
          .setZone(timezone)
          .toLocaleString(DateTime.DATETIME_MED_WITH_WEEKDAY);

        const mail = templates.reminder({
          clientName: client.name || "Customer",
          shopName: shop.name || "Barbershop",
          serviceName: appt.serviceId?.name || "Service",
          startLocal,
          endLocal,
          appointmentId: appt._id.toString(),
        });

        const log = await Notification.create({
          barbershopId: appt.barbershopId,
          appointmentId: appt._id,
          clientId: client._id,
          type: "reminder",
          channel: "email",
          status: "pending",
          payload: { to: clientEmail, subject: mail.subject },
        });

        try {
          await sendMail({
            to: clientEmail,
            subject: mail.subject,
            html: mail.html,
          });

          await Notification.findByIdAndUpdate(log._id, {
            status: "sent",
            sentAt: new Date(),
          });

          results.push({ appointmentId: appt._id, ok: true });
        } catch (err) {
          await Notification.findByIdAndUpdate(log._id, {
            status: "failed",
            error: err.message,
          });

          results.push({
            appointmentId: appt._id,
            ok: false,
            error: err.message,
          });
        }
      } catch (err) {
        results.push({ appointmentId: appt._id, ok: false, error: err.message });
      }
    }

    return res.json({ count: results.length, results });
  } catch (err) {
    next(err);
  }
};

// ------------------------------------------------------
//  GET LOGS
// ------------------------------------------------------
export const getLogs = async (req, res, next) => {
  try {
    const { appointmentId, clientId } = req.query;
    const barbershopId = req.barbershopId;

    const query = { barbershopId };
    if (appointmentId) query.appointmentId = appointmentId;
    if (clientId) query.clientId = clientId;

    const logs = await Notification.find(query)
      .sort({ createdAt: -1 })
      .lean();

    res.json(logs);
  } catch (err) {
    next(err);
  }
};
