// const path = require('path');
// const { poolPromise, sql } = require('../../config/db');
// const { optimizeImage } = require('../../shared/utils/image.utils');
// const { deleteFileIfExists } = require('../../shared/utils/file.utils');

// const UPLOAD_BASE = '/uploads/evidence';

// /**
//  * Agregar evidencia (1–4 máx)
//  * - Optimiza imagen
//  * - Guarda ruta final
//  */
// async function addEvidence(activityId, file, user) {
//     const pool = await poolPromise;

//     // 1️⃣ Validar actividad y multi-tenant
//     const a = await pool.request()
//         .input('Id', sql.UniqueIdentifier, activityId)
//         .query(`
//       SELECT Id, CecytId, TeacherUserId
//       FROM Activities
//       WHERE Id = @Id
//     `);

//     const activity = a.recordset[0];
//     if (!activity) throw new Error('Actividad no encontrada');
//     if (activity.CecytId !== user.cecytId) throw new Error('Acceso denegado');
//     if (activity.TeacherUserId !== user.userId)
//         throw new Error('Solo el docente dueño puede subir evidencia');

//     // 2️⃣ Contar evidencias actuales (máx 4)
//     const c = await pool.request()
//         .input('ActivityId', sql.UniqueIdentifier, activityId)
//         .query(`SELECT COUNT(1) AS Cnt FROM ActivityEvidence WHERE ActivityId = @ActivityId`);

//     const cnt = Number(c.recordset?.[0]?.Cnt ?? 0);
//     if (cnt >= 4) {
//         deleteFileIfExists(file.path);
//         throw new Error('No puedes subir más de 4 evidencias');
//     }

//     // 3️⃣ Optimizar imagen (sharp)
//     const optimizedPath = await optimizeImage(file.path);

//     const relativePath = `uploads/evidence/${path.basename(optimizedPath)}`;

//     // 4️⃣ Guardar en BD
//     await pool.request()
//         .input('ActivityId', sql.UniqueIdentifier, activityId)
//         .input('FilePath', sql.NVarChar, relativePath)
//         .input('FileType', sql.NVarChar, 'webp')
//         .query(`
//       INSERT INTO ActivityEvidence (ActivityId, FilePath, FileType)
//       VALUES (@ActivityId, @FilePath, @FileType)
//     `);

//     return { filePath: relativePath };
// }

// /**
//  * Listar evidencias de una actividad
//  * 👉 ESTE MÉTODO SE MANTIENE (TU DUDA ERA CORRECTA)
//  */
// async function listEvidence(activityId, user) {
//     const pool = await poolPromise;

//     const a = await pool.request()
//         .input('Id', sql.UniqueIdentifier, activityId)
//         .query(`
//       SELECT Id, CecytId
//       FROM Activities
//       WHERE Id = @Id
//     `);

//     const activity = a.recordset[0];
//     if (!activity) throw new Error('Actividad no encontrada');
//     if (activity.CecytId !== user.cecytId) throw new Error('Acceso denegado');

//     const r = await pool.request()
//         .input('ActivityId', sql.UniqueIdentifier, activityId)
//         .query(`
//       SELECT Id, FilePath, FileType, UploadedAt
//       FROM ActivityEvidence
//       WHERE ActivityId = @ActivityId
//       ORDER BY UploadedAt ASC
//     `);

//     return r.recordset;
// }

// /**
//  * Eliminar evidencia
//  * - Borra archivo físico
//  * - Borra registro BD
//  */
// async function deleteEvidence(evidenceId, user) {
//     const pool = await poolPromise;

//     // const r = await pool.request()
//     //     .input('Id', sql.UniqueIdentifier, evidenceId)
//     //     .query(`
//     //   SELECT e.Id, e.FilePath, a.CecytId, a.TeacherUserId
//     //   FROM ActivityEvidence e
//     //   JOIN Activities a ON a.Id = e.ActivityId
//     //   WHERE e.Id = @Id
//     // `);
//     const r = await pool.request()
//         .input('Id', sql.UniqueIdentifier, evidenceId)
//         .query(`
//       SELECT 
//         e.Id, 
//         e.FilePath, 
//         a.CecytId, 
//         a.TeacherUserId,
//         a.Status
//       FROM ActivityEvidence e
//       JOIN Activities a ON a.Id = e.ActivityId
//       WHERE e.Id = @Id
//     `);


//     const evidence = r.recordset[0];
//     if (!evidence) throw new Error('Evidencia no encontrada');
//     if (evidence.CecytId !== user.cecytId) throw new Error('Acceso denegado');
//     if (evidence.TeacherUserId !== user.userId)
//         throw new Error('Solo el dueño puede eliminar la evidencia');


//     // eliminar archivo físico
//     const cleanPath = evidence.FilePath.replace(/\\/g, '/'); // convertir a slash normal
//     const fullPath = path.join(process.cwd(), cleanPath);
//     deleteFileIfExists(fullPath);

//     // eliminar registro BD
//     await pool.request()
//         .input('Id', sql.UniqueIdentifier, evidenceId)
//         .query(`DELETE FROM ActivityEvidence WHERE Id = @Id`);

//     return { message: 'Evidencia eliminada' };
// }

// module.exports = {
//     addEvidence,
//     listEvidence,
//     deleteEvidence
// };

const path = require('path');
const { poolPromise, sql } = require('../../config/db');
const { optimizeImage } = require('../../shared/utils/image.utils');
const { deleteFileIfExists } = require('../../shared/utils/file.utils');

const UPLOAD_BASE = '/uploads/evidence';

/**
 * Agregar evidencia (1–4 máx)
 * - Optimiza imagen
 * - Guarda ruta final
 */
async function addEvidence(activityId, file, user) {
    const pool = await poolPromise;

    // 1️⃣ Validar actividad y multi-tenant
    const a = await pool.request()
        .input('Id', sql.UniqueIdentifier, activityId)
        .query(`
            SELECT Id, CecytId, TeacherUserId, Status
            FROM Activities
            WHERE Id = @Id
        `);

    const activity = a.recordset[0];
    if (!activity) {
        deleteFileIfExists(file.path);
        throw new Error('Actividad no encontrada');
    }

    if (activity.CecytId !== user.cecytId) {
        deleteFileIfExists(file.path);
        throw new Error('Acceso denegado');
    }

    if (activity.TeacherUserId !== user.userId) {
        deleteFileIfExists(file.path);
        throw new Error('Solo el docente dueño puede subir evidencia');
    }

    // 🔒 BLOQUEO: No permitir subir si está finalizada o cancelada
    if (['REGISTRADA', 'CANCELADA'].includes(activity.Status)) {
        deleteFileIfExists(file.path);
        throw new Error('No se pueden subir evidencias en actividades finalizadas o canceladas');
    }

    // 2️⃣ Contar evidencias actuales (máx 4)
    const c = await pool.request()
        .input('ActivityId', sql.UniqueIdentifier, activityId)
        .query(`
            SELECT COUNT(1) AS Cnt 
            FROM ActivityEvidence 
            WHERE ActivityId = @ActivityId
        `);

    const cnt = Number(c.recordset?.[0]?.Cnt ?? 0);
    if (cnt >= 4) {
        deleteFileIfExists(file.path);
        throw new Error('No puedes subir más de 4 evidencias');
    }

    // 3️⃣ Optimizar imagen (sharp)
    const optimizedPath = await optimizeImage(file.path);

    const relativePath = `uploads/evidence/${path.basename(optimizedPath)}`;

    // 4️⃣ Guardar en BD
    await pool.request()
        .input('ActivityId', sql.UniqueIdentifier, activityId)
        .input('FilePath', sql.NVarChar, relativePath)
        .input('FileType', sql.NVarChar, 'webp')
        .query(`
            INSERT INTO ActivityEvidence (ActivityId, FilePath, FileType)
            VALUES (@ActivityId, @FilePath, @FileType)
        `);

    return { filePath: relativePath };
}

/**
 * Listar evidencias de una actividad
 */
async function listEvidence(activityId, user) {
    const pool = await poolPromise;

    const a = await pool.request()
        .input('Id', sql.UniqueIdentifier, activityId)
        .query(`
            SELECT Id, CecytId
            FROM Activities
            WHERE Id = @Id
        `);

    const activity = a.recordset[0];
    if (!activity) throw new Error('Actividad no encontrada');
    if (activity.CecytId !== user.cecytId) throw new Error('Acceso denegado');

    const r = await pool.request()
        .input('ActivityId', sql.UniqueIdentifier, activityId)
        .query(`
            SELECT Id, FilePath, FileType, UploadedAt
            FROM ActivityEvidence
            WHERE ActivityId = @ActivityId
            ORDER BY UploadedAt ASC
        `);

    return r.recordset;
}

/**
 * Eliminar evidencia
 * - Borra archivo físico
 * - Borra registro BD
 */
async function deleteEvidence(evidenceId, user) {
    const pool = await poolPromise;

    const r = await pool.request()
        .input('Id', sql.UniqueIdentifier, evidenceId)
        .query(`
            SELECT 
                e.Id, 
                e.FilePath, 
                a.CecytId, 
                a.TeacherUserId,
                a.Status
            FROM ActivityEvidence e
            JOIN Activities a ON a.Id = e.ActivityId
            WHERE e.Id = @Id
        `);

    const evidence = r.recordset[0];

    if (!evidence) throw new Error('Evidencia no encontrada');
    if (evidence.CecytId !== user.cecytId) throw new Error('Acceso denegado');
    if (evidence.TeacherUserId !== user.userId)
        throw new Error('Solo el dueño puede eliminar la evidencia');

    // 🔒 BLOQUEO: No permitir eliminar si está finalizada o cancelada
    if (['REGISTRADA', 'CANCELADA'].includes(evidence.Status)) {
        throw new Error('No se pueden modificar evidencias en actividades finalizadas o canceladas');
    }

    // eliminar archivo físico
    const cleanPath = evidence.FilePath.replace(/\\/g, '/');
    const fullPath = path.join(process.cwd(), cleanPath);
    deleteFileIfExists(fullPath);

    // eliminar registro BD
    await pool.request()
        .input('Id', sql.UniqueIdentifier, evidenceId)
        .query(`
            DELETE FROM ActivityEvidence 
            WHERE Id = @Id
        `);

    return { message: 'Evidencia eliminada' };
}

module.exports = {
    addEvidence,
    listEvidence,
    deleteEvidence
};
