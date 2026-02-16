
const router = require('express').Router();
const auth = require('../../shared/middlewares/auth.middleware');
const authorize = require('../../shared/middlewares/authorize.middleware');
const upload = require('../../shared/middlewares/upload.middleware');
const controller = require('./evidence.controller');

router.use(auth);

/**
 * Subir evidencia
 * POST /evidence
 * form-data:
 *  - activityId
 *  - image (file)
 */
router.post(
    '/',
    authorize('UPLOAD_EVIDENCE'),
    upload.single('image'),
    controller.upload
);

/**
 * Listar evidencias por actividad
 * GET /evidence/activity/:activityId
 */
router.get(
    '/activity/:activityId',
    authorize('VIEW_OWN_ACTIVITIES'),
    controller.list
);

/**
 * Eliminar evidencia
 * DELETE /evidence/:id
 */
router.delete(
    '/:id',
    authorize('UPLOAD_EVIDENCE'),
    controller.remove
);

module.exports = router;
