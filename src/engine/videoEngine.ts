import type { VideoOverlayKeyframe } from '../types/editor';

export function clampTrimRange(
  trimStart: number,
  trimEnd: number,
  duration: number,
): { trimStart: number; trimEnd: number } {
  const safeDur = Math.max(0.2, duration || 0.2);
  const start = Math.max(0, Math.min(safeDur - 0.1, trimStart));
  const end = Math.max(start + 0.1, Math.min(safeDur, trimEnd));
  return {
    trimStart: Number(start.toFixed(2)),
    trimEnd: Number(end.toFixed(2)),
  };
}

export function computeEffectiveDuration(
  trimStart: number,
  trimEnd: number,
  speed: number,
): number {
  const span = Math.max(0.1, trimEnd - trimStart);
  const spd = Math.max(0.25, Math.min(4, speed || 1));
  return span / spd;
}

export function mapPlaybackToSourceTime(
  elapsedOutputSec: number,
  trimStart: number,
  trimEnd: number,
  speed: number,
  reversed: boolean,
  loop: boolean,
): number {
  const outDur = computeEffectiveDuration(trimStart, trimEnd, speed);
  const span = Math.max(0.1, trimEnd - trimStart);
  const localOut = loop
    ? ((elapsedOutputSec % outDur) + outDur) % outDur
    : Math.max(0, Math.min(outDur, elapsedOutputSec));
  const frac = Math.max(0, Math.min(1, localOut / outDur));
  const srcPos = reversed ? trimEnd - frac * span : trimStart + frac * span;
  return Math.max(trimStart, Math.min(trimEnd, srcPos));
}

export interface KeyframeRenderState {
  visible: boolean;
  opacity: number;
  offsetY: number;
  scale: number;
  rotationDeg: number;
  displayText: string;
}

export function computeKeyframeOverlayState(
  item: VideoOverlayKeyframe,
  timeSec: number,
  canvasHeight: number,
): KeyframeRenderState {
  if (timeSec < item.startTime || timeSec > item.endTime) {
    return {
      visible: false,
      opacity: 0,
      offsetY: 0,
      scale: 1,
      rotationDeg: 0,
      displayText: item.text,
    };
  }

  const clipSpan = Math.max(0.15, item.endTime - item.startTime);
  const localT = timeSec - item.startTime;
  const enterT = Math.min(1, localT / Math.min(0.45, clipSpan * 0.45));
  const exitRemaining = item.endTime - timeSec;
  const exitFade = Math.min(1, exitRemaining / Math.min(0.25, clipSpan * 0.25));

  let opacity = exitFade;
  let offsetY = 0;
  let scale = 1;
  let rotationDeg = 0;
  let displayText = item.text;

  switch (item.animation) {
    case 'fade':
      opacity = Math.min(enterT, exitFade);
      break;
    case 'slide-up':
      opacity = Math.min(enterT, exitFade);
      offsetY = (1 - Math.pow(enterT, 0.55)) * canvasHeight * 0.08;
      break;
    case 'pop':
      opacity = exitFade;
      scale = enterT < 0.7 ? 0.4 + (enterT / 0.7) * 0.75 : 1.15 - ((enterT - 0.7) / 0.3) * 0.15;
      break;
    case 'bounce':
      opacity = exitFade;
      offsetY = -Math.abs(Math.sin(localT * Math.PI * 2.2)) * canvasHeight * 0.03;
      break;
    case 'pulse':
      opacity = exitFade;
      scale = 1 + Math.sin(localT * Math.PI * 3) * 0.1;
      break;
    case 'spin':
      opacity = exitFade;
      rotationDeg = (localT * 120) % 360;
      break;
    case 'typewriter': {
      opacity = exitFade;
      const chars = Math.max(1, Math.round(item.text.length * Math.min(1, localT / Math.max(0.3, clipSpan * 0.65))));
      displayText = item.text.slice(0, chars);
      break;
    }
    case 'none':
    default:
      break;
  }

  return {
    visible: true,
    opacity: Math.max(0, Math.min(1, opacity)),
    offsetY,
    scale,
    rotationDeg,
    displayText,
  };
}

export function pickSupportedVideoMimeType(
  preferred: 'mp4' | 'webm',
  isSupportedFn?: (mime: string) => boolean,
): { mimeType: string; actualExt: 'mp4' | 'webm' } {
  const checker =
    isSupportedFn ??
    ((mime: string) =>
      typeof MediaRecorder !== 'undefined' &&
      typeof MediaRecorder.isTypeSupported === 'function' &&
      MediaRecorder.isTypeSupported(mime));

  const mp4Candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=h264',
    'video/mp4',
  ];
  const webmCandidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm',
  ];

  if (preferred === 'mp4') {
    for (const m of mp4Candidates) {
      if (checker(m)) return { mimeType: m, actualExt: 'mp4' };
    }
  }
  for (const m of webmCandidates) {
    if (checker(m)) return { mimeType: m, actualExt: 'webm' };
  }
  return { mimeType: 'video/webm', actualExt: 'webm' };
}
