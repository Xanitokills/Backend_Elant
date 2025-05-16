-- SP_ELIMINAR_SUBMENU
CREATE OR ALTER PROCEDURE SP_ELIMINAR_SUBMENU
    @ID_SUBMENU INT
AS
BEGIN
    -- Marcar el submenú como inactivo
    UPDATE MAE_SUBMENU
    SET ESTADO = 0
    WHERE ID_SUBMENU = @ID_SUBMENU AND ESTADO = 1;

    -- Obtener el ID_MENU del submenú (si existe y está activo)
    DECLARE @ID_MENU INT;
    SELECT @ID_MENU = ID_MENU 
    FROM MAE_SUBMENU 
    WHERE ID_SUBMENU = @ID_SUBMENU AND ESTADO = 0; -- Estado = 0 porque ya se actualizó

    -- Normalizar ORDEN para los submenús restantes (si ID_MENU es válido)
    IF @ID_MENU IS NOT NULL
    BEGIN
        WITH OrderedSubmenus AS (
            SELECT ID_SUBMENU,
                   ROW_NUMBER() OVER (ORDER BY ORDEN) AS NEW_ORDEN
            FROM MAE_SUBMENU
            WHERE ID_MENU = @ID_MENU AND ESTADO = 1
        )
        UPDATE MAE_SUBMENU
        SET ORDEN = OrderedSubmenus.NEW_ORDEN
        FROM MAE_SUBMENU
        INNER JOIN OrderedSubmenus ON MAE_SUBMENU.ID_SUBMENU = OrderedSubmenus.ID_SUBMENU;
    END;
END;
GO