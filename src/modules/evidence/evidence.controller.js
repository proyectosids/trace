
const evidenceService = require('./evidence.service');

/**
 * Subir evidencia (multer ya procesó el archivo)
 * body:
 *  - activityId
 * file:
 *  - image
 */
async function upload(req, res) {
    try {
        const { activityId } = req.body;

        if (!activityId) {
            return res.status(400).json({ message: 'activityId es requerido' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Archivo de imagen requerido' });
        }

        const result = await evidenceService.addEvidence(
            activityId,
            req.file,
            req.user
        );

        return res.status(201).json(result);
    } catch (err) {
        return res.status(400).json({
            message: err.message || 'No se pudo subir la evidencia'
        });
    }
}

/**
 * Listar evidencias de una actividad
 */
async function list(req, res) {
    try {
        const { activityId } = req.params;

        if (!activityId) {
            return res.status(400).json({ message: 'activityId es requerido' });
        }

        const data = await evidenceService.listEvidence(activityId, req.user);
        return res.json(data);
    } catch (err) {
        return res.status(400).json({
            message: err.message || 'No se pudo listar evidencia'
        });
    }
}

/**
 * Eliminar evidencia (BD + archivo físico)
 */
async function remove(req, res) {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ message: 'id de evidencia requerido' });
        }

        const result = await evidenceService.deleteEvidence(id, req.user);
        return res.json(result);
    } catch (err) {
        return res.status(400).json({
            message: err.message || 'No se pudo eliminar evidencia'
        });
    }
}

module.exports = {
    upload,
    list,
    remove
};
