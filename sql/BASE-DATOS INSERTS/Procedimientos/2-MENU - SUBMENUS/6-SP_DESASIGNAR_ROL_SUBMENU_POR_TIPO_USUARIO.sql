ALTER PROCEDURE SP_ELIMINAR_ROL_SUBMENU
    @ID_ROL INT,
    @ID_SUBMENU INT
AS
BEGIN
    DELETE FROM MAE_ROL_SUBMENU
    WHERE ID_ROL = @ID_ROL AND ID_SUBMENU = @ID_SUBMENU;
END;
GO