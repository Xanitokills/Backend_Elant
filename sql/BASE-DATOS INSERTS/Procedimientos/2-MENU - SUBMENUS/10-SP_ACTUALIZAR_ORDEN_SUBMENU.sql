CREATE OR ALTER PROCEDURE SP_ACTUALIZAR_ORDEN_SUBMENU
    @ID_SUBMENU INT,
    @NEW_ORDEN INT
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        -- Validar que el submenú exista
        IF NOT EXISTS (SELECT 1 FROM MAE_SUBMENU WHERE ID_SUBMENU = @ID_SUBMENU)
        BEGIN
            THROW 50001, 'El submenú no existe.', 1;
            RETURN;
        END;

        -- Validar que el nuevo orden sea positivo
        IF @NEW_ORDEN <= 0
        BEGIN
            THROW 50002, 'El orden debe ser un número positivo.', 1;
            RETURN;
        END;

        DECLARE @ID_MENU INT;
        DECLARE @CurrentOrden INT;

        -- Obtener el ID_MENU y el orden actual del submenú
        SELECT @ID_MENU = ID_MENU, @CurrentOrden = ORDEN
        FROM MAE_SUBMENU
        WHERE ID_SUBMENU = @ID_SUBMENU;

        -- Iniciar una transacción para asegurar consistencia
        BEGIN TRANSACTION;

        -- Actualizar el orden del submenú especificado
        UPDATE MAE_SUBMENU
        SET ORDEN = @NEW_ORDEN
        WHERE ID_SUBMENU = @ID_SUBMENU;

        -- Ajustar los órdenes de los demás submenús en el mismo menú
        -- Si el nuevo orden es menor que el actual, incrementar los órdenes intermedios
        IF @NEW_ORDEN < @CurrentOrden
        BEGIN
            UPDATE MAE_SUBMENU
            SET ORDEN = ORDEN + 1
            WHERE ID_MENU = @ID_MENU
            AND ID_SUBMENU != @ID_SUBMENU
            AND ORDEN >= @NEW_ORDEN
            AND ORDEN < @CurrentOrden;
        END
        -- Si el nuevo orden es mayor que el actual, decrementar los órdenes intermedios
        ELSE IF @NEW_ORDEN > @CurrentOrden
        BEGIN
            UPDATE MAE_SUBMENU
            SET ORDEN = ORDEN - 1
            WHERE ID_MENU = @ID_MENU
            AND ID_SUBMENU != @ID_SUBMENU
            AND ORDEN <= @NEW_ORDEN
            AND ORDEN > @CurrentOrden;
        END;

        -- Normalizar los órdenes para eliminar huecos y asegurar unicidad
        WITH Ranked AS (
            SELECT ID_SUBMENU, 
                   ROW_NUMBER() OVER (ORDER BY ORDEN) AS NuevoOrden
            FROM MAE_SUBMENU
            WHERE ID_MENU = @ID_MENU
        )
        UPDATE MAE_SUBMENU
        SET ORDEN = Ranked.NuevoOrden
        FROM MAE_SUBMENU m
        INNER JOIN Ranked ON m.ID_SUBMENU = Ranked.ID_SUBMENU;

        -- Confirmar la transacción
        COMMIT TRANSACTION;

        SELECT 'Orden actualizado correctamente' AS Mensaje;
    END TRY
    BEGIN CATCH
        -- Revertir la transacción en caso de error
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        RAISERROR (@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH;
END;
GO

-- Cambiar el orden del submenú con ID_SUBMENU = 1 a la posición 3
--EXEC SP_ACTUALIZAR_ORDEN_SUBMENU @ID_SUBMENU = 1, @NEW_ORDEN = 1;

