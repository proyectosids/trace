const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { poolPromise, sql } = require('../../config/db');
const { secret, expiresIn } = require('../../config/jwt');

async function login(email, password) {
    const pool = await poolPromise;

    const result = await pool.request()
        .input('email', sql.NVarChar, email)
        .query(`
            SELECT u.Id, u.CecytId, u.PasswordHash, u.IsActive,
                   STRING_AGG(p.Code, ',') AS Permissions
            FROM Users u
            JOIN UserRoles ur ON u.Id = ur.UserId
            JOIN RolePermissions rp ON ur.RoleId = rp.RoleId
            JOIN Permissions p ON rp.PermissionId = p.Id
            WHERE u.Email = @email
            GROUP BY u.Id, u.CecytId, u.PasswordHash, u.IsActive
        `);

    const user = result.recordset[0];
    if (!user) throw new Error('Credenciales inválidas');

    if (!user.IsActive) {
        throw new Error('Tu cuenta aún no ha sido aprobada por el director');
    }

    const valid = await bcrypt.compare(password, user.PasswordHash);
    if (!valid) throw new Error('Credenciales inválidas');

    // 🔥 Obtener StateId del CECyT
    const cecytResult = await pool.request()
        .input('CecytId', sql.UniqueIdentifier, user.CecytId)
        .query(`
            SELECT StateId
            FROM Cecyts
            WHERE Id = @CecytId
        `);

    const cecyt = cecytResult.recordset[0];
    if (!cecyt) throw new Error('CECyT no encontrado');

    // 🔥 Buscar semestre activo por Estado
    const semesterResult = await pool.request()
        .input('StateId', sql.UniqueIdentifier, cecyt.StateId)
        .query(`
            SELECT TOP 1 Id, Name
            FROM Semesters
            WHERE StateId = @StateId
              AND IsActive = 1
            ORDER BY StartDate DESC
        `);

    const activeSemester = semesterResult.recordset[0];

    if (!activeSemester) {
        throw new Error('No hay semestre activo configurado para este estado');
    }

    const token = jwt.sign({
        userId: user.Id,
        cecytId: user.CecytId,
        permissions: user.Permissions.split(','),
        semesterId: activeSemester.Id,
        semesterName: activeSemester.Name
    }, secret, { expiresIn });

    return {
        token,
    };
}



async function register({ email, password, fullName, cecytId }) {
    const pool = await poolPromise;

    // 1️⃣ Verificar si ya existe email
    const existing = await pool.request()
        .input('email', sql.NVarChar, email)
        .query(`SELECT Id FROM Users WHERE Email = @email`);

    if (existing.recordset.length > 0) {
        throw new Error('El correo ya está registrado');
    }

    // 2️⃣ Verificar que exista el CECyT
    const cecyt = await pool.request()
        .input('Id', sql.UniqueIdentifier, cecytId)
        .query(`SELECT Id FROM Cecyts WHERE Id = @Id`);

    if (!cecyt.recordset[0]) {
        throw new Error('CECyT inválido');
    }

    // 3️⃣ Encriptar password
    const passwordHash = await bcrypt.hash(password, 10);

    // 4️⃣ Insertar usuario (inactivo)
    const userInsert = await pool.request()
        .input('CecytId', sql.UniqueIdentifier, cecytId)
        .input('Email', sql.NVarChar, email)
        .input('PasswordHash', sql.NVarChar, passwordHash)
        .input('FullName', sql.NVarChar, fullName)
        .query(`
      INSERT INTO Users (Id, CecytId, Email, PasswordHash, FullName, IsActive)
      OUTPUT INSERTED.Id
      VALUES (NEWID(), @CecytId, @Email, @PasswordHash, @FullName, 0)
    `);

    const userId = userInsert.recordset[0].Id;

    // 5️⃣ Asignar rol DOCENTE automáticamente
    await pool.request()
        .input('UserId', sql.UniqueIdentifier, userId)
        .query(`
      INSERT INTO UserRoles (UserId, RoleId)
      SELECT @UserId, Id
      FROM Roles
      WHERE Name = 'DOCENTE'
    `);
}

module.exports = { login, register };
