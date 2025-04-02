CREATE PROCEDURE SP_REGISTRAR_ACCESO_POR_DNI
    @DNI VARCHAR(8)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ID_USUARIO INT;
    DECLARE @ID_QR INT = 1; -- ajusta este valor según tu lógica de acceso

    SELECT @ID_USUARIO = ID_USUARIO FROM MAE_USUARIO WHERE DNI = @DNI;

    IF @ID_USUARIO IS NOT NULL
    BEGIN
        INSERT INTO MAE_ACCESO_PUERTA (ID_QR, ID_USUARIO, FECHA_ACCESO, EXITO)
        VALUES (@ID_QR, @ID_USUARIO, GETDATE(), 1);

        SELECT 'Acceso registrado correctamente' AS mensaje;
    END
    ELSE
    BEGIN
        SELECT 'Usuario no encontrado' AS mensaje;
    END
END;
