const { poolPromise } = require('../config/db');

const openDoor = async (req, res) => {
    const { qr_data } = req.body;
    const user = req.user; // From authMiddleware

    if (!qr_data) {
        return res.status(400).json({ message: 'Se requiere el dato del QR' });
    }

    try {
        const pool = await poolPromise;

        // Buscar el código QR
        const qrResult = await pool.request()
            .input('qr_data', qr_data)
            .query('SELECT * FROM MAE_QR WHERE QR_DATA = @qr_data AND ESTADO = 1');

        const qrCode = qrResult.recordset[0];

        if (!qrCode) {
            // Registrar intento fallido con ID_QR como NULL
            await pool.request()
                .input('qr_id', null)
                .input('user_id', user.id)
                .input('success', 0)
                .input('reason', 'Código QR inválido')
                .query(`
                    INSERT INTO MAE_ACCESO_PUERTA (ID_QR, ID_USUARIO, EXITO, MOTIVO_FALLO)
                    VALUES (@qr_id, @user_id, @success, @reason)
                `);
            return res.status(400).json({ message: 'Código QR inválido' });
        }

        // Verificar si el rol del usuario está permitido
        const roleResult = await pool.request()
            .input('id_qr', qrCode.ID_QR)
            .input('role', user.role)
            .query(`
                SELECT COUNT(*) AS allowed
                FROM MAE_QR_TIPO_USUARIO qt
                JOIN MAE_TIPO_USUARIO t ON qt.ID_TIPO_USUARIO = t.ID_TIPO_USUARIO
                WHERE qt.ID_QR = @id_qr AND t.DETALLE_USUARIO = @role AND t.ESTADO = 1
            `);

        const isAllowed = roleResult.recordset[0].allowed > 0;

        if (!isAllowed) {
            // Registrar intento fallido
            await pool.request()
                .input('qr_id', qrCode.ID_QR)
                .input('user_id', user.id)
                .input('success', 0)
                .input('reason', 'Rol no autorizado')
                .query(`
                    INSERT INTO MAE_ACCESO_PUERTA (ID_QR, ID_USUARIO, EXITO, MOTIVO_FALLO)
                    VALUES (@qr_id, @user_id, @success, @reason)
                `);
            return res.status(403).json({ message: 'Acceso denegado: Rol no autorizado' });
        }

        // Registrar intento exitoso
        await pool.request()
            .input('qr_id', qrCode.ID_QR)
            .input('user_id', user.id)
            .input('success', 1)
            .query(`
                INSERT INTO MAE_ACCESO_PUERTA (ID_QR, ID_USUARIO, EXITO)
                VALUES (@qr_id, @user_id, @success)
            `);

        res.status(200).json({ message: `Puerta ${qrCode.ID_PUERTA} abierta exitosamente` });
    } catch (error) {
        console.error('Error al abrir la puerta:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};

module.exports = { openDoor };