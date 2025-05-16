CREATE PROCEDURE sp_InsertMaintenanceAndNotice
    @ID_PROVEEDOR INT,
    @DESCRIPCION VARCHAR(255),
    @FECHA_MANTENIMIENTO DATE,
    @COSTO DECIMAL(10, 2),
    @NRO_DPTO INT = NULL,
    @ID_USUARIO_REGISTRO INT,
    @TIPO_USUARIOS VARCHAR(100) = NULL -- Lista de ID_TIPO_USUARIO separados por comas
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @ID_MANTENIMIENTO INT;
    DECLARE @ID_AVISO INT;

    BEGIN TRY
        -- Iniciar transacción
        BEGIN TRANSACTION;

        -- Insertar en MAE_MANTENIMIENTO
        INSERT INTO MAE_MANTENIMIENTO (
            ID_PROVEEDOR,
            DESCRIPCION,
            FECHA_MANTENIMIENTO,
            COSTO,
            NRO_DPTO,
            ID_USUARIO_REGISTRO,
            ESTADO
        )
        VALUES (
            @ID_PROVEEDOR,
            @DESCRIPCION,
            @FECHA_MANTENIMIENTO,
            @COSTO,
            @NRO_DPTO,
            @ID_USUARIO_REGISTRO,
            1
        );

        SET @ID_MANTENIMIENTO = SCOPE_IDENTITY();

        -- Insertar noticia en MAE_AVISO
        INSERT INTO MAE_AVISO (
            TITULO,
            DESCRIPCION,
            FECHA_PUBLICACION,
            FECHA_EXPIRACION,
            ID_USUARIO_PUBLICACION,
            ESTADO
        )
        VALUES (
            'Mantenimiento Programado',
            'Se ha programado un mantenimiento: ' + @DESCRIPCION + ' para el ' + CONVERT(VARCHAR, @FECHA_MANTENIMIENTO, 23),
            GETDATE(),
            DATEADD(DAY, 7, @FECHA_MANTENIMIENTO), -- Expira 7 días después del mantenimiento
            @ID_USUARIO_REGISTRO,
            1
        );

        SET @ID_AVISO = SCOPE_IDENTITY();

        -- Insertar permisos de la noticia
        IF @TIPO_USUARIOS IS NOT NULL
        BEGIN
            INSERT INTO MAE_AVISO_PERMISOS (ID_AVISO, ID_TIPO_USUARIO)
            SELECT @ID_AVISO, value
            FROM STRING_SPLIT(@TIPO_USUARIOS, ',');
        END;

        -- Confirmar transacción
        COMMIT TRANSACTION;

        SELECT @ID_MANTENIMIENTO AS ID_MANTENIMIENTO, @ID_AVISO AS ID_AVISO;
    END TRY
    BEGIN CATCH
        -- Revertir transacción en caso de error
        ROLLBACK TRANSACTION;

        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();

        RAISERROR (@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH;
END;
GO