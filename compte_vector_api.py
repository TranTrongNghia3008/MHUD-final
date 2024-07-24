# Importing necessary libraries
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import numpy as np
import cv2
import os
import torch
from torchvision import transforms
import torch
from PIL import Image
import open_clip

# Creating an instance of the FastAPI class
app = FastAPI()

# Adding CORS middleware to allow cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Defining the request body model
class ImageRequest(BaseModel):
    image: List[List[List[int]]]

# Tải mô hình và các hàm chuyển đổi
model, _, preprocess = open_clip.create_model_and_transforms('ViT-B-32', pretrained='openai')
device = torch.device("cpu")
torch.cuda.empty_cache()
model = model.to(device)

def get_image_embedding(raw_image):
    image = preprocess(raw_image).unsqueeze(0).to(device)
    with torch.no_grad(), torch.cuda.amp.autocast():
        image_features = model.encode_image(image)
    return image_features

class Item(BaseModel):
    name: str
    description: str = None
    price: float
    tax: float = None

@app.post("/embed_image/")
async def embed_image(file: UploadFile = File(...)):
    try:
        image = Image.open(file.file)
        embedding = get_image_embedding(image)
        embedding_list = embedding.squeeze().tolist()
        return JSONResponse(content={"embedding": embedding_list})
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

# Compare 2 image 
@app.post("/authorization/")
async def is_authorize(src: UploadFile = File(...), img: UploadFile = File(...)):
    try:
        src_image = Image.open(src.file)
        img = Image.open(img.file)
        src_embedding = get_image_embedding(src_image)
        img_embedding = get_image_embedding(img)
        threshold = 0.85
        is_authorized = torch.nn.functional.cosine_similarity(src_embedding, img_embedding) > threshold
        return JSONResponse(content={"is_authorized": is_authorized.item()})
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

# Root endpoint
@app.get("/")
def read_root():
    return {"message": "Welcome to the FastAPI application!"}

# Endpoint to retrieve item by ID
@app.get("/items/{item_id}")
def read_item(item_id: int, q: str = None):
    return {"item_id": item_id, "q": q}

# Endpoint to create an item
@app.post("/items/")
def create_item(item: Item):
    return {"item": item}

@app.post("/uploadfile/")
async def upload_file(file: UploadFile = File(...)):
    return {"filename": file.filename}

# Run the application
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
