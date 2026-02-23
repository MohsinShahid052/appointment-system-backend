import keys from "../config/keys.js";
import User from "../models/User.js";
import Barbershop from "../models/Barbershop.js";
import ServiceCategory from "../models/ServiceCategory.js";
import Service from "../models/Service.js";
import BarbershopPreset from "../models/BarbershopPreset.js";
import { generateAccessToken, generateRefreshToken } from "../utils/token.js";
import jwt from "jsonwebtoken";

export const refreshAccessToken = (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ message: "No refresh token" });

    jwt.verify(token, keys.jwtSecret, async (err, decoded) => {
      if (err) return res.status(403).json({ message: "Invalid refresh token" });

      const user = await User.findById(decoded.id);
      if (!user) return res.status(401).json({ message: "User not found" });

      const newAccessToken = generateAccessToken(user);
      return res.json({ accessToken: newAccessToken });
    });
  } catch (err) {
    next(err);
  }
};

// 1. Register Admin (run once)
export const adminRegister = async (req, res, next) => {
  try {
    const exists = await User.findOne({ email: req.body.email });
    if (exists) return res.status(400).json({ message: "Admin already exists" });

    const admin = await User.create({
      role: "admin",
      email: req.body.email,
      password: req.body.password,
    });

    res.status(201).json({ message: "Admin created", admin });
  } catch (err) {
    next(err);
  }
};
export const adminLoginAsBarbershop = async (req, res, next) => {
  try {
    // Only admins can perform this
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can login as a barbershop" });
    }

    const { barbershopId } = req.params;

    // Find the barbershop owner
    const barbershopUser = await User.findOne({ barbershopId });
    if (!barbershopUser) {
      return res.status(404).json({ message: "Barbershop user not found" });
    }

    // Generate access token for barbershop
    const accessToken = generateAccessToken(barbershopUser);

    return res.json({
      accessToken,
      user: {
        id: barbershopUser._id,
        email: barbershopUser.email,
        role: barbershopUser.role,
        barbershopId: barbershopUser.barbershopId
      },
      message: `Logged in as ${barbershopUser.email}`
    });
  } catch (err) {
    next(err);
  }
};
// 2. Admin creates a Barbershop + owner user
const findPresetByKeyOrId = async (presetKey) => {
  if (!presetKey || presetKey === "none") return null;
  const custom = await BarbershopPreset.findOne({ key: presetKey }).lean();
  if (custom) return { type: "custom", preset: custom };
  return null;
};

const applyPresetToBarbershop = async (barbershopId, presetKey) => {
  if (!presetKey || presetKey === "none") return null;

  const found = await findPresetByKeyOrId(presetKey);
  if (!found) throw new Error("Invalid preset selected");

  const preset = found.preset;

  // Create categories first
  const catKeyToId = {};
  for (const cat of preset.categories) {
    const created = await ServiceCategory.create({
      barbershopId,
      name: cat.name,
      description: cat.description,
    });
    catKeyToId[cat.key] = created._id;
  }

  // Create services linked to categories
  for (const svc of preset.services) {
    const categoryId = catKeyToId[svc.categoryKey];
    if (!categoryId) continue;
    await Service.create({
      barbershopId,
      categoryId,
      name: svc.name,
      description: svc.description,
      price: svc.price,
      duration: svc.duration,
      metadata: { preset: preset.key },
    });
  }

  return { preset: preset.key, categoriesCreated: preset.categories.length, servicesCreated: preset.services.length };
};

export const listBarbershopPresets = async (req, res) => {
  const customPresets = await BarbershopPreset.find({}).sort({ createdAt: -1 }).lean();
  const presets = customPresets.map((p) => ({
    key: p.key,
    name: p.name,
    description: p.description,
    categories: p.categories?.length || 0,
    services: p.services?.length || 0,
  }));
  res.json(presets);
};

export const createBarbershopPreset = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin allowed" });
    }

    const { name, description = "", categories = [], services = [] } = req.body;
    if (!name || !Array.isArray(categories) || !Array.isArray(services)) {
      return res.status(400).json({ message: "Name, categories, and services are required" });
    }

    // Ensure keys on categories
    const normalizedCategories = categories.map((cat) => {
      const key = cat.key || cat.name?.trim().toLowerCase().replace(/\s+/g, "-");
      return { key, name: cat.name, description: cat.description };
    });

    const categoryKeys = new Set(normalizedCategories.map((c) => c.key));
    const normalizedServices = services.map((svc) => ({
      categoryKey: svc.categoryKey,
      name: svc.name,
      description: svc.description,
      price: svc.price,
      duration: svc.duration,
    }));

    // Validate services reference valid category keys
    const invalidSvc = normalizedServices.find((s) => !categoryKeys.has(s.categoryKey));
    if (invalidSvc) {
      return res.status(400).json({ message: `Service "${invalidSvc.name}" references unknown categoryKey "${invalidSvc.categoryKey}"` });
    }

    // Generate unique key
    const baseKey = name.trim().toLowerCase().replace(/\s+/g, "-");
    let uniqueKey = baseKey;
    let counter = 1;
    while (await BarbershopPreset.findOne({ key: uniqueKey })) {
      uniqueKey = `${baseKey}-${counter++}`;
    }

    const preset = await BarbershopPreset.create({
      key: uniqueKey,
      name,
      description,
      categories: normalizedCategories,
      services: normalizedServices,
    });

    res.status(201).json(preset);
  } catch (err) {
    next(err);
  }
};

// Get single preset by key
export const getBarbershopPreset = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin allowed" });
    }

    const { key } = req.params;
    const preset = await BarbershopPreset.findOne({ key });

    if (!preset) {
      return res.status(404).json({ message: "Preset not found" });
    }

    res.json(preset);
  } catch (err) {
    next(err);
  }
};

// Update preset
export const updateBarbershopPreset = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin allowed" });
    }

    const { key } = req.params;
    const { name, description = "", categories = [], services = [] } = req.body;

    const preset = await BarbershopPreset.findOne({ key });
    if (!preset) {
      return res.status(404).json({ message: "Preset not found" });
    }

    if (!name || !Array.isArray(categories) || !Array.isArray(services)) {
      return res.status(400).json({ message: "Name, categories, and services are required" });
    }

    // Ensure keys on categories
    const normalizedCategories = categories.map((cat) => {
      const key = cat.key || cat.name?.trim().toLowerCase().replace(/\s+/g, "-");
      return { key, name: cat.name, description: cat.description };
    });

    const categoryKeys = new Set(normalizedCategories.map((c) => c.key));
    const normalizedServices = services.map((svc) => ({
      categoryKey: svc.categoryKey,
      name: svc.name,
      description: svc.description,
      price: svc.price,
      duration: svc.duration,
    }));

    // Validate services reference valid category keys
    const invalidSvc = normalizedServices.find((s) => !categoryKeys.has(s.categoryKey));
    if (invalidSvc) {
      return res.status(400).json({ message: `Service "${invalidSvc.name}" references unknown categoryKey "${invalidSvc.categoryKey}"` });
    }

    // Update preset
    preset.name = name;
    preset.description = description;
    preset.categories = normalizedCategories;
    preset.services = normalizedServices;
    await preset.save();

    res.json(preset);
  } catch (err) {
    next(err);
  }
};

export const createBarbershop = async (req, res, next) => {
  try {
    // Only admin can create a barbershop
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin allowed" });
    }

    const {
      name,
      address,
      phone,
      email,
      ownerEmail,
      ownerPassword,
      city,
      logo,
      postalCode,
      currency,
      presetKey = "none",
    } = req.body;

    // Validate required fields
    if (!name || !ownerEmail || !ownerPassword) {
      return res.status(400).json({
        message: "Name, owner email, and owner password are required"
      });
    }

    // Allowed currencies
    const allowedCurrencies = ["EUR", "USD", "TRY"];

    // Validate or fallback to default
    const shopCurrency = allowedCurrencies.includes(currency)
      ? currency
      : "EUR";

    // Create the barbershop
    const shop = await Barbershop.create({
      name,
      address,
      phone,
      email,
      city,
      logo,        // Base64 string is fine
      postalCode,
      currency: shopCurrency   // <-- Correct currency applied
    });

    // Create the owner user
    let user;
    try {
      user = await User.create({
        role: "barbershop",
        barbershopId: shop._id,
        email: ownerEmail,
        password: ownerPassword
      });
    } catch (err) {
      console.error("Failed to create owner user:", err.message);
      // Delete the barbershop if user creation fails
      await shop.deleteOne();
      return res.status(400).json({
        message: "Failed to create owner user: " + err.message
      });
    }

    // Optionally apply preset (categories + services)
    let presetResult = null;
    try {
      presetResult = await applyPresetToBarbershop(shop._id, presetKey);
    } catch (presetErr) {
      console.error("Preset application failed:", presetErr.message);
      return res.status(400).json({ message: presetErr.message || "Failed to apply preset" });
    }

    // Success
    res.status(201).json({ shop, user, preset: presetResult });
  } catch (err) {
    console.error("Error creating barbershop:", err.message);
    next(err);
  }
};

// 3. Login for admin & barbershop user
export const login = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const valid = await user.matchPassword(req.body.password);
    if (!valid) return res.status(401).json({ message: "Invalid credentials" });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Set refresh token in HTTP-Only cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false, // change to true in production
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return res.json({
      accessToken,
      user,
    });
  } catch (err) {
    next(err);
  }
};

// 4. Get logged-in user's profile
export const me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (err) {
    next(err);
  }
};

export const logout = (req, res) => {
  res.clearCookie("refreshToken");
  res.json({ message: "Logged out successfully" });
};

// 5. Update Barbershop Info
export const updateBarbershop = async (req, res, next) => {
  try {
    const { id } = req.params; // shop ID provided in URL
    const updates = req.body;

    // If not admin, enforce the logged-in user's shop ID
    if (req.user.role !== "admin") {
      if (req.user.barbershopId.toString() !== id) {
        return res.status(403).json({ message: "Not allowed to update this barbershop" });
      }
    }

    const shop = await Barbershop.findByIdAndUpdate(
      id,
      updates,
      { new: true }
    );

    if (!shop) {
      return res.status(404).json({ message: "Barbershop not found" });
    }

    return res.json({
      message: "Barbershop updated successfully",
      shop,
    });

  } catch (err) {
    next(err);
  }
};

// 6. List all barbershops (Admin only)
export const listBarbershops = async (req, res, next) => {
  try {
    // Only admin can list all shops
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin allowed" });
    }

  const shops = await Barbershop.find({ deleted: { $in: [true, false] } }).lean();


    return res.json(shops);

  } catch (err) {
    next(err);
  }
};

// 7. Get single barbershop by ID
export const getBarbershop = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // If user is barbershop owner, they can only access their own shop
    if (req.user.role === "barbershop") {
      if (req.user.barbershopId.toString() !== id) {
        return res.status(403).json({ message: "Not allowed to access this barbershop" });
      }
    }
    
    // If user is admin, they can access any shop
    const shop = await Barbershop.findById(id);
    if (!shop) {
      return res.status(404).json({ message: "Barbershop not found" });
    }
    
    res.json(shop);
  } catch (err) {
    next(err);
  }
};
// 8. Soft Delete Barbershop
export const deleteBarbershop = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Only admin can delete any shop
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin allowed to delete a barbershop" });
    }

    const shop = await Barbershop.findById(id);
    if (!shop) {
      return res.status(404).json({ message: "Barbershop not found" });
    }

    // Soft delete by setting deleted flag
    shop.deleted = true;
    await shop.save();

    // Optionally, you can also disable the owner account
    await User.updateOne({ barbershopId: shop._id }, { active: false });

    return res.json({ message: "Barbershop deleted (soft delete) successfully" });

  } catch (err) {
    next(err);
  }
};
export const restoreBarbershop = async (req, res, next) => {
  try {
    const { id } = req.params;
    const shop = await Barbershop.findById(id);
    if (!shop) return res.status(404).json({ message: "Barbershop not found" });

    shop.deleted = false;
    await shop.save();

    await User.updateOne({ barbershopId: shop._id }, { active: true });

    res.json({ message: "Barbershop restored successfully" });
  } catch (err) {
    next(err);
  }
};
// Update currency of a barbershop
export const updateCurrency = async (req, res) => {
  try {
    const { barbershopId } = req.params;
    const { currency } = req.body;

    // Validate
    const allowedCurrencies = ["EUR", "USD", "TRY"];
    if (!allowedCurrencies.includes(currency)) {
      return res.status(400).json({
        message: "Invalid currency. Allowed values are: EUR, USD, TRY.",
      });
    }

    const shop = await Barbershop.findById(barbershopId);

    if (!shop) {
      return res.status(404).json({ message: "Barbershop not found" });
    }

    // Update currency
    shop.currency = currency;
    await shop.save();

    return res.status(200).json({
      message: "Currency updated successfully",
      barbershop: shop,
    });
  } catch (error) {
    console.error("Currency update error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
// Admin resets password for a barbershop user
export const adminResetBarbershopPassword = async (req, res, next) => {
  try {
    console.log('adminResetBarbershopPassword called with user:', req.user);
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin allowed" });
    }

    const { barbershopId } = req.params;
    const { newPassword } = req.body;

    const user = await User.findOne({ barbershopId });
    if (!user) return res.status(404).json({ message: "Barbershop user not found" });

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password updated successfully by admin" });
  } catch (err) {
    next(err);
  }
};
export const barbershopChangePassword = async (req, res, next) => {
  try {
    console.log('barbershopChangePassword called with user:', req.user);

    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    const valid = await user.matchPassword(oldPassword);
    if (!valid) {
      return res.status(400).json({ message: "Old password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    next(err);
  }
};

// Admin changes their own password
export const adminChangePassword = async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin allowed" });
    }

    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    const valid = await user.matchPassword(oldPassword);
    if (!valid) {
      return res.status(400).json({ message: "Old password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    next(err);
  }
};

// Request password reset (forget password)
export const requestPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    // Don't reveal if user exists or not for security
    if (!user) {
      return res.json({ message: "If that email exists, a password reset link has been sent." });
    }

    // Generate reset token
    const crypto = await import('crypto');
    const resetToken = crypto.default.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour

    user.resetToken = resetToken;
    user.resetTokenExpiry = new Date(resetTokenExpiry);
    await user.save();

    // Send email with reset link
    const { sendMail, templates } = await import('../utils/mailer.js');
    const frontendUrl = process.env.FRONTEND_URL || process.env.REACT_APP_FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    try {
      await sendMail({
        to: user.email,
        subject: 'Password Reset Request',
        html: templates.passwordReset({ resetUrl, email: user.email })
      });
    } catch (emailErr) {
      console.error('Failed to send reset email:', emailErr);
      // Still return success to not reveal if email exists
    }

    res.json({ message: "If that email exists, a password reset link has been sent." });
  } catch (err) {
    next(err);
  }
};

// Reset password with token
export const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    user.password = newPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    next(err);
  }
};

