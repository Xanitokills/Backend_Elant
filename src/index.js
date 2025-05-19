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
      .input("ID_USUARIO", sql.Int, decoded.id)
      .input("TOKEN", sql.VarChar(500), tokenValue)
      .query(`
        SELECT u.ID_USUARIO, u.ID_PERSONA, u.INVALIDATION_COUNTER, s.ESTADO
        FROM MAE_USUARIO u
        LEFT JOIN MAE_SESIONES s ON u.ID_USUARIO = s.ID_USUARIO 
          AND s.TOKEN = @TOKEN AND s.ESTADO = 1
        WHERE u.ID_USUARIO = @ID_USUARIO AND u.ESTADO = 1
      `);

    if (!result.recordset || result.recordset.length === 0) {
      logger.error(`❌ Usuario no encontrado para Socket.IO: ID=${decoded.id}`);
      socket.disconnect();
      return;
    }

    const user = result.recordset[0];
    if (user.INVALIDATION_COUNTER !== decoded.invalidationCounter || !user.ESTADO) {
      logger.warn(`🚫 Token Socket.IO inválido: Contador de invalidación no coincide. DB=${user.INVALIDATION_COUNTER}, Token=${decoded.invalidationCounter}`);
      socket.disconnect();
      return;
    }

    const room = `user_${user.ID_PERSONA}`;
    socket.join(room);
    logger.info(`Cliente ${socket.id} se unió a la sala ${room}`);

    // Actualizar SOCKET_ID en MAE_SESIONES
    await pool.request()
      .input("TOKEN", sql.VarChar(500), tokenValue)
      .input("SOCKET_ID", sql.VarChar(100), socket.id)
      .query(`
        UPDATE MAE_SESIONES
        SET SOCKET_ID = @SOCKET_ID
        WHERE TOKEN = @TOKEN AND ESTADO = 1
      `);
    logger.info(`SOCKET_ID ${socket.id} asignado a la sesión para ID_PERSONA: ${user.ID_PERSONA}`);

    // Confirmar que el cliente está en la sala
    const rooms = Array.from(socket.rooms);
    logger.debug(`Cliente ${socket.id} está en las salas: ${rooms.join(", ")}`);

    // Contador de intentos fallidos de heartbeat
    let heartbeatFailures = 0;
    const maxHeartbeatFailures = 3;

    // Heartbeat para verificar sesión
    socket.on("heartbeat", async (callback) => {
      try {
        const sessionResult = await pool.request()
          .input("TOKEN", sql.VarChar(500), tokenValue)
          .input("ID_USUARIO", sql.Int, decoded.id)
          .query(`
            SELECT u.INVALIDATION_COUNTER, s.ESTADO, s.SOCKET_ID
            FROM MAE_USUARIO u
            JOIN MAE_SESIONES s ON u.ID_USUARIO = s.ID_USUARIO
            WHERE s.TOKEN = @TOKEN AND u.ID_USUARIO = @ID_USUARIO
          `);

        if (!sessionResult.recordset.length || !sessionResult.recordset[0].ESTADO) {
          logger.warn(`Heartbeat: Sesión inválida o expirada para ${socket.id}`);
          heartbeatFailures++;
          callback({ valid: false, message: `Sesión inválida o expirada (Intento ${heartbeatFailures}/${maxHeartbeatFailures})` });
          if (heartbeatFailures >= maxHeartbeatFailures) {
            socket.disconnect();
          }
          return;
        }

        const session = sessionResult.recordset[0];
        if (session.INVALIDATION_COUNTER !== decoded.invalidationCounter) {
          logger.warn(`Heartbeat: Contador de invalidación no coincide para ${socket.id}`);
          heartbeatFailures++;
          callback({ valid: false, message: `Sesión inválida (Intento ${heartbeatFailures}/${maxHeartbeatFailures})` });
          if (heartbeatFailures >= maxHeartbeatFailures) {
            socket.disconnect();
          }
          return;
        }

        // Actualizar SOCKET_ID en cada heartbeat válido
        if (session.SOCKET_ID !== socket.id) {
          await pool.request()
            .input("TOKEN", sql.VarChar(500), tokenValue)
            .input("SOCKET_ID", sql.VarChar(100), socket.id)
            .query(`
              UPDATE MAE_SESIONES
              SET SOCKET_ID = @SOCKET_ID
              WHERE TOKEN = @TOKEN AND ESTADO = 1
            `);
          logger.info(`SOCKET_ID actualizado a ${socket.id} durante heartbeat`);
        }

        // Reiniciar contador de fallos en heartbeat exitoso
        heartbeatFailures = 0;
        callback({ valid: true });
      } catch (error) {
        logger.error(`Error en heartbeat para ${socket.id}: ${error.message}`);
        heartbeatFailures++;
        callback({ valid: false, message: `Error al validar sesión (Intento ${heartbeatFailures}/${maxHeartbeatFailures})` });
        if (heartbeatFailures >= maxHeartbeatFailures) {
          socket.disconnect();
        }
      }
    });

    // Manejo de desconexión con espera de 60 segundos
    socket.on("disconnect", async (reason) => {
      logger.info(`Cliente desconectado: ${socket.id}, motivo: ${reason}`);
      const socketsInRoom = io.sockets.adapter.rooms.get(room);
      logger.debug(`Clientes restantes en la sala ${room}: ${socketsInRoom ? socketsInRoom.size : 0}`);

      // Establecer un temporizador de 60 segundos antes de limpiar SOCKET_ID
      setTimeout(async () => {
        try {
          const sessionCheck = await pool.request()
            .input("SOCKET_ID", sql.VarChar(100), socket.id)
            .input("TOKEN", sql.VarChar(500), tokenValue)
            .query(`
              SELECT SOCKET_ID, ESTADO
              FROM MAE_SESIONES
              WHERE SOCKET_ID = @SOCKET_ID AND TOKEN = @TOKEN
            `);

          // Si la sesión ya está inactiva (ESTADO = 0), no intentar limpiar
          if (sessionCheck.recordset.length === 0 || sessionCheck.recordset[0].ESTADO === 0) {
            logger.info(`SOCKET_ID ${socket.id} no limpiado: sesión ya inactiva o no encontrada`);
            return;
          }

          // Verificar si hay una nueva conexión activa con el mismo token
          const activeConnectionCheck = await pool.request()
            .input("TOKEN", sql.VarChar(500), tokenValue)
            .query(`
              SELECT SOCKET_ID
              FROM MAE_SESIONES
              WHERE TOKEN = @TOKEN AND ESTADO = 1 AND SOCKET_ID IS NOT NULL
            `);

          if (
            sessionCheck.recordset[0].SOCKET_ID === socket.id &&
            activeConnectionCheck.recordset.length === 0
          ) {
            await pool.request()
              .input("SOCKET_ID", sql.VarChar(100), socket.id)
              .input("TOKEN", sql.VarChar(500), tokenValue)
              .query(`
                UPDATE MAE_SESIONES
                SET SOCKET_ID = NULL
                WHERE SOCKET_ID = @SOCKET_ID AND TOKEN = @TOKEN AND ESTADO = 1
              `);
            logger.info(`SOCKET_ID ${socket.id} limpiado de MAE_SESIONES tras 60 segundos`);
          } else {
            logger.info(
              `SOCKET_ID ${socket.id} no limpiado: ${
                activeConnectionCheck.recordset.length > 0
                  ? "nueva conexión activa"
                  : "sesión modificada"
              }`
            );
          }
        } catch (error) {
          logger.error(`Error al limpiar SOCKET_ID ${socket.id}: ${error.message}`);
        }
      }, 60000); // 60 segundos de espera
    });
  } catch (error) {
    logger.error(`🔥 Error al autenticar Socket.IO: ${error.message}`);
    socket.disconnect();
  }

  // Manejo de reconexión
  socket.on("reconnect", async () => {
    logger.info(`Cliente reconectado: ${socket.id}`);
    try {
      const pool = await poolPromise;
      await pool.request()
        .input("TOKEN", sql.VarChar(500), tokenValue)
        .input("SOCKET_ID", sql.VarChar(100), socket.id)
        .query(`
          UPDATE MAE_SESIONES
          SET SOCKET_ID = @SOCKET_ID
          WHERE TOKEN = @TOKEN AND ESTADO = 1
        `);
      logger.info(`SOCKET_ID ${socket.id} actualizado tras reconexión`);
    } catch (error) {
      logger.error(`Error al actualizar SOCKET_ID en reconexión: ${error.message}`);
    }
  });

  // Depuración adicional para intentos de reconexión
  socket.on("reconnect_attempt", (attempt) => {
    logger.info(`Intento de reconexión para ${socket.id}: #${attempt}`);
  });

  socket.on("reconnect_failed", () => {
    logger.error(`Fallaron todos los intentos de reconexión para ${socket.id}`);
  });
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