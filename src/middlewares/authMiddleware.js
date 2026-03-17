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

    const user = await User.findById(decoded.id).select("-password");
    
    if (!user) {
      return res.status(401).json({ message: "The user belonging to this token no longer exists." });
    }
    
    req.user = user;

    next();
  } catch (err) {
    return res.status(401).json({ message: "Access token expired or invalid" });
  }
};
