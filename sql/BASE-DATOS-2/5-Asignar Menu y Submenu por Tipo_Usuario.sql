--Asignar todos los men�s al tipo de usuario �Sistemas� (ID_TIPO_USUARIO = 1)
EXEC SP_INSERTAR_ROL_MENU 1, 1;
EXEC SP_INSERTAR_ROL_MENU 1, 2;
EXEC SP_INSERTAR_ROL_MENU 1, 3;


--Asignar todos los submen�s a �Sistemas�


-- Submen�s del men� 1 (Usuarios)
EXEC SP_INSERTAR_ROL_SUBMENU 1, 1;
EXEC SP_INSERTAR_ROL_SUBMENU 1, 2;

-- Submen�s del men� 2 (Control de Accesos)
EXEC SP_INSERTAR_ROL_SUBMENU 1, 3;
EXEC SP_INSERTAR_ROL_SUBMENU 1, 4;

-- Submen� del men� 3 (Configuraci�n)
EXEC SP_INSERTAR_ROL_SUBMENU 1, 5;
