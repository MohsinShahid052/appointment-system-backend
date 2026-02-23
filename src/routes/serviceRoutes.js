import express from "express";
import {
  createService,
  getServices,
  getServiceById,
  updateService,
  deleteService,
  restoreService,
} from "../controllers/serviceController.js";

import { protect } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(requireTenant(true));

router.post("/", createService);
router.get("/", getServices);
router.get("/:id", getServiceById);
router.patch("/:id", updateService);
router.delete("/:id", deleteService);
router.patch("/:id/restore", restoreService);

export default router;
