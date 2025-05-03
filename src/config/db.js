const sql = require('mssql');
require('dotenv').config();

const authMode = process.env.AUTH_MODE;  // Leemos el valor de AUTH_MODE

// Configuración base común
const dbConfig = {
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT, 10),
    options: {
        encrypt: true, // Usar cifrado (recomendado para conexiones seguras)
        trustServerCertificate: true // Para desarrollo local y certificados no confiables
    }
};

// Si AUTH_MODE es 1, usamos autenticación de SQL Server (usuario y contraseña)
if (authMode === '1') {
    dbConfig.user = process.env.DB_USER;
    dbConfig.password = process.env.DB_PASSWORD;
} 
// Si AUTH_MODE es 2, usamos autenticación de Windows
else if (authMode === '2') {
    dbConfig.authentication = {
        type: 'ntlm',  // Usamos NTLM para autenticación de Windows
        options: {
            userName: process.env.DB_USER,    // 'Natalie' (usuario de Windows)
            password: process.env.DB_PASSWORD,  // Contraseña de 'Natalie'
            domain: process.env.DB_DOMAIN     // Dominio (DESKTOP-K2A8K17)
        }
    };
}

// Crear un pool de conexión
const poolPromise = new sql.ConnectionPool(dbConfig)
    .connect()
    .then(pool => {
        console.log('Conectado a SQL Server');
        return pool;
    })
    .catch(err => {
        console.error('Conexión a la base de datos fallida:', err);
        process.exit(1);
    });

module.exports = { poolPromise, sql };
