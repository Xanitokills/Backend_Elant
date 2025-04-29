CREATE OR ALTER PROCEDURE SP_GET_MENUS_SUBMENUS_JSON
    @ID_USUARIO INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Obtener los ID_ROL del usuario
    DECLARE @ROLES TABLE (ID_ROL INT);
    INSERT INTO @ROLES (ID_ROL)
    SELECT ID_ROL FROM MAE_USUARIO_ROL WHERE ID_USUARIO = @ID_USUARIO;

    -- CTE para obtener menús accesibles por el usuario
    WITH MenusAccesibles AS (
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
          AND rm.ID_ROL IN (SELECT ID_ROL FROM @ROLES)
          AND (
              -- Incluir menús con URL no nula
              m.URL IS NOT NULL
              -- O menús sin URL pero con al menos un submenú permitido
              OR EXISTS (
                  SELECT 1
                  FROM MAE_SUBMENU sm
                  JOIN MAE_ROL_SUBMENU rs ON rs.ID_SUBMENU = sm.ID_SUBMENU
                  WHERE sm.ID_MENU = m.ID_MENU
                    AND sm.ESTADO = 1
                    AND rs.ID_ROL IN (SELECT ID_ROL FROM @ROLES)
              )
          )
    )

    -- Seleccionar menús con submenús permitidos (o sin submenús) como JSON
    SELECT 
        m.ID_MENU AS id,
        m.MENU_NOMBRE AS nombre,
        m.MENU_ICONO AS icono,
        m.MENU_URL AS url,
        m.MENU_ORDEN AS orden,
        m.MENU_ESTADO AS estado,
        (
            SELECT
                sm.ID_SUBMENU AS id,
                sm.NOMBRE AS nombre,
                sm.ICONO AS icono,
                sm.URL AS url,
                sm.ORDEN AS orden,
                sm.ESTADO AS estado
            FROM MAE_SUBMENU sm
            JOIN MAE_ROL_SUBMENU rs ON rs.ID_SUBMENU = sm.ID_SUBMENU
            WHERE sm.ID_MENU = m.ID_MENU
              AND sm.ESTADO = 1
              AND rs.ID_ROL IN (SELECT ID_ROL FROM @ROLES)
            ORDER BY sm.ORDEN ASC
            FOR JSON PATH
        ) AS submenus
    FROM MenusAccesibles m
    ORDER BY m.MENU_ORDEN
    FOR JSON PATH;
END;
GO