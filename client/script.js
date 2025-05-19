document.addEventListener("DOMContentLoaded", () => {
	// DOM Elements
	const url = "https://animals-classifier-api.cleverapps.io";
	// const url = "http://localhost:8000";

	// Image upload elements
	const imageUpload = document.getElementById("image-upload");
	const imagePreviewContainer = document.getElementById(
		"image-preview-container"
	);
	const imagePreview = document.getElementById("image-preview");
	const currentImageContainer = document.getElementById(
		"current-image-container"
	);
	const currentImage = document.getElementById("current-image");

	// Prediction elements
	const predictionContainer = document.getElementById("prediction-container");
	const predictionTitle = document.getElementById("prediction-title");
	const predictionBox = document.getElementById("prediction-box");

	// Animal classes
	const animalClasses = [
		"butterfly",
		"cat",
		"chicken",
		"cow",
		"dog",
		"elephant",
		"horse",
		"sheep",
		"spider",
		"squirrel",
	];

	// State
	let currentImageUrl = null;

	// Handle image upload and preview
	imageUpload.addEventListener("change", async (e) => {
		const file = e.target.files[0];
		if (!file) return;

		// Display image preview
		const imageUrl = URL.createObjectURL(file);
		imagePreview.src = imageUrl;
		imagePreviewContainer.hidden = false;

		// Store image URL for prediction display
		currentImageUrl = imageUrl;

		const formData = new FormData();
		formData.append("file", file);

		try {
			const serverUrl = url;
			const response = await fetch(`${serverUrl}/predict`, {
				method: "POST",
				body: formData,
			});

			const data = await response.json();
			displayPrediction(data);
		} catch (error) {
			console.error("Error predicting image:", error);
			alert("Failed to get prediction. Check console for details.");
		}
	});

	// Extract prediction and confidence from response
	function extractPredictionData(data) {
		// Default values
		let prediction = "";
		let confidence = null;

		// Handle different response formats
		if (typeof data === "string") {
			// If data is just a string (animal name)
			prediction = data;
		} else if (typeof data === "object") {
			// If data is an object
			if ("prediction" in data) {
				prediction = data.prediction;

				// Check for confidence value
				if ("confidence" in data) {
					// Convert string confidence to number if needed
					confidence =
						typeof data.confidence === "string"
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
			: "unknown";

		// Set container class based on prediction
		predictionContainer.className = "prediction-container";
		if (animalClass !== "unknown") {
			predictionContainer.classList.add(`${animalClass}-prediction`);
		}

		// Set title with capitalized animal name
		const capitalizedAnimal =
			animalClass.charAt(0).toUpperCase() + animalClass.slice(1);
		predictionTitle.textContent = `${capitalizedAnimal} Detected!`;

		// Create confidence HTML
		let confidenceHTML = "";
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
            <img src="images/${animalClass}.png" alt="${capitalizedAnimal} Icon" class="animal-icon-large">
          </div>
        </div>
        <p class="animal-text ${animalClass}-text">Class: ${capitalizedAnimal}</p>
        ${confidenceHTML}
      </div>
    `;
	}
});
