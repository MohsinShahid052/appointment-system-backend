import mongoose from "mongoose";

const DayHoursSchema = new mongoose.Schema(
  {
    start: { type: String }, // "09:00"
    end: { type: String },   // "18:00"
    isWorkingDay: { type: Boolean, default: true },
  },
  { _id: false }
);

const EmployeeSchema = new mongoose.Schema(
  {
    barbershopId: { type: mongoose.Schema.Types.ObjectId, ref: "Barbershop", required: true, index: true },

    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    photo: { type: String },

    services: [{ type: mongoose.Schema.Types.ObjectId, ref: "Service", index: true }],

    // object with keys: mon, tue, wed, thu, fri, sat, sun
    workingHours: {
      mon: { type: DayHoursSchema, default: undefined },
      tue: { type: DayHoursSchema, default: undefined },
      wed: { type: DayHoursSchema, default: undefined },
      thu: { type: DayHoursSchema, default: undefined },
      fri: { type: DayHoursSchema, default: undefined },
      sat: { type: DayHoursSchema, default: undefined },
      sun: { type: DayHoursSchema, default: undefined },
    },
    gender: { type: String, enum: ["male", "female", "other"] },

    isActive: { type: Boolean, default: true },
    notes: { type: String },
  },
  { timestamps: true }
);

EmployeeSchema.index({ barbershopId: 1, isActive: 1 });

export default mongoose.model("Employee", EmployeeSchema);
