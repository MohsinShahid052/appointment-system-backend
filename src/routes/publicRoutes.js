import express from "express";
import {cancelAppointmentPublic} from "../controllers/appointmentController.js";

const router = express.Router();
// PUBLIC ROUTE - No authentication required
router.get("/:id/cancel", cancelAppointmentPublic);
export default router;