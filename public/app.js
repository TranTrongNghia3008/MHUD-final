import { stringToBinary, encryptBinaryData, embedMessageInFrame, extractMessageFromFrame, extractSegmentFromFrame } from './steganography.js';
import { splitFileIntoSegments, bitStringToBinary } from './splitFile.js';

const videoGrid = document.getElementById("video_grid");
const muteBtn = document.getElementById("muteBtn")
const cameraoff = document.getElementById("cameraoff")
const selectCam = document.getElementById("selectCam")
const selectMic = document.getElementById("selectMic")
const screenShare = document.getElementById("screenShare")
const messageInput = document.getElementById("messageInput");
const sendMessageBtn = document.getElementById("sendMessageBtn");
const changeVoiceBtn = document.getElementById("changeVoiceBtn"); 

// socket init 
const socket = io();

let mediaStream;
let mute = false;
let changeVoice = false;
let camera = true;
let currentCam;
let RTC;
let embedMessage = "";
let audioContext;
let mediaStreamSource;
let pitchShifterNode;

// sound mute handler
muteBtn.addEventListener("click", (e) => {
    if (mute) {
        mute = false;
        muteBtn.textContent = "Mute yourself";
        mediaStream.getAudioTracks()
            .forEach(track => {
                track.enabled = true;
            })
    } else {
        mute = true;
        muteBtn.textContent = "Unmute yourself";
        mediaStream.getAudioTracks()
            .forEach(track => {
                track.enabled = false;
            })
    }
})

// Changevoice handler
changeVoiceBtn.addEventListener("click", (e) => {
    if (changeVoice) {
        changeVoice = false;
        changeVoiceBtn.textContent = "Change voice";

        // Ngắt kết nối pitchShifterNode
        mediaStreamSource.disconnect(pitchShifterNode);
        pitchShifterNode.disconnect(audioContext.destination);

        // Kết nối lại mediaStreamSource trực tiếp tới audioContext.destination
        mediaStreamSource.connect(audioContext.destination);

    } else {
        changeVoice = true;
        changeVoiceBtn.textContent = "Unchange voice";
        // Ngắt kết nối mediaStreamSource khỏi audioContext.destination
        mediaStreamSource.disconnect(audioContext.destination);

        // Kết nối mediaStreamSource tới pitchShifterNode và pitchShifterNode tới audioContext.destination
        mediaStreamSource.connect(pitchShifterNode).connect(audioContext.destination);
        
    }
})



cameraoff.addEventListener('click', () => {
    if (camera) {
        cameraoff.textContent = "Turn on camera";
        camera = false;
        mediaStream.getVideoTracks()
            .forEach(track => {
                track.enabled = false;
            })

    } else {
        cameraoff.textContent = "Turn off camera";
        camera = true;
        mediaStream.getVideoTracks()
            .forEach(track => {
                track.enabled = true;
            })
    }
})

async function captureAndCheckLiveness() {
    const video = document.createElement('video');
    video.srcObject = mediaStream;
    await new Promise(resolve => video.onloadedmetadata = resolve);

    video.play();

    const captureDuration = 3000; // Thời gian chụp ảnh (3 giây)
    const interval = 500; // Thời gian giữa các lần chụp (500ms)
    const images = [];

    // Hàm chuyển đổi DataURL thành Blob
    function dataURLToBlob(dataURL) {
        const [header, data] = dataURL.split(',');
        const mime = header.match(/:(.*?);/)[1];
        const binary = atob(data);
        const array = [];
        for (let i = 0; i < binary.length; i++) {
            array.push(binary.charCodeAt(i));
        }
        return new Blob([new Uint8Array(array)], { type: mime });
    }

    // Hàm chụp ảnh và thêm vào mảng
    function captureImage() {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg');
        images.push(imageData);
    }

    // Chụp ảnh liên tục trong khoảng thời gian 3 giây
    const captureInterval = setInterval(captureImage, interval);

    // Dừng chụp ảnh sau 3 giây
    setTimeout(async () => {
        clearInterval(captureInterval);

        // Chuyển đổi tất cả ảnh thành blob
        const formData = new FormData();
        const blobs = images.map(imageData => dataURLToBlob(imageData));

        // Đợi cho tất cả các Blob được tạo ra
        await Promise.all(blobs.map((blob, index) => {
            formData.append('files', blob, `image_${index}.jpg`);
        }));

        // Gửi ảnh lên server để kiểm tra liveness
        try {
            const response = await fetch('http://localhost:5000/check_liveness', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();

            // Hiển thị cảnh báo với kết quả
            alert(`Liveness check result: ${result.result}`);

            if (result.result === 'Success') {
                console.log('Liveness check passed. Proceeding...');
                // Tiếp tục thực hiện các hành động khác
            } else {
                console.log('Liveness check failed. Redirecting to login...');
                // Chuyển hướng về trang login
                window.location.href = '/auth/login';
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while checking liveness.');
        }
    }, captureDuration);
}



// getting the medias
// hàm getMedia() được gọi để yêu cầu quyền truy cập vào camera và microphone của thiết bị
async function getMedia(cameraId, micId) {
    currentCam = cameraId === null ? currentCam : cameraId;

    const initialConstraits = {
        video: true,
        audio: true
    }

    const preferredCameraConstraints = {
        video: {
            deviceId: cameraId
        },
        audio: true,
    }

    const videoOption = currentCam ? {
        deviceId: currentCam
    } : true;

    const preferredMicConstraints = {
        video: videoOption,
        audio: {
            deviceId: micId
        },
    }

    try {
        // Kiểm tra và yêu cầu quyền truy cập microphone        // await faceapi.loadMtcnnModel('/weights')
        // await faceapi.loadFaceRecognitionModel('/weights')

        mediaStream = await window.navigator.mediaDevices.getUserMedia(cameraId || micId ? cameraId ? preferredCameraConstraints : preferredMicConstraints : initialConstraits)
        // Tạo AudioContext
        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Thêm module AudioWorkletProcessor
        await audioContext.audioWorklet.addModule('/audio-worklet-processor.js');

        // Tạo MediaStreamSource
        mediaStreamSource = audioContext.createMediaStreamSource(mediaStream);

        // Tạo AudioWorkletNode
        pitchShifterNode = new AudioWorkletNode(audioContext, 'pitch-shifter-processor');

        mediaStreamSource.connect(audioContext.destination);

        // displayMedia()
        await displayMedia()
        // Gọi kiểm tra liveness trước khi tiếp tục
        await captureAndCheckLiveness();
        
        getAllCameras()
        getAllMics()
        // hàm getAllCameras() và getAllMics() được gọi để lấy danh sách các camera và microphone có sẵn trên thiết bị, và hiển thị chúng trên giao diện để người dùng có thể lựa chọn
        makeWebRTCConnection();

        // room joining event
        socket.emit('joinRoom', roomId)

    } catch (error) {
        console.log(error);
    }


}
getMedia()




let originalVideoTrack;
let originalAudioTrack;

async function getScreenMedia() {
    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: true,
        });

        // Lưu lại các track ban đầu
        if (!originalVideoTrack) {
            originalVideoTrack = mediaStream.getVideoTracks()[0];
        }
        if (!originalAudioTrack) {
            originalAudioTrack = mediaStream.getAudioTracks()[0];
        }

        // Thêm các track từ screenStream vào RTC
        const videoTrack = screenStream.getVideoTracks()[0];
        const audioTrack = screenStream.getAudioTracks()[0];

        if (RTC) {
            // Thay thế các track cũ bằng các track mới từ screen share
            RTC.getSenders().forEach(sender => {
                if (sender.track.kind === 'video' && videoTrack) {
                    sender.replaceTrack(videoTrack);
                }
                if (sender.track.kind === 'audio' && audioTrack) {
                    sender.replaceTrack(audioTrack);
                }
            });
        }

        mediaStream = screenStream;
        displayScreenMedia();

        // Nghe sự kiện khi kết thúc chia sẻ màn hình
        screenStream.getVideoTracks()[0].addEventListener('ended', () => {
            stopScreenShare();
        });
    } catch (error) {
        console.log(error);
    }
}

function stopScreenShare() {
    // Thay thế lại các track ban đầu vào RTC
    if (RTC) {
        RTC.getSenders().forEach(sender => {
            if (sender.track.kind === 'video' && originalVideoTrack) {
                sender.replaceTrack(originalVideoTrack);
            }
            if (sender.track.kind === 'audio' && originalAudioTrack) {
                sender.replaceTrack(originalAudioTrack);
            }
        });
    }
    // Xóa thẻ video có id="shareScreen"
    const shareScreenVideo = document.getElementById('shareScreen');
    if (shareScreenVideo) {
        videoGrid.removeChild(shareScreenVideo);
    }
}

function displayScreenMedia() {
    const video = document.createElement('video');
    video.id = "shareScreen"; 
    video.srcObject = mediaStream;
    video.addEventListener('loadedmetadata', () => {
        video.play();
    });
    videoGrid.appendChild(video);
}


screenShare.addEventListener('click', getScreenMedia)

let image = new Image()
image.src = ""

document.addEventListener("DOMContentLoaded", () => {
    const dropdownItems = document.querySelectorAll(".dropdown-item");

    dropdownItems.forEach(item => {
      item.addEventListener("click", (event) => {
        event.preventDefault();
        const src = item.getAttribute("data-src");
        if (src) {
          image.src = src;
        } else {
          image.src = ""; // Reset filter if "No filter" is selected
        }
      });
    });
});

function calculateAngle(leftEye, rightEye) {
    const deltaY = rightEye[1].y - leftEye[1].y; // Sự khác biệt về y
    const deltaX = rightEye[3].x - leftEye[0].x; // Sự khác biệt về x
    return Math.atan2(deltaY, deltaX); // Tính góc
}

function calculateGlassesParameters(landmarks) {
    console.log(image.src)
    // Lấy vị trí các điểm cụ thể
    const leftEye = landmarks.getLeftEye();  // Một mảng các điểm cho mắt trái
    const rightEye = landmarks.getRightEye(); // Một mảng các điểm cho mắt phải

    // Tính toán góc nghiêng
    const angle = calculateAngle(leftEye, rightEye);

    // Tính toán vị trí để vẽ kính
    const eyeCenter = {
        x: (leftEye[0].x + rightEye[3].x) / 2,
        y: (leftEye[0].y + rightEye[3].y) / 2,
    };

    // Tính khoảng cách giữa hai mắt
    const eyeDistance = Math.hypot(
        rightEye[3].x - leftEye[0].x,
        rightEye[3].y - leftEye[0].y
    );

    // Tính toán kích thước kính
    const glassesWidth = eyeDistance * 2; 
    const ratio = 0.2; 
    const glassesHeight = image.height * ratio;

    return {
        canvasWidth: glassesWidth,
        canvasHeight: glassesHeight,
        translateX: glassesWidth / 2,
        translateY: glassesHeight / 2,
        angle,
        drawImageX: -glassesWidth / 2,
        drawImageY: -glassesHeight / 2,
        drawImageWidth: glassesWidth,
        drawImageHeight: glassesHeight,
        finalDrawX: eyeCenter.x - glassesWidth / 2,
        finalDrawY: eyeCenter.y - glassesHeight / 1.7
    };
}


function calculateAngleBetweenPoints(point1, point2) {
    const deltaY = point2.y - point1.y;
    const deltaX = point2.x - point1.x;
    return Math.atan2(deltaY, deltaX);
}

function calculateHatParameters(landmarks) {
    // Lấy vị trí các điểm cụ thể
    const jawOutline = landmarks.getJawOutline();  // Một mảng các điểm cho viền mặt

    // Tìm hai điểm trên cùng của viền mặt
    const topPoint1 = jawOutline[0];
    const topPoint2 = jawOutline[16];

    // Tính toán góc nghiêng
    const angle = calculateAngleBetweenPoints(topPoint1, topPoint2);

    // Tính toán vị trí để vẽ mũ
    const centerX = (topPoint1.x + topPoint2.x) / 2;
    const centerY = (topPoint1.y + topPoint2.y) / 2;

    // Tính khoảng cách giữa hai điểm trên cùng của viền mặt
    const distance = Math.hypot(
        topPoint2.x - topPoint1.x,
        topPoint2.y - topPoint1.y
    );

    // Tính toán kích thước mũ
    const hatWidth = distance * 3; 
    const ratio = 0.5; // Tỷ lệ kích thước của mũ
    const hatHeight = image.width * ratio;

    return {
        canvasWidth: hatWidth,
        canvasHeight: hatHeight,
        translateX: hatWidth / 2,
        translateY: hatHeight / 2,
        angle,
        drawImageX: -hatWidth / 2,
        drawImageY: -hatHeight / 2,
        drawImageWidth: hatWidth,
        drawImageHeight: hatHeight,
        finalDrawX: centerX - hatWidth / 2,
        finalDrawY: centerY - hatHeight / 2
    };
}

function calculateMaskParameters(landmarks) {
    // Lấy các điểm landmarks
    const jawOutline = landmarks.getJawOutline(); // Viền mặt
    const leftEyebrow = landmarks.getLeftEyeBrow(); // Chân mày trái
    const rightEyebrow = landmarks.getRightEyeBrow(); // Chân mày phải

    // Tìm điểm giữa của hai chân mày
    const eyebrowCenterX = (leftEyebrow[4].x + rightEyebrow[0].x) / 2;
    const eyebrowCenterY = (leftEyebrow[4].y + rightEyebrow[0].y) / 2;
    const eyebrowCenter = { x: eyebrowCenterX, y: eyebrowCenterY };

    // Tìm các điểm trên cùng của viền mặt (điểm giữa bên trái và bên phải)
    // Tìm hai điểm trên cùng của viền mặt
    const topPoint1 = jawOutline[0];
    const topPoint2 = jawOutline[16];
    console.log(jawOutline)

    // Tính toán góc nghiêng
    const angle = calculateAngleBetweenPoints(topPoint1, topPoint2);



    // Tính toán vị trí để vẽ mặt nạ
    const maskCenter = eyebrowCenter;

    // Tính khoảng cách giữa hai điểm trên cùng của viền mặt
    const distance = Math.hypot(
        topPoint2.x - topPoint1.x,
        topPoint2.y - topPoint1.y
    );


    // Tính toán kích thước mặt nạ
    const maskWidth = distance * 2;
    const ratio = 1.3; // Tỷ lệ kích thước ảnh mặt nạ
    const maskHeight = maskWidth * ratio;

    return {
        canvasWidth: maskWidth,
        canvasHeight: maskHeight,
        translateX: maskWidth / 2,
        translateY: maskHeight / 2,
        angle, // Mặt nạ thường không cần xoay
        drawImageX: -maskWidth / 2,
        drawImageY: -maskHeight / 2,
        drawImageWidth: maskWidth,
        drawImageHeight: maskHeight,
        finalDrawX: maskCenter.x - maskWidth / 2,
        finalDrawY: maskCenter.y - maskHeight / 1.9
    };
}


async function calculateFilterParameters(landmarks) {
    const imagePath = new URL(image.src).pathname;
    switch (imagePath) {
        case '/img/glasses3.png':
            return calculateGlassesParameters(landmarks);
        case '/img/hat.png':
            return calculateHatParameters(landmarks);
        case '/img/mask.png':
            return calculateMaskParameters(landmarks);
        default:
            return null;
    }
}


// display media
async function displayMedia() {
    await faceapi.loadFaceLandmarkModel('/lib/weights')
    await faceapi.nets.ssdMobilenetv1.loadFromUri('/lib/weights');
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    canvas.width = video.width;  // Set to desired width
    canvas.height = video.height;
    const ctx = canvas.getContext('2d');
    const originalMediaStream = mediaStream;

    video.srcObject = originalMediaStream;
    const options = getFaceDetectorOptions()
    // console.log(options)
    
    
    
    video.addEventListener('playing', () => {
        
        async function step() {
            
            const result = await faceapi.detectSingleFace(video, options).withFaceLandmarks()
            if (result) {
                const dims = faceapi.matchDimensions(canvas, video, true)
                const resizedResult = faceapi.resizeResults(result, dims)

                const landmarks = resizedResult.landmarks;

                // Tính toán các tham số cần thiết
                const params = await calculateFilterParameters(landmarks);

                if (params) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    // Tạo một canvas tạm để xoay ảnh kính
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = params.canvasWidth;
                    tempCanvas.height = params.canvasHeight;
                    const tempCtx = tempCanvas.getContext('2d');

                    // Xoay canvas
                    tempCtx.translate(params.translateX, params.translateY);
                    tempCtx.rotate(params.angle); // Xoay theo góc tính được
                    tempCtx.drawImage(image, params.drawImageX, params.drawImageY, params.drawImageWidth, params.drawImageHeight);

                    // Vẽ kính lên canvas chính
                    ctx.drawImage(tempCanvas, params.finalDrawX, params.finalDrawY);
                }
                else {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                }

                // faceapi.draw.drawDetections(canvas, resizedResult)
                // faceapi.draw.drawFaceLandmarks(canvas, resizedResult)
                
            }
            else {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            }
       

            requestAnimationFrame(step)
        }

        requestAnimationFrame(step)
    })
    // Tạo media stream từ canvas
    const canvasStream = canvas.captureStream(30);
    const newMediaStream = new MediaStream();

    // Thêm các audio tracks từ mediaStream gốc vào newMediaStream
    originalMediaStream.getAudioTracks().forEach(track => newMediaStream.addTrack(track));

    // Thêm các video tracks từ canvasStream vào newMediaStream
    canvasStream.getVideoTracks().forEach(track => newMediaStream.addTrack(track));
    // mediaStream = canvas.captureStream(30)

    video.addEventListener('loadedmetadata', () => {
        video.play()
    })
    mediaStream = newMediaStream;
    videoGrid.appendChild(canvas)

}

sendMessageBtn.addEventListener('click', async () => {
    embedMessage = messageInput.value;
    messageInput.value = '';

    if (embedMessage) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 640;  // Điều chỉnh theo kích thước khung hình video của bạn
        canvas.height = 480; // Điều chỉnh theo kích thước khung hình video của bạn

        const videoTrack = mediaStream.getVideoTracks()[0];
        const imageCapture = new ImageCapture(videoTrack);

        imageCapture.grabFrame().then(imageBitmap => {
            context.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
            
            // console.log(embedMessage)
            const binaryMessage = stringToBinary(embedMessage);
            // console.log(binaryMessage);
            const encryptedMessage = encryptBinaryData(binaryMessage);
            // console.log(encryptedMessage);
            embedMessageInFrame(context, canvas, encryptedMessage);
            // console.log(context.getImageData(0, 0, canvas.width, canvas.height).data);

            const imageData = canvas.toDataURL(); // Mã hoá dữ liệu vào hình ảnh
            socket.emit('sendContext', { imageData: imageData }, roomId);

        }).catch(error => {
            console.error('Error embedding message in frame:', error);
        });
    }
});




// get all cameras
async function getAllCameras() {
    const currentCamera = mediaStream.getVideoTracks()[0];
    const allDevices = await window.navigator.mediaDevices.enumerateDevices();
    selectCam.innerHTML = ''
    allDevices.forEach(device => {

        if (device.kind === "videoinput") {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label;
            option.selected = device.label === currentCamera.label ? true : false;
            selectCam.appendChild(option)
        }
    })
}




// get all mics
async function getAllMics() {
    const currentMic = mediaStream.getAudioTracks()[0];
    const allDevices = await window.navigator.mediaDevices.enumerateDevices();
    selectMic.innerHTML = ''
    allDevices.forEach(device => {

        if (device.kind === "audioinput") {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label;
            option.selected = device.label === currentMic.label ? true : false;
            selectMic.appendChild(option)
        }
    })
}



// select a specific camera
selectCam.addEventListener('input', (e) => {
    const cameraId = e.target.value;
    getMedia(cameraId)

})

// select a specific camera
selectMic.addEventListener('input', (e) => {
    const micId = e.target.value;
    getMedia(null, micId)
})







/// socket

socket.on("newJoining", () => {
    makeAOffer()
})


// make WebRTC connection
function makeWebRTCConnection() {
    // rtc init
    RTC = new RTCPeerConnection({
        iceServers: [
            { 'url': 'stun:mtcnnRstun.services.mozilla.com' },
            { 'url': 'stun:stun.l.google.com:19302' },
            {
              urls: 'stun:stun1.l.google.com:19302'
            },
            {
              urls: 'stun:stun3.l.google.com:19302'
            },
            {
              urls: 'stun:stun4.l.google.com:19302'
            }
          ]
    });

    // add media tracks to RTC
    mediaStream.getTracks()
   .forEach(track => {
      RTC.addTrack(track,mediaStream )
  })

    // send ICE candidate
  RTC.addEventListener('icecandidate', (data) => {
    socket.emit( "sendIceCandidate",data.candidate, roomId);
  })

        // send ICE candidate
  RTC.addEventListener('addstream', (data) => {
      const videoTag = document.createElement('video');
      videoTag.srcObject = data.stream;
      videoTag.addEventListener('loadedmetadata', () => {
          videoTag.play()
      })

        videoGrid.appendChild(videoTag)
    })

    // Đoạn mã cho người nhận
    // Khi nhận được một sender mới từ phía người gửi
    RTC.addEventListener('track', async (event) => {
        if (event.track.kind === 'video') {
            const receiverVideoTrack = event.track;

            // Lấy khung hình từ video track mới
            const stream = new MediaStream([receiverVideoTrack]);
            const videoElement = document.createElement('video');
            videoElement.srcObject = stream;
            // console.log(1)
            // console.log(new Date());
        }
    });
}

socket.on('receiveContext', async (data) => {
    // const imgElement = document.getElementById('receivedImage');
    const imageDataUrl = data.imageData; // Assume imageData is a base64 encoded image data URL
    // console.log('Received image data:', imageDataUrl);

    // Tải hình ảnh từ data URL
    const response = await fetch(imageDataUrl);
    const blob = await response.blob();
    const img = new Image();

    img.onload = function() {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0);
        // console.log(context.getImageData(0, 0, canvas.width, canvas.height).data);

        // Giải mã dữ liệu từ hình ảnh
        const hiddenMessage = extractMessageFromFrame(context, canvas);
        if (hiddenMessage) {
            console.log('Hidden message received:', hiddenMessage);
            const listMessage = document.getElementById('receivedMessage');
            // Nếu listMessage không có phần tử con
            if (listMessage.children.length === 0) {
                listMessage.classList.add('border', 'px-2', 'mb-1');
                const headerMessage = document.createElement('p');
                headerMessage.textContent = 'Message received';
                headerMessage.style.fontWeight = 'bold';
                headerMessage.classList.add('mb-1', 'mt-2');
                listMessage.appendChild(headerMessage);
            }
            const newMessage = document.createElement('p');
            newMessage.textContent = hiddenMessage;
            listMessage.appendChild(newMessage);
        } else {
            console.log('No hidden message found.');
        }

        // phải giải phóng tài nguyên
        URL.revokeObjectURL(img.src);
    };

    img.src = URL.createObjectURL(blob); // Gán hình ảnh vào src để load
    // imgElement.src = data.imageData;
});

$(document).ready(function () {
    $('#fileInput').on('change', function () {
        // Xử lý khi người dùng chọn tệp
        const selectedFile = $(this)[0].files[0];
        if (selectedFile) {
            $('#uploadBtn').prop('disabled', false); // Kích hoạt nút uploadBtn nếu đã có tệp được chọn
        } else {
            $('#uploadBtn').prop('disabled', true); // Vô hiệu hóa nút uploadBtn nếu không có tệp nào được chọn
        }
    });

    $('#uploadBtn').on('click', async function () {
        // Xử lý khi người dùng nhấn nút Upload
        const formData = new FormData($('#uploadForm')[0]);

        const selectedFile = $('#fileInput')[0].files[0];
        const segments = await splitFileIntoSegments(selectedFile);
        // console.log(segments)

        segments.forEach(segment => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 640;  // Adjust to your video frame size
            canvas.height = 480; // Adjust to your video frame size

            const videoTrack = mediaStream.getVideoTracks()[0];
            const imageCapture = new ImageCapture(videoTrack);

            imageCapture.grabFrame().then(imageBitmap => {
                context.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
                // console.log(JSON.stringify(segment))

                const binaryMessage = stringToBinary(segment);
                // console.log(binaryMessage.length)
                embedMessageInFrame(context, canvas, binaryMessage);

                const imageData = canvas.toDataURL(); // Encode data into image
                socket.emit('sendFileContext', { imageData: imageData }, roomId);

            }).catch(error => {
                console.error('Error embedding message in frame:', error);
            });
        });

        alert('File uploaded successfully!');
    });
});

const fileMap = {};

socket.on('receiveFileContext', async (data) => {
    const imageDataUrl = data.imageData;
    const response = await fetch(imageDataUrl);
    const blob = await response.blob();
    const img = new Image();

    img.onload = function() {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0);

        const hiddenMessage = extractSegmentFromFrame(context, canvas);
        console.log(hiddenMessage);
        
        if (hiddenMessage) {
            const [fileName, isLastSegment, segmentData] = hiddenMessage.split('||');

            if (!fileMap[fileName]) {
                fileMap[fileName] = [];
            }
            fileMap[fileName].push(segmentData);
            if (isLastSegment === 'true') {
                // Tạo dữ liệu binary từ các đoạn
                const fileBitString = fileMap[fileName].join('');
                const fileBinary = bitStringToBinary(fileBitString);
                const blob = new Blob([fileBinary], { type: 'application/octet-stream' });
                const fileUrl = URL.createObjectURL(blob);
                
                // Tạo thẻ a để tải xuống tệp
                const fileLink = document.createElement('a');
                fileLink.href = fileUrl;
                fileLink.download = fileName; // Chỉ định tên file để tải về
                fileLink.innerText = `Download ${fileName}`;
                fileLink.target = "_blank"; // Mở liên kết trong một tab mới

    // Tìm phần tử div để chứa thẻ a
    const uploadedFilesDiv = document.getElementById('uploadedFiles');
    if (uploadedFilesDiv.children.length === 0) {
        uploadedFilesDiv.classList.add('border', 'px-2', 'mb-1');
        const headerMessage = document.createElement('p');
        headerMessage.textContent = 'File received';
        headerMessage.style.fontWeight = 'bold';
        headerMessage.classList.add('mb-1', 'mt-2');
        uploadedFilesDiv.appendChild(headerMessage);
    }
    uploadedFilesDiv.appendChild(fileLink);

                // Thêm dòng mới (br tag) để ngăn cách các liên kết
                uploadedFilesDiv.appendChild(document.createElement('br'));
                
                // Xóa fileMap sau khi tải xuống
                delete fileMap[fileName];
            }
        }
        URL.revokeObjectURL(img.src);
    };

    img.src = URL.createObjectURL(blob);
});

// make a offer
async function makeAOffer() {
    const offer = await RTC.createOffer();
    RTC.setLocalDescription(offer)
    // send the offer 
    socket.emit("sendTheOffer", offer, roomId)
}

// receive offer
socket.on("receiveOffer", async (offer) => {
    RTC.setRemoteDescription(offer);
    const answer = await RTC.createAnswer();
    RTC.setLocalDescription(answer);
    
    // send the answer
    socket.emit("sendTheAnswer", answer, roomId)
})


// receive answer
socket.on("receiveAnswer", (answer) => {
    RTC.setRemoteDescription(answer)
})


// receive answer
socket.on("receiveCandidate", (candidate) => {
    RTC.addIceCandidate(candidate)
})