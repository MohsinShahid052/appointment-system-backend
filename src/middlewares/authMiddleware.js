import jwt from "jsonwebtoken";
import keys from "../config/keys.js";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token)
    return res.status(401).json({ message: "No access token provided" });

  try {
    const decoded = jwt.verify(token, keys.jwtSecret);

    req.user = await User.findById(decoded.id).select("-password");

    next();
  } catch (err) {
    return res.status(401).json({ message: "Access token expired or invalid" });
  }
};
