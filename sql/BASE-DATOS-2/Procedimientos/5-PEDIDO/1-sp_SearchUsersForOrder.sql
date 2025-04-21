-- Procedimiento para buscar usuarios o departamentos
CREATE OR ALTER PROCEDURE sp_SearchUsersForOrder
    @UserId INT,
    @Criteria VARCHAR(20),
    @Query VARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    -- Validar roles del usuario
    DECLARE @UserRoles TABLE (ID_TIPO_USUARIO INT);
    INSERT INTO @UserRoles (ID_TIPO_USUARIO)
    SELECT ID_TIPO_USUARIO 
    FROM MAE_USUARIO 
    WHERE ID_USUARIO = @UserId AND ESTADO = 1
    UNION ALL
    SELECT ID_TIPO_USUARIO 
    FROM MAE_USUARIO_ROL 
    WHERE ID_USUARIO = @UserId;

    IF NOT EXISTS (SELECT 1 FROM @UserRoles)
    BEGIN
        THROW 50001, 'Usuario no autorizado', 1;
        RETURN;
    END

    IF @Criteria = 'department'
    BEGIN
        SELECT DISTINCT NRO_DPTO
        FROM MAE_USUARIO_DEPARTAMENTO
        WHERE ESTADO = 1
        ORDER BY NRO_DPTO;
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

-- Procedimiento para registrar un encargo
CREATE OR ALTER PROCEDURE sp_RegisterOrder
    @Description VARCHAR(255),
    @UserId INT = NULL,
    @Department INT = NULL,
    @ReceptionistId INT,
    @AuthUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Validar recepcionista
    IF NOT EXISTS (
        SELECT 1 
        FROM MAE_USUARIO 
        WHERE ID_USUARIO = @ReceptionistId AND ESTADO = 1
    )
    BEGIN
        THROW 50003, 'Recepcionista inválido', 1;
        RETURN;
    END

    -- Validar que se proporcione al menos un usuario o departamento
    IF @UserId IS NULL AND @Department IS NULL
    BEGIN
        THROW 50004, 'Debe especificar un usuario o departamento', 1;
        RETURN;
    END

    -- Iniciar transacción
    BEGIN TRY
        BEGIN TRANSACTION;

        -- Tabla para almacenar los usuarios afectados
        DECLARE @AffectedUsers TABLE (
            ID_ENCARGO INT,
            ID_USUARIO INT,
            FECHA_RECEPCION VARCHAR(23)
        );

        IF @Department IS NOT NULL
        BEGIN
            -- Obtener todos los usuarios del departamento
            INSERT INTO MAE_ENCARGO (
                NRO_DPTO,
                DESCRIPCION,
                FECHA_RECEPCION,
                ID_USUARIO_RECEPCION,
                ESTADO
            )
            OUTPUT 
                inserted.ID_ENCARGO,
                (SELECT ID_USUARIO FROM MAE_USUARIO_DEPARTAMENTO WHERE NRO_DPTO = @Department AND ESTADO = 1),
                CONVERT(VARCHAR, inserted.FECHA_RECEPCION, 23)
            INTO @AffectedUsers
            SELECT 
                @Department,
                @Description,
                GETDATE(),
                @ReceptionistId,
                1
            FROM MAE_USUARIO_DEPARTAMENTO
            WHERE NRO_DPTO = @Department AND ESTADO = 1;

            IF NOT EXISTS (SELECT 1 FROM @AffectedUsers)
            BEGIN
                THROW 50005, 'No se encontraron usuarios en el departamento especificado', 1;
            END
        END
        ELSE
        BEGIN
            -- Registrar encargo para un solo usuario
            DECLARE @NroDpto INT;
            SELECT @NroDpto = NRO_DPTO
            FROM MAE_USUARIO_DEPARTAMENTO
            WHERE ID_USUARIO = @UserId AND ESTADO = 1;

            IF @NroDpto IS NULL
            BEGIN
                THROW 50006, 'Usuario no asociado a un departamento', 1;
            END

            INSERT INTO MAE_ENCARGO (
                NRO_DPTO,
                DESCRIPCION,
                FECHA_RECEPCION,
                ID_USUARIO_RECEPCION,
                ESTADO
            )
            OUTPUT 
                inserted.ID_ENCARGO,
                @UserId,
                CONVERT(VARCHAR, inserted.FECHA_RECEPCION, 23)
            INTO @AffectedUsers
            VALUES (
                @NroDpto,
                @Description,
                GETDATE(),
                @ReceptionistId,
                1
            );
        END

        -- Registrar log de cambio para WebSocket
        INSERT INTO MAE_CAMBIO_LOG (TIPO, FECHA_CAMBIO, PROCESADO)
        VALUES ('encargos', GETDATE(), 0);

        -- Devolver usuarios afectados
        SELECT 
            ID_ENCARGO,
            ID_USUARIO,
            FECHA_RECEPCION
        FROM @AffectedUsers;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        THROW @ErrorSeverity, @ErrorMessage, @ErrorState;
    END CATCH
END;
GO

-- Procedimiento para marcar un encargo como entregado
CREATE OR ALTER PROCEDURE sp_MarkOrderDelivered
    @OrderId INT,
    @UserId INT,
    @AuthUserId INT
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
        THROW 50007, 'Usuario inválido', 1;
        RETURN;
    END

    -- Validar encargo
    IF NOT EXISTS (
        SELECT 1 
        FROM MAE_ENCARGO 
        WHERE ID_ENCARGO = @OrderId AND ESTADO = 1
    )
    BEGIN
        THROW 50008, 'Encargo no encontrado o ya entregado', 1;
        RETURN;
    END

    -- Iniciar transacción
    BEGIN TRY
        BEGIN TRANSACTION;

        -- Tabla para almacenar los usuarios afectados
        DECLARE @AffectedUsers TABLE (
            ID_ENCARGO INT,
            ID_USUARIO INT,
            DESCRIPCION VARCHAR(255),
            FECHA_RECEPCION VARCHAR(23)
        );

        -- Actualizar encargo
        UPDATE MAE_ENCARGO
        SET 
            FECHA_ENTREGA = GETDATE(),
            ID_USUARIO_ENTREGA = @UserId,
            ESTADO = 0
        OUTPUT 
            inserted.ID_ENCARGO,
            (SELECT ID_USUARIO FROM MAE_USUARIO_DEPARTAMENTO WHERE NRO_DPTO = inserted.NRO_DPTO AND ESTADO = 1),
            inserted.DESCRIPCION,
            CONVERT(VARCHAR, inserted.FECHA_RECEPCION, 23)
        INTO @AffectedUsers
        WHERE ID_ENCARGO = @OrderId;

        -- Registrar log de cambio para WebSocket
        INSERT INTO MAE_CAMBIO_LOG (TIPO, FECHA_CAMBIO, PROCESADO)
        VALUES ('encargos', GETDATE(), 0);

        -- Devolver usuarios afectados
        SELECT 
            ID_ENCARGO,
            ID_USUARIO,
            DESCRIPCION,
            FECHA_RECEPCION
        FROM @AffectedUsers;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        THROW @ErrorSeverity, @ErrorMessage, @ErrorState;
    END CATCH
END;
GO
