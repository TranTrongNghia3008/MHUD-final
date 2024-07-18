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
let processedStream;
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

sendMessageBtn.addEventListener('click', () => {
    embedMessage = messageInput.value;
    messageInput.value = '';
});


// getting the medias
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
        // Kiểm tra và yêu cầu quyền truy cập microphone
        mediaStream = await window.navigator.mediaDevices.getUserMedia(cameraId || micId ? cameraId ? preferredCameraConstraints : preferredMicConstraints : initialConstraits)
        // Tạo AudioContext
        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Thêm module AudioWorkletProcessor
        await audioContext.audioWorklet.addModule('audio-worklet-processor.js');

        // Tạo MediaStreamSource
        mediaStreamSource = audioContext.createMediaStreamSource(mediaStream);

        // Tạo AudioWorkletNode
        pitchShifterNode = new AudioWorkletNode(audioContext, 'pitch-shifter-processor');

        mediaStreamSource.connect(audioContext.destination);

        displayMedia()
        // Create canvas and context
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 640;  // Set to desired width
        canvas.height = 480; // Set to desired height

        // Process media stream
        processedStream = canvas.captureStream(30);
        const [videoTrack] = mediaStream.getVideoTracks();
        const imageCapture = new ImageCapture(videoTrack);

        function processFrame() {
            imageCapture.grabFrame().then(imageBitmap => {
                context.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);

                if (embedMessage) {
                    embedMessageInFrame(context, canvas, embedMessage);
                    // embedMessage = ""; // Reset the message after embedding
                    console.log('context'+context)
                }

                requestAnimationFrame(processFrame);
            });

            const newMediaStream = new MediaStream();

            // Thêm các audio tracks từ mediaStream gốc vào newMediaStream
            mediaStream.getAudioTracks().forEach(track => newMediaStream.addTrack(track));

            // Thêm các video tracks từ processedStream vào newMediaStream
            processedStream.getVideoTracks().forEach(track => newMediaStream.addTrack(track));

            mediaStream = newMediaStream;
        }
        processFrame();
        
        // send joining notification
        
        
        getAllCameras()
        getAllMics()
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

function embedMessageInFrame(context, canvas, message) {
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = frame.data;
    console.log('data' + data)

    const binaryMessage = message.split('').map(char => {
        return char.charCodeAt(0).toString(2).padStart(8, '0');
    }).join('');

    let dataIndex = 0;
    for (let i = 0; i < binaryMessage.length; i++) {
        if (dataIndex >= data.length) break;

        // Embed each bit of the message in the least significant bit of each pixel component (R, G, B)
        data[dataIndex] = (data[dataIndex] & 0xFE) | parseInt(binaryMessage[i]);
        dataIndex += 4; // Move to the next pixel (R component)
    }
    console.log('data1[0]=' + data[0])
    // Set a flag to mark the frame as containing a message
    data[0] = 205;
    console.log('data2[0]=' + data[0])

    context.putImageData(frame, 0, 0);
}

function extractMessageFromFrame(context, canvas) {
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = frame.data;
    console.log('data3[0]=' + data[0])

    // Check the flag to see if the frame contains a message
    if (data[0] !== 205) return null;
    // console.log('data[data.length - 1]='+data[data.length - 1])

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
        RTC.addTrack(track,mediaStream)
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
        // Create canvas and context to extract message
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 640;  // Set to desired width
        canvas.height = 480; // Set to desired height

        const [videoTrack] = data.stream.getVideoTracks();
        const imageCapture = new ImageCapture(videoTrack);

        function processReceivedFrame() {
            // if (videoTag.readyState === videoTag.HAVE_ENOUGH_DATA) {
                imageCapture.grabFrame().then(imageBitmap => {
                    
                    context.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);

                    const message = extractMessageFromFrame(context, canvas);
                    if (message) {
                        console.log('Extracted message:', message);
                        alert('Extracted message: ' + message);
                    }

                    requestAnimationFrame(processReceivedFrame);
                });
            // }
            // mediaStream = processedStream;
        }
        processReceivedFrame();

    //   function processReceivedFrame() {
    //       if (videoTag.readyState === videoTag.HAVE_ENOUGH_DATA) {

    //         imageCapture.grabFrame().then(imageBitmap => {
    //             context.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
    //             const message = extractMessageFromFrame(context, canvas);
    //             if (message) {
    //                 console.log('Extracted message:', message);
    //                 alert('Extracted message: ' + message);
    //             }

    //             if (embedMessage) {
    //                 embedMessageInFrame(context, canvas, embedMessage);
    //                 embedMessage = ""; // Reset the message after embedding
    //             }

    //             requestAnimationFrame(processFrame);
    //         });

    //           context.drawImage(videoTag, 0, 0, canvas.width, canvas.height);

    //           // Extract message from the frame
    //           const message = extractMessageFromFrame(context, canvas);
    //           if (message) {
    //               console.log('Extracted message:', message);
    //               alert('Extracted message: ' + message);
    //           }
    //       }

    //       requestAnimationFrame(processReceivedFrame);
    //   }

    //   processReceivedFrame();
  })
    
}



// make a offer
async function makeAOffer() {
    const offer = await RTC.createOffer();
    RTC.setLocalDescription(offer)
    console.log(offer)
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