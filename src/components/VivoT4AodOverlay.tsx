import React, { useState, useEffect, useRef } from 'react';
import { VisualizerOptions, AudioStats } from '../types';
import { Play, Pause, X, Sliders, Music, Eye, EyeOff } from 'lucide-react';

interface VivoT4AodOverlayProps {
  options: VisualizerOptions;
  stats: AudioStats;
  isPlaying: boolean;
  audioFileName: string | null;
  onTogglePlay: () => void;
  onClose: () => void;
  onUpdateOption: <K extends keyof VisualizerOptions>(key: K, value: VisualizerOptions[K]) => void;
}

export default function VivoT4AodOverlay({
  options,
  stats,
  isPlaying,
  audioFileName,
  onTogglePlay,
  onClose,
  onUpdateOption,
}: VivoT4AodOverlayProps) {
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const [showColorPicker, setShowColorPicker] = useState<boolean>(false);
  const [showMinimalSongTitle, setShowMinimalSongTitle] = useState<boolean>(false);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide controls after 3 seconds of inactivity so the screen remains 100% pure black with edge lights
  const resetHideTimer = () => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!showColorPicker) {
        setControlsVisible(false);
      }
    }, 3200);
  };

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [showColorPicker]);

  const currentColor = options.ambientEdgeColor || options.vivoT4LightColor || options.customColor || '#00f0ff';

  const QUICK_COLORS = [
    { name: 'Electric Cyan', hex: '#00f0ff' },
    { name: 'Neon Pink', hex: '#ff007f' },
    { name: 'Toxic Lime', hex: '#39ff14' },
    { name: 'Amber Gold', hex: '#ffaa00' },
    { name: 'Deep Violet', hex: '#b000ff' },
    { name: 'Flame Red', hex: '#ff0033' },
    { name: 'Pure White', hex: '#ffffff' },
  ];

  return (
    <div
      onClick={resetHideTimer}
      className="fixed inset-0 z-40 bg-[#000000] text-white flex flex-col justify-between p-4 sm:p-6 select-none overflow-hidden font-sans cursor-pointer transition-colors duration-300"
      style={{ backgroundColor: '#000000' }}
    >
      {/* TOP FLOATING MINIMAL HEADER (Auto-hides) */}
      <div
        className={`w-full max-w-lg mx-auto flex items-center justify-between z-50 pt-2 transition-opacity duration-500 ${
          controlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center space-x-2 bg-zinc-950/80 px-3 py-1.5 rounded-full border border-zinc-800/80 backdrop-blur-md">
          <div
            className="w-2 h-2 rounded-full animate-ping"
            style={{ backgroundColor: currentColor }}
          />
          <span className="text-[11px] font-mono tracking-wider font-semibold text-zinc-300 uppercase">
            Pure Edge Light Mode
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Toggle Minimal Song Title */}
          <button
            onClick={() => setShowMinimalSongTitle(!showMinimalSongTitle)}
            className={`p-2 rounded-full border backdrop-blur-md transition-all cursor-pointer ${
              showMinimalSongTitle
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                : 'bg-zinc-950/80 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
            title={showMinimalSongTitle ? 'Hide song title' : 'Show minimal song title'}
          >
            {showMinimalSongTitle ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          {/* Color Customizer */}
          <button
            onClick={() => {
              setShowColorPicker(!showColorPicker);
              resetHideTimer();
            }}
            className="p-2 rounded-full bg-zinc-950/80 border border-zinc-800 text-zinc-300 hover:text-white backdrop-blur-md transition-all cursor-pointer flex items-center space-x-1"
            title="Edge Color"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase hidden sm:inline">Color</span>
          </button>

          {/* Play/Pause Button */}
          <button
            onClick={onTogglePlay}
            className="p-2 rounded-full bg-zinc-950/80 border border-zinc-800 text-zinc-200 hover:text-white backdrop-blur-md transition-all cursor-pointer"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current translate-x-0.5" />}
          </button>

          {/* Exit Button */}
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-red-950/40 border border-red-500/40 text-red-300 hover:bg-red-900/60 hover:text-white backdrop-blur-md transition-all cursor-pointer"
            title="Exit Edge Light Mode"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* QUICK COLOR SELECTOR POPUP (Auto-opens only when tapped) */}
      {showColorPicker && (
        <div
          className="w-full max-w-sm mx-auto bg-zinc-950/95 border border-zinc-800 p-3 rounded-2xl shadow-2xl z-50 space-y-2 backdrop-blur-xl animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-300">
            <span className="font-bold text-cyan-400">EDGE LIGHT COLOR</span>
            <button
              onClick={() => setShowColorPicker(false)}
              className="text-zinc-500 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {QUICK_COLORS.map((c) => (
              <button
                key={c.hex}
                onClick={() => {
                  onUpdateOption('ambientEdgeColor', c.hex);
                  onUpdateOption('vivoT4LightColor', c.hex);
                  onUpdateOption('customColor', c.hex);
                }}
                className={`w-full aspect-square rounded-full border-2 transition-transform cursor-pointer ${
                  currentColor === c.hex ? 'border-white scale-110 shadow-lg' : 'border-zinc-800 hover:scale-105'
                }`}
                style={{ backgroundColor: c.hex }}
                title={c.name}
              />
            ))}
          </div>
        </div>
      )}

      {/* CENTER AREA: 100% PURE AMOLED BLACK (No clunky dials, no clocks, no clutter!) */}
      <div className="flex-1 flex flex-col items-center justify-center pointer-events-none select-none">
        {/* Only when controls are visible, show a very subtle helpful hint */}
        <div
          className={`transition-opacity duration-700 text-center space-y-2 ${
            controlsVisible ? 'opacity-40' : 'opacity-0'
          }`}
        >
          <p className="text-[11px] text-zinc-500 font-mono tracking-widest uppercase">
            Pure Edge Light Screen
          </p>
          <p className="text-[10px] text-zinc-600 font-sans">
            Tap anywhere to show controls or exit
          </p>
        </div>
      </div>

      {/* BOTTOM AREA: Sleek, Discreet Minimal Song Pill (Optional / Auto-hides) */}
      <div className="w-full max-w-sm mx-auto z-50 pb-2 flex flex-col items-center pointer-events-none">
        {showMinimalSongTitle && audioFileName && (
          <div
            className={`transition-opacity duration-500 px-3.5 py-1.5 rounded-full bg-zinc-950/70 border border-zinc-800/60 backdrop-blur-md flex items-center space-x-2 ${
              controlsVisible ? 'opacity-90' : 'opacity-30'
            }`}
          >
            <Music className="w-3 h-3 text-cyan-400" />
            <span className="text-[11px] font-mono text-zinc-300 truncate max-w-[200px]">
              {audioFileName}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
