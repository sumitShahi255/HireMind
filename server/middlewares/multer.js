import multer from "multer";
import fs from "fs";
import path from "path";

const storage = multer.diskStorage({
      destination: function (req, file, cb) {
            let destFolder = "public";
            
            // If it's a chunk upload, organize into subfolders
            if (req.body.interviewType && req.body.interviewId) {
                  const typeFolder = req.body.interviewType === "coding" ? "coding_interview" : "mock_interview";
                  const mediaFolder = req.body.chunkType || "media";
                  
                  // e.g. public/coding_interview/12345/video
                  destFolder = path.join("public", typeFolder, req.body.interviewId, mediaFolder);
            }

            // Create directories recursively if they don't exist
            if (!fs.existsSync(destFolder)) {
                  fs.mkdirSync(destFolder, { recursive: true });
            }

            cb(null, destFolder);
      },
      filename: function (req, file, cb) {
            const filename = Date.now() + "-" + file.originalname;
            cb(null, filename);
      }
});

export const upload = multer({
      storage,
      limits: { fileSize: 5 * 1024 * 1024 },
});