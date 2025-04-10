--Asignar todos los menús al tipo de usuario “Sistemas” (ID_TIPO_USUARIO = 1)
EXEC SP_INSERTAR_ROL_MENU 1, 1;
EXEC SP_INSERTAR_ROL_MENU 1, 2;
EXEC SP_INSERTAR_ROL_MENU 1, 3;


--Asignar todos los submenús a “Sistemas”


-- Submenús del menú 1 (Usuarios)
EXEC SP_INSERTAR_ROL_SUBMENU 1, 1;
EXEC SP_INSERTAR_ROL_SUBMENU 1, 2;

-- Submenús del menú 2 (Control de Accesos)
EXEC SP_INSERTAR_ROL_SUBMENU 1, 3;
EXEC SP_INSERTAR_ROL_SUBMENU 1, 4;

-- Submenú del menú 3 (Configuración)
EXEC SP_INSERTAR_ROL_SUBMENU 1, 5;
