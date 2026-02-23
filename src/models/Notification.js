import mongoose from "mongoose";

/**
 * Notification logs when emails/SMS/whatsapp are sent (or attempted)
 */
const NotificationSchema = new mongoose.Schema(
  {
    barbershopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Barbershop",
      required: true,
      index: true,
    },

    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      index: true, // index belongs here, no duplicate schema.index()
    },

    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      index: true, // index belongs here
    },

    type: {
      type: String,
      enum: ["confirmation", "reminder", "cancellation", "other"],
      required: true,
    },

    channel: {
      type: String,
      enum: ["email", "whatsapp", "sms"],
      default: "email",
    },

    status: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
    },

    error: { type: String },

    sentAt: { type: Date },

    payload: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Performance indexes
NotificationSchema.index({ createdAt: -1 }); // For sorting by date
NotificationSchema.index({ barbershopId: 1, createdAt: -1 }); // Compound index for common query

export default mongoose.model("Notification", NotificationSchema);
