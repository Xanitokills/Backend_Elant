CREATE OR ALTER PROCEDURE SP_ACTUALIZAR_CONTRASEÑA
    @ID_USUARIO INT,
    @CONTRASENA_HASH VARCHAR(255),
    @CONTRASENA_SALT VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        -- Validar que el usuario exista
        IF NOT EXISTS (SELECT 1 FROM MAE_USUARIO WHERE ID_USUARIO = @ID_USUARIO AND ESTADO = 1)
            THROW 50020, 'El usuario no existe o está inactivo.', 1;

        -- Actualizar la contraseña
        UPDATE MAE_USUARIO
        SET 
            CONTRASENA_HASH = @CONTRASENA_HASH,
            CONTRASENA_SALT = @CONTRASENA_SALT,
            PRIMER_INICIO = 1 -- Para que el usuario deba cambiar la contraseña en su próximo inicio de sesión
        WHERE ID_USUARIO = @ID_USUARIO;

    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        RAISERROR (@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END;
GO
