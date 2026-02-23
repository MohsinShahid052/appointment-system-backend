import mongoose from "mongoose";

const CategorySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
  },
  { _id: false }
);

const ServiceSchema = new mongoose.Schema(
  {
    categoryKey: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    price: { type: Number, required: true, min: 0 },
    duration: { type: Number, required: true, min: 1 }, // minutes
  },
  { _id: false }
);

const BarbershopPresetSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    categories: { type: [CategorySchema], default: [] },
    services: { type: [ServiceSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model("BarbershopPreset", BarbershopPresetSchema);

