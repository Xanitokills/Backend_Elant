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

    -- Validar que el usuario pertenece al departamento del encargo
    DECLARE @NroDpto INT;
    SELECT @NroDpto = NRO_DPTO
    FROM MAE_ENCARGO
    WHERE ID_ENCARGO = @OrderId;

    IF NOT EXISTS (
        SELECT 1
        FROM MAE_USUARIO_DEPARTAMENTO
        WHERE ID_USUARIO = @UserId AND NRO_DPTO = @NroDpto AND ESTADO = 1
    )
    BEGIN
        THROW 50009, 'El usuario no pertenece al departamento del encargo', 1;
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

        -- Tabla temporal para capturar los datos del encargo
        DECLARE @EncargoData TABLE (
            ID_ENCARGO INT,
            NRO_DPTO INT,
            DESCRIPCION VARCHAR(255),
            FECHA_RECEPCION DATETIME
        );

        -- Actualizar encargo y capturar datos
        UPDATE MAE_ENCARGO
        SET 
            FECHA_ENTREGA = GETDATE(),
            ID_USUARIO_ENTREGA = @UserId,
            ESTADO = 0
        OUTPUT 
            inserted.ID_ENCARGO,
            inserted.NRO_DPTO,
            inserted.DESCRIPCION,
            inserted.FECHA_RECEPCION
        INTO @EncargoData
        WHERE ID_ENCARGO = @OrderId;

        -- Insertar los usuarios afectados en @AffectedUsers
        INSERT INTO @AffectedUsers (ID_ENCARGO, ID_USUARIO, DESCRIPCION, FECHA_RECEPCION)
        SELECT 
            ed.ID_ENCARGO,
            ud.ID_USUARIO,
            ed.DESCRIPCION,
            CONVERT(VARCHAR, ed.FECHA_RECEPCION, 23)
        FROM @EncargoData ed
        JOIN MAE_USUARIO_DEPARTAMENTO ud ON ud.NRO_DPTO = ed.NRO_DPTO
        WHERE ud.ESTADO = 1;

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