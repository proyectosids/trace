const { poolPromise, sql } = require('../../config/db');

async function getPendingUsers(currentUser) {
    const pool = await poolPromise;

    const result = await pool.request()
        .input('CecytId', sql.UniqueIdentifier, currentUser.cecytId)
        .query(`
      SELECT Id, Email, FullName, CreatedAt
      FROM Users
      WHERE CecytId = @CecytId
        AND IsActive = 0
      ORDER BY CreatedAt DESC
    `);

    return result.recordset;
}

async function approveUser(userId, currentUser) {
    const pool = await poolPromise;

    // Validar que pertenezca al mismo CECyT
    const r = await pool.request()
        .input('Id', sql.UniqueIdentifier, userId)
        .query(`
      SELECT Id, CecytId
      FROM Users
      WHERE Id = @Id
    `);

    const user = r.recordset[0];
    if (!user) throw new Error('Usuario no encontrado');

    if (user.CecytId !== currentUser.cecytId) {
        throw new Error('No puedes aprobar usuarios de otro CECyT');
    }

    await pool.request()
        .input('Id', sql.UniqueIdentifier, userId)
        .query(`
      UPDATE Users
      SET IsActive = 1
      WHERE Id = @Id
    `);
}

async function assignRole(userId, roleName, currentUser) {
    const pool = await poolPromise;

    if (roleName === 'ADMIN') {
        throw new Error('No puedes asignar rol ADMIN');
    }

    // Verificar usuario
    const r = await pool.request()
        .input('Id', sql.UniqueIdentifier, userId)
        .query(`
      SELECT Id, CecytId
      FROM Users
      WHERE Id = @Id
    `);

    const user = r.recordset[0];
    if (!user) throw new Error('Usuario no encontrado');

    if (user.CecytId !== currentUser.cecytId) {
        throw new Error('No puedes modificar usuarios de otro CECyT');
    }

    // Obtener rol
    const roleResult = await pool.request()
        .input('Name', sql.NVarChar, roleName)
        .query(`
      SELECT Id FROM Roles WHERE Name = @Name
    `);

    const role = roleResult.recordset[0];
    if (!role) throw new Error('Rol no válido');

    // Limpiar roles actuales
    await pool.request()
        .input('UserId', sql.UniqueIdentifier, userId)
        .query(`DELETE FROM UserRoles WHERE UserId = @UserId`);

    // Insertar nuevo rol
    await pool.request()
        .input('UserId', sql.UniqueIdentifier, userId)
        .input('RoleId', sql.UniqueIdentifier, role.Id)
        .query(`
      INSERT INTO UserRoles (UserId, RoleId)
      VALUES (@UserId, @RoleId)
    `);
}

module.exports = {
    getPendingUsers,
    approveUser,
    assignRole
};
