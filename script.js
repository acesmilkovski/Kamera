const video = document.getElementById('webcam');
const liveView = document.getElementById('liveView');
const demosSection = document.getElementById('demos');
const enableWebcamButton = document.getElementById('webcamButton');
const switchCameraButton = document.getElementById('switchCameraButton');

// Store the resulting model in the global scope of our app.
let model = undefined;
let stream = null;
let currentFacingMode = 'user'; // 'user' for front camera, 'environment' for back camera
let children = [];

// Check if webcam access is supported.
function getUserMediaSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// Get available video devices
async function getVideoDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'videoinput');
  } catch (error) {
    console.error('Error enumerating devices:', error);
    return [];
  }
}

// Check if device has multiple cameras
async function hasMultipleCameras() {
  const videoDevices = await getVideoDevices();
  return videoDevices.length > 1;
}

// Enable the live webcam view and start classification.
async function enableCam(event) {
  // Only continue if the COCO-SSD has finished loading.
  if (!model) {
    return;
  }
  
  // Hide the button once clicked.
  event.target.classList.add('removed');  
  
  // Enable switch camera button if multiple cameras are available
  if (await hasMultipleCameras()) {
    switchCameraButton.disabled = false;
  }
  
  // Start with front camera
  await startCamera('user');
}

// Start camera with specified facing mode
async function startCamera(facingMode) {
  // Stop any existing stream
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
  
  // getUsermedia parameters
  const constraints = {
    video: { 
      facingMode: facingMode,
      width: { ideal: 640 },
      height: { ideal: 480 }
    }
  };
  
  try {
    // Activate the webcam stream
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    currentFacingMode = facingMode;
    
    // Start prediction when video is ready
    video.addEventListener('loadeddata', predictWebcam);
  } catch (error) {
    console.error('Error accessing camera:', error);
    alert('Error accessing camera: ' + error.message);
  }
}

// Switch between front and back camera
async function switchCamera() {
  if (!stream) return;
  
  const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
  await startCamera(newFacingMode);
}

// Before we can use COCO-SSD class we must wait for it to finish loading
cocoSsd.load().then(function (loadedModel) {
  model = loadedModel;
  // Show demo section now model is ready to use.
  demosSection.classList.remove('invisible');
});

function predictWebcam() {
  // Now let's start classifying a frame in the stream.
  model.detect(video).then(function (predictions) {
    // Remove any highlighting we did previous frame.
    for (let i = 0; i < children.length; i++) {
      liveView.removeChild(children[i]);
    }
    children.splice(0);
    
    // Now lets loop through predictions and draw them to the live view if
    // they have a high confidence score.
    for (let n = 0; n < predictions.length; n++) {
      // If we are over 66% sure we are sure we classified it right, draw it!
      if (predictions[n].score > 0.66) {
        const p = document.createElement('p');
        p.innerText = predictions[n].class  + ' - with ' 
            + Math.round(parseFloat(predictions[n].score) * 100) 
            + '% confidence.';
        
        // Calculate responsive positioning
        const videoRect = video.getBoundingClientRect();
        const scaleX = videoRect.width / video.videoWidth;
        const scaleY = videoRect.height / video.videoHeight;
        
        p.style = 'margin-left: ' + (predictions[n].bbox[0] * scaleX) + 'px; margin-top: '
            + ((predictions[n].bbox[1] * scaleY) - 10) + 'px; width: ' 
            + ((predictions[n].bbox[2] * scaleX) - 10) + 'px; top: 0; left: 0;';

        const highlighter = document.createElement('div');
        highlighter.setAttribute('class', 'highlighter');
        highlighter.style = 'left: ' + (predictions[n].bbox[0] * scaleX) + 'px; top: '
            + (predictions[n].bbox[1] * scaleY) + 'px; width: ' 
            + (predictions[n].bbox[2] * scaleX) + 'px; height: '
            + (predictions[n].bbox[3] * scaleY) + 'px;';

        liveView.appendChild(highlighter);
        liveView.appendChild(p);
        children.push(highlighter);
        children.push(p);
      }
    }
    
    // Call this function again to keep predicting when the browser is ready.
    window.requestAnimationFrame(predictWebcam);
  });
}

// If webcam supported, add event listener to button for when user
// wants to activate it to call enableCam function which we will 
// define in the next step.
if (getUserMediaSupported()) {
  enableWebcamButton.addEventListener('click', enableCam);
  switchCameraButton.addEventListener('click', switchCamera);
} else {
  console.warn('getUserMedia() is not supported by your browser');
  enableWebcamButton.disabled = true;
  enableWebcamButton.textContent = 'Webcam not supported';
}