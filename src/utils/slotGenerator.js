import Appointment from "../models/Appointment.js";
import TimeOff from "../models/TimeOff.js";
import Employee from "../models/Employee.js";
import Barbershop from "../models/Barbershop.js";
import Service from "../models/Service.js";
import { DateTime } from "luxon";

/**
 * generateSlots:
 * - date: "YYYY-MM-DD" (shop-local date)
 * - returns slots with both shop-local ISO and UTC ISO
 */
export const generateSlots = async ({
  barbershopId,
  employeeId,
  date,
  serviceDuration = 15,
  stepMinutes = 15,
}) => {
  if (!barbershopId || !employeeId || !date) throw new Error("Missing params");

  // load shop timezone
  const shop = await Barbershop.findById(barbershopId).lean();
  const zone = (shop && shop.timezone) ? shop.timezone : "Europe/Amsterdam";

  // load employee
  const employee = await Employee.findOne({ _id: employeeId, barbershopId }).lean();
  if (!employee) throw new Error("Employee not found");

  // weekday mapping for object workingHours
  const dtDate = DateTime.fromISO(date, { zone }).startOf("day");
  const weekday = dtDate.weekday; // 1..7
  const keyMap = { 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat", 7: "sun" };
  const dayKey = keyMap[weekday];

  const hours = employee.workingHours?.[dayKey];
  if (!hours || !hours.start || !hours.end) return [];

  const workStartDT = DateTime.fromISO(`${date}T${hours.start}`, { zone }).set({ second: 0, millisecond: 0 });
  const workEndDT = DateTime.fromISO(`${date}T${hours.end}`, { zone }).set({ second: 0, millisecond: 0 });

  // convert to UTC JS dates for DB queries
  const dbRangeStart = workStartDT.toUTC().toJSDate();
  const dbRangeEnd = workEndDT.toUTC().toJSDate();

  // fetch overlapping appointments (stored as UTC in DB) with service duration info
  const appointments = await Appointment.find({
    employeeId,
    barbershopId,
    startTime: { $lt: dbRangeEnd },
    endTime: { $gt: dbRangeStart },
    status: { $ne: "cancelled" },
  }).populate('serviceId', 'duration').lean();

  // fetch timeoffs overlapping or recurring
  const tDayStartUTC = dtDate.startOf("day").toUTC().toJSDate();
  const tDayEndUTC = dtDate.endOf("day").toUTC().toJSDate();

  const timeoffs = await TimeOff.find({
    employeeId,
    barbershopId,
    isActive: true,
    $or: [
      { date: { $gte: tDayStartUTC, $lte: tDayEndUTC } }, // full-day stored as UTC midnight range
      { startTime: { $lt: dbRangeEnd }, endTime: { $gt: dbRangeStart } }, // time range overlap
      { "recurring.isRecurring": true, "recurring.dayOfWeek": ((weekday % 7)) } // recurring (store 0=Sun..6=Sat)
    ],
  }).lean();

  // helper overlap (DateTime in same zone)
  const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

  // convert appointments -> intervals in shop zone with duration info
  const apptIntervals = appointments.map(a => {
    const serviceDuration = a.serviceId?.duration || 30; // default to 30 if not found
    return {
      start: DateTime.fromJSDate(a.startTime, { zone: "utc" }).setZone(zone),
      end: DateTime.fromJSDate(a.endTime, { zone: "utc" }).setZone(zone),
      duration: serviceDuration,
    };
  });

  // convert timeoffs -> intervals in shop zone
  const timeoffIntervals = [];
  for (const t of timeoffs) {
    if (t.date) {
      timeoffIntervals.push({ start: dtDate.startOf("day"), end: dtDate.endOf("day") });
    } else if (t.startTime && t.endTime) {
      timeoffIntervals.push({
        start: DateTime.fromJSDate(t.startTime, { zone: "utc" }).setZone(zone),
        end: DateTime.fromJSDate(t.endTime, { zone: "utc" }).setZone(zone),
      });
    } else if (t.recurring?.isRecurring) {
      const rs = t.recurring.startTime;
      const re = t.recurring.endTime;
      if (rs && re) {
        timeoffIntervals.push({
          start: DateTime.fromISO(`${date}T${rs}`, { zone }),
          end: DateTime.fromISO(`${date}T${re}`, { zone }),
        });
      }
    }
  }

  // generate slots (shop-local)
  // Strategy: 
  // 1. Generate all 30-minute slots at :00 and :30
  // 2. Generate all 15-minute slots at :00, :15, :30, :45
  // 3. Remove 15-minute slots if their corresponding 30-minute slot is booked
  // 4. Remove 30-minute slots if both 15-minute slots in that range are booked
  const slots30min = [];
  const slots15min = [];
  const all15minSlots = []; // Track all potential 15-minute slots
  
  // Start from work start time - generate slots starting from actual employee start time
  // Round down to the nearest 15-minute mark that is <= employee start time
  let cursor = workStartDT.set({ second: 0, millisecond: 0 });
  const startMinute = cursor.minute;
  const roundedDown = Math.floor(startMinute / 15) * 15;
  cursor = cursor.set({ minute: roundedDown });
  
  // This ensures if employee starts at 9:00, slots start at 9:00
  // If employee starts at 9:07, slots start at 9:00  
  // If employee starts at 9:16, slots start at 9:15
  
  // Generate all potential 15-minute slots starting from employee start time
  // We want slots at :00, :15, :30, :45 marks
  // Start from the cursor which is already rounded down to the nearest 15-minute mark
  while (cursor.plus({ minutes: 15 }) <= workEndDT) {
    const slotStart = cursor;
    const slotEnd = cursor.plus({ minutes: 15 });
    const minute = slotStart.minute;
    
    // Only generate at :00, :15, :30, :45 marks
    if (minute === 0 || minute === 15 || minute === 30 || minute === 45) {
      // Since cursor starts from rounded down time (<= work start), 
      // we only need to ensure it's not before work start by comparing the actual times
      // For employee starting at 9:00, cursor is 9:00, so slotStart (9:00) >= workStartDT (9:00) ✓
      if (slotStart < workStartDT) {
        cursor = cursor.plus({ minutes: 15 });
        continue;
      }
      
      // Check for conflicts
      const apptConflict = apptIntervals.some(a => overlaps(slotStart, slotEnd, a.start, a.end));
      const timeoffConflict = timeoffIntervals.some(t => overlaps(slotStart, slotEnd, t.start, t.end));
      
      if (!apptConflict && !timeoffConflict) {
        all15minSlots.push({
          startLocalISO: slotStart.toISO(),
          endLocalISO: slotEnd.toISO(),
          startUTC: slotStart.toUTC().toISO(),
          endUTC: slotEnd.toUTC().toISO(),
          interval: 15,
          minute: minute
        });
      }
    }
    
    cursor = cursor.plus({ minutes: 15 });
  }
  
  // Now generate 30-minute slots and filter 15-minute slots accordingly
  // Generate 30-minute slots at :00 and :30 marks
  // Start from employee start time, round down to nearest :00 or :30
  let cursor30 = workStartDT.set({ second: 0, millisecond: 0 });
  const startMinute30 = cursor30.minute;
  
  // Round down to nearest :00 or :30 mark
  if (startMinute30 === 0) {
    // Already at :00, use it
    cursor30 = cursor30.set({ minute: 0 });
  } else if (startMinute30 <= 30) {
    // Round down to :00 of current hour
    cursor30 = cursor30.set({ minute: 0 });
  } else {
    // Round down to :30 of current hour
    cursor30 = cursor30.set({ minute: 30 });
  }
  
  // Ensure we don't start before employee start time
  if (cursor30 < workStartDT) {
    // Move to next :00 or :30 mark
    if (cursor30.minute === 0) {
      cursor30 = cursor30.set({ minute: 30 });
    } else {
      cursor30 = cursor30.plus({ hours: 1 }).set({ minute: 0 });
    }
  }
  
  while (cursor30.plus({ minutes: 30 }) <= workEndDT) {
    const slotStart = cursor30;
    const slotEnd30 = cursor30.plus({ minutes: 30 });
    const minute = slotStart.minute;
    
    // Only process slots at :00 and :30
    if (minute !== 0 && minute !== 30) {
      // Move to next :00 or :30 mark
      if (cursor30.minute === 0) {
        cursor30 = cursor30.set({ minute: 30 });
      } else {
        cursor30 = cursor30.plus({ hours: 1 }).set({ minute: 0 });
      }
      continue;
    }
    
    // Ensure slot starts at or after employee start time
    if (slotStart < workStartDT) {
      // Move to next :00 or :30 mark
      if (cursor30.minute === 0) {
        cursor30 = cursor30.set({ minute: 30 });
      } else {
        cursor30 = cursor30.plus({ hours: 1 }).set({ minute: 0 });
      }
      continue;
    }
    
    // Check for timeoff conflict
    const timeoffConflict = timeoffIntervals.some(t => overlaps(slotStart, slotEnd30, t.start, t.end));
    
    if (timeoffConflict) {
      // Move to next :00 or :30 mark
      if (cursor30.minute === 0) {
        cursor30 = cursor30.set({ minute: 30 });
      } else {
        cursor30 = cursor30.plus({ hours: 1 }).set({ minute: 0 });
      }
      continue;
    }
    
    // Check for appointments in this 30-minute slot
    const appointmentsInSlot = apptIntervals.filter(a => overlaps(slotStart, slotEnd30, a.start, a.end));
    
    // Check if there's a 30-minute appointment that fully blocks this slot
    const has30MinAppt = appointmentsInSlot.some(a => {
      const apptDuration = a.duration;
      const apptActualDuration = a.end.diff(a.start, 'minutes').minutes;
      // Check if appointment fully covers the 30-minute slot (with small tolerance)
      const apptStartMin = a.start.set({ second: 0, millisecond: 0 });
      const apptEndMin = a.end.set({ second: 0, millisecond: 0 });
      const slotStartMin = slotStart.set({ second: 0, millisecond: 0 });
      const slotEnd30Min = slotEnd30.set({ second: 0, millisecond: 0 });
      
      const blocksSlot = (apptDuration >= 30 || apptActualDuration >= 29) && 
                        apptStartMin <= slotStartMin && 
                        apptEndMin >= slotEnd30Min;
      return blocksSlot;
    });
    
    if (has30MinAppt) {
      // 30-minute slot is fully booked, don't add it
      // The corresponding 15-minute slots will be filtered out later
    } else {
      // Check if both 15-minute slots in this range are booked
      const midPoint = slotStart.plus({ minutes: 15 });
      const firstHalfStart = slotStart;
      const firstHalfEnd = midPoint;
      const secondHalfStart = midPoint;
      const secondHalfEnd = slotEnd30;
      
      // Check if first half (e.g., 9:00-9:15) is booked
      const firstHalfBooked = apptIntervals.some(a => {
        const aStartMin = a.start.set({ second: 0, millisecond: 0 });
        const aEndMin = a.end.set({ second: 0, millisecond: 0 });
        const fsMin = firstHalfStart.set({ second: 0, millisecond: 0 });
        const feMin = firstHalfEnd.set({ second: 0, millisecond: 0 });
        return aStartMin.equals(fsMin) && aEndMin.equals(feMin);
      });
      
      // Check if second half (e.g., 9:15-9:30) is booked
      const secondHalfBooked = apptIntervals.some(a => {
        const aStartMin = a.start.set({ second: 0, millisecond: 0 });
        const aEndMin = a.end.set({ second: 0, millisecond: 0 });
        const ssMin = secondHalfStart.set({ second: 0, millisecond: 0 });
        const seMin = secondHalfEnd.set({ second: 0, millisecond: 0 });
        return aStartMin.equals(ssMin) && aEndMin.equals(seMin);
      });
      
      if (firstHalfBooked && secondHalfBooked) {
        // Both 15-minute slots are booked, don't show the 30-minute slot
        // The 15-minute slots are already filtered out (they have conflicts)
      } else if (appointmentsInSlot.length === 0) {
        // No appointments, 30-minute slot is fully available
        slots30min.push({
          startLocalISO: slotStart.toISO(),
          endLocalISO: slotEnd30.toISO(),
          startUTC: slotStart.toUTC().toISO(),
          endUTC: slotEnd30.toUTC().toISO(),
          interval: 30
        });
      }
      // If only one half is booked, we don't show the 30-minute slot, but the free 15-minute slot is shown
    }
    
    // Move to next :00 or :30 mark
    if (cursor30.minute === 0) {
      cursor30 = cursor30.set({ minute: 30 });
    } else {
      cursor30 = cursor30.plus({ hours: 1 }).set({ minute: 0 });
    }
  }
  
  // Filter 15-minute slots: remove any that are within a booked 30-minute slot
  for (const slot15 of all15minSlots) {
    const slot15Start = DateTime.fromISO(slot15.startLocalISO, { zone });
    const slot15End = DateTime.fromISO(slot15.endLocalISO, { zone });
    
    // Check if this 15-minute slot is within any booked 30-minute appointment
    let isWithinBooked30Min = false;
    
    // Check all appointments to see if this 15-minute slot is within a 30-minute appointment
    for (const appt of apptIntervals) {
      const apptDuration = appt.duration;
      const apptActualDuration = appt.end.diff(appt.start, 'minutes').minutes;
      
      // If appointment is 30 minutes or longer
      if (apptDuration >= 30 || apptActualDuration >= 29) {
        // Normalize times to minute precision
        const apptStartMin = appt.start.set({ second: 0, millisecond: 0 });
        const apptEndMin = appt.end.set({ second: 0, millisecond: 0 });
        const slot15StartMin = slot15Start.set({ second: 0, millisecond: 0 });
        const slot15EndMin = slot15End.set({ second: 0, millisecond: 0 });
        
        // Check if appointment starts at :00 or :30 (standard 30-minute slot boundaries)
        const apptStartMinute = apptStartMin.minute;
        if (apptStartMinute === 0 || apptStartMinute === 30) {
          // Check if this 15-minute slot is completely within the 30-minute appointment
          // The slot should start at or after appointment start, and end at or before appointment end
          if (slot15StartMin >= apptStartMin && slot15EndMin <= apptEndMin) {
            isWithinBooked30Min = true;
            break;
          }
        } else {
          // For non-standard start times, just check if slot overlaps with appointment
          if (overlaps(slot15Start, slot15End, appt.start, appt.end)) {
            isWithinBooked30Min = true;
            break;
          }
        }
      }
    }
    
    if (!isWithinBooked30Min) {
      slots15min.push(slot15);
    }
  }
  
  // Return 30-minute slots first, then 15-minute slots
  return [...slots30min, ...slots15min];
};
