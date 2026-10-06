class ProctoringAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // YAMNet MUST have exactly 15600 samples (975ms @ 16kHz).
    // To send updates every 500ms (8000 samples), we use a sliding window.
    this.windowSize = 15600;
    this.stepSize = 8000;
    
    this.buffer = new Float32Array(this.windowSize);
    this.bufferIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];

    if (!input || !input[0]) {
      return true;
    }

    const channelData = input[0];

    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.bufferIndex++] = channelData[i];

      if (this.bufferIndex >= this.windowSize) {
        // --- Robust Auto-Normalization (RMS AGC) for YAMNet ---
        // Calculate Root Mean Square (RMS) to find the true loudness, ignoring single-sample spikes
        let sumSquares = 0;
        for (let j = 0; j < this.windowSize; j++) {
          sumSquares += this.buffer[j] * this.buffer[j];
        }
        let rms = Math.sqrt(sumSquares / this.windowSize);

        // If there is actual sound (above static noise floor), boost it to a target RMS
        let multiplier = 1.0;
        const TARGET_RMS = 0.15; // Ideal loudness for ML models
        
        if (rms > 0.001) {
          // Cap the maximum boost to 30x to avoid blowing up dead silence
          multiplier = Math.min(TARGET_RMS / rms, 30.0);
        }

        // Create a normalized copy of the buffer
        const normalizedBuffer = new Float32Array(this.windowSize);
        for (let j = 0; j < this.windowSize; j++) {
          // Clamp between -1.0 and 1.0 just in case
          let val = this.buffer[j] * multiplier;
          if (val > 1.0) val = 1.0;
          if (val < -1.0) val = -1.0;
          normalizedBuffer[j] = val;
        }

        // Send the normalized buffer to YAMNet
        this.port.postMessage(normalizedBuffer);
        
        // Shift buffer left by stepSize to create overlapping 500ms windows
        const overlap = this.windowSize - this.stepSize;
        
        // Use standard array methods for Float32Array
        this.buffer.set(this.buffer.subarray(this.stepSize, this.windowSize), 0);
        this.bufferIndex = overlap;
      }
    }

    return true;
  }
}

registerProcessor('proctoring-audio-processor', ProctoringAudioProcessor);
