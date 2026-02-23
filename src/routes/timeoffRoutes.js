import express from "express";
import {
  createTimeOff,
  listTimeOffForEmployee,
  deleteTimeOff,
  listTimeOffForBarbershop,  
   createHolidayForAllEmployees 

} from "../controllers/timeoffController.js";

import { protect } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(requireTenant(true));

router.post("/", createTimeOff);

// list time-offs for an employee
router.get("/employee/:employeeId", listTimeOffForEmployee);

// Hard-delete timeoff
router.delete("/:id", deleteTimeOff);

router.get("/", listTimeOffForBarbershop); 
// Create holiday for ALL employees (full day or specific hours / recurring weekly)
router.post("/holiday-all", createHolidayForAllEmployees);
export default router;
