import React, { useState, useEffect } from 'react';
import { VisualizerOptions, AudioStats } from '../types';
import { Play, Pause, Volume2, VolumeX, X, Sparkles, Disc, Clock, Music, Sliders } from 'lucide-react';

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
  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');
  const [showColorBar, setShowColorBar] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDateStr(now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const themeColor = options.vivoT4LightColor || options.customColor || '#ff007f';
  const vol = isPlaying ? Math.max(0.15, stats.volume) : 0.1;
  const isBassHit = isPlaying && stats.bassEnergy;

  // Color preset options for quick Vivo T4 Light customization
  const VIVO_COLOR_PRESETS = [
    { name: 'Vivo Neon Pink', hex: '#ff007f' },
    { name: 'Electric Cyan', hex: '#00f0ff' },
    { name: 'Toxic Lime', hex: '#39ff14' },
    { name: 'Gold Flare', hex: '#f9d423' },
    { name: 'Royal Violet', hex: '#b000ff' },
    { name: 'Flame Red', hex: '#ff0033' },
    { name: 'Ice White', hex: '#ffffff' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col items-center justify-between p-6 select-none overflow-hidden animate-fade-in font-sans">
      
      {/* TOP STATUS BAR & EXIT CONTROLS */}
      <div className="w-full max-w-md flex items-center justify-between z-20 pt-2">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-pulse shadow-[0_0_10px_#ff007f]" />
          <span className="text-[10px] font-mono tracking-widest text-pink-400 font-black uppercase">
            VIVO T4 DYNAMIC AOD
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowColorBar(!showColorBar)}
            className="p-2 rounded-full bg-zinc-900 border border-zinc-800 text-cyan-400 hover:text-white transition-all cursor-pointer flex items-center space-x-1"
            title="Color Customization"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="text-[9px] font-bold uppercase">Color</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
            title="Exit Screen-Off Mode"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* QUICK COLOR CUSTOMIZER TOOLBAR OVERLAY */}
      {showColorBar && (
        <div className="w-full max-w-md bg-zinc-950/95 border border-pink-500/40 p-3 rounded-2xl shadow-2xl z-30 space-y-2.5 animate-fade-in backdrop-blur-xl">
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-300">
            <span className="font-bold text-pink-400 uppercase">Vivo T4 Light Colors</span>
            <span className="text-zinc-500">Pick Preset or Hex</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {VIVO_COLOR_PRESETS.map((p) => (
              <button
                key={p.hex}
                onClick={() => {
                  onUpdateOption('vivoT4LightColor', p.hex);
                  onUpdateOption('customColor', p.hex);
                }}
                className={`w-full aspect-square rounded-full border-2 transition-transform cursor-pointer ${
                  themeColor === p.hex ? 'border-white scale-110 shadow-lg' : 'border-zinc-800 hover:scale-105'
                }`}
                style={{ backgroundColor: p.hex }}
                title={p.name}
              />
            ))}
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-zinc-800 text-[10px]">
            <span className="text-zinc-400">Custom Color Picker:</span>
            <input
              type="color"
              value={themeColor}
              onChange={(e) => {
                onUpdateOption('vivoT4LightColor', e.target.value);
                onUpdateOption('customColor', e.target.value);
              }}
              className="w-7 h-7 rounded-lg border border-pink-500 bg-transparent cursor-pointer p-0.5"
            />
          </div>
        </div>
      )}

      {/* CENTER OLED CLOCK & DYNAMIC MUSIC LIGHT DISK */}
      <div className="flex-1 flex flex-col items-center justify-center my-auto w-full max-w-sm relative z-10">
        
        {/* OLED DIGITAL CLOCK */}
        <div className="text-center space-y-1 mb-8">
          <h1 
            className="text-4xl md:text-5xl font-mono font-black tracking-widest transition-all duration-300"
            style={{
              textShadow: `0 0 ${Math.round(15 * vol)}px ${themeColor}, 0 0 ${Math.round(30 * vol)}px ${themeColor}`,
              color: isBassHit ? '#ffffff' : '#f4f4f5'
            }}
          >
            {timeStr || '12:00:00'}
          </h1>
          <p className="text-xs font-mono text-zinc-500 tracking-widest uppercase font-semibold">
            {dateStr || 'Vivo Screen-Off Display'}
          </p>
        </div>

        {/* VIVO T4 DYNAMIC LIGHT RING WITH DYNAMIC AUDIO RAY SPIKES */}
        <div className="relative w-64 h-64 flex items-center justify-center">
          
          {/* Outermost Pulsing Ambient Aura */}
          <div 
            className="absolute inset-0 rounded-full transition-all duration-150 opacity-60"
            style={{
              background: `radial-gradient(circle, ${themeColor} 0%, transparent 70%)`,
              transform: `scale(${1 + vol * 0.4})`,
              filter: `blur(${Math.round(20 + vol * 25)}px)`
            }}
          />

          {/* SVG DYNAMIC AUDIO RAY SPIKES RADIATING FROM VIVO T4 DISK */}
          <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
            {Array.from({ length: 36 }).map((_, i) => {
              const angle = (i * 360) / 36;
              const rad = (angle * Math.PI) / 180;
              const innerR = 85;
              const spikeLen = 10 + vol * 35 * (0.5 + 0.5 * Math.sin(i * 0.8 + (isPlaying ? stats.bpm * 0.05 : 0)));
              const x1 = 128 + Math.cos(rad) * innerR;
              const y1 = 128 + Math.sin(rad) * innerR;
              const x2 = 128 + Math.cos(rad) * (innerR + spikeLen);
              const y2 = 128 + Math.sin(rad) * (innerR + spikeLen);

              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={themeColor}
                  strokeWidth={i % 3 === 0 ? "2.5" : "1.5"}
                  strokeLinecap="round"
                  opacity={isPlaying ? Math.min(1.0, 0.4 + vol) : 0.2}
                  style={{
                    filter: `drop-shadow(0 0 6px ${themeColor})`
                  }}
                />
              );
            })}
          </svg>

          {/* Concentric Pulsing Light Rings */}
          <div 
            className="absolute inset-4 rounded-full border-2 transition-all duration-150"
            style={{
              borderColor: themeColor,
              boxShadow: `0 0 ${Math.round(20 * vol)}px ${themeColor}`,
              transform: `scale(${1 + vol * 0.15})`
            }}
          />
          <div 
            className="absolute inset-8 rounded-full border border-dashed transition-all duration-150 opacity-80"
            style={{
              borderColor: '#ffffff',
              transform: `rotate(${isPlaying ? (stats.bpm || 120) : 0}deg) scale(${1 + vol * 0.1})`
            }}
          />

          {/* Central Spinning Vinyl Album Disc */}
          <div 
            className="w-36 h-36 rounded-full bg-zinc-950 border-4 border-zinc-900 shadow-2xl flex items-center justify-center relative overflow-hidden transition-all duration-300"
            style={{
              boxShadow: `0 0 30px ${themeColor}`,
            }}
          >
            {options.centerImageUrl ? (
              <img
                src={options.centerImageUrl}
                alt="Album Cover"
                className={`w-full h-full object-cover ${isPlaying ? 'animate-[spin_10s_linear_infinite]' : ''}`}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center">
                <Disc className={`w-12 h-12 text-pink-500 ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}`} />
              </div>
            )}

            <div className="absolute w-6 h-6 rounded-full bg-black border-2 border-zinc-800 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-pink-500" />
            </div>
          </div>
        </div>

        {/* SONG TITLE & ARTIST INFO */}
        <div className="text-center mt-8 space-y-1">
          <h2 className="text-sm font-bold tracking-wide text-zinc-100 truncate max-w-[260px] mx-auto">
            {audioFileName || 'AuraPulse Sound Track'}
          </h2>
          <div className="flex items-center justify-center space-x-1 text-[10px] text-pink-400 font-mono">
            <Sparkles className="w-3 h-3 text-pink-400 animate-spin" />
            <span>Vivo T4 Dynamic Music Light Active</span>
          </div>
        </div>

        {/* EQUALIZER BARS */}
        <div className="flex items-end justify-center space-x-1 h-6 mt-4">
          {Array.from({ length: 12 }).map((_, idx) => {
            const h = isPlaying ? Math.max(15, (stats.volume * 100) * Math.sin(idx * 0.6 + 1) ** 2) : 20;
            return (
              <div
                key={idx}
                className="w-1 rounded-full transition-all duration-100"
                style={{
                  height: `${Math.min(100, Math.max(15, h))}%`,
                  backgroundColor: themeColor,
                  boxShadow: `0 0 6px ${themeColor}`
                }}
              />
            );
          })}
        </div>
      </div>

      {/* BOTTOM CONTROLS & EXIT FOOTER */}
      <div className="w-full max-w-md flex flex-col items-center space-y-3 z-20 pb-4">
        {/* Play/Pause Button */}
        <button
          onClick={onTogglePlay}
          className="w-14 h-14 rounded-full bg-gradient-to-tr from-pink-500 to-cyan-400 text-white flex items-center justify-center shadow-[0_0_25px_rgba(236,72,153,0.5)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current translate-x-0.5" />}
        </button>

        <span className="text-[9px] font-mono text-zinc-500 tracking-widest uppercase">
          Tap close to return to visualizer editor
        </span>
      </div>
    </div>
  );
}
