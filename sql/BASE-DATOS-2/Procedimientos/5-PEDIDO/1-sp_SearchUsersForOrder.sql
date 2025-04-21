-- Procedimiento para buscar usuarios o departamentos
CREATE OR ALTER PROCEDURE sp_SearchUsersForOrder
    @UserId INT,
    @Criteria VARCHAR(20),
    @Query VARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    -- Validar usuario
    IF NOT EXISTS (
        SELECT 1 
        FROM MAE_USUARIO 
        WHERE ID_USUARIO = @UserId AND ESTADO = 1
    )
    BEGIN
        THROW 50001, 'Usuario no autorizado', 1;
        RETURN;
    END

    IF @Criteria = 'department'
    BEGIN
        -- Devolver departamentos y sus usuarios asociados
        SELECT DISTINCT 
            ud.NRO_DPTO,
            JSON_QUERY((
                SELECT 
                    u.ID_USUARIO,
                    u.NOMBRES,
                    u.APELLIDOS,
                    u.DNI,
                    ud2.NRO_DPTO
                FROM MAE_USUARIO u
                JOIN MAE_USUARIO_DEPARTAMENTO ud2 ON u.ID_USUARIO = ud2.ID_USUARIO
                WHERE ud2.NRO_DPTO = ud.NRO_DPTO AND ud2.ESTADO = 1 AND u.ESTADO = 1
                FOR JSON PATH
            )) AS USUARIOS
        FROM MAE_USUARIO_DEPARTAMENTO ud
        WHERE ud.ESTADO = 1
        ORDER BY ud.NRO_DPTO;
    END
    ELSE IF @Criteria = 'name'
    BEGIN
        SELECT 
            u.ID_USUARIO,
            u.NOMBRES,
            u.APELLIDOS,
            u.DNI,
            ud.NRO_DPTO
        FROM MAE_USUARIO u
        LEFT JOIN MAE_USUARIO_DEPARTAMENTO ud ON u.ID_USUARIO = ud.ID_USUARIO
        WHERE u.ESTADO = 1
            AND (u.NOMBRES + ' ' + u.APELLIDOS LIKE '%' + @Query + '%')
        ORDER BY u.NOMBRES, u.APELLIDOS;
    END
    ELSE IF @Criteria = 'dni'
    BEGIN
        SELECT 
            u.ID_USUARIO,
            u.NOMBRES,
            u.APELLIDOS,
            u.DNI,
            ud.NRO_DPTO
        FROM MAE_USUARIO u
        LEFT JOIN MAE_USUARIO_DEPARTAMENTO ud ON u.ID_USUARIO = ud.ID_USUARIO
        WHERE u.ESTADO = 1
            AND u.DNI LIKE '%' + @Query + '%'
        ORDER BY u.DNI;
    END
    ELSE
    BEGIN
        THROW 50002, 'Criterio de búsqueda inválido', 1;
    END
END;
GO