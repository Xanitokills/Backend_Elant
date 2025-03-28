-- User Types
INSERT INTO MAE_TIPO_USUARIO (DETALLE_USUARIO, ESTADO)
VALUES ('Admin', 1), ('Residente', 1);

-- Genders
INSERT INTO MAE_SEXO (DESCRIPCION)
VALUES ('Masculino'), ('Femenino');

-- Users
INSERT INTO MAE_USUARIO (
    NRO_DPTO, NOMBRES, APELLIDOS, DNI, CORREO, CELULAR, CONTACTO_EMERGENCIA, 
    FECHA_NACIMIENTO, ID_TIPO_USUARIO, ID_SEXO, DETALLE, OBSERVACIONES, 
    COMITE, USUARIO, CONTRASENA_HASH, CONTRASENA_SALT, ESTADO
)
VALUES (
    101, 'Test', 'User', '12345678', 'test@example.com', '987654321', '912345678',
    '1990-01-01', 1, 1, 'Test user for door access', NULL,
    0, 'testuser', 'temp_hash', 'temp_salt', 1
);

-- Doors
INSERT INTO MAE_PUERTA (NOMBRE, DESCRIPCION, ESTADO)
VALUES ('Main Entrance', 'Main entrance door', 1);

-- QR Codes
INSERT INTO MAE_QR (QR_DATA, ID_PUERTA, ESTADO)
VALUES ('qr_code_123', 1, 1);

-- QR Code Permissions
INSERT INTO MAE_QR_TIPO_USUARIO (ID_QR, ID_TIPO_USUARIO)
VALUES (1, 1), (1, 2); -- ID_QR = 1 (qr_code_123), ID_TIPO_USUARIO = 1 (Admin), 2 (Residente)

-- Menu and Submenu for Door Access
INSERT INTO MAE_MENU (NOMBRE, ICONO, URL, ORDEN, ESTADO)
VALUES ('Acceso Puertas', 'door', NULL, 1, 1);

INSERT INTO MAE_SUBMENU (ID_MENU, NOMBRE, ICONO, URL, ORDEN, ESTADO)
VALUES (1, 'Abrir Puerta', 'qr_code', '/abrir-puerta', 1, 1);

-- Grant access to Admin and Residente
INSERT INTO MAE_ROL_MENU (ID_TIPO_USUARIO, ID_MENU)
VALUES (1, 1), (2, 1);

INSERT INTO MAE_ROL_SUBMENU (ID_TIPO_USUARIO, ID_SUBMENU)
VALUES (1, 1), (2, 1);
