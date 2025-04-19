const express = require("express");
const cors = require("cors");
const http = require("http"); // Necesario para Socket.IO
const { Server } = require("socket.io"); // Importar Socket.IO
const authRoutes = require("./routes/authRoutes");
const doorRoutes = require("./routes/doorRoutes");
const movementRoutes = require("./routes/movementRoutes");
const userRoutes = require("./routes/userRoutes");
const reservationRoutes = require("./routes/reservationRoutes");
const visitRoutes = require("./routes/visitRoutes");
const logger = require("./config/logger");
const menuRoutes = require("./routes/menuRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const maintenanceRoutes = require("./routes/maintenanceRoutes");
require("dotenv").config();

const app = express();
const server = http.createServer(app); // Crear servidor HTTP
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
}); // Integrar Socket.IO

// Middleware
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

// Rutas
logger.info("Cargando rutas...");
app.use("/api", movementRoutes);
logger.info("Rutas de movementRoutes cargadas.");
app.use("/api", authRoutes);
logger.info("Rutas de authRoutes cargadas.");
app.use("/api", doorRoutes);
logger.info("Rutas de doorRoutes cargadas.");
app.use("/api", userRoutes);
logger.info("Rutas de userRoutes cargadas.");
app.use("/api", menuRoutes);
logger.info("Rutas de menuRoutes cargadas.");
app.use("/api", visitRoutes);
logger.info("Rutas de visitRoutes cargadas.");
app.use("/api/reservations", reservationRoutes);
logger.info("Rutas de reservationRoutes cargadas.");
app.use("/api", dashboardRoutes);
logger.info("Rutas de dashboardRoutes cargadas.");
app.use("/api", maintenanceRoutes);
logger.info("Rutas de maintenanceRoutes cargadas.");

// Middleware para depurar solicitudes
app.use((req, res, next) => {
  logger.info(`Solicitud recibida: ${req.method} ${req.url}`);
  next();
});

// Configuración de Socket.IO
io.on("connection", (socket) => {
  logger.info(`Nuevo cliente conectado: ${socket.id}`);

  // Autenticación del token en Socket.IO
  const token = socket.handshake.auth.token;
  if (!token || !token.startsWith("Bearer ")) {
    logger.warn("Conexión sin token válido");
    socket.disconnect();
    return;
  }

  // Aquí puedes verificar el token JWT si es necesario
  // Ejemplo: jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);

  socket.on("disconnect", () => {
    logger.info(`Cliente desconectado: ${socket.id}`);
  });
});

// Hacer que `io` esté disponible en los controladores
app.set("io", io);

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}, Stack: ${err.stack}`);
  res.status(500).json({ message: "Error del servidor", error: err.message });
});

// Iniciar el servidor
const PORT = process.env.PORT || 4000;
server.listen(PORT, "0.0.0.0", () => {
  logger.info(`✅ Server running on port ${PORT}`);
});