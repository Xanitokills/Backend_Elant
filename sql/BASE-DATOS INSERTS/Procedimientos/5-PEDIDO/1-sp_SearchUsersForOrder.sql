-- Stored Procedure: sp_SearchUsersForOrder
-- Descripción: Busca usuarios por nombre, DNI o departamento. Si es por departamento, devuelve todos los usuarios que residen en él.
-- Parámetros:
--   @Criteria: Criterio de búsqueda ('name', 'dni', 'department').
--   @Query: Valor de búsqueda (nombre, DNI o número de departamento).
CREATE OR ALTER PROCEDURE sp_SearchUsersForOrder
    @Criteria VARCHAR(20),
    @Query VARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    -- Validar parámetros
    IF @Criteria NOT IN ('name', 'dni', 'department')
    BEGIN
        RAISERROR ('Criterio de búsqueda inválido. Use ''name'', ''dni'' o ''department''.', 16, 1);
        RETURN;
    END

    -- Tabla temporal para almacenar resultados
    DECLARE @Result TABLE (
        ID_USUARIO INT,
        NOMBRES VARCHAR(50),
        APELLIDOS VARCHAR(50),
        DNI VARCHAR(12),
        NRO_DPTO INT
    );

    -- Búsqueda por nombre
    IF @Criteria = 'name' AND @Query IS NOT NULL AND LEN(@Query) >= 3
    BEGIN
        INSERT INTO @Result
        SELECT 
            U.ID_USUARIO,
            U.NOMBRES,
            U.APELLIDOS,
            U.DNI,
            ISNULL(UD.NRO_DPTO, 0) AS NRO_DPTO
        FROM MAE_USUARIO U
        LEFT JOIN MAE_USUARIO_DEPARTAMENTO UD ON U.ID_USUARIO = UD.ID_USUARIO AND UD.ESTADO = 1
        WHERE U.ESTADO = 1
            AND (U.NOMBRES + ' ' + U.APELLIDOS LIKE '%' + @Query + '%'
                 OR U.APELLIDOS + ' ' + U.NOMBRES LIKE '%' + @Query + '%');
    END

    -- Búsqueda por DNI
    ELSE IF @Criteria = 'dni' AND @Query IS NOT NULL AND LEN(@Query) >= 3
    BEGIN
        INSERT INTO @Result
        SELECT 
            U.ID_USUARIO,
            U.NOMBRES,
            U.APELLIDOS,
            U.DNI,
            ISNULL(UD.NRO_DPTO, 0) AS NRO_DPTO
        FROM MAE_USUARIO U
        LEFT JOIN MAE_USUARIO_DEPARTAMENTO UD ON U.ID_USUARIO = UD.ID_USUARIO AND UD.ESTADO = 1
        WHERE U.ESTADO = 1
            AND U.DNI LIKE '%' + @Query + '%';
    END

    -- Búsqueda por departamento
    ELSE IF @Criteria = 'department' AND @Query IS NOT NULL AND ISNUMERIC(@Query) = 1
    BEGIN
        DECLARE @DepartmentNumber INT = CAST(@Query AS INT);

        -- Devolver todos los usuarios del departamento
        INSERT INTO @Result
        SELECT 
            U.ID_USUARIO,
            U.NOMBRES,
            U.APELLIDOS,
            U.DNI,
            UD.NRO_DPTO
        FROM MAE_USUARIO U
        INNER JOIN MAE_USUARIO_DEPARTAMENTO UD ON U.ID_USUARIO = UD.ID_USUARIO
        WHERE UD.NRO_DPTO = @DepartmentNumber
            AND U.ESTADO = 1
            AND UD.ESTADO = 1;
    END
    ELSE
    BEGIN
        RAISERROR ('Parámetros de búsqueda inválidos o insuficientes.', 16, 1);
        RETURN;
    END

    -- Devolver resultados agrupados por departamento si es búsqueda por departamento
    IF @Criteria = 'department'
    BEGIN
        SELECT 
            NRO_DPTO,
            (
                SELECT 
                    ID_USUARIO,
                    NOMBRES,
                    APELLIDOS,
                    DNI,
                    NRO_DPTO
                FROM @Result UR
                WHERE UR.NRO_DPTO = R.NRO_DPTO
                FOR JSON PATH
            ) AS USUARIOS
        FROM @Result R
        GROUP BY NRO_DPTO
        FOR JSON PATH;
    END
    ELSE
    BEGIN
        SELECT 
            ID_USUARIO,
            NOMBRES,
            APELLIDOS,
            DNI,
            NRO_DPTO
        FROM @Result
        FOR JSON PATH;
    END
END;