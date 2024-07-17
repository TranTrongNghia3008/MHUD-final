const videoGrid = document.getElementById("video_grid");
const muteBtn = document.getElementById("muteBtn")
const cameraoff = document.getElementById("cameraoff")
const selectCam = document.getElementById("selectCam")
const selectMic = document.getElementById("selectMic")
const screenShare = document.getElementById("screenShare")

// socket init 
const socket = io();

let mediaStream;
let mute = false;
let camera = true;
let currentCam;
let RTC;

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

const mtcnnForwardParams = {
    // limiting the search space to larger faces for webcam detection
    minFaceSize: 200
}

//positions for sunglasess
var results = []

//utility functions
async function getFace(localVideo, options){
    results = await faceapi.mtcnn(localVideo, options)
}


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

        // await faceapi.loadMtcnnModel('/weights')
        // await faceapi.loadFaceRecognitionModel('/weights')
        mediaStream = await window.navigator.mediaDevices.getUserMedia(cameraId || micId ? cameraId ? preferredCameraConstraints : preferredMicConstraints : initialConstraits)
        // send joining notification

        // let localVideo = document.createElement("video")
        // const canvas = document.createElement('canvas');
        // canvas.width = 640;  // Set to desired width
        // canvas.height = 480;
        // localVideo.srcObject = mediaStream;
        // localVideo.autoplay = true
        // localVideo.addEventListener('playing', () => {
        //     let ctx = canvas.getContext("2d");
        //     let image = new Image()
        //     image.src = "img/sunglasses-style.png"

        //     function step() {
        //         getFace(localVideo, mtcnnForwardParams)
        //         ctx.drawImage(localVideo, 0, 0)
        //         results.map(result => {
        //             ctx.drawImage(
        //                 image,
        //                 result.faceDetection.box.x,
        //                 result.faceDetection.box.y + 30,
        //                 result.faceDetection.box.width,
        //                 result.faceDetection.box.width * (image.height / image.width)
        //             )
        //         })
        //         requestAnimationFrame(step)
        //     }
            
        //     requestAnimationFrame(step)
        // })

        // mediaStream = canvas.captureStream(30);
        // // localVideo.srcObject = mediaStream;
        // videoGrid.appendChild(localVideo)
      
        await displayMedia()
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

// function updateTimeStats(timeInMs) {
//     forwardTimes = [timeInMs].concat(forwardTimes).slice(0, 30)
//     const avgTimeInMs = forwardTimes.reduce((total, t) => total + t) / forwardTimes.length
//     $('#time').val(`${Math.round(avgTimeInMs)} ms`)
//     $('#fps').val(`${faceapi.utils.round(1000 / avgTimeInMs)}`)
//   }

function calculateAngle(leftEye, rightEye) {
    const deltaY = rightEye[1].y - leftEye[1].y; // Sự khác biệt về y
    const deltaX = rightEye[3].x - leftEye[0].x; // Sự khác biệt về x
    return Math.atan2(deltaY, deltaX); // Tính góc
}

// display media
async function displayMedia() {
    await faceapi.loadFaceLandmarkModel('./lib/weights')
    await faceapi.nets.ssdMobilenetv1.loadFromUri('./lib/weights');
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    canvas.width = video.width;  // Set to desired width
    canvas.height = video.height;
    const originalMediaStream = mediaStream;

    video.srcObject = originalMediaStream;
    const options = getFaceDetectorOptions()
    // console.log(options)
    let image = new Image()
    image.src = "img/glasses3.png"
    
    
    
    video.addEventListener('playing', () => {
        
        const ctx = canvas.getContext('2d');
        async function step() {
            
            const result = await faceapi.detectSingleFace(video, options).withFaceLandmarks()
            if (result) {
                const dims = faceapi.matchDimensions(canvas, video, true)
                const resizedResult = faceapi.resizeResults(result, dims)

                const landmarks = resizedResult.landmarks;

                // Lấy vị trí các điểm cụ thể
                const leftEye = landmarks.getLeftEye();  // Một mảng các điểm cho mắt trái
                const rightEye = landmarks.getRightEye(); // Một mảng các điểm cho mắt phải
                const nose = landmarks.getNose(); // Một mảng các điểm cho mũi
                const mouth = landmarks.getMouth(); // Một mảng các điểm cho miệng
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                // console.log(leftEye, arightEye)

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

                // Tạo một canvas tạm để xoay ảnh kính
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = glassesWidth;
                tempCanvas.height = glassesHeight;
                const tempCtx = tempCanvas.getContext('2d');

                // Xoay canvas
                tempCtx.translate(glassesWidth / 2, glassesHeight / 2);
                tempCtx.rotate(angle); // Xoay theo góc tính được
                tempCtx.drawImage(image, -glassesWidth / 2, -glassesHeight / 2, glassesWidth, glassesHeight);

                // Vẽ kính lên canvas chính
                ctx.drawImage(tempCanvas, eyeCenter.x - glassesWidth / 2, eyeCenter.y - glassesHeight/1.7);
                // faceapi.draw.drawDetections(canvas, resizedResult)
                // faceapi.draw.drawFaceLandmarks(canvas, resizedResult)

                
            }
            // ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

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

    // Gán newMediaStream vào video.srcObject
    // video.srcObject = newMediaStream;

    // Thay thế mediaStream cũ bằng newMediaStream
    mediaStream = newMediaStream;
    


    
    // videoGrid.appendChild(video)
    videoGrid.appendChild(canvas)

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
    
}



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