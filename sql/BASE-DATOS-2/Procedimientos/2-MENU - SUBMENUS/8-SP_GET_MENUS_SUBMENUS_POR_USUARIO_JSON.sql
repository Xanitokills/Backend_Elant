CREATE OR ALTER PROCEDURE SP_GET_MENUS_SUBMENUS_JSON
    @ID_USUARIO INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Obtener los ID_TIPO_USUARIO del usuario
    DECLARE @TIPOS_USUARIO TABLE (ID_TIPO_USUARIO INT);
    INSERT INTO @TIPOS_USUARIO (ID_TIPO_USUARIO)
    SELECT ID_TIPO_USUARIO FROM MAE_USUARIO WHERE ID_USUARIO = @ID_USUARIO
    UNION
    SELECT ID_TIPO_USUARIO FROM MAE_USUARIO_ROL WHERE ID_USUARIO = @ID_USUARIO;

    -- CTE para obtener menús con al menos un submenú permitido
    WITH MenusConSubmenus AS (
        SELECT DISTINCT
            m.ID_MENU,
            m.NOMBRE AS MENU_NOMBRE,
            m.ICONO AS MENU_ICONO,
            m.URL AS MENU_URL,
            m.ORDEN AS MENU_ORDEN,
            m.ESTADO AS MENU_ESTADO
        FROM MAE_MENU m
        JOIN MAE_ROL_MENU rm ON rm.ID_MENU = m.ID_MENU
        WHERE m.ESTADO = 1
          AND rm.ID_TIPO_USUARIO IN (SELECT ID_TIPO_USUARIO FROM @TIPOS_USUARIO)
          AND EXISTS (
              SELECT 1
              FROM MAE_SUBMENU sm
              JOIN MAE_ROL_SUBMENU rs ON rs.ID_SUBMENU = sm.ID_SUBMENU
              WHERE sm.ID_MENU = m.ID_MENU
                AND sm.ESTADO = 1
                AND rs.ID_TIPO_USUARIO IN (SELECT ID_TIPO_USUARIO FROM @TIPOS_USUARIO)
          )
    )

    -- Seleccionar menús con submenús permitidos como JSON
    SELECT 
        m.ID_MENU,
        m.MENU_NOMBRE,
        m.MENU_ICONO,
        m.MENU_URL,
        m.MENU_ORDEN,
        m.MENU_ESTADO,
        (
            SELECT
                sm.ID_SUBMENU,
                sm.NOMBRE AS SUBMENU_NOMBRE,
                sm.ICONO AS SUBMENU_ICONO,
                sm.URL AS SUBMENU_URL,
                sm.ORDEN AS SUBMENU_ORDEN,
                sm.ESTADO AS SUBMENU_ESTADO
            FROM MAE_SUBMENU sm
            JOIN MAE_ROL_SUBMENU rs ON rs.ID_SUBMENU = sm.ID_SUBMENU
            WHERE sm.ID_MENU = m.ID_MENU
              AND sm.ESTADO = 1
              AND rs.ID_TIPO_USUARIO IN (SELECT ID_TIPO_USUARIO FROM @TIPOS_USUARIO)
            ORDER BY sm.ORDEN ASC
            FOR JSON PATH
        ) AS SUBMENUS
    FROM MenusConSubmenus m
    ORDER BY m.MENU_ORDEN
    FOR JSON PATH;

END;
GO
