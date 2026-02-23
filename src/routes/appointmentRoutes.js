import express from "express";
import {
  getAvailableSlots,
  createAppointment,
  listAppointments,
  getAppointmentById,
  markAppointmentCompleted,
  updateAppointmentStatus,
  deleteAppointment
} from "../controllers/appointmentController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

const router = express.Router();


// ------------------- PROTECTED ROUTES -------------------
router.use(protect);
router.use(requireTenant(true));

router.get("/slots", getAvailableSlots);
router.post("/", createAppointment);
router.get("/", listAppointments);
router.patch("/:id/complete", markAppointmentCompleted);
router.patch("/:id/status", updateAppointmentStatus);
router.delete("/:id", deleteAppointment);
router.get("/:id", getAppointmentById);


export default router;
