import CodingInterview from "../models/codingInterview.model.js";

import Interview from "../models/dynamicInterview.model.js";

export const uploadProctoringChunk = async (req, res) => {
  try {
    const { interviewId, interviewType, chunkType, sequenceNumber, totalDetections, proctoringLogs } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    if (!interviewId || !interviewType || !chunkType) {
      return res.status(400).json({ message: "Missing required metadata" });
    }

    let Model;
    if (interviewType === "coding") Model = CodingInterview;
    else if (interviewType === "dynamic-mock") Model = Interview;
    else return res.status(400).json({ message: "Invalid interview type" });

    const interview = await Model.findById(interviewId);

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    // Convert local public path to URL accessible path (handle Windows backslashes)
    const relativePath = file.path.replace(/\\/g, "/");
    const fileUrl = `${process.env.SERVER_URL || 'http://localhost:8000'}/${relativePath}`;
    
    // Idempotency check: see if chunk with same sequenceNumber and type already exists
    let existingChunk = null;
    
    if (chunkType === "video") {
      existingChunk = interview.recordings?.videoChunks?.find(c => c.sequenceNumber === parseInt(sequenceNumber));
    } else if (chunkType === "snapshot") {
      existingChunk = interview.recordings?.snapshots?.find(c => c.sequenceNumber === parseInt(sequenceNumber));
    }

    if (!existingChunk) {
      if (chunkType === "video") {
        if (!interview.recordings) interview.recordings = {};
        if (!interview.recordings.videoChunks) interview.recordings.videoChunks = [];
        interview.recordings.videoChunks.push({ url: fileUrl, sequenceNumber: parseInt(sequenceNumber) });
      } else if (chunkType === "snapshot") {
        if (!interview.recordings) interview.recordings = {};
        if (!interview.recordings.snapshots) interview.recordings.snapshots = [];
        interview.recordings.snapshots.push({ url: fileUrl, sequenceNumber: parseInt(sequenceNumber) });
      }
    }
    
    // Sync detections if provided
    if (totalDetections !== undefined) {
      interview.totalDetections = parseInt(totalDetections);
    }
    if (proctoringLogs) {
      try {
        const parsedLogs = JSON.parse(proctoringLogs);
        if (Array.isArray(parsedLogs)) {
          interview.proctoringLogs = parsedLogs;
        }
      } catch (e) {
        console.error("Failed to parse proctoring logs:", e);
      }
    }
    
    await Model.updateOne(
      { _id: interview._id },
      {
        $set: {
          recordings: interview.recordings,
          totalDetections: interview.totalDetections,
          proctoringLogs: interview.proctoringLogs
        }
      }
    );
    return res.status(200).json({ message: "Chunk uploaded successfully", url: fileUrl });
  } catch (error) {
    console.error("Upload chunk error:", error);
    return res.status(500).json({ message: "Failed to upload chunk", error: error.message });
  }
};
