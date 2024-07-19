function utf8ToBinaryString(utf8String) {
    const binaryString = unescape(encodeURIComponent(utf8String))
        .split('')
        .map(char => char.charCodeAt(0).toString(2).padStart(8, '0'))
        .join('');
    return binaryString;
}

function embedUtf8MessageInFrame(context, canvas, utf8Message, spacing = 5) {
    const binaryMessage = utf8ToBinaryString(utf8Message);
    embedMessageInFrame(context, canvas, binaryMessage, spacing);
}

function extractUtf8MessageFromFrame(context, canvas, spacing = 5) {
    const binaryMessage = extractMessageFromFrame(context, canvas, spacing);
    if (!binaryMessage) {
        return null;
    }
    const utf8Message = binaryStringToUtf8(binaryMessage);
    return utf8Message;
}

// Sử dụng các hàm mã hóa và giải mã UTF-8 để ẩn và rút trích tin nhắn
const utf8Message = "Tin nhắn tiếng Việt";
embedUtf8MessageInFrame(context, canvas, utf8Message);

const extractedUtf8Message = extractUtf8MessageFromFrame(context, canvas);
console.log(extractedUtf8Message); // In ra "Tin nhắn tiếng Việt"
