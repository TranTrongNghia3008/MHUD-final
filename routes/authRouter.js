'use strict';

const express = require('express');
const controller = require('../controllers/authController');
const router = express.Router();
const { ensureAuthenticated } = require('../middlewares/auth');



router.get('/register',   controller.showRegister);
router.post('/register', controller.register);
router.post('/upload-image', controller.uploadImage);

router.get('/login', controller.showLogin);
router.post('/check-email-password', controller.checkEmailPassword);
router.post('/face-authentication', controller.faceAuthentication);

router.get('/logout', controller.logout);

module.exports = router;