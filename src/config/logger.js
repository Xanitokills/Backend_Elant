const winston = require('winston');

// Crear un logger con un archivo de log
const logger = winston.createLogger({
  level: 'info',  // Establece el nivel de log, 'info', 'warn', 'error', etc.
  format: winston.format.combine(
    winston.format.timestamp(),  // Agrega la marca de tiempo
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [
    // Guarda los logs en el archivo 'logs/app.log'
    new winston.transports.File({ filename: 'logs/app.log' }),
    // También puedes configurar para que los logs se muestren en consola
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

module.exports = logger;
