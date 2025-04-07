ALTER PROCEDURE SP_ACTUALIZAR_CONTRASEÑA
    @ID_USUARIO INT,
    @CONTRASENA_HASH VARCHAR(255), -- Hash de la nueva contraseña
    @CONTRASENA_SALT VARCHAR(50)   -- Salt de la nueva contraseña
AS
BEGIN
    -- Declaramos una variable para almacenar el correo
    DECLARE @CORREO VARCHAR(100);

    -- Obtenemos el correo del usuario antes de realizar la actualización
    SELECT @CORREO = CORREO
    FROM dbo.MAE_USUARIO
    WHERE ID_USUARIO = @ID_USUARIO;

    -- Si el usuario no existe, lanzamos un error
    IF @CORREO IS NULL
    BEGIN
        RAISERROR('Usuario no encontrado', 16, 1);
        RETURN;  -- Detenemos la ejecución si no se encuentra el usuario
    END

    -- Actualizamos la contraseña del usuario en la base de datos
    UPDATE dbo.MAE_USUARIO
    SET 
        CONTRASENA_HASH = @CONTRASENA_HASH,
        CONTRASENA_SALT = @CONTRASENA_SALT
    WHERE ID_USUARIO = @ID_USUARIO;

    -- Verificamos si la actualización fue exitosa
    IF @@ROWCOUNT = 0
    BEGIN
        RAISERROR('Actualización fallida', 16, 1);
    END

    -- Devolvemos el correo del usuario actualizado
    SELECT @CORREO AS CORREO_ACTUALIZADO;

END;