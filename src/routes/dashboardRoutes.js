// src/routes/dashboardRoutes.js
import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { getDailyStats, getWeeklyRevenue } from "../controllers/dashboardController.js";

const router = express.Router();

router.use(protect);
router.use(requireTenant(true));

// GET daily stats
// GET /api/dashboard/daily-stats?date=YYYY-MM-DD
router.get("/daily-stats", getDailyStats);

// GET weekly revenue
// GET /api/dashboard/weekly-revenue?start=YYYY-MM-DD
router.get("/weekly-revenue", getWeeklyRevenue);

export default router;
