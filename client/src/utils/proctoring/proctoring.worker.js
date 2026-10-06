import { initYOLO, detectObjects } from './yolo';

let yoloLoaded = false;
let yoloRunning = false;

self.onmessage = async (e) => {
  const { type, bitmap } = e.data;

  if (type === 'INIT') {
    try {
      console.log("[PROCTOR] YOLO Worker initializing...");
      await initYOLO();
      yoloLoaded = true;
      self.postMessage({ type: 'INIT_SUCCESS' });
      console.log("[PROCTOR] YOLO Worker initialized");
    } catch (err) {
      self.postMessage({ type: 'INIT_ERROR', error: err.message, stack: err.stack });
    }
    return;
  }

  if (type === 'PROCESS') {
    if (!yoloLoaded || yoloRunning) {
      if (bitmap) bitmap.close();
      return;
    }

    yoloRunning = true;

    try {
      const yoloResult = await detectObjects(bitmap);
      
      const result = {
        type: "YOLO_RESULT",
        phoneDetected: false,
        confidence: 0
      };

      if (yoloResult) {
        result.phoneDetected = yoloResult.phone.detected;
        result.confidence = yoloResult.phone.confidence;
      }

      self.postMessage(result);
    } catch (err) {
      self.postMessage({ type: 'PROCESS_ERROR', error: err.message });
    } finally {
      if (bitmap) bitmap.close();
      yoloRunning = false;
    }
  }
};
