const jwt = require('jsonwebtoken');
const { poolPromise } = require('../config/db');

const authMiddleware = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const pool = await poolPromise;

        // Buscar el usuario en MAE_USUARIO
        const result = await pool.request()
            .input('id', decoded.id)
            .query(`
                SELECT u.*, t.DETALLE_USUARIO AS role
                FROM MAE_USUARIO u
                JOIN MAE_TIPO_USUARIO t ON u.ID_TIPO_USUARIO = t.ID_TIPO_USUARIO
                WHERE u.ID_USUARIO = @id AND u.ESTADO = 1
            `);

        const user = result.recordset[0];

        if (!user) {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }

        req.user = { id: user.ID_USUARIO, email: user.CORREO, role: user.role };
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(401).json({ message: 'Invalid or expired token' });
    }
};

module.exports = authMiddleware;