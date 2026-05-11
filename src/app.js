import "./config/env.js";

import cookieParser from "cookie-parser";
import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import timeoffRoutes from "./routes/timeoffRoutes.js";
import clientRoutes from "./routes/clientRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import agendaRoutes from "./routes/agendaRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import publicRoutes from "./routes/publicRoutes.js";

const app = express();

const envOrigins = (process.env.FRONTEND_URLS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [
  "http://localhost:3000",
  "https://milano-booking.com/",
  "https://appointmentsystemfrontend-production-aef8.up.railway.app",
  ...envOrigins,
];

// DB Connection
connectDB();

/* ============================================
   🔥 STEP 1 — FIX OPTIONS PREFLIGHT GLOBALLY
   ============================================ */
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }

  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(200); // very important
  }

  next();
});

/* ============================================
   🔥 STEP 2 — Apply Actual CORS Middleware
   ============================================ */
const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept", "x-auth-token"]
};

app.use(cors(corsOptions));

// Body + Cookies
app.use(express.json());
app.use(cookieParser());

/* ============================================
   🔥 Routes
   ============================================ */
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/timeoffs", timeoffRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/agenda", agendaRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/public", publicRoutes);

// Test Route
app.get("/", (req, res) => {
  res.send("Appointment Management System API Running…");
});

// 404 Handler for unmatched routes (must come after all routes but before error handler)
app.use((req, res, next) => {
  // Only handle API routes that weren't matched
  if (req.path.startsWith('/api')) {
    console.log(`404 - API route not found: ${req.method} ${req.originalUrl}`);
    return res.status(404).json({ 
      message: "API endpoint not found",
      path: req.originalUrl,
      method: req.method
    });
  }
  // For non-API routes, continue to next middleware (or return 404)
  res.status(404).json({ message: "Route not found" });
});



export default app;
