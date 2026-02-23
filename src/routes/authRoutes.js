import express from "express";
import { login, me, logout, refreshAccessToken, createBarbershop, adminRegister,updateBarbershop,listBarbershops,getBarbershop,deleteBarbershop,restoreBarbershop,updateCurrency,adminResetBarbershopPassword,barbershopChangePassword,adminChangePassword,requestPasswordReset,resetPassword,adminLoginAsBarbershop, listBarbershopPresets, createBarbershopPreset, getBarbershopPreset, updateBarbershopPreset } from "../controllers/authController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.post("/refresh", refreshAccessToken);
router.post("/logout", logout);
router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", resetPassword);

router.post("/admin/register", adminRegister);
router.get("/barbershop-presets", protect, listBarbershopPresets);
router.get("/barbershop-presets/:key", protect, getBarbershopPreset);
router.post("/barbershop-presets", protect, createBarbershopPreset);
router.put("/barbershop-presets/:key", protect, updateBarbershopPreset);
router.post("/barbershop/create", protect, createBarbershop);
router.get("/me", protect, me);
router.put("/barbershop/change-password", protect, barbershopChangePassword);
router.put("/admin/change-password", protect, adminChangePassword);
router.get('/barbershop/:id',protect, getBarbershop);


router.delete('/barbershop/:id',protect, deleteBarbershop);
router.post('/barbershop/:id/restore',protect, restoreBarbershop);
router.put("/barbershop/:barbershopId/currency", protect, updateCurrency);
router.put("/admin/reset-password/:barbershopId", protect, adminResetBarbershopPassword);
router.post("/admin/login-as/:barbershopId", protect, adminLoginAsBarbershop);
router.put("/barbershop/:id", protect, updateBarbershop);
router.get("/barbershops", protect, listBarbershops);
export default router;
