import { PROCTORING_CONFIG } from './config';

export function checkHeadPose(faceLandmarkerResult) {
  if (!faceLandmarkerResult || !faceLandmarkerResult.facialTransformationMatrixes || faceLandmarkerResult.facialTransformationMatrixes.length === 0) {
    return false;
  }

  const matrix = faceLandmarkerResult.facialTransformationMatrixes[0].data;
  // Column-major order extraction
  const r11 = matrix[0], r21 = matrix[1], r31 = matrix[2];
  const r12 = matrix[4], r22 = matrix[5], r32 = matrix[6];
  const r13 = matrix[8], r23 = matrix[9], r33 = matrix[10];

  let sy = Math.sqrt(r11 * r11 + r21 * r21);
  let singular = sy < 1e-6;

  let x, y;
  if (!singular) {
    x = Math.atan2(r32, r33); // pitch
    y = Math.atan2(-r31, sy); // yaw
  } else {
    x = Math.atan2(-r23, r22);
    y = Math.atan2(-r31, sy);
  }

  let yaw = y * (180 / Math.PI);
  let pitch = x * (180 / Math.PI);

  if (Math.abs(yaw) > PROCTORING_CONFIG.horizontalLookAwayDeg) return true;
  if (Math.abs(pitch) > PROCTORING_CONFIG.verticalLookAwayDeg) return true;

  return false;
}
