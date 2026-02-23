import mongoose from "mongoose";

const ServiceSchema = new mongoose.Schema(
  {
    barbershopId: { type: mongoose.Schema.Types.ObjectId, ref: "Barbershop", required: true, index: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "ServiceCategory", required: true, index: true },

    name: { type: String, required: true, trim: true },
    description: { type: String },
    price: { type: Number, required: true, min: 0 },
    duration: { type: Number, required: true }, // minutes
    isActive: { type: Boolean, default: true },
    metadata: { type: Object }, // free-form if shop wants extra config
  },
  { timestamps: true }
);

// Optionally ensure unique service name per category + shop
ServiceSchema.index({ barbershopId: 1, categoryId: 1, name: 1 }, { unique: false });

export default mongoose.model("Service", ServiceSchema);
