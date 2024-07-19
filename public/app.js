import { stringToBinary, encryptBinaryData, embedMessageInFrame, extractMessageFromFrame } from './steganography.js';

const videoGrid = document.getElementById("video_grid");
const muteBtn = document.getElementById("muteBtn")
const cameraoff = document.getElementById("cameraoff")
const selectCam = document.getElementById("selectCam")
const selectMic = document.getElementById("selectMic")
const screenShare = document.getElementById("screenShare")
const messageInput = document.getElementById("messageInput");
const sendMessageBtn = document.getElementById("sendMessageBtn");

// socket init 
const socket = io();

let mediaStream;
let processedStream;
let mute = false;
let camera = true;
let currentCam;
let RTC;
let embedMessage = "";

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


        mediaStream = await window.navigator.mediaDevices.getUserMedia(cameraId || micId ? cameraId ? preferredCameraConstraints : preferredMicConstraints : initialConstraits)
        displayMedia()
        
        
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




async function getScreenMedia() {
    try {
        mediaStream = await navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: true,
        });
        displayMedia()
    } catch (error) {
        console.log(error);
    }
}


screenShare.addEventListener('click', getScreenMedia)


// display media
function displayMedia() {
    const video = document.createElement('video');
    video.srcObject = mediaStream;
    video.addEventListener('loadedmetadata', () => {
        video.play()
    })
    videoGrid.appendChild(video)

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
            // console.log(track)
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
            // Xử lý hoặc hiển thị dữ liệu ở đây
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

    $('#uploadBtn').on('click', function () {
        // Xử lý khi người dùng nhấn nút Upload
        const formData = new FormData($('#uploadForm')[0]);

        $.ajax({
            url: '/upload',
            type: 'POST',
            data: formData,
            contentType: false,
            processData: false,
            success: function (response) {
                alert('File uploaded successfully!');
                // Emit socket event 'fileUploaded' with roomId
                socket.emit('fileUploaded', {
                    fileUrl: response.fileUrl,
                    filename: response.filename
                }, roomId);
            },
            error: function (jqXHR, textStatus, errorThrown) {
                alert('File upload failed!');
            }
        });
    });
});

socket.on('renderFileUploaded', (data) => {
    // Tạo thẻ a để tải xuống tệp
    const fileLink = document.createElement('a');
    fileLink.href = `/download/${encodeURIComponent(data.fileUrl)}`;
    fileLink.innerText = `Download ${data.filename}`;
    fileLink.target = "_blank"; // Mở liên kết trong một tab mới

    // Tìm phần tử div để chứa thẻ a
    const uploadedFilesDiv = document.getElementById('uploadedFiles');
    uploadedFilesDiv.appendChild(fileLink);

    // Thêm dòng mới (br tag) để ngăn cách các liên kết
    uploadedFilesDiv.appendChild(document.createElement('br'));
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












/* 
    1. RTC connection initialization after media stream ready!
    2. add media tracks to RTC
*/