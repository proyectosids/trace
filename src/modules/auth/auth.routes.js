const router = require('express').Router();
const controller = require('./auth.controller');

router.post('/login', controller.login);
router.post('/register', controller.register); // NUEVO

module.exports = router;
