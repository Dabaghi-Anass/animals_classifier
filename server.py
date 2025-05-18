from fastapi import FastAPI, File, UploadFile, WebSocket
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import cv2
import tensorflow as tf
from io import BytesIO
from PIL import Image
import math
model = tf.keras.models.load_model("animals_classification_model_new_dataset_sgd_optimizer_v2.h5")
input_shape = model.input_shape[1:3]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def preprocess_image(image_bytes):
    img = Image.open(BytesIO(image_bytes)).convert("RGB")
    img = img.resize(input_shape)
    img_array = np.array(img) / 255.0
    return np.expand_dims(img_array, axis=0)

class_names = ['butterfly', "cat", "chicken", 'cow', "dog", 'elephant', "horse", "sheep", "spider", "squirrel"]

def predict(image_array):
    prediction = model.predict(image_array)
    predicted_class = int(np.argmax(prediction))
    confidence = float(prediction[0][predicted_class])
    return class_names[predicted_class], confidence

@app.post("/predict")
async def predict_image(file: UploadFile = File(...)):
    contents = await file.read()
    x = preprocess_image(contents)
    predicted_label, confidence = predict(x)
    return JSONResponse(content={
        "prediction": str(predicted_label),
        "confidence": str(confidence),
    })

@app.websocket("/ws/video")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_bytes()
            nparr = np.frombuffer(data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is None:
                continue
            resized = cv2.resize(frame, input_shape)
            input_tensor = np.expand_dims(resized / 255.0, axis=0)
            predicted_label, confidence = predict(input_tensor)
            await websocket.send_json({
                "prediction": predicted_label,
                "confidence": str(confidence)
            })
    except Exception as e:
        print("Connection closed:", e)
        await websocket.close()
