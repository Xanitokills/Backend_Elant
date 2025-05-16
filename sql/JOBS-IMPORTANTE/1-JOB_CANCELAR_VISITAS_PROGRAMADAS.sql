SELECT SUSER_NAME() AS CurrentUser; -- se conoce el usuario


USE msdb;
GO

-- Eliminar el job si ya existe
IF EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = N'ActualizarVisitasProgramadasExpiradas')
    EXEC msdb.dbo.sp_delete_job @job_name = N'ActualizarVisitasProgramadasExpiradas', @delete_unused_schedule = 1;
GO

-- Crear el job
DECLARE @jobId BINARY(16);

EXEC msdb.dbo.sp_add_job
    @job_name = N'ActualizarVisitasProgramadasExpiradas',
    @enabled = 1,
    @notify_level_eventlog = 2,
    @notify_level_email = 0,
    @notify_level_netsend = 0,
    @notify_level_page = 0,
    @delete_level = 0,
    @description = N'Job que actualiza el estado de visitas programadas antiguas a ESTADO = 3 (Expirada) cada 24 horas a medianoche.',
    @category_name = N'[Uncategorized (Local)]',
    @owner_login_name = N'admin',
    @job_id = @jobId OUTPUT;

-- Agregar un paso al job
EXEC msdb.dbo.sp_add_jobstep
    @job_id = @jobId,
    @step_name = N'Ejecutar sp_ActualizarVisitasProgramadasExpiradas',
    @step_id = 1,
    @cmdexec_success_code = 0,
    @on_success_action = 1,
    @on_fail_action = 2,
    @retry_attempts = 0,
    @retry_interval = 0,
    @os_run_priority = 0,
    @subsystem = N'TSQL',
    @command = N'EXEC dbo.sp_ActualizarVisitasProgramadasExpiradas;',
    @database_name = N'BACKUP_12-05-2025',
    @flags = 0;

-- Agregar un horario al job (ejecutar cada día a las 00:00 AM)
EXEC msdb.dbo.sp_add_jobschedule
    @job_id = @jobId,
    @name = N'HorarioDiario_Medianoche',
    @enabled = 1,
    @freq_type = 4,
    @freq_interval = 1,
    @freq_subday_type = 1,
    @freq_subday_interval = 0,
    @freq_relative_interval = 0,
    @freq_recurrence_factor = 0,
    @active_start_date = 20250515,
    @active_end_date = 99991231,
    @active_start_time = 0,
    @active_end_time = 235959;

-- Asignar el job al servidor
EXEC msdb.dbo.sp_add_jobserver
    @job_id = @jobId,
    @server_name = N'(local)';
GO