import mongoose from "mongoose";

const OpeningHours = new mongoose.Schema(
  {
    start: String,
    end: String,
  },
  { _id: false }
);

const BarbershopSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    address: String,
    phone: String,
    email: String,
    logo: String,

    openingHours: {
      mon: OpeningHours,
      tue: OpeningHours,
      wed: OpeningHours,
      thu: OpeningHours,
      fri: OpeningHours,
      sat: OpeningHours,
      sun: OpeningHours,
    },
    city: String,
    postalCode: String,
    deleted: { type: Boolean, default: false }, // <-- soft delete flag
     timezone: { type: String, default: process.env.DEFAULT_TIMEZONE || "Europe/Amsterdam" },
currency: {
  type: String,
  enum: ["EUR", "USD", "TRY"],  // allowed values
  default: "EUR",               // default currency
  required: true
}

  },
  
  { timestamps: true }
);

export default mongoose.model("Barbershop", BarbershopSchema);
