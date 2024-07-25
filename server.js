const express = require('express');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const http = require('http');
const {
    v4: uuid
} = require('uuid');
const socketIO = require('socket.io')
const multer = require('multer');
const bodyParser = require('body-parser');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const app = express();
const expressHTTPServer = http.createServer(app);
const io = new socketIO.Server(expressHTTPServer);
const flash = require('connect-flash');
const session = require('express-session');
const bcrypt = require('bcrypt');
const passport = require('./passport');
const userModel = require('./models/userModel');
const { ensureAuthenticated } = require('./middlewares/auth');
const connectDB = require('./connectDB');
connectDB();

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
app.use(flash());


app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    res.locals.isAuthenticated = req.isAuthenticated();
    res.locals.currentUser = req.user;
    res.locals.error_msg = req.flash('error_msg');
    res.locals.success_msg = req.flash('success_msg');
    next();
});

cloudinary.config({
    cloud_name: 'djh5c7smq',
    api_key: '694595742579443',
    api_secret: 'qGcURzMO2dsvMuufwS0KKcD38kk',
});

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

app.post('/register', async (req, res) => {
    const { name, email, password, faceURL } = req.body;
    // Kiểm tra xem người dùng đã tồn tại chưa
    const existingUser = await userModel.findOne({ Email: email });
    if (existingUser) {
        req.flash('error_msg', 'Email already exists');
        res.status(500).json({ error: 'Email already exists' });
        return;
    }

    // Mã hóa mật khẩu trước khi lưu trữ
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo người dùng mới
    const newUser = new userModel({
        Name: name,
        Email: email,
        Password: hashedPassword,
        UserImg: faceURL,
    });

    try {
        // Lưu người dùng mới vào cơ sở dữ liệu
        await newUser.save();
        res.status(201).json({ message: 'The user has been created successfully.' });
    } catch (error) {
        req.flash('error_msg', 'Email already exists');
        res.status(500).json({ error: 'An error occurred while creating a new user.' });
    }

});

app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/home', ensureAuthenticated, (req, res) => {
    const user = req.user;
    res.render('home', { user });
});

app.post('/upload', upload.single('file'), (req, res) => {
    const fileUrl = `/uploads/${req.file.filename}`;
    res.send({ fileUrl, filename: req.file.originalname });
});

// API để lưu ảnh
// app.post('/upload-image', (req, res) => {
//     const { imageData } = req.body;
//     const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
//     const imgName = `face_${Date.now()}.png`;

//     const imgPath = path.join(__dirname, 'public', 'img', imgName);
//     console.log(imgPath)

//     fs.writeFile(imgPath, base64Data, 'base64', (err) => {
//         if (err) {
//             return res.status(500).send('Error saving image');
//         }
//         res.send('Image saved successfully');
//     });
// });

app.post('/upload-image', async (req, res) => {
    try {
        const { imageData } = req.body;
        let publicId = null;
        const uploadResponse = await cloudinary.uploader.upload(imageData, {
            upload_preset: 'MHUD_UserImg'
        }, (error, result) => {
            if (error) {
              console.error('Error uploading image:', error);
            } else {
              publicId = result.public_id;  
            }});
        res.json({ url: uploadResponse.secure_url,  publicId});
    } catch (error) {
        console.error('Error uploading image to Cloudinary:', error);
        res.status(500).json({ message: 'Error uploading image' });
    }
  });

  app.post('/check-email-password', async (req, res, next) => {
    const { email, password } = req.body;

    try {
        // Lấy thông tin người dùng từ cơ sở dữ liệu dựa trên email và password
        const user = await userModel.findOne({ Email: email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email.' });
        }

        const isMatch = await bcrypt.compare(password, user.Password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Password incorrect.' });
        }

        res.json({ message: 'Valid Email and Password' });
        
    } catch (error) {
        console.error('Error in Check Email and Password', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/face-authentication', async (req, res, next) => {
    const { email, password, faceURL, publicId } = req.body;

    try {
        // Lấy thông tin người dùng từ cơ sở dữ liệu dựa trên email và password
        const user = await userModel.findOne({ Email: email });
        if (!user) {
            req.flash('error_msg', 'Invalid email');
            return res.status(401).json({ message: 'Invalid email' });
        }

        // Lấy URL ảnh của người dùng từ cơ sở dữ liệu
        const userFaceURL = user.UserImg;

        // Tải ảnh từ URL và chuyển đổi thành buffer
        const loadImageBuffer = async (url) => {
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            return Buffer.from(response.data, 'binary');
        };

        const srcImageBuffer = await loadImageBuffer(userFaceURL);
        const imgImageBuffer = await loadImageBuffer(faceURL);

        // Gửi ảnh tới API FastAPI để so sánh
        const compareImages = async (srcBuffer, imgBuffer) => {
            const form = new FormData();
            form.append('src', srcBuffer, { filename: 'src.jpg' });
            form.append('img', imgBuffer, { filename: 'img.jpg' });

            const response = await axios.post('http://localhost:8000/authorization/', form, {
                headers: form.getHeaders(),
            });

            return response.data;
        };

        const comparisonResult = await compareImages(srcImageBuffer, imgImageBuffer);

        try {
            await cloudinary.uploader.destroy(publicId);
        } catch (error) {
            console.error('Error deleting image:', error);
            res.status(500).send('Error deleting image');
        }

        

        // Kiểm tra kết quả so sánh và trả về phản hồi tương ứng
        if (comparisonResult.is_authorized) {
                passport.authenticate('local', {
                successRedirect: '/home',
                failureRedirect: '/login',
                failureFlash: true
              })(req, res, next);
        } else {
            res.status(401).json({ message: 'Face authentication failed' });
        }
    } catch (error) {
        console.error('Error in face authentication', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error(err);
        }
        req.flash('success_msg', 'You are logged out');
        res.redirect('/login');
    });
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
