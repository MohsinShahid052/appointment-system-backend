import mongoose from "mongoose";

/**
 * TimeOff supports:
 *  - Full day: `date` (Date stored at midnight)
 *  - Specific startTime/endTime: full ISO Date fields
 *  - Recurring: recurring.isRecurring = true, recurring.dayOfWeek (0-6), recurring.startTimeStr/endTimeStr ("13:00")
 */

const RecurringSchema = new mongoose.Schema(
  {
    isRecurring: { type: Boolean, default: false },
    dayOfWeek: { type: Number, min: 0, max: 6 },
    startTime: { type: String }, // "13:00"
    endTime: { type: String },   // "14:00"
  },
  { _id: false }
);

const TimeOffSchema = new mongoose.Schema(
  {
    barbershopId: { type: mongoose.Schema.Types.ObjectId, ref: "Barbershop", required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true, index: true },

    // full-day block (midnight date)
    date: { type: Date },

    // exact datetimes
    startTime: { type: Date },
    endTime: { type: Date },

    // recurring weekly
    recurring: { type: RecurringSchema },

    reason: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

TimeOffSchema.index({ barbershopId: 1, employeeId: 1, isActive: 1 });
TimeOffSchema.index({ employeeId: 1, date: 1 });

export default mongoose.model("TimeOff", TimeOffSchema);
