import mongoose from "mongoose";

const ServiceCategorySchema = new mongoose.Schema(
  {
    barbershopId: { type: mongoose.Schema.Types.ObjectId, ref: "Barbershop", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Ensure unique category name per barbershop
ServiceCategorySchema.index({ barbershopId: 1, name: 1 }, { unique: true });

export default mongoose.model("ServiceCategory", ServiceCategorySchema);
