const encryptionKey = "SecretKey123"; 

export function stringToBinary(utf8String) {
    const binaryString = unescape(encodeURIComponent(utf8String))
        .split('')
        .map(char => char.charCodeAt(0).toString(2).padStart(8, '0'))
        .join('');
    return binaryString;
}

function binaryToString(binaryString) {
    const bytes = binaryString.match(/.{8}/g).map(byte => parseInt(byte, 2));
    const utf8String = decodeURIComponent(escape(String.fromCharCode(...bytes)));
    return utf8String;
}

// Hàm mã hoá dữ liệu nhị phân sử dụng AES
export function encryptBinaryData(binaryData, key = encryptionKey) {
    const encrypted = CryptoJS.AES.encrypt(binaryData, key).toString();
    return stringToBinary(encrypted);
}

// Hàm giải mã dữ liệu nhị phân sử dụng AES
function decryptBinaryData(encryptedData, key = encryptionKey) {
    const data = binaryToString(encryptedData);
    const bytes = CryptoJS.AES.decrypt(data, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted;
}

function embedBinaryString(data, dataIndex, binaryString, spacing) {
    for (let i = 0; i < binaryString.length; i++) {
        if (dataIndex >= data.length) break;
        data[dataIndex] = (data[dataIndex] & 0xFE) | parseInt(binaryString[i]);
        dataIndex += spacing;
    }
    return dataIndex;
}

export function embedMessageInFrame(context, canvas, binaryMessage, spacing = 5) {
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = frame.data;
    // console.log(data.length);
    // console.log(data);

    // Embed flag to indicate hidden message
    data[0] = 107; // Example: Setting a special flag

    let dataIndex = spacing;

    // Embed the length of the binary message
    const messageLengthBinary = binaryMessage.length.toString(2).padStart(32, '0');
    dataIndex = embedBinaryString(data, dataIndex, messageLengthBinary, spacing);

    // Embed the binary message
    dataIndex = embedBinaryString(data, dataIndex, binaryMessage, spacing);

    context.putImageData(frame, 0, 0);
}

function extractBinaryString(data, dataIndex, length, spacing) {
    let binaryString = '';
    for (let i = 0; i < length; i++) {
        if (dataIndex >= data.length) break;
        binaryString += (data[dataIndex] & 0x01).toString();
        dataIndex += spacing;
    }
    return { binaryString, dataIndex };
}

export function extractMessageFromFrame(context, canvas, spacing = 5) {
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = frame.data;
    // console.log(data.length);
    // console.log(data);

    // Check the flag to indicate hidden message
    if (data[0] !== 107) {
        console.log("No hidden message found.");
        return null;
    }

    let dataIndex = spacing;

    // Extract the length of the binary message
    const lengthInfo = extractBinaryString(data, dataIndex, 32, spacing);
    const messageLengthBinary = lengthInfo.binaryString;
    dataIndex = lengthInfo.dataIndex;

    const messageLength = parseInt(messageLengthBinary, 2);

    // Extract the binary message
    const messageInfo = extractBinaryString(data, dataIndex, messageLength, spacing);
    const binaryMessage = messageInfo.binaryString;

    // console.log(binaryMessage);
    const decryptedMessage = decryptBinaryData(binaryMessage);
    // console.log(decryptedMessage);
    const message = binaryToString(decryptedMessage);
    // console.log(message);

    return message;
}

// export default { embedMessageInFrame, extractMessageFromFrame };