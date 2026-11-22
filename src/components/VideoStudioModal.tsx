import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Download,
  Film,
  Music,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  EditLayer,
  OverlayEffectItem,
  OverlayEffectKind,
  VideoAudioConfig,
  VideoOverlayKeyframe,
} from '../types/editor';
import { applyFilterPresetPixel, getAllFilterPresets } from '../engine/filters';
import {
  applyOverlayEffectToPixels,
  createOverlayEffectItem,
  OVERLAY_EFFECT_CATALOG,
} from '../engine/overlayEffects';
import {
  clampTrimRange,
  computeEffectiveDuration,
  computeKeyframeOverlayState,
  mapPlaybackToSourceTime,
  pickSupportedVideoMimeType,
} from '../engine/videoEngine';
import { triggerDownload } from '../engine/exportUtils';
import { uid } from '../engine/stackReducer';

interface VideoStudioModalProps {
  initialLayers: EditLayer[];
  onClose: () => void;
}

const DEMO_DURATION_SEC = 4.0;

function drawProceduralDemoFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tSec: number,
) {
  const phase = (tSec / DEMO_DURATION_SEC) * Math.PI * 2;
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, `hsl(${215 + Math.sin(phase) * 20}, 42%, 14%)`);
  grad.addColorStop(0.52, `hsl(${26 + Math.cos(phase) * 16}, 62%, 34%)`);
  grad.addColorStop(1, `hsl(${325 + Math.sin(phase) * 18}, 48%, 16%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Moving sun / moon orb
  const orbX = w * (0.28 + 0.44 * (0.5 + 0.5 * Math.sin(phase)));
  const orbY = h * (0.36 - 0.1 * Math.cos(phase));
  const orbGrad = ctx.createRadialGradient(orbX, orbY, 4, orbX, orbY, Math.min(w, h) * 0.24);
  orbGrad.addColorStop(0, '#FEF3C7');
  orbGrad.addColorStop(0.35, 'rgba(245, 158, 11, 0.72)');
  orbGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
  ctx.fillStyle = orbGrad;
  ctx.beginPath();
  ctx.arc(orbX, orbY, Math.min(w, h) * 0.24, 0, Math.PI * 2);
  ctx.fill();

  // Animated water horizon ripples
  ctx.fillStyle = 'rgba(10, 12, 18, 0.52)';
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  for (let i = 0; i < 9; i++) {
    const ry = h * (0.65 + i * 0.036);
    const rx = w * (0.5 + Math.sin(phase + i * 0.9) * 0.14);
    const rw = w * (0.22 - i * 0.015);
    ctx.fillStyle = `rgba(253, 224, 171, ${0.28 - i * 0.024})`;
    ctx.fillRect(rx - rw / 2, ry, rw, 2.5);
  }
}

export const VideoStudioModal: React.FC<VideoStudioModalProps> = ({
  initialLayers,
  onClose,
}) => {
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [clipMode, setClipMode] = useState<'none' | 'demo' | 'file'>('demo');
  const [clipName, setClipName] = useState('Sample Sunset Motion.mp4');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(DEMO_DURATION_SEC);
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(DEMO_DURATION_SEC);

  const [playing, setPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(1);
  const [reversed, setReversed] = useState<boolean>(false);
  const [loop, setLoop] = useState<boolean>(true);

  const presets = getAllFilterPresets();
  const initialFilter = initialLayers.find((l) => l.type === 'filter') as
    | Extract<EditLayer, { type: 'filter' }>
    | undefined;
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    initialFilter?.params.presetId ?? 'none',
  );
  const [presetIntensity, setPresetIntensity] = useState<number>(
    initialFilter?.params.intensity ?? 90,
  );
  const [fxStack, setFxStack] = useState<OverlayEffectItem[]>([]);

  const [keyframes, setKeyframes] = useState<VideoOverlayKeyframe[]>(() => {
    const seeded: VideoOverlayKeyframe[] = [];
    for (const l of initialLayers) {
      if (l.type === 'text') {
        seeded.push({
          id: uid('vkf'),
          kind: 'text',
          text: l.params.text,
          color: l.params.color,
          fontSize: Math.min(54, Math.max(22, Math.round(l.params.fontSize * 0.72))),
          x: l.params.x,
          y: l.params.y,
          startTime: 0,
          endTime: DEMO_DURATION_SEC,
          animation: l.params.animation && l.params.animation !== 'none' ? l.params.animation : 'pop',
        });
      } else if (l.type === 'sticker' && l.params.kind === 'emoji') {
        seeded.push({
          id: uid('vkf'),
          kind: 'sticker',
          text: l.params.value,
          color: '#FFFFFF',
          fontSize: 48,
          x: l.params.x,
          y: l.params.y,
          startTime: 0,
          endTime: DEMO_DURATION_SEC,
          animation: 'bounce',
        });
      }
    }
    if (seeded.length === 0) {
      seeded.push({
        id: uid('vkf'),
        kind: 'text',
        text: 'LUMINA MOTION',
        color: '#FFFFFF',
        fontSize: 38,
        x: 0.5,
        y: 0.78,
        startTime: 0.2,
        endTime: 3.8,
        animation: 'slide-up',
      });
    }
    return seeded;
  });

  const [audioConfig, setAudioConfig] = useState<VideoAudioConfig>({
    url: '',
    name: '',
    volume: 85,
    fadeInSec: 0.6,
    fadeOutSec: 0.8,
  });
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const currentTimeRef = useRef(0);
  currentTimeRef.current = currentTime;

  const effectiveDur = computeEffectiveDuration(trimStart, trimEnd, speed);

  const renderVideoFrameAt = useCallback(
    (outTimeSec: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const w = canvas.width;
      const h = canvas.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const srcSec = mapPlaybackToSourceTime(
        outTimeSec,
        trimStart,
        trimEnd,
        speed,
        reversed,
        loop,
      );

      const vid = videoElRef.current;
      if (clipMode === 'file' && vid && vid.readyState >= 2) {
        ctx.drawImage(vid, 0, 0, w, h);
      } else if (clipMode === 'demo') {
        drawProceduralDemoFrame(ctx, w, h, srcSec);
      } else {
        ctx.fillStyle = '#0B0C0F';
        ctx.fillRect(0, 0, w, h);
      }

      // Apply selected preset + stacked Picsart FX to frame pixels
      const activePreset =
        selectedPresetId !== 'none' ? presets.find((p) => p.id === selectedPresetId) : null;
      const enabledFx = fxStack.filter((f) => f.enabled && f.intensity > 0);
      if (activePreset || enabledFx.length > 0) {
        const img = ctx.getImageData(0, 0, w, h);
        const d = img.data;
        if (activePreset) {
          for (let i = 0; i < d.length; i += 4) {
            const [r, g, b] = applyFilterPresetPixel(
              d[i],
              d[i + 1],
              d[i + 2],
              activePreset,
              presetIntensity,
            );
            d[i] = r;
            d[i + 1] = g;
            d[i + 2] = b;
          }
        }
        for (const fx of enabledFx) {
          applyOverlayEffectToPixels(d, w, h, fx.kind, fx.intensity);
        }
        ctx.putImageData(img, 0, 0);
      }

      // Draw animated text & sticker keyframes
      for (const kf of keyframes) {
        const st = computeKeyframeOverlayState(kf, outTimeSec, h);
        if (!st.visible || st.opacity <= 0.01) continue;
        ctx.save();
        ctx.globalAlpha = st.opacity;
        ctx.translate(kf.x * w, kf.y * h + st.offsetY);
        ctx.rotate((st.rotationDeg * Math.PI) / 180);
        ctx.scale(st.scale, st.scale);
        ctx.font = `700 ${kf.fontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (kf.kind === 'text') {
          ctx.shadowColor = 'rgba(0,0,0,0.65)';
          ctx.shadowBlur = 14;
          ctx.fillStyle = kf.color;
        }
        ctx.fillText(st.displayText, 0, 0);
        ctx.restore();
      }
    },
    [
      clipMode,
      fxStack,
      keyframes,
      loop,
      presetIntensity,
      presets,
      reversed,
      selectedPresetId,
      speed,
      trimEnd,
      trimStart,
    ],
  );

  // Playback animation loop
  useEffect(() => {
    if (!playing || isExporting) {
      renderVideoFrameAt(currentTimeRef.current);
      return;
    }
    let rafId = 0;
    let lastTs = performance.now();
    let localT = currentTimeRef.current;

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;
      localT += dt;
      if (localT >= effectiveDur) {
        if (loop) {
          localT = localT % Math.max(0.1, effectiveDur);
        } else {
          localT = effectiveDur;
          setPlaying(false);
        }
      }
      currentTimeRef.current = localT;
      setCurrentTime(localT);
      if (clipMode === 'file' && videoElRef.current && videoElRef.current.readyState >= 1) {
        const targetSrcTime = mapPlaybackToSourceTime(
          localT,
          trimStart,
          trimEnd,
          speed,
          reversed,
          loop,
        );
        if (Math.abs(videoElRef.current.currentTime - targetSrcTime) > 0.08) {
          videoElRef.current.currentTime = targetSrcTime;
        }
      }
      renderVideoFrameAt(localT);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [
    clipMode,
    effectiveDur,
    isExporting,
    loop,
    playing,
    renderVideoFrameAt,
    reversed,
    speed,
    trimEnd,
    trimStart,
  ]);

  // Audio playback volume & fade envelope
  useEffect(() => {
    const audio = audioElRef.current;
    if (!audio || !audioConfig.url) return;
    if (playing && !isExporting) {
      const baseVol = Math.max(0, Math.min(1, audioConfig.volume / 100));
      const fadeIn =
        audioConfig.fadeInSec > 0 ? Math.min(1, currentTime / audioConfig.fadeInSec) : 1;
      const remaining = Math.max(0, effectiveDur - currentTime);
      const fadeOut =
        audioConfig.fadeOutSec > 0 ? Math.min(1, remaining / audioConfig.fadeOutSec) : 1;
      audio.volume = Number((baseVol * Math.min(fadeIn, fadeOut)).toFixed(3));
      if (audio.paused) {
        audio.play().catch(() => {});
      }
    } else if (!audio.paused) {
      audio.pause();
    }
  }, [audioConfig, currentTime, effectiveDur, isExporting, playing]);

  const handleImportVideo = (file: File) => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setClipMode('file');
    setClipName(file.name);
    setCurrentTime(0);
    setPlaying(true);
  };

  const handleImportAudio = (file: File) => {
    if (audioConfig.url) URL.revokeObjectURL(audioConfig.url);
    const url = URL.createObjectURL(file);
    setAudioConfig((prev) => ({ ...prev, url, name: file.name }));
  };

  const handleExportVideo = async (preferred: 'mp4' | 'webm') => {
    const canvas = canvasRef.current;
    if (!canvas || typeof MediaRecorder === 'undefined') {
      setExportStatus('Video export requires MediaRecorder support in this browser.');
      return;
    }
    setIsExporting(true);
    setPlaying(false);
    setExportStatus(`Rendering ${preferred.toUpperCase()}…`);

    try {
      const { mimeType, actualExt } = pickSupportedVideoMimeType(preferred);
      const stream = canvas.captureStream(24);

      let audioCtx: AudioContext | null = null;
      if (audioConfig.url && audioElRef.current && typeof AudioContext !== 'undefined') {
        try {
          audioCtx = new AudioContext();
          const srcNode = audioCtx.createMediaElementSource(audioElRef.current);
          const gainNode = audioCtx.createGain();
          const dest = audioCtx.createMediaStreamDestination();
          const baseV = audioConfig.volume / 100;
          gainNode.gain.setValueAtTime(audioConfig.fadeInSec > 0 ? 0.01 : baseV, audioCtx.currentTime);
          if (audioConfig.fadeInSec > 0) {
            gainNode.gain.linearRampToValueAtTime(baseV, audioCtx.currentTime + audioConfig.fadeInSec);
          }
          if (audioConfig.fadeOutSec > 0 && effectiveDur > audioConfig.fadeOutSec) {
            gainNode.gain.setValueAtTime(
              baseV,
              audioCtx.currentTime + effectiveDur - audioConfig.fadeOutSec,
            );
            gainNode.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + effectiveDur);
          }
          srcNode.connect(gainNode);
          gainNode.connect(dest);
          for (const track of dest.stream.getAudioTracks()) {
            stream.addTrack(track);
          }
          audioElRef.current.currentTime = 0;
          void audioElRef.current.play().catch(() => {});
        } catch {
          // Export silent video track if audio capture stream is restricted
        }
      }

      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };

      const done = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });

      recorder.start(100);

      const fps = 24;
      const totalFrames = Math.max(12, Math.min(240, Math.round(effectiveDur * fps)));
      for (let f = 0; f < totalFrames; f++) {
        const tOut = (f / totalFrames) * effectiveDur;
        if (clipMode === 'file' && videoElRef.current && videoElRef.current.readyState >= 1) {
          videoElRef.current.currentTime = mapPlaybackToSourceTime(
            tOut,
            trimStart,
            trimEnd,
            speed,
            reversed,
            false,
          );
        }
        renderVideoFrameAt(tOut);
        setCurrentTime(tOut);
        await new Promise((r) => setTimeout(r, 1000 / fps));
      }

      recorder.stop();
      const blob = await done;
      if (audioElRef.current) audioElRef.current.pause();
      if (audioCtx) void audioCtx.close().catch(() => {});

      const safeName = clipName.replace(/\.[^.]+$/, '') || 'lumina-video';
      triggerDownload(blob, `${safeName}-edited.${actualExt}`);
      setExportStatus(`Downloaded ${safeName}-edited.${actualExt}`);
    } catch {
      setExportStatus('Could not complete video recording in this environment.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Video Studio"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] rounded-2xl bg-[#121419] border border-white/15 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImportVideo(f);
            e.target.value = '';
          }}
        />
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImportAudio(f);
            e.target.value = '';
          }}
        />
        {videoUrl && (
          <video
            ref={videoElRef}
            src={videoUrl}
            muted
            playsInline
            onLoadedMetadata={(e) => {
              const d = Math.max(0.5, e.currentTarget.duration || 4);
              setDuration(Number(d.toFixed(2)));
              setTrimStart(0);
              setTrimEnd(Number(d.toFixed(2)));
            }}
            className="hidden"
          />
        )}
        {audioConfig.url && <audio ref={audioElRef} src={audioConfig.url} loop={loop} className="hidden" />}

        {/* Modal Header */}
        <div className="px-4 py-3 border-b border-white/[0.08] bg-[#101216] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Video Studio</h2>
            <span className="text-[11px] text-zinc-400 hidden sm:inline">· {clipName}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold flex items-center gap-1"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Video</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setClipMode('demo');
                setClipName('Sample Sunset Motion.mp4');
                setDuration(DEMO_DURATION_SEC);
                setTrimStart(0);
                setTrimEnd(DEMO_DURATION_SEC);
                setCurrentTime(0);
                setPlaying(true);
              }}
              className="px-2.5 py-1 rounded-md bg-[#181A20] hover:bg-white/10 border border-white/10 text-xs text-zinc-200 hidden sm:flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Sample Clip</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Video Studio"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Workspace Grid */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 overflow-y-auto md:overflow-hidden">
          {/* Preview & Transport Column */}
          <div className="md:col-span-7 p-4 flex flex-col gap-3 bg-[#090A0D] items-center justify-center">
            <div className="w-full max-w-xl aspect-video rounded-xl overflow-hidden bg-black border border-white/10 shadow-xl flex items-center justify-center">
              <canvas
                ref={canvasRef}
                data-testid="video-studio-canvas"
                width={640}
                height={360}
                className="w-full h-full object-contain block"
              />
            </div>

            <div className="w-full max-w-xl flex items-center gap-2.5 px-2">
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                aria-label={playing ? 'Pause video' : 'Play video'}
                className="w-9 h-9 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 flex items-center justify-center shrink-0"
              >
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <input
                type="range"
                aria-label="Video timeline position"
                min={0}
                max={Math.max(0.2, effectiveDur)}
                step={0.02}
                value={Math.min(effectiveDur, currentTime)}
                onChange={(e) => {
                  setPlaying(false);
                  const t = Number(e.target.value);
                  setCurrentTime(t);
                  renderVideoFrameAt(t);
                }}
                className="studio-slider flex-1"
              />
              <span className="font-mono-num text-[11px] text-zinc-300 w-24 text-right shrink-0">
                {currentTime.toFixed(1)}s / {effectiveDur.toFixed(1)}s
              </span>
            </div>

            <div className="w-full max-w-xl flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1.5">
                {([0.5, 1, 1.5, 2] as const).map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    onClick={() => setSpeed(sp)}
                    aria-pressed={speed === sp}
                    className={`px-2 py-1 rounded text-[11px] font-mono-num border ${
                      speed === sp
                        ? 'bg-amber-500 text-zinc-950 border-amber-500 font-semibold'
                        : 'bg-[#181A20] text-zinc-300 border-white/10'
                    }`}
                  >
                    {sp}×
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setReversed((r) => !r)}
                  aria-pressed={reversed}
                  className={`px-2 py-1 rounded text-[11px] border flex items-center gap-1 ${
                    reversed
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      : 'bg-[#181A20] text-zinc-300 border-white/10'
                  }`}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reverse</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLoop((l) => !l)}
                  aria-pressed={loop}
                  className={`px-2 py-1 rounded text-[11px] border ${
                    loop
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      : 'bg-[#181A20] text-zinc-300 border-white/10'
                  }`}
                >
                  Loop
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => void handleExportVideo('mp4')}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-zinc-950 text-xs font-semibold flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export MP4</span>
                </button>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => void handleExportVideo('webm')}
                  className="px-3 py-1.5 rounded-lg bg-[#181A20] hover:bg-white/10 border border-white/15 disabled:opacity-45 text-zinc-100 text-xs font-medium flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>WebM</span>
                </button>
              </div>
            </div>

            {exportStatus && (
              <p className="text-[11px] text-amber-300" role="status">
                {exportStatus}
              </p>
            )}
          </div>

          {/* Right Controls Column */}
          <div className="md:col-span-5 p-4 space-y-4 border-t md:border-t-0 md:border-l border-white/[0.08] overflow-y-auto studio-scroll">
            {/* Trim Range */}
            <section className="space-y-2">
              <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Trim Clip ({trimStart.toFixed(1)}s – {trimEnd.toFixed(1)}s)
              </h3>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="space-y-1 text-[11px] text-zinc-400">
                  <span>Start ({trimStart.toFixed(1)}s)</span>
                  <input
                    type="range"
                    aria-label="Trim start time"
                    min={0}
                    max={Math.max(0.2, duration - 0.1)}
                    step={0.1}
                    value={trimStart}
                    onChange={(e) => {
                      const next = clampTrimRange(Number(e.target.value), trimEnd, duration);
                      setTrimStart(next.trimStart);
                      setTrimEnd(next.trimEnd);
                    }}
                    className="studio-slider"
                  />
                </label>
                <label className="space-y-1 text-[11px] text-zinc-400">
                  <span>End ({trimEnd.toFixed(1)}s)</span>
                  <input
                    type="range"
                    aria-label="Trim end time"
                    min={0.1}
                    max={duration}
                    step={0.1}
                    value={trimEnd}
                    onChange={(e) => {
                      const next = clampTrimRange(trimStart, Number(e.target.value), duration);
                      setTrimStart(next.trimStart);
                      setTrimEnd(next.trimEnd);
                    }}
                    className="studio-slider"
                  />
                </label>
              </div>
            </section>

            {/* Filter & Picsart FX */}
            <section className="space-y-2.5 pt-3 border-t border-white/[0.06]">
              <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Video Filters & Creative FX
              </h3>
              <div className="flex items-center gap-2">
                <select
                  aria-label="Video filter preset"
                  value={selectedPresetId}
                  onChange={(e) => setSelectedPresetId(e.target.value)}
                  className="flex-1 rounded-lg bg-[#0B0C0F] border border-white/10 px-2.5 py-1.5 text-xs text-zinc-100"
                >
                  <option value="none">Original (No Preset)</option>
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {selectedPresetId !== 'none' && (
                  <input
                    type="range"
                    aria-label="Video preset intensity"
                    min={10}
                    max={100}
                    value={presetIntensity}
                    onChange={(e) => setPresetIntensity(Number(e.target.value))}
                    className="studio-slider w-24"
                  />
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {OVERLAY_EFFECT_CATALOG.filter((item) => item.kind !== 'bg-remove')
                  .slice(0, 16)
                  .map((item) => (
                    <button
                      key={item.kind}
                      type="button"
                      onClick={() =>
                        setFxStack((prev) => [
                          ...prev,
                          createOverlayEffectItem(item.kind as OverlayEffectKind),
                        ])
                      }
                      className="px-2 py-1 rounded-md bg-[#181A20] hover:bg-white/10 border border-white/[0.08] text-[11px] text-zinc-200 whitespace-nowrap shrink-0"
                    >
                      + {item.label}
                    </button>
                  ))}
              </div>

              {fxStack.length > 0 && (
                <div className="space-y-1.5">
                  {fxStack.map((fx) => (
                    <div
                      key={fx.id}
                      className="flex items-center gap-2 px-2 py-1 rounded bg-[#0B0C0F] border border-white/10"
                    >
                      <span className="text-[11px] text-zinc-200 w-24 truncate">{fx.label}</span>
                      <input
                        type="range"
                        aria-label={`Video ${fx.label} intensity`}
                        min={0}
                        max={100}
                        value={fx.intensity}
                        onChange={(e) => {
                          const intensity = Number(e.target.value);
                          setFxStack((prev) =>
                            prev.map((it) => (it.id === fx.id ? { ...it, intensity } : it)),
                          );
                        }}
                        className="studio-slider flex-1"
                      />
                      <button
                        type="button"
                        aria-label={`Remove video ${fx.label}`}
                        onClick={() => setFxStack((prev) => prev.filter((it) => it.id !== fx.id))}
                        className="p-0.5 text-zinc-400 hover:text-rose-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Animated Text & Stickers with Keyframed Timing */}
            <section className="space-y-2 pt-3 border-t border-white/[0.06]">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Animated Keyframes
                </h3>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setKeyframes((prev) => [
                        ...prev,
                        {
                          id: uid('vkf'),
                          kind: 'text',
                          text: 'GOLDEN HOUR',
                          color: '#FEF3C7',
                          fontSize: 34,
                          x: 0.5,
                          y: 0.25,
                          startTime: 0,
                          endTime: Number(effectiveDur.toFixed(1)),
                          animation: 'fade',
                        },
                      ])
                    }
                    className="px-2 py-0.5 rounded bg-[#181A20] hover:bg-white/10 border border-white/10 text-[10px] text-zinc-200 flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Text</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setKeyframes((prev) => [
                        ...prev,
                        {
                          id: uid('vkf'),
                          kind: 'sticker',
                          text: '✨',
                          color: '#FFFFFF',
                          fontSize: 44,
                          x: 0.78,
                          y: 0.26,
                          startTime: 0,
                          endTime: Number(effectiveDur.toFixed(1)),
                          animation: 'spin',
                        },
                      ])
                    }
                    className="px-2 py-0.5 rounded bg-[#181A20] hover:bg-white/10 border border-white/10 text-[10px] text-zinc-200 flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Sticker</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto studio-scroll">
                {keyframes.map((kf) => (
                  <div
                    key={kf.id}
                    className="p-2 rounded-lg bg-[#0B0C0F] border border-white/10 space-y-1.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        aria-label="Keyframe overlay text"
                        value={kf.text}
                        onChange={(e) =>
                          setKeyframes((prev) =>
                            prev.map((it) => (it.id === kf.id ? { ...it, text: e.target.value } : it)),
                          )
                        }
                        className="flex-1 rounded bg-[#181A20] border border-white/10 px-2 py-1 text-xs text-white"
                      />
                      <select
                        aria-label="Keyframe animation style"
                        value={kf.animation}
                        onChange={(e) =>
                          setKeyframes((prev) =>
                            prev.map((it) =>
                              it.id === kf.id
                                ? { ...it, animation: e.target.value as VideoOverlayKeyframe['animation'] }
                                : it,
                            ),
                          )
                        }
                        className="rounded bg-[#181A20] border border-white/10 px-1.5 py-1 text-[11px] text-zinc-200"
                      >
                        <option value="none">Static</option>
                        <option value="fade">Fade</option>
                        <option value="slide-up">Slide Up</option>
                        <option value="pop">Pop</option>
                        <option value="typewriter">Typewriter</option>
                        <option value="bounce">Bounce</option>
                        <option value="pulse">Pulse</option>
                        <option value="spin">Spin</option>
                      </select>
                      <button
                        type="button"
                        aria-label="Delete keyframe"
                        onClick={() => setKeyframes((prev) => prev.filter((it) => it.id !== kf.id))}
                        className="p-1 text-zinc-400 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-400">
                      <label className="flex items-center gap-1">
                        <span>In</span>
                        <input
                          type="number"
                          min={0}
                          max={effectiveDur}
                          step={0.1}
                          value={kf.startTime}
                          onChange={(e) =>
                            setKeyframes((prev) =>
                              prev.map((it) =>
                                it.id === kf.id
                                  ? { ...it, startTime: Math.max(0, Number(e.target.value)) }
                                  : it,
                              ),
                            )
                          }
                          className="w-full rounded bg-[#181A20] border border-white/10 px-1.5 py-0.5 text-zinc-200"
                        />
                      </label>
                      <label className="flex items-center gap-1">
                        <span>Out</span>
                        <input
                          type="number"
                          min={0.1}
                          max={Math.max(10, effectiveDur + 2)}
                          step={0.1}
                          value={kf.endTime}
                          onChange={(e) =>
                            setKeyframes((prev) =>
                              prev.map((it) =>
                                it.id === kf.id
                                  ? { ...it, endTime: Math.max(it.startTime + 0.1, Number(e.target.value)) }
                                  : it,
                              ),
                            )
                          }
                          className="w-full rounded bg-[#181A20] border border-white/10 px-1.5 py-0.5 text-zinc-200"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Background Music with Volume & Fade */}
            <section className="space-y-2 pt-3 border-t border-white/[0.06]">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  <Music className="w-3.5 h-3.5 text-amber-400" />
                  <span>Music & Audio Fade</span>
                </h3>
                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  className="px-2 py-1 rounded bg-[#181A20] hover:bg-white/10 border border-white/10 text-[11px] text-zinc-200"
                >
                  {audioConfig.name ? 'Change Track' : 'Add Music'}
                </button>
              </div>
              {audioConfig.name && (
                <p className="text-[10px] text-zinc-400 truncate">Track: {audioConfig.name}</p>
              )}
              <div className="grid grid-cols-3 gap-2 text-[10px] text-zinc-400">
                <label className="space-y-1">
                  <span>Vol ({audioConfig.volume}%)</span>
                  <input
                    type="range"
                    aria-label="Music volume"
                    min={0}
                    max={100}
                    value={audioConfig.volume}
                    onChange={(e) =>
                      setAudioConfig((prev) => ({ ...prev, volume: Number(e.target.value) }))
                    }
                    className="studio-slider"
                  />
                </label>
                <label className="space-y-1">
                  <span>Fade In ({audioConfig.fadeInSec}s)</span>
                  <input
                    type="range"
                    aria-label="Audio fade in seconds"
                    min={0}
                    max={5}
                    step={0.2}
                    value={audioConfig.fadeInSec}
                    onChange={(e) =>
                      setAudioConfig((prev) => ({ ...prev, fadeInSec: Number(e.target.value) }))
                    }
                    className="studio-slider"
                  />
                </label>
                <label className="space-y-1">
                  <span>Fade Out ({audioConfig.fadeOutSec}s)</span>
                  <input
                    type="range"
                    aria-label="Audio fade out seconds"
                    min={0}
                    max={5}
                    step={0.2}
                    value={audioConfig.fadeOutSec}
                    onChange={(e) =>
                      setAudioConfig((prev) => ({ ...prev, fadeOutSec: Number(e.target.value) }))
                    }
                    className="studio-slider"
                  />
                </label>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
