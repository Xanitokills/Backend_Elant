
--1️-Insertar los menús
EXEC SP_INSERTAR_MENU 'Usuarios', 'FaUsers', NULL, 1, 1;
EXEC SP_INSERTAR_MENU 'Control de Accesos', 'FaDoorOpen', NULL, 2, 1;
EXEC SP_INSERTAR_MENU 'Configuración', 'FaCog', NULL, 3, 1;

--2-Insertar los submenús

-- Para 'Usuarios'
EXEC SP_INSERTAR_SUBMENU 1, 'Registrar Usuarios', 'FaUsers', '/users', 1, 1;
EXEC SP_INSERTAR_SUBMENU 1, 'Lista de Usuarios', 'FaList', '/user-list', 2, 1;

-- Para 'Control de Accesos'
EXEC SP_INSERTAR_SUBMENU 2, 'Control de Ingresos y Salidas', 'FaDoorOpen', '/movements-list', 1, 1;
EXEC SP_INSERTAR_SUBMENU 2, 'Visitas', 'FaUserFriends', '/visits', 2, 1;

-- Para 'Configuración'
EXEC SP_INSERTAR_SUBMENU 3, 'Login', 'FaCog', '/LoginConfig', 1, 1;
