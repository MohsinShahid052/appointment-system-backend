import TimeOff from "../models/TimeOff.js";
import Employee from "../models/Employee.js";
import Barbershop from "../models/Barbershop.js";
import { DateTime } from "luxon";

/**
 * Helpers
 */
const hasOverlap = async ({ employeeId, barbershopId, startUTC, endUTC }) => {
  return await TimeOff.findOne({
    employeeId,
    barbershopId,
    recurring: { $exists: false },
    $or: [{ startTime: { $lt: endUTC }, endTime: { $gt: startUTC } }],
  });
};

const hasRecurringOverlap = async ({
  employeeId,
  barbershopId,
  dayOfWeek,
  startTime,
  endTime,
}) => {
  return await TimeOff.findOne({
    employeeId,
    barbershopId,
    "recurring.isRecurring": true,
    "recurring.dayOfWeek": dayOfWeek,
    $or: [
      {
        "recurring.startTime": { $lt: endTime },
        "recurring.endTime": { $gt: startTime },
      },
    ],
  });
};

/**
 * Create TimeOff (shop-local input → store UTC)
 */
export const createTimeOff = async (req, res, next) => {
  try {
    const barbershopId = req.barbershopId;
    const { employeeId, date, startLocal, endLocal, recurring, reason } =
      req.body;

    // Validate employee & shop
    const emp = await Employee.findOne({ _id: employeeId, barbershopId });
    if (!emp) return res.status(400).json({ message: "Invalid employeeId" });

    const shop = await Barbershop.findById(barbershopId).lean();
    const timezone =
      shop && shop.timezone ? shop.timezone : "Europe/Amsterdam";

    const doc = { barbershopId, employeeId, reason };

    // 1) Recurring weekly
    if (recurring?.isRecurring) {
      const { dayOfWeek, startTime, endTime } = recurring;
      if (dayOfWeek == null || !startTime || !endTime) {
        return res.status(400).json({
          message: "Recurring time-off requires dayOfWeek, startTime, endTime",
        });
      }

      // Prevent overlapping recurring
      const conflict = await hasRecurringOverlap({
        employeeId,
        barbershopId,
        dayOfWeek,
        startTime,
        endTime,
      });

      if (conflict) {
        return res.status(400).json({
          message:
            "Recurring time-off overlaps with an existing recurring time-off",
        });
      }

      doc.recurring = { isRecurring: true, dayOfWeek, startTime, endTime };
      const saved = await TimeOff.create(doc);
      return res.status(201).json(saved);
    }

    // 2) Full day
    if (date && !startLocal && !endLocal) {
      const localDate = DateTime.fromISO(date, { zone: timezone });
      if (!localDate.isValid)
        return res.status(400).json({ message: "Invalid date format" });

      const startUTC = localDate.startOf("day").toUTC().toJSDate();
      const endUTC = localDate.endOf("day").toUTC().toJSDate();

      const overlap = await hasOverlap({
        employeeId,
        barbershopId,
        startUTC,
        endUTC,
      });
      if (overlap)
        return res
          .status(400)
          .json({ message: "Full-day time-off overlaps with an existing time-off" });

      doc.startTime = startUTC;
      doc.endTime = endUTC;
      const saved = await TimeOff.create(doc);

      // Return with local fields for convenience
      const out = saved.toObject();
      out.startLocal = DateTime.fromJSDate(startUTC)
        .setZone(timezone)
        .toISO();
      out.endLocal = DateTime.fromJSDate(endUTC).setZone(timezone).toISO();
      return res.status(201).json(out);
    }

    // 3) Specific hours (startLocal & endLocal are shop-local ISO strings like "2025-12-01T14:00")
    if (startLocal && endLocal) {
      const startDT = DateTime.fromISO(startLocal, { zone: timezone });
      const endDT = DateTime.fromISO(endLocal, { zone: timezone });

      if (!startDT.isValid || !endDT.isValid || endDT <= startDT)
        return res
          .status(400)
          .json({ message: "Invalid startLocal or endLocal" });

      const startUTC = startDT.toUTC().toJSDate();
      const endUTC = endDT.toUTC().toJSDate();

      const overlap = await hasOverlap({
        employeeId,
        barbershopId,
        startUTC,
        endUTC,
      });
      if (overlap)
        return res
          .status(400)
          .json({ message: "Time-off overlaps with an existing time-off" });

      doc.startTime = startUTC;
      doc.endTime = endUTC;
      const saved = await TimeOff.create(doc);

      const out = saved.toObject();
      out.startLocal = DateTime.fromJSDate(startUTC)
        .setZone(timezone)
        .toISO();
      out.endLocal = DateTime.fromJSDate(endUTC).setZone(timezone).toISO();
      return res.status(201).json(out);
    }

    // Fallback
    return res.status(400).json({
      message:
        "Invalid time-off format. Provide either: full-day date OR startLocal+endLocal OR recurring.",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * List TimeOff for ONE employee (convert DB UTC → shop-local in output)
 */
export const listTimeOffForEmployee = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const barbershopId = req.barbershopId;

    const emp = await Employee.findOne({ _id: employeeId, barbershopId });
    if (!emp) return res.status(404).json({ message: "Employee not found" });

    const shop = await Barbershop.findById(barbershopId).lean();
    const timezone =
      shop && shop.timezone ? shop.timezone : "Europe/Amsterdam";

    const items = await TimeOff.find({ employeeId, barbershopId })
      .sort({ createdAt: -1 })
      .lean();

    const formatted = items.map((t) => {
      const startLocal = t.startTime
        ? DateTime.fromJSDate(t.startTime).setZone(timezone).toISO()
        : null;
      const endLocal = t.endTime
        ? DateTime.fromJSDate(t.endTime).setZone(timezone).toISO()
        : null;
      return { ...t, startLocal, endLocal };
    });

    res.json(formatted);
  } catch (err) {
    next(err);
  }
};

/**
 * List TimeOff for WHOLE barbershop (convert DB UTC → shop-local in output)
 */
export const listTimeOffForBarbershop = async (req, res, next) => {
  try {
    const barbershopId = req.barbershopId;

    const shop = await Barbershop.findById(barbershopId).lean();
    const timezone =
      shop && shop.timezone ? shop.timezone : "Europe/Amsterdam";

    const items = await TimeOff.find({ barbershopId })
      .sort({ createdAt: -1 })
      .populate("employeeId", "name")
      .lean();

    // Attach startLocal / endLocal for UI
    const formatted = items.map((t) => {
      const startLocal = t.startTime
        ? DateTime.fromJSDate(t.startTime).setZone(timezone).toISO()
        : null;
      const endLocal = t.endTime
        ? DateTime.fromJSDate(t.endTime).setZone(timezone).toISO()
        : null;
      return { ...t, startLocal, endLocal };
    });

    res.json(formatted);
  } catch (err) {
    next(err);
  }
};

/**
 * Delete TimeOff
 */
export const deleteTimeOff = async (req, res, next) => {
  try {
    const { id } = req.params;
    const barbershopId = req.barbershopId;

    const deleted = await TimeOff.findOneAndDelete({ _id: id, barbershopId });
    if (!deleted)
      return res.status(404).json({ message: "TimeOff not found" });

    res.json({ message: "TimeOff deleted successfully", timeoff: deleted });
  } catch (err) {
    next(err);
  }
};

// Bulk create holiday time off for ALL employees of a barbershop
export const createHolidayForAllEmployees = async (req, res, next) => {
  try {
    const barbershopId = req.barbershopId;
    const { date, startLocal, endLocal, recurring, reason } = req.body;

    if (!barbershopId) {
      return res.status(400).json({ message: "Missing barbershop/tenant" });
    }

    // Load shop timezone
    const shop = await Barbershop.findById(barbershopId).lean();
    const timezone =
      shop && shop.timezone ? shop.timezone : "Europe/Amsterdam";

    // Get all active employees in this barbershop
    const employees = await Employee.find({ barbershopId, isActive: true }).lean();
    if (!employees.length) {
      return res
        .status(400)
        .json({ message: "No active employees found for this barbershop" });
    }

    // We will collect created records to return
    const created = [];

    // Helper to create one time-off
    const createForEmployee = async (emp) => {
      const employeeId = emp._id;
      const baseDoc = { barbershopId, employeeId, reason };

      // 1) Recurring weekly holiday
      if (recurring?.isRecurring) {
        const { dayOfWeek, startTime, endTime } = recurring;
        if (dayOfWeek == null || !startTime || !endTime) {
          throw new Error("Recurring holiday requires dayOfWeek, startTime, endTime");
        }

        const conflict = await hasRecurringOverlap({
          employeeId,
          barbershopId,
          dayOfWeek,
          startTime,
          endTime,
        });

        if (conflict) {
          // skip this employee if conflicting recurring
          return null;
        }

        baseDoc.recurring = { isRecurring: true, dayOfWeek, startTime, endTime };
        const saved = await TimeOff.create(baseDoc);
        return saved;
      }

      // 2) Full-day holiday
      if (date && !startLocal && !endLocal) {
        const localDate = DateTime.fromISO(date, { zone: timezone });
        if (!localDate.isValid) {
          throw new Error("Invalid date format for holiday");
        }

        const startUTC = localDate.startOf("day").toUTC().toJSDate();
        const endUTC = localDate.endOf("day").toUTC().toJSDate();

        const overlap = await hasOverlap({
          employeeId,
          barbershopId,
          startUTC,
          endUTC,
        });
        if (overlap) {
          // skip if existing overlap for that employee
          return null;
        }

        baseDoc.startTime = startUTC;
        baseDoc.endTime = endUTC;
        const saved = await TimeOff.create(baseDoc);
        return saved;
      }

      // 3) Specific times on that date
      if (startLocal && endLocal) {
        const startDT = DateTime.fromISO(startLocal, { zone: timezone });
        const endDT = DateTime.fromISO(endLocal, { zone: timezone });

        if (!startDT.isValid || !endDT.isValid || endDT <= startDT) {
          throw new Error("Invalid startLocal or endLocal for holiday");
        }

        const startUTC = startDT.toUTC().toJSDate();
        const endUTC = endDT.toUTC().toJSDate();

        const overlap = await hasOverlap({
          employeeId,
          barbershopId,
          startUTC,
          endUTC,
        });
        if (overlap) {
          return null;
        }

        baseDoc.startTime = startUTC;
        baseDoc.endTime = endUTC;
        const saved = await TimeOff.create(baseDoc);
        return saved;
      }

      // If none of the patterns matched
      throw new Error(
        "Holiday requires either date (full day) or startLocal/endLocal or recurring"
      );
    };

    const results = await Promise.all(
      employees.map((emp) => createForEmployee(emp))
    );

    results.forEach((r) => {
      if (r) created.push(r);
    });

    return res.status(201).json({
      message: "Holiday created for all employees",
      createdCount: created.length,
      totalEmployees: employees.length,
      records: created,
    });
  } catch (err) {
    next(err);
  }
};
