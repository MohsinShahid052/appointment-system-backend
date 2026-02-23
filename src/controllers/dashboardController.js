// src/controllers/dashboardController.js
import Appointment from "../models/Appointment.js";
import Barbershop from "../models/Barbershop.js";
import Service from "../models/Service.js";
import Client from "../models/Client.js";
import Employee from "../models/Employee.js";
import { DateTime } from "luxon";

/**
 * Parse date (YYYY-MM-DD) in shop timezone -> returns { startUTC: Date, endUTC: Date, zone, localStartDT, localEndDT }
 */
const dayRangeForShop = (dateStr, zone) => {
  const localStart = DateTime.fromISO(dateStr, { zone }).startOf("day");
  const localEnd = localStart.endOf("day");
  return {
    zone,
    localStart,
    localEnd,
    startUTC: localStart.toUTC().toJSDate(),
    endUTC: localEnd.toUTC().toJSDate(),
  };
};

/**
 * GET /api/dashboard/daily-stats?date=YYYY-MM-DD
 *
 * Returns daily metrics for the tenant's barbershop for the given date (shop-local)
 */
export const getDailyStats = async (req, res, next) => {
  try {
    const barbershopId = req.barbershopId;
    if (!barbershopId) return res.status(400).json({ message: "Tenant missing" });

    const { date } = req.query;
    if (!date) return res.status(400).json({ message: "date query param required (YYYY-MM-DD)" });

    // load shop timezone
    const shop = await Barbershop.findById(barbershopId).lean();
    const zone = shop?.timezone || "Europe/Amsterdam";

    const { startUTC, endUTC, localStart, localEnd } = dayRangeForShop(date, zone);

    // Appointments overlapping that day (start < dayEnd && end > dayStart)
    const appts = await Appointment.find({
      barbershopId,
      startTime: { $lt: endUTC },
      endTime: { $gt: startUTC },
    }).populate("serviceId").lean();

    // Counters
    let totalAppointments = 0;
    let completed = 0;
    let scheduled = 0;
    let cancelled = 0;
    let noShow = 0;

    let revenueGenerated = 0; // completed
    let revenueExpected = 0; // scheduled + completed

    // Count per employee
    const perEmployeeCount = {}; // { employeeId: count }

    for (const a of appts) {
      totalAppointments += 1;
      const status = a.status || "scheduled";
      if (status === "completed") completed++;
      if (status === "scheduled") scheduled++;
      if (status === "cancelled") cancelled++;
      if (status === "no-show") noShow++;

      // revenue sums (use service.price if available)
      const price = a.serviceId?.price ?? 0;
      if (status === "completed") revenueGenerated += Number(price || 0);
      if (status === "completed" || status === "scheduled") revenueExpected += Number(price || 0);

      const eid = a.employeeId ? a.employeeId.toString() : "_unassigned";
      perEmployeeCount[eid] = (perEmployeeCount[eid] || 0) + 1;
    }

    // Employees active count (for average)
    const employeeCount = await Employee.countDocuments({ barbershopId, isActive: true });

    const avgAppointmentsPerEmployee = employeeCount > 0 ? (totalAppointments / employeeCount) : totalAppointments;

    // New clients created that day
    const newClients = await Client.countDocuments({
      barbershopId,
      createdAt: { $gte: localStart.toUTC().toJSDate(), $lte: localEnd.toUTC().toJSDate() },
      isDeleted: false
    });

    return res.json({
      date: localStart.toISODate(),
      zone,
      totals: {
        totalAppointments,
        completed,
        scheduled,
        cancelled,
        noShow
      },
      revenue: {
        revenueGenerated,
        revenueExpected
      },
      employees: {
        activeEmployees: employeeCount,
        avgAppointmentsPerEmployee
      },
      newClients
    });
  } catch (err) {
    next(err);
  }
};


/**
 * GET /api/dashboard/weekly-revenue?start=YYYY-MM-DD
 * - start = shop-local date for the first day of the week (e.g. Monday)
 *
 * Returns revenue per day for 7 days starting at `start` (shop-local)
 */
export const getWeeklyRevenue = async (req, res, next) => {
  try {
    const barbershopId = req.barbershopId;
    if (!barbershopId) return res.status(400).json({ message: "Tenant missing" });

    const { start } = req.query;
    if (!start) return res.status(400).json({ message: "start query param required (YYYY-MM-DD)" });

    const shop = await Barbershop.findById(barbershopId).lean();
    const zone = shop?.timezone || "Europe/Amsterdam";

    // startLocal is the start day (shop-local)
    let startLocal = DateTime.fromISO(start, { zone }).startOf("day");
    if (!startLocal.isValid) return res.status(400).json({ message: "Invalid start date" });

    const days = [];
    let total = 0;

    // For each day compute revenueGenerated and revenueExpected
    for (let i = 0; i < 7; i++) {
      const day = startLocal.plus({ days: i });
      const dayStartUTC = day.startOf("day").toUTC().toJSDate();
      const dayEndUTC = day.endOf("day").toUTC().toJSDate();

      // find appointments overlapping day
      const appts = await Appointment.find({
        barbershopId,
        startTime: { $lt: dayEndUTC },
        endTime: { $gt: dayStartUTC },
      }).populate("serviceId").lean();

      let revenueGenerated = 0;
      let revenueExpected = 0;

      for (const a of appts) {
        const price = a.serviceId?.price ?? 0;
        if (a.status === "completed") revenueGenerated += Number(price);
        if (a.status === "completed" || a.status === "scheduled") revenueExpected += Number(price);
      }

      days.push({
        date: day.toISODate(),
        revenueGenerated,
        revenueExpected
      });

      total += revenueGenerated;
    }

    const average = days.length ? (total / days.length) : 0;

    return res.json({
      start: startLocal.toISODate(),
      zone,
      days,
      totalRevenueGenerated: total,
      averageRevenuePerDay: average
    });

  } catch (err) {
    next(err);
  }
};
