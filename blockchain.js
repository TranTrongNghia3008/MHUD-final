const CryptoJS = require('crypto-js');
const blockModel = require('./models/blockModel');

class Block {
    constructor(index, previousHash, timestamp, data, hash) {
        this.index = index;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
        this.hash = hash;
    }
}

function calculateHash(index, previousHash, timestamp, data) {
    return CryptoJS.SHA256(index + previousHash + timestamp + JSON.stringify(data)).toString();
}

function createGenesisBlock() {
    return new Block(0, '0', new Date().toISOString(), 'Genesis Block', calculateHash(0, '0', new Date().toISOString(), 'Genesis Block'));
}

function createNewBlock(previousBlock, data) {
    const index = previousBlock.index + 1;
    const timestamp = new Date().toISOString();
    const hash = calculateHash(index, previousBlock.hash, timestamp, data);
    return new Block(index, previousBlock.hash, timestamp, data, hash);
}

async function getLatestBlock() {
    const latestBlock = await blockModel.findOne().sort({ index: -1 });
    return latestBlock;
}

async function saveBlockToDB(block) {
    const newBlock = new blockModel(block);
    await newBlock.save();
    console.log("Block saved to MongoDB:", block);
}

module.exports = {
    createGenesisBlock,
    createNewBlock,
    getLatestBlock,
    saveBlockToDB
};
