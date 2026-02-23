import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { sendConfirmation, scanAndSendReminders, getLogs } from "../controllers/notificationController.js";

const router = express.Router();

// protect + tenant required for shop-level operations
router.use(protect);
router.use(requireTenant(true));

// Manually send confirmation for an appointment
router.post("/send-confirmation", sendConfirmation);

// Manual/cron trigger to scan and send 24h reminders
router.post("/scan-send-reminders", scanAndSendReminders);

// List notification logs for the current tenant
router.get("/logs", getLogs);

export default router;
