'use strict';

const controller = {};
const path = require('path');

controller.show = (req, res) => {
    const roomId = req.params.roomId;
    res.render('index', { roomId });
}

controller.upload = (req, res) => {
    const fileUrl = `/uploads/${req.file.filename}`;
    res.send({ fileUrl, filename: req.file.originalname });
}


controller.download = (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, filename);
    
    // Gửi file về client
    console.log("Downloading file:", req.params);
    res.download(filePath, (err) => {
        if (err) {
            console.log("Error downloading file:", err);
            res.status(500).send("Error downloading file");
        }
    });
}


module.exports = controller;