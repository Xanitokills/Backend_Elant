
--1️-Insertar los menús
EXEC SP_INSERTAR_MENU 'Usuarios', 'FaUsers', NULL, 1, 1;
EXEC SP_INSERTAR_SUBMENU 1, 'Registrar Usuarios', 'FaUsers', '/users', 1, 1;


--------------------------------------------------------------------------------------------
INSERT INTO MAE_MENU (ID_MENU, NOMBRE, ICONO, URL, ORDEN, ESTADO) VALUES
(1, 'Usuarios', 'FaUsers', NULL, 1, 1),
(2, 'Gestión de Ingresos', 'FaDoorOpen', NULL, 2, 1),
(3, 'Configuración', 'FaCogs', NULL, 3, 1),
(5, 'Áreas Comunes', 'FaBuilding', NULL, 4, 1),
(6, 'Recepción', 'FaChartPie', NULL, 5, 1),
(7, 'Dashboard', 'FaHome', '/dashboard', 0, 1);
--------------------------------------------------------------------------------------------
INSERT INTO MAE_SUBMENU (ID_SUBMENU, ID_MENU, NOMBRE, ICONO, URL, ORDEN, ESTADO) VALUES
(1, 1, 'Registrar Usuarios', 'FaUsers', '/users', 1, 1),
(2, 1, 'Lista de Usuarios', 'FaList', '/user-list', 2, 1),
(3, 2, 'Control de Ingresos y Salidas', 'FaDoorOpen', '/movements-list', 2, 1),
(4, 2, 'Gestión Visitas', 'FaUserFriends', '/visits', 1, 1),
(5, 3, 'Login', 'FaImages', '/LoginConfig', 2, 1),
(6, 3, 'Cambio Contraseña', 'FaLock', '/ChangePass', 1, 1),
(7, 3, 'Gestión de Menús y Submenús', 'FaListAlt', '/menu-submenu', 3, 1),
(8, 5, 'Reservas', 'FaCalendarAlt', '/reservas', 1, 1),
(9, 6, 'Registrar Pedido', 'FaClipboardList', '/RegistrarPedido', 1, 1),
(10, 2, 'Visitas Programadas', 'FaCalendarCheck', '/visitasProgramadas', 3, 1);
