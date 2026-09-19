import { ChangeEvent } from 'react';
import { VisualizerOptions, COLOR_PRESETS } from '../types';
import { PRESET_BACKGROUNDS, PRESET_CENTERS } from '../data/images';
import { 
  Sliders, 
  Volume2, 
  Sparkles, 
  Zap, 
  Compass, 
  Eye, 
  Radio, 
  Upload, 
  Music, 
  Mic, 
  ToggleLeft, 
  ToggleRight, 
  Maximize2,
  Image,
  Trash2
} from 'lucide-react';

interface SettingsPanelProps {
  options: VisualizerOptions;
  onChange: (options: VisualizerOptions) => void;
  audioFileName: string | null;
  onFileUpload: (file: File) => void;
  stats: {
    rms: number;
    currentGain: number;
    easingFactor: number;
    isTransient: boolean;
  };
}

export default function SettingsPanel({
  options,
  onChange,
  audioFileName,
  onFileUpload,
  stats,
}: SettingsPanelProps) {
  const updateOption = <K extends keyof VisualizerOptions>(key: K, value: VisualizerOptions[K]) => {
    onChange({
      ...options,
      [key]: value,
    });
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
    }
  };

  const handleBgImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          updateOption('backgroundImageUrl', event.target.result as string);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleCenterImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          updateOption('centerImageUrl', event.target.result as string);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-zinc-950/80 backdrop-blur-xl border border-zinc-800/80 rounded-2xl overflow-y-auto text-zinc-100 p-5 space-y-6" id="settings-panel-root">
      {/* Title Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4">
        <div className="flex items-center space-x-2.5">
          <Sliders className="w-5 h-5 text-pink-500" />
          <h2 className="font-display font-bold text-lg tracking-wide uppercase bg-gradient-to-r from-pink-500 to-cyan-400 bg-clip-text text-transparent">
            Aura Engine Controls
          </h2>
        </div>
        <div className="flex items-center space-x-1 font-mono text-[10px] text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800">
          <span className={stats.isTransient ? "w-1.5 h-1.5 rounded-full bg-pink-500 animate-ping" : "w-1.5 h-1.5 rounded-full bg-zinc-600"} />
          <span>BEAT SYNC</span>
        </div>
      </div>

      {/* AUDIO SOURCE SELECTOR */}
      <div className="space-y-3">
        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center space-x-1.5">
          <Radio className="w-3.5 h-3.5 text-cyan-400" />
          <span>Input Source</span>
        </label>
        
        <div className="grid grid-cols-2 gap-2" id="source-buttons-container">
          <button
            onClick={() => updateOption('audioSource', 'synth-phonk')}
            className={`flex items-center space-x-2 p-2.5 rounded-xl border text-xs font-medium transition-all duration-200 ${
              options.audioSource === 'synth-phonk'
                ? 'bg-pink-500/10 border-pink-500/50 text-pink-400 shadow-[0_0_12px_rgba(236,72,153,0.15)]'
                : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400'
            }`}
          >
            <Music className="w-4 h-4 shrink-0" />
            <div className="text-left leading-tight truncate">
              <span className="block font-bold">Phonk Demo</span>
              <span className="text-[10px] text-zinc-500">Aggressive Beat</span>
            </div>
          </button>

          <button
            onClick={() => updateOption('audioSource', 'synth-ambient')}
            className={`flex items-center space-x-2 p-2.5 rounded-xl border text-xs font-medium transition-all duration-200 ${
              options.audioSource === 'synth-ambient'
                ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400'
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <div className="text-left leading-tight truncate">
              <span className="block font-bold">Ambient Demo</span>
              <span className="text-[10px] text-zinc-500">Soft & Ethereal</span>
            </div>
          </button>

          <button
            onClick={() => updateOption('audioSource', 'microphone')}
            className={`flex items-center space-x-2 p-2.5 rounded-xl border text-xs font-medium transition-all duration-200 ${
              options.audioSource === 'microphone'
                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400'
            }`}
          >
            <Mic className="w-4 h-4 shrink-0" />
            <div className="text-left leading-tight truncate">
              <span className="block font-bold">Live Mic</span>
              <span className="text-[10px] text-zinc-500">External Voice</span>
            </div>
          </button>

          <button
            onClick={() => updateOption('audioSource', 'file')}
            className={`flex items-center space-x-2 p-2.5 rounded-xl border text-xs font-medium transition-all duration-200 ${
              options.audioSource === 'file'
                ? 'bg-violet-500/10 border-violet-500/50 text-violet-400 shadow-[0_0_12px_rgba(139,92,246,0.15)]'
                : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400'
            }`}
          >
            <Upload className="w-4 h-4 shrink-0" />
            <div className="text-left leading-tight truncate">
              <span className="block font-bold">Audio File</span>
              <span className="text-[10px] text-zinc-500">Upload MP3/WAV</span>
            </div>
          </button>
        </div>

        {/* File uploader row if 'file' source is selected */}
        {options.audioSource === 'file' && (
          <div className="mt-2 bg-zinc-900/50 rounded-xl p-3 border border-zinc-800/80 flex flex-col items-center justify-center text-center space-y-2">
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="hidden"
              id="audio-file-selector"
            />
            <label
              htmlFor="audio-file-selector"
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-zinc-850 hover:bg-zinc-800 border border-zinc-700/60 rounded-lg text-xs font-medium text-zinc-200 cursor-pointer transition-colors duration-150"
            >
              <Upload className="w-3.5 h-3.5 text-zinc-400" />
              <span>{audioFileName ? 'Change Audio File' : 'Choose Local File'}</span>
            </label>
            {audioFileName && (
              <span className="text-[10px] font-mono text-zinc-400 truncate max-w-full">
                Selected: {audioFileName}
              </span>
            )}
          </div>
        )}
      </div>

      {/* VISUALIZATION STYLE MODES */}
      <div className="space-y-3">
        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center space-x-1.5">
          <Eye className="w-3.5 h-3.5 text-pink-500" />
          <span>Visualizer Mode</span>
        </label>
        <div className="grid grid-cols-3 gap-1.5" id="viz-modes-container">
          {(['spikes', 'liquid-wave', 'bar-chart', 'particle-blast'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => updateOption('visualizationMode', mode)}
              className={`p-2 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all duration-150 ${
                options.visualizationMode === mode
                  ? 'bg-zinc-800 border-zinc-500 text-white shadow-md'
                  : 'bg-zinc-900 border-zinc-800/80 text-zinc-500 hover:border-zinc-700/60 hover:text-zinc-300'
              }`}
            >
              {mode.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* AUDIO ENGINE TUNERS */}
      <div className="space-y-4">
        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center space-x-1.5">
          <Zap className="w-3.5 h-3.5 text-yellow-500" />
          <span>Physics & AGC Controls</span>
        </label>

        {/* AGC Switcher */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/50">
          <div>
            <span className="block text-xs font-bold text-zinc-200">Dynamic AGC (Vibe Match)</span>
            <span className="block text-[10px] text-zinc-500">Auto +24dB boost for soft acoustic passages</span>
          </div>
          <button
            onClick={() => updateOption('useAgc', !options.useAgc)}
            className="text-zinc-400 hover:text-white transition-colors duration-150"
          >
            {options.useAgc ? (
              <ToggleRight className="w-9 h-9 text-pink-500" />
            ) : (
              <ToggleLeft className="w-9 h-9 text-zinc-600" />
            )}
          </button>
        </div>

        {/* Adaptive Easing Switcher */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/50">
          <div>
            <span className="block text-xs font-bold text-zinc-200">Transient Adaptive Easing</span>
            <span className="block text-[10px] text-zinc-500">Fluid liquid drift with aggressive snapping kick drops</span>
          </div>
          <button
            onClick={() => updateOption('useDynamicEasing', !options.useDynamicEasing)}
            className="text-zinc-400 hover:text-white transition-colors duration-150"
          >
            {options.useDynamicEasing ? (
              <ToggleRight className="w-9 h-9 text-cyan-400" />
            ) : (
              <ToggleLeft className="w-9 h-9 text-zinc-600" />
            )}
          </button>
        </div>
      </div>

      {/* MAIN RENDERING LOOPS SLIDERS */}
      <div className="space-y-4 border-t border-zinc-800/60 pt-4">
        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center space-x-1.5">
          <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
          <span>Glow & Scale Multipliers</span>
        </label>

        {/* Sensitivity */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-400">Audio Sensitivity</span>
            <span className="font-mono text-cyan-400 font-semibold">{options.sensitivity.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.3"
            max="3.5"
            step="0.1"
            value={options.sensitivity}
            onChange={(e) => updateOption('sensitivity', parseFloat(e.target.value))}
            className="w-full accent-cyan-400 bg-zinc-800 rounded-lg appearance-none h-1.5"
          />
        </div>

        {/* Thickness */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-400">Line Thickness</span>
            <span className="font-mono text-pink-400 font-semibold">{options.lineWidth.toFixed(1)}px</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="6.0"
            step="0.2"
            value={options.lineWidth}
            onChange={(e) => updateOption('lineWidth', parseFloat(e.target.value))}
            className="w-full accent-pink-500 bg-zinc-800 rounded-lg appearance-none h-1.5"
          />
        </div>

        {/* Radius */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-400">Base Radius / Scale</span>
            <span className="font-mono text-purple-400 font-semibold">{(options.radius * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="1.6"
            step="0.05"
            value={options.radius}
            onChange={(e) => updateOption('radius', parseFloat(e.target.value))}
            className="w-full accent-purple-500 bg-zinc-800 rounded-lg appearance-none h-1.5"
          />
        </div>

        {/* Glow */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-400">Neon Glow Intensity</span>
            <span className="font-mono text-yellow-400 font-semibold">{(options.glowIntensity * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="2.5"
            step="0.1"
            value={options.glowIntensity}
            onChange={(e) => updateOption('glowIntensity', parseFloat(e.target.value))}
            className="w-full accent-yellow-400 bg-zinc-800 rounded-lg appearance-none h-1.5"
          />
        </div>
      </div>

      {/* COLOR THEME SELECTOR */}
      <div className="space-y-3 border-t border-zinc-800/60 pt-4">
        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center space-x-1.5">
          <Compass className="w-3.5 h-3.5 text-purple-400" />
          <span>Neon Laser Palette</span>
        </label>
        <div className="grid grid-cols-2 gap-2" id="laser-presets-container">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => updateOption('colorTheme', preset.id)}
              className={`flex items-center space-x-2.5 p-2 rounded-xl border text-xs font-medium text-left transition-all duration-150 ${
                options.colorTheme === preset.id
                  ? 'bg-zinc-800 border-zinc-400 text-white shadow-inner'
                  : 'bg-zinc-900 border-zinc-900 text-zinc-400 hover:border-zinc-800 hover:text-zinc-300'
              }`}
            >
              <div 
                className="w-3 h-3 rounded-full border border-black/40 shrink-0" 
                style={{ 
                  background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})`,
                  boxShadow: `0 0 6px ${preset.glow}`
                }} 
              />
              <span className="truncate">{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* BACKGROUND IMAGE TUNING */}
      <div className="space-y-4 border-t border-zinc-800/60 pt-4" id="bg-customization-panel">
        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center space-x-1.5">
          <Image className="w-3.5 h-3.5 text-pink-500" />
          <span>Background Customization</span>
        </label>

        {/* Preset Gallery */}
        <div className="space-y-2">
          <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Select Preset Background</span>
          <div className="grid grid-cols-5 gap-1.5">
            {PRESET_BACKGROUNDS.map((bg) => (
              <button
                key={bg.name}
                onClick={() => updateOption('backgroundImageUrl', bg.url)}
                className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                  options.backgroundImageUrl === bg.url 
                    ? 'border-pink-500 scale-95 shadow-[0_0_10px_rgba(236,72,153,0.3)]' 
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
                title={bg.name}
              >
                <img src={bg.thumbnail} alt={bg.name} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Upload Custom BG */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <input
              type="file"
              accept="image/*"
              onChange={handleBgImageUpload}
              className="hidden"
              id="bg-image-uploader"
            />
            <label
              htmlFor="bg-image-uploader"
              className="flex items-center justify-center space-x-2 px-3 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs font-medium text-zinc-300 cursor-pointer transition-colors duration-150"
            >
              <Upload className="w-3.5 h-3.5 text-zinc-400" />
              <span>Upload Background</span>
            </label>
          </div>
          {options.backgroundImageUrl && (
            <button
              onClick={() => updateOption('backgroundImageUrl', null)}
              className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/30 transition-colors shrink-0"
              title="Remove Background"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Opacity Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-400">Background Opacity</span>
            <span className="font-mono text-pink-400 font-semibold">{((options.bgOpacity !== undefined ? options.bgOpacity : 0.45) * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={options.bgOpacity !== undefined ? options.bgOpacity : 0.45}
            onChange={(e) => updateOption('bgOpacity', parseFloat(e.target.value))}
            className="w-full accent-pink-500 bg-zinc-800 rounded-lg appearance-none h-1.5"
          />
        </div>

        {/* Blur Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-400">Background Blur</span>
            <span className="font-mono text-cyan-400 font-semibold">{(options.bgBlur !== undefined ? options.bgBlur : 10)}px</span>
          </div>
          <input
            type="range"
            min="0"
            max="30"
            step="1"
            value={options.bgBlur !== undefined ? options.bgBlur : 10}
            onChange={(e) => updateOption('bgBlur', parseInt(e.target.value, 10))}
            className="w-full accent-cyan-400 bg-zinc-800 rounded-lg appearance-none h-1.5"
          />
        </div>
      </div>

      {/* CENTER DISC IMAGE TUNING */}
      <div className="space-y-4 border-t border-zinc-800/60 pt-4" id="center-customization-panel">
        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center space-x-1.5">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Center Circle Customization</span>
        </label>

        {/* Preset Gallery */}
        <div className="space-y-2">
          <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Select Preset Center Artwork</span>
          <div className="grid grid-cols-4 gap-1.5">
            {PRESET_CENTERS.map((cnt) => (
              <button
                key={cnt.name}
                onClick={() => updateOption('centerImageUrl', cnt.url)}
                className={`relative aspect-square rounded-full overflow-hidden border-2 transition-all ${
                  options.centerImageUrl === cnt.url 
                    ? 'border-cyan-400 scale-95 shadow-[0_0_10px_rgba(34,211,238,0.3)]' 
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
                title={cnt.name}
              >
                <img src={cnt.thumbnail} alt={cnt.name} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Upload Custom Center */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <input
              type="file"
              accept="image/*"
              onChange={handleCenterImageUpload}
              className="hidden"
              id="center-image-uploader"
            />
            <label
              htmlFor="center-image-uploader"
              className="flex items-center justify-center space-x-2 px-3 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs font-medium text-zinc-300 cursor-pointer transition-colors duration-150"
            >
              <Upload className="w-3.5 h-3.5 text-zinc-400" />
              <span>Upload Center Artwork</span>
            </label>
          </div>
          {options.centerImageUrl && (
            <button
              onClick={() => updateOption('centerImageUrl', null)}
              className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/30 transition-colors shrink-0"
              title="Remove Center Artwork"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* CIRCULAR COVERAGE TOGGLE */}
      <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/50">
        <div className="flex items-center space-x-2">
          <Maximize2 className="w-4 h-4 text-purple-400 shrink-0" />
          <div>
            <span className="block text-xs font-bold text-zinc-200">360° Full Circle Coverage</span>
            <span className="block text-[10px] text-zinc-500">Draws around the full circle radius</span>
          </div>
        </div>
        <button
          onClick={() => updateOption('fullCoverage', !options.fullCoverage)}
          className="text-zinc-400 hover:text-white transition-colors duration-150"
        >
          {options.fullCoverage ? (
            <ToggleRight className="w-9 h-9 text-purple-500" />
          ) : (
            <ToggleLeft className="w-9 h-9 text-zinc-600" />
          )}
        </button>
      </div>

      {/* AUDIO ENGINE LIVE METRICS MONITOR */}
      <div className="bg-zinc-900/80 border border-zinc-850 rounded-xl p-3.5 space-y-2 font-mono text-[10px] text-zinc-500">
        <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide border-b border-zinc-800 pb-1.5 mb-1.5 flex justify-between">
          <span>Live Audio Metrics</span>
          <span className="text-pink-500">AGC ACTIVE</span>
        </div>
        <div className="flex justify-between">
          <span>AGC Dynamic Boost Gain:</span>
          <span className="text-zinc-300 font-bold">
            +{ (20 * Math.log10(stats.currentGain)).toFixed(1) } dB
          </span>
        </div>
        <div className="flex justify-between">
          <span>Rolling Signal RMS:</span>
          <span className="text-zinc-300 font-bold">
            { stats.rms.toFixed(4) }
          </span>
        </div>
        <div className="flex justify-between">
          <span>Adaptive Easing Factor:</span>
          <span className="text-zinc-300 font-bold">
            { stats.easingFactor.toFixed(3) }
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span>Transient Spike state:</span>
          <span className={`px-1.5 py-0.5 rounded-sm font-bold ${stats.isTransient ? 'bg-pink-500/20 text-pink-400 animate-pulse' : 'bg-zinc-800 text-zinc-600'}`}>
            { stats.isTransient ? 'TRANSIENT DETECTED' : 'QUIET PASSAGE' }
          </span>
        </div>
      </div>
    </div>
  );
}
