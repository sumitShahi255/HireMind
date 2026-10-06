


import React from 'react'
import maleVideo from "../assets/Videos/male-ai.mp4"
import femaleVideo from "../assets/Videos/female-ai.mp4"
import Timer from './Timer';
import { motion } from "motion/react";
import { ArrowRight, Mic, MicOff } from "lucide-react";
import { useState } from 'react';
import { useRef } from 'react';
import { useEffect } from 'react';
import axios from 'axios';
import { ServerUrl } from '../App';
import { initMediaPipe, detectFaces, detectFaceLandmarks } from '../utils/proctoring/mediapipe';
import { initYOLO, detectObjects } from '../utils/proctoring/yolo';
import { checkHeadPose } from '../utils/proctoring/headPose';
import { violationTracker } from '../utils/proctoring/violationTracker';
import { PROCTORING_CONFIG, DEBUG_PROCTORING } from '../utils/proctoring/config';
import { AudioProctor } from '../utils/proctoring/audio';
import { Camera, ShieldAlert, Video as VideoIcon, Download, Smartphone } from 'lucide-react';

function Step2Interview({ interviewData, onFinish }) {
  const { interviewId, firstQuestion, userName } = interviewData;
  const isProcessingRef = useRef(false);
  const transcriptRef = useRef("");
  const latestAnswerRef = useRef("");
  const lastInterimRef = useRef("");
  const recognitionRunningRef = useRef(false);
  const shouldListenRef = useRef(false);
  const restartTimeoutRef = useRef(null);
  const [isIntroPhase, setIsIntroPhase] = useState(true);
  const [isListening, setIsListening] = useState(false);

  const [isMicOn, setIsMicOn] = useState(true);
  const recognitionRef = useRef(null);
  const [isAIPlaying, setIsAIPlaying] = useState(false);
  const [isUserTurn, setIsUserTurn] = useState(false);

  const [currentQuestion, setCurrentQuestion] = useState(firstQuestion);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [nextQuestionStore, setNextQuestionStore] = useState(null);
  const [isFinishedFromServer, setIsFinishedFromServer] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60); // Defaulting to 60s since dynamic 

  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voiceGender, setVoiceGender] = useState("female");
  const [subtitle, setSubtitle] = useState("");

  const videoRef = useRef(null);
  const userVideoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const videoSequenceNumberRef = useRef(0);
  const snapshotSequenceNumberRef = useRef(0);
  const videoIntervalRef = useRef(null);
  const analysisTimeoutRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [emotion] = useState("neutral");
  const [cheatingAlert, setCheatingAlert] = useState(null);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [warningCount, setWarningCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [statusAlert, setStatusAlert] = useState("");
  const [isInitializing, setIsInitializing] = useState(true);

  const violationCounterRef = useRef({
    faceOut: 0,
    multiplePeople: 0,
    phone: 0
  });
  const objectModelRef = useRef(null);
  const audioProctorRef = useRef(null);
  const isAIPlayingRef = useRef(false);
  const statusAlertRef = useRef("");
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);
  const snapshotsRef = useRef([]);
  const proctoringLogsRef = useRef([]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    isAIPlayingRef.current = isAIPlaying;
  }, [isAIPlaying]);


  const handleCheatingRef = useRef(null);
  useEffect(() => {
    handleCheatingRef.current = (types) => {
      const typesArray = Array.isArray(types) ? types : [types];

      typesArray.forEach(type => {
        proctoringLogsRef.current.push({
          event: `Violation: ${type}`,
          timestamp: new Date()
        });
      });

      const combinedMessage = typesArray.join(" and ");

      const isCritical = typesArray.some(t => {
        const lower = t.toLowerCase();
        return lower.includes("phone") ||
          lower.includes("multiple") ||
          lower.includes("absence") ||
          lower.includes("tab") ||
          lower.includes("window") ||
          lower.includes("shortcut");
      });
      const severity = isCritical ? 'critical' : 'warning';

      setWarningCount(prev => {
        const nextCount = prev + typesArray.length;
        setCheatingAlert({ message: `Warning: ${combinedMessage} detected!`, type: severity });
        setTimeout(() => setCheatingAlert(null), 3000);
        return nextCount;
      });
    };
  });

  // voice function

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) {
        return;
      }

      // male voice

      const maleVoice =
        voices.find(v =>
          v.name.toLowerCase().includes('david') ||
          v.name.toLowerCase().includes('mark') ||
          v.name.toLowerCase().includes('male')
        );

      if (maleVoice) {
        setSelectedVoice(maleVoice);
        setVoiceGender("male");
        return;
      }

      // female voice fallback

      const femaleVoice =
        voices.find(v =>
          v.name.toLowerCase().includes('zira') ||
          v.name.toLowerCase().includes('samantha') ||
          v.name.toLowerCase().includes('female')
        );

      if (femaleVoice) {
        setSelectedVoice(femaleVoice);
        setVoiceGender("female");
        return;
      }

      setSelectedVoice(voices[0]);
      setVoiceGender("male");
    }

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

  }, [])

  useEffect(() => {
    const loadModels = async () => {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Model loading timeout")), 30000)
      );

      try {
        await Promise.race([
          Promise.all([initMediaPipe(), initYOLO()]),
          timeoutPromise
        ]);
        console.log("initYOLO success: Proctoring Models loaded successfully!");
      } catch (err) {
        console.error("YOLO INITIALIZATION FAILED:", err);
      } finally {
        setIsModelsLoaded(true);
        setIsInitializing(false);
      }
    };

    loadModels();
  }, []);
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (userVideoRef.current) {
      userVideoRef.current.srcObject = null;
    }
    if (audioProctorRef.current) {
      audioProctorRef.current.stop();
      audioProctorRef.current = null;
    }
  };

  useEffect(() => {
    let stream;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 640,
            height: 480,
            frameRate: 24
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        if (!isMountedRef.current || isFinishingRef.current) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;

        if (hasStarted && userVideoRef.current) {
          userVideoRef.current.srcObject = stream;
          if (!isRecording) startRecording(stream);

          if (!audioProctorRef.current) {
            audioProctorRef.current = new AudioProctor("mock");

            audioProctorRef.current.onAudioEvent = (audioState) => {

              if (
                !isMountedRef.current ||
                isFinishingRef.current
              ) {
                return;
              }

              const aiSpeaking =
                isAIPlayingRef.current;

              // --------------------------------------------
              // Debug
              // --------------------------------------------
              if (DEBUG_PROCTORING) {
                console.log("AUDIO EVENT:", {
                  aiSpeaking,
                  speechDetected:
                    audioState.speechDetected,

                  backgroundAudioDetected:
                    audioState.backgroundAudioDetected,

                  detectedCategories:
                    audioState.detectedCategories
                });
              }

              // --------------------------------------------
              // Track violation
              // --------------------------------------------
              const result =
                violationTracker.trackAudio(
                  "mock",
                  audioState,
                  aiSpeaking
                );

              // --------------------------------------------
              // Warning
              // --------------------------------------------
              if (result.warning) {

                let violationMsg;

                if (aiSpeaking) {

                  if (result.type === "speech") {
                    violationMsg =
                      "Interruption: Suspicious speech detected while interviewer was speaking";
                  } else {
                    violationMsg =
                      "Interruption: Suspicious background audio detected while interviewer was speaking";
                  }

                } else {

                  if (result.type === "speech") {
                    violationMsg =
                      "Suspicious speech detected";
                  } else {
                    violationMsg =
                      "Suspicious background audio (Media/Animal/Other) detected";
                  }
                }

                handleCheatingRef.current?.(
                  violationMsg
                );
              }
            };
          }
          audioProctorRef.current.start(stream);
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      stopRecording();
      if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStarted]);


  useEffect(() => {
    if (!hasStarted) return;

    const snapshotInterval = setInterval(() => {
      takeSnapshot();
    }, 30000);

    return () => clearInterval(snapshotInterval);
  }, [hasStarted]);




  useEffect(() => {
    if (!hasStarted) return;

    // Removed Copy/Paste/Cut block for testing
    const preventDefaults = (e) => e.preventDefault();
    document.addEventListener('copy', preventDefaults);
    document.addEventListener('paste', preventDefaults);
    document.addEventListener('cut', preventDefaults);
    document.addEventListener('contextmenu', preventDefaults);

    // Block Keyboard Shortcuts
    const blockShortcuts = (e) => {
      const key = e.key.toLowerCase();
      const isCopyPaste = e.ctrlKey && (key === 'a' || key === 'c' || key === 'v' || key === 'x' || key === 'z' || key === 'y');
      const isOtherForbidden =
        e.key === 'F12' ||
        e.key === 'PrintScreen' ||
        e.key === 'Snapshot' ||
        (e.ctrlKey && (key === 'u' || key === 'i' || key === 'j' || key === 's')) ||
        e.altKey ||
        e.metaKey;

      if (isCopyPaste || isOtherForbidden) {
        e.preventDefault();
        e.stopPropagation();
        if (isOtherForbidden) {
          handleCheatingRef.current?.("Forbidden shortcut");
        }
      }
    };
    document.addEventListener('keydown', blockShortcuts, true);


    const handleVisibilityChange = () => {
      if (document.hidden && !isFinishingRef.current) handleCheatingRef.current?.("Tab switching");
    };
    const handleBlur = () => {
      if (!isFinishingRef.current) handleCheatingRef.current?.("Window focus lost");
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        if (hasStarted && !isFinishingRef.current) handleCheatingRef.current?.("Exited full-screen");
      } else {
        setIsFullscreen(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('copy', preventDefaults);
      document.removeEventListener('paste', preventDefaults);
      document.removeEventListener('cut', preventDefaults);
      document.removeEventListener('contextmenu', preventDefaults);
      document.removeEventListener('keydown', blockShortcuts, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [hasStarted]);

  const startInterviewSession = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
        setIsFullscreen(true);
        setHasStarted(true);

        setTimeout(() => takeSnapshot(), 2000);
      }
    } catch (err) {
      console.error("Fullscreen request failed", err);
      setHasStarted(true);
      setTimeout(() => takeSnapshot(), 2000);
    }
  };

  const takeSnapshot = () => {
    if (userVideoRef.current && !isFinishingRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = userVideoRef.current.videoWidth || 640;
      canvas.height = userVideoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(userVideoRef.current, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        if (blob) {
          const currentSeq = snapshotSequenceNumberRef.current++;
          await uploadProctoringChunk(blob, "snapshot", currentSeq);

          setSnapshots(prev => [...prev, URL.createObjectURL(blob)]);
        }
      }, "image/jpeg", 0.7);

      const toast = document.createElement('div');
      toast.className = 'fixed bottom-20 right-10 bg-black/80 text-white text-[10px] px-3 py-1 rounded-full z-[100] animate-pulse';
      toast.innerText = '📸 Snapshot Captured';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    }
  };

  const proctoringStateRef = useRef({
    faceCount: 0,
    multiplePeopleCandidate: false,
    lookingAway: false,
    phoneDetected: false
  });

  useEffect(() => {
    if (!isModelsLoaded || !hasStarted) return;

    let faceIntervalId;
    let poseIntervalId;
    let yoloIntervalId;

    const updateStatus = () => {
      const state = proctoringStateRef.current;
      let currentStatus = [];
      let violations = [];

      // Face Checks
      if (state.multiplePeopleCandidate) {
        if (violationTracker.canTrigger('multiplePeople', true)) {
          violations.push("Multiple people in camera frame");
        }
      } else if (state.faceCount === 0) {
        currentStatus.push("Face not detected! Please stay in frame");
        violationCounterRef.current.faceOut++;

        // faceCheckInterval is 150ms. To wait 20 seconds, we need (20000 / 150) = ~133 ticks.
        const requiredTicks = 20000 / PROCTORING_CONFIG.faceCheckInterval;

        if (violationCounterRef.current.faceOut >= requiredTicks) {
          if (violationTracker.canTrigger('faceOut', true)) {
            violations.push("Prolonged face absence");
            violationTracker.canTrigger('faceOut', false);
          }
          violationCounterRef.current.faceOut = 0;
        }
      } else {
        violationCounterRef.current.faceOut = 0;
        violationTracker.canTrigger('faceOut', false);
        violationTracker.canTrigger('multiplePeople', false);
      }

      if (state.faceCount > 0) {
        if (!isFaceDetected) setIsFaceDetected(true);
      } else {
        if (isFaceDetected) setIsFaceDetected(false);
      }

      // Pose Check
      if (state.lookingAway) {
        if (violationTracker.canTrigger('lookingAway', true)) {
          violations.push("Looking away");
        }
      } else {
        violationTracker.canTrigger('lookingAway', false);
      }

      // YOLO Checks
      if (state.phoneDetected) {
        if (violationTracker.canTrigger("phone", true)) {
          violations.push("Device Usage: Mobile Phone");
        }
      } else {
        violationTracker.canTrigger("phone", false);
      }

      const finalStatus = currentStatus.length > 0 ? currentStatus.join(" | ") : "";

      if (statusAlertRef.current !== finalStatus) {
        statusAlertRef.current = finalStatus;
        setStatusAlert(finalStatus);
      }

      if (violations.length > 0) {
        handleCheatingRef.current?.(violations);
      }
    };

    const runFaceAnalysis = () => {
      if (!isMountedRef.current || !hasStarted || !userVideoRef.current || userVideoRef.current.readyState < 2) return;
      try {
        const result = detectFaces(userVideoRef.current, performance.now());

        proctoringStateRef.current.faceCount = result.primaryFaceCount ?? 0;
        proctoringStateRef.current.multiplePeopleCandidate = result.multiplePeopleCandidate ?? false;
        updateStatus();
      } catch (err) {
        console.error("Face Analysis Error:", err);
      }
    };

    const runPoseAnalysis = () => {
      if (!isMountedRef.current || !hasStarted || !userVideoRef.current || userVideoRef.current.readyState < 2) return;
      try {
        const landmarks = detectFaceLandmarks(userVideoRef.current, performance.now());
        proctoringStateRef.current.lookingAway = landmarks && checkHeadPose(landmarks);
        updateStatus();
      } catch (err) {
        console.error("Pose Analysis Error:", err);
      }
    };

    let yoloRunning = false;
    const runYOLOAnalysis = async () => {
      if (yoloRunning) return;
      if (!isMountedRef.current || !hasStarted || !userVideoRef.current || userVideoRef.current.readyState < 2) return;
      yoloRunning = true;
      try {
        const results = await detectObjects(userVideoRef.current);
        if (results) {
          proctoringStateRef.current.phoneDetected = results.phone.detected;
          updateStatus();
        }
      } catch (err) {
        console.error("YOLO Analysis Error:", err);
      } finally {
        yoloRunning = false;
      }
    };

    faceIntervalId = setInterval(runFaceAnalysis, PROCTORING_CONFIG.faceCheckInterval);
    poseIntervalId = setInterval(runPoseAnalysis, PROCTORING_CONFIG.poseCheckInterval);
    yoloIntervalId = setInterval(runYOLOAnalysis, PROCTORING_CONFIG.phoneCheckInterval || 300);

    return () => {
      clearInterval(faceIntervalId);
      clearInterval(poseIntervalId);
      clearInterval(yoloIntervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModelsLoaded, hasStarted]);
  const uploadProctoringChunk = async (blob, chunkType, seqNum) => {
    try {
      const formData = new FormData();
      formData.append("interviewId", interviewId);
      formData.append("interviewType", "dynamic-mock");
      formData.append("chunkType", chunkType);
      formData.append("sequenceNumber", seqNum);

      // Periodically sync detections even if incomplete
      formData.append("totalDetections", proctoringLogsRef.current.length);
      formData.append("proctoringLogs", JSON.stringify(proctoringLogsRef.current));

      formData.append("chunk", blob, `${interviewId}_${chunkType}_${seqNum}.${chunkType === 'video' ? 'webm' : 'jpg'}`);

      await axios.post(ServerUrl + "/api/proctoring/upload-chunk", formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" }
      });
    } catch (err) {
      console.error(`Failed to upload ${chunkType} chunk:`, err);
    }
  };

  const startNewRecorder = () => {
    if (!isMountedRef.current || isFinishingRef.current || !streamRef.current) return;
    try {
      const recorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm;codecs=vp8,opus' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = async (e) => {
        if (e.data && e.data.size > 0 && !isFinishingRef.current) {
          const currentSeq = videoSequenceNumberRef.current++;
          await uploadProctoringChunk(e.data, "video", currentSeq);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start video chunk recorder", err);
    }
  };

  const startRecording = () => {
    startNewRecorder();

    videoIntervalRef.current = setInterval(() => {
      if (!isFinishingRef.current && mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
        startNewRecorder();
      }
    }, 15000);
  };

  const isFinishingRef = useRef(false);

  const stopRecording = () => {
    if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const uploadSnapshotsToServer = async () => {
    // No-op, we upload chunks as we go now
  };

  const downloadRecording = () => {
    if (recordedVideoUrl) {
      const a = document.createElement('a');
      a.href = recordedVideoUrl;
      a.download = `interview_${interviewId}.webm`;
      a.click();
    }
  };

  const videoSource = voiceGender === "male" ? maleVideo : femaleVideo;

  useEffect(() => {
    if (!videoRef.current) return;
    if (isAIPlaying) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => { });
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isAIPlaying, hasStarted]);


  const speakText = (text) => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis || !selectedVoice || !isMountedRef.current) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();

      const humanText = text
        .replace(/ and /gi, ", and ")
        .replace(/ but /gi, ", but ")
        .replace(/ because /gi, ", because ")
        .replace(/ so /gi, ", so ")
        .replace(/,/g, ", ..... ")
        .replace(/\./g, ". ...... ")
        .replace(/\?/g, "? ...... ")
        .replace(/!/g, "! ...... ");

      const utterance = new SpeechSynthesisUtterance(humanText);
      utterance.voice = selectedVoice;

      window.speechUtterance = utterance;

      utterance.rate = 0.8;
      utterance.pitch = 1;
      utterance.volume = 1;

      utterance.onstart = () => {
        if (!isMountedRef.current) return;
        isAIPlayingRef.current = true;
        setIsAIPlaying(true);
        stopMic();
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          videoRef.current.play();
        }
      }

      utterance.onerror = (event) => {
        if (event.error !== 'interrupted' && event.error !== 'canceled') {
          console.error("SpeechSynthesis error:", event.error);
        }
        if (isMountedRef.current) {
          setIsAIPlaying(false);
        }
        resolve();
      };

      utterance.onend = () => {
        if (!isMountedRef.current) {
          resolve();
          return;
        }

        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }

        isAIPlayingRef.current = false;
        setIsAIPlaying(false);
        if (isMicOn) {
          startMic();
        }

        setSubtitle("");
        resolve();
      };

      setSubtitle(text);

      window.speechSynthesis.speak(utterance);
    })
  }

  useEffect(() => {
    if (!selectedVoice || !hasStarted) {
      return;
    }

    const runIntro = async () => {
      await new Promise(resolve => setTimeout(resolve, 1200));

      if (isIntroPhase) {

        await speakText(
          `Welcome ${userName}, I’m excited to conduct your interview today. Please relax and answer naturally.`
        );

        await speakText(
          "I’ll ask you a few interview questions. Feel free to answer confidently and naturally. Let’s begin."
        );

        setIsIntroPhase(false);
      } else if (currentQuestion) {

        if (isFinishedFromServer) {
          await speakText("This is your final question. Take your time and answer confidently.")
        }

        await speakText(currentQuestion.questionText);

        setIsUserTurn(true);

        if (isMicOn) {
          startMic();
        }
      }
    }

    runIntro()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVoice, isIntroPhase, currentQuestion, hasStarted])

  useEffect(() => {
    if (isIntroPhase) return;
    if (!currentQuestion) return;
    if (isSubmitting) return;
    if (!isUserTurn) return; // Wait until the user's turn

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      })
    }, 1000);

    return () => clearInterval(timer);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIntroPhase, currentQuestion, isSubmitting, isUserTurn])

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false; // Force reliable sentence-by-sentence finalization
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      recognitionRunningRef.current = true;
      if (isMountedRef.current) setIsListening(true);
    };

    recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = "";

      // We MUST use resultIndex and incrementally append final results,
      // because some browsers drop finalized results from the event.results array.
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        transcriptRef.current = (transcriptRef.current + " " + finalTranscript).trim();
      }

      lastInterimRef.current = interimTranscript;

      const latestText = (transcriptRef.current + " " + interimTranscript).trim();
      latestAnswerRef.current = latestText;

      console.log("[STT RESULT]", {
        finalTranscript,
        interimTranscript,
        latestText,
        transcriptRefCurrent: transcriptRef.current,
        answerBefore: answer
      });

      if (isMountedRef.current) {
        setAnswer(latestText);
        console.log("[SET ANSWER]", latestText, "SOURCE: onresult");
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        console.warn("SpeechRecognition:", event.error);
      }
    };

    recognition.onend = () => {
      recognitionRunningRef.current = false;
      if (isMountedRef.current) setIsListening(false);

      // COMMIT CURRENT SESSION TO PAST SESSIONS
      if (lastInterimRef.current) {
        transcriptRef.current = (transcriptRef.current + " " + lastInterimRef.current).trim();
        lastInterimRef.current = ""; // Clear so we don't duplicate

        const latestText = transcriptRef.current;
        latestAnswerRef.current = latestText;
        if (isMountedRef.current) {
          setAnswer(latestText);
        }
      }

      const attemptRestart = () => {
        if (!shouldListenRef.current || isFinishingRef.current || isAIPlayingRef.current || !isMountedRef.current) {
          return;
        }
        if (!recognitionRunningRef.current) {
          try {
            recognition.start();
          } catch (err) {
            console.warn("Restart recognition busy, retrying...", err);
            restartTimeoutRef.current = setTimeout(attemptRestart, 500);
          }
        }
      };

      if (shouldListenRef.current && !isFinishingRef.current && !isAIPlayingRef.current) {
        if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = setTimeout(attemptRestart, 150);
      }
    };

    recognitionRef.current = recognition;
  }, []);

  function startMic() {
    shouldListenRef.current = true;
    if (recognitionRef.current && !isAIPlayingRef.current && !isFinishingRef.current) {
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);

      const attemptStart = () => {
        if (
          !isMountedRef.current ||
          !shouldListenRef.current ||
          isFinishingRef.current ||
          isAIPlayingRef.current
        ) {
          return;
        }
        if (!recognitionRunningRef.current) {
          try {
            recognitionRef.current.start();
          } catch (err) {
            console.warn("startMic busy, retrying...", err);
            restartTimeoutRef.current = setTimeout(attemptStart, 500);
          }
        }
      };

      restartTimeoutRef.current = setTimeout(attemptStart, 150);
    }
  }

  function stopMic() {
    shouldListenRef.current = false;
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        // ignore
      }
    }
  }

  function toggleMic() {
    if (isMicOn) {
      stopMic();
    } else {
      startMic();
    }
    setIsMicOn(!isMicOn);
  };

  async function submitAnswer() {
    if (isSubmitting || isProcessingRef.current) return;
    isProcessingRef.current = true;
    stopMic()
    setIsSubmitting(true);
    setIsUserTurn(false);

    const finalAnswer = latestAnswerRef.current?.trim() || answer?.trim() || "";

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    try {
      const result = await axios.post(ServerUrl + "/api/dynamic-interview/submit-answer", {
        interviewId,
        questionId: currentQuestion.questionId,
        answer: finalAnswer,
        timeTaken: 60 - timeLeft, // Using static 60s max for now or track elapsed
        totalDetections: proctoringLogsRef.current.length,
        proctoringLogs: proctoringLogsRef.current
      }, {
        withCredentials: true,
        signal: abortControllerRef.current.signal
      })

      if (isMountedRef.current) {
        setFeedback(result.data.evaluation?.summary || "Good effort.");
        setNextQuestionStore(result.data.nextQuestion);
        setIsFinishedFromServer(result.data.isFinished);
        speakText(result.data.evaluation?.summary || "Good effort.");
        setIsSubmitting(false)
        isProcessingRef.current = false;
      }
    } catch (error) {
      if (axios.isCancel(error)) {
        console.log("Request cancelled");
      } else {
        console.log(error);
        if (isMountedRef.current) {
          setIsSubmitting(false);
          isProcessingRef.current = false;
          const errorMsg = error.response?.data?.message || error.message || "Unknown Error";
          setStatusAlert(`Error: ${errorMsg}`);
          setTimeout(() => setStatusAlert(""), 7000);

          // CRITICAL FIX: Revert user turn so they can retry. 
          // Otherwise "Next Question" button appears and clicking it ends the interview.
          setIsUserTurn(true);
        }
      }
    }
  }

  async function handleNext() {
    setIsUserTurn(false);
    transcriptRef.current = "";
    latestAnswerRef.current = "";
    lastInterimRef.current = "";
    console.log("[SET ANSWER]", "", "SOURCE: handleNext");
    setAnswer("");
    setFeedback("");

    if (isFinishedFromServer || !nextQuestionStore) {
      await finishInterview();
      return;
    }

    await speakText("Alright, let's move to the next question.");

    if (isMountedRef.current) {
      setCurrentQuestion(nextQuestionStore);
      setQuestionNumber(questionNumber + 1);
      setTimeLeft(60);
      setNextQuestionStore(null);
      setTimeout(() => {
        if (isMicOn) startMic();
      }, 500);
    }
  }

  // eslint-disable-next-line no-unused-vars
  async function finishInterview(isViolation = false) {
    window.speechSynthesis.cancel();
    if (abortControllerRef.current) abortControllerRef.current.abort();

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.error("Error exiting fullscreen:", err));
    }
    stopMic();
    setIsMicOn(false);
    isFinishingRef.current = true;

    stopRecording();
    stopCamera();

    if (isMountedRef.current) {
      console.log("[SET ANSWER]", "", "SOURCE: finishInterview");
      setAnswer("");
      setFeedback("");
      setSubtitle("");
      setIsAIPlaying(false);
    }

    // Upload snapshots
    await uploadSnapshotsToServer();


    try {
      if (isMountedRef.current) setStatusAlert("Finalizing report...");

      abortControllerRef.current = new AbortController();
      const result = await axios.post(ServerUrl + "/api/dynamic-interview/finish", {
        interviewId,
        totalDetections: proctoringLogsRef.current.length,
        proctoringLogs: proctoringLogsRef.current
      }, {
        withCredentials: true,
        signal: abortControllerRef.current.signal
      })

      console.log(result.data);
      if (isMountedRef.current) {
        setStatusAlert("");
        onFinish(result.data);
      }
    } catch (error) {
      if (axios.isCancel(error)) {
        console.log("Finish request cancelled");
      } else {
        console.log(error);
        if (isMountedRef.current) setStatusAlert("Error finalizing report.");
      }
    }
  }

  useEffect(() => {
    if (isIntroPhase) return;
    if (!currentQuestion) return;

    if (timeLeft === 0 && !isSubmitting && !feedback) {
      submitAnswer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current.abort();
      }
      window.speechSynthesis.cancel();
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
      stopCamera();
      stopRecording();
    }
  }, []);


  return (
    <div className='min-h-screen bg-linear-to-br from-emerald-50 via-white to-teal-100 flex 
    items-center justify-center p-4 sm:p-6'>


      <video src={maleVideo} preload="auto" muted playsInline className='hidden' />
      <video src={femaleVideo} preload="auto" muted playsInline className='hidden' />

      {!hasStarted ? (
        <div className='w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-10 flex flex-col items-center text-center space-y-8 border border-emerald-100'>
          <div className='w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-inner'>
            <ShieldAlert size={40} />
          </div>
          <div className='space-y-4'>
            <h1 className='text-3xl font-bold text-gray-900'>Proctored Interview Setup</h1>
            <p className='text-gray-600 leading-relaxed max-w-md'>
              This interview uses AI monitoring and security enforcement. To begin, please enter
              <span className='font-bold text-emerald-600'> Full-Screen Mode</span>.
              The session will be recorded and your presence will be monitored.
            </p>
          </div>

          <ul className='text-left w-full space-y-4 bg-gray-50 p-6 rounded-2xl border border-gray-100 text-sm'>
            <li className='flex items-start gap-3 text-gray-700 font-medium'>
              <div className='w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0'></div>
              <span><strong>Audio & Video Recording:</strong> Your camera and microphone will continuously record the session.</span>
            </li>
            <li className='flex items-start gap-3 text-gray-700 font-medium'>
              <div className='w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0'></div>
              <span><strong>Periodic Snapshots:</strong> Snapshots will be captured periodically during the session.</span>
            </li>
            <li className='flex items-start gap-3 text-gray-700 font-medium'>
              <div className='w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0'></div>
              <span><strong>Smart Proctoring Detections:</strong> The AI monitors tab switches, multiple faces, mobile phones, and full-screen exits.</span>
            </li>
            <li className='flex items-start gap-3 text-gray-700 font-medium'>
              <div className='w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0'></div>
              <span><strong>Privacy & Permission:</strong> All data is securely associated only with this interview.</span>
            </li>
          </ul>

          <motion.button
            onClick={startInterviewSession}
            disabled={isInitializing}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className='w-full bg-emerald-600 text-white py-4 rounded-2xl text-lg font-bold shadow-xl hover:bg-emerald-700 transition flex items-center justify-center gap-3 disabled:bg-emerald-400'
          >
            {isInitializing ? "Initializing Secure Environment..." : "Start Secure Interview"} <ArrowRight size={22} />
          </motion.button>



        </div>
      ) : (
        <div className='w-full max-w-6xl min-h-[85vh] bg-white rounded-3xl shadow-2xl border 
      border-gray-200 flex flex-col overflow-hidden relative'>

          {!isFullscreen && hasStarted && (
            <div className='absolute inset-0 bg-black/60 backdrop-blur-md z-100 flex items-center justify-center p-6'>
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className='bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center space-y-6'
              >
                <div className='w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto'>
                  <ShieldAlert size={32} />
                </div>
                <div className='space-y-2'>
                  <h2 className='text-2xl font-bold text-gray-900'>Security Violation</h2>
                  <p className='text-gray-600 text-sm'>
                    Exiting full-screen is not allowed during this proctored session.
                    Please resume full-screen to continue.
                  </p>
                </div>
                <button
                  onClick={startInterviewSession}
                  className='w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-emerald-700 transition flex items-center justify-center gap-2'
                >
                  <VideoIcon size={20} /> Resume Full-Screen
                </button>
              </motion.div>
            </div>
          )}

          {/* TOP Split Screen */}
          <div className='w-full bg-white flex flex-col lg:flex-row p-4 sm:p-6 gap-6 border-b border-gray-100'>

            {/* Left: AI Video */}
            <div className='w-full lg:w-1/2 relative rounded-3xl overflow-hidden shadow-sm bg-gray-50 flex items-center justify-center border border-gray-200'>
              <div className='absolute top-4 left-4 bg-white/90 text-emerald-700 font-semibold text-xs px-4 py-1.5 rounded-full backdrop-blur-md z-10 border border-emerald-100 shadow-sm flex items-center gap-2'>
                <div className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse'></div>
                AI Interviewer
              </div>

              <video
                src={videoSource}
                key={videoSource}
                ref={videoRef}
                muted
                playsInline
                preload='auto'
                loop
                className='w-full h-full object-cover scale-[1.02]'
                style={{ willChange: 'transform' }}
              />

              {subtitle && (
                <div className='absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-lg bg-white/90 backdrop-blur-md border border-gray-100 rounded-2xl p-4 shadow-xl z-20'>
                  <p className='text-gray-800 text-sm sm:text-base font-medium text-center leading-relaxed'>{subtitle}</p>
                </div>
              )}
            </div>

            {/* Right: User Camera */}
            <div className='w-full lg:w-1/2 relative rounded-3xl overflow-hidden shadow-sm bg-gray-50 flex items-center justify-center border border-gray-200'>
              <div className='absolute top-4 left-4 bg-white/90 text-gray-700 font-semibold text-xs px-4 py-1.5 rounded-full backdrop-blur-md z-10 border border-gray-200 shadow-sm flex items-center gap-2'>
                <div className='w-2 h-2 rounded-full bg-red-500 animate-pulse'></div>
                You
              </div>

              {cheatingAlert && cheatingAlert.message && (
                <div className={`absolute top-12 left-3 right-3 text-[10px] px-3 py-2 rounded-lg backdrop-blur-md z-30 border flex items-center gap-2 animate-bounce font-bold shadow-lg ${cheatingAlert.type === 'warning' ? 'bg-orange-500/90 text-white border-orange-400' : 'bg-red-600 text-white border-red-400'
                  }`}>
                  <ShieldAlert size={14} />
                  {cheatingAlert.message}
                </div>
              )}

              {statusAlert && (
                <div className={`absolute ${cheatingAlert ? 'top-24' : 'top-12'} left-3 right-3 bg-orange-500/90 text-white text-[10px] px-3 py-2 rounded-lg backdrop-blur-md z-20 border border-orange-400 flex items-center gap-2 animate-pulse font-medium`}>
                  {statusAlert.toLowerCase().includes('phone') ? <Smartphone size={14} /> : <Camera size={14} />}
                  {statusAlert}
                </div>
              )}

              <div className='absolute bottom-3 right-3 bg-emerald-500/80 text-white text-[10px] px-3 py-1 rounded-full backdrop-blur-md z-20 border border-emerald-400 flex items-center gap-2'>
                <Camera size={12} />
                AI Emotion: {emotion}
              </div>



              <video
                ref={userVideoRef}
                autoPlay
                muted
                playsInline
                width="640"
                height="480"
                className='w-full aspect-video object-cover -scale-x-100 brightness-110 contrast-[1.05]'
              />

            </div>

          </div>


          <div className='flex-1 flex flex-col lg:flex-row p-6 sm:p-8 gap-8 bg-gray-50/50'>


            <div className='w-full lg:w-[30%] flex flex-col gap-6'>
              <div className='bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-5'>
                <div className='flex justify-between items-center'>
                  <span className='text-sm text-gray-500 font-medium'>Interview Status</span>
                  {isAIPlaying && <span className='text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100'>AI Speaking</span>}
                </div>

                <div className='h-px bg-gray-100'></div>

                <div className='flex justify-center py-2'>
                  <Timer timeLeft={timeLeft} totalTime={currentQuestion?.timeLimit || 60} />
                </div>

                <div className='h-px bg-gray-100'></div>

                <div className='grid grid-cols-2 gap-6 text-center pt-2'>
                  <div>
                    <div className='text-3xl font-bold text-emerald-600 mb-1'>{questionNumber}</div>
                    <div className='text-xs text-gray-500 uppercase tracking-wider font-semibold'>Question</div>
                  </div>

                  <div>
                    <div className='text-3xl font-bold text-gray-800 mb-1'>10</div>
                    <div className='text-xs text-gray-500 uppercase tracking-wider font-semibold'>Total</div>
                  </div>
                </div>
              </div>

              <div className='bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4'>
                <div className='flex items-center gap-3 text-sm font-semibold text-gray-700'>
                  <div className='p-2 bg-blue-50 text-blue-600 rounded-lg'>
                    <ShieldAlert size={18} />
                  </div>
                  AI Monitoring Active
                </div>
                <div className='grid grid-cols-1 gap-2'>
                  <div className='flex justify-between text-xs'>
                    <span className='text-gray-500'>Proctoring</span>
                    <span className='text-emerald-600 font-bold'>ENFORCED</span>
                  </div>


                  <div className='flex justify-between text-xs'>
                    <span className='text-gray-500'>Recording</span>
                    <span className='text-emerald-600 font-bold uppercase'>{isRecording ? "Live" : "Standby"}</span>
                  </div>
                  <div className='flex justify-between text-xs'>
                    <span className='text-gray-500'>Snapshots Taken</span>
                    <span className='text-blue-600 font-bold'>{snapshots.length}</span>
                  </div>

                </div>
                {recordedVideoUrl && (
                  <button
                    onClick={downloadRecording}
                    className='w-full mt-2 flex items-center justify-center gap-2 text-xs bg-gray-100 hover:bg-gray-200 py-2 rounded-lg transition-colors font-bold text-gray-700'
                  >
                    <Download size={14} /> Download Recording
                  </button>
                )}
                {!isFullscreen && hasStarted && (
                  <button
                    onClick={startInterviewSession}
                    className='w-full mt-2 flex items-center justify-center gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 py-3 rounded-lg transition-colors font-bold text-white shadow-md animate-pulse'
                  >
                    <ShieldAlert size={14} /> Resume Full Screen
                  </button>
                )}
              </div>
            </div>

            <div className='flex-1 flex flex-col'>
              <div className='flex items-center justify-between mb-6'>
                <h2 className='text-2xl font-bold text-gray-800 flex items-center gap-2'>
                  <span className='bg-emerald-100 text-emerald-600 p-2 rounded-lg'><Mic size={20} /></span>
                  HireMind Assistant
                </h2>

                {isListening && !isSubmitting && !isIntroPhase && (
                  <div className='flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200'>
                    <div className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse'></div>
                    <span className='text-sm font-semibold text-emerald-700'>Listening...</span>
                  </div>
                )}
              </div>

              {!isIntroPhase && (
                <div className='relative mb-6 bg-white p-5 sm:p-6 rounded-2xl border border-emerald-100 shadow-sm border-l-4 border-l-emerald-500'>
                  <div className='text-lg sm:text-xl font-semibold text-gray-800 leading-relaxed '>
                    {currentQuestion?.questionText}
                  </div>
                </div>
              )}

              <textarea
                placeholder='Type or speak your answer here...'
                onChange={(e) => {
                  console.log("[SET ANSWER]", e.target.value, "SOURCE: textarea onChange");
                  setAnswer(e.target.value);
                  latestAnswerRef.current = e.target.value;
                  transcriptRef.current = e.target.value;
                  lastInterimRef.current = "";
                }}
                value={answer}
                className='flex-1 bg-white p-5 sm:p-6 rounded-2xl resize-none outline-none border
            border-gray-200 focus:ring-2 focus:ring-emerald-500 transition text-gray-800 shadow-inner min-h-37.5'/>

              {!feedback ? (
                <div className='flex items-center gap-4 mt-6'>
                  <motion.button
                    onClick={toggleMic}
                    whileTap={{ scale: 0.9 }}
                    className={`w-14 h-14 flex items-center justify-center rounded-2xl text-white shadow-lg transition-colors ${isMicOn ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600'}`}>
                    {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
                  </motion.button>

                  <motion.button
                    onClick={submitAnswer}
                    disabled={isSubmitting}
                    whileTap={{ scale: 0.95 }}
                    className='flex-1 bg-gray-900 text-white
            py-4 rounded-2xl shadow-xl hover:bg-black transition text-lg font-semibold disabled:bg-gray-400'>
                    {isSubmitting ? "Submitting Response..." : "Submit Response"}
                  </motion.button>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className='mt-6 bg-emerald-50 border border-emerald-200 p-6 rounded-2xl shadow-sm'>
                  <p className='text-emerald-800 font-medium mb-5 text-lg'>{feedback}</p>

                  <button
                    onClick={handleNext}
                    className='w-full bg-emerald-600 text-white
              py-4 rounded-xl shadow-md hover:bg-emerald-700 transition flex items-center justify-center gap-2 text-lg font-semibold'>
                    {isFinishedFromServer ? "Finish Interview" : "Next Question"} <ArrowRight size={20} />
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default React.memo(Step2Interview)
