import express from "express";
import {cancelAppointmentPublic} from "../controllers/appointmentController.js";
import { translateUiTexts } from "../controllers/translateController.js";

const router = express.Router();
// PUBLIC ROUTE - No authentication required
router.get("/:id/cancel", cancelAppointmentPublic);
router.post("/translate-ui", translateUiTexts);
export default router;