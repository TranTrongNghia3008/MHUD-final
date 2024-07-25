const express = require('express');
const http = require('http');
const {
    v4: uuid
} = require('uuid');
const socketIO = require('socket.io')
const multer = require('multer');
const path = require('path');
const app = express();
const expressHTTPServer = http.createServer(app);
const io = new socketIO.Server(expressHTTPServer);

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

app.use(express.static('public'));
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.redirect(`/${uuid()}`);
});

app.get("/:roomId", (req, res) => {
    const roomId = req.params.roomId;
    res.render('index', { roomId });
});

app.post('/upload', upload.single('file'), (req, res) => {
    const fileUrl = `/uploads/${req.file.filename}`;
    res.send({ fileUrl, filename: req.file.originalname });
});

// Đường dẫn để tải xuống file
app.get('/download/:filename', (req, res) => {
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
});

io.on('connection', (socket) => {
    // Joining a new room
    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);

        // Notify others about the new joining in the room
        socket.to(roomId).emit("newJoining");
    });

    // Send the offer
    socket.on("sendTheOffer", (offer, roomId) => {
        socket.to(roomId).emit("receiveOffer", offer);
    });

    // Send the answer
    socket.on("sendTheAnswer", (answer, roomId) => {
        socket.to(roomId).emit("receiveAnswer", answer);
    });

    // Send Ice candidate
    socket.on("sendIceCandidate", (candidate, roomId) => {
        socket.to(roomId).emit("receiveCandidate", candidate);
    });

    socket.on("sendContext", (newContext, roomId) => {
        socket.to(roomId).emit("receiveContext", newContext);
    });

    socket.on("sendFileContext", (newContext, roomId) => {
        socket.to(roomId).emit("receiveFileContext", newContext);
    });

    console.log("Socket connected!");
});

expressHTTPServer.listen(3000);
