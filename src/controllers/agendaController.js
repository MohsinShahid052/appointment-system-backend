// src/controllers/agendaController.js
import Appointment from "../models/Appointment.js";
import TimeOff from "../models/TimeOff.js";
import Employee from "../models/Employee.js";
import Barbershop from "../models/Barbershop.js";
import Client from "../models/Client.js";
import { DateTime } from "luxon";
import { decrypt } from "../utils/crypto.js";

/**
 * Helper: build interval object with local + utc ISO
 */
const buildInterval = (startDT, endDT, zone) => ({
  startLocal: startDT.setZone(zone).toISO(),
  endLocal: endDT.setZone(zone).toISO(),
  startUTC: startDT.toUTC().toISO(),
  endUTC: endDT.toUTC().toISO()
});

/**
 * GET /api/agenda?date=YYYY-MM-DD&employeeId=<id>
 *
 * Returns merged schedule for the requested shop and date:
 * - working window (optional)
 * - appointments
 * - timeoffs (full-day, specific, recurring)
 *
 * Response: { date: "YYYY-MM-DD", zone: "Europe/Amsterdam", entries: [ ...sorted by startLocal ] }
 */
export const getDayAgenda = async (req, res, next) => {
  try {
    const barbershopId = req.barbershopId;
    if (!barbershopId) return res.status(400).json({ message: "Tenant missing" });

    const { date, employeeId } = req.query;
    if (!date) return res.status(400).json({ message: "date query param required (YYYY-MM-DD)" });

    // load shop timezone
    const shop = await Barbershop.findById(barbershopId).lean();
    const zone = (shop && shop.timezone) ? shop.timezone : "Europe/Amsterdam";

    // compute day range in shop zone and convert to UTC for DB queries
    const dayStartLocal = DateTime.fromISO(date, { zone }).startOf("day");
    if (!dayStartLocal.isValid) return res.status(400).json({ message: "Invalid date format" });

    const dayEndLocal = dayStartLocal.endOf("day");
    const dbStartUTC = dayStartLocal.toUTC().toJSDate();
    const dbEndUTC = dayEndLocal.toUTC().toJSDate();

    // build base queries
    const apptQuery = {
      barbershopId,
      startTime: { $lt: dbEndUTC },
      endTime: { $gt: dbStartUTC },
      status: { $ne: "cancelled" }
    };
    const timeoffQuery = {
      barbershopId,
      isActive: true,
      $or: [
        { date: { $gte: dayStartLocal.toJSDate(), $lte: dayEndLocal.toJSDate() } }, // full-day (stored as midnight local→UTC)
        { startTime: { $lt: dbEndUTC }, endTime: { $gt: dbStartUTC } }, // time range overlaps
        { "recurring.isRecurring": true } // filter further by day-of-week later
      ]
    };

    if (employeeId) {
      apptQuery.employeeId = employeeId;
      timeoffQuery.employeeId = employeeId;
    }

    // Optimized query with selective population and lean()
    const [appointments, timeoffs] = await Promise.all([
      Appointment.find(apptQuery)
        .populate("clientId", "encryptedName encryptedPhone")
        .populate("serviceId", "name duration price")
        .populate("employeeId", "name email photo")
        .lean(),
      TimeOff.find(timeoffQuery).lean()
    ]);

    // build agenda entries array
    const entries = [];

    // Optionally include working window as an entry (for employee only)
    if (employeeId) {
      const emp = await Employee.findById(employeeId).lean();
      if (emp && emp.workingHours) {
        const weekday = dayStartLocal.weekday; // 1..7
        const keyMap = { 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat", 7: "sun" };
        const dayKey = keyMap[weekday];
        const hours = emp.workingHours?.[dayKey];
        if (hours && hours.isWorkingDay && hours.start && hours.end) {
          const workStart = DateTime.fromISO(`${date}T${hours.start}`, { zone }).set({ second:0, millisecond:0 });
          const workEnd = DateTime.fromISO(`${date}T${hours.end}`, { zone }).set({ second:0, millisecond:0 });
          entries.push({
            type: "workingWindow",
            ...buildInterval(workStart, workEnd, zone),
            meta: { employeeId, employeeName: emp.name }
          });
        }
      }
    }

    // Process appointments -> convert times to shop zone and add decrypted client info
    for (const a of appointments) {
      const startDT = DateTime.fromJSDate(a.startTime, { zone: "utc" }).setZone(zone);
      const endDT = DateTime.fromJSDate(a.endTime, { zone: "utc" }).setZone(zone);

      // decrypt client info (if present)
      let clientInfo = null;
      if (a.clientId) {
        const clientDoc = a.clientId;
        const email = clientDoc.encryptedEmail ? decrypt(clientDoc.encryptedEmail) : null;
        const name = clientDoc.encryptedName ? decrypt(clientDoc.encryptedName) : (clientDoc.name || null);
        const phone = clientDoc.encryptedPhone ? decrypt(clientDoc.encryptedPhone) : (clientDoc.phone || null);

        clientInfo = { _id: clientDoc._id, name, email, phone };
      }

      entries.push({
        type: "appointment",
        ...buildInterval(startDT, endDT, zone),
        meta: {
          appointmentId: a._id,
          employeeId: a.employeeId ? a.employeeId._id : null,
          employeeName: a.employeeId ? a.employeeId.name : null,
          serviceId: a.serviceId ? a.serviceId._id : null,
          serviceName: a.serviceId ? a.serviceId.name : null,
          notes: a.notes || null,
          status: a.status,
          client: clientInfo
        }
      });
    }

    // Process timeoffs
    for (const t of timeoffs) {
      // recurring
      if (t.recurring?.isRecurring) {
        // recurring.dayOfWeek: expected 0=Sun..6=Sat in DB (we used that structure before)
        // dayStartLocal.weekday: 1=Mon..7=Sun -> convert to 0..6
        const weekday0to6 = (dayStartLocal.weekday % 7); // Monday 1 -> 1, Sunday 7 -> 0
        if (t.recurring.dayOfWeek === weekday0to6) {
          // recurring.startTime / endTime are "HH:mm" strings (stored)
          const rs = t.recurring.startTime;
          const re = t.recurring.endTime;
          if (rs && re) {
            const startDT = DateTime.fromISO(`${date}T${rs}`, { zone }).set({ second:0, millisecond:0 });
            const endDT = DateTime.fromISO(`${date}T${re}`, { zone }).set({ second:0, millisecond:0 });

            entries.push({
              type: "timeoff",
              subtype: "recurring",
              ...buildInterval(startDT, endDT, zone),
              meta: { timeOffId: t._id, reason: t.reason || null, employeeId: t.employeeId }
            });
          }
        }
        continue; // skip to next t
      }

      // full-day (t.date stored as Date (midnight), compare date)
      if (t.date) {
        // t.date stored as JS Date (UTC), convert to shop local and check equality of local date
        const tLocal = DateTime.fromJSDate(t.date, { zone: "utc" }).setZone(zone);
        if (tLocal.toISODate() === dayStartLocal.toISODate()) {
          const startDT = dayStartLocal.startOf("day");
          const endDT = dayStartLocal.endOf("day");
          entries.push({
            type: "timeoff",
            subtype: "full-day",
            ...buildInterval(startDT, endDT, zone),
            meta: { timeOffId: t._id, reason: t.reason || null, employeeId: t.employeeId }
          });
        }
        continue;
      }

      // specific time range (t.startTime / t.endTime stored as UTC JS Dates)
      if (t.startTime && t.endTime) {
        const startDT = DateTime.fromJSDate(t.startTime, { zone: "utc" }).setZone(zone);
        const endDT = DateTime.fromJSDate(t.endTime, { zone: "utc" }).setZone(zone);
        // check overlap with day local range
        if (startDT < dayEndLocal && endDT > dayStartLocal) {
          // clamp to day range
          const s = startDT < dayStartLocal ? dayStartLocal : startDT;
          const e = endDT > dayEndLocal ? dayEndLocal : endDT;
          entries.push({
            type: "timeoff",
            subtype: "range",
            ...buildInterval(s, e, zone),
            meta: { timeOffId: t._id, reason: t.reason || null, employeeId: t.employeeId }
          });
        }
        continue;
      }
    }

    // sort entries by startLocal asc
    entries.sort((a, b) => {
      const aStart = DateTime.fromISO(a.startLocal);
      const bStart = DateTime.fromISO(b.startLocal);
      return aStart - bStart;
    });

    return res.json({
      date: dayStartLocal.toISODate(),
      zone,
      count: entries.length,
      entries
    });
  } catch (err) {
    next(err);
  }
};
