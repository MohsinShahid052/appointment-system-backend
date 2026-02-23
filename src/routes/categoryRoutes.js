import express from "express";
import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  restoreCategory,
} from "../controllers/categoryController.js";

import { protect } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

const router = express.Router();

// All routes require authentication & tenant context
router.use(protect);
router.use(requireTenant(true)); // admin can pass ?barbershopId, but for barbershop user it will enforce their shop

router.post("/", createCategory);
router.get("/", getCategories);
router.get("/:id", getCategoryById);
router.patch("/:id", updateCategory);
router.delete("/:id", deleteCategory);
router.patch("/:id/restore", restoreCategory);


export default router;
