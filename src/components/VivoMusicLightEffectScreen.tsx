import React, { useState } from 'react';
import { VisualizerOptions, AudioStats } from '../types';
import { ChevronLeft, Check, Sparkles, Play, Pause, PowerOff, Sliders, Palette, Zap, Maximize2, Volume2, Gauge, RotateCw, Lock, Crown } from 'lucide-react';
import VivoLeftRightEdgeLights from './VivoLeftRightEdgeLights';
import { MonetizationState } from '../utils/monetization';

interface VivoMusicLightEffectScreenProps {
  options: VisualizerOptions;
  stats: AudioStats;
  isPlaying: boolean;
  monetization: MonetizationState;
  onTogglePlay: () => void;
  onClose: () => void;
  onUpdateOption: <K extends keyof VisualizerOptions>(key: K, value: VisualizerOptions[K]) => void;
  onRequestUnlockEffect: (preset: LightEffectPreset) => void;
  onOpenPremium: () => void;
}

export interface LightEffectPreset {
  id: 'dynamic-rainbow' | 'clockwise-rgb' | 'toxic-aurora' | 'sunset-glow' | 'vivo-soundwave' | 'vivo-sour' | 'vivo-aurora' | 'vivo-rgb-spectrum' | 'none';
  name: string;
  type: 'dynamic-flow' | 'vivo-music' | 'none';
  colorPrimary: string;
  colorSecondary: string;
  gradientCss: string;
  description: string;
}

export const LIGHT_PRESETS: LightEffectPreset[] = [
  // 1. OFFICIAL VIVO T4 MUSIC & NOTIFICATION PRESETS (Left & Right Screen Edges Only)
  {
    id: 'vivo-soundwave',
    name: 'Sound wave',
    type: 'vivo-music',
    colorPrimary: '#00f0ff',
    colorSecondary: '#b000ff',
    gradientCss: 'linear-gradient(180deg, #00f0ff 0%, #0066ff 50%, #b000ff 100%)',
    description: 'Official Vivo T4 Left & Right Silk Sound Wave'
  },
  {
    id: 'vivo-rgb-spectrum',
    name: 'RGB Disco',
    type: 'vivo-music',
    colorPrimary: '#ff0055',
    colorSecondary: '#00f0ff',
    gradientCss: 'linear-gradient(180deg, #ff0055 0%, #ffaa00 25%, #00ff66 50%, #00f0ff 75%, #b000ff 100%)',
    description: 'Full Screen 360° RGB Disco Lights (Top, Bottom, Left & Right perimeter covering full phone with real-time sound-reactive disco color transitions)'
  },
  {
    id: 'vivo-aurora',
    name: 'Aurora',
    type: 'vivo-music',
    colorPrimary: '#00ffcc',
    colorSecondary: '#0077ff',
    gradientCss: 'linear-gradient(180deg, #00ffcc 0%, #00d2ff 50%, #0077ff 100%)',
    description: 'Official Vivo T4 Left & Right Breathing Aura'
  },

  // 2. DYNAMIC RGB FLOW PRESETS (360 Degree Continuous Rotating Edges)
  {
    id: 'dynamic-rainbow',
    name: 'Dynamic RGB',
    type: 'dynamic-flow',
    colorPrimary: '#00f0ff',
    colorSecondary: '#ff007f',
    gradientCss: 'linear-gradient(135deg, #ff0000 0%, #ff7700 20%, #ffee00 40%, #00ff66 60%, #00f0ff 80%, #b000ff 100%)',
    description: '7-Color Flowing Rainbow Glow'
  },
  {
    id: 'clockwise-rgb',
    name: 'Clockwise RGB',
    type: 'dynamic-flow',
    colorPrimary: '#ff0055',
    colorSecondary: '#00f0ff',
    gradientCss: 'linear-gradient(135deg, #ff0000, #ffaa00, #00ff66, #00f0ff, #b000ff)',
    description: 'RGB Laser Continuous Clockwise Chase with 0 Gaps'
  },
  {
    id: 'toxic-aurora',
    name: 'Toxic Aurora',
    type: 'dynamic-flow',
    colorPrimary: '#39ff14',
    colorSecondary: '#00ffcc',
    gradientCss: 'linear-gradient(135deg, #39ff14 0%, #00ff88 40%, #00ffcc 70%, #ccff00 100%)',
    description: 'Acid Neon Lime & Bright Aqua Flow'
  },
  {
    id: 'sunset-glow',
    name: 'Sunset Flare',
    type: 'dynamic-flow',
    colorPrimary: '#ff0033',
    colorSecondary: '#ffee00',
    gradientCss: 'linear-gradient(135deg, #ff0033 0%, #ff4500 35%, #ff7700 70%, #ffee00 100%)',
    description: 'Fiery Crimson, Orange & Golden Flare'
  },
  {
    id: 'none',
    name: 'Off',
    type: 'none',
    colorPrimary: '#52525b',
    colorSecondary: '#27272a',
    gradientCss: 'none',
    description: 'Turn off all edge lights'
  }
];

export const VIVO_PRESETS = LIGHT_PRESETS;

const CUSTOM_COLORS = [
  { label: 'RGB Rainbow', hex: 'rainbow', isRainbow: true },
  { label: 'Clockwise RGB', hex: 'clockwise', isClockwise: true },
  { label: 'Toxic Lime/Aqua', hex: '#39ff14', secondary: '#00ffcc' },
  { label: 'Sunset Crimson', hex: '#ff0033', secondary: '#ffee00' },
  { label: 'Electric Blue', hex: '#0066ff', secondary: '#00e5ff' },
  { label: 'Deep Purple', hex: '#b000ff', secondary: '#ff007f' },
  { label: 'Pure White', hex: '#ffffff', secondary: '#00f0ff' },
];

export default function VivoMusicLightEffectScreen({
  options,
  stats,
  isPlaying,
  monetization,
  onTogglePlay,
  onClose,
  onUpdateOption,
  onRequestUnlockEffect,
  onOpenPremium
}: VivoMusicLightEffectScreenProps) {
  // Preset Selection
  const initialPreset = (options.ambientEdgePreset && options.ambientEdgePreset !== 'none')
    ? (options.ambientEdgePreset === 'vivo-sour' ? 'vivo-soundwave' : options.ambientEdgePreset)
    : 'vivo-soundwave';

  const [selectedPresetId, setSelectedPresetId] = useState<LightEffectPreset['id']>(initialPreset as any);
  
  const [lightMode, setLightMode] = useState<'dynamic-flow' | 'vivo-music'>(
    selectedPresetId.startsWith('vivo-') || options.ambientEdgeStyle === 'vivo-reactive' || options.ambientEdgeMode === 'vivo-music'
      ? 'vivo-music' 
      : 'dynamic-flow'
  );
  
  const [activeTab, setActiveTab] = useState<'presets' | 'customize'>('presets');
  const [customColor, setCustomColor] = useState<string>(options.ambientEdgeColor || '#00f0ff');
  
  // Continuous slider for thickness: strictly 1 to 10 px
  const [thicknessPx, setThicknessPx] = useState<number>(
    Math.min(10, Math.max(1, options.ambientEdgeWidth ?? 4))
  );
  
  // Lights speed slider: 1 (Slow) to 5 (Fast)
  const [speedVal, setSpeedVal] = useState<number>(
    Math.min(5, Math.max(1, options.ambientEdgeSpeed ?? 3))
  );
  
  // Glow spread blur: 4 to 36 px
  const [glowBlur, setGlowBlur] = useState<number>(
    Math.min(36, Math.max(4, options.ambientEdgeGlow ?? 16))
  );

  const [appliedToast, setAppliedToast] = useState<boolean>(false);

  const activePreset = LIGHT_PRESETS.find(p => p.id === selectedPresetId) || LIGHT_PRESETS[0];

  const isPresetUnlocked = (presetId: string) => {
    if (presetId === 'none' || presetId === 'vivo-soundwave' || presetId === 'vivo-aurora') return true;
    if (monetization.isPremium) return true;
    return monetization.unlockedEffects.includes(presetId);
  };

  const handleSelectPreset = (preset: LightEffectPreset) => {
    if (!isPresetUnlocked(preset.id)) {
      onRequestUnlockEffect(preset);
      return;
    }
    setSelectedPresetId(preset.id);
    if (preset.id !== 'none') {
      setLightMode(preset.type === 'vivo-music' ? 'vivo-music' : 'dynamic-flow');
      setCustomColor(preset.colorPrimary);
    }
  };

  const handleApply = () => {
    if (selectedPresetId === 'none') {
      onUpdateOption('ambientEdgeEnabled', false);
      onUpdateOption('ambientEdgePreset', 'none');
    } else {
      onUpdateOption('ambientEdgeEnabled', true);
      onUpdateOption('ambientEdgePreset', selectedPresetId as any);
      onUpdateOption('ambientEdgeWidth', thicknessPx);
      onUpdateOption('ambientEdgeSpeed', speedVal);
      onUpdateOption('ambientEdgeGlow', glowBlur);
      onUpdateOption('ambientEdgeColor', customColor);
      onUpdateOption('customColor', customColor);
      
      if (lightMode === 'dynamic-flow') {
        onUpdateOption('ambientEdgeStyle', 'dynamic-rgb-flow');
        onUpdateOption('ambientEdgeMode', 'dynamic-flow');
        onUpdateOption('ambientEdgeAudioReactive', false);
        onUpdateOption('ambientEdgeTriggerCondition', 'always-screen-on-off');
      } else {
        onUpdateOption('ambientEdgeStyle', 'vivo-reactive');
        onUpdateOption('ambientEdgeMode', 'vivo-music');
        onUpdateOption('ambientEdgeAudioReactive', true);
        onUpdateOption('ambientEdgeTriggerCondition', 'screen-off-music');
      }
    }

    // Show applied feedback and stay on the screen
    setAppliedToast(true);
    setTimeout(() => {
      setAppliedToast(false);
    }, 1800);
  };

  const toggleBrowserFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          (document.documentElement as any).webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        }
      }
    } catch (e) {
      console.warn('Fullscreen request failed:', e);
    }
  };

  const animDuration = Math.max(0.8, 7.5 - speedVal * 1.2);

  return (
    <div className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col justify-between p-3 select-none font-sans overflow-hidden animate-fade-in h-[100dvh]">
      
      {/* 1. TOP NAVIGATION HEADER */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between pt-1 pb-1 shrink-0 z-30 relative">
        <button
          onClick={onClose}
          className="px-2.5 py-1.5 text-white hover:text-zinc-200 transition-colors flex items-center space-x-1 justify-center cursor-pointer rounded-full bg-zinc-900/90 border border-zinc-700/80 shadow-md active:scale-95"
          title="Back to Visualizer"
          id="btn-vivo-back"
        >
          <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
          <span className="text-[11px] font-bold">Back</span>
        </button>

        {/* Tab switcher: Presets vs Customise */}
        <div className="flex items-center space-x-1 bg-zinc-900 border border-zinc-800 rounded-full p-1">
          <button
            onClick={() => setActiveTab('presets')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
              activeTab === 'presets' ? 'bg-cyan-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>Presets</span>
          </button>
          <button
            onClick={() => setActiveTab('customize')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
              activeTab === 'customize' ? 'bg-cyan-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3 h-3" />
            <span>Customise</span>
          </button>
        </div>

        {/* Right Action Icon: Sound preview */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={onTogglePlay}
            className={`p-1.5 rounded-full border transition-all cursor-pointer flex items-center justify-center ${
              isPlaying 
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
            }`}
            title={isPlaying ? 'Pause Audio Preview' : 'Play Audio Preview'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. MODE SELECTOR (Vivo T4 Left-Right Edge Reactive vs Dynamic 360 Flow) */}
      <div className="w-full max-w-md mx-auto grid grid-cols-2 gap-2 shrink-0 z-20">
        <button
          onClick={() => {
            setLightMode('vivo-music');
            if (!selectedPresetId.startsWith('vivo-')) {
              setSelectedPresetId('vivo-soundwave');
              setCustomColor('#00f0ff');
            }
          }}
          className={`py-2 px-2.5 rounded-xl border flex items-center space-x-2 transition-all cursor-pointer ${
            lightMode === 'vivo-music'
              ? 'bg-gradient-to-r from-blue-600/25 to-purple-600/25 border-blue-400 text-blue-300 shadow-[0_0_12px_rgba(0,102,255,0.3)] font-bold'
              : 'bg-zinc-900/70 border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className="w-6 h-6 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
            <Volume2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          </div>
          <div className="text-left min-w-0 flex-1">
            <span className="text-[11px] block font-semibold leading-tight truncate">Vivo T4 Music Light</span>
            <span className="text-[8px] text-blue-300/80 block font-normal mt-0.5 truncate">Screen Off + Song Playing</span>
          </div>
        </button>

        <button
          onClick={() => {
            setLightMode('dynamic-flow');
            if (selectedPresetId.startsWith('vivo-')) {
              setSelectedPresetId('dynamic-rainbow');
            }
          }}
          className={`py-2 px-2.5 rounded-xl border flex items-center space-x-2 transition-all cursor-pointer ${
            lightMode === 'dynamic-flow'
              ? 'bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.3)] font-bold'
              : 'bg-zinc-900/70 border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className="w-6 h-6 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <RotateCw className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          </div>
          <div className="text-left min-w-0 flex-1">
            <span className="text-[11px] block font-semibold leading-tight truncate">Dynamic 360 RGB</span>
            <span className="text-[8px] text-cyan-300/80 block font-normal mt-0.5 truncate">Screen On & Off Both</span>
          </div>
        </button>
      </div>

      {/* 3. PHONE PREVIEW SCREEN (MATCHING OFFICIAL VIVO T4 UI REFERENCE IMAGE) */}
      <div className="flex-1 flex items-center justify-center relative min-h-0 py-1 overflow-hidden">
        
        {/* Curved Vivo Smartphone Chassis Container */}
        <div 
          className="relative w-[215px] h-[390px] sm:w-[240px] sm:h-[435px] max-h-[48vh] rounded-[36px] p-2 bg-[#09090d] border-[3px] border-zinc-700/80 ring-1 ring-white/10 shadow-[0_0_50px_rgba(0,0,0,0.95)] flex flex-col items-center justify-center overflow-hidden transition-all duration-300"
          style={{
            boxShadow: selectedPresetId !== 'none'
              ? `0 0 35px ${activePreset.colorPrimary}25, 0 10px 40px rgba(0,0,0,0.85)`
              : '0 10px 40px rgba(0,0,0,0.85)'
          }}
        >
          {/* Top Speaker Earphone Grill */}
          <div className="absolute top-1.5 w-10 h-1 bg-zinc-700 rounded-full z-30 opacity-70" />

          {/* Pure AMOLED OLED Display Area with Curved Screen Corners */}
          <div className="relative w-full h-full rounded-[28px] bg-[#000000] overflow-hidden flex flex-col justify-center items-center select-none border border-zinc-900 shadow-inner">

            {/* Status Badge inside Phone Preview */}
            {selectedPresetId !== 'none' && (
              <div className="absolute top-3.5 z-30 pointer-events-none">
                {options.ambientEdgeEnabled && options.ambientEdgePreset === selectedPresetId ? (
                  <div className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[7.5px] font-mono font-bold text-emerald-300 flex items-center space-x-1 shadow-md backdrop-blur-sm">
                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                    <span>APPLIED ON SCREEN</span>
                  </div>
                ) : (
                  <div className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/35 text-[7.5px] font-mono font-bold text-cyan-300 flex items-center space-x-1 shadow-md backdrop-blur-sm">
                    <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                    <span>LIVE PREVIEW</span>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* LIVE PREVIEW LIGHT EFFECTS (FULL CLEAR DISPLAY ACCORDING TO USER SELECTION) */}
            {/* ========================================================================= */}
            {selectedPresetId !== 'none' && (
              <>
                {/* 1. VIVO T4 MUSIC LIGHT EFFECT (STRICTLY LEFT AND RIGHT EDGES ONLY) */}
                {(selectedPresetId.startsWith('vivo-') || lightMode === 'vivo-music') && (
                  <VivoLeftRightEdgeLights
                    presetId={selectedPresetId}
                    stats={stats}
                    isPlaying={isPlaying}
                    thicknessPx={thicknessPx}
                    glowBlur={glowBlur}
                    speedVal={speedVal}
                    customColor={customColor}
                    isInsidePhonePreview={true}
                  />
                )}

                {/* 2. Dynamic 7-Color Rainbow (360 Full Border) */}
                {selectedPresetId === 'dynamic-rainbow' && (
                  <div 
                    className="absolute inset-0.5 pointer-events-none rounded-[26px] overflow-hidden animate-dynamic-rgb"
                    style={{ 
                      animationDuration: `${animDuration}s`,
                      filter: `drop-shadow(0 0 ${glowBlur * 0.4}px rgba(0, 240, 255, 0.8)) drop-shadow(0 0 ${glowBlur * 0.9}px rgba(255, 0, 128, 0.9))`
                    }}
                  >
                    <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="preview-rainbow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#ff0000" />
                          <stop offset="16%" stopColor="#ff7700" />
                          <stop offset="33%" stopColor="#ffee00" />
                          <stop offset="50%" stopColor="#00ff66" />
                          <stop offset="66%" stopColor="#00f0ff" />
                          <stop offset="83%" stopColor="#0066ff" />
                          <stop offset="100%" stopColor="#ff007f" />
                        </linearGradient>
                      </defs>
                      <rect
                        x={thicknessPx / 2}
                        y={thicknessPx / 2}
                        width={`calc(100% - ${thicknessPx}px)`}
                        height={`calc(100% - ${thicknessPx}px)`}
                        rx="24"
                        ry="24"
                        fill="none"
                        stroke="url(#preview-rainbow-grad)"
                        strokeWidth={thicknessPx}
                      />
                    </svg>
                  </div>
                )}

                {/* 3. Clockwise RGB (Continuous Seamless Rotating Gradient) */}
                {selectedPresetId === 'clockwise-rgb' && (
                  <div className="absolute inset-0.5 pointer-events-none rounded-[26px] overflow-hidden">
                    <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="preview-clockwise-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#ff0000" />
                          <stop offset="16.6%" stopColor="#ff8800" />
                          <stop offset="33.3%" stopColor="#ffee00" />
                          <stop offset="50%" stopColor="#00ff66" />
                          <stop offset="66.6%" stopColor="#00f0ff" />
                          <stop offset="83.3%" stopColor="#b000ff" />
                          <stop offset="100%" stopColor="#ff0000" />
                          <animateTransform
                            attributeName="gradientTransform"
                            type="rotate"
                            from="0 0.5 0.5"
                            to="360 0.5 0.5"
                            dur={`${animDuration}s`}
                            repeatCount="indefinite"
                          />
                        </linearGradient>
                      </defs>
                      {/* Ambient Glow */}
                      <rect
                        x={thicknessPx / 2}
                        y={thicknessPx / 2}
                        width={`calc(100% - ${thicknessPx}px)`}
                        height={`calc(100% - ${thicknessPx}px)`}
                        rx="24"
                        ry="24"
                        fill="none"
                        stroke="url(#preview-clockwise-grad)"
                        strokeWidth={thicknessPx + 2}
                        style={{
                          filter: `drop-shadow(0 0 ${glowBlur * 0.6}px #00f0ff) drop-shadow(0 0 ${glowBlur * 1.2}px #ff007f)`,
                          opacity: 0.8
                        }}
                      />
                      {/* Sharp Core Border */}
                      <rect
                        x={thicknessPx / 2}
                        y={thicknessPx / 2}
                        width={`calc(100% - ${thicknessPx}px)`}
                        height={`calc(100% - ${thicknessPx}px)`}
                        rx="24"
                        ry="24"
                        fill="none"
                        stroke="url(#preview-clockwise-grad)"
                        strokeWidth={thicknessPx}
                        style={{
                          filter: `drop-shadow(0 0 ${glowBlur * 0.4}px #00f0ff)`,
                          opacity: 1
                        }}
                      />
                    </svg>
                  </div>
                )}

                {/* 4. Toxic Aurora */}
                {selectedPresetId === 'toxic-aurora' && (
                  <div 
                    className="absolute inset-0.5 pointer-events-none rounded-[26px] overflow-hidden animate-toxic-aurora"
                    style={{ 
                      animationDuration: `${animDuration}s`,
                      filter: `drop-shadow(0 0 ${glowBlur * 0.4}px #39ff14) drop-shadow(0 0 ${glowBlur * 0.9}px #00ffcc)`
                    }}
                  >
                    <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="preview-toxic-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#39ff14" />
                          <stop offset="35%" stopColor="#00ff88" />
                          <stop offset="70%" stopColor="#00ffcc" />
                          <stop offset="100%" stopColor="#ccff00" />
                        </linearGradient>
                      </defs>
                      <rect
                        x={thicknessPx / 2}
                        y={thicknessPx / 2}
                        width={`calc(100% - ${thicknessPx}px)`}
                        height={`calc(100% - ${thicknessPx}px)`}
                        rx="24"
                        ry="24"
                        fill="none"
                        stroke="url(#preview-toxic-grad)"
                        strokeWidth={thicknessPx}
                      />
                    </svg>
                  </div>
                )}

                {/* 5. Sunset Flare */}
                {selectedPresetId === 'sunset-glow' && (
                  <div 
                    className="absolute inset-0.5 pointer-events-none rounded-[26px] overflow-hidden animate-sunset-flare"
                    style={{ 
                      animationDuration: `${animDuration}s`,
                      filter: `drop-shadow(0 0 ${glowBlur * 0.4}px #ff0033) drop-shadow(0 0 ${glowBlur * 0.9}px #ffaa00)`
                    }}
                  >
                    <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="preview-sunset-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#ff0033" />
                          <stop offset="35%" stopColor="#ff4500" />
                          <stop offset="70%" stopColor="#ff7700" />
                          <stop offset="100%" stopColor="#ffee00" />
                        </linearGradient>
                      </defs>
                      <rect
                        x={thicknessPx / 2}
                        y={thicknessPx / 2}
                        width={`calc(100% - ${thicknessPx}px)`}
                        height={`calc(100% - ${thicknessPx}px)`}
                        rx="24"
                        ry="24"
                        fill="none"
                        stroke="url(#preview-sunset-grad)"
                        strokeWidth={thicknessPx}
                      />
                    </svg>
                  </div>
                )}
              </>
            )}

            {/* Off State Indicator (Only shown when light is disabled) */}
            {selectedPresetId === 'none' && (
              <span className="text-[9px] font-mono font-bold text-zinc-500 bg-zinc-900/90 px-3 py-1 rounded-full border border-zinc-800">
                LIGHT EFFECT OFF
              </span>
            )}

          </div>
        </div>

      </div>

      {/* 4. BOTTOM CONTROLS (EXACT VIVO T4 THUMBNAIL CARDS & APPLY BUTTON) */}
      <div className="w-full max-w-md mx-auto space-y-2 shrink-0 z-20 pt-1">
        
        {activeTab === 'presets' ? (
          /* PRESET CARDS HORIZONTAL SCROLLER (MATCHING SCREENSHOT 1 & 2) */
          <div className="flex space-x-3 overflow-x-auto scrollbar-none py-1 px-1 items-center justify-start sm:justify-center">
            {LIGHT_PRESETS.filter(p => p.type === 'none' || p.type === lightMode).map((preset) => {
              const isSelected = selectedPresetId === preset.id;
              const isNone = preset.type === 'none';
              const isVivoPreset = preset.id.startsWith('vivo-');

              return (
                <button
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className={`flex flex-col items-center space-y-1.5 shrink-0 cursor-pointer transition-transform ${
                    isSelected ? 'scale-105' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  {/* Thumbnail Frame (Rounded Square matching Screenshot) */}
                  <div 
                    className={`relative w-15 h-16 rounded-2xl bg-[#09090d] p-1 border-2 transition-all flex flex-col justify-between overflow-hidden ${
                      isSelected 
                        ? 'border-[#0080ff] shadow-[0_0_12px_rgba(0,128,255,0.6)] ring-1 ring-[#0080ff]/50' 
                        : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    {isNone ? (
                      <div className="w-full h-full rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-500">
                        <PowerOff className="w-4 h-4" />
                      </div>
                    ) : isVivoPreset ? (
                      /* Left & Right Edge Preview inside thumbnail (Matching Screenshot 1 & 2) */
                      <div className="w-full h-full rounded-xl bg-black relative overflow-hidden flex items-center justify-between px-0.5">
                        {/* Sound Wave Preview (Silk Wave Curves) */}
                        {preset.id === 'vivo-soundwave' && (
                          <div className="w-full h-full relative">
                            {/* Left silk wave */}
                            <svg className="absolute left-0 top-0 h-full w-2.5 pointer-events-none" viewBox="0 0 10 40">
                              <path d="M0,0 Q6,10 2,20 Q8,30 0,40" fill="none" stroke="url(#thumb-sw-grad)" strokeWidth="2" />
                              <defs>
                                <linearGradient id="thumb-sw-grad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#00f7ff" />
                                  <stop offset="50%" stopColor="#0055ff" />
                                  <stop offset="100%" stopColor="#ff00aa" />
                                </linearGradient>
                              </defs>
                            </svg>
                            {/* Right silk wave */}
                            <svg className="absolute right-0 top-0 h-full w-2.5 pointer-events-none" viewBox="0 0 10 40">
                              <path d="M10,0 Q4,10 8,20 Q2,30 10,40" fill="none" stroke="url(#thumb-sw-grad)" strokeWidth="2" />
                            </svg>
                          </div>
                        )}
                        {/* RGB Disco Preview (Full 4-sided 360 border with reactive disco equalizer bars & laser runner) */}
                        {preset.id === 'vivo-rgb-spectrum' && (
                          <div className="w-full h-full relative p-0.5 overflow-hidden rounded-xl">
                            <div 
                              className="w-full h-full rounded-lg border-[1.5px] border-[#00f0ff] shadow-[0_0_8px_#ff0055]"
                              style={{
                                background: 'transparent',
                                borderImage: 'linear-gradient(135deg, #ff0055, #00ff66, #00f0ff, #b000ff) 1'
                              }}
                            />
                            {/* Discrete Equalizer dashes on sides */}
                            <div className="absolute left-0.5 top-2 bottom-2 w-1 flex flex-col justify-between items-center py-0.5">
                              <span className="w-1 h-0.5 bg-[#00f0ff] rounded-full" />
                              <span className="w-1.5 h-0.5 bg-[#00ff88] rounded-full" />
                              <span className="w-1 h-0.5 bg-[#ffff00] rounded-full" />
                            </div>
                            <div className="absolute right-0.5 top-2 bottom-2 w-1 flex flex-col justify-between items-center py-0.5">
                              <span className="w-1 h-0.5 bg-[#ff00aa] rounded-full" />
                              <span className="w-1.5 h-0.5 bg-[#00f0ff] rounded-full" />
                              <span className="w-1 h-0.5 bg-[#00ff88] rounded-full" />
                            </div>
                            {/* Bottom kick EQ dash */}
                            <div className="absolute bottom-0.5 left-2 right-2 flex justify-center gap-0.5">
                              <span className="w-1.5 h-1 bg-[#ff0033] rounded-t-sm" />
                              <span className="w-2 h-1.5 bg-[#ffaa00] rounded-t-sm" />
                              <span className="w-1.5 h-1 bg-[#ff0033] rounded-t-sm" />
                            </div>
                            {/* Orbiting Laser Comet Dot */}
                            <div className="absolute top-0 right-2 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_#00f0ff]" />
                          </div>
                        )}
                        {/* Aurora Preview */}
                        {preset.id === 'vivo-aurora' && (
                          <div className="w-full h-full relative">
                            {/* Left aura */}
                            <div className="absolute left-0 top-0 h-full w-2 bg-gradient-to-b from-[#00ffcc] via-[#00d2ff] to-[#0077ff] rounded-r shadow-[0_0_6px_#00ffcc]" />
                            {/* Right aura */}
                            <div className="absolute right-0 top-0 h-full w-2 bg-gradient-to-b from-[#00ffcc] via-[#00d2ff] to-[#0077ff] rounded-l shadow-[0_0_6px_#00ffcc]" />
                          </div>
                        )}
                      </div>
                    ) : (
                      /* 360 Continuous Border preview */
                      <div className="w-full h-full rounded-xl bg-black relative overflow-hidden flex items-center justify-center p-0.5">
                        <div 
                          className="w-full h-full rounded-lg border-2"
                          style={{ 
                            background: preset.gradientCss,
                            borderColor: preset.colorPrimary,
                            boxShadow: `0 0 6px ${preset.colorPrimary}`
                          }}
                        />
                      </div>
                    )}

                    {/* Selected Checkmark Badge or Lock Badge */}
                    {isSelected ? (
                      <div className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded bg-[#0080ff] text-white flex items-center justify-center shadow-md">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    ) : !isPresetUnlocked(preset.id) ? (
                      <div className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded bg-amber-500/90 text-black flex items-center justify-center shadow-md">
                        <Lock className="w-2 h-2 stroke-[3]" />
                      </div>
                    ) : null}
                  </div>

                  <span className={`text-[10px] font-medium tracking-tight truncate max-w-[70px] flex items-center justify-center space-x-0.5 ${
                    isSelected ? 'text-[#0080ff] font-bold' : 'text-zinc-400'
                  }`}>
                    {!isPresetUnlocked(preset.id) && <Lock className="w-2.5 h-2.5 text-amber-400 inline shrink-0" />}
                    <span className="truncate">{preset.name}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          /* CLEAN, STRUCTURED CUSTOMISE PANEL - ZERO TEXT OVERLAP */
          <div className="bg-zinc-900/95 border border-zinc-800 rounded-xl p-3.5 space-y-3 max-h-[185px] overflow-y-auto scrollbar-none animate-fade-in">
            
            {/* 1. THICKNESS SLIDER STRICTLY 1 to 10 px */}
            <div className="flex flex-col space-y-1.5">
              <div className="flex items-center justify-between text-[11px] leading-tight gap-2">
                <div className="flex items-center space-x-1.5 min-w-0">
                  <div className="w-5 h-5 rounded bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center shrink-0">
                    <Zap className="w-3 h-3 text-cyan-400 shrink-0" />
                  </div>
                  <span className="text-zinc-200 font-semibold truncate">Border Thickness (मोटाई)</span>
                </div>
                <span className="font-mono text-cyan-400 font-bold text-[10px] bg-cyan-950/90 px-2 py-0.5 rounded border border-cyan-800 shrink-0">
                  {thicknessPx} px
                </span>
              </div>
              <div className="flex items-center space-x-2 pt-0.5 px-0.5">
                <span className="text-[9px] font-mono text-zinc-500 shrink-0">1px</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={thicknessPx}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setThicknessPx(val);
                  }}
                  className="w-full h-1.5 bg-zinc-800 accent-cyan-400 rounded-lg cursor-pointer"
                />
                <span className="text-[9px] font-mono text-zinc-500 shrink-0">10px</span>
              </div>
            </div>

            {/* 2. SPEED SLIDER (SLOW / FAST) */}
            <div className="flex flex-col space-y-1.5">
              <div className="flex items-center justify-between text-[11px] leading-tight gap-2">
                <div className="flex items-center space-x-1.5 min-w-0">
                  <div className="w-5 h-5 rounded bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center shrink-0">
                    <Gauge className="w-3 h-3 text-cyan-400 shrink-0" />
                  </div>
                  <span className="text-zinc-200 font-semibold truncate">Flow Speed (गति)</span>
                </div>
                <span className="font-mono text-cyan-400 font-bold text-[10px] bg-cyan-950/90 px-2 py-0.5 rounded border border-cyan-800 shrink-0">
                  {speedVal === 1 ? '1x (Slow)' : speedVal === 5 ? '5x (Fast)' : `${speedVal}x`}
                </span>
              </div>
              <div className="flex items-center space-x-2 pt-0.5 px-0.5">
                <span className="text-[9px] font-mono text-zinc-500 shrink-0">Slow</span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={speedVal}
                  onChange={(e) => setSpeedVal(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 accent-cyan-400 rounded-lg cursor-pointer"
                />
                <span className="text-[9px] font-mono text-zinc-500 shrink-0">Fast</span>
              </div>
            </div>

            {/* 3. GLOW SPREAD SLIDER (HIGH IMPACT 4px to 36px) */}
            <div className="flex flex-col space-y-1.5">
              <div className="flex items-center justify-between text-[11px] leading-tight gap-2">
                <div className="flex items-center space-x-1.5 min-w-0">
                  <div className="w-5 h-5 rounded bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" />
                  </div>
                  <span className="text-zinc-200 font-semibold truncate">Glow Spread (चमक फैलाव)</span>
                </div>
                <span className="font-mono text-cyan-400 font-bold text-[10px] bg-cyan-950/90 px-2 py-0.5 rounded border border-cyan-800 shrink-0">
                  {glowBlur} px
                </span>
              </div>
              <div className="flex items-center space-x-2 pt-0.5 px-0.5">
                <span className="text-[9px] font-mono text-zinc-500 shrink-0">4px (कम)</span>
                <input
                  type="range"
                  min={4}
                  max={36}
                  step={2}
                  value={glowBlur}
                  onChange={(e) => setGlowBlur(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 accent-cyan-400 rounded-lg cursor-pointer"
                />
                <span className="text-[9px] font-mono text-zinc-500 shrink-0">36px (ज्यादा)</span>
              </div>
            </div>

          </div>
        )}

        {/* Applied Toast Alert */}
        {appliedToast && (
          <div className="w-full py-1 bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-center text-[11px] font-bold text-emerald-300 animate-fade-in flex items-center justify-center space-x-1.5">
            <Check className="w-3.5 h-3.5" />
            <span>Vivo Light Effect Applied!</span>
          </div>
        )}

        {/* 5. APPLY BUTTON (MATCHING SCREENSHOT WITH OFFICIAL VIVO BLUE PILL STYLE) */}
        <button
          onClick={handleApply}
          className="w-full py-3.5 rounded-full bg-[#0080ff] hover:bg-[#0070e0] active:scale-98 text-white font-bold text-base shadow-[0_4px_20px_rgba(0,128,255,0.4)] transition-all flex items-center justify-center space-x-2 cursor-pointer"
        >
          <span>Apply</span>
        </button>

      </div>

    </div>
  );
}
