const router = require('express').Router();
const auth = require('../../shared/middlewares/auth.middleware');
const authorize = require('../../shared/middlewares/authorize.middleware');
const controller = require('./dashboard.controller');

router.use(auth);

// Director: dashboard de SU CECyT
router.get(
    '/cecyt',
    authorize('DIRECTOR_DASHBOARD'),
    controller.cecytDashboard
);

module.exports = router;
