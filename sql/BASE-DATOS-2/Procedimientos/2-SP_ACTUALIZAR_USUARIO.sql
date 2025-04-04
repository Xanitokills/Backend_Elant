ALTER PROCEDURE SP_ACTUALIZAR_USUARIO
    @ID_USUARIO INT,
    @NOMBRES VARCHAR(50),
    @APELLIDOS VARCHAR(50),
    @DNI VARCHAR(8),
    @CORREO VARCHAR(100),
    @CELULAR VARCHAR(9),
    @NRO_DPTO INT,
    @FECHA_NACIMIENTO DATE,
    @ID_TIPO_USUARIO INT,
    @ID_SEXO INT,
    @COMITE BIT,
    @USUARIO VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        -- Validar que el ID exista
        IF NOT EXISTS (SELECT 1 FROM MAE_USUARIO WHERE ID_USUARIO = @ID_USUARIO)
        BEGIN
            RAISERROR('Usuario no encontrado.', 16, 1);
            RETURN;
        END

        -- Validar que el DNI no esté en otro usuario
        IF EXISTS (
            SELECT 1 FROM MAE_USUARIO
            WHERE DNI = @DNI AND ID_USUARIO <> @ID_USUARIO
        )
        BEGIN
            RAISERROR('El DNI ingresado ya pertenece a otro usuario.', 16, 1);
            RETURN;
        END

        -- Validar que el CORREO no esté en otro usuario
        IF EXISTS (
            SELECT 1 FROM MAE_USUARIO
            WHERE CORREO = @CORREO AND ID_USUARIO <> @ID_USUARIO
        )
        BEGIN
            RAISERROR('El correo ingresado ya pertenece a otro usuario.', 16, 1);
            RETURN;
        END

        -- Validar que el USUARIO no esté en otro usuario
        IF EXISTS (
            SELECT 1 FROM MAE_USUARIO
            WHERE USUARIO = @USUARIO AND ID_USUARIO <> @ID_USUARIO
        )
        BEGIN
            RAISERROR('El nombre de usuario ya está en uso.', 16, 1);
            RETURN;
        END

        -- Actualizar el usuario
        UPDATE MAE_USUARIO
        SET
            NOMBRES = @NOMBRES,
            APELLIDOS = @APELLIDOS,
            DNI = @DNI,
            CORREO = @CORREO,
            CELULAR = @CELULAR,
            NRO_DPTO = @NRO_DPTO,
            FECHA_NACIMIENTO = @FECHA_NACIMIENTO,
            ID_TIPO_USUARIO = @ID_TIPO_USUARIO,
            ID_SEXO = @ID_SEXO,
            COMITE = @COMITE,
            USUARIO = @USUARIO
        WHERE ID_USUARIO = @ID_USUARIO;

        -- Confirmación
        SELECT 
            1 AS CodigoResultado,
            'Usuario actualizado exitosamente.' AS Mensaje;
    END TRY
    BEGIN CATCH
        SELECT 
            ERROR_NUMBER() AS CodigoResultado,
            ERROR_MESSAGE() AS Mensaje;
    END CATCH
END;
GO
