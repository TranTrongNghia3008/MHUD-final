let faceInCircleTime = 0;
const requiredTime = 3000; // 3 seconds
let intervalId = null;
let faceData = null;

async function startVideo() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoElement = document.getElementById('videoElement');
        videoElement.srcObject = stream;
        await faceapi.nets.tinyFaceDetector.loadFromUri('/lib/weights');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/lib/weights');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/lib/weights');
        detectFace();
    } catch (error) {
        console.error('Error accessing the camera', error);
    }
}

async function detectFace() {
    const video = document.getElementById('videoElement');
    const overlayCanvas = document.getElementById('overlayCanvas');
    const overlayCtx = overlayCanvas.getContext('2d');

    overlayCanvas.width = video.videoWidth;
    overlayCanvas.height = video.videoHeight;

    const options = new faceapi.TinyFaceDetectorOptions();

    const result = await faceapi.detectSingleFace(video, options);

    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    if (result) {
        const { width, height, x, y } = result.box;
        overlayCtx.strokeStyle = 'red';
        overlayCtx.strokeRect(x, y, width, height);

        const circleX = overlayCanvas.width / 2;
        const circleY = overlayCanvas.height / 2;
        const circleRadius = 175; // half of 350px

        const faceCenterX = x + width / 2;
        const faceCenterY = y + height / 2;

        const distance = Math.sqrt(
            Math.pow(faceCenterX - circleX, 2) + Math.pow(faceCenterY - circleY, 2)
        );

        if (distance < circleRadius && width < 350 && height < 350) {
            if (!intervalId) {
                intervalId = setInterval(() => {
                    faceInCircleTime += 100;
                    if (faceInCircleTime >= requiredTime) {
                        captureImage(video);
                        stopVideo(video.srcObject);
                        clearInterval(intervalId);
                    }
                }, 100);
            }
        } else {
            clearInterval(intervalId);
            intervalId = null;
            faceInCircleTime = 0;
        }
    } else {
        clearInterval(intervalId);
        intervalId = null;
        faceInCircleTime = 0;
    }

    requestAnimationFrame(detectFace);
}

async function captureImage(video) {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL('image/png');
    faceData = imageData;

    // Hiển thị ảnh lên canvas overlay
    const imageCanvas = document.getElementById('imageCanvas');
    const imageCtx = imageCanvas.getContext('2d');
    imageCanvas.width = canvas.width;
    imageCanvas.height = canvas.height;
    const img = new Image();
    img.onload = function() {
        imageCtx.drawImage(img, 0, 0);
    };
    img.src = imageData;

    document.querySelector('.instructions').textContent = 'Face recognition successful!';
    document.querySelector('.instructions').style.color = '#4CAF50'; 

    try {
        const response = await fetch('/upload-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ imageData })
        });

    } catch (error) {
        console.error('Error uploading image', error);
    }
}

function stopVideo(stream) {
    stream.getTracks().forEach(track => track.stop());
}

document.addEventListener('DOMContentLoaded', startVideo);
document.addEventListener('DOMContentLoaded', () => {
    const loginButton = document.getElementById('registerButton');

    loginButton.addEventListener('click', async () => {
        // Prevent default form submission
        

        const name = document.getElementById('fYourName').value;
        const email = document.getElementById('fEmail').value;
        const password = document.getElementById('fPassword').value;

        if (name && email && password && faceData) {
            event.preventDefault();
            try {
                const response = await fetch('/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ name, email, password, faceData })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message);
                }

                window.location.href = '/login';
    
            } catch (error) {
                console.error('Error uploading image', error);
            }
        }

        else if (!faceData) {
            event.preventDefault();
            document.querySelector('.instructions').textContent = 'Please position your face within the circle in 3s';
            document.querySelector('.instructions').style.color = '#dc3545'; 
        }

    });
});