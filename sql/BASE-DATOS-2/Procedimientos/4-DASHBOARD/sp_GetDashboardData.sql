CREATE OR ALTER PROCEDURE sp_GetDashboardData
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Declarar tabla temporal para roles
    DECLARE @UserRoles TABLE (ID_TIPO_USUARIO INT PRIMARY KEY);

    -- 1. Obtener roles del usuario
    INSERT INTO @UserRoles (ID_TIPO_USUARIO)
    SELECT ID_TIPO_USUARIO 
    FROM MAE_USUARIO 
    WHERE ID_USUARIO = @UserId AND ESTADO = 1
    UNION ALL
    SELECT ID_TIPO_USUARIO 
    FROM MAE_USUARIO_ROL 
    WHERE ID_USUARIO = @UserId;

    -- 2. Obtener permisos
    DECLARE @Permissions TABLE (
        NOMBRE_ELEMENTO VARCHAR(50),
        VISIBLE BIT,
        ORDEN INT,
        ICONO VARCHAR(50)
    );

    INSERT INTO @Permissions (NOMBRE_ELEMENTO, VISIBLE, ORDEN, ICONO)
    SELECT 
        e.NOMBRE_ELEMENTO,
        MAX(CAST(p.VISIBLE AS INT)) AS VISIBLE,
        e.ORDEN,
        e.ICONO
    FROM MAE_PERMISOS_DASHBOARD p
    JOIN MAE_ELEMENTOS_DASHBOARD e ON p.ID_ELEMENTO = e.ID_ELEMENTO
    WHERE p.ID_TIPO_USUARIO IN (SELECT ID_TIPO_USUARIO FROM @UserRoles)
        AND e.ESTADO = 1
    GROUP BY e.NOMBRE_ELEMENTO, e.ORDEN, e.ICONO;

    -- 3. Obtener departamento
    DECLARE @NroDpto INT;
    SELECT @NroDpto = NRO_DPTO
    FROM MAE_USUARIO_DEPARTAMENTO
    WHERE ID_USUARIO = @UserId AND ESTADO = 1;

    -- 4. Obtener deudas
    DECLARE @PendingPayments INT = 0;
    DECLARE @TotalDebt DECIMAL(10, 2) = 0;
    DECLARE @HasDebt BIT = 0;

    IF @NroDpto IS NOT NULL
    BEGIN
        SELECT 
            @PendingPayments = COUNT(*),
            @TotalDebt = ISNULL(SUM(MONTO), 0)
        FROM MAE_DEUDOR
        WHERE NRO_DPTO = @NroDpto AND ESTADO = 0;

        SET @HasDebt = CASE WHEN @PendingPayments > 0 THEN 1 ELSE 0 END;
    END

    -- 5. Obtener cuenta mancomunada
    DECLARE @AccountInfo TABLE (
        bank VARCHAR(100),
        accountNumber VARCHAR(50),
        cci VARCHAR(50),
        holder VARCHAR(100)
    );

    INSERT INTO @AccountInfo (bank, accountNumber, cci, holder)
    SELECT TOP 1 
        BANCO AS bank, 
        NUMERO_CUENTA AS accountNumber, 
        CCI AS cci, 
        TITULAR AS holder
    FROM MAE_CUENTA_MANCOMUNADA
    WHERE ESTADO = 1
    ORDER BY FECHA_CREACION DESC;

    -- 6. Obtener noticias
    DECLARE @News TABLE (
        title VARCHAR(100),
        description TEXT,
        date VARCHAR(23)
    );

    INSERT INTO @News (title, description, date)
    SELECT 
        a.TITULO AS title, 
        a.DESCRIPCION AS description, 
        CONVERT(VARCHAR, a.FECHA_PUBLICACION, 23) AS date
    FROM MAE_AVISO a
    LEFT JOIN MAE_AVISO_PERMISOS ap ON a.ID_AVISO = ap.ID_AVISO
    WHERE a.ESTADO = 1 
        AND (a.FECHA_EXPIRACION IS NULL OR a.FECHA_EXPIRACION > GETDATE())
        AND (
            ap.ID_TIPO_USUARIO IN (SELECT ID_TIPO_USUARIO FROM @UserRoles)
            OR ap.ID_TIPO_USUARIO IS NULL
        )
    ORDER BY a.FECHA_PUBLICACION DESC;

    -- 7. Obtener eventos
    DECLARE @Events TABLE (
        date VARCHAR(23),
        title VARCHAR(100),
        type VARCHAR(50),
        startTime TIME,
        endTime TIME,
        location VARCHAR(100),
        description TEXT
    );

    INSERT INTO @Events (date, title, type, startTime, endTime, location, description)
    SELECT 
        CONVERT(VARCHAR, e.FECHA_EVENTO, 23) AS date,
        e.TITULO AS title,
        e.TIPO_EVENTO AS type,
        e.HORA_INICIO AS startTime,
        e.HORA_FIN AS endTime,
        e.UBICACION AS location,
        e.DESCRIPCION AS description
    FROM MAE_EVENTO e
    LEFT JOIN MAE_EVENTO_PERMISOS ep ON e.ID_EVENTO = ep.ID_EVENTO
    WHERE e.ESTADO = 1 
        AND e.FECHA_EVENTO >= GETDATE()
        AND (
            ep.ID_TIPO_USUARIO IN (SELECT ID_TIPO_USUARIO FROM @UserRoles)
            OR ep.ID_TIPO_USUARIO IS NULL
        )
    ORDER BY e.FECHA_EVENTO ASC;

    -- 8. Obtener documentos
    DECLARE @Documents TABLE (
        name VARCHAR(100),
        type VARCHAR(50),
        url VARCHAR(255),
        uploadDate VARCHAR(23)
    );

    INSERT INTO @Documents (name, type, url, uploadDate)
    SELECT 
        d.TITULO AS name, 
        d.TIPO_DOCUMENTO AS type, 
        d.RUTA_ARCHIVO AS url,
        CONVERT(VARCHAR, d.FECHA_SUBIDA, 23) AS uploadDate
    FROM MAE_DOCUMENTO_ADMIN d
    LEFT JOIN MAE_DOCUMENTO_PERMISOS dp ON d.ID_DOCUMENTO = dp.ID_DOCUMENTO
    WHERE d.ESTADO = 1
        AND (
            dp.ID_TIPO_USUARIO IN (SELECT ID_TIPO_USUARIO FROM @UserRoles)
            OR dp.ID_TIPO_USUARIO IS NULL
        )
    ORDER BY d.FECHA_SUBIDA DESC;

    -- 9. Obtener encargos
    DECLARE @Encargos TABLE (
        ID_ENCARGO INT,
        descripcion VARCHAR(255),
        fechaRecepcion VARCHAR(23)
    );

    INSERT INTO @Encargos (ID_ENCARGO, descripcion, fechaRecepcion)
    SELECT 
        e.ID_ENCARGO, 
        e.DESCRIPCION AS descripcion, 
        CONVERT(VARCHAR, e.FECHA_RECEPCION, 23) AS fechaRecepcion
    FROM MAE_ENCARGO e
    JOIN MAE_USUARIO_DEPARTAMENTO ud ON e.NRO_DPTO = ud.NRO_DPTO
    WHERE e.ESTADO = 1 
        AND e.FECHA_ENTREGA IS NULL 
        AND ud.ID_USUARIO = @UserId
    ORDER BY e.FECHA_RECEPCION DESC;

    -- 10. Obtener mantenimientos
    DECLARE @MaintenanceEvents TABLE (
        title VARCHAR(255),
        date VARCHAR(23),
        providerName VARCHAR(100),
        providerType VARCHAR(50),
        cost DECIMAL(10, 2)
    );

    INSERT INTO @MaintenanceEvents (title, date, providerName, providerType, cost)
    SELECT 
        m.DESCRIPCION AS title,
        CONVERT(VARCHAR, m.FECHA_MANTENIMIENTO, 23) AS date,
        p.NOMBRE AS providerName,
        p.TIPO_SERVICIO AS providerType,
        m.COSTO AS cost
    FROM MAE_MANTENIMIENTO m
    JOIN MAE_PROVEEDOR p ON m.ID_PROVEEDOR = p.ID_PROVEEDOR
    WHERE m.ESTADO = 1 
        AND m.FECHA_MANTENIMIENTO >= GETDATE()
    ORDER BY m.FECHA_MANTENIMIENTO ASC;

    -- Devolver resultados
    SELECT 
        @PendingPayments AS pendingPayments,
        @TotalDebt AS totalDebt,
        @HasDebt AS hasDebt;

    SELECT * FROM @AccountInfo;

    SELECT * FROM @Permissions;

    SELECT * FROM @News;

    SELECT * FROM @Events;

    SELECT * FROM @Documents;

    SELECT * FROM @Encargos;

    SELECT * FROM @MaintenanceEvents;
END;
GO