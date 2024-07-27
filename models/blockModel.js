const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema({
    index: { type: Number, required: true },
    previousHash: { type: String, required: true },
    timestamp: { type: Date, required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    hash: { type: String, required: true },
    CreatedAt: { type: Date, default: Date.now },
	UpdatedAt: { type: Date, default: Date.now }
});

const blockModel = mongoose.model('Block', blockSchema);

module.exports = blockModel;