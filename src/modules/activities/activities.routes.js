const router = require('express').Router();
const auth = require('../../shared/middlewares/auth.middleware');
const authorize = require('../../shared/middlewares/authorize.middleware');
const controller = require('./activities.controller');

router.use(auth);

router.post(
    '/',
    authorize('CREATE_ACTIVITY'),
    controller.create
);

router.post(
    '/:id/register',
    authorize('REGISTER_ACTIVITY'),
    controller.registerActivity
);

router.post(
    '/:id/reprogram',
    authorize('REPROGRAM_ACTIVITY'),
    controller.reprogram
);

router.get(
    '/',
    authorize('VIEW_OWN_ACTIVITIES'),
    controller.list
);


router.patch('/:id/title',
    authorize('UPLOAD_EVIDENCE'),
    controller.updateTitle
);

router.patch('/:id/cancel',
    authorize('UPLOAD_EVIDENCE'),
    controller.cancel
);


module.exports = router;
