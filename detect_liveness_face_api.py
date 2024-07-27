from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import tensorflow as tf
import pickle
import os

app = FastAPI()

# Cấu hình CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Thay đổi tùy theo nguồn của bạn
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model_path = 'public/weights/liveness_model.h5'
le_path = 'public/weights/label_encoder.pickle'
encodings = 'public/weights/encoded_faces.pickle'
detector_folder = 'public/lib/face_detector'
confidence = 0.5
args = {'model': model_path, 'le': le_path, 'detector': detector_folder, 
        'encodings': encodings, 'confidence': confidence}

# load the encoded faces and names
print('[INFO] loading encodings...')
with open(args['encodings'], 'rb') as file:
    encoded_data = pickle.loads(file.read())

# load our serialized face detector from disk
print('[INFO] loading face detector...')
proto_path = os.path.sep.join([args['detector'], 'deploy.prototxt'])
model_path = os.path.sep.join([args['detector'], 'res10_300x300_ssd_iter_140000.caffemodel'])
print(model_path)
detector_net = cv2.dnn.readNetFromCaffe(proto_path, model_path)

# load the liveness detector model and label encoder from disk
liveness_model = tf.keras.models.load_model(args['model'])
le = pickle.loads(open(args['le'], 'rb').read())

async def detect_face_liveness(img):
    h, w = img.shape[:2]
    blob = cv2.dnn.blobFromImage(cv2.resize(img, (300, 300)), 1.0, (300, 300), (104.0, 177.0, 123.0))
    detector_net.setInput(blob)
    detections = detector_net.forward()

    for i in range(0, detections.shape[2]):
        confidence = detections[0, 0, i, 2]
        if confidence > args['confidence']:
            box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
            startX, startY, endX, endY = box.astype('int')

            face = img[startY:endY, startX:endX]
            try:
                face = cv2.resize(face, (32, 32))
            except:
                continue

            face = face.astype('float') / 255.0
            face = tf.keras.preprocessing.image.img_to_array(face)
            face = np.expand_dims(face, axis=0)
            preds = liveness_model.predict(face)[0]
            j = np.argmax(preds)
            label_name = le.classes_[j]

            if label_name == 'fake':
                return False
    return True

@app.post("/check_liveness")
async def check_liveness(files: list[UploadFile] = File(...)):
    real_count = 0
    total_count = len(files)

    for file in files:
        image = await file.read()
        nparr = np.frombuffer(image, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if await detect_face_liveness(img):
            real_count += 1

    if total_count == 0:
        return JSONResponse(content={'result': 'No images provided'}, status_code=400)

    success_rate = real_count / total_count
    print(success_rate)
    if success_rate >= 0.8:
        return JSONResponse(content={'result': 'Success'})
    else:
        return JSONResponse(content={'result': 'Failure'})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)

# uvicorn detect_liveness_face_api:app --reload --port 5000