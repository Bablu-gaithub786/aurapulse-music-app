import React from 'react';
import { VisualizerOptions, AudioStats } from '../types';
import VivoLeftRightEdgeLights from './VivoLeftRightEdgeLights';

interface AmbientEdgeGlowProps {
  options: VisualizerOptions;
  stats: AudioStats;
  isPlaying: boolean;
}

export default function AmbientEdgeGlow({ options, stats, isPlaying }: AmbientEdgeGlowProps) {
  if (options.ambientEdgeEnabled === false || options.ambientEdgePreset === 'none') return null;

  const preset = options.ambientEdgePreset || 'dynamic-rainbow';
  const widthPx = Math.min(10, Math.max(1, options.ambientEdgeWidth ?? 4));
  const speed = Math.min(5, Math.max(1, options.ambientEdgeSpeed ?? 3)); // 1 (slow) to 5 (fast)
  const animDuration = Math.max(0.8, 7.5 - speed * 1.2); // 6.3s down to 1.5s
  
  const isVivoMode = preset.startsWith('vivo-') || options.ambientEdgeMode === 'vivo-music' || options.ambientEdgeStyle === 'vivo-reactive';
  const isAudioReactive = options.ambientEdgeAudioReactive === true || isVivoMode;
  // Dynamic glow spread: 4 to 36 px
  const glowVal = Math.min(40, Math.max(2, options.ambientEdgeGlow ?? 16));

  const opacityVal = isAudioReactive 
    ? (isPlaying ? Math.min(1.0, 0.7 + stats.volume * 0.4) : 0.4)
    : 0.98;

  const primaryColor = options.ambientEdgeColor || options.customColor || '#00f0ff';

  return (
    <div className="fixed inset-0 pointer-events-none z-[99999] overflow-hidden">
      
      {/* ATMOSPHERIC OUTER GLOW HALO (Only for full-border modes, for Vivo mode we use left-right edge glow) */}
      {!isVivoMode && (
        <div 
          className="absolute inset-0 pointer-events-none transition-all duration-200"
          style={{
            boxShadow: `inset 0 0 ${glowVal * 2.2}px ${glowVal * 0.4}px ${
              preset === 'sunset-glow' ? 'rgba(255, 60, 0, 0.35)' :
              preset === 'toxic-aurora' ? 'rgba(57, 255, 20, 0.35)' :
              preset === 'clockwise-rgb' ? 'rgba(0, 240, 255, 0.4)' :
              preset === 'dynamic-rainbow' ? 'rgba(0, 240, 255, 0.35)' :
              'rgba(0, 102, 255, 0.4)'
            }`,
            opacity: Math.min(1, 0.3 + (glowVal / 40) * 0.7)
          }}
        />
      )}

      {/* 1. DYNAMIC RAINBOW PRESET (7-Color Flowing Rainbow Laser) */}
      {preset === 'dynamic-rainbow' && (
        <div 
          className="absolute inset-0 w-full h-full animate-dynamic-rgb"
          style={{ 
            animationDuration: `${animDuration}s`,
            filter: `drop-shadow(0 0 ${glowVal * 0.6}px rgba(0, 240, 255, 0.8)) drop-shadow(0 0 ${glowVal * 1.5}px rgba(255, 0, 128, 0.9))`
          }}
        >
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="global-rainbow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ff0000" />
                <stop offset="16%" stopColor="#ff7700" />
                <stop offset="33%" stopColor="#ffee00" />
                <stop offset="50%" stopColor="#00ff66" />
                <stop offset="66%" stopColor="#00f0ff" />
                <stop offset="83%" stopColor="#0066ff" />
                <stop offset="100%" stopColor="#ff007f" />
              </linearGradient>
            </defs>

            {/* Glowing Ambient Diffuse Border */}
            <rect
              x={widthPx / 2}
              y={widthPx / 2}
              width={`calc(100% - ${widthPx}px)`}
              height={`calc(100% - ${widthPx}px)`}
              rx="24"
              ry="24"
              fill="none"
              stroke="url(#global-rainbow-grad)"
              strokeWidth={widthPx + glowVal * 0.4}
              opacity={0.65}
              style={{ filter: `blur(${Math.max(1, glowVal * 0.4)}px)` }}
            />
            {/* Crisp Inner High-Intensity Core */}
            <rect
              x={widthPx / 2}
              y={widthPx / 2}
              width={`calc(100% - ${widthPx}px)`}
              height={`calc(100% - ${widthPx}px)`}
              rx="24"
              ry="24"
              fill="none"
              stroke="url(#global-rainbow-grad)"
              strokeWidth={widthPx}
              opacity={opacityVal}
            />
          </svg>
        </div>
      )}

      {/* 2. CLOCKWISE RGB PRESET (घड़ी की दिशा में क्लॉकवाइज़ घूमने वाली continuous RGB लाइट - बिना किसी गैप के) */}
      {preset === 'clockwise-rgb' && (
        <div className="absolute inset-0 w-full h-full pointer-events-none">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="clockwise-rgb-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ff0000" />
                <stop offset="16.6%" stopColor="#ff7700" />
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

            {/* Glowing Aura Beam (Continuous, 0 gaps) */}
            <rect
              x={widthPx / 2}
              y={widthPx / 2}
              width={`calc(100% - ${widthPx}px)`}
              height={`calc(100% - ${widthPx}px)`}
              rx="24"
              ry="24"
              fill="none"
              stroke="url(#clockwise-rgb-grad)"
              strokeWidth={widthPx + Math.min(12, glowVal * 0.5)}
              style={{
                filter: `drop-shadow(0 0 ${glowVal * 0.7}px #00f0ff) drop-shadow(0 0 ${glowVal * 1.5}px #ff007f) blur(${Math.max(1, glowVal * 0.25)}px)`,
                opacity: 0.85
              }}
            />

            {/* Sharp Core Border (100% Solid & Continuous around full perimeter) */}
            <rect
              x={widthPx / 2}
              y={widthPx / 2}
              width={`calc(100% - ${widthPx}px)`}
              height={`calc(100% - ${widthPx}px)`}
              rx="24"
              ry="24"
              fill="none"
              stroke="url(#clockwise-rgb-grad)"
              strokeWidth={widthPx}
              style={{
                filter: `drop-shadow(0 0 ${glowVal * 0.5}px #00f0ff)`,
                opacity: 1
              }}
            />
          </svg>
        </div>
      )}

      {/* 3. TOXIC AURORA PRESET (Acid Lime & Bright Aqua Neon Glow) */}
      {preset === 'toxic-aurora' && (
        <div 
          className="absolute inset-0 w-full h-full animate-toxic-aurora"
          style={{ 
            animationDuration: `${animDuration}s`,
            filter: `drop-shadow(0 0 ${glowVal * 0.7}px #39ff14) drop-shadow(0 0 ${glowVal * 1.5}px #00ffcc)`
          }}
        >
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="toxic-aurora-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#39ff14" />
                <stop offset="35%" stopColor="#00ff88" />
                <stop offset="65%" stopColor="#00ffcc" />
                <stop offset="85%" stopColor="#76ff03" />
                <stop offset="100%" stopColor="#ccff00" />
              </linearGradient>
            </defs>

            {/* Diffuse glow layer */}
            <rect
              x={widthPx / 2}
              y={widthPx / 2}
              width={`calc(100% - ${widthPx}px)`}
              height={`calc(100% - ${widthPx}px)`}
              rx="24"
              ry="24"
              fill="none"
              stroke="url(#toxic-aurora-grad)"
              strokeWidth={widthPx + glowVal * 0.3}
              opacity={0.65}
              style={{ filter: `blur(${Math.max(1, glowVal * 0.35)}px)` }}
            />
            {/* Core sharp line */}
            <rect
              x={widthPx / 2}
              y={widthPx / 2}
              width={`calc(100% - ${widthPx}px)`}
              height={`calc(100% - ${widthPx}px)`}
              rx="24"
              ry="24"
              fill="none"
              stroke="url(#toxic-aurora-grad)"
              strokeWidth={widthPx}
              opacity={opacityVal}
            />
          </svg>
        </div>
      )}

      {/* 4. SUNSET FLARE PRESET (Crimson Red, Tangerine Orange & Sun Amber) */}
      {preset === 'sunset-glow' && (
        <div 
          className="absolute inset-0 w-full h-full animate-sunset-flare"
          style={{ 
            animationDuration: `${animDuration}s`,
            filter: `drop-shadow(0 0 ${glowVal * 0.7}px #ff1a40) drop-shadow(0 0 ${glowVal * 1.5}px #ff7700)`
          }}
        >
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="sunset-flare-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ff0033" />
                <stop offset="30%" stopColor="#ff4500" />
                <stop offset="60%" stopColor="#ff7700" />
                <stop offset="85%" stopColor="#ffaa00" />
                <stop offset="100%" stopColor="#ffee00" />
              </linearGradient>
            </defs>

            {/* Diffuse glow layer */}
            <rect
              x={widthPx / 2}
              y={widthPx / 2}
              width={`calc(100% - ${widthPx}px)`}
              height={`calc(100% - ${widthPx}px)`}
              rx="24"
              ry="24"
              fill="none"
              stroke="url(#sunset-flare-grad)"
              strokeWidth={widthPx + glowVal * 0.3}
              opacity={0.65}
              style={{ filter: `blur(${Math.max(1, glowVal * 0.35)}px)` }}
            />
            {/* Core sharp line */}
            <rect
              x={widthPx / 2}
              y={widthPx / 2}
              width={`calc(100% - ${widthPx}px)`}
              height={`calc(100% - ${widthPx}px)`}
              rx="24"
              ry="24"
              fill="none"
              stroke="url(#sunset-flare-grad)"
              strokeWidth={widthPx}
              opacity={opacityVal}
            />
          </svg>
        </div>
      )}

      {/* 5. VIVO MUSIC REACTIVE PRESETS (Official Vivo T4 Left & Right Screen Edges Only) */}
      {(preset.startsWith('vivo-') || options.ambientEdgeStyle === 'vivo-reactive' || options.ambientEdgeMode === 'vivo-music') && (
        <VivoLeftRightEdgeLights
          presetId={preset}
          stats={stats}
          isPlaying={isPlaying}
          thicknessPx={widthPx}
          glowBlur={glowVal}
          speedVal={speed}
          customColor={primaryColor}
          isInsidePhonePreview={false}
        />
      )}

    </div>
  );
}
