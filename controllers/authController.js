'use strict';

const controller = {};

const bcrypt = require('bcrypt');
const axios = require('axios');
const FormData = require('form-data');
const passport = require('../passport');
const userModel = require('../models/userModel');
const cloudinary = require('cloudinary').v2;
const { createGenesisBlock, createNewBlock, getLatestBlock, saveBlockToDB } = require('../blockchain');
cloudinary.config({
    cloud_name: 'djh5c7smq',
    api_key: '694595742579443',
    api_secret: 'qGcURzMO2dsvMuufwS0KKcD38kk',
});

controller.showRegister = (req, res) => {
    res.render('register');
}

controller.register = async (req, res) => {
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

        // Thêm block vào blockchain
        const latestBlock = await getLatestBlock();
        const previousBlock = latestBlock || createGenesisBlock();
        const newBlock = createNewBlock(previousBlock, { event: 'register', user: newUser });
        await saveBlockToDB(newBlock);

        res.status(201).json({ message: 'The user has been created successfully.' });
    } catch (error) {
        req.flash('error_msg', 'Email already exists');
        res.status(500).json({ error: 'An error occurred while creating a new user.' });
    }

}

controller.uploadImage = async (req, res) => {
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
}

controller.showLogin = (req, res) => {
    res.render('login');
}

controller.checkEmailPassword = async (req, res, next) => {
    const { email, password } = req.body;

    try {
        // Lấy thông tin người dùng từ cơ sở dữ liệu dựa trên email và password
        const user = await userModel.findOne({ Email: email });
        if (!user) {
            return res.status(401).json({ message: 'Password or Email is incorrect.' });
        }

        const isMatch = await bcrypt.compare(password, user.Password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Password or Email is incorrect.' });
        }

        res.json({ message: 'Valid Email and Password' });
        
    } catch (error) {
        console.error('Error in Check Email and Password', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

controller.faceAuthentication = async (req, res, next) => {
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
                failureRedirect: '/auth/login',
                failureFlash: true
              })(req, res, next);
        } else {
            res.status(401).json({ message: 'Face authentication failed' });
        }
    } catch (error) {
        console.error('Error in face authentication', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

controller.logout = (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error(err);
        }
        req.flash('success_msg', 'You are logged out');
        res.redirect('/auth/login');
    });
}

module.exports = controller;