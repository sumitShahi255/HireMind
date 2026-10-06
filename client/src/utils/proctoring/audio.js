import { AudioClassifier, FilesetResolver } from "@mediapipe/tasks-audio";
import { AUDIO_CONFIG, DEBUG_PROCTORING } from './config';
import audioProcessorUrl from './audioProcessor.js?url';

export class AudioProctor {
  constructor(mode = 'coding') {
    this.mode = mode;
    this.classifier = null;
    this.audioContext = null;
    this.audioSource = null;
    this.workletNode = null;
    this.isRunning = false;
    this.lastTimestamp = -1;

    this.state = {
      speechDetected: false,
      backgroundAudioDetected: false,
      detectedCategories: [],
    };
    
    // Callbacks
    this.onAudioEvent = null;
  }

  async init() {
    if (this.classifier) return true;

    try {
      const audioFileset = await FilesetResolver.forAudioTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@1.0.1/wasm"
      );

      this.classifier = await AudioClassifier.createFromOptions(audioFileset, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite",
          delegate: "CPU"
        }
      });
      
      if (DEBUG_PROCTORING) {
        console.log("AudioClassifier (YAMNet) initialized successfully.");
      }
      return true;
    } catch (err) {
      console.error("Failed to init AudioClassifier:", err);
      return false;
    }
  }

  async start(stream) {
    const initialized = await this.init();
    if (!initialized) return;
    
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTimestamp = -1;

    try {
      // YAMNet typically expects 16kHz audio
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // Load the AudioWorklet processor
      await this.audioContext.audioWorklet.addModule(audioProcessorUrl);
      
      // If the stream has an audio track, use it.
      if (stream.getAudioTracks().length === 0) {
        console.warn("No audio track in stream");
        return;
      }

      this.audioSource = this.audioContext.createMediaStreamSource(stream);

      // Microphone aawaz ko YAMNet ke liye amplify karne ke liye ek GainNode lagate hain
      const boostNode = this.audioContext.createGain();
      boostNode.gain.value = 3.0; // Volume 3 guna badha dega

      // Use an AudioWorkletNode instead of the deprecated ScriptProcessorNode
      this.workletNode = new AudioWorkletNode(this.audioContext, 'proctoring-audio-processor');
      
      this.audioSource.connect(boostNode);
      boostNode.connect(this.workletNode);
      
      // Connect to a silent gain node to ensure it runs without echoing
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 0;
      this.workletNode.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      this.workletNode.port.onmessage = (event) => {
        if (!this.isRunning || !this.classifier) return;

        const inputData = event.data;

        const timestampMs = performance.now();

        if (timestampMs <= this.lastTimestamp) {
          return;
        }

        this.lastTimestamp = timestampMs;

        try {
          const results = this.classifier.classify(inputData);

          if (!results) return;

          let categories = [];

          if (
            results.classifications &&
            results.classifications.length > 0
          ) {
            categories = results.classifications[0].categories;
          } else if (
            Array.isArray(results) &&
            results.length > 0 &&
            results[0].classifications
          ) {
            categories =
              results[0].classifications[0].categories;
          }

          if (!categories || categories.length === 0) {
            return;
          }

          // --------------------------------------------
          // Normalize all categories
          // --------------------------------------------
          const normalizedCategories = categories.map((category) => ({
            name: (category.categoryName || "")
              .trim()
              .toLowerCase(),

            score: Number(category.score || 0)
          }));

          let speechDetected = false;
          let backgroundAudioDetected = false;

          const detectedCategories = [];

          // --------------------------------------------
          // Check ALL categories, not only top 3
          // --------------------------------------------
          for (const category of normalizedCategories) {
            const { name, score } = category;

            if (score < 0.05) {
              continue;
            }

            const isSpeech =
              AUDIO_CONFIG.yamnetSpeechCategories.includes(name);

            const isBackground =
              AUDIO_CONFIG.yamnetMediaCategories.includes(name) &&
              !AUDIO_CONFIG.yamnetIgnoreCategories.includes(name);

            if (
              isSpeech &&
              score >= AUDIO_CONFIG.speechConfidenceThreshold
            ) {
              speechDetected = true;

              detectedCategories.push(
                `${name}:${score.toFixed(2)}`
              );
            }

            if (
              isBackground &&
              score >= AUDIO_CONFIG.backgroundMediaThreshold
            ) {
              backgroundAudioDetected = true;

              detectedCategories.push(
                `${name}:${score.toFixed(2)}`
              );
            }
          }

          // --------------------------------------------
          // State
          // --------------------------------------------
          this.state = {
            speechDetected,
            backgroundAudioDetected,
            detectedCategories,
            rawCategories: categories
          };

          // --------------------------------------------
          // Debug
          // --------------------------------------------
          if (DEBUG_PROCTORING) {
            console.log("AUDIO PROCTOR:", {
              speechDetected,
              backgroundAudioDetected,
              detectedCategories,
              rawCategories: categories.map((c) => ({
                category: c.categoryName,
                score: Number(c.score).toFixed(3)
              }))
            });
          }

          // --------------------------------------------
          // Callback
          // --------------------------------------------
          if (this.onAudioEvent) {
            this.onAudioEvent(this.state);
          }

        } catch (err) {
          console.error(
            "Classification error:",
            err
          );
        }
      };
    } catch (err) {
      console.error("Failed to start audio proctoring:", err);
    }
  }

  stop() {
    this.isRunning = false;
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.audioSource) {
      this.audioSource.disconnect();
      this.audioSource = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
