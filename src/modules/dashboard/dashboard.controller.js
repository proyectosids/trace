const { poolPromise, sql } = require('../../config/db');

async function cecytDashboard(req, res) {
  try {
    const pool = await poolPromise;
    const { semesterId } = req.query ?? {};

    const request = pool.request()
      .input('CecytId', sql.UniqueIdentifier, req.user.cecytId);

    let where = `WHERE CecytId = @CecytId`;
    if (semesterId) {
      request.input('SemesterId', sql.UniqueIdentifier, semesterId);
      where += ` AND SemesterId = @SemesterId`;
    }

    const result = await request.query(`
      SELECT
        TeacherUserId,
        SemesterId,
        CASE WHEN SocioemocionalRegistradas >= 1 THEN 1 ELSE 0 END AS SocioemocionalCumplida,
        SocioemocionalRegistradas,
        TrayectoriaRegistrada
      FROM trace.VW_TeacherSemesterCompliance
      ${where}
      ORDER BY TeacherUserId
    `);

    res.json(result.recordset);
  } catch (err) {
    res.status(400).json({ message: err.message || 'No se pudo cargar dashboard' });
  }
}

module.exports = { cecytDashboard };
