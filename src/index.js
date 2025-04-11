const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const doorRoutes = require("./routes/doorRoutes");
const movementRoutes = require("./routes/movementRoutes");
const userRoutes = require("./routes/userRoutes");
const logger = require("./config/logger");
require("dotenv").config(); // Cargar variables de entorno

const app = express();

// ✅ Middleware: primero se debe analizar el body JSON
app.use(express.json());

// ✅ Configuración de CORS (usa variable de entorno para mayor flexibilidad)
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Soporte para preflight (CORS + PUT/DELETE)

// ✅ Rutas organizadas por módulo
app.use("/api", movementRoutes);  // Público (sin auth)
app.use("/api", authRoutes);      // Autenticación (login, register, token)
app.use("/api", doorRoutes);      // Gestión de puertas
app.use("/api", userRoutes);      // Usuarios, cambios de clave, menú, etc.

// ✅ Iniciar el servidor
const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  logger.info(`✅ Server running on port ${PORT}`);
});
