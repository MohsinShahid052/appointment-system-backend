import Appointment from "../models/Appointment.js";
import Service from "../models/Service.js";
import Client from "../models/Client.js";
import Barbershop from "../models/Barbershop.js";
import { generateSlots } from "../utils/slotGenerator.js";
import { DateTime } from "luxon";
import { decrypt } from "../utils/crypto.js";
import { sendMail, templates } from "../utils/mailer.js";
// GET AVAILABLE SLOTS (unchanged signature)
export const getAvailableSlots = async (req, res, next) => {
  try {
    const { employeeId, serviceId, date } = req.query;
    const barbershopId = req.barbershopId;

    if (!employeeId || !serviceId || !date)
      return res.status(400).json({ message: "employeeId, serviceId and date are required" });

    const service = await Service.findOne({ _id: serviceId, barbershopId });
    if (!service) return res.status(404).json({ message: "Service not found" });

    const slots = await generateSlots({
      barbershopId,
      employeeId,
      date,
      serviceDuration: service.duration,
    });

    return res.json({ slots });
  } catch (err) {
    next(err);
  }
};

// CREATE APPOINTMENT (FIXED + RETURNS POPULATED DATA)
export const createAppointment = async (req, res, next) => {
  try {
    const barbershopId = req.barbershopId;
    const { clientId, employeeId, serviceId, date, startTime, notes, clientData } = req.body;

    // Must have either existing client OR new client data
    if (!clientId && !clientData) {
      return res.status(400).json({ message: "Either clientId or clientData is required" });
    }

    const service = await Service.findOne({ _id: serviceId, barbershopId });
    if (!service) return res.status(404).json({ message: "Service not found" });

    // Load barbershop timezone
    const shop = await Barbershop.findById(barbershopId).lean();
    const timezone = shop?.timezone || "Europe/Amsterdam";

    const serviceDuration = service.duration;

    // Convert local date+time into UTC Date
    const startLocal = DateTime.fromISO(`${date}T${startTime}`, { zone: timezone }).set({
      second: 0,
      millisecond: 0,
    });

    if (!startLocal.isValid) {
      return res.status(400).json({ message: "Invalid date/startTime" });
    }

    const startUTC = startLocal.toUTC();
    const endUTC = startUTC.plus({ minutes: serviceDuration });

    // Validate slot availability
    const slots = await generateSlots({
      barbershopId,
      employeeId,
      date,
      serviceDuration,
    });

    const isValid = slots.some(s => s.startUTC === startUTC.toISO());

    if (!isValid) {
      return res.status(409).json({ message: "Slot is no longer available" });
    }

    // Create or select client
    let finalClientId = clientId;

    if (clientData && !clientId) {
      const newClient = await Client.create({
        barbershopId,
        encryptedName: clientData.name,
        encryptedPhone: clientData.phone,
        encryptedEmail: clientData.email,
        isDeleted: false,
      });

      finalClientId = newClient._id;
    }

    // Validate client exists
    const client = await Client.findOne({
      _id: finalClientId,
      barbershopId,
      isDeleted: false,
    });

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    // Create appointment
    const appt = await Appointment.create({
      barbershopId,
      clientId: finalClientId,
      employeeId,
      serviceId,
      startTime: startUTC.toJSDate(),
      endTime: endUTC.toJSDate(),
      notes,
      status: "scheduled",
    });

    // Populate full appointment object
    const populated = await Appointment.findById(appt._id)
      .populate("serviceId")
      .populate("employeeId")
      .populate("clientId");

    // Build final response
    return res.status(201).json({
      _id: populated._id,
      status: populated.status,

      startLocal: DateTime.fromJSDate(populated.startTime).setZone(timezone).toISO(),
      endLocal: DateTime.fromJSDate(populated.endTime).setZone(timezone).toISO(),

      service: populated.serviceId
        ? {
            _id: populated.serviceId._id,
            name: populated.serviceId.name,
            duration: populated.serviceId.duration,
            price: populated.serviceId.price,
          }
        : null,

      employee: populated.employeeId
        ? {
            _id: populated.employeeId._id,
            name: populated.employeeId.name,
            email: populated.employeeId.email,
          }
        : null,

      client: populated.clientId
        ? {
            _id: populated.clientId._id,
            name: decrypt(populated.clientId.encryptedName),
            phone: decrypt(populated.clientId.encryptedPhone),
            email: populated.clientId.encryptedEmail
              ? decrypt(populated.clientId.encryptedEmail)
              : null,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
};

// LIST APPOINTMENTS (date is shop-local; we convert to UTC range)
export const listAppointments = async (req, res, next) => {
  try {
    const barbershopId = req.barbershopId;
    const { date, employeeId, clientId } = req.query;

    // get shop timezone
    const shop = await Barbershop.findById(barbershopId).lean();
    const timezone = (shop && shop.timezone) ? shop.timezone : "Europe/Amsterdam";

    const query = { barbershopId };
    if (employeeId) query.employeeId = employeeId;
    if (clientId) query.clientId = clientId;

    if (date) {
      const dayStartUTC = DateTime.fromISO(date, { zone: timezone }).startOf("day").toUTC().toJSDate();
      const dayEndUTC = DateTime.fromISO(date, { zone: timezone }).endOf("day").toUTC().toJSDate();
      query.startTime = { $lte: dayEndUTC };
      query.endTime = { $gte: dayStartUTC };
    }

    // Optimized query with lean() for better performance
    const appointments = await Appointment.find(query)
      .populate("employeeId", "name email photo")
      .populate("serviceId", "name duration price")
      .populate("clientId", "encryptedName encryptedPhone encryptedEmail")
      .lean();

   const sanitized = appointments.map(a => {
  const startLocal = DateTime.fromJSDate(a.startTime).setZone(timezone).toISO();
  const endLocal = DateTime.fromJSDate(a.endTime).setZone(timezone).toISO();

  return {
    _id: a._id,
    status: a.status,
    startTime: a.startTime,
    endTime: a.endTime,
    startLocal,
    endLocal,
    notes: a.notes,

    // ⬇️ FIXED — return full service object
    service: a.serviceId
      ? {
          _id: a.serviceId._id,
          name: a.serviceId.name,
          duration: a.serviceId.duration,
          price: a.serviceId.price,
        }
      : null,

    // ⬇️ FIXED — return full employee object
    employee: a.employeeId
      ? {
          _id: a.employeeId._id,
          name: a.employeeId.name,
        }
      : null,

    client: a.clientId
      ? {
          _id: a.clientId._id,
          name: decrypt(a.clientId.encryptedName),
          phone: decrypt(a.clientId.encryptedPhone),
          email: a.clientId.encryptedEmail
            ? decrypt(a.clientId.encryptedEmail)
            : null,
        }
      : null,
  };
});

    return res.json(sanitized);
  } catch (err) {
    next(err);
  }
};

// GET BY ID (FIXED - returns correct nested objects)
export const getAppointmentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const barbershopId = req.barbershopId;

    const appt = await Appointment.findOne({ _id: id, barbershopId })
      .populate("employeeId")
      .populate("serviceId")
      .populate("clientId");

    if (!appt) return res.status(404).json({ message: "Not found" });

    const shop = await Barbershop.findById(barbershopId).lean();
    const timezone = shop?.timezone || "Europe/Amsterdam";

    return res.json({
      _id: appt._id,
      status: appt.status,

      startTime: appt.startTime,
      endTime: appt.endTime,

      startLocal: DateTime.fromJSDate(appt.startTime).setZone(timezone).toISO(),
      endLocal: DateTime.fromJSDate(appt.endTime).setZone(timezone).toISO(),
      notes: appt.notes,

      // ⬇️ FIXED — NOW RETURN FULL OBJECT
      service: appt.serviceId
        ? {
            _id: appt.serviceId._id,
            name: appt.serviceId.name,
            duration: appt.serviceId.duration,
            price: appt.serviceId.price,
          }
        : null,

      employee: appt.employeeId
        ? {
            _id: appt.employeeId._id,
            name: appt.employeeId.name,
            email: appt.employeeId.email,
            photo: appt.employeeId.photo || null,
          }
        : null,

      client: appt.clientId
        ? {
            _id: appt.clientId._id,
            name: decrypt(appt.clientId.encryptedName),
            phone: decrypt(appt.clientId.encryptedPhone),
            email: appt.clientId.encryptedEmail
              ? decrypt(appt.clientId.encryptedEmail)
              : null,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
};

// PUBLIC CANCELLATION (NO AUTH REQUIRED)
export const cancelAppointmentPublic = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const appointment = await Appointment.findById(id)
      .populate("serviceId")
      .populate("clientId");

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // Check if appointment can be cancelled
    if (appointment.status === 'cancelled') {
      return res.status(400).json({ message: "Appointment already cancelled" });
    }

    // Update appointment status
    appointment.status = 'cancelled';
    appointment.cancelledAt = new Date();
    appointment.cancellationReason = 'Cancelled by client via email';
    
    await appointment.save();

    // Send cancellation confirmation email
    const shop = await Barbershop.findById(appointment.barbershopId).lean();
    const timezone = shop?.timezone || "Europe/Amsterdam";
    
    const startLocal = DateTime.fromJSDate(appointment.startTime)
      .setZone(timezone)
      .toLocaleString(DateTime.DATETIME_FULL);

    const clientEmail = appointment.clientId.encryptedEmail
      ? decrypt(appointment.clientId.encryptedEmail)
      : null;

    if (clientEmail) {
      const cancelMail = templates.cancellation({
        clientName: appointment.clientId.name || "Customer",
        shopName: shop.name || "Barbershop",
        serviceName: appointment.serviceId?.name || "Service",
        startLocal
      });

      // Send cancellation email asynchronously (non-blocking)
      sendMail({
        to: clientEmail,
        subject: cancelMail.subject,
        html: cancelMail.html
      })
        .then((info) => {
          console.log(`✅ Cancellation email sent successfully:`, {
            messageId: info.messageId,
            to: clientEmail,
          });
        })
        .catch((err) => {
          console.error(`❌ Failed to send cancellation email:`, {
            message: err.message,
            code: err.code,
            response: err.response,
            to: clientEmail,
          });
        });
    }

    // Return a nice HTML response instead of JSON for better user experience
    const htmlResponse = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Appointment Cancelled</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
          .success { color: #28a745; font-size: 24px; margin-bottom: 20px; }
          .info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="success">✅ Appointment Cancelled Successfully</div>
        <div class="info">
          <p>Your appointment for <strong>${appointment.serviceId?.name || 'Service'}</strong> has been cancelled.</p>
          <p>You should receive a confirmation email shortly.</p>
        </div>
        <p>You can close this window now.</p>
      </body>
      </html>
    `;

    res.send(htmlResponse);

  } catch (err) {
    console.error('Error in public cancellation:', err);
    
    const htmlError = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
          .error { color: #dc3545; font-size: 24px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="error">❌ Error Cancelling Appointment</div>
        <p>There was an error cancelling your appointment. Please contact the shop directly.</p>
      </body>
      </html>
    `;
    
    res.status(500).send(htmlError);
  }
};
// MARK APPOINTMENT AS COMPLETED
export const markAppointmentCompleted = async (req, res, next) => {
  try {
    const { id } = req.params;
    const barbershopId = req.barbershopId;

    const appt = await Appointment.findOne({ _id: id, barbershopId })
      .populate("clientId")
      .populate("serviceId");

    if (!appt) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (appt.status === "cancelled") {
      return res.status(400).json({ message: "Cannot complete a cancelled appointment" });
    }

    if (appt.status === "completed") {
      return res.status(400).json({ message: "Appointment is already completed" });
    }

    // Update status
    appt.status = "completed";
    appt.completedAt = new Date();
    await appt.save();


    return res.json({
      message: "Appointment marked as completed",
      appointment: {
        _id: appt._id,
        status: appt.status,
        completedAt: appt.completedAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

// UPDATE APPOINTMENT STATUS
export const updateAppointmentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const barbershopId = req.barbershopId;

    const validStatuses = ['scheduled', 'completed', 'cancelled', 'no-show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const appt = await Appointment.findOne({ _id: id, barbershopId });

    if (!appt) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    appt.status = status;
    if (status === 'completed') {
      appt.completedAt = new Date();
    }
    await appt.save();

    return res.json({
      message: `Appointment status updated to ${status}`,
      appointment: {
        _id: appt._id,
        status: appt.status,
      },
    });
  } catch (err) {
    next(err);
  }
};

// DELETE APPOINTMENT
export const deleteAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const barbershopId = req.barbershopId;

    const appt = await Appointment.findOne({ _id: id, barbershopId });

    if (!appt) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    await Appointment.deleteOne({ _id: id, barbershopId });

    return res.json({
      message: "Appointment deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};