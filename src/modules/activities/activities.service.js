const { poolPromise, sql } = require('../../config/db');
const { isWithinRange, isPast } = require('../../shared/utils/date.utils');

async function getSemesterById(semesterId) {
    const pool = await poolPromise;
    const r = await pool.request()
        .input('id', sql.UniqueIdentifier, semesterId)
        .query(`SELECT Id, StateId, StartDate, EndDate, IsActive FROM trace.Semesters WHERE Id = @id`);
    return r.recordset[0] || null;
}

async function getActivityById(activityId) {
    const pool = await poolPromise;
    const r = await pool.request()
        .input('id', sql.UniqueIdentifier, activityId)
        .query(`
      SELECT Id, CecytId, SemesterId, TeacherUserId, Type, Title, ScheduledDate, Status
      FROM trace.Activities
      WHERE Id = @id
    `);
    return r.recordset[0] || null;
}

async function countEvidence(activityId) {
    const pool = await poolPromise;
    const r = await pool.request()
        .input('ActivityId', sql.UniqueIdentifier, activityId)
        .query(`SELECT COUNT(1) AS Cnt FROM trace.ActivityEvidence WHERE ActivityId = @ActivityId`);
    return Number(r.recordset?.[0]?.Cnt ?? 0);
}

async function createActivity(data, user) {
    const { semesterId, type, title, scheduledDate } = data;

    if (!['SOCIOEMOCIONAL', 'TRAYECTORIA'].includes(type)) {
        throw new Error('Tipo inválido');
    }

    const semester = await getSemesterById(semesterId);
    if (!semester || !semester.IsActive) {
        throw new Error('Semestre inválido o inactivo');
    }

    // Validación de fecha dentro del semestre
    if (!isWithinRange(scheduledDate, semester.StartDate, semester.EndDate)) {
        throw new Error('La fecha programada debe estar dentro del semestre');
    }

    const pool = await poolPromise;

    // 🔒 Regla: Solo 1 TRAYECTORIA ACTIVA por semestre por docente
    if (type === 'TRAYECTORIA') {
        const r = await pool.request()
            .input('TeacherUserId', sql.UniqueIdentifier, user.userId)
            .input('SemesterId', sql.UniqueIdentifier, semesterId)
            .query(`
                SELECT COUNT(1) AS Cnt
                FROM trace.Activities
                WHERE TeacherUserId = @TeacherUserId
                  AND SemesterId = @SemesterId
                  AND Type = 'TRAYECTORIA'
                  AND Status = 'ACTIVA'
            `);

        const count = Number(r.recordset[0].Cnt);

        if (count > 0) {
            throw new Error(
                'Ya tienes una actividad de Trayectoria activa en este semestre. Regístrala antes de crear una nueva'
            );
        }
    }

    await pool.request()
        .input('CecytId', sql.UniqueIdentifier, user.cecytId)
        .input('SemesterId', sql.UniqueIdentifier, semesterId)
        .input('TeacherUserId', sql.UniqueIdentifier, user.userId)
        .input('Type', sql.VarChar, type)
        .input('Title', sql.NVarChar, title)
        .input('ScheduledDate', sql.Date, scheduledDate)
        .query(`
            INSERT INTO trace.Activities 
            (CecytId, SemesterId, TeacherUserId, Type, Title, ScheduledDate)
            VALUES 
            (@CecytId, @SemesterId, @TeacherUserId, @Type, @Title, @ScheduledDate)
        `);
}


async function listActivities(filters, user) {
    const pool = await poolPromise;
    const { semesterId, type } = filters;

    const req = pool.request()
        .input('CecytId', sql.UniqueIdentifier, user.cecytId)
        .input('TeacherUserId', sql.UniqueIdentifier, user.userId);

    let where = `WHERE CecytId = @CecytId AND TeacherUserId = @TeacherUserId`;

    if (semesterId) {
        req.input('SemesterId', sql.UniqueIdentifier, semesterId);
        where += ` AND SemesterId = @SemesterId`;
    }
    if (type) {
        req.input('Type', sql.VarChar, type);
        where += ` AND Type = @Type`;
    }

    const r = await req.query(`
    SELECT Id, SemesterId, Type, Title, ScheduledDate, Status, CreatedAt, UpdatedAt
    FROM trace.Activities
    ${where}
    ORDER BY ScheduledDate DESC, CreatedAt DESC
  `);

    return r.recordset;
}

async function registerActivity(activityId, user) {
    const activity = await getActivityById(activityId);
    if (!activity) throw new Error('Actividad no encontrada');

    // Aislamiento multi-tenant (CECyT)
    if (activity.CecytId !== user.cecytId) throw new Error('Acceso denegado');

    // Dueño: para docente (si luego director registra, ajustas)
    if (activity.TeacherUserId !== user.userId) throw new Error('Solo el docente dueño puede registrar');

    const semester = await getSemesterById(activity.SemesterId);
    if (!semester) throw new Error('Semestre no encontrado');

    // Para que cuente como “registrada en tiempo”: fecha programada debe estar dentro del semestre (ya) y no vencida.
    // Si venció, debería reprogramarse (solo socioemocional).
    if (isPast(activity.ScheduledDate)) {
        if (activity.Type === 'TRAYECTORIA') {
            throw new Error('La actividad de trayectoria no puede registrarse si ya venció (no reprogramable)');
        }
        // Socioemocional vencida: forzar reprogramación antes de registrar
        throw new Error('Actividad vencida: primero reprograma y luego registra');
    }

    // Evidencia 1..4 obligatoria
    const evCount = await countEvidence(activityId);
    if (evCount < 1 || evCount > 4) {
        throw new Error('La actividad requiere de 1 a 4 evidencias para registrarse');
    }

    const pool = await poolPromise;
    await pool.request()
        .input('Id', sql.UniqueIdentifier, activityId)
        .query(`
      UPDATE trace.Activities
      SET Status = 'REGISTRADA', UpdatedAt = SYSDATETIME()
      WHERE Id = @Id
    `);
}


async function updateActivityTitle(activityId, newTitle, user) {
    const activity = await getActivityById(activityId);
    if (!activity) throw new Error('Actividad no encontrada');

    if (activity.CecytId !== user.cecytId)
        throw new Error('Acceso denegado');

    if (activity.TeacherUserId !== user.userId)
        throw new Error('Solo el docente dueño puede modificar');

    if (activity.Status === 'REGISTRADA')
        throw new Error('No se puede modificar una actividad ya registrada');

    if (activity.Status === 'CANCELADA')
        throw new Error('No se puede modificar una actividad cancelada');

    const pool = await poolPromise;

    await pool.request()
        .input('Id', sql.UniqueIdentifier, activityId)
        .input('Title', sql.NVarChar, newTitle)
        .query(`
            UPDATE trace.Activities
            SET Title = @Title,
                UpdatedAt = SYSDATETIME()
            WHERE Id = @Id
        `);
}

async function cancelActivity(activityId, user) {
    const activity = await getActivityById(activityId);
    if (!activity) throw new Error('Actividad no encontrada');

    if (activity.CecytId !== user.cecytId)
        throw new Error('Acceso denegado');

    if (activity.TeacherUserId !== user.userId)
        throw new Error('Solo el docente dueño puede cancelar');

    if (activity.Status === 'REGISTRADA')
        throw new Error('No se puede cancelar una actividad ya registrada');

    if (activity.Status === 'CANCELADA')
        throw new Error('La actividad ya está cancelada');

    // 🔹 Verificar evidencias
    const evidenceCount = await countEvidence(activityId);
    if (evidenceCount > 0) {
        throw new Error('No se puede cancelar una actividad que ya tiene evidencia, elimina las evidencias primero');
    }

    // 🔹 Regla socioemocional
    if (activity.Type === 'SOCIOEMOCIONAL') {
        if (isPast(activity.ScheduledDate)) {
            throw new Error('La actividad vencida debe reprogramarse, no cancelarse');
        }
    }
    // 🔹 Trayectoria se puede cancelar aunque esté vencida
    const pool = await poolPromise;

    await pool.request()
        .input('Id', sql.UniqueIdentifier, activityId)
        .query(`
            UPDATE trace.Activities
            SET Status = 'CANCELADA',
                UpdatedAt = SYSDATETIME()
            WHERE Id = @Id
        `);
}


async function reprogramActivity(activityId, newDate, user) {
    const activity = await getActivityById(activityId);
    if (!activity) throw new Error('Actividad no encontrada');

    if (activity.CecytId !== user.cecytId) throw new Error('Acceso denegado');
    if (activity.TeacherUserId !== user.userId) throw new Error('Solo el docente dueño puede reprogramar');

    if (activity.Type !== 'SOCIOEMOCIONAL') {
        throw new Error('Solo las actividades socioemocionales se pueden reprogramar');
    }

    // Debe estar vencida para reprogramarse
    if (!isPast(activity.ScheduledDate)) {
        throw new Error('Solo se puede reprogramar si ya venció la fecha programada');
    }

    const semester = await getSemesterById(activity.SemesterId);
    if (!semester) throw new Error('Semestre no encontrado');

    if (!isWithinRange(newDate, semester.StartDate, semester.EndDate)) {
        throw new Error('La nueva fecha debe estar dentro del semestre');
    }

    if (activity.Status === 'REGISTRADA')
        throw new Error('No se puede cancelar una actividad ya registrada');


    const pool = await poolPromise;
    await pool.request()
        .input('Id', sql.UniqueIdentifier, activityId)
        .input('NewDate', sql.Date, newDate)
        .query(`
      UPDATE trace.Activities
      SET ScheduledDate = @NewDate,
          Status = 'REPROGRAMADA',
          UpdatedAt = SYSDATETIME()
      WHERE Id = @Id
    `);
}

module.exports = {
    createActivity,
    listActivities,
    registerActivity,
    reprogramActivity,
    updateActivityTitle,
    cancelActivity

};
