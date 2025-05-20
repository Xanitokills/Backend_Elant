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
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

const io = new Server(server, {
  cors: corsOptions,
  path: "/socket.io/",
});

app.use(compression());
app.use(express.json());
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

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

app.use((req, res, next) => {
  logger.info(`Solicitud recibida: ${req.method} ${req.url}`);
  next();
});

// Configuración de Socket.IO mejorada
io.on("connection", async (socket) => {
  logger.info(`Nueva conexión: SocketID=${socket.id}, Token=${socket.handshake.auth.token}`);

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
    logger.info(
      `✅ Token Socket.IO decodificado: ID=${decoded.id}, ID_PERSONA=${
        decoded.idPersona
      }, INVALIDATION_COUNTER=${decoded.invalidationCounter}, SocketID=${socket.id}`
    );
  } catch (err) {
    logger.error(
      `❌ Error al decodificar token Socket.IO: ${err.message}, SocketID=${socket.id}`
    );
    socket.disconnect();
    return;
  }

  try {
    const pool = await poolPromise;
    // Validar usuario y sesión
    const result = await pool
      .request()
      .input("ID_USUARIO", sql.Int, decoded.id)
      .input("TOKEN", sql.VarChar(500), tokenValue)
      .query(`
        SELECT u.ID_USUARIO, u.ID_PERSONA, u.INVALIDATION_COUNTER, s.ESTADO, s.SOCKET_ID
        FROM MAE_USUARIO u
        LEFT JOIN MAE_SESIONES s ON u.ID_USUARIO = s.ID_USUARIO 
          AND s.TOKEN = @TOKEN AND s.ESTADO = 1
        WHERE u.ID_USUARIO = @ID_USUARIO AND u.ESTADO = 1
      `);

    if (!result.recordset || result.recordset.length === 0) {
      logger.error(
        `❌ Usuario no encontrado para Socket.IO: ID=${decoded.id}, SocketID=${socket.id}`
      );
      socket.disconnect();
      return;
    }

    const user = result.recordset[0];
    if (
      user.INVALIDATION_COUNTER !== decoded.invalidationCounter ||
      !user.ESTADO
    ) {
      logger.warn(
        `🚫 Token Socket.IO inválido: Contador de invalidación no coincide. DB=${
          user.INVALIDATION_COUNTER
        }, Token=${decoded.invalidationCounter}, SocketID=${socket.id}`
      );
      socket.emit("sessionInvalidated", { reason: "invalid_token" });
      socket.disconnect();
      return;
    }

    const room = `user_${user.ID_PERSONA}`;
    socket.join(room);
    logger.info(`Cliente ${socket.id} se unió a la sala ${room}`);

    // Confirmar unión a la sala
    socket.emit("joinedRoom", { room });
    logger.debug(
      `Cliente ${socket.id} confirmado en sala ${room}, Salas actuales: ${Array.from(
        socket.rooms
      ).join(", ")}`
    );

    // Actualizar SOCKET_ID en la sesión activa
    await pool
      .request()
      .input("ID_USUARIO", sql.Int, decoded.id)
      .input("SOCKET_ID", sql.VarChar(100), socket.id)
      .input("TOKEN", sql.VarChar(500), tokenValue)
      .query(`
        UPDATE MAE_SESIONES
        SET SOCKET_ID = @SOCKET_ID
        WHERE ID_USUARIO = @ID_USUARIO AND TOKEN = @TOKEN AND ESTADO = 1
      `);
    logger.info(
      `SOCKET_ID ${socket.id} asignado a la sesión para ID_USUARIO: ${decoded.id}`
    );

    // Verificar si la sesión activa existe
    const sessionCheck = await pool
      .request()
      .input("TOKEN", sql.VarChar(500), tokenValue)
      .query(`
        SELECT ID_USUARIO, ESTADO, SOCKET_ID
        FROM MAE_SESIONES
        WHERE TOKEN = @TOKEN AND ESTADO = 1
      `);

    if (sessionCheck.recordset.length === 0) {
      logger.warn(
        `No se encontró sesión activa para TOKEN: ${tokenValue}, SocketID: ${socket.id}`
      );
      socket.emit("sessionInvalidated", { reason: "no_active_session" });
      socket.disconnect();
      return;
    }

    // Manejo de joinRoom
    socket.on("joinRoom", (roomName) => {
      if (roomName === room) {
        socket.join(roomName);
        logger.info(`Cliente ${socket.id} re-unido a la sala ${roomName}`);
        socket.emit("joinedRoom", { room: roomName });
      } else {
        logger.warn(
          `Cliente ${socket.id} intentó unirse a sala no permitida: ${roomName}`
        );
      }
    });

    // Heartbeat
    let heartbeatFailures = 0;
    const maxHeartbeatFailures = 5;

    socket.on("heartbeat", async (callback) => {
      try {
        logger.info(`Intentando conectar a la base de datos para heartbeat, SocketID: ${socket.id}`);
        const sessionResult = await pool
          .request()
          .input("TOKEN", sql.VarChar(500), tokenValue)
          .input("ID_USUARIO", sql.Int, decoded.id)
          .query(`
            SELECT u.INVALIDATION_COUNTER, s.ESTADO, s.SOCKET_ID
            FROM MAE_USUARIO u
            JOIN MAE_SESIONES s ON u.ID_USUARIO = s.ID_USUARIO
            WHERE s.TOKEN = @TOKEN AND u.ID_USUARIO = @ID_USUARIO
          `);

        if (
          !sessionResult.recordset.length ||
          !sessionResult.recordset[0].ESTADO
        ) {
          logger.warn(
            `Heartbeat: Sesión inválida o expirada para ${socket.id}, Intento ${
              heartbeatFailures + 1
            }/${maxHeartbeatFailures}`
          );
          heartbeatFailures++;
          callback({ valid: false });
          if (heartbeatFailures >= maxHeartbeatFailures) {
            socket.emit("sessionInvalidated", { reason: "session_expired" });
            socket.disconnect();
            logger.info(`Cliente ${socket.id} desconectado por fallos en heartbeat`);
          }
          return;
        }

        const session = sessionResult.recordset[0];
        if (session.INVALIDATION_COUNTER !== decoded.invalidationCounter) {
          logger.warn(
            `Heartbeat: Contador de invalidación no coincide para ${
              socket.id
            }. DB=${session.INVALIDATION_COUNTER}, Token=${
              decoded.invalidationCounter
            }, Intento ${heartbeatFailures + 1}/${maxHeartbeatFailures}`
          );
          heartbeatFailures++;
          callback({ valid: false });
          if (heartbeatFailures >= maxHeartbeatFailures) {
            socket.emit("sessionInvalidated", { reason: "invalidation_counter_mismatch" });
            socket.disconnect();
            logger.info(`Cliente ${socket.id} desconectado por fallos en heartbeat`);
          }
          return;
        }

        if (session.SOCKET_ID !== socket.id) {
          await pool
            .request()
            .input("TOKEN", sql.VarChar(500), tokenValue)
            .input("SOCKET_ID", sql.VarChar(100), socket.id)
            .query(`
              UPDATE MAE_SESIONES
              SET SOCKET_ID = @SOCKET_ID
              WHERE TOKEN = @TOKEN AND ESTADO = 1
            `);
          logger.info(`SOCKET_ID actualizado a ${socket.id} durante heartbeat`);
        }

        heartbeatFailures = 0;
        callback({ valid: true });
        logger.debug(`Heartbeat exitoso para ${socket.id}`);
      } catch (error) {
        logger.error(
          `Error en heartbeat para ${socket.id}: ${error.message}, Intento ${
            heartbeatFailures + 1
          }/${maxHeartbeatFailures}`
        );
        heartbeatFailures++;
        callback({ valid: false });
        if (heartbeatFailures >= maxHeartbeatFailures) {
          socket.emit("sessionInvalidated", { reason: "server_error" });
          socket.disconnect();
          logger.info(`Cliente ${socket.id} desconectado por fallos en heartbeat`);
        }
      }
    });

    socket.on("disconnect", async (reason) => {
      logger.info(`Cliente desconectado: ${socket.id}, motivo: ${reason}`);
      const socketsInRoom = io.sockets.adapter.rooms.get(room);
      logger.debug(
        `Clientes restantes en la sala ${room}: ${
          socketsInRoom ? socketsInRoom.size : 0
        }`
      );

      // Verificar la sesión inmediatamente antes de programar la limpieza
      const sessionCheck = await pool
        .request()
        .input("SOCKET_ID", sql.VarChar(100), socket.id)
        .input("TOKEN", sql.VarChar(500), tokenValue)
        .query(`
          SELECT SOCKET_ID, ESTADO
          FROM MAE_SESIONES
          WHERE SOCKET_ID = @SOCKET_ID AND TOKEN = @TOKEN AND ESTADO = 1
        `);

      if (!sessionCheck.recordset.length) {
        logger.info(
          `SOCKET_ID ${socket.id} no requiere limpieza: sesión ya inactiva o no encontrada`
        );
        return;
      }

      // Programar limpieza con retraso
      setTimeout(async () => {
        try {
          const activeSessionCheck = await pool
            .request()
            .input("SOCKET_ID", sql.VarChar(100), socket.id)
            .input("TOKEN", sql.VarChar(500), tokenValue)
            .query(`
              SELECT SOCKET_ID, ESTADO
              FROM MAE_SESIONES
              WHERE SOCKET_ID = @SOCKET_ID AND TOKEN = @TOKEN AND ESTADO = 1
            `);

          if (
            !activeSessionCheck.recordset.length ||
            activeSessionCheck.recordset[0].ESTADO === 0
          ) {
            logger.info(
              `SOCKET_ID ${socket.id} no limpiado: sesión ya inactiva o no encontrada`
            );
            return;
          }

          await pool
            .request()
            .input("SOCKET_ID", sql.VarChar(100), socket.id)
            .input("TOKEN", sql.VarChar(500), tokenValue)
            .query(`
              UPDATE MAE_SESIONES
              SET SOCKET_ID = NULL
              WHERE SOCKET_ID = @SOCKET_ID AND TOKEN = @TOKEN AND ESTADO = 1
            `);
          logger.info(
            `SOCKET_ID ${socket.id} limpiado de MAE_SESIONES tras 60 segundos`
          );
        } catch (error) {
          logger.error(
            `Error al limpiar SOCKET_ID ${socket.id}: ${error.message}`
          );
        }
      }, 60000);
    });
  } catch (error) {
    logger.error(
      `🔥 Error al autenticar Socket.IO: ${error.message}, SocketID=${socket.id}`
    );
    socket.disconnect();
  }
});

app.set("io", io);

setInterval(() => checkForUpdates(io), 5000);

app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}, Stack: ${err.stack}`);
  res.status(500).json({ message: "Error del servidor", error: err.message });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, "0.0.0.0", () => {
  logger.info(`✅ Server running on port ${PORT}`);
});