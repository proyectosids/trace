const router = require('express').Router();
const auth = require('../../shared/middlewares/auth.middleware');
const authorize = require('../../shared/middlewares/authorize.middleware');
const controller = require('./users.controller');

router.use(auth);

// Ver usuarios pendientes del mismo CECyT
router.get(
    '/pending',
    authorize('MANAGE_USERS'),
    controller.getPending
);

// Aprobar usuario
router.patch(
    '/:id/approve',
    authorize('MANAGE_USERS'),
    controller.approve
);

// Cambiar rol de usuario
router.patch(
    '/:id/assign-role',
    authorize('MANAGE_USERS'),
    controller.assignRole
);

module.exports = router;
