IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'trace')
BEGIN
    EXEC('CREATE SCHEMA trace');
END
GO

--1. ESTRUCTURA INSTITUCIONAL (TENANCY)
CREATE TABLE trace.States (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(100) NOT NULL
);
GO

CREATE TABLE trace.Cecyts (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    StateId UNIQUEIDENTIFIER NOT NULL,
    Name NVARCHAR(150) NOT NULL,
    Code NVARCHAR(20) NOT NULL UNIQUE,
    CONSTRAINT FK_Cecyts_States
        FOREIGN KEY (StateId) REFERENCES trace.States(Id)
);
GO

--2. USUARIOS, ROLES Y PERMISOS (RBAC REAL)
CREATE TABLE trace.Users (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    CecytId UNIQUEIDENTIFIER NOT NULL,
    Email NVARCHAR(150) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL,
    FullName NVARCHAR(150) NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_Users_Cecyts
        FOREIGN KEY (CecytId) REFERENCES trace.Cecyts(Id)
);
GO

CREATE TABLE trace.Roles (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(50) NOT NULL UNIQUE
);
GO

CREATE TABLE trace.Permissions (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Code NVARCHAR(100) NOT NULL UNIQUE,
    Description NVARCHAR(255)
);
GO

CREATE TABLE trace.UserRoles (
    UserId UNIQUEIDENTIFIER NOT NULL,
    RoleId UNIQUEIDENTIFIER NOT NULL,
    PRIMARY KEY (UserId, RoleId),
    CONSTRAINT FK_UserRoles_Users FOREIGN KEY (UserId) REFERENCES trace.Users(Id),
    CONSTRAINT FK_UserRoles_Roles FOREIGN KEY (RoleId) REFERENCES trace.Roles(Id)
);
GO

CREATE TABLE trace.RolePermissions (
    RoleId UNIQUEIDENTIFIER NOT NULL,
    PermissionId UNIQUEIDENTIFIER NOT NULL,
    PRIMARY KEY (RoleId, PermissionId),
    CONSTRAINT FK_RolePermissions_Roles FOREIGN KEY (RoleId) REFERENCES trace.Roles(Id),
    CONSTRAINT FK_RolePermissions_Permissions FOREIGN KEY (PermissionId) REFERENCES trace.Permissions(Id)
);
GO

--3. SEMESTRES (CONTROL DE FECHAS)
CREATE TABLE trace.Semesters (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    StateId UNIQUEIDENTIFIER NOT NULL,
    Name NVARCHAR(50) NOT NULL, -- ej. 2026-1
    StartDate DATE NOT NULL,
    EndDate DATE NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT FK_Semesters_States
        FOREIGN KEY (StateId) REFERENCES trace.States(Id),
    CONSTRAINT CK_Semesters_Dates CHECK (StartDate < EndDate)
);
GO

--4. ACTIVIDADES (SOCIOEMOCIONAL / TRAYECTORIA)
CREATE TABLE trace.Activities (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    CecytId UNIQUEIDENTIFIER NOT NULL,
    SemesterId UNIQUEIDENTIFIER NOT NULL,
    TeacherUserId UNIQUEIDENTIFIER NOT NULL,

    Type VARCHAR(20) NOT NULL, -- SOCIOEMOCIONAL | TRAYECTORIA
    Title NVARCHAR(200) NOT NULL,
    ScheduledDate DATE NOT NULL,

    Status VARCHAR(20) NOT NULL DEFAULT 'ACTIVA',
    -- ACTIVA | REPROGRAMADA | REGISTRADA

    ReprogrammedFromActivityId UNIQUEIDENTIFIER NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    UpdatedAt DATETIME2 NULL,

    CONSTRAINT FK_Activities_Cecyts FOREIGN KEY (CecytId) REFERENCES trace.Cecyts(Id),
    CONSTRAINT FK_Activities_Semesters FOREIGN KEY (SemesterId) REFERENCES trace.Semesters(Id),
    CONSTRAINT FK_Activities_Users FOREIGN KEY (TeacherUserId) REFERENCES trace.Users(Id),
    CONSTRAINT FK_Activities_Reprogram
        FOREIGN KEY (ReprogrammedFromActivityId) REFERENCES trace.Activities(Id),

    CONSTRAINT CK_Activities_Type
        CHECK (Type IN ('SOCIOEMOCIONAL', 'TRAYECTORIA')),

    CONSTRAINT CK_Activities_Status
        CHECK (Status IN ('ACTIVA', 'REPROGRAMADA', 'REGISTRADA', 'CANCELADA'))
);
GO

-- 5. EVIDENCIA FOTOGRÁFICA ?? (CLAVE DEL CUMPLIMIENTO)
CREATE TABLE trace.ActivityEvidence (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ActivityId UNIQUEIDENTIFIER NOT NULL,
    FilePath NVARCHAR(300) NOT NULL,
    FileType NVARCHAR(10) NOT NULL, -- jpg, png
    UploadedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_Evidence_Activities
        FOREIGN KEY (ActivityId) REFERENCES trace.Activities(Id)
);
GO

--6. ÍNDICES (PERFORMANCE REAL)
CREATE INDEX IX_Users_CecytId ON trace.Users(CecytId);
CREATE INDEX IX_Activities_Cecyt_Semester ON trace.Activities(CecytId, SemesterId);
CREATE INDEX IX_Activities_Teacher ON trace.Activities(TeacherUserId);
CREATE INDEX IX_Activities_Type ON trace.Activities(Type);
CREATE INDEX IX_Evidence_ActivityId ON trace.ActivityEvidence(ActivityId);
GO


--7. VISTA PARA DASHBOARD (DIRECTOR / SUPERVISOR)
CREATE VIEW trace.VW_TeacherSemesterCompliance AS
SELECT
    a.CecytId,
    a.SemesterId,
    a.TeacherUserId,

    SUM(CASE WHEN a.Type = 'SOCIOEMOCIONAL' AND a.Status = 'REGISTRADA' THEN 1 ELSE 0 END) 
        AS SocioemocionalRegistradas,

    MAX(CASE WHEN a.Type = 'TRAYECTORIA' AND a.Status = 'REGISTRADA' THEN 1 ELSE 0 END)
        AS TrayectoriaRegistrada

FROM trace.Activities a
GROUP BY
    a.CecytId,
    a.SemesterId,
    a.TeacherUserId;
GO

--8. Seed de Base de Datos (OBLIGATORIO)
--Roles base
INSERT INTO trace.Roles (Id, Name) VALUES
(NEWID(), 'ADMIN'),
(NEWID(), 'DIRECTOR'),
(NEWID(), 'DOCENTE'),
(NEWID(), 'SUPERVISOR');

IF NOT EXISTS (SELECT 1 FROM trace.Roles WHERE Name = 'DIRECTOR')
BEGIN
    INSERT INTO trace.Roles (Id, Name)
    VALUES (NEWID(), 'DIRECTOR');
END

--Permisos base
INSERT INTO trace.Permissions (Id, Code, Description) VALUES
(NEWID(), 'CREATE_ACTIVITY', 'Crear actividades'),
(NEWID(), 'VIEW_OWN_ACTIVITIES', 'Ver actividades propias'),
(NEWID(), 'REGISTER_ACTIVITY', 'Registrar actividad'),
(NEWID(), 'REPROGRAM_ACTIVITY', 'Reprogramar actividad'),
(NEWID(), 'UPLOAD_EVIDENCE', 'Subir evidencia'),
(NEWID(), 'DIRECTOR_DASHBOARD', 'Dashboard director'),
(NEWID(), 'MANAGE_USERS', 'Asignar roles y activar usuarios');

--Asignar permisos a roles
-- DOCENTE
INSERT INTO trace.RolePermissions
SELECT r.Id, p.Id
FROM trace.Roles r
JOIN trace.Permissions p ON p.Code IN (
  'CREATE_ACTIVITY',
  'VIEW_OWN_ACTIVITIES',
  'REGISTER_ACTIVITY',
  'REPROGRAM_ACTIVITY',
  'UPLOAD_EVIDENCE'
)
WHERE r.Name = 'DOCENTE';

-- DIRECTOR
INSERT INTO trace.RolePermissions
SELECT r.Id, p.Id
FROM trace.Roles r
JOIN trace.Permissions p ON p.Code IN (
  'DIRECTOR_DASHBOARD',
  'MANAGE_USERS'
)
WHERE r.Name = 'DIRECTOR';

--ADMIN
INSERT INTO trace.RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id
FROM trace.Roles r
JOIN trace.Permissions p ON p.Code IN (
    'MANAGE_USERS',
    'DIRECTOR_DASHBOARD',
    'CREATE_ACTIVITY',
    'VIEW_OWN_ACTIVITIES',
    'REGISTER_ACTIVITY',
    'REPROGRAM_ACTIVITY',
    'UPLOAD_EVIDENCE'
)
WHERE r.Name = 'ADMIN'
AND NOT EXISTS (
    SELECT 1
    FROM trace.RolePermissions rp
    WHERE rp.RoleId = r.Id
      AND rp.PermissionId = p.Id
);


INSERT INTO trace.RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id
FROM trace.Roles r
JOIN trace.Permissions p ON p.Code = 'MANAGE_USERS'
WHERE r.Name = 'DIRECTOR'
AND NOT EXISTS (
    SELECT 1
    FROM trace.RolePermissions rp
    WHERE rp.RoleId = r.Id
      AND rp.PermissionId = p.Id
);

-- 🇲🇽 INSERT – Estados de México
INSERT INTO trace.States (Id, Name) VALUES
(NEWID(), 'Aguascalientes'),
(NEWID(), 'Baja California'),
(NEWID(), 'Baja California Sur'),
(NEWID(), 'Campeche'),
(NEWID(), 'Chiapas'),
(NEWID(), 'Chihuahua'),
(NEWID(), 'Ciudad de México'),
(NEWID(), 'Coahuila'),
(NEWID(), 'Colima'),
(NEWID(), 'Durango'),
(NEWID(), 'Guanajuato'),
(NEWID(), 'Guerrero'),
(NEWID(), 'Hidalgo'),
(NEWID(), 'Jalisco'),
(NEWID(), 'Estado de México'),
(NEWID(), 'Michoacán'),
(NEWID(), 'Morelos'),
(NEWID(), 'Nayarit'),
(NEWID(), 'Nuevo León'),
(NEWID(), 'Oaxaca'),
(NEWID(), 'Puebla'),
(NEWID(), 'Querétaro'),
(NEWID(), 'Quintana Roo'),
(NEWID(), 'San Luis Potosí'),
(NEWID(), 'Sinaloa'),
(NEWID(), 'Sonora'),
(NEWID(), 'Tabasco'),
(NEWID(), 'Tamaulipas'),
(NEWID(), 'Tlaxcala'),
(NEWID(), 'Veracruz'),
(NEWID(), 'Yucatán'),
(NEWID(), 'Zacatecas');

--Recomendación extra (opcional pero profesional)
CREATE UNIQUE INDEX UX_States_Name ON trace.States(Name);


--🇲🇽 INSERT – CECyT por Estado (1 por cada estado)
INSERT INTO trace.Cecyts (Id, StateId, Name, Code)
SELECT NEWID(), Id, 'CECyT Chiapas', 'CHIS-CECYT-01' FROM trace.States WHERE Name = 'Chiapas'
UNION ALL SELECT NEWID(), Id, 'CECyT Aguascalientes', 'AGS-CECYT-01' FROM trace.States WHERE Name = 'Aguascalientes'


SELECT NEWID(), Id, 'CECyT Aguascalientes', 'AGS-CECYT-01' FROM trace.States WHERE Name = 'Aguascalientes'
UNION ALL SELECT NEWID(), Id, 'CECyT Baja California', 'BC-CECYT-01' FROM trace.States WHERE Name = 'Baja California'
UNION ALL SELECT NEWID(), Id, 'CECyT Baja California Sur', 'BCS-CECYT-01' FROM trace.States WHERE Name = 'Baja California Sur'
UNION ALL SELECT NEWID(), Id, 'CECyT Campeche', 'CAM-CECYT-01' FROM trace.States WHERE Name = 'Campeche'
UNION ALL SELECT NEWID(), Id, 'CECyT Chiapas', 'CHIS-CECYT-01' FROM trace.States WHERE Name = 'Chiapas'
UNION ALL SELECT NEWID(), Id, 'CECyT Chihuahua', 'CHIH-CECYT-01' FROM trace.States WHERE Name = 'Chihuahua'
UNION ALL SELECT NEWID(), Id, 'CECyT Ciudad de México', 'CDMX-CECYT-01' FROM trace.States WHERE Name = 'Ciudad de México'
UNION ALL SELECT NEWID(), Id, 'CECyT Coahuila', 'COAH-CECYT-01' FROM trace.States WHERE Name = 'Coahuila'
UNION ALL SELECT NEWID(), Id, 'CECyT Colima', 'COL-CECYT-01' FROM trace.States WHERE Name = 'Colima'
UNION ALL SELECT NEWID(), Id, 'CECyT Durango', 'DGO-CECYT-01' FROM trace.States WHERE Name = 'Durango'
UNION ALL SELECT NEWID(), Id, 'CECyT Guanajuato', 'GTO-CECYT-01' FROM trace.States WHERE Name = 'Guanajuato'
UNION ALL SELECT NEWID(), Id, 'CECyT Guerrero', 'GRO-CECYT-01' FROM trace.States WHERE Name = 'Guerrero'
UNION ALL SELECT NEWID(), Id, 'CECyT Hidalgo', 'HGO-CECYT-01' FROM trace.States WHERE Name = 'Hidalgo'
UNION ALL SELECT NEWID(), Id, 'CECyT Jalisco', 'JAL-CECYT-01' FROM trace.States WHERE Name = 'Jalisco'
UNION ALL SELECT NEWID(), Id, 'CECyT Estado de México', 'EDOMEX-CECYT-01' FROM States WHERE Name = 'Estado de México'
UNION ALL SELECT NEWID(), Id, 'CECyT Michoacán', 'MICH-CECYT-01' FROM trace.States WHERE Name = 'Michoacán'
UNION ALL SELECT NEWID(), Id, 'CECyT Morelos', 'MOR-CECYT-01' FROM trace.States WHERE Name = 'Morelos'
UNION ALL SELECT NEWID(), Id, 'CECyT Nayarit', 'NAY-CECYT-01' FROM trace.States WHERE Name = 'Nayarit'
UNION ALL SELECT NEWID(), Id, 'CECyT Nuevo León', 'NL-CECYT-01' FROM trace.States WHERE Name = 'Nuevo León'
UNION ALL SELECT NEWID(), Id, 'CECyT Oaxaca', 'OAX-CECYT-01' FROM trace.States WHERE Name = 'Oaxaca'
UNION ALL SELECT NEWID(), Id, 'CECyT Puebla', 'PUE-CECYT-01' FROM trace.States WHERE Name = 'Puebla'
UNION ALL SELECT NEWID(), Id, 'CECyT Querétaro', 'QRO-CECYT-01' FROM trace.States WHERE Name = 'Querétaro'
UNION ALL SELECT NEWID(), Id, 'CECyT Quintana Roo', 'QROO-CECYT-01' FROM trace.States WHERE Name = 'Quintana Roo'
UNION ALL SELECT NEWID(), Id, 'CECyT San Luis Potosí', 'SLP-CECYT-01' FROM trace.States WHERE Name = 'San Luis Potosí'
UNION ALL SELECT NEWID(), Id, 'CECyT Sinaloa', 'SIN-CECYT-01' FROM trace.States WHERE Name = 'Sinaloa'
UNION ALL SELECT NEWID(), Id, 'CECyT Sonora', 'SON-CECYT-01' FROM trace.States WHERE Name = 'Sonora'
UNION ALL SELECT NEWID(), Id, 'CECyT Tabasco', 'TAB-CECYT-01' FROM trace.States WHERE Name = 'Tabasco'
UNION ALL SELECT NEWID(), Id, 'CECyT Tamaulipas', 'TAM-CECYT-01' FROM trace.States WHERE Name = 'Tamaulipas'
UNION ALL SELECT NEWID(), Id, 'CECyT Tlaxcala', 'TLAX-CECYT-01' FROM trace.States WHERE Name = 'Tlaxcala'
UNION ALL SELECT NEWID(), Id, 'CECyT Veracruz', 'VER-CECYT-01' FROM trace.States WHERE Name = 'Veracruz'
UNION ALL SELECT NEWID(), Id, 'CECyT Yucatán', 'YUC-CECYT-01' FROM trace.States WHERE Name = 'Yucatán'
UNION ALL SELECT NEWID(), Id, 'CECyT Zacatecas', 'ZAC-CECYT-01' FROM trace.States WHERE Name = 'Zacatecas';


--🇲🇽 INSERT – Crear semestre para TODOS los estados
INSERT INTO trace.Semesters (Id, StateId, Name, StartDate, EndDate, IsActive)
SELECT
    NEWID(),
    Id AS StateId,
    '2026-1' AS Name,
    '2026-01-15' AS StartDate,
    '2026-07-15' AS EndDate,
    1 AS IsActive
FROM trace.States;

--Verificación rápida
SELECT
    s.Name AS State,
    se.Name AS Semester,
    se.StartDate,
    se.EndDate,
    se.IsActive
FROM trace.Semesters se
JOIN trace.States s ON s.Id = se.StateId
ORDER BY s.Name;


select * from trace.Semesters
select 