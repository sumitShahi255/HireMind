import { FaceDetector, FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { DEBUG_PROCTORING } from './config';

let faceDetector = null;
let faceLandmarker = null;
let lastLandmarkData = { result: null, timestamp: 0 };

export async function initMediaPipe() {
  if (faceDetector && faceLandmarker) return { faceDetector, faceLandmarker };

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
  );

  faceDetector = await FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite`,
      delegate: "CPU"
    },
    runningMode: "VIDEO",
    minDetectionConfidence: 0.50,
    minSuppressionThreshold: 0.3
  });

  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      delegate: "CPU"
    },
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: true,
    runningMode: "VIDEO",
    numFaces: 1
  });

  return { faceDetector, faceLandmarker };
}

export function detectFaces(videoElement, timestamp) {
  if (!faceDetector) return { detections: [] };

  const result = faceDetector.detectForVideo(videoElement, timestamp);

  const frameW = videoElement.videoWidth || videoElement.width;
  const frameH = videoElement.videoHeight || videoElement.height;

  if (!frameW || !frameH) {
    return { detections: [] };
  }

  let primaryFaceCount = 0;
  let additionalFaceCount = 0;
  let promotableCount = 0;

  const detections = (result?.detections ?? []).map((d) => {
    const box = d.boundingBox;
    if (!box) return { ...d, primaryValid: false, additionalValid: false };

    const confidence = d.categories?.[0]?.score ?? 0;

    const x = box.originX;
    const y = box.originY;
    const w = box.width;
    const h = box.height;

    const right = x + w;
    const bottom = y + h;

    const centerX = x + w / 2;
    const centerY = y + h / 2;

    const areaRatio = (w * h) / (frameW * frameH);

    // Primary face strict validation
    const primaryLargeEnough = areaRatio >= 0.03;
    const fullyInsideFrame =
      x >= frameW * 0.10 &&
      y >= frameH * 0.10 &&
      right <= frameW * 0.90 &&
      bottom <= frameH * 0.90;
    const centerInside =
      centerX >= frameW * 0.15 &&
      centerX <= frameW * 0.85 &&
      centerY >= frameH * 0.15 &&
      centerY <= frameH * 0.85;
    const primaryConfident = confidence >= 0.60;

    const detectorValid = primaryConfident && primaryLargeEnough && fullyInsideFrame && centerInside;

    let landmarkValid = true;
    let landmarkCoverage = 1.0;

    const now = performance.now();
    // Only validate if we have a fresh landmark result (within 1000ms)
    if (lastLandmarkData.result && (now - lastLandmarkData.timestamp < 1000)) {
      const lmResult = lastLandmarkData.result;
      if (lmResult.faceLandmarks && lmResult.faceLandmarks.length > 0) {
        const faceLandmarks = lmResult.faceLandmarks[0];
        let insideCount = 0;
        for (const lm of faceLandmarks) {
          if (lm.x >= 0.01 && lm.x <= 0.99 && lm.y >= 0.01 && lm.y <= 0.99) {
            insideCount++;
          }
        }
        landmarkCoverage = insideCount / faceLandmarks.length;
        landmarkValid = landmarkCoverage >= 0.80;
      } else {
        landmarkValid = false;
        landmarkCoverage = 0;
      }
    } else {
      // Fallback if stale or missing to avoid flapping
      landmarkValid = true;
      landmarkCoverage = -1;
    }

    if (DEBUG_PROCTORING) {
      console.log("FACE VALIDATION", {
        detectorValid,
        landmarkValid,
        landmarkCoverage
      });
    }

    const primaryValid = detectorValid && landmarkValid;

    // Additional face relaxed validation
    const additionalLargeEnough = areaRatio >= 0.008;
    const positiveSize = w > 0 && h > 0;
    // Increase confidence to 0.60 to avoid background false positives, and require landmarker confirmation
    const additionalConfident = confidence >= 0.60;

    const additionalValid = additionalConfident && additionalLargeEnough && positiveSize && landmarkValid;
    
    // A face must be fully visible (not cut off by edges) to be promoted to primary.
    // Increased left/right margin to 10% to catch faces cut off from the sides.
    const promotable = additionalValid && 
      y >= frameH * 0.05 && 
      bottom <= frameH * 0.95 && 
      x >= frameW * 0.10 && 
      right <= frameW * 0.90;
      
    if (promotable) {
      promotableCount++;
    }
    
    // Count valid faces but a face cannot be counted as additional if it's already primary
    if (primaryValid) {
      primaryFaceCount++;
    } else if (additionalValid) {
      additionalFaceCount++;
    }

    return { ...d, primaryValid, additionalValid };
  });

  const totalValidFaces = primaryFaceCount + additionalFaceCount;
  const multiplePeopleCandidate = totalValidFaces >= 2;
  
  // If faces are detected but none meet the strict 'primary' criteria (e.g. off-center),
  // we still want to register a face so we don't trigger 'Face not detected',
  // BUT only if at least one face is fully inside the frame (promotable).
  if (primaryFaceCount === 0 && promotableCount > 0) {
    primaryFaceCount = 1;
  }

  if (DEBUG_PROCTORING) {
    console.log("Face detection:", {
      rawFaceCount: result?.detections?.length ?? 0,
      primaryFaceCount,
      additionalFaceCount,
      multiplePeopleCandidate,
      frameWidth: frameW,
      frameHeight: frameH,
    });

    if (detections.length > 0) {
      console.table(
        detections.map((d, i) => ({
          index: i,
          confidence: d.categories?.[0]?.score,
          x: d.boundingBox?.originX,
          y: d.boundingBox?.originY,
          width: d.boundingBox?.width,
          height: d.boundingBox?.height,
          areaRatio: (d.boundingBox?.width * d.boundingBox?.height) / (frameW * frameH),
          primaryValid: d.primaryValid,
          additionalValid: d.additionalValid
        }))
      );
    }
  }

  return {
    ...result,
    detections: detections.filter(d => d.primaryValid || d.additionalValid),
    primaryFaceCount,
    additionalFaceCount,
    multiplePeopleCandidate
  };
}

export function detectFaceLandmarks(videoElement, timestamp) {
  if (!faceLandmarker) return null;
  const result = faceLandmarker.detectForVideo(videoElement, timestamp);
  lastLandmarkData = { result, timestamp: performance.now() };
  return result;
}
