import cv2
import websockets
import asyncio

async def stream_video():
    uri = "ws://localhost:8000/ws/video"
    cap = cv2.VideoCapture(0)

    async with websockets.connect(uri) as websocket:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            _, buffer = cv2.imencode('.jpg', frame)
            await websocket.send(buffer.tobytes())
            response = await websocket.recv()
            print(response)

asyncio.run(stream_video())
