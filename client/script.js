document.addEventListener('DOMContentLoaded', () => {
  const tabTriggers = document.querySelectorAll('.tab-trigger');
  const tabContents = document.querySelectorAll('.tab-content');
  const imageUpload = document.getElementById('image-upload');
  const imagePreviewContainer = document.getElementById(
    'image-preview-container'
  );
  const imagePreview = document.getElementById('image-preview');
  const currentImageContainer = document.getElementById(
    'current-image-container'
  );
  const currentImage = document.getElementById('current-image');
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const startStreamBtn = document.getElementById('start-stream');
  const stopStreamBtn = document.getElementById('stop-stream');
  const predictionContainer = document.getElementById('prediction-container');
  const predictionTitle = document.getElementById('prediction-title');
  const predictionBox = document.getElementById('prediction-box');

  // Animal classes
  const animalClasses = [
    'butterfly',
    'cat',
    'chicken',
    'cow',
    'dog',
    'elephant',
    'horse',
    'sheep',
    'spider',
    'squirrel',
  ];

  // State
  let activeTab = 'upload';
  let isStreaming = false;
  let ws = null;
  let currentImageUrl = null;

  // Tab switching
  tabTriggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const tab = trigger.dataset.tab;

      // Update active tab trigger
      tabTriggers.forEach((t) => t.classList.remove('active'));
      trigger.classList.add('active');

      // Update active tab content
      tabContents.forEach((content) => content.classList.remove('active'));
      document.getElementById(`${tab}-tab`).classList.add('active');

      activeTab = tab;

      // Hide prediction when switching tabs
      predictionContainer.hidden = true;
      currentImageContainer.hidden = true;
    });
  });
  // Handle image upload
  imageUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Display image preview
    const imageUrl = URL.createObjectURL(file);
    imagePreview.src = imageUrl;
    imagePreviewContainer.hidden = false;

    // Store image URL for prediction display
    currentImageUrl = imageUrl;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const serverUrl = 'http://localhost:8000';
      const response = await fetch(`${serverUrl}/predict`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      displayPrediction(data);
    } catch (error) {
      console.error('Error predicting image:', error);
      alert('Failed to get prediction. Check console for details.');
    }
  });

  // Start webcam stream
  startStreamBtn.addEventListener('click', startVideoStream);

  // Stop webcam stream
  stopStreamBtn.addEventListener('click', stopVideoStream);

  // Start webcam
  async function startWebcam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });

      video.srcObject = stream;
      await video.play();
      return true;
    } catch (error) {
      console.error('Error accessing webcam:', error);
      alert('Failed to access webcam. Check console for details.');
      return false;
    }
  }

  // Start WebSocket connection and video streaming
  async function startVideoStream() {
    const webcamStarted = await startWebcam();
    if (!webcamStarted) return;

    try {
      const serverUrl = 'http://localhost:8000';
      ws = new WebSocket(
        `ws://${serverUrl.replace(/^https?:\/\//, '')}/ws/video`
      );

      ws.onopen = () => {
        isStreaming = true;
        startStreamBtn.hidden = true;
        stopStreamBtn.hidden = false;
        sendVideoFrames();
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // For webcam mode, capture the current frame for display
        captureCurrentFrame();

        displayPrediction(data);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        stopVideoStream();
        alert('WebSocket connection error. Check console for details.');
      };

      ws.onclose = () => {
        isStreaming = false;
        startStreamBtn.hidden = false;
        stopStreamBtn.hidden = true;
      };
    } catch (error) {
      console.error('Error setting up WebSocket:', error);
      alert('Failed to set up WebSocket. Check console for details.');
    }
  }

  // Capture current video frame for display
  function captureCurrentFrame() {
    if (!video.srcObject) return;

    // Create a temporary canvas to capture the frame
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;

    const ctx = tempCanvas.getContext('2d');
    ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);

    // Convert to data URL and display
    currentImageUrl = tempCanvas.toDataURL('image/jpeg');
    currentImage.src = currentImageUrl;
    currentImageContainer.hidden = false;
  }

  // Send video frames to server
  function sendVideoFrames() {
    if (!isStreaming || !ws || ws.readyState !== WebSocket.OPEN) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob and send via WebSocket
    canvas.toBlob(
      (blob) => {
        if (blob && ws && ws.readyState === WebSocket.OPEN) {
          ws.send(blob);

          // Schedule next frame
          requestAnimationFrame(sendVideoFrames);
        }
      },
      'image/jpeg',
      0.8
    );
  }

  // Stop video streaming
  function stopVideoStream() {
    if (ws) {
      ws.close();
      ws = null;
    }

    if (video.srcObject) {
      const tracks = video.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      video.srcObject = null;
    }

    isStreaming = false;
    startStreamBtn.hidden = false;
    stopStreamBtn.hidden = true;
  }

  // Extract prediction and confidence from response
  function extractPredictionData(data) {
    // Default values
    let prediction = '';
    let confidence = null;

    // Handle different response formats
    if (typeof data === 'string') {
      // If data is just a string (animal name)
      prediction = data;
    } else if (typeof data === 'object') {
      // If data is an object
      if ('prediction' in data) {
        prediction = data.prediction;

        // Check for confidence value
        if ('confidence' in data) {
          // Convert string confidence to number if needed
          confidence =
            typeof data.confidence === 'string'
              ? parseFloat(data.confidence)
              : data.confidence;
        }
      }
    }

    return { prediction, confidence };
  }

  // Display prediction
  function displayPrediction(data) {
    predictionContainer.hidden = false;

    // Display the current image alongside prediction
    if (currentImageUrl) {
      currentImage.src = currentImageUrl;
      currentImageContainer.hidden = false;
    }

    // Extract prediction and confidence
    const { prediction, confidence } = extractPredictionData(data);

    // Validate prediction is one of our animal classes
    const animalClass = animalClasses.includes(prediction.toLowerCase())
      ? prediction.toLowerCase()
      : 'unknown';

    // Set container class based on prediction
    predictionContainer.className = 'prediction-container';
    if (animalClass !== 'unknown') {
      predictionContainer.classList.add(`${animalClass}-prediction`);
    }

    // Set title with capitalized animal name
    const capitalizedAnimal =
      animalClass.charAt(0).toUpperCase() + animalClass.slice(1);
    predictionTitle.textContent = `${capitalizedAnimal} Detected!`;

    // Create confidence HTML
    let confidenceHTML = '';
    if (confidence !== null) {
      const confidencePercent = (confidence * 100).toFixed(2);
      confidenceHTML = `
        <div class="confidence-container ${animalClass}-confidence">
          <div class="confidence-label">
            <span>Confidence</span>
            <span class="confidence-value">${confidencePercent}%</span>
          </div>
          <div class="confidence-bar">
            <div class="confidence-fill" style="width: ${confidencePercent}%"></div>
          </div>
          <p class="confidence-text">The model is ${confidencePercent}% confident this is a ${animalClass}</p>
        </div>
      `;
    } else {
      // If no confidence data is available
      confidenceHTML = `
        <div class="confidence-container">
          <p class="confidence-text">Confidence data not available</p>
        </div>
      `;
    }

    // Set content with animal icon
    predictionBox.innerHTML = `
      <div class="animal-result-box ${animalClass}-box">
        <div class="animal-icon-container">
          <div class="animal-icon-large">
            ${getAnimalIcon(animalClass)}
          </div>
        </div>
        <p class="animal-text ${animalClass}-text">Class: ${capitalizedAnimal}</p>
        ${confidenceHTML}
      </div>
    `;
  }
});

// Helper function to get animal icon SVG
function getAnimalIcon(animal) {
  switch (animal.toLowerCase()) {
    case 'butterfly':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="#ffca28" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L8 7l4 5-4 5 4 5 4-5-4-5 4-5z"/>
          <path d="M4 18c0-3.5 3-6 8-6s8 2.5 8 6"/>
          <path d="M4 6c0 3.5 3 6 8 6s8-2.5 8-6"/>
        </svg>
      `;
    case 'cat':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="#ab47bc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a9 3 0 0 0-9 3v18l3-3 3 3 3-3 3 3 3-3 3 3V5a9 3 0 0 0-9-3z"/>
          <path d="M8 10v4"/>
          <path d="M16 10v4"/>
          <path d="M9 16c.85.63 1.885 1 3 1s2.15-.37 3-1"/>
        </svg>
      `;
    case 'chicken':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="#ff9800" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22a8 8 0 0 0 8-8c0-4.5-3-7-6-8.5S6.5 3.5 6.5 6.5c0 1.5 2 2.5 2 2.5-1.5 1.5-2 4-2 7 0 4.5 2.5 6 5.5 6z"/>
          <path d="M9 10l.01-.01"/>
          <path d="M15 10l.01-.01"/>
          <path d="M12 15h.01"/>
        </svg>
      `;
    case 'cow':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="#3f51b5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22c5.5 0 10-4.5 10-10V5l-5-3-5 3-5-3-5 3v7c0 5.5 4.5 10 10 10z"/>
          <path d="M8 10h.01"/>
          <path d="M16 10h.01"/>
          <path d="M8 14h8"/>
        </svg>
      `;
    case 'dog':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="#03a9f4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 10l3-3 5 5 5-5 3 3-5 5 5 5-3 3-5-5-5 5-3-3 5-5z"/>
          <path d="M12 8v4"/>
          <path d="M8 16h8"/>
        </svg>
      `;
    case 'elephant':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="#009688" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 8v8a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-5h-2v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a4 4 0 0 1 8 0v2h2V8a4 4 0 0 1 4-4v4z"/>
          <path d="M19 8h2v8h-2"/>
          <path d="M5 8H3v8h2"/>
        </svg>
      `;
    case 'horse':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="#ff5722" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 3v2c0 1.1-.9 2-2 2H9c-1.1 0-2-.9-2-2V3"/>
          <path d="M18 8H6a2 2 0 0 0-2 2v10h16V10a2 2 0 0 0-2-2z"/>
          <path d="M6 15h12"/>
          <path d="M6 12h12"/>
        </svg>
      `;
    case 'sheep':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="#8bc34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10z"/>
          <path d="M12 8v4"/>
          <path d="M8 14c1 2 3 3 4 3s3-1 4-3"/>
        </svg>
      `;
    case 'spider':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="#795548" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="4"/>
          <path d="M4 4l3 3"/>
          <path d="M4 20l3-3"/>
          <path d="M20 4l-3 3"/>
          <path d="M20 20l-3-3"/>
          <path d="M12 4v4"/>
          <path d="M12 16v4"/>
          <path d="M4 12h4"/>
          <path d="M16 12h4"/>
        </svg>
      `;
    case 'squirrel':
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="#e57373" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6c0-2.2-1.8-4-4-4s-4 1.8-4 4c0 1.5.8 2.8 2 3.4V12c0 1.1.9 2 2 2s2-.9 2-2V9.4c1.2-.6 2-1.9 2-3.4z"/>
          <path d="M12 12v4c0 1.1-.9 2-2 2H7.5c-1.4 0-2.5 1.1-2.5 2.5S6.1 23 7.5 23H10"/>
          <path d="M16 19h6"/>
          <path d="M19 16v6"/>
        </svg>
      `;
    default:
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="#9e9e9e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v4"/>
          <path d="M12 16h.01"/>
        </svg>
      `;
  }
}
