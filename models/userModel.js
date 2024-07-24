const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
	Name: { type: String, required: true },
	Gender: { type: String },
	BirthYear: { type: Number },
	Phone: { type: String },
	UserImg: { type: String, required: true},
	CreatedAt: { type: Date, default: Date.now },
	UpdatedAt: { type: Date, default: Date.now },
	Email: { type: String, required: true },
	Password: { type: String, required: true },
});

const userModel = mongoose.model('User', userSchema);

module.exports = userModel;
