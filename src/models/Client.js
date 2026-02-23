import mongoose from "mongoose";

const ClientSchema = new mongoose.Schema(
  {
    barbershopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Barbershop",
      required: true,
      index: true,
    },

    encryptedName: { type: String, required: true },
    encryptedEmail: { type: String },
    encryptedPhone: { type: String, required: true },

    phoneHash: { type: String, required: true, index: true },

    notes: { type: String },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Client", ClientSchema);
