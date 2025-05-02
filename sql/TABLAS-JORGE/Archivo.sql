########################################################################

SELECT * FROM MAE_PERFIL
select * from MAE_PERSONA
select * from MAE_SEXO
SELECT * FROM MAE_TRABAJADOR_FASE

SELECT * FROM MAE_RESIDENTE
SELECT * FROM MAE_TIPO_RESIDENTE

SELECT * FROM MAE_DEPARTAMENTO
SELECT * FROM MAE_FASE

select * from MAE_USUARIO
select * from MAE_TIPO_USUARIO -- MAE_ROLES_ACCESO
select * from MAE_USUARIO_ROL


select * from [dbo].[MAE_MENU]
select * from [dbo].[MAE_SUBMENU]
select * from [dbo].[MAE_ROL_MENU]
select * from [dbo].[MAE_ROL_SUBMENU]


######################################################################
SELECT * FROM MAE_PERFIL
select * from MAE_PERSONA
select * from MAE_SEXO
SELECT * FROM MAE_TRABAJADOR_FASE

SELECT * FROM MAE_RESIDENTE
SELECT * FROM MAE_TIPO_RESIDENTE

SELECT * FROM MAE_DEPARTAMENTO
SELECT * FROM MAE_FASE

select * from MAE_USUARIO
select * from MAE_TIPO_USUARIO -- MAE_ROLES_ACCESO
select * from MAE_USUARIO_ROL


select * from [dbo].[MAE_MENU]
select * from [dbo].[MAE_SUBMENU]
select * from [dbo].[MAE_ROL_MENU]
select * from [dbo].[MAE_ROL_SUBMENU]


######################################################################
TABLA MAE_PERFIL

Name	Owner	Type	Created_datetime
MAE_PERFIL	dbo	user table	2025-04-29 05:31:17.217

Column_name	Type	Computed	Length	Prec	Scale	Nullable	TrimTrailingBlanks	FixedLenNullInSource	Collation
ID_PERFIL	int	no	4	10   	0    	no	(n/a)	(n/a)	NULL
DETALLE_PERFIL	varchar	no	20	     	     	no	no	no	SQL_Latin1_General_CP1_CI_AS
ESTADO	bit	no	1	     	     	no	(n/a)	(n/a)	NULL

Identity	Seed	Increment	Not For Replication
ID_PERFIL	1	1	0

RowGuidCol
No rowguidcol column defined.

Data_located_on_filegroup
PRIMARY


constraint_type	constraint_name	delete_action	update_action	status_enabled	status_for_replication	constraint_keys
CHECK on column ESTADO	CK__MAE_PERFI__ESTAD__32767D0B	(n/a)	(n/a)	Enabled	Is_For_Replication	([ESTADO]=(1) OR [ESTADO]=(0))
FOREIGN KEY	FK_MAE_PERFIL_MAE_PERSONA	No Action	No Action	Enabled	Is_For_Replication	ID_PERFIL
 	 	 	 	 	 	REFERENCES SotfHomeData.dbo.MAE_PERSONA (ID_PERSONA)

--DATOS DE LA TABLA MAE_PERFIL
ID_PERFIL	DETALLE_PERFIL	ESTADO
1	Residente	1
2	Seguridad	1
3	Limpieza	1
4	Administrador	1



######################################################################
TABLA MAE_PERSONA

Name	Owner	Type	Created_datetime
MAE_PERSONA	dbo	user table	2025-04-27 00:59:05.510

Column_name	Type	Computed	Length	Prec	Scale	Nullable	TrimTrailingBlanks	FixedLenNullInSource	Collation
ID_PERSONA	int	no	4	10   	0    	no	(n/a)	(n/a)	NULL
NOMBRES	varchar	no	50	     	     	no	no	no	SQL_Latin1_General_CP1_CI_AS
APELLIDOS	varchar	no	50	     	     	no	no	no	SQL_Latin1_General_CP1_CI_AS
DNI	varchar	no	12	     	     	yes	no	yes	SQL_Latin1_General_CP1_CI_AS
CORREO	varchar	no	100	     	     	yes	no	yes	SQL_Latin1_General_CP1_CI_AS
CELULAR	varchar	no	9	     	     	yes	no	yes	SQL_Latin1_General_CP1_CI_AS
CONTACTO_EMERGENCIA	varchar	no	9	     	     	yes	no	yes	SQL_Latin1_General_CP1_CI_AS
FECHA_NACIMIENTO	date	no	3	10   	0    	yes	(n/a)	(n/a)	NULL
ID_SEXO	int	no	4	10   	0    	no	(n/a)	(n/a)	NULL
ESTADO	bit	no	1	     	     	no	(n/a)	(n/a)	NULL

Identity	Seed	Increment	Not For Replication
ID_PERSONA	1	1	0

Identity	Seed	Increment	Not For Replication
ID_PERSONA	1	1	0

RowGuidCol
No rowguidcol column defined.

index_name	index_description	index_keys
PK__MAE_PERS__78244149BD128D6C	clustered, unique, primary key located on PRIMARY	ID_PERSONA
UQ_MAE_PERSONA_DNI	nonclustered, unique, unique key located on PRIMARY	DNI


constraint_type	constraint_name	delete_action	update_action	status_enabled	status_for_replication	constraint_keys
CHECK on column ESTADO	CK__MAE_PERSO__ESTAD__719CDDE7	(n/a)	(n/a)	Enabled	Is_For_Replication	([ESTADO]=(1) OR [ESTADO]=(0))
FOREIGN KEY	FK_PERSONA_SEXO	No Action	No Action	Enabled	Is_For_Replication	ID_SEXO
 	 	 	 	 	 	REFERENCES SotfHomeData.dbo.MAE_SEXO (ID_SEXO)
PRIMARY KEY (clustered)	PK__MAE_PERS__78244149BD128D6C	(n/a)	(n/a)	(n/a)	(n/a)	ID_PERSONA
UNIQUE (non-clustered)	UQ_MAE_PERSONA_DNI	(n/a)	(n/a)	(n/a)	(n/a)	DNI

Table is referenced by foreign key
SotfHomeData.dbo.MAE_PERFIL: FK_MAE_PERFIL_MAE_PERSONA
SotfHomeData.dbo.MAE_PERSONA_FOTO: FK_PERSONA_FOTO_PERSONA
SotfHomeData.dbo.MAE_RESIDENTE: FK_MAE_USUARIO_DEPARTAMENTO_MAE_PERSONA
SotfHomeData.dbo.MAE_TRABAJADOR_FASE: FK_MAE_TRABAJADOR_FASE_MAE_PERSONA
SotfHomeData.dbo.MAE_USUARIO: FK_USUARIO_PERSONA


--TABLA MAE_PERSONA

ID_PERSONA	NOMBRES	APELLIDOS	DNI	CORREO	CELULAR	CONTACTO_EMERGENCIA	FECHA_NACIMIENTO	ID_SEXO	ESTADO	ID_PERFIL
1	Carlos Enrique	Pérez	12345678	jorgejesus_30@outlook.com	987654321	NULL	1997-06-30	1	1	1
2	Jorge Jesus	Terrones Lopez	74944387	zerguiter001@gmail.com	970115159	NULL	1997-06-30	1	1	1
3	Sandro	Saavedra	74988567	saavedracastrosandro@gmail.com	970114785	NULL	2000-01-30	1	1	1
4	Natalie Mishel	Ayra Yauri	71332071	Nata.17596@gmail.com	923445678	NULL	1996-05-17	2	1	1
5	Renimer Junior	Rojas Lopez	76547898	renimerjuniorjesusrojaslopez@gmail.com	933089810	NULL	2006-03-22	2	1	1
6	JACKY	LOPEZ MATIAS	08671478	lopez.matias@gmail.com	992560471	NULL	1968-05-10	2	1	1
7	Juanita	Torres Suarez	75544876	Juanita_torrez@gmail.com	976332655	976332655	2000-01-01	2	1	2
8	Neymar Messi	Gonzalo Prada	74944323	Neymar.messi@gmail.com	980443276	980443276	1997-04-20	2	1	2
9	keoma	perez sifuentes	71286893	keomanps@gmail.com	908721007	NULL	1995-07-01	1	1	1
10	MARIA	LOPEZ	87654321	usuario10@example.com	912345678	911223344	1995-06-15	2	1	2
12	RENIMER	ROJAS SAAVEDRA	74944386	usuario12@example.com	970115159	992560471	1997-06-30	1	1	1
13	MARADONA 	SANTOS QUEVEDO	74876583	usuario13@example.com	992568437	992560471	1995-06-30	1	1	1
14	KAKAROTO	GOGOKU MEZ	12345684	usuario14@example.com	987654321	911111111	1990-10-10	1	1	2
15	AMNER 	SALAZAR VEGA	74897542	usuario15@example.com	970115148	NULL	1997-05-30	2	1	1
#######################################################################
TABLA MAE_SEXO

Name	Owner	Type	Created_datetime
MAE_SEXO	dbo	user table	2025-04-27 00:59:07.883


Column_name	Type	Computed	Length	Prec	Scale	Nullable	TrimTrailingBlanks	FixedLenNullInSource	Collation
ID_SEXO	int	no	4	10   	0    	no	(n/a)	(n/a)	NULL
DESCRIPCION	varchar	no	10	     	     	no	no	no	SQL_Latin1_General_CP1_CI_AS


Identity	Seed	Increment	Not For Replication
ID_SEXO	1	1	0


RowGuidCol
No rowguidcol column defined.


index_name	index_description	index_keys
PK__MAE_SEXO__F5FF4DDC2BBF9B1F	clustered, unique, primary key located on PRIMARY	ID_SEXO
UQ__MAE_SEXO__794449EFF27D234E	nonclustered, unique, unique key located on PRIMARY	DESCRIPCION


constraint_type	constraint_name	delete_action	update_action	status_enabled	status_for_replication	constraint_keys
CHECK on column DESCRIPCION	CK__MAE_SEXO__DESCRI__7B264821	(n/a)	(n/a)	Enabled	Is_For_Replication	([DESCRIPCION]='Femenino' OR [DESCRIPCION]='Masculino')
PRIMARY KEY (clustered)	PK__MAE_SEXO__F5FF4DDC2BBF9B1F	(n/a)	(n/a)	(n/a)	(n/a)	ID_SEXO
UNIQUE (non-clustered)	UQ__MAE_SEXO__794449EFF27D234E	(n/a)	(n/a)	(n/a)	(n/a)	DESCRIPCION

Table is referenced by foreign key
SotfHomeData.dbo.MAE_PERSONA: FK_PERSONA_SEXO

--TABLA MAE_SEXO
ID_SEXO	DESCRIPCION
2	Femenino
1	Masculino


########################################################################

dbo.MAE_PERSONA_FOTO

Identity	Seed	Increment	Not For Replication
ID_FOTO	1	1	0

Column_name	Type	Computed	Length	Prec	Scale	Nullable	TrimTrailingBlanks	FixedLenNullInSource	Collation
ID_FOTO	int	no	4	10   	0    	no	(n/a)	(n/a)	NULL
ID_PERSONA	int	no	4	10   	0    	no	(n/a)	(n/a)	NULL
FOTO	varbinary	no	-1	     	     	no	no	no	NULL
FORMATO	varchar	no	10	     	     	no	no	no	SQL_Latin1_General_CP1_CI_AS
FECHA_SUBIDA	datetime	no	8	     	     	no	(n/a)	(n/a)	NULL
ESTADO	bit	no	1	     	     	no	(n/a)	(n/a)	NULL

constraint_type	constraint_name	delete_action	update_action	status_enabled	status_for_replication	constraint_keys
CHECK on column ESTADO	CK__MAE_PERSO__ESTAD__41B8C09B	(n/a)	(n/a)	Enabled	Is_For_Replication	([ESTADO]=(1) OR [ESTADO]=(0))
DEFAULT on column ESTADO	DF__MAE_PERSO__ESTAD__40C49C62	(n/a)	(n/a)	(n/a)	(n/a)	((1))
DEFAULT on column FECHA_SUBIDA	DF__MAE_PERSO__FECHA__3FD07829	(n/a)	(n/a)	(n/a)	(n/a)	(getdate())
FOREIGN KEY	FK_PERSONA_FOTO_PERSONA	Cascade	No Action	Enabled	Is_For_Replication	ID_PERSONA
 	 	 	 	 	 	REFERENCES SotfHomeData.dbo.MAE_PERSONA (ID_PERSONA)
PRIMARY KEY (clustered)	PK__MAE_PERS__61DFD4CFF2F3BD1B	(n/a)	(n/a)	(n/a)	(n/a)	ID_FOTO

index_name	index_description	index_keys
PK__MAE_PERS__61DFD4CFF2F3BD1B	clustered, unique, primary key located on PRIMARY	ID_FOTO

########################################################################


TABLA MAE_TRABAJADOR_FASE

Name	Owner	Type	Created_datetime
MAE_TRABAJADOR_FASE	dbo	user table	2025-04-27 00:58:53.353

Column_name	Type	Computed	Length	Prec	Scale	Nullable	TrimTrailingBlanks	FixedLenNullInSource	Collation
ID_TRABAJADOR	int	no	4	10   	0    	no	(n/a)	(n/a)	NULL
ID_FASE	int	no	4	10   	0    	no	(n/a)	(n/a)	NULL
FECHA_ASIGNACION	date	no	3	10   	0    	no	(n/a)	(n/a)	NULL
ESTADO	bit	no	1	     	     	no	(n/a)	(n/a)	NULL

Identity	Seed	Increment	Not For Replication
No identity column defined.	NULL	NULL	NULL

RowGuidCol
No rowguidcol column defined.

Data_located_on_filegroup
PRIMARY

index_name	index_description	index_keys
PK__MAE_USUA__F7DFF2B6F8F8D255	clustered, unique, primary key located on PRIMARY	ID_TRABAJADOR, ID_FASE

constraint_type	constraint_name	delete_action	update_action	status_enabled	status_for_replication	constraint_keys
CHECK on column ESTADO	CK__MAE_USUAR__ESTAD__7FEAFD3E	(n/a)	(n/a)	Enabled	Is_For_Replication	([ESTADO]=(1) OR [ESTADO]=(0))
DEFAULT on column FECHA_ASIGNACION	DF__MAE_USUAR__FECHA__25518C17	(n/a)	(n/a)	(n/a)	(n/a)	(getdate())
FOREIGN KEY	FK_MAE_TRABAJADOR_FASE_MAE_PERSONA	No Action	No Action	Enabled	Is_For_Replication	ID_TRABAJADOR
 	 	 	 	 	 	REFERENCES SotfHomeData.dbo.MAE_PERSONA (ID_PERSONA)
FOREIGN KEY	FK_USUARIO_FASE_FASE	Cascade	No Action	Enabled	Is_For_Replication	ID_FASE
 	 	 	 	 	 	REFERENCES SotfHomeData.dbo.MAE_FASE (ID_FASE)
PRIMARY KEY (clustered)	PK__MAE_USUA__F7DFF2B6F8F8D255	(n/a)	(n/a)	(n/a)	(n/a)	ID_TRABAJADOR, ID_FASE

--DATOS DE TABLA MAE_TRABAJADOR_FASE
ID_TRABAJADOR	ID_FASE	FECHA_ASIGNACION	ESTADO
7	2	2025-04-30	1
8	2	2025-04-30	1
10	1	2025-04-30	1
10	2	2025-04-30	1
14	1	2025-04-30	1

########################################################################


TABLA MAE_RESIDENTE

Name	Owner	Type	Created_datetime
MAE_RESIDENTE	dbo	user table	2025-04-27 00:59:08.253

Column_name	Type	Computed	Length	Prec	Scale	Nullable	TrimTrailingBlanks	FixedLenNullInSource	Collation
ID_RESIDENTE	int	no	4	10   	0    	no	(n/a)	(n/a)	NULL
ESTADO	bit	no	1	     	     	yes	(n/a)	(n/a)	NULL
ID_PERSONA	int	no	4	10   	0    	no	(n/a)	(n/a)	NULL
ID_DEPARTAMENTO	int	no	4	10   	0    	no	(n/a)	(n/a)	NULL
ID_CLASIFICACION	int	no	4	10   	0    	no	(n/a)	(n/a)	NULL
INICIO_RESIDENCIA	date	no	3	10   	0    	no	(n/a)	(n/a)	NULL
FIN_RESIDENCIA	date	no	3	10   	0    	yes	(n/a)	(n/a)	NULL

Identity	Seed	Increment	Not For Replication
ID_RESIDENTE	1	1	0

RowGuidCol
No rowguidcol column defined.

Data_located_on_filegroup
PRIMARY

index_name	index_description	index_keys
PK__MAE_USUA__97BC66B5A4754547	clustered, unique, primary key located on PRIMARY	ID_RESIDENTE

constraint_type	constraint_name	delete_action	update_action	status_enabled	status_for_replication	constraint_keys
DEFAULT on column ESTADO	DF__MAE_USUAR__ESTAD__245D67DE	(n/a)	(n/a)	(n/a)	(n/a)	((1))
FOREIGN KEY	FK_MAE_RESIDENTE_MAE_TIPO_RESIDENTE	No Action	No Action	Enabled	Is_For_Replication	ID_CLASIFICACION
 	 	 	 	 	 	REFERENCES SotfHomeData.dbo.MAE_TIPO_RESIDENTE (ID_CLASIFICACION)
FOREIGN KEY	FK_MAE_USUARIO_DEPARTAMENTO_MAE_DEPARTAMENTO	No Action	No Action	Enabled	Is_For_Replication	ID_DEPARTAMENTO
 	 	 	 	 	 	REFERENCES SotfHomeData.dbo.MAE_DEPARTAMENTO (ID_DEPARTAMENTO)
FOREIGN KEY	FK_MAE_USUARIO_DEPARTAMENTO_MAE_PERSONA	No Action	No Action	Enabled	Is_For_Replication	ID_PERSONA
 	 	 	 	 	 	REFERENCES SotfHomeData.dbo.MAE_PERSONA (ID_PERSONA)
PRIMARY KEY (clustered)	PK__MAE_USUA__97BC66B5A4754547	(n/a)	(n/a)	(n/a)	(n/a)	ID_RESIDENTE
--TABLA MAE_RESIDENTE

ID_RESIDENTE	ESTADO	ID_PERSONA	ID_DEPARTAMENTO	ID_CLASIFICACION	INICIO_RESIDENCIA	FIN_RESIDENCIA
1	1	1	1	1	2025-01-01	NULL
2	1	2	5	1	2025-01-01	NULL
3	1	3	3	1	2025-01-01	NULL
4	1	4	5	1	2025-01-01	NULL
5	1	5	6	1	2025-01-01	NULL
6	1	6	7	1	2025-01-01	NULL
7	1	7	8	1	2025-01-01	NULL
8	1	8	2	1	2025-01-01	NULL
9	1	9	4	1	2025-01-01	NULL

########################################################################

Name	Owner	Type	Created_datetime
MAE_TIPO_RESIDENTE	dbo	user table	2025-04-30 05:51:10.550

Column_name	Type	Computed	Length	Prec	Scale	Nullable	TrimTrailingBlanks	FixedLenNullInSource	Collation
ID_CLASIFICACION	int	no	4	10   	0    	no	(n/a)	(n/a)	NULL
DETALLE_CLASIFICACION	varchar	no	20	     	     	no	no	no	SQL_Latin1_General_CP1_CI_AS
ESTADO	bit	no	1	     	     	no	(n/a)	(n/a)	NULL

Identity	Seed	Increment	Not For Replication
ID_CLASIFICACION	1	1	0

RowGuidCol
No rowguidcol column defined.

Data_located_on_filegroup
PRIMARY

index_name	index_description	index_keys
PK_MAE_TIPO_RESIDENTE	clustered, unique, primary key located on PRIMARY	ID_CLASIFICACION


constraint_type	constraint_name	delete_action	update_action	status_enabled	status_for_replication	constraint_keys
CHECK on column ESTADO	CK__MAE_TIPO___ESTAD__373B3228	(n/a)	(n/a)	Enabled	Is_For_Replication	([ESTADO]=(1) OR [ESTADO]=(0))
PRIMARY KEY (clustered)	PK_MAE_TIPO_RESIDENTE	(n/a)	(n/a)	(n/a)	(n/a)	ID_CLASIFICACION

Table is referenced by foreign key
SotfHomeData.dbo.MAE_RESIDENTE: FK_MAE_RESIDENTE_MAE_TIPO_RESIDENTE

--TABLA MAE_TIPO_RESIDENTE

ID_CLASIFICACION	DETALLE_CLASIFICACION	ESTADO
1	PROPIETARIO	1
2	INQUILINO	1
3	FAM. PROPIETARIO	1
4	FAM. INQUILINO	1

########################################################################

Name	Owner	Type	Created_datetime
MAE_DEPARTAMENTO	dbo	user table	2025-04-27 00:58:59.800

Column_name	Type	Computed	Length	Prec	Scale	Nullable	TrimTrailingBlanks	FixedLenNullInSource	Collation
NRO_DPTO	int	no	4	10   	0    	no	(n/a)	(n/a)	NULL
DESCRIPCION	varchar	no	100	     	     	yes	no	yes	SQL_Latin1_General_CP1_CI_AS
ESTADO	bit	no	1	     	     	no	(n/a)	(n/a)	NULL
ID_DEPARTAMENTO	int	no	4	10   	0    	no	(n/a)	(n/a)	NULL
ID_FASE	int	no	4	10   	0    	no	(n/a)	(n/a)	NULL

Identity	Seed	Increment	Not For Replication
ID_DEPARTAMENTO	1	1	0

RowGuidCol
No rowguidcol column defined.

Data_located_on_filegroup
PRIMARY

Identity	Seed	Increment	Not For Replication
ID_DEPARTAMENTO	1	1	0

constraint_type	constraint_name	delete_action	update_action	status_enabled	status_for_replication	constraint_keys
CHECK on column ESTADO	CK__MAE_DEPAR__ESTAD__58D1301D	(n/a)	(n/a)	Enabled	Is_For_Replication	([ESTADO]=(1) OR [ESTADO]=(0))
DEFAULT on column ESTADO	DF__MAE_DEPAR__ESTAD__17F790F9	(n/a)	(n/a)	(n/a)	(n/a)	((1))
FOREIGN KEY	FK_MAE_DEPARTAMENTO_MAE_FASE	No Action	No Action	Enabled	Is_For_Replication	ID_FASE
 	 	 	 	 	 	REFERENCES SotfHomeData.dbo.MAE_FASE (ID_FASE)
PRIMARY KEY (clustered)	PK_MAE_DEPARTAMENTO	(n/a)	(n/a)	(n/a)	(n/a)	ID_DEPARTAMENTO


Table is referenced by foreign key
SotfHomeData.dbo.MAE_MASCOTA: FK_MAE_MASCOTA_MAE_DEPARTAMENTO
SotfHomeData.dbo.MAE_RESIDENTE: FK_MAE_USUARIO_DEPARTAMENTO_MAE_DEPARTAMENTO

--TABLA MAE_DEPARTAMENTO

NRO_DPTO	DESCRIPCION	ESTADO	ID_DEPARTAMENTO	ID_FASE
101	101	1	1	2
1401	1401	1	2	2
2005	2005	1	3	2
2606	2606	1	4	2
2705	2705	1	5	2
2706	2706	1	6	2
2786	2786	1	7	2
2801	2801	1	8	2

########################################################################

Name	Owner	Type	Created_datetime
MAE_FASE	dbo	user table	2025-04-27 00:58:52.953

Column_name	Type	Computed	Length	Prec	Scale	Nullable	TrimTrailingBlanks	FixedLenNullInSource	Collation
ID_FASE	int	no	4	10   	0    	no	(n/a)	(n/a)	NULL
NOMBRE	varchar	no	20	     	     	no	no	no	SQL_Latin1_General_CP1_CI_AS
DESCRIPCION	varchar	no	255	     	     	yes	no	yes	SQL_Latin1_General_CP1_CI_AS
ESTADO	bit	no	1	     	     	no	(n/a)	(n/a)	NULL

Identity	Seed	Increment	Not For Replication
ID_FASE	1	1	0

RowGuidCol
No rowguidcol column defined.

Data_located_on_filegroup
PRIMARY

index_name	index_description	index_keys
PK__MAE_FASE__6CC9926745A57A5B	clustered, unique, primary key located on PRIMARY	ID_FASE
UQ__MAE_FASE__B21D0AB9A2F88E91	nonclustered, unique, unique key located on PRIMARY	NOMBRE

constraint_type	constraint_name	delete_action	update_action	status_enabled	status_for_replication	constraint_keys
CHECK on column ESTADO	CK__MAE_FASE__ESTADO__65370702	(n/a)	(n/a)	Enabled	Is_For_Replication	([ESTADO]=(1) OR [ESTADO]=(0))
CHECK on column NOMBRE	CK__MAE_FASE__NOMBRE__662B2B3B	(n/a)	(n/a)	Enabled	Is_For_Replication	([NOMBRE]='Fase3' OR [NOMBRE]='Fase2' OR [NOMBRE]='Fase1')
PRIMARY KEY (clustered)	PK__MAE_FASE__6CC9926745A57A5B	(n/a)	(n/a)	(n/a)	(n/a)	ID_FASE
UNIQUE (non-clustered)	UQ__MAE_FASE__B21D0AB9A2F88E91	(n/a)	(n/a)	(n/a)	(n/a)	NOMBRE

--TABLA MAE_FASE

ID_FASE	NOMBRE	DESCRIPCION	ESTADO
1	Fase1	Primera fase de la torre	1
2	Fase2	Segunda fase de la torre	1
3	Fase3	Tercera fase de la torre	1


########################################################################
TABLA MAE_USUARIO

Name	Owner	Type	Created_datetime
MAE_USUARIO	dbo	user table	2025-04-27 00:58:51.717

Column_name	Type	Computed	Length	Prec	Scale	Nullable	TrimTrailingBlanks	FixedLenNullInSource	Collation
ID_USUARIO	int	no	4	10   	0    	no	(n/a)	(n/a)	NULL
USUARIO	varchar	no	50	     	     	no	no	no	SQL_Latin1_General_CP1_CI_AS
CONTRASENA_HASH	varchar	no	255	     	     	no	no	no	SQL_Latin1_General_CP1_CI_AS
CONTRASENA_SALT	varchar	no	50	     	     	no	no	no	SQL_Latin1_General_CP1_CI_AS
ESTADO	bit	no	1	     	     	no	(n/a)	(n/a)	NULL
PRIMER_INICIO	bit	no	1	     	     	no	(n/a)	(n/a)	NULL
DESCRIPTOR_FACIAL	nvarchar	no	-1	     	     	yes	(n/a)	(n/a)	SQL_Latin1_General_CP1_CI_AS
ID_PERSONA	int	no	4	10   	0    	no	(n/a)	(n/a)	NULL


Identity	Seed	Increment	Not For Replication
ID_USUARIO	1	1	0


RowGuidCol
No rowguidcol column defined.


Data_located_on_filegroup
PRIMARY

index_name	index_description	index_keys
PK__MAE_USUA__91136B90F99C23B9	clustered, unique, primary key located on PRIMARY	ID_USUARIO


constraint_type	constraint_name	delete_action	update_action	status_enabled	status_for_replication	constraint_keys
CHECK on column ESTADO	CK__MAE_USUAR__ESTAD__7EF6D905	(n/a)	(n/a)	Enabled	Is_For_Replication	([ESTADO]=(1) OR [ESTADO]=(0))
DEFAULT on column PRIMER_INICIO	DF__MAE_USUAR__PRIME__236943A5	(n/a)	(n/a)	(n/a)	(n/a)	((1))
FOREIGN KEY	FK_USUARIO_PERSONA	No Action	No Action	Enabled	Is_For_Replication	ID_PERSONA
 	 	 	 	 	 	REFERENCES SotfHomeData.dbo.MAE_PERSONA (ID_PERSONA)
PRIMARY KEY (clustered)	PK__MAE_USUA__91136B90F99C23B9	(n/a)	(n/a)	(n/a)	(n/a)	ID_USUARIO


Table is referenced by foreign key
SotfHomeData.dbo.MAE_ACCESO_PUERTA: FK_ACCESO_USUARIO
SotfHomeData.dbo.MAE_ACTA: FK_ACTA_USUARIO
SotfHomeData.dbo.MAE_AVISO: FK_AVISO_USUARIO
SotfHomeData.dbo.MAE_CUENTA_MANCOMUNADA: FK_CUENTA_USUARIO
SotfHomeData.dbo.MAE_DEUDOR: FK_DEUDOR_USUARIO_ID
SotfHomeData.dbo.MAE_DOCUMENTO_ADMIN: FK_DOCUMENTO_USUARIO
SotfHomeData.dbo.MAE_ENCARGO: FK_ENCARGO_USUARIO_ENTREGA
SotfHomeData.dbo.MAE_ENCARGO: FK_ENCARGO_USUARIO_RECEPCION
SotfHomeData.dbo.MAE_EVENTO: FK_EVENTO_USUARIO
SotfHomeData.dbo.MAE_IMAGENES_LOGIN: FK_IMAGEN_USUARIO
SotfHomeData.dbo.MAE_INCIDENCIA: FK_INCIDENCIA_USUARIO_REPORTE
SotfHomeData.dbo.MAE_INCIDENCIA: FK_INCIDENCIA_USUARIO_RESOLUCION
SotfHomeData.dbo.MAE_MANTENIMIENTO: FK_MANTENIMIENTO_USUARIO
SotfHomeData.dbo.MAE_USUARIO_ROL: FK_USUARIO_ROL_USUARIO
SotfHomeData.dbo.MAE_VISITA: FK_VISITA_PROPIETARIO
SotfHomeData.dbo.MAE_VISITA: FK_VISITA_USUARIO


TABLA MAE_USUARIO

ID_USUARIO	USUARIO	CONTRASENA_HASH	CONTRASENA_SALT	ESTADO	PRIMER_INICIO	DESCRIPTOR_FACIAL	ID_PERSONA
4	juanperez	$2b$10$SCXTO9yefW26Siobp16n0uVZ3rQ4AKXay9/wh8/3KBUXqLVFQAZ8W	$2b$10$SCXTO9yefW26Siobp16n0u	1	0	NULL	1
5	Jterrones	$2b$10$UfkKlR2dFK1Zv3jvLMaO6.HAk9581RHKlw4xHkzDvtno0rqeJ0icC	$2b$10$UfkKlR2dFK1Zv3jvLMaO6.	1	0	NULL	2
6	SandroSaavedra	$2b$06$6yhfsQ6qgSpk7z83pMJVS.eLzlYDD.k7kQRbQIDp5ETnZEBjjAPsa	$2b$06$6yhfsQ6qgSpk7z83pMJVS.	1	1	NULL	3
11	Natalie	$2b$10$NgR2Kz3iwKzddEXzpvkkVe04XZ4cu8qOpPkGW.sDVYYzLBo1oW/IO	$2b$10$NgR2Kz3iwKzddEXzpvkkVe	1	0	NULL	4
12	JuniorRojas	$2b$10$tAT8Wv6nYpHeaPOsCDN0ueHRDU9FL6WUH8dN8X6vWPRcNOM4wlqmm	$2b$10$tAT8Wv6nYpHeaPOsCDN0ue	1	0	NULL	5
14	jackyLopez	$2b$10$pAx3BF6QGKBs1jaxp0fXkeUejVu4N7PAjJTTaDSm3b1OcGthKd9zC	$2b$10$pAx3BF6QGKBs1jaxp0fXke	1	1	NULL	6
15	jtorressuarez	$2b$10$tkFEwXHLCZXQEbHDF/ek6uqCynPuuG8aTDgku9QxIDMHik/H0WkBm	$2b$10$tkFEwXHLCZXQEbHDF/ek6u	1	1	NULL	7
16	ngonzaloprada	$2b$10$n6T2x8jNIh/IRLWRTq0tCeFnvqSUdDEWlSPmBuh3Of2RROuXAmuuy	$2b$10$n6T2x8jNIh/IRLWRTq0tCe	1	1	NULL	8
17	kperezsifuentes	$2b$06$Ep4gKH7vAH3ZK3ysrvwulOgjLMEJccH1VmiGtjF5m6OeGK7IZZQoS	$2b$06$Ep4gKH7vAH3ZK3ysrvwulO	1	1	NULL	9

#######################################################################
TABLA MAE_TIPO_USUARIO

Name	Owner	Type	Created_datetime
MAE_TIPO_USUARIO	dbo	user table	2025-04-27 00:58:54.527

Column_name	Type	Computed	Length	Prec	Scale	Nullable	TrimTrailingBlanks	FixedLenNullInSource	Collation
ID_ROL	int	no	4	10   	0    	no	(n/a)	(n/a)	NULL
DETALLE_USUARIO	varchar	no	20	     	     	no	no	no	SQL_Latin1_General_CP1_CI_AS
ESTADO	bit	no	1	     	     	no	(n/a)	(n/a)	NULL

Identity	Seed	Increment	Not For Replication
ID_ROL	1	1	0

RowGuidCol
No rowguidcol column defined.

Data_located_on_filegroup
PRIMARY

index_name	index_description	index_keys
PK__MAE_TIPO__85A0596820677CE1	clustered, unique, primary key located on PRIMARY	ID_ROL
UQ__MAE_TIPO__EB9207D570719CEB	nonclustered, unique, unique key located on PRIMARY	DETALLE_USUARIO


constraint_type	constraint_name	delete_action	update_action	status_enabled	status_for_replication	constraint_keys
CHECK on column ESTADO	CK__MAE_TIPO___ESTAD__7D0E9093	(n/a)	(n/a)	Enabled	Is_For_Replication	([ESTADO]=(1) OR [ESTADO]=(0))
PRIMARY KEY (clustered)	PK__MAE_TIPO__85A0596820677CE1	(n/a)	(n/a)	(n/a)	(n/a)	ID_ROL
UNIQUE (non-clustered)	UQ__MAE_TIPO__EB9207D570719CEB	(n/a)	(n/a)	(n/a)	(n/a)	DETALLE_USUARIO


Table is referenced by foreign key
SotfHomeData.dbo.MAE_AVISO_PERMISOS: FK_AVISO_PERMISOS_TIPO_USUARIO
SotfHomeData.dbo.MAE_DOCUMENTO_PERMISOS: FK_DOCUMENTO_PERMISOS_TIPO_USUARIO
SotfHomeData.dbo.MAE_EVENTO_PERMISOS: FK_EVENTO_PERMISOS_TIPO_USUARIO
SotfHomeData.dbo.MAE_PERMISOS_DASHBOARD: FK_PERMISO_TIPO_USUARIO
SotfHomeData.dbo.MAE_QR_TIPO_USUARIO: FK_QR_TIPO_TIPO_USUARIO
SotfHomeData.dbo.MAE_ROL_MENU: FK_ROL_MENU_TIPO
SotfHomeData.dbo.MAE_ROL_SUBMENU: FK_ROL_SUBMENU_TIPO
SotfHomeData.dbo.MAE_USUARIO_ROL: FK_USUARIO_ROL_TIPO

--TABLA MAE_TIPO_USUARIO
ID_ROL	DETALLE_USUARIO	ESTADO
1	Sistemas	1
2	Administrador	1
3	Seguridad	1
4	Propietario	1
5	Inquilino	1
6	Comité	1

#######################################################################
TABLA MAE_USUARIO_ROL

Name	Owner	Type	Created_datetime
MAE_USUARIO_ROL	dbo	user table	2025-04-27 00:59:08.653

Column_name	Type	Computed	Length	Prec	Scale	Nullable	TrimTrailingBlanks	FixedLenNullInSource	Collation
ID_USUARIO	int	no	4	10   	0    	no	(n/a)	(n/a)	NULL
ID_ROL	int	no	4	10   	0    	no	(n/a)	(n/a)	NULL

Identity	Seed	Increment	Not For Replication
No identity column defined.	NULL	NULL	NULL

RowGuidCol
No rowguidcol column defined.

Data_located_on_filegroup
PRIMARY

index_name	index_description	index_keys
PK_USUARIO_ROL	clustered, unique, primary key located on PRIMARY	ID_USUARIO, ID_ROL

constraint_type	constraint_name	delete_action	update_action	status_enabled	status_for_replication	constraint_keys
FOREIGN KEY	FK_USUARIO_ROL_TIPO	Cascade	No Action	Enabled	Is_For_Replication	ID_ROL
 	 	 	 	 	 	REFERENCES SotfHomeData.dbo.MAE_TIPO_USUARIO (ID_ROL)
FOREIGN KEY	FK_USUARIO_ROL_USUARIO	Cascade	No Action	Enabled	Is_For_Replication	ID_USUARIO
 	 	 	 	 	 	REFERENCES SotfHomeData.dbo.MAE_USUARIO (ID_USUARIO)
PRIMARY KEY (clustered)	PK_USUARIO_ROL	(n/a)	(n/a)	(n/a)	(n/a)	ID_USUARIO, ID_ROL



--TABLA MAE_USUARIO_ROL
ID_USUARIO	ID_ROL
4	1
5	2
5	6
6	1
11	4
12	4
14	4
15	4
16	4
17	1

######################################################################


-- 馃搨 Tabla MAE_MENU (Main Menus)
CREATE TABLE dbo.MAE_MENU
(
    ID_MENU INT IDENTITY(1,1) PRIMARY KEY,
    NOMBRE VARCHAR(50) NOT NULL UNIQUE,
    ICONO VARCHAR(50) NULL,
    URL VARCHAR(100) NULL,
    ORDEN INT NOT NULL,
    ESTADO BIT NOT NULL CHECK (ESTADO IN (0, 1))
);
GO

-- 馃搨 Tabla MAE_SUBMENU (Submenus)
CREATE TABLE dbo.MAE_SUBMENU
(
    ID_SUBMENU INT IDENTITY(1,1) PRIMARY KEY,
    ID_MENU INT NOT NULL,
    NOMBRE VARCHAR(50) NOT NULL UNIQUE,
    ICONO VARCHAR(50) NULL,
    URL VARCHAR(100) NOT NULL,
    ORDEN INT NOT NULL,
    ESTADO BIT NOT NULL CHECK (ESTADO IN (0, 1)),

    -- Clave for谩nea
    CONSTRAINT FK_SUBMENU_MENU FOREIGN KEY (ID_MENU) REFERENCES MAE_MENU(ID_MENU) ON DELETE CASCADE
);



-- 馃攼 Tabla MAE_ROL_MENU (Permisos de Men煤 por Rol)
CREATE TABLE dbo.MAE_ROL_MENU
(
    ID_ROL INT NOT NULL,
    ID_MENU INT NOT NULL,

    CONSTRAINT FK_ROL_MENU_TIPO FOREIGN KEY (ID_ROL) REFERENCES MAE_TIPO_USUARIO(ID_ROL) ON DELETE CASCADE,
    CONSTRAINT FK_ROL_MENU_MENU FOREIGN KEY (ID_MENU) REFERENCES MAE_MENU(ID_MENU) ON DELETE CASCADE,
    CONSTRAINT PK_ROL_MENU PRIMARY KEY (ID_ROL, ID_MENU) -- Clave primaria compuesta
);


-- 馃攼 Tabla MAE_ROL_SUBMENU (Permisos de Submen煤 por Rol)
CREATE TABLE dbo.MAE_ROL_SUBMENU
(
    ID_ROL INT NOT NULL,
    ID_SUBMENU INT NOT NULL,

    CONSTRAINT FK_ROL_SUBMENU_TIPO FOREIGN KEY (ID_ROL) REFERENCES MAE_TIPO_USUARIO(ID_ROL) ON DELETE CASCADE,
    CONSTRAINT FK_ROL_SUBMENU_SUBMENU FOREIGN KEY (ID_SUBMENU) REFERENCES MAE_SUBMENU(ID_SUBMENU) ON DELETE CASCADE,
    CONSTRAINT PK_ROL_SUBMENU PRIMARY KEY (ID_ROL, ID_SUBMENU) -- Clave primaria compuesta
);

######################################################################

DATA DE MENU Y SUBMENUS

-- Ver men煤s activos
SELECT * FROM MAE_MENU WHERE ESTADO = 1;
ID_MENU	NOMBRE	ICONO	URL	ORDEN	ESTADO

1	Usuarios	FaUsers	NULL	1	1
2	Gesti贸n de Ingreso	FaDoorOpen	NULL	2	1
3	Configuraci贸n	FaCogs	NULL	3	1
5	脕reas Comunes	FaBuilding	NULL	4	1
6	Recepci贸n	FaChartPie	NULL	5	1
7	Dashboard	FaHome	/dashboard	0	1

######################################
-- Ver submen煤s activos
SELECT * FROM MAE_SUBMENU WHERE ESTADO = 1;


ID_SUBMENU	ID_MENU	NOMBRE	ICONO	URL	ORDEN	ESTADO
1	1	Registrar Usuarios	FaUsers	/users	1	1
2	1	Lista de Usuarios	FaList	/user-list	2	1
3	2	Control de Ingresos y Salidas	FaDoorOpen	/movements-list	2	1
4	2	Gesti贸n Visitas	FaUserFriends	/visits	1	1
5	3	Login	FaImages	/LoginConfig	2	1
6	3	Cambio Contrase帽a	FaLock	/ChangePass	1	1
7	3	Gesti贸n de Men煤s y Submen煤s	FaListAlt	/menu-submenu	3	1
8	5	Reservas	FaCalendarAlt	/reservas	1	1
9	6	Registrar Encargo	FaClipboardList	/RegisterOrder	1	1
10	2	Visitas Programadas	FaCalendarCheck	/visitasProgramadas	3	1

####################################
-- Ver asignaciones de men煤s para el rol Sistemas (ID_ROL = 1)
SELECT rm.*, m.NOMBRE, m.URL
FROM MAE_ROL_MENU rm
JOIN MAE_MENU m ON rm.ID_MENU = m.ID_MENU
WHERE rm.ID_ROL = 1 AND m.ESTADO = 1;

ID_ROL	ID_MENU	NOMBRE	URL
1	1	Usuarios	NULL
1	2	Gesti贸n de Ingreso	NULL
1	3	Configuraci贸n	NULL
1	5	脕reas Comunes	NULL
1	6	Recepci贸n	NULL
1	7	Dashboard	/dashboard

#################################
-- Ver asignaciones de submen煤s para el rol Sistemas (ID_ROL = 1)
SELECT rs.*, s.NOMBRE, s.URL, s.ID_MENU
FROM MAE_ROL_SUBMENU rs
JOIN MAE_SUBMENU s ON rs.ID_SUBMENU = s.ID_SUBMENU
WHERE rs.ID_ROL = 1 AND s.ESTADO = 1;



ID_ROL	ID_SUBMENU	NOMBRE	URL	ID_MENU
1	1	Registrar Usuarios	/users	1
1	2	Lista de Usuarios	/user-list	1
1	3	Control de Ingresos y Salidas	/movements-list	2
1	4	Gesti贸n Visitas	/visits	2
1	5	Login	/LoginConfig	3
1	6	Cambio Contrase帽a	/ChangePass	3
1	7	Gesti贸n de Men煤s y Submen煤s	/menu-submenu	3
1	8	Reservas	/reservas	5
1	9	Registrar Encargo	/RegisterOrder	6
1	10	Visitas Programadas	/visitasProgramadas	2


