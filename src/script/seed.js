const bcrypt = require('bcrypt');
const { poolPromise, sql } = require('./config/db');

(async () => {
  const passwordHash = await bcrypt.hash('Admin1234', 10);
  const pool = await poolPromise;

  await pool.request().query(`
    INSERT INTO trace.Users (Id, CecytId, Email, PasswordHash, FullName, IsActive)
    VALUES (
      NEWID(),
      (SELECT TOP 1 Id FROM trace.Cecyts),
      'admin@sistema.com',
      '${passwordHash}',
      'Administrador del Sistema',
      1
    )
  `);

  console.log('✅ Admin creado');
  process.exit();
})();
