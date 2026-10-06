export const DEBUG_PROCTORING = true;

export const PROCTORING_CONFIG = {
  faceCheckInterval: 350,
  poseCheckInterval: 700,
  phoneCheckInterval: 350,

  horizontalLookAwayDeg: 30,
  verticalLookAwayDeg: 20,

  violationCooldownMs: 3000,
  phoneConfidence: 0.45,
  phoneRequiredFrames: 2,
};

export const AUDIO_CONFIG = {
  checkIntervalMs: 250,

  // Slightly conservative thresholds
  speechConfidenceThreshold: 0.10,
  backgroundMediaThreshold: 0.10,

  yamnetSpeechCategories: [
    "speech",
    "talking",
    "conversation",
    "narration",
    "monologue",
    "dialogue",
    "speech synthesizer"
  ],

  yamnetMediaCategories: [
    // Media
    "music",
    "video game",
    "ringtone",
    "singing",
    "choir",
    "rapping",

    // Animals
    "animal",
    "dog",
    "cat",
    "bird",
    "horse",
    "cow",

    // Alerts / other audio
    "telephone",
    "alarm",
    "bell",
    "siren",

    // Multiple people / crowd
    "crowd",
    "children playing"
  ],

  yamnetIgnoreCategories: [
    "typing",
    "keyboard",
    "mouse",
    "fan",
    "air conditioning",
    "breathing",
    "sigh",
    "throat clearing",
    "cough",
    "sneeze",
    "silence",
    "room acoustics",
    "background noise",
    "engine",
    "wind",
    "rustling leaves"
  ],

  mock: {
    minSpeechDurationMs: 500,

    // AI बोलते समय speech को तुरंत interruption मानना है.
    requiredSpeechFrames: 1,

    // Candidate की turn में background को 1 consecutive
    // detections मिलने पर warning.
    requiredBackgroundFrames: 1,

    candidateSpeechEnabled: true,

    violationCooldownMs: 8000
  },

  coding: {
    minSpeechDurationMs: 900,
    requiredSpeechFrames: 1,
    requiredBackgroundFrames: 1,
    violationCooldownMs: 8000
  }
};
