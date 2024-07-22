const express = require('express');
const fs = require('fs');
const http = require('http');
const {
    v4: uuid
} = require('uuid');
const socketIO = require('socket.io')
const multer = require('multer');
const bodyParser = require('body-parser');
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
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static('public'));
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.redirect(`room/${uuid()}`);
});

app.get("/room/:roomId", (req, res) => {
    const roomId = req.params.roomId;
    res.render('index', { roomId });
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', (req, res) => {
    const { name, email, password, faceData } = req.body;

    console.log(name, email, password)

    res.status(201).json({ message: 'successfully'});

});

app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/home', (req, res) => {
    res.render('home');
});

app.post('/upload', upload.single('file'), (req, res) => {
    const fileUrl = `/uploads/${req.file.filename}`;
    res.send({ fileUrl, filename: req.file.originalname });
});

// API để lưu ảnh
app.post('/upload-image', (req, res) => {
    const { imageData } = req.body;
    const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
    const imgName = `face_${Date.now()}.png`;

    const imgPath = path.join(__dirname, 'public', 'img', imgName);
    console.log(imgPath)

    fs.writeFile(imgPath, base64Data, 'base64', (err) => {
        if (err) {
            return res.status(500).send('Error saving image');
        }
        res.send('Image saved successfully');
    });
});


app.post('/face-authentication', (req, res) => {
    const { email, password, imageData } = req.body;

    console.log(email, password)

    res.status(201).json({ message: 'successfully'});

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

    socket.on("fileUploaded", (data, roomId) => {
        socket.to(roomId).emit("renderFileUploaded", data);
    });

    console.log("Socket connected!");
});

expressHTTPServer.listen(3000);
