export function binaryToBitString(binaryData) {
    return Array.from(new Uint8Array(binaryData)).map(byte =>
        byte.toString(2).padStart(8, '0') // Chuyển đổi từng byte thành chuỗi nhị phân 8 bit
    ).join('');
}

export function bitStringToBinary(bitString) {
    const bytes = [];
    for (let i = 0; i < bitString.length; i += 8) {
        const byte = bitString.slice(i, i + 8);
        bytes.push(parseInt(byte, 2));
    }
    return new Uint8Array(bytes).buffer;
}

export function splitFileIntoSegments(file) {
    const segmentSize = 3000; // Kích thước đoạn dữ liệu
    const segments = [];
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
        reader.onload = function (event) {
            const binaryData = event.target.result;
            let start = 0;
            while (start < binaryData.byteLength) {
                const end = Math.min(start + segmentSize, binaryData.byteLength);
                const segment = binaryData.slice(start, end);
                const isLastSegment = end === binaryData.byteLength;
                const segmentString = `${file.name}||${isLastSegment}||${binaryToBitString(segment)}`;
                segments.push(segmentString);
                start = end;
            }
            resolve(segments);
        };
        reader.onerror = function (error) {
            reject(error);
        };
        reader.readAsArrayBuffer(file);
    });
}

