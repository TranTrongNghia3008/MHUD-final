const express = require('express');
const http = require('http');
const socketIO = require('socket.io')
const bodyParser = require('body-parser');
const app = express();
const expressHTTPServer = http.createServer(app);
const io = new socketIO.Server(expressHTTPServer);
const flash = require('connect-flash');
const session = require('express-session');
const passport = require('./passport');
const { ensureAuthenticated } = require('./middlewares/auth');
const connectDB = require('./connectDB');

const {
    v4: uuid
} = require('uuid');

connectDB();

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


app.use(express.static('public'));
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.redirect('/auth/login');
});

app.get('/create-room',  (req, res) => {
    res.redirect(`room/${uuid()}`);
});

app.use("/room", ensureAuthenticated,  require('./routes/indexRouter'));

app.use('/auth', require('./routes/authRouter'));

app.use('/home', ensureAuthenticated, require('./routes/homeRouter'));

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
