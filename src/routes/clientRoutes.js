import express from "express";
import {
  upsertClient,
  listClients,
  getClientById,
  deleteClient,
} from "../controllers/clientController.js";

import { protect } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

const router = express.Router();

// Apply authentication and tenant middleware to all routes
router.use(protect);
router.use(requireTenant(true));

// ============================================
// EXPLICIT ROUTE DEFINITIONS
// ============================================

// POST /api/clients - Create or update client
router.post("/", upsertClient);

// GET /api/clients/all - List all clients (explicit endpoint)
router.get("/all", listClients);


// GET /api/clients/:id - Get client by ID (must come after /all and /)
router.get("/:id", (req, res, next) => {
  console.log(`[CLIENT ROUTE] GET /api/clients/:id - ID: ${req.params.id}, BarbershopId: ${req.barbershopId}`);
  getClientById(req, res, next);
});

// DELETE /api/clients/:id - Delete client
router.delete("/:id", deleteClient);

export default router;
