const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const doorRoutes = require("./routes/doorRoutes");
const movementRoutes = require("./routes/movementRoutes");
const userRoutes = require("./routes/userRoutes");
const reservationRoutes = require("./routes/reservationRoutes");
const logger = require("./config/logger");
const menuRoutes = require("./routes/menuRoutes");
require("dotenv").config();

const app = express();

// Middleware: primero se debe analizar el body JSON
app.use(express.json());

// Configuración de CORS
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Rutas organizadas por módulo
logger.info("Cargando rutas...");
app.use("/api", movementRoutes); // Público (sin auth)
logger.info("Rutas de movementRoutes cargadas.");
app.use("/api", authRoutes); // Autenticación (login, register, token)
logger.info("Rutas de authRoutes cargadas.");
app.use("/api", doorRoutes); // Gestión de puertas
logger.info("Rutas de doorRoutes cargadas.");
app.use("/api", userRoutes); // Usuarios, cambios de clave, menú, etc.
logger.info("Rutas de userRoutes cargadas.");
app.use("/api", menuRoutes); // Gestión de menús y submenús ✅
logger.info("Rutas de menuRoutes cargadas.");
app.use("/api/reservations", reservationRoutes); // Reservas (áreas, slots, reservas de usuario)
logger.info("Rutas de reservationRoutes cargadas.");

// Middleware para depurar todas las solicitudes
app.use((req, res, next) => {
  logger.info(`Solicitud recibida: ${req.method} ${req.url}`);
  next();
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}, Stack: ${err.stack}`);
  res.status(500).json({ message: "Error del servidor", error: err.message });
});

// Iniciar el servidor
const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  logger.info(`✅ Server running on port ${PORT}`);
});