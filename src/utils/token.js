import jwt from "jsonwebtoken";
import keys from "../config/keys.js";

export const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      barbershopId: user.barbershopId || null,
    },
    keys.jwtSecret,
    { expiresIn: "5d" }
  );
};

export const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
    },
    keys.jwtSecret,
    { expiresIn: "30d" }
  );
};
