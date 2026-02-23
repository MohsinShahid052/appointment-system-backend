// src/routes/agendaRoutes.js
import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { getDayAgenda } from "../controllers/agendaController.js";

const router = express.Router();

router.use(protect);
router.use(requireTenant(true));

// GET /api/agenda?date=YYYY-MM-DD&employeeId=...
router.get("/", getDayAgenda);

export default router;
