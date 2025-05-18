const express = require("express");
const cors = require("cors");
const http = require("http");
const compression = require("compression");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const logger = require("./config/logger");
const sql = require("mssql");
const { poolPromise } = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const doorRoutes = require("./routes/doorRoutes");
const movementRoutes = require("./routes/movementRoutes");
const userRoutes = require("./routes/userRoutes");
const reservationRoutes = require("./routes/reservationRoutes");
const visitRoutes = require("./routes/visitRoutes");
const menuRoutes = require("./routes/menuRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const maintenanceRoutes = require("./routes/maintenanceRoutes");
const orderRoutes = require("./routes/orderRoutes");
const userListRoutes = require("./routes/userListRoutes");

const { checkForUpdates } = require("./controllers/dashboardController");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Middleware
app.use(compression());
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
app.use("/api", orderRoutes(io));
logger.info("Rutas de orderRoutes cargadas.");
app.use("/api", userListRoutes);
logger.info("Rutas de userListRoutes cargadas.");

// Middleware para depurar solicitudes
app.use((req, res, next) => {
  logger.info(`Solicitud recibida: ${req.method} ${req.url}`);
  next();
});

// Configuración de Socket.IO
io.on("connection", async (socket) => {
  logger.info(`Nuevo cliente conectado: ${socket.id}`);

  const token = socket.handshake.auth.token;
  if (!token || !token.startsWith("Bearer ")) {
    logger.warn(`Conexión sin token válido: ${socket.id}`);
    socket.disconnect();
    return;
  }

  const tokenValue = token.replace("Bearer ", "");
  let decoded;
  try {
    decoded = jwt.verify(tokenValue, process.env.JWT_SECRET);
    logger.info(`✅ Token Socket.IO decodificado: ID=${decoded.id}, ID_PERSONA=${decoded.idPersona}, INVALIDATION_COUNTER=${decoded.invalidationCounter}`);
  } catch (err) {
    logger.error(`❌ Error al decodificar token Socket.IO: ${err.message}`);
    socket.disconnect();
    return;
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("id", sql.Int, decoded.id)
      .query(`
        SELECT u.ID_USUARIO, u.ID_PERSONA, u.INVALIDATION_COUNTER
        FROM MAE_USUARIO u
        WHERE u.ID_USUARIO = @id AND u.ESTADO = 1
      `);

    if (!result.recordset || result.recordset.length === 0) {
      logger.error(`❌ Usuario no encontrado para Socket.IO: ID=${decoded.id}`);
      socket.disconnect();
      return;
    }

    const user = result.recordset[0];
    if (user.INVALIDATION_COUNTER !== decoded.invalidationCounter) {
      logger.warn(`🚫 Token Socket.IO inválido: Contador de invalidación no coincide. DB=${user.INVALIDATION_COUNTER}, Token=${decoded.invalidationCounter}`);
      socket.disconnect();
      return;
    }

    const room = `user_${user.ID_PERSONA}`;
    socket.join(room);
    logger.info(`Cliente ${socket.id} se unió a la sala ${room}`);

    // Confirmar que el cliente está en la sala
    const rooms = Array.from(socket.rooms);
    logger.debug(`Cliente ${socket.id} está en las salas: ${rooms.join(", ")}`);

    // Log cuando se emite un evento a la sala
    socket.on("emit", (event, data) => {
      logger.debug(`Evento emitido a la sala ${room}: ${event}, Datos: ${JSON.stringify(data)}`);
    });

    socket.on("disconnect", () => {
      logger.info(`Cliente desconectado: ${socket.id}`);
      const socketsInRoom = io.sockets.adapter.rooms.get(room);
      logger.debug(`Clientes restantes en la sala ${room}: ${socketsInRoom ? socketsInRoom.size : 0}`);
    });
  } catch (error) {
    logger.error(`🔥 Error al autenticar Socket.IO: ${error.message}`);
    socket.disconnect();
  }
});

// Hacer que `io` esté disponible en los controladores
app.set("io", io);

// Iniciar polling para verificar cambios cada 5 segundos
setInterval(() => checkForUpdates(io), 5000);

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