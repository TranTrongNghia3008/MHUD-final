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
            // console.log(context.getImageData(0, 0, canvas.width, canvas.height).data);
            embedMessageInFrame(context, canvas, embedMessage);
            const imageData = canvas.toDataURL(); // Mã hoá dữ liệu vào hình ảnh
            socket.emit('sendContext', { imageData: imageData }, roomId);

            // // Create a new video track from the canvas
            // const newStream = canvas.captureStream();
            // const newVideoTrack = newStream.getVideoTracks()[0];

            // // Replace the old video track with the new one in the mediaStream
            // // khúc này là đổi ở bên A
            // mediaStream.removeTrack(videoTrack);
            // mediaStream.addTrack(newVideoTrack);

            // // Update RTC connection with the new video track
            // // khúc này là đổi cho bên B
            // const sender = RTC.getSenders().find(s => s.track.kind === 'video');
            // if (sender) {
            //     sender.replaceTrack(newVideoTrack);
            // }
            // // socket.emit('sendNewTrack', { trackId: newVideoTrack.id });
            // // console.log(newVideoTrack)
            
            

            // console.log('Video track updated with embedded message.');
            // console.log(context.getImageData(0, 0, canvas.width, canvas.height).data);
            // socket.emit("sendNewTrack", { imageData: canvas.toDataURL() }, roomId);
            // // const canvas1 = document.createElement('canvas');
            // // canvas1.width = 640; // Ensure the size matches the original canvas
            // // canvas1.height = 480;
            // // const videoTrack1 = newVideoTrack;
            // // const imageCapture1 = new ImageCapture(videoTrack1);
            // // const context1 = canvas1.getContext('2d');
            
            // // imageCapture1.grabFrame().then(imageBitmap1 => {
            // //     context1.drawImage(imageBitmap1, 0, 0, canvas1.width, canvas1.height);

            // //     // Extract hidden message from the frame 
            // //     // console.log(context.getImageData(0, 0, canvas.width, canvas.height).data)
            // //     // console.log(context1.getImageData(0, 0, canvas.width, canvas.height).data)
            // //     const hiddenMessage = extractMessageFromFrame(context1, canvas1);
            // //     if (hiddenMessage) {
            // //         console.log('Hidden message received:', hiddenMessage);
            // //     }
            // // }).catch(error => {
            // //     console.error('Error extracting message from frame:', error);
            // // });

            // // Reset to the original video track after 1 second
            // setTimeout(() => {
            //     // console.log(newVideoTrack)
            //     // socket.emit("sendNewTrack", { id: newVideoTrack.id }, roomId);
            //     mediaStream.removeTrack(newVideoTrack);
            //     mediaStream.addTrack(videoTrack);

            //     if (sender) {
            //         sender.replaceTrack(videoTrack);
            //     }

            //     console.log('Video track reverted to original.');
            // }, 5000); // Thực hiện sau 1 giây
        }).catch(error => {
            console.error('Error embedding message in frame:', error);
        });
    }
});

function embedMessageInFrame(context, canvas, message) {
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = frame.data;
    console.log(data.length)
    console.log(data)

    // Embedding the message in the frame data
    // Example: Embedding logic (modify according to your encoding method)
    const binaryMessage = message.split('').map(char => {
        return char.charCodeAt(0).toString(2).padStart(8, '0');
    }).join('');
    console.log(binaryMessage)

    let dataIndex = 0;
    for (let i = 0; i < binaryMessage.length; i++) {
        if (dataIndex >= data.length) break;

        // Embed each bit of the message in the least significant bit of each pixel component (R, G, B)
        data[dataIndex] = (data[dataIndex] & 0xFE) | parseInt(binaryMessage[i]);
        dataIndex += 4; // Move to the next pixel (R component)
    }

    // Set a flag to mark the frame as containing a hidden message (e.g., using the first byte)
    data[0] = 205; // Example: Setting a special flag

    context.putImageData(frame, 0, 0);
}

// Function to extract hidden message from the frame
function extractMessageFromFrame(context, canvas) {
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = frame.data;

    // Check if the frame contains a hidden message (using the flag or other criteria)
    if (data[0] === 205) {
        // Extract hidden message logic
        let binaryMessage = '';
        for (let i = 0; i < data.length; i += 4) {
            const binaryChar = (data[i] & 0x1).toString(); // Extract the least significant bit from the R component
            binaryMessage += binaryChar;
        }

        const message = binaryMessage.match(/.{1,8}/g).map(byte => {
            return String.fromCharCode(parseInt(byte, 2));
        }).join('');

        return message;
    }

    return null; // No hidden message found
}

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
            console.log(1)
            console.log(new Date());

            // // Chờ cho video được tải và chơi để có thể trích xuất tin nhắn ẩn
            // videoElement.addEventListener('loadedmetadata', () => {
            //     const canvas = document.createElement('canvas');
            //     const context = canvas.getContext('2d');
            //     canvas.width = videoElement.videoWidth;
            //     canvas.height = videoElement.videoHeight;
            //     context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

            //     // Trích xuất tin nhắn ẩn từ khung hình
            //     const hiddenMessage = extractMessageFromFrame(context, canvas);
            //     if (hiddenMessage) {
            //         console.log('Hidden message received:', hiddenMessage);
            //         // Hiển thị hoặc xử lý tin nhắn ẩn ở đây
            //     }
            // });
        }
    });
}

socket.on('receiveContext', async (data) => {
    // console.log(2)
    // console.log(new Date());
    // console.log('Context received:', data);

    const imgElement = document.getElementById('receivedImage');
    
    const img = new Image();
    img.onload = function() {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0);

        // Giải mã dữ liệu từ hình ảnh
        const hiddenMessage = extractMessageFromFrame(context, canvas);
        if (hiddenMessage) {
            console.log('Hidden message received:', hiddenMessage);
            // Xử lý hoặc hiển thị dữ liệu ở đây
        } else {
            console.log('No hidden message found.');
        }
    };
    imgElement.src = data.imageData;
});


// socket.on('receiveNewTrack', async (data) => {
//     console.log('New track received:', data);
//     // Chờ track mới được thay thế trước khi xử lý
//     const receiverVideoTrack = RTC.getReceivers().find(r => r.track.kind === 'video');
//     console.log(receiverVideoTrack)

//     if (receiverVideoTrack) {
//         const stream = new MediaStream([receiverVideoTrack.track]);
//         const canvas = document.createElement('canvas');
//         canvas.width = 640; // Ensure the size matches the original canvas
//         canvas.height = 480;
//         const context = canvas.getContext('2d');
//         const videoTrack = stream.getVideoTracks()[0];
//         const imageCapture = new ImageCapture(videoTrack);
        
        // imageCapture.grabFrame().then(imageBitmap => {
        //     context.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
        //     console.log(context.getImageData(0, 0, canvas.width, canvas.height).data);

        //     // Extract hidden message from the frame 
        //     // console.log(context.getImageData(0, 0, canvas.width, canvas.height).data)
        //     // console.log(context1.getImageData(0, 0, canvas.width, canvas.height).data)
        //     const hiddenMessage = extractMessageFromFrame(context, canvas);
        //     if (hiddenMessage) {
        //         console.log('Hidden message received:', hiddenMessage);
        //     }
        // }).catch(error => {
        //     console.error('Error extracting message from frame:', error);
        // });
//     } 
//     // }
// });
// socket.on('receiveNewTrack', (track) => {
    // console.log(2)
    // console.log(new Date());
//     console.log(track)
    
    // const canvas = document.createElement('canvas');
    // canvas.width = 640; // Ensure the size matches the original canvas
    // canvas.height = 480;
    // const context = canvas.getContext('2d');
    // const videoTrack = mediaStream.getVideoTracks()[0];
    // console.log(mediaStream.getVideoTracks()[1])
    // const imageCapture = new ImageCapture(videoTrack);
    
    // imageCapture.grabFrame().then(imageBitmap => {
    //     context.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
    //     console.log(context.getImageData(0, 0, canvas.width, canvas.height).data);

    //     // Extract hidden message from the frame 
    //     // console.log(context.getImageData(0, 0, canvas.width, canvas.height).data)
    //     // console.log(context1.getImageData(0, 0, canvas.width, canvas.height).data)
    //     const hiddenMessage = extractMessageFromFrame(context, canvas);
    //     if (hiddenMessage) {
    //         console.log('Hidden message received:', hiddenMessage);
    //     }
    // }).catch(error => {
    //     console.error('Error extracting message from frame:', error);
    // });
// });

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