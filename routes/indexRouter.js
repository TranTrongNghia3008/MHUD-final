'use strict';

const express = require('express');
const controller = require('../controllers/indexController');
const router = express.Router();
const multer = require('multer');
// Configure multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

router.get('/:roomId', controller.show);
router.post('upload', upload.single('file'), controller.upload);
router.get('/download/:filename', controller.download);

module.exports = router;