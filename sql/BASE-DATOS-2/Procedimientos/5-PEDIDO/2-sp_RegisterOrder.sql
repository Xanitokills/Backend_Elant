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
            -- Obtener los usuarios del departamento
            DECLARE @DepartmentUsers TABLE (
                ID_USUARIO INT
            );

            INSERT INTO @DepartmentUsers (ID_USUARIO)
            SELECT ID_USUARIO
            FROM MAE_USUARIO_DEPARTAMENTO
            WHERE NRO_DPTO = @Department AND ESTADO = 1;

            IF NOT EXISTS (SELECT 1 FROM @DepartmentUsers)
            BEGIN
                THROW 50005, 'No se encontraron usuarios en el departamento especificado', 1;
            END

            -- Insertar el encargo para el departamento
            INSERT INTO MAE_ENCARGO (
                NRO_DPTO,
                DESCRIPCION,
                FECHA_RECEPCION,
                ID_USUARIO_RECEPCION,
                ESTADO
            )
            OUTPUT 
                inserted.ID_ENCARGO,
                inserted.FECHA_RECEPCION
            INTO @AffectedUsers (ID_ENCARGO, FECHA_RECEPCION)
            VALUES (
                @Department,
                @Description,
                GETDATE(),
                @ReceptionistId,
                1
            );

            -- Actualizar @AffectedUsers con los ID_USUARIO del departamento
            UPDATE @AffectedUsers
            SET ID_USUARIO = du.ID_USUARIO
            FROM @AffectedUsers au
            CROSS JOIN @DepartmentUsers du;

            -- Convertir FECHA_RECEPCION a VARCHAR
            UPDATE @AffectedUsers
            SET FECHA_RECEPCION = CONVERT(VARCHAR, FECHA_RECEPCION, 23);
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
                ID_USUARIO_ENTREGA,
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
                @UserId,
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