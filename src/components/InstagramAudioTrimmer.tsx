import React, { useRef, useState, useCallback, useMemo } from 'react';
import { Play, Pause, RotateCcw, Clock, Scissors, Music2, Sparkles, SlidersHorizontal } from 'lucide-react';

interface InstagramAudioTrimmerProps {
  trackDuration: number;
  trackProgress: number;
  trimStart: number;
  trimEnd: number;
  waveformPeaks: number[];
  isPlaying: boolean;
  onUpdateTrim: (start: number, end: number) => void;
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
  audioFileName?: string | null;
}

export default function InstagramAudioTrimmer({
  trackDuration,
  trackProgress,
  trimStart,
  trimEnd,
  waveformPeaks,
  isPlaying,
  onUpdateTrim,
  onSeek,
  onTogglePlay,
  audioFileName
}: InstagramAudioTrimmerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeDrag, setActiveDrag] = useState<'start' | 'end' | 'window' | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [initialTrim, setInitialTrim] = useState<{ start: number; end: number }>({ start: 0, end: 0 });

  const total = Math.max(1, trackDuration || 15);
  const effectiveEnd = (trimEnd > trimStart && trimEnd <= total) ? trimEnd : total;
  const currentClipDuration = Math.max(0.5, effectiveEnd - trimStart);

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '0:00.0';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${m}:${s < 10 ? '0' : ''}${s}.${ms}s`;
  };

  const formatTimeShort = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Preset Clip lengths (15s Reel, 30s Story, 60s Post, Full)
  const setPresetClip = (seconds: number) => {
    const start = Math.min(trackProgress, Math.max(0, total - seconds));
    const end = Math.min(total, start + seconds);
    onUpdateTrim(start, end);
    onSeek(start);
  };

  const handlePointerDown = (type: 'start' | 'end' | 'window', e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveDrag(type);
    setDragStartX(e.clientX);
    setInitialTrim({ start: trimStart, end: effectiveEnd });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!activeDrag || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;

    const deltaX = e.clientX - dragStartX;
    const deltaTime = (deltaX / rect.width) * total;

    if (activeDrag === 'start') {
      const newStart = Math.max(0, Math.min(initialTrim.end - 0.5, initialTrim.start + deltaTime));
      onUpdateTrim(newStart, initialTrim.end);
      onSeek(newStart);
    } else if (activeDrag === 'end') {
      const newEnd = Math.min(total, Math.max(initialTrim.start + 0.5, initialTrim.end + deltaTime));
      onUpdateTrim(initialTrim.start, newEnd);
      onSeek(newEnd);
    } else if (activeDrag === 'window') {
      const windowDuration = initialTrim.end - initialTrim.start;
      let newStart = initialTrim.start + deltaTime;
      let newEnd = initialTrim.end + deltaTime;

      if (newStart < 0) {
        newStart = 0;
        newEnd = windowDuration;
      } else if (newEnd > total) {
        newEnd = total;
        newStart = Math.max(0, total - windowDuration);
      }

      onUpdateTrim(newStart, newEnd);
      onSeek(newStart);
    }
  }, [activeDrag, dragStartX, initialTrim, total, onUpdateTrim, onSeek]);

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeDrag) {
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {}
      setActiveDrag(null);
    }
  };

  // Convert start/end to percentage positions
  const startPct = Math.max(0, Math.min(100, (trimStart / total) * 100));
  const endPct = Math.max(0, Math.min(100, (effectiveEnd / total) * 100));
  const windowWidthPct = Math.max(0.5, endPct - startPct);
  const playheadPct = Math.max(0, Math.min(100, (trackProgress / total) * 100));

  // Time ruler tick marks (e.g. 0s, 15s, 30s, 45s...)
  const timeRulerTicks = useMemo(() => {
    const ticks: { time: number; label: string; pct: number }[] = [];
    let interval = 15;
    if (total <= 30) interval = 5;
    else if (total <= 90) interval = 15;
    else if (total <= 180) interval = 30;
    else interval = 60;

    for (let t = 0; t <= total; t += interval) {
      ticks.push({
        time: t,
        label: formatTimeShort(t),
        pct: (t / total) * 100
      });
    }
    return ticks;
  }, [total]);

  return (
    <div className="bg-[#07070c] border border-cyan-500/20 rounded-2xl p-3 space-y-2.5 shadow-2xl text-white select-none relative overflow-hidden">
      
      {/* 1. STUDIO HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-sm shadow-cyan-500/10">
            <Scissors className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-bold text-zinc-100 tracking-tight">Audio Trimmer</span>
              <span className="text-[7.5px] font-mono font-bold px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                PRO
              </span>
            </div>
            <p className="text-[8.5px] text-zinc-400 truncate max-w-[190px] mt-0.5 font-medium">
              {audioFileName || 'Active Audio Track'}
            </p>
          </div>
        </div>

        {/* Selected Duration Pill & Compact Play Button */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <div className="flex items-center space-x-1 bg-zinc-900/90 border border-cyan-500/30 px-2 py-0.5 rounded-lg">
            <Clock className="w-2.5 h-2.5 text-cyan-400" />
            <span className="text-[9px] font-mono font-bold text-cyan-300">
              {formatTime(currentClipDuration)}
            </span>
          </div>

          <button
            onClick={onTogglePlay}
            className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all cursor-pointer shadow-sm ${
              isPlaying
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                : 'bg-cyan-500 hover:bg-cyan-400 text-black border-cyan-400 shadow-sm shadow-cyan-500/30 active:scale-95'
            }`}
            title={isPlaying ? "Pause Preview" : "Play Trimmed Preview"}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-cyan-300" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-black ml-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* 2. QUICK PRESET BUTTONS (Cyan/Indigo App Matched) */}
      <div className="grid grid-cols-4 gap-1.5 pt-0.5">
        <button
          onClick={() => setPresetClip(15)}
          className={`py-1 px-1 rounded-lg border text-[8.5px] font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer ${
            Math.abs(currentClipDuration - 15) < 0.8
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
              : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
          }`}
        >
          <span>15s Reel</span>
        </button>

        <button
          onClick={() => setPresetClip(30)}
          className={`py-1 px-1 rounded-lg border text-[8.5px] font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer ${
            Math.abs(currentClipDuration - 30) < 0.8
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
              : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
          }`}
        >
          <span>30s Story</span>
        </button>

        <button
          onClick={() => setPresetClip(60)}
          className={`py-1 px-1 rounded-lg border text-[8.5px] font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer ${
            Math.abs(currentClipDuration - 60) < 0.8
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
              : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
          }`}
        >
          <span>60s Post</span>
        </button>

        <button
          onClick={() => {
            onUpdateTrim(0, total);
            onSeek(0);
          }}
          className={`py-1 px-1 rounded-lg border text-[8.5px] font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer ${
            Math.abs(currentClipDuration - total) < 0.8
              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
              : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
          }`}
          title="Reset to entire track length"
        >
          <RotateCcw className="w-2.5 h-2.5" />
          <span>Full Track</span>
        </button>
      </div>

      {/* 3. TIME RULER & MAIN WAVEFORM TIMELINE */}
      <div className="space-y-1">
        {/* Timeline Range Readout */}
        <div className="flex items-center justify-between text-[8.5px] font-mono px-1">
          <div className="flex items-center space-x-1">
            <span className="text-zinc-500 uppercase font-sans text-[7.5px] font-bold">START</span>
            <span className="text-cyan-400 font-bold">{formatTimeShort(trimStart)}</span>
          </div>
          <span className="text-zinc-500 font-sans text-[7.5px]">
            Drag handles to trim audio clip
          </span>
          <div className="flex items-center space-x-1">
            <span className="text-zinc-500 uppercase font-sans text-[7.5px] font-bold">END</span>
            <span className="text-cyan-400 font-bold">{formatTimeShort(effectiveEnd)}</span>
          </div>
        </div>

        {/* Waveform Canvas & Scrubber */}
        <div
          ref={containerRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="relative w-full h-20 bg-[#040407] rounded-xl border border-zinc-800 overflow-hidden cursor-pointer select-none touch-none shadow-inner"
          onClick={(e) => {
            if (activeDrag) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickPct = Math.max(0, Math.min(1, clickX / rect.width));
            const targetTime = clickPct * total;
            onSeek(targetTime);
          }}
        >
          {/* Subtle Top Time-Ruler */}
          <div className="absolute top-0 left-0 right-0 h-3.5 border-b border-zinc-850/80 bg-zinc-950/40 pointer-events-none z-10 flex items-center">
            {timeRulerTicks.map((tick) => (
              <div
                key={tick.time}
                className="absolute top-0 h-full flex flex-col items-center pointer-events-none -translate-x-1/2"
                style={{ left: `${tick.pct}%` }}
              >
                <div className="w-[1px] h-1 bg-zinc-700 mt-0" />
                <span className="text-[6.5px] font-mono text-zinc-500 leading-none mt-0.5">
                  {tick.label}
                </span>
              </div>
            ))}
          </div>

          {/* Symmetrical Waveform Bars (App-matched Cyan & Violet) */}
          <div className="absolute inset-x-0 bottom-0 top-3.5 flex items-center justify-between gap-[2px] px-2 py-1 pointer-events-none">
            {waveformPeaks.map((peak, idx) => {
              const totalBars = waveformPeaks.length;
              const barPctStart = (idx / totalBars) * 100;
              const barPctEnd = ((idx + 1) / totalBars) * 100;
              
              const isInSelectedClip = barPctEnd >= startPct && barPctStart <= endPct;
              const barHeightPct = Math.max(12, Math.round(peak * 92));
              const isAccentPeak = peak > 0.6;

              return (
                <div
                  key={idx}
                  className="flex-1 h-full flex items-center justify-center"
                >
                  <div
                    className={`w-full rounded-full transition-colors duration-100 ${
                      isInSelectedClip
                        ? isAccentPeak
                          ? 'bg-gradient-to-t from-cyan-500 via-teal-300 to-white shadow-[0_0_6px_rgba(6,182,212,0.8)]'
                          : 'bg-gradient-to-t from-cyan-600 to-cyan-400 opacity-90'
                        : 'bg-zinc-800/80 opacity-30'
                    }`}
                    style={{ height: `${barHeightPct}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Left Dimmed Mask */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-black/70 backdrop-blur-[1px] pointer-events-none transition-all duration-75"
            style={{ width: `${startPct}%` }}
          />

          {/* Right Dimmed Mask */}
          <div
            className="absolute top-0 bottom-0 right-0 bg-black/70 backdrop-blur-[1px] pointer-events-none transition-all duration-75"
            style={{ width: `${100 - endPct}%` }}
          />

          {/* DRAGGABLE CROP SELECTION WINDOW */}
          <div
            onPointerDown={(e) => handlePointerDown('window', e)}
            className="absolute top-0 bottom-0 border-y-2 border-cyan-400/80 bg-cyan-400/[0.05] cursor-grab active:cursor-grabbing transition-all duration-75 z-20 group"
            style={{
              left: `${startPct}%`,
              width: `${windowWidthPct}%`,
              boxShadow: '0 0 14px rgba(6,182,212,0.2)'
            }}
          >
            {/* Top & Bottom Subtle Neon Line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-400 via-teal-300 to-cyan-400" />
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-400 via-teal-300 to-cyan-400" />

            {/* Left Handle */}
            <div
              onPointerDown={(e) => handlePointerDown('start', e)}
              className="absolute top-0 bottom-0 -left-2.5 w-5 flex items-center justify-center cursor-ew-resize z-30 touch-none group-hover:scale-105 transition-transform"
            >
              <div className="w-3 h-10 rounded-md bg-gradient-to-b from-cyan-400 to-blue-600 border border-white/80 shadow-[0_0_10px_rgba(6,182,212,0.8)] flex flex-col items-center justify-center space-y-1">
                <div className="w-0.5 h-1.5 bg-white rounded-full opacity-90" />
                <div className="w-0.5 h-1.5 bg-white rounded-full opacity-90" />
              </div>
            </div>

            {/* Right Handle */}
            <div
              onPointerDown={(e) => handlePointerDown('end', e)}
              className="absolute top-0 bottom-0 -right-2.5 w-5 flex items-center justify-center cursor-ew-resize z-30 touch-none group-hover:scale-105 transition-transform"
            >
              <div className="w-3 h-10 rounded-md bg-gradient-to-b from-cyan-400 to-blue-600 border border-white/80 shadow-[0_0_10px_rgba(6,182,212,0.8)] flex flex-col items-center justify-center space-y-1">
                <div className="w-0.5 h-1.5 bg-white rounded-full opacity-90" />
                <div className="w-0.5 h-1.5 bg-white rounded-full opacity-90" />
              </div>
            </div>

            {/* Floating Selection Center Label */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-zinc-950/90 px-2 py-0.2 rounded-full border border-cyan-500/40 text-[7.5px] font-mono text-cyan-300 font-bold pointer-events-none shadow-md">
              <span>{formatTimeShort(trimStart)} - {formatTimeShort(effectiveEnd)}</span>
            </div>
          </div>

          {/* LIVE AUDIO PLAYHEAD NEEDLE */}
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-white z-40 pointer-events-none shadow-[0_0_8px_#ffffff]"
            style={{ left: `${playheadPct}%` }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-300 border-2 border-white shadow-[0_0_6px_#22d3ee] -ml-[4px] -mt-[2px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
