CREATE OR ALTER PROCEDURE SP_REGISTRAR_PERSONA
    @NOMBRES VARCHAR(50),
    @APELLIDOS VARCHAR(50),
    @DNI VARCHAR(12),
    @CORREO VARCHAR(100) = NULL,
    @CELULAR VARCHAR(9) = NULL,
    @CONTACTO_EMERGENCIA VARCHAR(9) = NULL,
    @FECHA_NACIMIENTO DATE,
    @ID_SEXO INT,
    @ID_PERFIL INT,
    @DEPARTAMENTOS VARCHAR(MAX) = NULL, -- Lista de ID_DEPARTAMENTO en formato JSON
    @ID_CLASIFICACION INT = NULL,
    @INICIO_RESIDENCIA VARCHAR(10) = NULL, -- Formato DD/MM/YYYY
    @FASES_TRABAJADOR VARCHAR(MAX) = NULL, -- Lista de ID_FASE en formato JSON
    @USUARIO VARCHAR(50) = NULL,
    @CONTRASENA_HASH VARCHAR(255) = NULL, -- Recibimos el hash ya generado
    @CONTRASENA_SALT VARCHAR(50) = NULL, -- Recibimos el SALT ya generado
    @ROLES VARCHAR(MAX) = NULL, -- Lista de ID_ROL en formato JSON
    @ID_PERSONA_OUT INT OUTPUT,
    @ID_USUARIO_OUT INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        -- Validaciones existentes (sin cambios)
        IF @NOMBRES IS NULL OR @APELLIDOS IS NULL OR @DNI IS NULL OR 
           @FECHA_NACIMIENTO IS NULL OR @ID_SEXO IS NULL OR @ID_PERFIL IS NULL
            THROW 50001, 'Los campos NOMBRES, APELLIDOS, DNI, FECHA_NACIMIENTO, ID_SEXO e ID_PERFIL son obligatorios.', 1;

        IF LEN(@DNI) != 8 OR @DNI NOT LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
            THROW 50002, 'El DNI debe tener exactamente 8 dígitos.', 1;

        IF EXISTS (SELECT 1 FROM MAE_PERSONA WHERE DNI = @DNI AND ESTADO = 1)
            THROW 50003, 'El DNI ya está registrado.', 1;

        IF @CORREO IS NOT NULL AND EXISTS (SELECT 1 FROM MAE_PERSONA WHERE CORREO = @CORREO AND ESTADO = 1)
            THROW 50004, 'El correo ya está registrado.', 1;

        IF @CELULAR IS NOT NULL AND @CELULAR NOT LIKE '9[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
            THROW 50005, 'El celular debe comenzar con 9 y tener 9 dígitos.', 1;

        IF @CONTACTO_EMERGENCIA IS NOT NULL AND @CONTACTO_EMERGENCIA NOT LIKE '9[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
            THROW 50006, 'El contacto de emergencia debe comenzar con 9 y tener 9 dígitos.', 1;

        -- Calcular edad
        DECLARE @AGE INT;
        SET @AGE = DATEDIFF(YEAR, @FECHA_NACIMIENTO, GETDATE());
        IF DATEADD(YEAR, @AGE, @FECHA_NACIMIENTO) > GETDATE()
            SET @AGE = @AGE - 1;

        IF @AGE < 18 AND @CONTACTO_EMERGENCIA IS NULL
            THROW 50007, 'El contacto de emergencia es obligatorio para menores de edad.', 1;

        IF @AGE >= 18 AND @CELULAR IS NULL
            THROW 50008, 'El celular es obligatorio para mayores de edad.', 1;

        IF @ID_PERFIL = 1 AND (@DEPARTAMENTOS IS NULL OR @ID_CLASIFICACION IS NULL OR @INICIO_RESIDENCIA IS NULL)
            THROW 50009, 'DEPARTAMENTOS, ID_CLASIFICACION e INICIO_RESIDENCIA son obligatorios para el perfil Residente.', 1;

        IF @ID_PERFIL = 1 AND @INICIO_RESIDENCIA NOT LIKE '[0-3][0-9]/[0-1][0-9]/[0-2][0-9][0-9][0-9]'
            THROW 50010, 'El formato de INICIO_RESIDENCIA debe ser DD/MM/YYYY.', 1;

        IF @ID_PERFIL != 1 AND @FASES_TRABAJADOR IS NULL
            THROW 50011, 'FASES_TRABAJADOR es obligatorio para perfiles de trabajador.', 1;

        IF @USUARIO IS NOT NULL AND EXISTS (SELECT 1 FROM MAE_USUARIO WHERE USUARIO = @USUARIO AND ESTADO = 1)
            THROW 50012, 'El usuario ya está registrado.', 1;

        IF @USUARIO IS NOT NULL AND (@CORREO IS NULL OR @CONTRASENA_HASH IS NULL OR @CONTRASENA_SALT IS NULL)
            THROW 50013, 'El CORREO, CONTRASENA_HASH y CONTRASENA_SALT son obligatorios si se registra un usuario.', 1;

        -- Iniciar transacción
        BEGIN TRANSACTION;

        -- Registrar en MAE_PERSONA
        INSERT INTO MAE_PERSONA (
            NOMBRES, APELLIDOS, DNI, CORREO, CELULAR, CONTACTO_EMERGENCIA,
            FECHA_NACIMIENTO, ID_SEXO, ESTADO, ID_PERFIL
        )
        VALUES (
            UPPER(@NOMBRES), UPPER(@APELLIDOS), @DNI, @CORREO, @CELULAR, @CONTACTO_EMERGENCIA,
            @FECHA_NACIMIENTO, @ID_SEXO, 1, @ID_PERFIL
        );

        SET @ID_PERSONA_OUT = SCOPE_IDENTITY();

        -- Si es Residente, registrar en MAE_RESIDENTE
        IF @ID_PERFIL = 1
        BEGIN
            DECLARE @DepartamentoID INT;
            DECLARE departamentos_cursor CURSOR FOR
                SELECT value FROM OPENJSON(@DEPARTAMENTOS);

            -- Validar duplicados antes de insertar
            DECLARE @Duplicados TABLE (DepartamentoID INT);
            DECLARE @DuplicadoIDs VARCHAR(MAX);

            INSERT INTO @Duplicados (DepartamentoID)
            SELECT value
            FROM OPENJSON(@DEPARTAMENTOS)
            WHERE value IN (
                SELECT ID_DEPARTAMENTO 
                FROM MAE_RESIDENTE 
                WHERE ID_PERSONA = @ID_PERSONA_OUT AND ESTADO = 1
            );

            IF EXISTS (SELECT 1 FROM @Duplicados)
            BEGIN
                SET @DuplicadoIDs = (
                    SELECT STRING_AGG(CAST(DepartamentoID AS VARCHAR), ', ') 
                    FROM @Duplicados
                );
                DECLARE @ErrorMsg NVARCHAR(4000) = 'El residente ya está registrado en los departamentos: ' + ISNULL(@DuplicadoIDs, '');
                THROW 50014, @ErrorMsg, 1;
            END;

            OPEN departamentos_cursor;
            FETCH NEXT FROM departamentos_cursor INTO @DepartamentoID;

            WHILE @@FETCH_STATUS = 0
            BEGIN
                INSERT INTO MAE_RESIDENTE (
                    ID_PERSONA, ID_DEPARTAMENTO, ID_CLASIFICACION, INICIO_RESIDENCIA, ESTADO
                )
                VALUES (
                    @ID_PERSONA_OUT, @DepartamentoID, @ID_CLASIFICACION, 
                    CONVERT(DATE, @INICIO_RESIDENCIA, 103), 1
                );

                FETCH NEXT FROM departamentos_cursor INTO @DepartamentoID;
            END;

            CLOSE departamentos_cursor;
            DEALLOCATE departamentos_cursor;
        END

        -- Si es Trabajador, registrar en MAE_TRABAJADOR_FASE
        IF @ID_PERFIL != 1
        BEGIN
            DECLARE @FaseID INT;
            DECLARE fases_cursor CURSOR FOR
                SELECT value FROM OPENJSON(@FASES_TRABAJADOR);

            OPEN fases_cursor;
            FETCH NEXT FROM fases_cursor INTO @FaseID;

            WHILE @@FETCH_STATUS = 0
            BEGIN
                INSERT INTO MAE_TRABAJADOR_FASE (
                    ID_TRABAJADOR, ID_FASE, FECHA_ASIGNACION, ESTADO
                )
                VALUES (
                    @ID_PERSONA_OUT, @FaseID, GETDATE(), 1
                );

                FETCH NEXT FROM fases_cursor INTO @FaseID;
            END;

            CLOSE fases_cursor;
            DEALLOCATE fases_cursor;
        END

        -- Si se proporciona un usuario, registrar en MAE_USUARIO
        IF @USUARIO IS NOT NULL
        BEGIN
            INSERT INTO MAE_USUARIO (
                USUARIO, CONTRASENA_HASH, CONTRASENA_SALT, ESTADO, PRIMER_INICIO, ID_PERSONA
            )
            VALUES (
                @USUARIO, @CONTRASENA_HASH, @CONTRASENA_SALT, 1, 1, @ID_PERSONA_OUT
            );

            SET @ID_USUARIO_OUT = SCOPE_IDENTITY();

            IF @ROLES IS NOT NULL
            BEGIN
                INSERT INTO MAE_USUARIO_ROL (ID_USUARIO, ID_ROL)
                SELECT @ID_USUARIO_OUT, value
                FROM OPENJSON(@ROLES);
            END
        END

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        RAISERROR (@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END;
GO