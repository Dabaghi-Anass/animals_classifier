FROM python:3.10-slim

RUN apt-get update && apt-get install -y \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY server/* .
RUN wget -O animals_classification_model_new_dataset_sgd_optimizer_v2.h5 https://drive.google.com/uc?export=view&id=1bCLIFReV6_Ctwxc6tdtrfKE1VPpIH6Up
COPY animals_classification_model_new_dataset_sgd_optimizer_v2.h5 .
EXPOSE 8080

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080"]
