  import mongoose from "mongoose";

  const AppointmentSchema = new mongoose.Schema(
    {
      barbershopId: { type: mongoose.Schema.Types.ObjectId, ref: "Barbershop", required: true, index: true },
      clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
      employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
      serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },

      startTime: { type: Date, required: true }, // store absolute instant (UTC under the hood)
      endTime: { type: Date, required: true },

      status: { type: String, enum: ["scheduled", "completed", "cancelled", "no-show"], default: "scheduled" },
      notes: { type: String },
      reminderSent: { type: Boolean, default: false },
    },
    { timestamps: true }
  );

  // Performance indexes
  AppointmentSchema.index({ employeeId: 1, startTime: 1, endTime: 1 });
  AppointmentSchema.index({ barbershopId: 1, startTime: 1, status: 1 });
  AppointmentSchema.index({ barbershopId: 1, status: 1, startTime: 1 });
  AppointmentSchema.index({ startTime: 1, status: 1 }); // For reminder cron job
  AppointmentSchema.index({ clientId: 1 });

  export default mongoose.model("Appointment", AppointmentSchema);
