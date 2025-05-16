--########################################################
--EXEC SP_LISTAR_PERSONAS
CREATE OR ALTER PROCEDURE SP_LISTAR_PERSONAS
    @MOSTRAR_ACTIVOS BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        SELECT 
            p.ID_PERSONA,
            p.NOMBRES,
            p.APELLIDOS,
            p.DNI,
            p.CORREO,
            p.CELULAR,
            p.FECHA_NACIMIENTO,
            s.DESCRIPCION AS SEXO,
            pr.DETALLE_PERFIL,
            ISNULL(u.ESTADO, 0) AS ACCESO_SISTEMA,
            p.ESTADO,
            CASE WHEN EXISTS (
                SELECT 1 
                FROM MAE_PERSONA_FOTO pf 
                WHERE pf.ID_PERSONA = p.ID_PERSONA AND pf.ESTADO = 1
            ) THEN 1 ELSE 0 END AS TIENE_FOTO,
            STRING_AGG(f.NOMBRE, ', ') AS FASES_RESIDENTE,
            STRING_AGG(fw.NOMBRE, ', ') AS FASES_TRABAJADOR,
            STRING_AGG(d.DESCRIPCION, ', ') AS DEPARTAMENTOS
        FROM MAE_PERSONA p
        LEFT JOIN MAE_SEXO s ON p.ID_SEXO = s.ID_SEXO
        LEFT JOIN MAE_PERFIL pr ON p.ID_PERFIL = pr.ID_PERFIL
        LEFT JOIN MAE_USUARIO u ON p.ID_PERSONA = u.ID_PERSONA
        LEFT JOIN MAE_RESIDENTE r ON p.ID_PERSONA = r.ID_PERSONA
        LEFT JOIN MAE_DEPARTAMENTO d ON r.ID_DEPARTAMENTO = d.ID_DEPARTAMENTO
        LEFT JOIN MAE_FASE f ON d.ID_FASE = f.ID_FASE
        LEFT JOIN MAE_TRABAJADOR_FASE w ON p.ID_PERSONA = w.ID_TRABAJADOR
        LEFT JOIN MAE_FASE fw ON w.ID_FASE = fw.ID_FASE
        WHERE p.ESTADO = @MOSTRAR_ACTIVOS
        GROUP BY 
            p.ID_PERSONA,
            p.NOMBRES,
            p.APELLIDOS,
            p.DNI,
            p.CORREO,
            p.CELULAR,
            p.FECHA_NACIMIENTO,
            s.DESCRIPCION,
            pr.DETALLE_PERFIL,
            u.ESTADO,
            p.ESTADO;
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        RAISERROR (@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH;
END;
GO
--########################################################
--EXEC SP_OBTENER_PERSONA_DETALLE @ID_PERSONA = 1
CREATE OR ALTER PROCEDURE SP_OBTENER_PERSONA_DETALLE
    @ID_PERSONA INT
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- Información básica
        SELECT 
            p.ID_PERSONA,
            p.NOMBRES,
            p.APELLIDOS,
            p.DNI,
            p.CORREO,
            p.CELULAR,
            p.CONTACTO_EMERGENCIA,
            p.FECHA_NACIMIENTO,
            s.DESCRIPCION AS SEXO,
            pr.DETALLE_PERFIL,
            p.ID_PERFIL,
            p.ID_SEXO,
            ISNULL(u.ESTADO, 0) AS ACCESO_SISTEMA,
            u.USUARIO,
            u.ID_USUARIO,
            pf.FOTO,
            pf.FORMATO
        FROM MAE_PERSONA p
        LEFT JOIN MAE_SEXO s ON p.ID_SEXO = s.ID_SEXO
        LEFT JOIN MAE_PERFIL pr ON p.ID_PERFIL = pr.ID_PERFIL
        LEFT JOIN MAE_USUARIO u ON p.ID_PERSONA = u.ID_PERSONA
        LEFT JOIN MAE_PERSONA_FOTO pf ON p.ID_PERSONA = pf.ID_PERSONA AND pf.ESTADO = 1
        WHERE p.ID_PERSONA = @ID_PERSONA;

        -- Información de residente
        SELECT 
            r.ID_RESIDENTE,
            r.ID_DEPARTAMENTO,
            d.NRO_DPTO,
            d.DESCRIPCION AS DEPARTAMENTO_DESCRIPCION,
            f.NOMBRE AS FASE,
            r.ID_CLASIFICACION,
            tr.DETALLE_CLASIFICACION,
            r.INICIO_RESIDENCIA
        FROM MAE_RESIDENTE r
        JOIN MAE_DEPARTAMENTO d ON r.ID_DEPARTAMENTO = d.ID_DEPARTAMENTO
        JOIN MAE_FASE f ON d.ID_FASE = f.ID_FASE
        JOIN MAE_TIPO_RESIDENTE tr ON r.ID_CLASIFICACION = tr.ID_CLASIFICACION
        WHERE r.ID_PERSONA = @ID_PERSONA AND r.ESTADO = 1;

        -- Información de trabajador
        SELECT 
            t.ID_TRABAJADOR,
            t.ID_FASE,
            f.NOMBRE AS FASE,
            t.FECHA_ASIGNACION
        FROM MAE_TRABAJADOR_FASE t
        JOIN MAE_FASE f ON t.ID_FASE = f.ID_FASE
        WHERE t.ID_TRABAJADOR = @ID_PERSONA AND t.ESTADO = 1;

        -- Roles del usuario
        SELECT 
            r.ID_ROL,
            r.DETALLE_USUARIO
        FROM MAE_USUARIO_ROL ur
        JOIN MAE_TIPO_USUARIO r ON ur.ID_ROL = r.ID_ROL
        JOIN MAE_USUARIO u ON ur.ID_USUARIO = u.ID_USUARIO
        WHERE u.ID_PERSONA = @ID_PERSONA;
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();

        RAISERROR (@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH;
END;
GO
--########################################################
CREATE OR ALTER PROCEDURE SP_ACTUALIZAR_PERSONA
    @ID_PERSONA INT,
    @NOMBRES VARCHAR(50),
    @APELLIDOS VARCHAR(50),
    @DNI VARCHAR(12),
    @CORREO VARCHAR(100),
    @CELULAR VARCHAR(9),
    @CONTACTO_EMERGENCIA VARCHAR(9),
    @FECHA_NACIMIENTO DATE,
    @ID_SEXO INT,
    @ID_PERFIL INT,
    @DEPARTAMENTOS NVARCHAR(MAX),
    @ID_CLASIFICACION INT,
    @INICIO_RESIDENCIA VARCHAR(10),
    @FASES_TRABAJADOR NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        -- Actualizar MAE_PERSONA
        UPDATE MAE_PERSONA
        SET 
            NOMBRES = @NOMBRES,
            APELLIDOS = @APELLIDOS,
            DNI = @DNI,
            CORREO = @CORREO,
            CELULAR = @CELULAR,
            CONTACTO_EMERGENCIA = @CONTACTO_EMERGENCIA,
            FECHA_NACIMIENTO = @FECHA_NACIMIENTO,
            ID_SEXO = @ID_SEXO,
            ID_PERFIL = @ID_PERFIL
        WHERE ID_PERSONA = @ID_PERSONA;

        -- Manejar MAE_RESIDENTE
        DELETE FROM MAE_RESIDENTE WHERE ID_PERSONA = @ID_PERSONA;
        IF @ID_PERFIL = 1 AND @DEPARTAMENTOS IS NOT NULL -- Perfil Residente
        BEGIN
            INSERT INTO MAE_RESIDENTE (ID_PERSONA, ID_DEPARTAMENTO, ID_CLASIFICACION, INICIO_RESIDENCIA, ESTADO)
            SELECT 
                @ID_PERSONA,
                value,
                @ID_CLASIFICACION,
                @INICIO_RESIDENCIA,
                1
            FROM OPENJSON(@DEPARTAMENTOS);
        END;

        -- Manejar MAE_TRABAJADOR_FASE
        DELETE FROM MAE_TRABAJADOR_FASE WHERE ID_TRABAJADOR = @ID_PERSONA;
        IF @ID_PERFIL IN (2, 3, 4) AND @FASES_TRABAJADOR IS NOT NULL -- Perfil Seguridad, Limpieza, Administrador
        BEGIN
            INSERT INTO MAE_TRABAJADOR_FASE (ID_TRABAJADOR, ID_FASE, FECHA_ASIGNACION, ESTADO)
            SELECT 
                @ID_PERSONA,
                value,
                GETDATE(),
                1
            FROM OPENJSON(@FASES_TRABAJADOR);
        END;

        COMMIT TRANSACTION;
        SELECT 'Persona actualizada exitosamente' AS MENSAJE;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        RAISERROR (@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH;
END;
GO
--########################################################
CREATE OR ALTER PROCEDURE SP_ELIMINAR_PERSONA
    @ID_PERSONA INT
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        BEGIN TRANSACTION;

        -- Actualizar estado en MAE_USUARIO_ROL (desactivar roles)
		DELETE FROM MAE_USUARIO_ROL
		WHERE ID_USUARIO IN (
			SELECT ID_USUARIO
			FROM MAE_USUARIO
			WHERE ID_PERSONA = @ID_PERSONA
		)

        -- Actualizar estado en MAE_USUARIO
        UPDATE MAE_USUARIO
        SET ESTADO = 0
        WHERE ID_PERSONA = @ID_PERSONA;

        -- Actualizar estado en MAE_RESIDENTE
        UPDATE MAE_RESIDENTE
        SET ESTADO = 0
        WHERE ID_PERSONA = @ID_PERSONA;

        -- Actualizar estado en MAE_TRABAJADOR_FASE
        UPDATE MAE_TRABAJADOR_FASE
        SET ESTADO = 0
        WHERE ID_TRABAJADOR = @ID_PERSONA;

        -- Actualizar estado en MAE_PERSONA
        UPDATE MAE_PERSONA
        SET ESTADO = 0
        WHERE ID_PERSONA = @ID_PERSONA;

        COMMIT TRANSACTION;
        SELECT 'Persona desactivada exitosamente' AS MENSAJE;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();

        RAISERROR (@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH;
END;
GO
--########################################################
CREATE OR ALTER PROCEDURE SP_ACTIVAR_ACCESO_SISTEMA
  @ID_PERSONA INT,
  @USUARIO VARCHAR(50),
  @CONTRASENA_HASH VARCHAR(255),
  @CONTRASENA_SALT VARCHAR(50),
  @ROLES NVARCHAR(MAX)
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @ID_USUARIO INT;

  -- Verificar si el usuario ya existe
  SELECT @ID_USUARIO = ID_USUARIO FROM MAE_USUARIO WHERE ID_PERSONA = @ID_PERSONA;

  IF @ID_USUARIO IS NULL
  BEGIN
    -- Crear nuevo usuario
    INSERT INTO MAE_USUARIO (
      ID_PERSONA, USUARIO, CONTRASENA_HASH, CONTRASENA_SALT, ESTADO, PRIMER_INICIO
    )
    VALUES (
      @ID_PERSONA, @USUARIO, @CONTRASENA_HASH, @CONTRASENA_SALT, 1, 1
    );

    SET @ID_USUARIO = SCOPE_IDENTITY();
  END
  ELSE
  BEGIN
    -- Reactivar usuario existente
    UPDATE MAE_USUARIO
    SET USUARIO = @USUARIO,
        CONTRASENA_HASH = @CONTRASENA_HASH,
        CONTRASENA_SALT = @CONTRASENA_SALT,
        ESTADO = 1,
        PRIMER_INICIO = 1
    WHERE ID_USUARIO = @ID_USUARIO;

    -- Limpiar roles anteriores
    DELETE FROM MAE_USUARIO_ROL WHERE ID_USUARIO = @ID_USUARIO;
  END

  -- Insertar nuevos roles
  IF @ROLES IS NOT NULL
  BEGIN
    DECLARE @json TABLE (ID_ROL INT);
    INSERT INTO @json (ID_ROL)
    SELECT value FROM OPENJSON(@ROLES);

    INSERT INTO MAE_USUARIO_ROL (ID_USUARIO, ID_ROL)
    SELECT @ID_USUARIO, ID_ROL FROM @json;
  END
END;
GO

--########################################################
CREATE OR ALTER PROCEDURE SP_QUITAR_ACCESO_SISTEMA
  @ID_PERSONA INT
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @ID_USUARIO INT;

  SELECT @ID_USUARIO = ID_USUARIO
  FROM MAE_USUARIO
  WHERE ID_PERSONA = @ID_PERSONA;

  IF @ID_USUARIO IS NOT NULL
  BEGIN
    -- Eliminar roles
    DELETE FROM MAE_USUARIO_ROL WHERE ID_USUARIO = @ID_USUARIO;

    -- Desactivar usuario con valores vacíos en contraseña
    UPDATE MAE_USUARIO
    SET ESTADO = 0,
        CONTRASENA_HASH = '',
        CONTRASENA_SALT = '',
        PRIMER_INICIO = 1
    WHERE ID_USUARIO = @ID_USUARIO;
  END
END;
GO
--########################################################
CREATE OR ALTER PROCEDURE SP_GESTIONAR_ROLES
    @ID_USUARIO INT,
    @ROLES NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        -- Validar que el JSON sea correcto y contenga al menos un rol válido
        IF ISJSON(@ROLES) = 1 AND EXISTS (
            SELECT 1
            FROM OPENJSON(@ROLES) AS r
            WHERE TRY_CAST(r.[value] AS INT) IN (
                SELECT ID_ROL FROM MAE_TIPO_USUARIO WHERE ESTADO = 1
            )
        )
        BEGIN
            -- Eliminar roles existentes
            DELETE FROM MAE_USUARIO_ROL
            WHERE ID_USUARIO = @ID_USUARIO;

            -- Insertar nuevos roles válidos
            INSERT INTO MAE_USUARIO_ROL (ID_USUARIO, ID_ROL)
            SELECT @ID_USUARIO, TRY_CAST([value] AS INT)
            FROM OPENJSON(@ROLES)
            WHERE TRY_CAST([value] AS INT) IN (
                SELECT ID_ROL FROM MAE_TIPO_USUARIO WHERE ESTADO = 1
            );

            -- Activar el usuario
            UPDATE MAE_USUARIO
            SET ESTADO = 1,
                PRIMER_INICIO = 1
            WHERE ID_USUARIO = @ID_USUARIO;
        END
        ELSE
        BEGIN
            THROW 50000, 'No se recibieron roles válidos. No se aplicaron cambios.', 1;
        END
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END;
GO
--########################################################

CREATE OR ALTER PROCEDURE SP_SUBIR_FOTO_PERSONA
    @ID_PERSONA INT,
    @FOTO VARBINARY(MAX),
    @FORMATO VARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- Verificar si ya existe una foto activa para la persona
        IF EXISTS (
            SELECT 1
            FROM MAE_PERSONA_FOTO
            WHERE ID_PERSONA = @ID_PERSONA AND ESTADO = 1
        )
        BEGIN
            -- Actualizar la foto existente
            UPDATE MAE_PERSONA_FOTO
            SET 
                FOTO = @FOTO,
                FORMATO = @FORMATO,
                FECHA_SUBIDA = GETDATE()
            WHERE ID_PERSONA = @ID_PERSONA AND ESTADO = 1;
        END
        ELSE
        BEGIN
            -- Insertar una nueva foto
            INSERT INTO MAE_PERSONA_FOTO (ID_PERSONA, FOTO, FORMATO, FECHA_SUBIDA, ESTADO)
            VALUES (@ID_PERSONA, @FOTO, @FORMATO, GETDATE(), 1);
        END;

        SELECT 'Foto subida exitosamente' AS MENSAJE;
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();

        RAISERROR (@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH;
END;
GO
--########################################################
ALTER PROCEDURE SP_OBTENER_FOTO_PERSONA
    @ID_PERSONA INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT FOTO, FORMATO
    FROM MAE_PERSONA_FOTO
    WHERE ID_PERSONA = @ID_PERSONA AND ESTADO = 1;
END;
GO
--########################################################
CREATE OR ALTER PROCEDURE SP_ELIMINAR_FOTO_PERSONA
    @ID_PERSONA INT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        DELETE FROM MAE_PERSONA_FOTO
        WHERE ID_PERSONA = @ID_PERSONA AND ESTADO = 1;

        SELECT 'Foto eliminada exitosamente' AS MENSAJE;
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        RAISERROR (@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH;
END;
GO

--########################################################
ALTER PROCEDURE SP_ACTUALIZAR_CONTRASEÑA
    @ID_USUARIO INT,
    @CONTRASENA_HASH VARCHAR(255),
    @CONTRASENA_SALT VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        UPDATE MAE_USUARIO
        SET 
            CONTRASENA_HASH = @CONTRASENA_HASH,
            CONTRASENA_SALT = @CONTRASENA_SALT,
            PRIMER_INICIO = 1
        WHERE ID_USUARIO = @ID_USUARIO;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorNumber INT = ERROR_NUMBER();
        THROW @ErrorNumber, @ErrorMessage, 1;
    END CATCH
END;
GO
--########################################################
CREATE OR ALTER PROCEDURE SP_ACTUALIZAR_CORREO_PERSONA
    @ID_PERSONA INT,
    @CORREO VARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        -- Validar que el correo no esté en uso por otra persona
        IF EXISTS (
            SELECT 1
            FROM MAE_PERSONA
            WHERE CORREO = @CORREO
            AND ID_PERSONA != @ID_PERSONA
        )
        BEGIN
            THROW 50001, 'El correo ya está registrado para otra persona.', 1;
            RETURN;
        END

        -- Actualizar correo
        UPDATE MAE_PERSONA
        SET CORREO = @CORREO
        WHERE ID_PERSONA = @ID_PERSONA;

        IF @@ROWCOUNT = 0
        BEGIN
            THROW 50002, 'No se encontró la persona especificada.', 1;
        END
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END;
GO
--########################################################
