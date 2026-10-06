import * as ort from 'onnxruntime-web/wasm';
import { PROCTORING_CONFIG, DEBUG_PROCTORING } from './config';

ort.env.wasm.wasmPaths = self.location.origin + "/ort/";
ort.env.wasm.proxy = false;
console.log("YOLO WASM PATH SET TO:", ort.env.wasm.wasmPaths);

let session = null;
const CELL_PHONE_CLASS = 67;

export async function initYOLO() {
  console.log("initYOLO started - Loading YOLO WASM locally");
  if (session) {
    console.log("YOLO session already initialized.");
    return;
  }
  try {
    session = await ort.InferenceSession.create('/models/yolo11n.onnx', {
      executionProviders: ['webgl', 'wasm']
    });
    console.log("initYOLO success: YOLO model loaded!");
  } catch (error) {
    console.error("YOLO INITIALIZATION FAILED:", error);
    throw error;
  }
}

function preprocess(video) {
  const targetSize = 640;
  
  // Create offscreen canvas
  const canvas = new OffscreenCanvas(targetSize, targetSize);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  
  const vWidth = video.videoWidth || video.width;
  const vHeight = video.videoHeight || video.height;

  // Letterbox padding to preserve aspect ratio
  const scale = Math.min(targetSize / vWidth, targetSize / vHeight);
  const scaledWidth = vWidth * scale;
  const scaledHeight = vHeight * scale;
  
  const padX = (targetSize - scaledWidth) / 2;
  const padY = (targetSize - scaledHeight) / 2;
  
  // Draw background (padding)
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, targetSize, targetSize);
  
  // Draw video centered
  ctx.drawImage(video, padX, padY, scaledWidth, scaledHeight);
  
  const imgData = ctx.getImageData(0, 0, targetSize, targetSize);
  const data = imgData.data;
  
  // RGB -> NCHW [1, 3, 640, 640]
  const input = new Float32Array(1 * 3 * targetSize * targetSize);
  for (let i = 0; i < targetSize * targetSize; i++) {
    input[i] = data[i * 4] / 255.0; // R
    input[i + targetSize * targetSize] = data[i * 4 + 1] / 255.0; // G
    input[i + 2 * targetSize * targetSize] = data[i * 4 + 2] / 255.0; // B
  }
  
  return new ort.Tensor("float32", input, [1, 3, targetSize, targetSize]);
}

export async function detectObjects(video) {
  if (!session) return null;
  
  const result = {
    phone: { detected: false, confidence: 0, box: null },
    laptop: { detected: false, confidence: 0, box: null }
  };
  
  try {
    const startTime = performance.now();
    const inputTensor = preprocess(video);
    const feeds = { [session.inputNames[0]]: inputTensor };
    
    const output = await session.run(feeds);
    const outputTensor = output[session.outputNames[0]];
    const data = outputTensor.data;
    const dims = outputTensor.dims; // Expected: [1, 84, 8400]
    
    if (dims.length !== 3 || dims[1] !== 84 || dims[2] !== 8400) {
      console.warn("Unexpected YOLO output shape:", dims);
      return result;
    }
    
    const numAnchors = dims[2];
    const phoneChannel = 4 + CELL_PHONE_CLASS;
    
    let maxPhoneScore = -Infinity;
    let bestAnchor = -1;
    
    // Find max score for cell phone
    for (let i = 0; i < numAnchors; i++) {
      const score = data[phoneChannel * numAnchors + i];
      if (score > maxPhoneScore) {
        maxPhoneScore = score;
        bestAnchor = i;
      }
    }
    
    if (bestAnchor !== -1) {
       const x = data[0 * numAnchors + bestAnchor];
       const y = data[1 * numAnchors + bestAnchor];
       const w = data[2 * numAnchors + bestAnchor];
       const h = data[3 * numAnchors + bestAnchor];
       
       if (DEBUG_PROCTORING) {
         const infTime = performance.now() - startTime;
         console.log(`YOLO PHONE (${infTime.toFixed(1)}ms):\nconfidence: ${maxPhoneScore.toFixed(4)}\nx: ${x.toFixed(2)}\ny: ${y.toFixed(2)}\nw: ${w.toFixed(2)}\nh: ${h.toFixed(2)}`);
       }
       
       result.phone.confidence = maxPhoneScore;
       result.phone.box = { x, y, w, h };
       
       if (maxPhoneScore >= PROCTORING_CONFIG.phoneConfidence) {
         result.phone.detected = true;
       }
    } else if (DEBUG_PROCTORING) {
       console.log(`YOLO inference took ${ (performance.now() - startTime).toFixed(1) }ms`);
    }
    
    return result;
  } catch (error) {
    console.error("Error running YOLO inference:", error);
    return null;
  }
}
