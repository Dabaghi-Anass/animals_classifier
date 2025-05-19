from fastapi import FastAPI, File, UploadFile # type: ignore
from fastapi.responses import JSONResponse # type: ignore
from fastapi.middleware.cors import CORSMiddleware # type: ignore
import numpy as np # type: ignore
import tensorflow as tf # type: ignore
from io import BytesIO
from PIL import Image # type: ignore
import os
import requests # type: ignore

# Define constants
MODEL_URL = "https://drive.google.com/uc?export=view&id=1bCLIFReV6_Ctwxc6tdtrfKE1VPpIH6Up"  # Replace this with your actual model URL
MODEL_PATH = "animals_classification_model_new_dataset_sgd_optimizer_v2.h5"

# App initialization
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Utility: Download model from URL if not already downloaded
def download_model_if_needed():
    if not os.path.exists(MODEL_PATH):
        print("Model not found. Downloading...")
        response = requests.get(MODEL_URL, stream=True)
        with open(MODEL_PATH, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        print("Model downloaded.")
    else:
        print("Model already exists.")

download_model_if_needed()

# Load model
model = tf.keras.models.load_model(MODEL_PATH)
input_shape = model.input_shape[1:3]

class_names = ['butterfly', "cat", "chicken", 'cow', "dog", 'elephant', "horse", "sheep", "spider", "squirrel"]

def preprocess_image(image_bytes):
    img = Image.open(BytesIO(image_bytes)).convert("RGB")
    img = img.resize(input_shape)
    img_array = np.array(img) / 255.0
    return np.expand_dims(img_array, axis=0)

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
        "prediction": predicted_label,
        "confidence": f"{confidence:.4f}"
    })
