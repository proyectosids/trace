const bcrypt = require('bcrypt');
const { poolPromise, sql } = require('./db');

async function initializeSystem() {
    const pool = await poolPromise;

    console.log('🔎 Verificando administradores por CECyT...');

    // 1️⃣ Obtener todos los CECyT
    const cecytsResult = await pool.request().query(`
    SELECT Id, Code
    FROM trace.Cecyts
  `);

    const cecyts = cecytsResult.recordset;

    if (!cecyts.length) {
        console.log('⚠️ No hay CECyTs creados.');
        return;
    }

    for (const cecyt of cecyts) {
        const email = `admin.${cecyt.Code.toLowerCase()}@sistema.com`;

        // 2️⃣ Verificar si ya existe admin para ese CECyT
        const existing = await pool.request()
            .input('email', sql.NVarChar, email)
            .query(`
        SELECT Id FROM trace.Users WHERE Email = @email
      `);

        if (existing.recordset.length > 0) {
            console.log(`✅ Admin ya existe para ${cecyt.Code}`);
            continue;
        }

        console.log(`⚙️ Creando admin para ${cecyt.Code}...`);

        const passwordHash = await bcrypt.hash(
            process.env.ADMIN_PASSWORD || 'Admin1234',
            10
        );

        // 3️⃣ Insertar usuario
        const insertUser = await pool.request()
            .input('CecytId', sql.UniqueIdentifier, cecyt.Id)
            .input('Email', sql.NVarChar, email)
            .input('PasswordHash', sql.NVarChar, passwordHash)
            .input('FullName', sql.NVarChar, `Administrador ${cecyt.Code}`)
            .query(`
        INSERT INTO trace.Users (Id, CecytId, Email, PasswordHash, FullName, IsActive)
        OUTPUT INSERTED.Id
        VALUES (NEWID(), @CecytId, @Email, @PasswordHash, @FullName, 1)
      `);

        const userId = insertUser.recordset[0].Id;

        // 4️⃣ Asignar rol ADMIN
        await pool.request()
            .input('UserId', sql.UniqueIdentifier, userId)
            .query(`
        INSERT INTO trace.UserRoles (UserId, RoleId)
        SELECT @UserId, Id
        FROM trace.Roles
        WHERE Name = 'ADMIN'
      `);

        console.log(`🎉 Admin creado para ${cecyt.Code}`);
    }

    console.log('🏁 Inicialización completa.');
}

module.exports = { initializeSystem };
