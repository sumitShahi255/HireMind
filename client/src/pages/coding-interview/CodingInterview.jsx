import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import axios from "axios";
import { ServerUrl } from "../../App";
import { initMediaPipe, detectFaces, detectFaceLandmarks } from '../../utils/proctoring/mediapipe';
import { checkHeadPose } from '../../utils/proctoring/headPose';
import { violationTracker } from '../../utils/proctoring/violationTracker';
import { PROCTORING_CONFIG, DEBUG_PROCTORING } from '../../utils/proctoring/config';
import { AudioProctor } from '../../utils/proctoring/audio';
import {
  Play, Send, Timer as TimerIcon, Terminal as ConsoleIcon, ShieldAlert, Loader2,
  CheckCircle2, XCircle, AlertTriangle, RotateCcw
} from "lucide-react";

const normalizeOutput = (str) => {
  if (!str) return "";
  let clean = str.trim();

  // 1. Lowercase everything
  clean = clean.toLowerCase();

  // 2. Replace none with null
  clean = clean.replace(/\bnone\b/g, "null");

  // 3. Remove all single and double quotes
  clean = clean.replace(/['"]/g, "");

  // 4. Remove all whitespace
  clean = clean.replace(/\s+/g, "");

  // 4.5 Normalize trailing zeros in decimals (e.g. 2.0 -> 2, 1.50 -> 1.5)
  clean = clean.replace(/(\.\d*?[1-9])0+(?=[^\d]|$)/g, '$1');
  clean = clean.replace(/\.0+(?=[^\d]|$)/g, '');

  // 5. If it's a bracketed list, strip trailing null/empty elements
  if (clean.startsWith("[") && clean.endsWith("]")) {
    try {
      const content = clean.slice(1, -1);
      const items = content.split(",").map(item => item.trim());
      while (items.length > 0) {
        const last = items[items.length - 1];
        if (last === "null" || last === "") {
          items.pop();
        } else {
          break;
        }
      }
      return "[" + items.join(",") + "]";
    } catch {
      // ignore
    }
  }

  return clean;
};

const getLanguageKey = (language) => {
  const lang = (language || "").toLowerCase();
  if (lang.includes("c++") || lang.includes("cpp")) return "cpp";
  if (lang.includes("javascript") || lang.includes("node") || lang.includes("js")) return "javascript";
  if (lang.includes("python")) return "python";
  if (lang.includes("java")) return "java";
  if (lang === "c") return "c";
  return "python";
};

const handleEditorBeforeMount = (monaco) => {
  monaco.editor.defineTheme("hiremind-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#050b14",
      "editorGutter.background": "#050b14",
      "editor.lineHighlightBackground": "#0b1220",
      "editorLineNumber.foreground": "#475569",
      "editorLineNumber.activeForeground": "#00d26a"
    }
  });
};

function CodingInterview() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [interviewData, setInterviewData] = useState(null);
  const [loadingInterview, setLoadingInterview] = useState(true);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState("JavaScript");
  const [submissions, setSubmissions] = useState({});

  const [editorTheme, setEditorTheme] = useState("hiremind-dark");
  const [fontSize, setFontSize] = useState(14);

  const [consoleOutput, setConsoleOutput] = useState("");
  const [consoleError, setConsoleError] = useState("");
  const [runCodeResults, setRunCodeResults] = useState(null);
  const [runningCode, setRunningCode] = useState(false);
  const [submittingRound, setSubmittingRound] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [selectedConsoleTab, setSelectedConsoleTab] = useState("stdout");

  const [testCaseResults, setTestCaseResults] = useState([]);
  const [runningTestCases, setRunningTestCases] = useState(false);
  const [isSubmissionResult, setIsSubmissionResult] = useState(false);

  const [timeLeft, setTimeLeft] = useState(2700);

  const [warningCount, setWarningCount] = useState(0);
  const [cheatingAlert, setCheatingAlert] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [statusAlert, setStatusAlert] = useState("");
  const violationCounterRef = useRef({ faceOut: 0 });
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);

  // Proctoring Recording States
  const [hasGivenConsent, setHasGivenConsent] = useState(false);
  const [consentError, setConsentError] = useState("");
  const mediaRecorderRef = useRef(null);
  const videoSequenceNumberRef = useRef(0);
  const snapshotSequenceNumberRef = useRef(0);
  const snapshotIntervalRef = useRef(null);
  const videoIntervalRef = useRef(null);

  const userVideoRef = useRef(null);
  const streamRef = useRef(null);
  const objectModelRef = useRef(null);
  const audioProctorRef = useRef(null);
  const analysisTimeoutRef = useRef(null);
  const isFinishingRef = useRef(false);
  const isMountedRef = useRef(true);
  const proctoringLogsRef = useRef([]);
  const modelsLoadedRef = useRef(false);
  const statusAlertRef = useRef("");

  const currentQuestion = interviewData?.questions?.[activeQuestionIndex];

  const [isMountedState, setIsMountedState] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    setTimeout(() => setIsMountedState(true), 0);
    const fetchInterview = async () => {
      try {
        const response = await axios.get(ServerUrl + `/api/coding-interview/report/${id}`, {
          withCredentials: true
        });
        setInterviewData(response.data);

        if (response.data.status === "completed") {
          navigate(`/coding-interview/report/${response.data._id || id}`, { replace: true });
          return;
        }

        const rawLang = response.data.language || "Python";
        const lowLang = rawLang.toLowerCase();
        let defaultLang = "Python";
        if (lowLang.includes("javascript") || lowLang.includes("node")) defaultLang = "JavaScript";
        else if (lowLang.includes("python")) defaultLang = "Python";
        else if (lowLang.includes("java") && !lowLang.includes("javascript")) defaultLang = "Java";
        else if (lowLang.includes("c++") || lowLang.includes("cpp")) defaultLang = "C++";
        else if (lowLang === "c") defaultLang = "C";

        setSelectedLanguage(defaultLang);

        const initialSubs = {};
        response.data.questions.forEach((q, idx) => {
          const langKey = getLanguageKey(defaultLang);
          initialSubs[idx] = { [langKey]: q.codeTemplates?.[langKey] || q.codeTemplate || "" };
        });
        setSubmissions(initialSubs);

        const diff = response.data.difficulty || "Easy";
        let initialSeconds = 2700;
        if (diff.toLowerCase() === "medium") {
          initialSeconds = 3600;
        } else if (diff.toLowerCase() === "hard") {
          initialSeconds = 5400;
        }
        setTimeLeft(initialSeconds);
      } catch (error) {
        console.error(error);
        alert("Failed to load coding interview session.");
        navigate("/coding-interview", { replace: true });
      } finally {
        setLoadingInterview(false);
      }
    };
    fetchInterview();

    return () => {
      isMountedRef.current = false;
      if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (loadingInterview || !interviewData || submittingRound || !isCameraReady) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingInterview, interviewData, submittingRound, isCameraReady]);

  const addProctoringLog = (event) => {
    proctoringLogsRef.current.push({
      event,
      timestamp: new Date()
    });
  };

  const triggerCheatingWarning = (types) => {
    const typesArray = Array.isArray(types) ? types : [types];

    typesArray.forEach(type => {
      addProctoringLog(`Violation: ${type}`);
    });

    const combinedMessage = typesArray.join(" & ");

    // Determine severity
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

    setWarningCount((prev) => {
      const nextCount = prev + typesArray.length;
      setCheatingAlert({ message: `Warning: ${combinedMessage} detected!`, type: severity });
      setTimeout(() => setCheatingAlert(null), 4000);
      return nextCount;
    });
  };

  const startAssessmentSession = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch (err) {
      console.error("Fullscreen request failed", err);
    }
  };

  useEffect(() => {
    if (loadingInterview || !interviewData) return;
    const isBypassed = localStorage.getItem("bypassProctoring") === "true" || new URLSearchParams(window.location.search).get("bypassProctoring") === "true";
    if (isBypassed) {
      console.log("Proctoring features completely bypassed (Developer Mode)");
      setTimeout(() => {
        setIsFullscreen(true);
        setIsCameraReady(true);
      }, 0);
      return;
    }

    setTimeout(() => startAssessmentSession(), 0);

    const preventDefaults = (e) => e.preventDefault();
    document.addEventListener("copy", preventDefaults);
    document.addEventListener("paste", preventDefaults);
    document.addEventListener("cut", preventDefaults);
    document.addEventListener("contextmenu", preventDefaults);

    const blockShortcuts = (e) => {
      const key = e.key.toLowerCase();
      const isCopyPaste = e.ctrlKey && (key === "a" || key === "c" || key === "v" || key === "x" || key === "z" || key === "y");
      const isForbidden =
        e.key === "F12" ||
        e.key === "PrintScreen" ||
        e.key === "Snapshot" ||
        (e.ctrlKey && (key === "u" || key === "i" || key === "j" || key === "s")) ||
        e.altKey ||
        e.metaKey;

      if (isCopyPaste || isForbidden) {
        e.preventDefault();
        e.stopPropagation();
        if (isForbidden) {
          triggerCheatingWarning("Forbidden Shortcut / Developer Tools");
        }
      }
    };
    document.addEventListener("keydown", blockShortcuts, true);

    const handleVisibilityChange = () => {
      if (document.hidden && !isFinishingRef.current) {
        triggerCheatingWarning("Tab switched");
      }
    };
    const handleBlur = () => {
      if (!isFinishingRef.current) triggerCheatingWarning("Window lost focus");
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        if (!isFinishingRef.current) triggerCheatingWarning("Fullscreen mode exited");
      } else {
        setIsFullscreen(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("copy", preventDefaults);
      document.removeEventListener("paste", preventDefaults);
      document.removeEventListener("cut", preventDefaults);
      document.removeEventListener("contextmenu", preventDefaults);
      document.removeEventListener("keydown", blockShortcuts, true);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingInterview, interviewData]);

  useEffect(() => {
    if (loadingInterview || !interviewData || !hasGivenConsent) return;
    const isBypassed = localStorage.getItem("bypassProctoring") === "true" || new URLSearchParams(window.location.search).get("bypassProctoring") === "true";
    if (isBypassed) {
      setTimeout(() => {
        setIsFullscreen(true);
        setIsCameraReady(true);
      }, 0);
      return;
    }
    if (modelsLoadedRef.current) return;
    modelsLoadedRef.current = true;

    if (!window.OffscreenCanvas) {
      console.error("OffscreenCanvas is not supported. Proctoring disabled.");
      setTimeout(() => setStatusAlert("Browser incompatible with proctoring. Features disabled."), 0);
      startCamera();
      return;
    }

    const loadModels = async () => {
      try {
        await initMediaPipe();
        console.log("[PROCTOR] MediaPipe initialized");
      } catch (err) {
        console.error("MediaPipe init failed:", err);
        setStatusAlert("Warning: Core proctoring models failed to load.");
      }
      startCamera();
    };

    loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingInterview, interviewData, hasGivenConsent]);

  const uploadProctoringChunk = async (blob, chunkType, seqNum) => {
    try {
      const formData = new FormData();
      formData.append("interviewId", id);
      formData.append("interviewType", "coding");
      formData.append("chunkType", chunkType);
      formData.append("sequenceNumber", seqNum);

      // Periodically sync detections even if incomplete
      formData.append("totalDetections", proctoringLogsRef.current.length);
      formData.append("proctoringLogs", JSON.stringify(proctoringLogsRef.current));

      formData.append("chunk", blob, `${id}_${chunkType}_${seqNum}.${chunkType === 'video' ? 'webm' : 'jpg'}`);

      await axios.post(ServerUrl + "/api/proctoring/upload-chunk", formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" }
      });
    } catch (err) {
      console.error(`Failed to upload ${chunkType} chunk:`, err);
    }
  };

  async function startCamera() {
    if (streamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: 15 },
        audio: true
      });
      if (!isMountedRef.current || isFinishingRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      streamRef.current = stream;
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = stream;
      }
      setIsCameraReady(true);

      // Start Audio Proctoring
      if (!audioProctorRef.current) {
        audioProctorRef.current = new AudioProctor("coding");

        audioProctorRef.current.onAudioEvent = (audioState) => {
          if (!isMountedRef.current || isFinishingRef.current) {
            return;
          }

          // --------------------------------------------
          // Debug
          // --------------------------------------------
          if (DEBUG_PROCTORING) {
            console.log("AUDIO EVENT (CODING):", {
              speechDetected: audioState.speechDetected,
              backgroundAudioDetected: audioState.backgroundAudioDetected,
              detectedCategories: audioState.detectedCategories
            });
          }

          // --------------------------------------------
          // Track violation
          // --------------------------------------------
          const result = violationTracker.trackAudio(
            "coding",
            audioState,
            false
          );

          // --------------------------------------------
          // Warning
          // --------------------------------------------
          if (result.warning) {
            let violationMsg;

            if (result.type === "speech") {
              violationMsg = "Suspicious audio (Speech) detected";
            } else {
              violationMsg = "Suspicious background audio (Media/Animal/Other) detected";
            }

            triggerCheatingWarning(violationMsg);
          }
        };
      }
      audioProctorRef.current.start(stream);

      const startNewRecorder = () => {
        if (!isMountedRef.current || isFinishingRef.current || !streamRef.current) return;
        try {
          const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
          mediaRecorderRef.current = recorder;

          recorder.ondataavailable = async (e) => {
            if (e.data && e.data.size > 0 && !isFinishingRef.current) {
              const currentSeq = videoSequenceNumberRef.current++;
              await uploadProctoringChunk(e.data, "video", currentSeq);
            }
          };

          recorder.start();
        } catch (err) {
          console.error("Failed to start video chunk recorder", err);
        }
      };

      startNewRecorder();

      videoIntervalRef.current = setInterval(() => {
        if (!isFinishingRef.current && mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
          startNewRecorder();
        }
      }, 15000);

      snapshotIntervalRef.current = setInterval(async () => {
        if (!isFinishingRef.current && userVideoRef.current) {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = 640;
            canvas.height = 480;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(userVideoRef.current, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(async (blob) => {
              if (blob) {
                const currentSeq = snapshotSequenceNumberRef.current++;
                await uploadProctoringChunk(blob, "snapshot", currentSeq);
              }
            }, "image/jpeg", 0.7);
          } catch (e) {
            console.error("Snapshot failed", e);
          }
        }
      }, 30000); // 30 seconds

    } catch (err) {
      console.error("Error accessing camera/mic:", err);
      setConsentError("Camera/Microphone access denied. Please allow permissions to start the interview.");
      setStatusAlert("Webcam/Mic access denied.");
    }
  }

  function stopCamera() {
    if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
    if (snapshotIntervalRef.current) clearInterval(snapshotIntervalRef.current);
    if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (userVideoRef.current) {
      userVideoRef.current.srcObject = null;
    }
    if (audioProctorRef.current) {
      audioProctorRef.current.stop();
      audioProctorRef.current = null;
    }
  }



  const proctoringStateRef = useRef({
    faceCount: 0,
    multiplePeopleCandidate: false,
    lookingAway: false,
    phoneDetected: false
  });

  useEffect(() => {
    if (!isCameraReady || !isMountedRef.current) return;

    const updateStatus = () => {
      const state = proctoringStateRef.current;
      let statusMessages = [];
      let cheatingTypes = [];

      // Face Checks
      if (state.multiplePeopleCandidate) {
        if (violationTracker.canTrigger('multiplePeople', true)) {
          cheatingTypes.push("Multiple people in camera frame");
        }
      } else if (state.faceCount === 0) {
        statusMessages.push("Face not detected! Please stay in frame");
        violationCounterRef.current.faceOut++;

        const requiredTicks = 20000 / PROCTORING_CONFIG.faceCheckInterval;
        if (violationCounterRef.current.faceOut >= requiredTicks) {
          if (violationTracker.canTrigger('faceOut', true)) {
            cheatingTypes.push("Prolonged face absence strike");
            violationTracker.canTrigger('faceOut', false);
          }
          violationCounterRef.current.faceOut = 0;
        }
      } else {
        violationCounterRef.current.faceOut = 0;
        violationTracker.canTrigger('faceOut', false);
        violationTracker.canTrigger('multiplePeople', false);
      }

      // Pose Check
      if (state.lookingAway) {
        if (violationTracker.canTrigger('lookingAway', true)) {
          cheatingTypes.push("Looking away");
        }
      } else {
        violationTracker.canTrigger('lookingAway', false);
      }

      // YOLO Checks
      if (state.phoneDetected) {
        if (violationTracker.canTrigger("phone", true)) {
          cheatingTypes.push("Device Usage: Mobile Phone");
        }
      } else {
        violationTracker.canTrigger("phone", false);
      }

      const finalStatus = statusMessages.length > 0 ? statusMessages.join(" | ") : "";

      if (statusAlertRef.current !== finalStatus) {
        statusAlertRef.current = finalStatus;
        setStatusAlert(finalStatus);
      }

      if (cheatingTypes.length > 0) {
        triggerCheatingWarning(cheatingTypes);
      }
    };

    const worker = new Worker(new URL("../../utils/proctoring/proctoring.worker.js", import.meta.url), {
      type: "module"
    });
    console.log("[PROCTOR] YOLO Worker created");

    let yoloWorkerReady = false;
    let workerBusy = false;
    let proctoringIntervalId;
    let cycleCount = 0;

    worker.onmessage = (e) => {
      const { type, phoneDetected, error, stack } = e.data;
      if (type === 'INIT_SUCCESS') {
        console.log("[PROCTOR] YOLO Worker initialized");
        yoloWorkerReady = true;
      } else if (type === 'INIT_ERROR') {
        console.error("YOLO Worker INIT ERROR:", error, stack);
        setStatusAlert(`Warning: Phone detection unavailable (${error})`);
      } else if (type === 'YOLO_RESULT') {
        workerBusy = false;
        proctoringStateRef.current.phoneDetected = phoneDetected;
      } else if (type === 'PROCESS_ERROR') {
        workerBusy = false;
        console.error("YOLO Worker PROCESS ERROR:", error);
      }
    };

    worker.onerror = (err) => {
      setStatusAlert(`Worker Global Error: ${err.message}`);
    };

    console.log("[PROCTOR] YOLO INIT sent");
    worker.postMessage({ type: 'INIT' });

    proctoringIntervalId = setInterval(async () => {
      if (!isMountedRef.current || !userVideoRef.current || userVideoRef.current.readyState < 2) return;

      cycleCount++;
      const now = performance.now();

      // 1. Face Analysis
      try {
        const faceResult = detectFaces(userVideoRef.current, now);
        proctoringStateRef.current.faceCount = faceResult.primaryFaceCount ?? 0;
        proctoringStateRef.current.multiplePeopleCandidate = faceResult.multiplePeopleCandidate ?? false;
      } catch (err) {
        console.error("Face Analysis Error:", err);
      }

      // 2. Pose Analysis (Staggered)
      if (cycleCount % 2 === 0) {
        try {
          const landmarks = detectFaceLandmarks(userVideoRef.current, now);
          proctoringStateRef.current.lookingAway = landmarks ? checkHeadPose(landmarks) : false;
        } catch (err) {
          console.error("Pose Analysis Error:", err);
        }
      }

      // 3. YOLO Analysis
      if (yoloWorkerReady && !workerBusy) {
        workerBusy = true;
        try {
          const bitmap = await createImageBitmap(userVideoRef.current);
          worker.postMessage({ type: 'PROCESS', bitmap, timestamp: now }, [bitmap]);
        } catch (err) {
          workerBusy = false;
          console.error("Frame capture error:", err);
        }
      }

      // Ensure React updates only if there's a real status change
      updateStatus();

    }, PROCTORING_CONFIG.faceCheckInterval || 350);

    return () => {
      if (proctoringIntervalId) clearInterval(proctoringIntervalId);
      worker.terminate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCameraReady]);

  const handleLanguageChange = (newLang) => {
    setSelectedLanguage(newLang);
    const langKey = getLanguageKey(newLang);
    if (submissions[activeQuestionIndex]?.[langKey] === undefined) {
      const template = currentQuestion?.codeTemplates?.[langKey] || "";
      setSubmissions((prev) => ({
        ...prev,
        [activeQuestionIndex]: {
          ...(prev[activeQuestionIndex] || {}),
          [langKey]: template
        }
      }));
    }
  };

  const handleCodeChange = (val) => {
    setSubmissions((prev) => ({
      ...prev,
      [activeQuestionIndex]: {
        ...(prev[activeQuestionIndex] || {}),
        [getLanguageKey(selectedLanguage)]: val
      }
    }));
  };

  const handleResetCode = () => {
    setShowResetConfirm(true);
  };

  const confirmResetCode = () => {
    const langKey = getLanguageKey(selectedLanguage);
    const template = currentQuestion?.codeTemplates?.[langKey] || currentQuestion?.codeTemplate || "";
    setSubmissions((prev) => ({
      ...prev,
      [activeQuestionIndex]: {
        ...(prev[activeQuestionIndex] || {}),
        [langKey]: template
      }
    }));
    setShowResetConfirm(false);
    setEditorSyncKey(k => k + 1);
  };

  const handleRunCode = async () => {
    if (runningCode) return;
    setRunningCode(true);
    setConsoleOutput("");
    setConsoleError("");
    setRunCodeResults(null);
    setSelectedConsoleTab("stdout");

    const lang = selectedLanguage;
    const langKey = getLanguageKey(lang);
    const codeToRun = submissions[activeQuestionIndex]?.[langKey] !== undefined
      ? submissions[activeQuestionIndex]?.[langKey]
      : currentQuestion?.codeTemplates?.[langKey] || "";
    let examples = [];
    if (currentQuestion?.examples && currentQuestion.examples.length > 0) {
      examples = currentQuestion.examples.map(ex => ({
        input: ex.input,
        expectedOutput: ex.output,
        isHidden: false
      }));
    } else {
      examples = currentQuestion?.testCases?.slice(0, 3) || [];
    }
    try {
      const response = await axios.post(
        ServerUrl + "/api/coding-interview/run",
        {
          code: codeToRun,
          language: lang,
          testCases: examples,
          question: currentQuestion
        },
        { withCredentials: true }
      );

      if (response.data.results) {
        setRunCodeResults(response.data.results);
        setConsoleError("");
        setConsoleOutput("");
        setSelectedConsoleTab("stdout");
      }
    } catch (error) {
      console.error(error);
      setConsoleError("Sandbox run failed. Try again.");
      setRunCodeResults(null);
    } finally {
      setRunningCode(false);
    }
  };

  const handleRunTestCases = async () => {
    if (runningTestCases) return;
    setRunningTestCases(true);
    setSelectedConsoleTab("results");
    setTestCaseResults([]);

    const lang = selectedLanguage;
    const langKey = getLanguageKey(lang);
    const codeToRun = submissions[activeQuestionIndex]?.[langKey] !== undefined
      ? submissions[activeQuestionIndex]?.[langKey]
      : currentQuestion?.codeTemplates?.[langKey] || "";

    try {
      const response = await axios.post(
        ServerUrl + "/api/coding-interview/submit-question",
        {
          interviewId: id,
          questionIndex: activeQuestionIndex,
          code: codeToRun,
          language: lang,
          proctoringLogs: proctoringLogsRef.current,
          totalDetections: proctoringLogsRef.current.length
        },
        { withCredentials: true }
      );

      setTestCaseResults(response.data.results || []);
      setIsSubmissionResult(true);

      // Update local interview data state so evaluation metrics are preserved
      setInterviewData(prev => {
        if (!prev) return prev;
        const newQuestions = [...prev.questions];
        newQuestions[activeQuestionIndex] = response.data.question;
        return { ...prev, questions: newQuestions };
      });

    } catch (error) {
      console.error(error);
      const errMsg = error.response?.data?.message || "Failed to submit and evaluate code.";
      setConsoleError(errMsg);
      setTestCaseResults([{
        input: "N/A",
        expected: "N/A",
        got: "ERROR",
        stderr: errMsg,
        passed: false,
        isHidden: false
      }]);
    } finally {
      setRunningTestCases(false);
    }
  };

  const executeFinalSubmit = async () => {
    isFinishingRef.current = true;
    setSubmittingRound(true);
    stopCamera();

    try {
      const response = await axios.post(
        ServerUrl + "/api/coding-interview/submit",
        {
          interviewId: id,
          submissions: Object.keys(submissions).map((key) => {
            const idx = parseInt(key);
            const q = interviewData?.questions?.[idx];
            const langKey = getLanguageKey(selectedLanguage);
            const qCode = submissions[idx]?.[langKey] !== undefined
              ? submissions[idx]?.[langKey]
              : (q?.codeTemplates?.[langKey] || q?.codeTemplate || "");
            return {
              questionIndex: idx,
              code: qCode,
              language: selectedLanguage
            };
          }),
          proctoringLogs: proctoringLogsRef.current,
          totalDetections: proctoringLogsRef.current.length
        },
        { withCredentials: true }
      );

      if (document.fullscreenElement) {
        document.exitFullscreen().catch((err) => console.error(err));
      }

      navigate(`/coding-interview/report/${response.data.interviewId}`, { replace: true });
    } catch (error) {
      console.error(error);
      setSubmitError("Failed to submit solution round. Please try again.");
      setTimeout(() => setSubmitError(""), 5000);
      setSubmittingRound(false);
    }
  };

  const handleSubmit = async () => {
    if (submittingRound) return;
    await executeFinalSubmit();
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const editorRef = useRef(null);
  const [editorSyncKey, setEditorSyncKey] = useState(0);

  useEffect(() => {
    if (editorRef.current && currentQuestion) {
      const langKey = getLanguageKey(selectedLanguage);
      const currentCode = submissions[activeQuestionIndex]?.[langKey] !== undefined
        ? submissions[activeQuestionIndex]?.[langKey]
        : currentQuestion?.codeTemplates?.[langKey] || currentQuestion?.codeTemplate || "";

      // Only set if different to avoid cursor jumps
      if (editorRef.current.getValue() !== currentCode) {
        editorRef.current.setValue(currentCode);
      }
    }
  }, [activeQuestionIndex, selectedLanguage, editorSyncKey, currentQuestion]);

  if (loadingInterview) {
    return (
      <div className="min-h-screen bg-[#050b14] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-[#00d26a] w-10 h-10 mx-auto mb-4" />
          <p className="text-gray-400 font-semibold text-sm">Loading your premium coding round...</p>
        </div>
      </div>
    );
  }

  if (!hasGivenConsent) {
    const isBypassed = localStorage.getItem("bypassProctoring") === "true" || new URLSearchParams(window.location.search).get("bypassProctoring") === "true";
    if (isBypassed) {
      setHasGivenConsent(true);
    } else {
      return (
        <div className="min-h-screen bg-[#050b14] flex items-center justify-center p-6 font-sans">
          <div className="max-w-2xl bg-[#0b1220] border border-[rgba(255,255,255,0.06)] rounded-2xl p-8 shadow-2xl">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[#00d26a]/10 mb-6 mx-auto">
              <ShieldAlert className="text-[#00d26a] w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4 text-center">Proctoring Permissions Required</h2>

            <div className="space-y-4 text-gray-300 mb-8">
              <p>To maintain interview integrity, this coding assessment is proctored. Please note the following:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Audio & Video Recording:</strong> Your camera and microphone will continuously record the session in segments.</li>
                <li><strong>Periodic Snapshots:</strong> Snapshots will be captured periodically during the session.</li>
                <li><strong>Smart Proctoring Detections:</strong> The system monitors tab switches, multiple faces, mobile phones, and forbidden shortcuts.</li>
                <li><strong>Privacy & Permission:</strong> All data is securely associated only with this interview. The session cannot proceed if you deny permissions.</li>
              </ul>
            </div>

            {consentError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm">{consentError}</p>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => {
                  if (document.fullscreenElement) {
                    document.exitFullscreen().catch(err => console.error("Error exiting fullscreen:", err));
                  }
                  navigate("/coding-interview", { replace: true });
                }}
                className="flex-1 px-6 py-3 bg-transparent border border-gray-600 text-gray-300 rounded-xl hover:bg-gray-800 transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => setHasGivenConsent(true)}
                className="flex-1 px-6 py-3 bg-[#00d26a] text-[#050b14] rounded-xl hover:bg-[#00b35a] transition-colors font-semibold flex items-center justify-center gap-2"
              >
                Accept & Start Assessment
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  const getMonacoLang = (lang) => {
    const low = lang.toLowerCase();
    if (low.includes("python")) return "python";
    if (low.includes("javascript")) return "javascript";
    if (low.includes("java")) return "java";
    if (low.includes("c++")) return "cpp";
    if (low.includes("c")) return "c";
    return "python";
  };

  const passedCasesCount = testCaseResults.filter((r) => r.passed).length;
  const totalCasesCount = currentQuestion?.testCases?.length || 0;

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
  };

  return (
    <div className="h-screen bg-[#050b14] text-white flex flex-col overflow-hidden font-sans select-none">

      <header className="h-16 bg-[#0b1220] border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between px-6 z-10">

        <div className="flex items-center gap-3">
          <div className="bg-[#00d26a]/10 border border-[#00d26a]/20 p-2 rounded-xl text-[#00d26a]">
            <ConsoleIcon size={18} />
          </div>
          <div>
            <span className="font-extrabold text-sm tracking-tight text-white block">HireMind Coding</span>
            <span className="text-[10px] text-[#94a3b8] font-semibold uppercase tracking-wider block mt-0.5">
              {interviewData?.company} • {interviewData?.difficulty} Round
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-[#050b14] border border-[rgba(255,255,255,0.06)] p-1 rounded-full">
          {interviewData?.questions?.map((q, idx) => (
            <button
              key={idx}
              onClick={() => {
                setActiveQuestionIndex(idx);
                setTestCaseResults([]);
                setConsoleOutput("");
                setConsoleError("");
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase transition duration-150 ${activeQuestionIndex === idx
                ? "bg-[#0b1220] text-[#00d26a] border border-[#00d26a]/20 shadow-md"
                : "bg-transparent text-[#94a3b8] border border-transparent hover:text-white"
                }`}
            >
              Q{idx + 1}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0b1220] border border-[rgba(255,255,255,0.06)] text-[#94a3b8] text-xs font-bold font-mono">
            <TimerIcon size={14} className="text-[#00d26a]" />
            {formatTime(timeLeft)}
          </div>

          {submitError && (
            <span className="text-red-400 text-[10px] md:text-xs font-bold mr-2 animate-pulse">
              {submitError}
            </span>
          )}

          <button
            onClick={() => handleSubmit(false)}
            disabled={submittingRound}
            className="px-5 py-2.5 rounded-full bg-[#00d26a] hover:bg-[#00b25a] text-black font-extrabold text-xs tracking-wider uppercase transition shadow-[0_4px_14px_0_rgba(0,210,106,0.3)] flex items-center gap-1.5 disabled:opacity-50"
          >
            {submittingRound ? <Loader2 size={12} className="animate-spin text-black" /> : <Send size={12} />}
            Submit Round
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row relative min-h-0">
        {isMountedState ? (
          <>
            <div className="w-full md:w-[40%] flex flex-col h-full bg-[#050b14] overflow-y-auto border-r border-[rgba(255,255,255,0.06)] p-6 pb-72 space-y-6 relative">

              <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-4">
                <span className="inline-block px-3 py-1 bg-[#00d26a]/10 border border-[#00d26a]/20 text-[#00d26a] rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                  Problem Statement
                </span>

                {currentQuestion?.expectedComplexity && (
                  <span className="text-[10px] font-mono text-[#94a3b8] uppercase tracking-wider">
                    Complexity: {currentQuestion.expectedComplexity.replace("Time: ", "Time ").replace("Space: ", "Space ")}
                  </span>
                )}
              </div>

              <h2 className="text-2xl font-bold text-white tracking-tight leading-tight">
                {currentQuestion?.title}
              </h2>

              <div className="text-sm text-[#94a3b8] leading-relaxed whitespace-pre-line">
                {currentQuestion?.problemStatement}
              </div>

              {currentQuestion?.constraints && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-[#94a3b8] uppercase tracking-wider">Constraints</h4>
                  <div className="bg-[#0b1220] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 text-xs font-mono text-gray-300 whitespace-pre-line leading-relaxed shadow-sm">
                    {currentQuestion.constraints}
                  </div>
                </div>
              )}

              {currentQuestion?.examples && currentQuestion.examples.length > 0 && (
                <div className="space-y-4">
                  {currentQuestion.examples.map((ex, index) => (
                    <div key={index} className="space-y-3 bg-[#0b1220] border border-[rgba(255,255,255,0.05)] rounded-2xl p-4 shadow-sm">
                      <div className="text-xs font-extrabold text-[#00d26a] uppercase tracking-wider">
                        Example {index + 1}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block">Input</span>
                          <pre className="bg-[#050b14] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-xs font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap min-h-[50px] flex items-center">
                            {ex.input}
                          </pre>
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block">Output</span>
                          <pre className="bg-[#050b14] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-xs font-mono text-[#00d26a] overflow-x-auto whitespace-pre-wrap min-h-[50px] flex items-center">
                            {ex.output}
                          </pre>
                        </div>
                      </div>
                      {ex.explanation && (
                        <div className="mt-3 space-y-1.5 pt-3 border-t border-[rgba(255,255,255,0.05)]">
                          <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block">Explanation</span>
                          <div className="text-xs text-gray-400 whitespace-pre-wrap leading-relaxed">
                            {ex.explanation}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="w-full md:w-[60%] flex flex-col h-full overflow-hidden">

              <div className="h-[70%] flex flex-col bg-[#050b14] overflow-hidden border-b border-[rgba(255,255,255,0.06)]">

                <div className="h-12 border-b border-[rgba(255,255,255,0.06)] bg-[#0b1220] px-6 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <select
                      value={selectedLanguage}
                      onChange={(e) => handleLanguageChange(e.target.value)}
                      className="bg-[#050b14] border border-[rgba(255,255,255,0.06)] text-[10px] font-semibold text-[#00d26a] rounded px-2.5 py-1 outline-none uppercase font-mono cursor-pointer"
                    >
                      <option value="C++">C++</option>
                      <option value="Java">Java</option>
                      <option value="Python">Python</option>
                      <option value="JavaScript">JavaScript</option>
                      <option value="C">C</option>
                    </select>

                    <button
                      onClick={handleResetCode}
                      className="flex items-center gap-1.5 bg-[#050b14] border border-[rgba(255,255,255,0.06)] text-[10px] font-semibold text-gray-300 hover:text-white rounded px-2.5 py-1 outline-none uppercase font-mono cursor-pointer transition-colors"
                      title="Reset to initial code template"
                    >
                      <RotateCcw size={12} className="text-[#00d26a]" />
                      <span className="hidden sm:inline">Reset</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-4 text-[10px] text-[#94a3b8]">
                    <div className="flex items-center gap-2">
                      <select
                        value={fontSize}
                        onChange={(e) => setFontSize(parseInt(e.target.value))}
                        className="bg-[#050b14] border border-[rgba(255,255,255,0.06)] text-[10px] text-gray-300 rounded px-2 py-1 outline-none"
                      >
                        <option value={10}>10px</option>
                        <option value={12}>12px</option>
                        <option value={14}>14px</option>
                        <option value={16}>16px</option>
                        <option value={18}>18px</option>

                      </select>

                      <select
                        value={editorTheme}
                        onChange={(e) => setEditorTheme(e.target.value)}
                        className="bg-[#050b14] border border-[rgba(255,255,255,0.06)] text-[10px] text-gray-300 rounded px-2 py-1 outline-none ml-2"
                      >
                        <option value="hiremind-dark">Dark Theme</option>
                        <option value="vs-dark">Classic Dark</option>
                        <option value="light">Light Editor</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex-1 bg-[#050b14]">
                  <Editor
                    height="100%"
                    language={getMonacoLang(selectedLanguage)}
                    theme={editorTheme}
                    beforeMount={handleEditorBeforeMount}
                    onMount={handleEditorDidMount}
                    defaultValue={
                      submissions[activeQuestionIndex]?.[getLanguageKey(selectedLanguage)] !== undefined
                        ? submissions[activeQuestionIndex]?.[getLanguageKey(selectedLanguage)]
                        : currentQuestion?.codeTemplates?.[getLanguageKey(selectedLanguage)] || ""
                    }
                    onChange={handleCodeChange}
                    options={{
                      fontSize: fontSize,
                      minimap: { enabled: false },
                      lineNumbers: "on",
                      autoClosingBrackets: "always",
                      fontFamily: "Fira Code, Source Code Pro, monospace",
                      cursorBlinking: "smooth",
                      automaticLayout: true,
                      padding: { top: 12, bottom: 12 },
                      quickSuggestions: true,
                      suggestOnTriggerCharacters: true,
                      wordBasedSuggestions: "currentDocument",
                      acceptSuggestionOnEnter: "on",
                      tabCompletion: "on"
                    }}
                  />
                </div>
              </div>

              <div className="h-[30%] flex flex-col bg-[#0b1220] z-10 overflow-hidden">

                <div className="h-12 border-b border-[rgba(255,255,255,0.06)] bg-[#050b14] flex items-center justify-between px-6">
                  <div className="flex gap-4">
                    <button
                      onClick={() => setSelectedConsoleTab("stdout")}
                      className={`pb-4 pt-4 text-[10px] font-extrabold uppercase tracking-wider border-b-2 transition ${selectedConsoleTab === "stdout" ? "border-[#00d26a] text-[#00d26a]" : "border-transparent text-[#94a3b8] hover:text-white"
                        }`}
                    >
                      STDOUT CONSOLE
                    </button>
                    <button
                      onClick={() => {
                        setSelectedConsoleTab("results");
                      }}
                      className={`pb-4 pt-4 text-[10px] font-extrabold uppercase tracking-wider border-b-2 transition ${selectedConsoleTab === "results" ? "border-[#00d26a] text-[#00d26a]" : "border-transparent text-[#94a3b8] hover:text-white"
                        }`}
                    >
                      TEST RESULTS ({testCaseResults.length > 0 ? passedCasesCount : 0}/{totalCasesCount})
                    </button>
                  </div>

                  <div className="flex gap-2.5">
                    <button
                      onClick={handleRunCode}
                      disabled={runningCode}
                      className="px-5 py-2 rounded-full border border-[rgba(255,255,255,0.08)] bg-transparent hover:bg-white/5 text-[10px] font-extrabold text-white uppercase tracking-wider transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {runningCode ? <Loader2 size={10} className="animate-spin text-[#00d26a]" /> : <Play size={10} />}
                      RUN CODE
                    </button>

                    <button
                      onClick={handleRunTestCases}
                      disabled={runningTestCases}
                      className="px-5 py-2 rounded-full bg-[#00d26a] hover:bg-[#00b25a] text-black font-extrabold text-[10px] uppercase tracking-wider transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {runningTestCases ? <Loader2 size={10} className="animate-spin text-black" /> : <CheckCircle2 size={10} />}
                      SUBMIT CODE
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 bg-[#050b14] font-mono text-xs text-gray-300">
                  {selectedConsoleTab === "stdout" ? (
                    <div className="h-full flex flex-col">
                      <div className="flex-1 overflow-y-auto">
                        {runCodeResults ? (
                          <div className="space-y-4">
                            {runCodeResults.map((res, i) => (
                              <div key={i} className="bg-[#0b1220] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-[#00d26a] uppercase tracking-wider">EXAMPLE {i + 1}</span>
                                  {res.passed ? (
                                    <span className="flex items-center gap-1 text-[11px] font-bold text-[#00d26a]"><CheckCircle2 size={14} /> PASSED</span>
                                  ) : (
                                    <span className="flex items-center gap-1 text-[11px] font-bold text-red-400"><XCircle size={14} /> FAILED</span>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="bg-black/40 p-3 rounded-lg border border-white/5 space-y-1.5">
                                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Input</div>
                                    <div className="text-gray-300 font-mono text-xs">{res.input}</div>
                                  </div>
                                  <div className="bg-black/40 p-3 rounded-lg border border-white/5 space-y-1.5">
                                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Output</div>
                                    <div className="text-gray-300 font-mono text-xs">{res.got || "None"}</div>
                                  </div>
                                </div>
                                <div className="bg-black/40 p-3 rounded-lg border border-white/5 space-y-1.5">
                                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Expected</div>
                                  <div className="text-gray-300 font-mono text-xs">{res.expected}</div>
                                </div>
                                {res.stderr && (
                                  <div className="bg-red-950/20 text-red-400 p-3 rounded-lg border border-red-900/30 text-xs font-mono whitespace-pre-wrap">
                                    {res.stderr}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>
                            {consoleError && (
                              <pre className="text-red-400 bg-red-950/10 border border-red-950/20 p-3 rounded-xl whitespace-pre-wrap leading-relaxed">
                                Error:
                                {consoleError}
                              </pre>
                            )}
                            {consoleOutput && (
                              <pre className="text-[#00d26a] bg-[#00d26a]/5 border border-[#00d26a]/10 p-3 rounded-xl whitespace-pre-wrap leading-relaxed">
                                {consoleOutput}
                              </pre>
                            )}
                            {!consoleOutput && !consoleError && (
                              <span className="text-gray-500 italic text-[11px]">No terminal execution logs found. Click 'Run Code'.</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col space-y-3">
                      {runningTestCases ? (
                        <div className="flex items-center gap-2 text-[#94a3b8] italic">
                          <Loader2 size={14} className="animate-spin text-[#00d26a]" />
                          Evaluating your solution... Running test cases.
                        </div>
                      ) : testCaseResults.length > 0 ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-[rgba(255,255,255,0.04)]">
                            <span className="font-bold text-sm">
                              Passed {passedCasesCount} out of {totalCasesCount} cases
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${passedCasesCount === totalCasesCount ? "bg-[#00d26a]/10 text-[#00d26a]" : "bg-red-950/20 text-red-400"
                              }`}>
                              {passedCasesCount === totalCasesCount ? "ALL PASSED" : "FAILED CASES"}
                            </span>
                          </div>

                          <div className="space-y-2">
                            {testCaseResults.map((tc, idx) => (
                              <div key={idx} className="bg-[#0b1220] border border-[rgba(255,255,255,0.06)] rounded-xl p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[10px] font-bold text-[#94a3b8]">TESTCASE {idx + 1}</span>
                                  {tc.passed ? (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-[#00d26a]">
                                      <CheckCircle2 size={12} /> PASSED
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-red-400">
                                      <XCircle size={12} /> FAILED
                                    </span>
                                  )}
                                </div>
                                {!isSubmissionResult && (
                                  <div className="text-[10px] space-y-1 font-mono text-gray-400">
                                    <div><span className="text-gray-600">Input:</span> {tc.input}</div>
                                    <div><span className="text-gray-600">Expected:</span> {tc.expected}</div>
                                    <div><span className="text-gray-600">Output:</span> {tc.got || "None"}</div>
                                    {tc.stderr && <div className="text-red-400 font-bold mt-1 bg-red-950/10 p-1.5 rounded">{tc.stderr}</div>}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-500 italic text-[11px]">No test results available. Click 'Submit Code' to grade.</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={`absolute bottom-6 left-6 z-20 transition-all duration-300 bg-[#0b1220]/90 backdrop-blur-md border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden shadow-2xl p-1.5 flex flex-col gap-1.5 ${statusAlert ? "w-72" : "w-44"}`}>
              <div className="relative aspect-video rounded-xl bg-black overflow-hidden flex items-center justify-center border border-[rgba(255,255,255,0.06)]">
                <video
                  ref={userVideoRef}
                  autoPlay
                  muted
                  width="320"
                  height="240"
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                {statusAlert && (
                  <div className="absolute inset-0 bg-red-950/80 text-red-300 p-2 flex items-center justify-center text-[10px] text-center font-bold">
                    {statusAlert}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between text-[7px] text-[#94a3b8] font-bold px-1 uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  MONITORING ACTIVE...
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#050b14] flex-1">
            <Loader2 className="animate-spin text-[#00d26a]" size={32} />
          </div>
        )}
      </div>



      {showResetConfirm && (
        <div className="fixed inset-0 z-[99999] bg-[#050b14]/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-[#0b1220] border border-[rgba(255,255,255,0.08)] rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl space-y-6">
            <div className="w-16 h-16 rounded-full bg-orange-950/20 border border-orange-900/40 text-orange-400 flex items-center justify-center mx-auto">
              <RotateCcw size={28} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-white">Reset Code?</h3>
              <p className="text-sm text-[#94a3b8] leading-relaxed">
                Are you sure you want to reset to the default template? Your current code will be lost.
              </p>
            </div>
            <div className="flex gap-4 mt-4">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="w-1/2 py-3 rounded-full bg-transparent border border-[rgba(255,255,255,0.1)] text-white hover:bg-white/5 font-extrabold text-xs tracking-wider uppercase transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmResetCode}
                className="w-1/2 py-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs tracking-wider uppercase transition shadow-[0_4px_14px_0_rgba(249,115,22,0.3)] cursor-pointer"
              >
                Yes, Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {!isFullscreen && (
        <div className="fixed inset-0 z-[99999] bg-[#050b14]/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-[#0b1220] border border-[rgba(255,255,255,0.08)] rounded-3xl p-8 max-w-md w-full text-center shadow-2xl space-y-6">
            <div className="w-16 h-16 rounded-full bg-red-950/20 border border-red-900/40 text-red-400 flex items-center justify-center mx-auto animate-pulse">
              <ShieldAlert size={28} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-white">Fullscreen Mode Exited</h3>
              <p className="text-sm text-[#94a3b8] leading-relaxed">
                This DSA assessment requires fullscreen mode to maintain test integrity. Please click below to resume fullscreen and continue.
              </p>
            </div>
            <button
              onClick={startAssessmentSession}
              className="w-full py-3 rounded-full bg-[#00d26a] hover:bg-[#00b25a] text-black font-extrabold text-xs tracking-wider uppercase transition shadow-[0_4px_14px_0_rgba(0,210,106,0.3)] cursor-pointer"
            >
              Resume Full Screen
            </button>
          </div>
        </div>
      )}

      {cheatingAlert && cheatingAlert.message && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 px-8 py-3 rounded-2xl shadow-2xl font-bold flex items-center gap-3 border animate-bounce z-[9999] ${cheatingAlert.type === 'warning' ? 'bg-orange-500 text-white border-orange-400' : 'bg-red-600 text-white border-red-500'
          }`}>
          <ShieldAlert size={18} />
          {cheatingAlert.message}
        </div>
      )}
    </div>
  );
}

export default CodingInterview;
