import { PROCTORING_CONFIG, AUDIO_CONFIG } from './config';

class ViolationTracker {
  constructor() {
    this.lastViolationTimes = {
      faceOut: 0,
      lookingAway: 0,
      audio: 0,
    };
    this.state = {
      multiplePeople: false,
      phone: false,
      audio: false,
    };
    this.counters = {
      multiplePeople: 0,
      phone: 0,
      audioSpeech: 0,
      audioBackground: 0,
    };
    this.wasInterviewerSpeaking = false;
  }

  trackAudio(mode, audioData, isInterviewerSpeaking = false) {
    const {
      speechDetected,
      backgroundAudioDetected
    } = audioData;

    const config = AUDIO_CONFIG[mode];

    if (!config) {
      return {
        warning: false,
        candidateSpeaking: false
      };
    }

    // --------------------------------------------------
    // AI/interviewer JUST started speaking
    // Reset previous candidate/background state.
    // --------------------------------------------------
    if (
      isInterviewerSpeaking &&
      !this.wasInterviewerSpeaking
    ) {
      this.counters.audioSpeech = 0;
      this.counters.audioBackground = 0;
    }

    this.wasInterviewerSpeaking =
      isInterviewerSpeaking;

    // --------------------------------------------------
    // Speech counter
    // --------------------------------------------------
    if (speechDetected) {
      this.counters.audioSpeech++;
    } else {
      this.counters.audioSpeech = Math.max(
        0,
        this.counters.audioSpeech - 1
      );
    }

    // --------------------------------------------------
    // Background counter
    // --------------------------------------------------
    if (backgroundAudioDetected) {
      this.counters.audioBackground++;
    } else {
      this.counters.audioBackground = Math.max(
        0,
        this.counters.audioBackground - 1
      );
    }

    // --------------------------------------------------
    // Confirmation
    // --------------------------------------------------
    const isSpeechConfirmed =
      this.counters.audioSpeech >=
      (config.requiredSpeechFrames || 1);

    const isBackgroundConfirmed =
      this.counters.audioBackground >=
      (config.requiredBackgroundFrames || 1);

    let shouldWarn = false;
    let candidateSpeaking = false;
    let violationType = null;

    // ==================================================
    // MOCK INTERVIEW
    // ==================================================
    if (mode === "mock") {

      // ------------------------------------------------
      // AI IS SPEAKING
      // ------------------------------------------------
      if (isInterviewerSpeaking) {
        // Due to audio echoing from laptop speakers, the AI's own voice triggers speech warnings.
        // It also triggers "Background Media" warnings because the model classifies speaker audio as "Television" or "Radio".
        // Therefore, we MUST completely disable warnings while the AI is speaking to prevent false positives.
        shouldWarn = false;
      }

      // ------------------------------------------------
      // CANDIDATE'S TURN
      // ------------------------------------------------
      else {
        // Normal candidate answer
        if (isSpeechConfirmed) {
          candidateSpeaking = true;
        }

        // To prevent candidate's own voice from falsely triggering background warnings (YAMNet often
        // confuses echoing/room speech with "radio" or "television"), we require a much higher
        // sustained background detection (e.g., 4 frames = 1s) if speech is also detected.
        const requiredMockBackgroundFrames = candidateSpeaking ? 4 : (config.requiredBackgroundFrames || 1);

        if (this.counters.audioBackground >= requiredMockBackgroundFrames) {
          shouldWarn = true;
          violationType = "background";
        }
      }
    }

    // ==================================================
    // CODING INTERVIEW
    // ==================================================
    else if (mode === "coding") {

      if (isBackgroundConfirmed) {
        shouldWarn = true;
        violationType = "background";
      }

      else if (isSpeechConfirmed) {
        shouldWarn = true;
        violationType = "speech";
      }
    }

    // ==================================================
    // COOLDOWN
    // ==================================================
    const now = Date.now();

    const cooldownMs =
      config.violationCooldownMs || 8000;

    if (shouldWarn) {

      if (
        now - this.lastViolationTimes.audio >
        cooldownMs
      ) {
        this.lastViolationTimes.audio = now;

        return {
          warning: true,
          candidateSpeaking: false,
          type: violationType
        };
      }
    }

    return {
      warning: false,
      candidateSpeaking
    };
  }

  canTrigger(type, isPresent) {
    if (isPresent !== undefined) {
      if (type === 'phone') {
        if (isPresent) {
          this.counters.phone += 1;
          if (
            this.counters.phone >= PROCTORING_CONFIG.phoneRequiredFrames &&
            !this.state.phone
          ) {
            this.state.phone = true;
            return true;
          }
          return false;
        }
        // Decay counter instead of strict reset to handle YOLO flickering
        this.counters.phone = Math.max(0, this.counters.phone - 1);
        if (this.counters.phone === 0) {
          this.state.phone = false;
        }
        return false;
      }

      if (type === 'multiplePeople') {
        if (isPresent) {
          this.counters.multiplePeople++;
          // Require 3 consecutive frames of multiple people validation
          if (this.counters.multiplePeople >= 3 && !this.state.multiplePeople) {
            this.state.multiplePeople = true;
            return true;
          }
          return false;
        } else {
          // Strict reset on 1 frame drop
          this.counters.multiplePeople = 0;
          this.state.multiplePeople = false;
          return false;
        }
      }

      if (isPresent && !this.state[type]) {
        this.state[type] = true;
        return true;
      } else if (!isPresent && this.state[type]) {
        this.state[type] = false;
        return false;
      }
      return false;
    }

    const now = Date.now();
    const lastTime = this.lastViolationTimes[type] || 0;

    if (now - lastTime > 3000) { // PROCTORING_CONFIG.violationCooldownMs
      this.lastViolationTimes[type] = now;
      return true;
    }

    return false;
  }

  reset() {
    this.lastViolationTimes = {
      faceOut: 0,
      lookingAway: 0,
      audio: 0,
    };
    this.state = {
      multiplePeople: false,
      phone: false,
      audio: false,
    };
    this.counters = {
      multiplePeople: 0,
      phone: 0,
      audioSpeech: 0,
      audioBackground: 0,
    };
  }
}

export const violationTracker = new ViolationTracker();
