import React, { useEffect, useRef, useState } from 'react';
import { VisualizerOptions, AudioStats, COLOR_PRESETS } from '../types';
import { getCachedImage, preloadImage, preloadAllPresets } from '../utils/imageCache';

interface VisualizerCanvasProps {
  analyserNode: AnalyserNode | null;
  audioContext: AudioContext | null;
  options: VisualizerOptions;
  onStatsChange?: (stats: AudioStats) => void;
  isPlaying: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  maxLife: number;
  life: number;
  twinkleSpeed?: number;
  isSpark?: boolean;
}

export default function VisualizerCanvas({
  analyserNode,
  audioContext,
  options,
  onStatsChange,
  isPlaying,
}: VisualizerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Buffer and state cache for custom audio analysis
  const rmsHistory = useRef<number[]>([]);
  const bassHistory = useRef<number[]>([]);
  const smoothedData = useRef<number[]>([]);
  const currentGainRef = useRef<number>(1.0);
  const currentEasingRef = useRef<number>(0.20);
  const isTransientRef = useRef<boolean>(false);
  const transientCooldown = useRef<number>(0);

  // Particle list for Particle Blast visualization
  const particles = useRef<Particle[]>([]);

  // Track breathing sine phase
  const breathingPhase = useRef<number>(0);

  // Track elegant slow spin rotation phase
  const rotationPhase = useRef<number>(0);
  const coverSpinAngle = useRef<number>(0);

  // Ocean 3D Wave smoothed multi-band energy refs (Dedicated to aura-3d-wave)
  const auraSmoothedBass = useRef<number>(0);
  const auraSmoothedMids = useRef<number>(0);
  const auraSmoothedTreble = useRef<number>(0);
  const auraSmoothedEnergy = useRef<number>(0);
  const auraWaveTravelPhase = useRef<number>(0);

  // Aura Pulser Living Energy Aura smoothed multi-band refs (Dedicated to aura-pulse)
  const pulseSmoothedBass = useRef<number>(0);
  const pulseSmoothedMids = useRef<number>(0);
  const pulseSmoothedTreble = useRef<number>(0);
  const pulseSmoothedEnergy = useRef<number>(0);
  const pulseWaveFlowPhase = useRef<number>(0);
  const pulsePrevBass = useRef<number>(0);
  const pulseBassPunch = useRef<number>(0);

  // Persistent reusable particle system for Aura Pulser (Zero allocations during render)
  interface AuraParticle {
    angle: number;
    orbitSpeed: number;
    baseDistRatio: number;
    currentDist: number;
    radialVel: number;
    size: number;
    type: 'small' | 'medium' | 'highlight';
    color: string;
    baseAlpha: number;
    jitterSeed: number;
  }

  const createInitialAuraParticles = (): AuraParticle[] => {
    const list: AuraParticle[] = [];
    const palette = ['#00f0ff', '#ff2d78', '#a855f7', '#00f0ff'];
    for (let i = 0; i < 76; i++) {
      const isHighlight = i < 5; // 5 bright diamond highlights (~6%)
      const isMedium = !isHighlight && i < 22; // 17 medium particles (~22%)
      const type: 'small' | 'medium' | 'highlight' = isHighlight ? 'highlight' : isMedium ? 'medium' : 'small';
      const angle = (i / 76) * Math.PI * 2 + (Math.random() * 0.18 - 0.09);
      const baseDistRatio = isHighlight ? 1.14 + Math.random() * 0.20 : isMedium ? 1.11 + Math.random() * 0.24 : 1.08 + Math.random() * 0.28;
      const size = isHighlight ? 2.2 : isMedium ? 2.6 : 1.4;
      const color = isHighlight ? '#ffffff' : palette[i % palette.length];
      const baseAlpha = isHighlight ? 0.95 : isMedium ? 0.78 : 0.65;
      const orbitDir = i % 2 === 0 ? 1 : -1;
      const orbitSpeed = orbitDir * (0.007 + Math.random() * 0.009);
      list.push({
        angle,
        orbitSpeed,
        baseDistRatio,
        currentDist: 0,
        radialVel: 0,
        size,
        type,
        color,
        baseAlpha,
        jitterSeed: Math.random() * Math.PI * 2,
      });
    }
    return list;
  };

  const persistentAuraParticles = useRef<AuraParticle[]>(createInitialAuraParticles());

  // Pre-allocated Float32Array cache for 256 circular points to guarantee 0 GC pauses
  const auraRingPointsCache = useRef<{
    x: Float32Array;
    y: Float32Array;
    energy: Float32Array;
    secX: Float32Array;
    secY: Float32Array;
  }>({
    x: new Float32Array(257),
    y: new Float32Array(257),
    energy: new Float32Array(257),
    secX: new Float32Array(257),
    secY: new Float32Array(257),
  });

  // Dynamic Multi-Zone Water Splash Engine ("Jaise pani me pathar marne par alag alag jagah pani uchalta hai")
  interface AuraSplashImpact {
    id: number;
    xNorm: number;     // 0.0 to 1.0 across full horizontal panoramic expanse
    zNorm: number;     // 0.0 (horizon) to 1.0 (foreground)
    intensity: number; // Eruption height multiplier
    width: number;     // Radial splash impact spread
    age: number;       // Current frame age
    maxAge: number;    // Total duration
    riseFrames: number;// Frames to reach explosive apex
    colorType: 'bass' | 'kick' | 'mid' | 'treble';
  }
  // History of recent splash coordinates to guarantee spatial variety across X and Z
  const auraRecentLocations = useRef<{ x: number; z: number }[]>([]);
  const auraSplashImpacts = useRef<AuraSplashImpact[]>([]);
  const auraSplashIdCounter = useRef<number>(0);
  const auraPrevEnergies = useRef<{ bass: number; mid: number; treb: number }>({ bass: 0, mid: 0, treb: 0 });
  const auraLastSplashTime = useRef<{ bass: number; mid: number; treb: number }>({ bass: 0, mid: 0, treb: 0 });
  const auraFrameCounter = useRef<number>(0);

  // Ref to hold the pre-loaded HTMLImageElement for background
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const blurredCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [bgImgLoaded, setBgImgLoaded] = useState<boolean>(false);

  // Ref to hold the pre-loaded HTMLImageElement for central artwork disc
  const centerImgRef = useRef<HTMLImageElement | null>(null);
  const [centerImgLoaded, setCenterImgLoaded] = useState<boolean>(false);

  // Preload all presets on mount so every background and center disc switches with 0ms latency
  useEffect(() => {
    preloadAllPresets();
  }, []);

  // Load background image on demand with instant cache check
  useEffect(() => {
    if (options.backgroundImageUrl) {
      // 1. Instant cache lookup: If already cached/preloaded, switch synchronously in 0ms!
      const cached = getCachedImage(options.backgroundImageUrl);
      if (cached) {
        bgImgRef.current = cached;
        blurredCanvasRef.current = null;
        setBgImgLoaded(prev => !prev);
      } else {
        // Fallback: preload asynchronously and update immediately when ready
        preloadImage(options.backgroundImageUrl)
          .then((img) => {
            bgImgRef.current = img;
            blurredCanvasRef.current = null;
            setBgImgLoaded(prev => !prev);
          })
          .catch(() => {
            bgImgRef.current = null;
            blurredCanvasRef.current = null;
          });
      }
    } else {
      bgImgRef.current = null;
      blurredCanvasRef.current = null;
      setBgImgLoaded(prev => !prev);
    }
  }, [options.backgroundImageUrl]);

  // Load center image on demand with instant cache check
  useEffect(() => {
    if (options.centerImageUrl) {
      // 1. Instant cache lookup: switch in 0ms!
      const cached = getCachedImage(options.centerImageUrl);
      if (cached) {
        centerImgRef.current = cached;
        setCenterImgLoaded(prev => !prev);
      } else {
        preloadImage(options.centerImageUrl)
          .then((img) => {
            centerImgRef.current = img;
            setCenterImgLoaded(prev => !prev);
          })
          .catch(() => {
            centerImgRef.current = null;
          });
      }
    } else {
      centerImgRef.current = null;
      setCenterImgLoaded(prev => !prev);
    }
  }, [options.centerImageUrl]);

  // Set up resize observer for fluid canvas sizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      if (options.exportDimensions) {
        canvas.width = options.exportDimensions.width;
        canvas.height = options.exportDimensions.height;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        return;
      }
      const rect = canvas.parentElement?.getBoundingClientRect();
      // Cap devicePixelRatio to 1.5 for ultra-smooth 60fps performance on high-DPI full screen displays
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      canvas.width = (rect?.width || 360) * dpr;
      canvas.height = (rect?.height || 640) * dpr;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
    };

    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    if (canvas.parentElement) {
      observer.observe(canvas.parentElement);
    }

    return () => {
      observer.disconnect();
    };
  }, [options.exportDimensions]);

  // Clear floating particles whenever visualization style changes
  useEffect(() => {
    particles.current = [];
  }, [options.visualizationMode]);

  // Main visualization rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const fftSize = 256; // 128 frequency bins
    if (analyserNode) {
      analyserNode.fftSize = fftSize;
    }

    const dataArray = new Uint8Array(fftSize / 2);
    const numBins = dataArray.length;

    // Initialize smoothed data array if empty
    if (smoothedData.current.length !== numBins) {
      smoothedData.current = Array(numBins).fill(0);
    }

    const renderFrame = () => {
      const width = canvas.width;
      const height = canvas.height;
      const center = { x: width / 2, y: height / 2 };
      const resolutionScale = Math.max(1.0, Math.min(width, height) / 540);
      const strokeScale = resolutionScale;

      // Fetch active color preset
      let currentPreset = COLOR_PRESETS.find(p => p.id === options.colorTheme) || COLOR_PRESETS[0];
      if (options.customColorEnabled && options.customColor) {
        currentPreset = {
          name: "Custom Solid Color",
          id: "custom",
          primary: options.customColor,
          secondary: options.customColor,
          glow: options.customColor,
          background: "from-zinc-950 via-zinc-900/10 to-zinc-950"
        };
      }

      // Read audio data if active
      if (analyserNode && isPlaying) {
        analyserNode.getByteFrequencyData(dataArray);
      } else {
        // Zero out data in absolute silence
        dataArray.fill(0);
      }

      // Calculate bass energy early so background render can use it
      let bassSum = 0;
      const bassBinCount = 8;
      for (let i = 0; i < bassBinCount; i++) {
        bassSum += dataArray[i] / 255;
      }
      const currentBassEnergy = bassSum / bassBinCount;

      // Clear with elegant deep dark layout background first to avoid trails
      ctx.fillStyle = '#05050a';
      ctx.fillRect(0, 0, width, height);

      // --- 0. BACKGROUND RENDER (CUSTOM IMAGE OR DEFAULT COLOR) ---
      if (bgImgRef.current) {
        ctx.save();
        const img = bgImgRef.current;
        // Draw covered aspect ratio
        const imgAspect = img.width / img.height;
        const canvasAspect = width / height;
        let dx = 0, dy = 0, dw = width, dh = height;
        if (imgAspect > canvasAspect) {
          dw = height * imgAspect;
          dx = (width - dw) / 2;
        } else {
          dh = width / imgAspect;
          dy = (height - dh) / 2;
        }
        
        const blurAmount = options.bgBlur !== undefined ? options.bgBlur : 10;
        const bgRoundness = options.bgRoundness !== undefined ? options.bgRoundness : 1.0;

        // Draw custom-shaped backdrop based on the bgRoundness slider
        ctx.save();
        
        // Calculate the circular mask's radius (when roundness is 1.0)
        const maxMaskRadius = Math.min(width, height) * 0.38 * (1.0 + currentBassEnergy * 0.12);
        
        // Interpolate shape dimensions and coordinates
        const lerp = (start: number, end: number, t: number) => start + (end - start) * t;
        const shapeWidth = lerp(width, maxMaskRadius * 2, bgRoundness);
        const shapeHeight = lerp(height, maxMaskRadius * 2, bgRoundness);
        const shapeX = center.x - shapeWidth / 2;
        const shapeY = center.y - shapeHeight / 2;
        const cornerRadius = lerp(0, maxMaskRadius, bgRoundness);

        // Clip to the interpolated rounded rectangle path
        ctx.beginPath();
        if (cornerRadius <= 0) {
          ctx.rect(shapeX, shapeY, shapeWidth, shapeHeight);
        } else {
          const r = Math.min(cornerRadius, Math.min(shapeWidth, shapeHeight) / 2);
          ctx.moveTo(shapeX + r, shapeY);
          ctx.lineTo(shapeX + shapeWidth - r, shapeY);
          ctx.arcTo(shapeX + shapeWidth, shapeY, shapeX + shapeWidth, shapeY + shapeHeight, r);
          ctx.lineTo(shapeX + shapeWidth, shapeY + shapeHeight - r);
          ctx.arcTo(shapeX + shapeWidth, shapeY + shapeHeight, shapeX, shapeY + shapeHeight, r);
          ctx.lineTo(shapeX + r, shapeY + shapeHeight);
          ctx.arcTo(shapeX, shapeY + shapeHeight, shapeX, shapeY, r);
          ctx.lineTo(shapeX, shapeY + r);
          ctx.arcTo(shapeX, shapeY, shapeX + shapeWidth, shapeY, r);
        }
        ctx.closePath();
        ctx.clip();

        // 1. Draw blurred backdrop image inside clip
        if (blurAmount > 0) {
          // Optimize blur render speed by using offscreen canvas caching.
          // This prevents extremely expensive realtime blur filters on 4K canvases,
          // which is the root cause of the video export lag!
          const maxBlurRes = 1024;
          let blurWidth = img.width;
          let blurHeight = img.height;
          if (blurWidth > maxBlurRes || blurHeight > maxBlurRes) {
            const scale = maxBlurRes / Math.max(blurWidth, blurHeight);
            blurWidth = Math.round(blurWidth * scale);
            blurHeight = Math.round(blurHeight * scale);
          }

          const cacheKey = `${blurWidth}x${blurHeight}_b${blurAmount}`;
          if (!blurredCanvasRef.current || blurredCanvasRef.current.width !== blurWidth || blurredCanvasRef.current.height !== blurHeight || blurredCanvasRef.current.dataset.cacheKey !== cacheKey) {
            const offscreen = document.createElement('canvas');
            offscreen.width = blurWidth;
            offscreen.height = blurHeight;
            offscreen.dataset.cacheKey = cacheKey;
            const oCtx = offscreen.getContext('2d');
            if (oCtx) {
              const scaleRatio = blurWidth / img.width;
              oCtx.filter = `blur(${Math.max(1, blurAmount * scaleRatio)}px)`;
              oCtx.drawImage(img, 0, 0, blurWidth, blurHeight);
            }
            blurredCanvasRef.current = offscreen;
          }
          ctx.drawImage(blurredCanvasRef.current, dx, dy, dw, dh);
        } else {
          ctx.drawImage(img, dx, dy, dw, dh);
        }

        // 2. Apply opacity overlay tint inside the clipped shape
        ctx.fillStyle = `rgba(5, 5, 10, ${1.0 - (options.bgOpacity !== undefined ? options.bgOpacity : 0.4)})`;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();

        // 3. Draw a thin elegant glowing ring around the shape (only when bgRoundness > 0)
        if (bgRoundness > 0) {
          ctx.save();
          // Glow/stroke intensity transitions with bgRoundness
          const strokeAlpha = Math.floor(bgRoundness * 70).toString(16).padStart(2, '0');
          ctx.strokeStyle = `${currentPreset.primary}${strokeAlpha}`;
          ctx.lineWidth = 4;
          ctx.beginPath();
          if (cornerRadius <= 0) {
            ctx.rect(shapeX, shapeY, shapeWidth, shapeHeight);
          } else {
            const r = Math.min(cornerRadius, Math.min(shapeWidth, shapeHeight) / 2);
            ctx.moveTo(shapeX + r, shapeY);
            ctx.lineTo(shapeX + shapeWidth - r, shapeY);
            ctx.arcTo(shapeX + shapeWidth, shapeY, shapeX + shapeWidth, shapeY + shapeHeight, r);
            ctx.lineTo(shapeX + shapeWidth, shapeY + shapeHeight - r);
            ctx.arcTo(shapeX + shapeWidth, shapeY + shapeHeight, shapeX, shapeY + shapeHeight, r);
            ctx.lineTo(shapeX + r, shapeY + shapeHeight);
            ctx.arcTo(shapeX, shapeY + shapeHeight, shapeX, shapeY, r);
            ctx.lineTo(shapeX, shapeY + r);
            ctx.arcTo(shapeX, shapeY, shapeX + shapeWidth, shapeY, r);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }

        ctx.restore();
      }

      // Slowly increment breathing phase (used for baseline when quiet)
      breathingPhase.current += 0.04;
      const breatheAmplitude = Math.sin(breathingPhase.current) * 0.5 + 0.5; // 0 to 1

      // Slowly increment rotation phase to drift sound wave evenly around the circle
      if (isPlaying) {
        if (options.rotateWaves !== false) {
          rotationPhase.current += 0.003;
        }
        if (options.rotateCenterImage !== false) {
          coverSpinAngle.current += 0.005; // Smooth vinyl spinning at 60 FPS
        }
      }

      // --- 1. DYNAMIC VIBE & MOOD ADAPTATION (AGC) ---
      let frameRms = 0;
      let sumSquares = 0;
      for (let i = 0; i < numBins; i++) {
        const val = dataArray[i] / 255;
        sumSquares += val * val;
      }
      frameRms = Math.sqrt(sumSquares / numBins);

      // Track rolling window for AGC (90 frames = 1.5s window at 60fps)
      if (isPlaying) {
        rmsHistory.current.push(frameRms);
        if (rmsHistory.current.length > 90) {
          rmsHistory.current.shift();
        }
      } else {
        // When paused or silent, keep history primed at optimal RMS to prevent gain wind-up/spikes on play!
        rmsHistory.current = Array(90).fill(0.32);
      }
      const avgRms = rmsHistory.current.reduce((a, b) => a + b, 0) / rmsHistory.current.length || 0.32;

      // AGC target calculation: we want the overall amplitude to hit around 0.32
      let targetGain = 1.0;
      if (options.useAgc) {
        if (isPlaying) {
          const optimalRms = 0.32;
          targetGain = optimalRms / Math.max(0.015, avgRms);
          // Clamp AGC gain: up to +24dB (multiplier approx 15.85)
          const maxGainLimit = 15.85; // +24dB
          if (targetGain > maxGainLimit) targetGain = maxGainLimit;
          if (targetGain < 0.8) targetGain = 0.8; // don't squish too much
        } else {
          targetGain = 1.0;
        }
      }

      // Smooth the gain adjustments so it feels continuous and natural
      if (isPlaying) {
        currentGainRef.current = currentGainRef.current * 0.95 + targetGain * 0.05;
      } else {
        // Fast decay to neutral 1.0 when paused/inactive so play starts from a clean baseline
        currentGainRef.current = currentGainRef.current * 0.85 + 1.0 * 0.15;
      }

      // --- 2. ADAPTIVE EASING (LIQUID FLOW vs. AGGRESSIVE SNAP) ---
      // (Using currentBassEnergy calculated at the top of renderFrame)
      if (isPlaying) {
        bassHistory.current.push(currentBassEnergy);
        if (bassHistory.current.length > 15) {
          bassHistory.current.shift();
        }
      } else {
        // Keep bass history primed at neutral level when quiet
        bassHistory.current = Array(15).fill(0.08);
      }
      const avgBassEnergy = bassHistory.current.reduce((a, b) => a + b, 0) / bassHistory.current.length || 0.08;

      // Check for transient spike: sudden bass surge
      const transientRatio = currentBassEnergy / Math.max(0.005, avgBassEnergy);
      let isTransient = false;

      if (options.useDynamicEasing) {
        // Cooldown avoids double-triggering inside a tiny window
        if (transientCooldown.current > 0) {
          transientCooldown.current--;
        }

        if (transientRatio > 1.25 && currentBassEnergy > 0.08 && transientCooldown.current === 0) {
          isTransient = true;
          isTransientRef.current = true;
          transientCooldown.current = 8; // 8 frames lock
          // Instantly scale easing up to 0.85 for aggressive snappy outward reactions
          currentEasingRef.current = 0.85;
        } else {
          isTransientRef.current = false;
          // Decays smoothly back to fluid linear interpolation ease factor of 0.45 for real-time response
          currentEasingRef.current = currentEasingRef.current * 0.85 + 0.45 * 0.15;
        }
      } else {
        // Static fluid easing but responsive
        currentEasingRef.current = 0.48;
      }

      // Apply Logarithmic frequency mapping, Dynamic Gain & Smooth Easing to bins
      const processedBins: number[] = [];
      const baseFloor = 0.04; // Elegant, subtle 4% baseline floor for a clean circular presence when quiet

      for (let i = 0; i < numBins; i++) {
        // Logarithmic/hybrid spacing to stretch out bass and mids across the visualizer spectrum
        // and compress silent high treble, ensuring the entire circle dances dynamically!
        const progress = i / (numBins - 1);
        const logProgress = 0.28 * progress + 0.72 * Math.pow(progress, 1.85);
        const rawIdx = logProgress * (numBins - 1);

        // Fetch interpolated raw value from dataArray
        const lowIdx = Math.floor(rawIdx);
        const highIdx = Math.ceil(rawIdx);
        const frac = rawIdx - lowIdx;
        
        let rawVal = 0;
        if (lowIdx === highIdx) {
          rawVal = dataArray[lowIdx] / 255;
        } else {
          const valLow = dataArray[lowIdx] / 255;
          const valHigh = dataArray[Math.min(numBins - 1, highIdx)] / 255;
          rawVal = valLow + (valHigh - valLow) * frac;
        }

        // Extremely minor bass bleed for a subtle natural warm response
        const bassBleed = currentBassEnergy * 0.02 * (1.0 - progress);
        const combinedVal = rawVal + bassBleed;

        // High frequency equalization boost (treble / mids lifting)
        // Naturally boosts higher index frequencies so they match bass amplitude on full circle
        const hfBoost = 1.0 + Math.pow(progress, 1.1) * 3.8;

        // Multiply by global sensitivity, dynamic AGC gain, and HF equalization
        let processedVal = combinedVal * options.sensitivity * currentGainRef.current * hfBoost;

        // Dynamic baseline floor with subtle breathing sine-wave animation for idle/quiet tracks
        const breathingSine = 0.15 + 0.05 * Math.sin(rotationPhase.current * 1.8 + i * 0.15);
        if (processedVal < breathingSine) {
          processedVal = breathingSine;
        }

        // Elegant subtle tooth/weave pattern: keeps the spikes beautifully sharp, pointed, and textured
        if (isPlaying) {
          const toothPattern = 0.92 + 0.08 * (i % 2 === 0 ? 1.0 : 0.5) + Math.sin(i * 1.7) * 0.03;
          processedVal *= toothPattern;
        }

        // Clamp upper bounds to look premium without clipping canvas boundaries
        if (processedVal > 1.15) processedVal = 1.15;

        // Dynamic Easing (Lerp) with instant kick snap on transients
        const prevSmoothed = smoothedData.current[i] || 0;
        const targetEase = isTransient ? 0.92 : currentEasingRef.current;
        const smoothedVal = prevSmoothed + (processedVal - prevSmoothed) * targetEase;

        smoothedData.current[i] = smoothedVal;
        processedBins.push(smoothedVal);
      }

      // Compute multi-band real frequency profile for reactive lights
      let bassAcc = 0;
      let midAcc = 0;
      let trebAcc = 0;
      const bandCount = 24;
      const sampledBands: number[] = [];
      const binStep = Math.max(1, Math.floor((numBins * 0.7) / bandCount));

      for (let b = 0; b < bandCount; b++) {
        const binIndex = Math.min(numBins - 1, b * binStep);
        const val = smoothedData.current[binIndex] || 0;
        sampledBands.push(val);
        if (b < 6) bassAcc += val;
        else if (b < 16) midAcc += val;
        else trebAcc += val;
      }
      const realBassLevel = bassAcc / 6;
      const realMidLevel = midAcc / 10;
      const realTrebleLevel = trebAcc / 8;

      // Update Parent UI statistics
      if (onStatsChange && isPlaying) {
        onStatsChange({
          volume: frameRms,
          rms: avgRms,
          currentGain: currentGainRef.current,
          isTransient: isTransient,
          bassEnergy: currentBassEnergy > 0.2,
          easingFactor: currentEasingRef.current,
          bpm: options.audioSource === 'synth-phonk' ? 128 : options.audioSource === 'synth-ambient' ? 100 : 120,
          frequencyBands: sampledBands,
          bassLevel: realBassLevel,
          midLevel: realMidLevel,
          trebleLevel: realTrebleLevel,
        });
      }

      // 1. DEDICATED OCEAN 3D WAVE AUDIO ANALYSIS PIPELINE (REAL-TIME REACTIVE TO MUSIC FREQUENCIES & BEATS)
      if (options.visualizationMode === 'aura-3d-wave') {
        const audioGain = options.sensitivity * currentGainRef.current;
        let instBass = 0;
        const bassBins = Math.min(8, numBins);
        for (let i = 0; i < bassBins; i++) instBass += (dataArray[i] || 0) / 255;
        instBass = Math.min(1.5, (instBass / Math.max(1, bassBins)) * audioGain);

        let instMids = 0;
        const midStart = 8, midEnd = Math.min(36, numBins);
        for (let i = midStart; i < midEnd; i++) instMids += (dataArray[i] || 0) / 255;
        instMids = Math.min(1.5, (instMids / Math.max(1, midEnd - midStart)) * audioGain);

        let instTreb = 0;
        const trebStart = 36, trebEnd = Math.min(96, numBins);
        for (let i = trebStart; i < trebEnd; i++) instTreb += (dataArray[i] || 0) / 255;
        instTreb = Math.min(1.5, (instTreb / Math.max(1, trebEnd - trebStart)) * audioGain);

        const instEnergy = Math.min(1.5, frameRms * audioGain);

        if (isPlaying) {
          // Zero-latency punchy attack on beats, snappy dynamic response to music rhythm
          const bAttack = isTransient ? 0.95 : 0.72, bDecay = 0.14;
          const mAttack = isTransient ? 0.85 : 0.60, mDecay = 0.16;
          const tAttack = 0.70, tDecay = 0.18;
          const eAttack = isTransient ? 0.90 : 0.65, eDecay = 0.12;

          auraSmoothedBass.current += (instBass - auraSmoothedBass.current) * (instBass > auraSmoothedBass.current ? bAttack : bDecay);
          auraSmoothedMids.current += (instMids - auraSmoothedMids.current) * (instMids > auraSmoothedMids.current ? mAttack : mDecay);
          auraSmoothedTreble.current += (instTreb - auraSmoothedTreble.current) * (instTreb > auraSmoothedTreble.current ? tAttack : tDecay);
          auraSmoothedEnergy.current += (instEnergy - auraSmoothedEnergy.current) * (instEnergy > auraSmoothedEnergy.current ? eAttack : eDecay);

          // Continuous smooth forward wave travel phase modulated by music energy
          auraWaveTravelPhase.current += 0.024 + auraSmoothedEnergy.current * 0.038;
        } else {
          auraSmoothedBass.current *= 0.92;
          auraSmoothedMids.current *= 0.92;
          auraSmoothedTreble.current *= 0.92;
          auraSmoothedEnergy.current *= 0.92;
          auraWaveTravelPhase.current += 0.012;
        }

        // Multi-band 3D Wave dynamic splash detector
        if (isPlaying) {

          // --- DYNAMIC MULTI-ZONE WATER SPLASH & ERUPTION DETECTOR ("Pani uchhalna engine") ---
          auraFrameCounter.current++;
          const currentFrame = auraFrameCounter.current;
          const prevB = auraPrevEnergies.current.bass;
          const prevM = auraPrevEnergies.current.mid;
          const prevT = auraPrevEnergies.current.treb;

          // Helper to pick a new impact location far from recent impacts across panoramic 3D space
          const getDiverseSplashCoords = (type: 'bass' | 'mid' | 'treb') => {
            const candidateZones = type === 'bass' ? [
              { x: 0.50, z: 0.65 }, // Center-Mid
              { x: 0.20, z: 0.45 }, // Left-Far
              { x: 0.80, z: 0.50 }, // Right-Mid
              { x: 0.35, z: 0.72 }, // Left-Near
              { x: 0.65, z: 0.35 }, // Right-Far
              { x: 0.12, z: 0.60 }, // Far-Left
              { x: 0.88, z: 0.68 }, // Far-Right
              { x: 0.48, z: 0.22 }, // Distant Center Horizon
              { x: 0.28, z: 0.25 }, // Distant Left Horizon
              { x: 0.72, z: 0.28 }, // Distant Right Horizon
            ] : type === 'mid' ? [
              { x: 0.15, z: 0.38 }, // Left Mid-Distance
              { x: 0.85, z: 0.42 }, // Right Mid-Distance
              { x: 0.42, z: 0.52 }, // Center Left Mid
              { x: 0.58, z: 0.55 }, // Center Right Mid
              { x: 0.30, z: 0.18 }, // Far Left Horizon
              { x: 0.70, z: 0.20 }, // Far Right Horizon
              { x: 0.50, z: 0.80 }, // Direct Foreground Center
            ] : [
              { x: 0.10 + Math.random() * 0.80, z: 0.12 + Math.random() * 0.78 }
            ];

            // Score candidate zones by distance to recent impact points
            let bestZone = candidateZones[0];
            let maxMinDist = -1;
            const recents = auraRecentLocations.current;

            for (const zone of candidateZones) {
              let minDist = 999;
              for (const r of recents) {
                const dx = zone.x - r.x;
                const dz = zone.z - r.z;
                const d = dx * dx + dz * dz;
                if (d < minDist) minDist = d;
              }
              if (minDist > maxMinDist) {
                maxMinDist = minDist;
                bestZone = zone;
              }
            }

            // Apply slight organic jitter around chosen zone
            const finalX = Math.max(0.06, Math.min(0.94, bestZone.x + (Math.random() - 0.5) * 0.08));
            const finalZ = Math.max(0.12, Math.min(0.88, bestZone.z + (Math.random() - 0.5) * 0.08));

            // Track in recent history (keep up to 6 past locations)
            auraRecentLocations.current.push({ x: finalX, z: finalZ });
            if (auraRecentLocations.current.length > 6) {
              auraRecentLocations.current.shift();
            }

            return { x: finalX, z: finalZ };
          };

          // 1. Bass / Kick Impact
          const bassDelta = Math.max(0, instBass - prevB);
          const isBassHit = (bassDelta > 0.045) || (instBass > 0.34 && currentFrame - auraLastSplashTime.current.bass > 7);
          if (isBassHit) {
            auraLastSplashTime.current.bass = currentFrame;
            auraSplashIdCounter.current++;
            const coords = getDiverseSplashCoords('bass');

            const splashIntensity = Math.min(1.15, 0.30 + instBass * 0.75 + bassDelta * 1.5);
            const maxAge = Math.floor(26 + instBass * 20);

            auraSplashImpacts.current.push({
              id: auraSplashIdCounter.current,
              xNorm: coords.x,
              zNorm: coords.z,
              intensity: splashIntensity,
              width: 0.10,
              age: 0,
              maxAge: maxAge,
              riseFrames: 6,
              colorType: 'bass',
            });
          }

          // 2. Snare / Mid Percussion
          const midDelta = Math.max(0, instMids - prevM);
          const isMidHit = (midDelta > 0.050) || (instMids > 0.32 && currentFrame - auraLastSplashTime.current.mid > 8);
          if (isMidHit) {
            auraLastSplashTime.current.mid = currentFrame;
            auraSplashIdCounter.current++;
            const coords = getDiverseSplashCoords('mid');
            const splashIntensity = Math.min(0.95, 0.25 + instMids * 0.65 + midDelta * 1.2);

            auraSplashImpacts.current.push({
              id: auraSplashIdCounter.current,
              xNorm: coords.x,
              zNorm: coords.z,
              intensity: splashIntensity,
              width: 0.08,
              age: 0,
              maxAge: 28,
              riseFrames: 5,
              colorType: 'mid',
            });
          }

          // 3. Treble / Hi-hat Sparkling Surface Ripples
          const trebDelta = Math.max(0, instTreb - prevT);
          const isTrebHit = (trebDelta > 0.045) && (currentFrame - auraLastSplashTime.current.treb > 5);
          if (isTrebHit) {
            auraLastSplashTime.current.treb = currentFrame;
            auraSplashIdCounter.current++;
            const coords = getDiverseSplashCoords('treb');
            auraSplashImpacts.current.push({
              id: auraSplashIdCounter.current,
              xNorm: coords.x,
              zNorm: coords.z,
              intensity: Math.min(0.70, 0.20 + instTreb * 0.55),
              width: 0.06,
              age: 0,
              maxAge: 22,
              riseFrames: 4,
              colorType: 'treble',
            });
          }

          // Save energies for next frame derivative
          auraPrevEnergies.current = { bass: instBass, mid: instMids, treb: instTreb };

          // Update active splashes & remove aged ones
          auraSplashImpacts.current.forEach(s => s.age++);
          auraSplashImpacts.current = auraSplashImpacts.current.filter(s => s.age <= s.maxAge);
          if (auraSplashImpacts.current.length > 12) {
            auraSplashImpacts.current = auraSplashImpacts.current.slice(-12);
          }
        } else {
          // Smooth gentle decay when paused / quiet
          auraSmoothedBass.current *= 0.92;
          auraSmoothedMids.current *= 0.92;
          auraSmoothedTreble.current *= 0.92;
          auraSmoothedEnergy.current *= 0.92;
          auraWaveTravelPhase.current += 0.012;
          auraSplashImpacts.current = [];
        }
      } else {
        auraSplashImpacts.current = [];
      }

      // 2. DEDICATED AURA PULSER (LIVING ENERGY AURA) AUDIO ANALYSIS PIPELINE
      if (options.visualizationMode === 'aura-pulse') {
        let pBass = 0;
        const pBassBins = Math.min(8, numBins);
        for (let i = 0; i < pBassBins; i++) {
          const weight = (i >= 1 && i <= 3) ? 1.55 : 1.0;
          pBass += ((dataArray[i] || 0) / 255) * weight;
        }
        pBass = Math.min(1.0, (pBass / pBassBins) * options.sensitivity * 1.5);

        let pMids = 0;
        const pMidStart = 6, pMidEnd = Math.min(36, numBins);
        for (let i = pMidStart; i < pMidEnd; i++) {
          pMids += (dataArray[i] || 0) / 255;
        }
        pMids = Math.min(1.0, (pMids / Math.max(1, pMidEnd - pMidStart)) * options.sensitivity * 1.55);

        let pTreb = 0;
        const pTrebStart = 36, pTrebEnd = Math.min(92, numBins);
        for (let i = pTrebStart; i < pTrebEnd; i++) {
          pTreb += (dataArray[i] || 0) / 255;
        }
        pTreb = Math.min(1.0, (pTreb / Math.max(1, pTrebEnd - pTrebStart)) * options.sensitivity * 2.0);

        const pEnergy = Math.min(1.0, frameRms * 1.85 * options.sensitivity);

        // Instant bass delta for snappy physical beat punch & rebound
        const pBassDelta = Math.max(0, pBass - pulsePrevBass.current);
        pulsePrevBass.current = pBass;
        let punchTarget = pBassDelta * 3.4;
        if (isTransient) {
          punchTarget = Math.max(punchTarget, 0.88);
        }
        pulseBassPunch.current = Math.max(pulseBassPunch.current * 0.72, punchTarget);

        if (isPlaying && (pEnergy > 0.005 || pBass > 0.005)) {
          // Responsive fast attack & organic spring decay
          const bAtk = 0.65, bDec = 0.14;
          const mAtk = 0.55, mDec = 0.16;
          const tAtk = 0.60, tDec = 0.20;
          const eAtk = 0.52, eDec = 0.12;

          pulseSmoothedBass.current += (pBass - pulseSmoothedBass.current) * (pBass > pulseSmoothedBass.current ? bAtk : bDec);
          pulseSmoothedMids.current += (pMids - pulseSmoothedMids.current) * (pMids > pulseSmoothedMids.current ? mAtk : mDec);
          pulseSmoothedTreble.current += (pTreb - pulseSmoothedTreble.current) * (pTreb > pulseSmoothedTreble.current ? tAtk : tDec);
          pulseSmoothedEnergy.current += (pEnergy - pulseSmoothedEnergy.current) * (pEnergy > pulseSmoothedEnergy.current ? eAtk : eDec);

          // Living continuous fluid wave flow around the circle!
          // Modulated naturally by music energy and rhythm
          const waveSpeed = 0.026 + pulseSmoothedEnergy.current * 0.048 + pulseSmoothedBass.current * 0.032;
          pulseWaveFlowPhase.current += waveSpeed;
        } else {
          pulseSmoothedBass.current *= 0.88;
          pulseSmoothedMids.current *= 0.88;
          pulseSmoothedTreble.current *= 0.88;
          pulseSmoothedEnergy.current *= 0.88;
          pulseBassPunch.current *= 0.70;
          pulseWaveFlowPhase.current += 0.012; // gentle resting living drift
        }
      }

      // Create bass-induced glow flash magnitude
      const bassFlashScale = 1.0 + currentBassEnergy * 1.5;

      // --- 3. TRUE 360° MIRROR SYMMETRY RENDERER ---
      // We map the 128 frequency bins symmetrically around a circle.
      // Index 0 (Bass) can be placed to focus on the bottom, horizontal sides, or all 4 quadrants symmetrically.
      const rawBands = [...processedBins];
      // Trim silent presence/ultrasonic bins above 12.5kHz so 100% of the circular spectrum is highly active and dancing!
      const activeBands = rawBands.slice(0, Math.floor(numBins * 0.58));
      const len = activeBands.length;

      // Generate mirrored/symmetric array based on selected mode
      const symmetricData: number[] = [];
      const symmetryType = options.symmetry || 'none';

      if (symmetryType === 'none') {
        if (options.fullCoverage) {
          // Dual-channel bilateral mirror to ensure 100% seamless transition around the circle with NO flat gaps/slices!
          for (let i = 0; i < len; i++) {
            symmetricData.push(activeBands[i]);
          }
          for (let i = len - 1; i >= 0; i--) {
            symmetricData.push(activeBands[i]);
          }
        } else {
          // Raw frequencies mapped 1-to-1 without mirroring
          for (let i = 0; i < len; i++) {
            symmetricData.push(activeBands[i]);
          }
        }
      } else if (symmetryType === 'bottom') {
        // Bass grouped heavily at the bottom, wrapping to treble at the top
        // Left side (descending)
        for (let i = len - 1; i >= 0; i--) {
          symmetricData.push(activeBands[i]);
        }
        // Right side (ascending)
        for (let i = 0; i < len; i++) {
          symmetricData.push(activeBands[i]);
        }
      } else if (symmetryType === 'horizontal') {
        // Bass at left and right sides, treble at top and bottom
        for (let i = 0; i < len; i++) {
          symmetricData.push(activeBands[i]);
        }
        for (let i = len - 1; i >= 0; i--) {
          symmetricData.push(activeBands[i]);
        }
      } else if (symmetryType === 'quad') {
        // 4-Quadrant Symmetrical Lobe Alignment (Full uniform coverage with 4 bass points)
        // Quadrant 1 (Treble -> Bass)
        for (let i = len - 1; i >= 0; i--) {
          symmetricData.push(activeBands[i]);
        }
        // Quadrant 2 (Bass -> Treble)
        for (let i = 0; i < len; i++) {
          symmetricData.push(activeBands[i]);
        }
        // Quadrant 3 (Treble -> Bass)
        for (let i = len - 1; i >= 0; i--) {
          symmetricData.push(activeBands[i]);
        }
        // Quadrant 4 (Bass -> Treble)
        for (let i = 0; i < len; i++) {
          symmetricData.push(activeBands[i]);
        }
      } else if (symmetryType === 'radial') {
        // Symmetrical radial repetition for full dense coverage (6-fold symmetric)
        for (let k = 0; k < 3; k++) {
          for (let i = len - 1; i >= 0; i--) {
            symmetricData.push(activeBands[i]);
          }
          for (let i = 0; i < len; i++) {
            symmetricData.push(activeBands[i]);
          }
        }
      } else {
        for (let i = 0; i < len; i++) {
          symmetricData.push(activeBands[i]);
        }
      }

      const totalSymmetricPoints = symmetricData.length;

      // Luminous Background Pulsing Halo matching theme palette (Disabled for full-screen wave modes)
      if (options.visualizationMode !== 'aura-3d-wave' && options.visualizationMode !== 'weave-horizontal-liquid') {
        const baseGlowSize = Math.min(width, height) * 0.28 * options.radius;
        const pulsingGlowRadius = baseGlowSize * (1.1 + currentBassEnergy * 0.6) * (0.8 + options.glowIntensity * 0.6);
        
        const radialHalo = ctx.createRadialGradient(
          center.x, center.y, baseGlowSize * 0.15,
          center.x, center.y, pulsingGlowRadius
        );
        const haloAlphaPrimary = Math.floor(Math.min(255, (0.12 + options.glowIntensity * 0.22) * 255)).toString(16).padStart(2, '0');
        const haloAlphaSecondary = Math.floor(Math.min(255, (0.06 + options.glowIntensity * 0.14) * 255)).toString(16).padStart(2, '0');
        radialHalo.addColorStop(0, `${currentPreset.primary}${haloAlphaPrimary}`);
        radialHalo.addColorStop(0.4, `${currentPreset.secondary}${haloAlphaSecondary}`);
        radialHalo.addColorStop(0.7, `${currentPreset.primary}06`);
        radialHalo.addColorStop(1, 'rgba(5, 5, 10, 0)');
        
        ctx.fillStyle = radialHalo;
        ctx.beginPath();
        ctx.arc(center.x, center.y, pulsingGlowRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      const scaledLineWidth = options.lineWidth * resolutionScale;
      const normalLineWidth = scaledLineWidth;

      // Safe zero-lag helpers (Ensures 60fps performance across all glow intensities without frame drops)
      const useNativeShadow = false;
      const getCappedShadowBlur = (_maxBlur: number) => 0;
      ctx.shadowBlur = 0;

      // DRAW VISUALIZATION STYLES
      const baseRadius = (Math.min(width, height) * 0.22) * options.radius;

      // Beat-induced scale pumping
      const dynamicRadius = baseRadius * (1.0 + currentBassEnergy * 0.12);

      // --- DRAW CENTRAL ARTWORK VINYL SPINNING DISC DIRECTLY ON CANVAS ---
      // (Rendered ONLY when centerImageUrl exists)
      const discRadius = Math.max(12, dynamicRadius * 0.72);

      if (options.centerImageUrl && centerImgRef.current) {
        const shouldRotate = options.rotateCenterImage !== false;
        const spinAngle = shouldRotate ? coverSpinAngle.current : 0;

        // For non-horizontal modes (circular/wings), render in dead middle center.x, center.y
        if (!options.visualizationMode.startsWith('weave-horizontal-') && options.visualizationMode !== 'aura-3d-wave') {
          ctx.save();
          const discGlow = ctx.createRadialGradient(
            center.x, center.y, discRadius * 0.9,
            center.x, center.y, discRadius * 1.15
          );
          discGlow.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
          discGlow.addColorStop(0.5, `${currentPreset.primary}22`);
          discGlow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = discGlow;
          ctx.beginPath();
          ctx.arc(center.x, center.y, discRadius * 1.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          ctx.save();
          ctx.beginPath();
          ctx.arc(center.x, center.y, discRadius, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip(); // Clip to circle

          ctx.save();
          ctx.translate(center.x, center.y);
          ctx.rotate(spinAngle);
          ctx.translate(-center.x, -center.y);

          const img = centerImgRef.current;
          const imgAspect = img.width / img.height;
          let sWidth = discRadius * 2;
          let sHeight = discRadius * 2;
          let sx = center.x - discRadius;
          let sy = center.y - discRadius;

          if (imgAspect > 1) {
            sWidth = discRadius * 2 * imgAspect;
            sx = center.x - sWidth / 2;
          } else if (imgAspect < 1) {
            sHeight = (discRadius * 2) / imgAspect;
            sy = center.y - sHeight / 2;
          }

          ctx.drawImage(img, sx, sy, sWidth, sHeight);
          ctx.restore();

          // White border edge inside vinyl
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.lineWidth = 1.5 * strokeScale;
          ctx.beginPath();
          ctx.arc(center.x, center.y, discRadius - 1, 0, Math.PI * 2);
          ctx.stroke();

          // Tiny center spindle hole
          ctx.fillStyle = '#050508';
          ctx.beginPath();
          ctx.arc(center.x, center.y, Math.max(3 * strokeScale, discRadius * 0.1), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (options.visualizationMode !== 'weave-horizontal-liquid' && options.visualizationMode !== 'aura-3d-wave') {
          // For other horizontal weave modes, render center image up top cleanly
          const waterlineY = Math.floor(height * 0.62);
          const imgCenterY = Math.max(discRadius + 16 * strokeScale, waterlineY * 0.38);

          ctx.save();
          ctx.translate(center.x, imgCenterY);
          ctx.rotate(spinAngle);
          ctx.translate(-center.x, -imgCenterY);

          const img = centerImgRef.current;
          const imgAspect = img.width / img.height;
          let sWidth = discRadius * 2;
          let sHeight = discRadius * 2;
          let sx = center.x - discRadius;
          let sy = imgCenterY - discRadius;

          if (imgAspect > 1) {
            sWidth = discRadius * 2 * imgAspect;
            sx = center.x - sWidth / 2;
          } else if (imgAspect < 1) {
            sHeight = (discRadius * 2) / imgAspect;
            sy = imgCenterY - sHeight / 2;
          }

          ctx.save();
          ctx.beginPath();
          ctx.arc(center.x, imgCenterY, discRadius, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(img, sx, sy, sWidth, sHeight);
          ctx.restore();

          ctx.restore();

          ctx.save();
          // High-performance neon border
          if (options.glowIntensity > 0) {
            ctx.strokeStyle = `${currentPreset.primary}44`;
            ctx.lineWidth = (2.0 + options.glowIntensity * 3.0) * strokeScale;
            ctx.beginPath();
            ctx.arc(center.x, imgCenterY, discRadius, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.strokeStyle = currentPreset.primary;
          ctx.lineWidth = 2.0 * strokeScale;
          ctx.beginPath();
          ctx.arc(center.x, imgCenterY, discRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Now set up the context for the visualizer waves
      ctx.save();
      ctx.shadowBlur = 0;

      // --- DRAW 1: SPIKES (HAIRLINE DENSE BANDS) ---
      if (options.visualizationMode === 'spikes') {
        // Multi-pass glow without slow shadowBlur
        const passes = options.glowIntensity > 0.4
          ? (options.lineWidth < 1.8 ? [1.2, 1.0] : [2.6, 1.5, 1.0])
          : [1.0];

        passes.forEach((passScale) => {
          ctx.lineWidth = normalLineWidth * passScale;
          
          for (let i = 0; i < totalSymmetricPoints; i++) {
            const amplitude = symmetricData[i];
            const angleRange = options.fullCoverage ? Math.PI * 2 : Math.PI;
            const startAngle = options.fullCoverage ? -Math.PI / 2 : Math.PI; // Starts from bottom or top
            const angle = startAngle + (i / totalSymmetricPoints) * angleRange + rotationPhase.current;

            const rStart = dynamicRadius;
            const spikeHeight = amplitude * baseRadius * 1.3;
            const rEnd = dynamicRadius + spikeHeight;

            const xStart = center.x + Math.cos(angle) * rStart;
            const yStart = center.y + Math.sin(angle) * rStart;
            const xEnd = center.x + Math.cos(angle) * rEnd;
            const yEnd = center.y + Math.sin(angle) * rEnd;

            const grad = ctx.createLinearGradient(xStart, yStart, xEnd, yEnd);
            
            if (passScale > 2.0) {
              grad.addColorStop(0, `${currentPreset.primary}20`);
              grad.addColorStop(0.7, `${currentPreset.secondary}12`);
              grad.addColorStop(1, 'rgba(255,255,255,0)');
            } else if (passScale > 1.1) {
              grad.addColorStop(0, `${currentPreset.primary}60`);
              grad.addColorStop(0.6, `${currentPreset.secondary}40`);
              grad.addColorStop(1, 'rgba(255,255,255,0.15)');
            } else {
              grad.addColorStop(0, currentPreset.primary);
              grad.addColorStop(0.6, currentPreset.secondary);
              grad.addColorStop(1, '#ffffff');
            }

            ctx.strokeStyle = grad;
            ctx.beginPath();
            ctx.moveTo(xStart, yStart);
            ctx.lineTo(xEnd, yEnd);
            ctx.stroke();

            // Draw small orbiting bright neon dots at the peaks of heavy transients
            if (passScale === 1.0 && isTransient && amplitude > 0.75 && Math.random() > 0.82) {
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(xEnd, yEnd, 3 * normalLineWidth, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        });
      }

      // --- DRAW 2: LIQUID WAVE (SMOOTH CLOSED POLYGON) ---
      else if (options.visualizationMode === 'liquid-wave') {
        // Keep lines perfectly scaled and sharp when thickness is reduced
        const baseLineWidth = normalLineWidth * (options.lineWidth < 1.8 ? 1.0 : 2.2);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // Draw outer thick glowing liquid wave
        ctx.beginPath();
        for (let i = 0; i <= totalSymmetricPoints; i++) {
          const idx = i % totalSymmetricPoints;
          const amplitude = symmetricData[idx];
          const angleRange = options.fullCoverage ? Math.PI * 2 : Math.PI;
          const startAngle = options.fullCoverage ? -Math.PI / 2 : Math.PI;
          const angle = startAngle + (i / totalSymmetricPoints) * angleRange + rotationPhase.current;

          const r = dynamicRadius + (amplitude * baseRadius * 0.95);
          const x = center.x + Math.cos(angle) * r;
          const y = center.y + Math.sin(angle) * r;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();

        // Create glowing semi-transparent liquid fill
        const fillGrad = ctx.createRadialGradient(
          center.x, center.y, dynamicRadius * 0.7,
          center.x, center.y, dynamicRadius + baseRadius * 1.2
        );
        fillGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        fillGrad.addColorStop(0.7, `${currentPreset.primary}12`); // very transparent
        fillGrad.addColorStop(1, `${currentPreset.secondary}44`); // semi-transparent

        ctx.fillStyle = fillGrad;
        ctx.fill();

        // Multi-pass stroke glow for liquid wave boundary
        // Tighten the glow passes if thickness is low to prevent blurring of sharp peaks
        const strokePasses = options.glowIntensity > 0.4 
          ? (options.lineWidth < 1.8 ? [1.2, 1.0] : [2.5, 1.5, 1.0])
          : [1.0];
        strokePasses.forEach((passScale) => {
          ctx.lineWidth = baseLineWidth * passScale;
          
          const strokeGrad = ctx.createLinearGradient(0, center.y - dynamicRadius, 0, center.y + dynamicRadius);
          if (passScale > 2.0) {
            strokeGrad.addColorStop(0, `${currentPreset.primary}15`);
            strokeGrad.addColorStop(0.5, `${currentPreset.secondary}20`);
            strokeGrad.addColorStop(1, `${currentPreset.primary}15`);
          } else if (passScale > 1.1) {
            strokeGrad.addColorStop(0, `${currentPreset.primary}50`);
            strokeGrad.addColorStop(0.5, `${currentPreset.secondary}66`);
            strokeGrad.addColorStop(1, `${currentPreset.primary}50`);
          } else {
            strokeGrad.addColorStop(0, currentPreset.primary);
            strokeGrad.addColorStop(0.5, currentPreset.secondary);
            strokeGrad.addColorStop(1, currentPreset.primary);
          }

          ctx.strokeStyle = strokeGrad;
          
          ctx.beginPath();
          for (let i = 0; i <= totalSymmetricPoints; i++) {
            const idx = i % totalSymmetricPoints;
            const amplitude = symmetricData[idx];
            const angleRange = options.fullCoverage ? Math.PI * 2 : Math.PI;
            const startAngle = options.fullCoverage ? -Math.PI / 2 : Math.PI;
            const angle = startAngle + (i / totalSymmetricPoints) * angleRange + rotationPhase.current;

            const r = dynamicRadius + (amplitude * baseRadius * 0.95);
            const x = center.x + Math.cos(angle) * r;
            const y = center.y + Math.sin(angle) * r;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.closePath();
          ctx.stroke();
        });

      }



      // --- DRAW 6: DJ WINGS (WINGED HORIZONTAL SYMMETRIC SPECTRUM) ---
      else if (options.visualizationMode === 'dj-wings') {
        const baseLineWidth = normalLineWidth * (options.lineWidth < 1.8 ? 1.0 : 2.0);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // 1. Draw the filled winged spectrum (Primary theme color) - smooth wave, not spikes!
        ctx.beginPath();
        for (let i = 0; i <= totalSymmetricPoints; i++) {
          const idx = i % totalSymmetricPoints;
          const amplitude = symmetricData[idx];
          const angleRange = options.fullCoverage ? Math.PI * 2 : Math.PI;
          const startAngle = options.fullCoverage ? -Math.PI / 2 : Math.PI;
          const angle = startAngle + (i / totalSymmetricPoints) * angleRange;

          const cosVal = Math.cos(angle);
          // High-energy DJ wing envelope:
          // 0.55 base ensures top/bottom react heavily and don't stay flat,
          // 0.85 provides horizontal winged expansion.
          const wingEnvelope = 0.55 + 0.85 * Math.pow(Math.abs(cosVal), 2.0);

          // Highly responsive radius multiplier (1.85) to react heavily to DJ songs!
          const r = dynamicRadius + (amplitude * baseRadius * 1.85 * wingEnvelope);
          const x = center.x + Math.cos(angle) * r;
          const y = center.y + Math.sin(angle) * r;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        
        // Return via the inner circle boundary to make a closed filled path
        for (let i = totalSymmetricPoints; i >= 0; i--) {
          const angleRange = options.fullCoverage ? Math.PI * 2 : Math.PI;
          const startAngle = options.fullCoverage ? -Math.PI / 2 : Math.PI;
          const angle = startAngle + (i / totalSymmetricPoints) * angleRange;

          const r = dynamicRadius;
          const x = center.x + Math.cos(angle) * r;
          const y = center.y + Math.sin(angle) * r;
          ctx.lineTo(x, y);
        }
        ctx.closePath();

        // Fill with gorgeous theme-adaptive gradient
        const wingGrad = ctx.createRadialGradient(
          center.x, center.y, dynamicRadius,
          center.x, center.y, dynamicRadius + baseRadius * 1.85
        );
        wingGrad.addColorStop(0, currentPreset.primary);
        wingGrad.addColorStop(0.5, `${currentPreset.primary}77`);
        wingGrad.addColorStop(1, 'rgba(217, 70, 239, 0)');
        ctx.fillStyle = wingGrad;
        ctx.fill();

        // 2. Draw outer neon glowing outline
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff'; // White outline for high screen contrast
        ctx.lineWidth = baseLineWidth * 0.9;
        ctx.beginPath();
        for (let i = 0; i <= totalSymmetricPoints; i++) {
          const idx = i % totalSymmetricPoints;
          const amplitude = symmetricData[idx];
          const angleRange = options.fullCoverage ? Math.PI * 2 : Math.PI;
          const startAngle = options.fullCoverage ? -Math.PI / 2 : Math.PI;
          const angle = startAngle + (i / totalSymmetricPoints) * angleRange;

          const cosVal = Math.cos(angle);
          const wingEnvelope = 0.55 + 0.85 * Math.pow(Math.abs(cosVal), 2.0);

          const r = dynamicRadius + (amplitude * baseRadius * 1.85 * wingEnvelope);
          const x = center.x + Math.cos(angle) * r;
          const y = center.y + Math.sin(angle) * r;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // 3. Draw a gorgeous neon inner ring (Secondary theme color, usually cyan/blue)
        ctx.save();
        ctx.shadowBlur = 0;
        const innerRingPasses = options.glowIntensity > 0.4 ? [2.5, 1.0] : [1.0];
        innerRingPasses.forEach((passScale) => {
          ctx.lineWidth = 4.5 * strokeScale * passScale;
          ctx.strokeStyle = passScale > 1.2 ? `${currentPreset.secondary}55` : currentPreset.secondary;
          ctx.beginPath();
          ctx.arc(center.x, center.y, dynamicRadius, 0, Math.PI * 2);
          ctx.stroke();
        });
        ctx.restore();
      }

      // --- DRAW 4: BAR CHART (ELEGANT CIRCULAR RADIAL COLUMNS) ---
      else if (options.visualizationMode === 'bar-chart') {
        const barCount = 56; // nice dense circular bars
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (useNativeShadow) {
          ctx.shadowBlur = getCappedShadowBlur(8);
        } else {
          ctx.shadowBlur = 0;
        }

        const passes = useNativeShadow ? [1] : [2.5, 1.0];

        passes.forEach((passScale) => {
          for (let i = 0; i < barCount; i++) {
            // Downsample the frequency data into 56 bars
            const dataIdx = Math.floor((i / barCount) * totalSymmetricPoints);
            const val = symmetricData[dataIdx];

            const angleRange = options.fullCoverage ? Math.PI * 2 : Math.PI;
            const startAngle = options.fullCoverage ? -Math.PI / 2 : Math.PI;
            const angle = startAngle + (i / barCount) * angleRange + rotationPhase.current;

            const rStart = dynamicRadius;
            const barHeight = val * baseRadius * 1.25;
            const rEnd = dynamicRadius + Math.max(2 * strokeScale, barHeight);

            const xStart = center.x + Math.cos(angle) * rStart;
            const yStart = center.y + Math.sin(angle) * rStart;
            const xEnd = center.x + Math.cos(angle) * rEnd;
            const yEnd = center.y + Math.sin(angle) * rEnd;

            // Integrates perfectly with Waveform Stroke Thickness options (sharp and distinct when reduced)
            ctx.lineWidth = normalLineWidth * (options.lineWidth < 1.8 ? 1.4 : 3.2) * passScale;

            // Color gradient from primary (inside) to secondary (tips)
            const grad = ctx.createLinearGradient(xStart, yStart, xEnd, yEnd);
            if (useNativeShadow) {
              grad.addColorStop(0, currentPreset.primary);
              grad.addColorStop(0.5, currentPreset.secondary);
              grad.addColorStop(1, '#ffffff'); // shiny white top
            } else {
              if (passScale > 1.2) {
                grad.addColorStop(0, `${currentPreset.primary}22`);
                grad.addColorStop(0.5, `${currentPreset.secondary}35`);
                grad.addColorStop(1, 'rgba(255,255,255,0.05)');
              } else {
                grad.addColorStop(0, currentPreset.primary);
                grad.addColorStop(0.5, currentPreset.secondary);
                grad.addColorStop(1, '#ffffff');
              }
            }

            ctx.strokeStyle = grad;
            ctx.beginPath();
            ctx.moveTo(xStart, yStart);
            ctx.lineTo(xEnd, yEnd);
            ctx.stroke();

            // Tiny glowing topper bead for dynamic accentuation
            if (passScale === 1.0 && barHeight > 15 * strokeScale) {
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              const beadRadius = rEnd + Math.max(1.5, normalLineWidth * 0.9) + 3 * strokeScale;
              const bx = center.x + Math.cos(angle) * beadRadius;
              const by = center.y + Math.sin(angle) * beadRadius;
              ctx.arc(bx, by, Math.max(1.2, normalLineWidth * 0.8), 0, Math.PI * 2);
              ctx.fill();
            }
          }
        });
      }

      // --- DRAW 5: PARTICLE BLAST (INNER SOUND WAVES WITH OUTWARD MICRO-GLOWING PARTICLE BLAST) ---
      else if (options.visualizationMode === 'particle-blast') {
        // 1. Central Core Glowing Ring Baseline (Separates inner waves from outer particles)
        ctx.save();
        ctx.lineWidth = Math.max(1.2, normalLineWidth * 1.1);
        ctx.strokeStyle = `${currentPreset.primary}ee`;
        ctx.shadowBlur = Math.min(22, 12 * options.glowIntensity);
        ctx.shadowColor = currentPreset.glow;
        ctx.beginPath();
        ctx.arc(center.x, center.y, dynamicRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // 2. INNER SOUND WAVES (Andar ki taraf chalne wali audio frequency waves)
        // Har ek ray aur wave point apni alag audio frequency pe independently bounce karega!
        ctx.save();
        const maxInwardDepth = dynamicRadius * 0.52 * options.sensitivity;
        const startAngle = options.fullCoverage ? -Math.PI / 2 : Math.PI;
        const angleRange = options.fullCoverage ? Math.PI * 2 : Math.PI;
        const innerRays = 72; // High-definition radial ray resolution

        // A. Inward Audio Wave Bars / Spectrum Rays - ALAG ALAG INDEPENDENT BOUNCE
        for (let i = 0; i < innerRays; i++) {
          const angle = startAngle + (i / innerRays) * angleRange + (options.rotateWaves !== false ? rotationPhase.current : 0);
          
          // Bilateral frequency distribution around circle:
          // Bass bins anchor at bottom/poles, mids dance across sides, treble flutters at crests
          const normPos = Math.abs(((i / innerRays) * 2) - 1); // 0 to 1
          const freqBin = Math.min(numBins - 1, Math.floor(Math.pow(normPos, 1.25) * 58));
          
          // Real-time zero latency FFT for each independent frequency band
          const rawBinAmp = (dataArray[freqBin] || 0) / 255;
          const smoothBinAmp = smoothedData.current[freqBin] || 0;
          const rayAmp = (rawBinAmp * 0.72 + smoothBinAmp * 0.28) * options.sensitivity;

          if (rayAmp > 0.04) {
            // Independent inward bounce depth driven SOLELY by this frequency band!
            const inwardDepth = Math.min(dynamicRadius * 0.75, rayAmp * maxInwardDepth);
            const rInner = Math.max(dynamicRadius * 0.16, dynamicRadius - inwardDepth);

            const xOuter = center.x + Math.cos(angle) * dynamicRadius;
            const yOuter = center.y + Math.sin(angle) * dynamicRadius;
            const xInner = center.x + Math.cos(angle) * rInner;
            const yInner = center.y + Math.sin(angle) * rInner;

            // Inward sound wave beam with smooth gradient
            const rayGrad = ctx.createLinearGradient(xOuter, yOuter, xInner, yInner);
            rayGrad.addColorStop(0, currentPreset.primary);
            rayGrad.addColorStop(0.65, currentPreset.secondary);
            rayGrad.addColorStop(1, rayAmp > 0.55 ? '#ffffff' : `${currentPreset.secondary}bb`);

            ctx.strokeStyle = rayGrad;
            ctx.lineWidth = Math.max(1.0, normalLineWidth * 0.85);
            ctx.beginPath();
            ctx.moveTo(xOuter, yOuter);
            ctx.lineTo(xInner, yInner);
            ctx.stroke();

            // Inner crest bead on loud peaks for each independent frequency
            if (rayAmp > 0.32) {
              ctx.fillStyle = rayAmp > 0.60 ? '#ffffff' : currentPreset.secondary;
              ctx.beginPath();
              ctx.arc(xInner, yInner, Math.max(1.0, (1.0 + rayAmp * 1.6) * strokeScale), 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }

        // B. Smooth Dynamic Inner Waveform Contour - ALAG ALAG INDEPENDENT WAVE CONTOUR
        ctx.lineWidth = Math.max(1.2, normalLineWidth * 0.95);
        const innerContourGrad = ctx.createLinearGradient(
          center.x, center.y - dynamicRadius,
          center.x, center.y + dynamicRadius
        );
        innerContourGrad.addColorStop(0, currentPreset.primary);
        innerContourGrad.addColorStop(0.5, currentPreset.secondary);
        innerContourGrad.addColorStop(1, currentPreset.primary);
        ctx.strokeStyle = innerContourGrad;
        ctx.beginPath();

        for (let i = 0; i <= innerRays; i++) {
          const idx = i % innerRays;
          const normPos = Math.abs(((idx / innerRays) * 2) - 1);
          const freqBin = Math.min(numBins - 1, Math.floor(Math.pow(normPos, 1.25) * 58));
          
          const rawBinAmp = (dataArray[freqBin] || 0) / 255;
          const smoothBinAmp = smoothedData.current[freqBin] || 0;
          const pointAmp = (rawBinAmp * 0.72 + smoothBinAmp * 0.28) * options.sensitivity;

          const angle = startAngle + (i / innerRays) * angleRange + (options.rotateWaves !== false ? rotationPhase.current : 0);
          const inwardDepth = Math.min(dynamicRadius * 0.75, pointAmp * maxInwardDepth);
          const rInner = Math.max(dynamicRadius * 0.16, dynamicRadius - inwardDepth);
          const x = center.x + Math.cos(angle) * rInner;
          const y = center.y + Math.sin(angle) * rInner;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // 3. OUTWARD SOUND-REACTIVE MICRO-PARTICLE GENERATION (Bahar ki taraf nikalne wale particles)
        // Evaluates real instantaneous sound energy
        const currentAudioEnergy = Math.min(1.0, currentBassEnergy * 1.5 + frameRms * 1.0);

        if (isPlaying) {
          // A. QUIET / SLOW AUDIO STATE
          if (currentAudioEnergy < 0.10) {
            // Calm, ambient drifting: rare, gentle, slow floating micro-particle drifting outward
            if (Math.random() < 0.04) {
              const randAngle = Math.random() * Math.PI * 2;
              const px = center.x + Math.cos(randAngle) * (dynamicRadius + 1);
              const py = center.y + Math.sin(randAngle) * (dynamicRadius + 1);

              // Slow outward drift
              const speed = (0.3 + Math.random() * 0.4) * strokeScale;
              const vx = Math.cos(randAngle) * speed;
              const vy = Math.sin(randAngle) * speed;

              const isSpark = Math.random() > 0.85;
              particles.current.push({
                x: px,
                y: py,
                vx,
                vy,
                size: (1.0 + Math.random() * 1.0) * strokeScale,
                alpha: 0.95,
                color: Math.random() > 0.5 ? currentPreset.primary : currentPreset.secondary,
                maxLife: 45 + Math.floor(Math.random() * 25),
                life: 0,
                twinkleSpeed: 0.15,
                isSpark
              });
            }
          } 
          // B. MODERATE & ENERGETIC AUDIO STATE (Active music, rhythm pulses, instrument frequencies)
          else {
            // Frequency Sector Sampling: eject micro-particles outward from the circle perimeter
            const sectorCount = 24; // 24 sectors around 360 degrees
            const sectorStep = Math.max(1, Math.floor(totalSymmetricPoints / sectorCount));

            for (let s = 0; s < sectorCount; s++) {
              const dataIdx = Math.min(totalSymmetricPoints - 1, s * sectorStep);
              const amplitude = symmetricData[dataIdx];

              // Only active frequency peaks emit particles outward
              if (amplitude > 0.20) {
                const emitChance = Math.pow(amplitude, 1.8) * (0.16 + currentAudioEnergy * 0.65);
                if (Math.random() < emitChance) {
                  const baseAngle = startAngle + (dataIdx / totalSymmetricPoints) * angleRange + rotationPhase.current;
                  const spread = (Math.random() - 0.5) * 0.14;
                  const ejectionAngle = baseAngle + spread;

                  // Spawns right at the outer edge of the circle
                  const spawnRadius = dynamicRadius + (1 + Math.random() * 2) * strokeScale;
                  const px = center.x + Math.cos(ejectionAngle) * spawnRadius;
                  const py = center.y + Math.sin(ejectionAngle) * spawnRadius;

                  // Outward velocity: shoots directly into outer space away from the center!
                  const speed = (0.9 + amplitude * 3.6 + currentBassEnergy * 2.4 + Math.random() * 1.2) * strokeScale;
                  const vx = Math.cos(ejectionAngle) * speed;
                  const vy = Math.sin(ejectionAngle) * speed;

                  // Crisp micro-glowing particle sizes
                  const isSpark = Math.random() > 0.75;
                  const pSize = isSpark
                    ? (1.8 + Math.random() * 1.0) * strokeScale
                    : (1.0 + Math.random() * 1.2) * strokeScale;

                  const colorRand = Math.random();
                  const pColor = isSpark
                    ? '#ffffff'
                    : colorRand > 0.55
                      ? currentPreset.primary
                      : colorRand > 0.20
                        ? currentPreset.secondary
                        : currentPreset.glow;

                  particles.current.push({
                    x: px,
                    y: py,
                    vx,
                    vy,
                    size: pSize,
                    alpha: 1.0,
                    color: pColor,
                    maxLife: 30 + Math.floor(Math.random() * 25 + amplitude * 20),
                    life: 0,
                    twinkleSpeed: 0.18 + Math.random() * 0.25,
                    isSpark
                  });
                }
              }
            }

            // C. BEAT TRANSIENT & BASS DROP EXPLOSION
            // When kick drum or sudden transient hits, burst out an explosive 360-degree outward ring!
            if (isTransient || currentBassEnergy > 0.38) {
              const burstCount = isTransient ? 16 : (currentBassEnergy > 0.5 ? 12 : 7);
              for (let b = 0; b < burstCount; b++) {
                const randAngle = Math.random() * Math.PI * 2;
                const px = center.x + Math.cos(randAngle) * (dynamicRadius + 1);
                const py = center.y + Math.sin(randAngle) * (dynamicRadius + 1);

                // High speed energetic outward burst
                const blastSpeed = ((isTransient ? 3.8 : 2.6) + currentBassEnergy * 2.8 + Math.random() * 2.0) * strokeScale;
                const vx = Math.cos(randAngle) * blastSpeed;
                const vy = Math.sin(randAngle) * blastSpeed;

                const isSpark = Math.random() > 0.55;
                particles.current.push({
                  x: px,
                  y: py,
                  vx,
                  vy,
                  size: (isSpark ? 2.0 + Math.random() * 1.2 : 1.2 + Math.random() * 1.0) * strokeScale,
                  alpha: 1.0,
                  color: isSpark ? '#ffffff' : (Math.random() > 0.5 ? currentPreset.primary : currentPreset.secondary),
                  maxLife: 32 + Math.floor(Math.random() * 26),
                  life: 0,
                  twinkleSpeed: 0.22,
                  isSpark
                });
              }
            }
          }
        }
      }

      // --- DRAW 6: WEAVE HORIZONTAL BARS (HORIZONTAL SYMMETRIC BARS) ---
      else if (options.visualizationMode === 'weave-horizontal-bars') {
        const baseLineWidth = normalLineWidth * (options.lineWidth < 1.8 ? 1.0 : 1.8);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        const margin = canvas.width * 0.05;
        const drawWidth = canvas.width - (margin * 2);
        const totalBars = Math.min(80, totalSymmetricPoints);
        const barGap = drawWidth / totalBars;
        const barWidth = Math.max(2 * strokeScale, barGap * 0.62);
        const maxBarHeight = (canvas.height * 0.24) * options.sensitivity;

        ctx.save();
        ctx.shadowBlur = 0;

        // Central glow baseline line
        ctx.strokeStyle = `${currentPreset.primary}88`;
        ctx.lineWidth = 1.5 * strokeScale;
        ctx.beginPath();
        ctx.moveTo(margin, center.y);
        ctx.lineTo(canvas.width - margin, center.y);
        ctx.stroke();

        for (let i = 0; i < totalBars; i++) {
          const idx = Math.floor((i / totalBars) * totalSymmetricPoints);
          const amp = symmetricData[idx];
          const x = margin + i * barGap + barGap / 2 - barWidth / 2;
          
          const h = Math.max(4 * strokeScale, amp * maxBarHeight);
          const yTop = center.y - h;

          const barGrad = ctx.createLinearGradient(0, yTop, 0, center.y + h);
          barGrad.addColorStop(0, currentPreset.secondary);
          barGrad.addColorStop(0.5, '#ffffff');
          barGrad.addColorStop(1, currentPreset.primary);

          ctx.fillStyle = barGrad;

          // Draw rounded pill bar
          const radius = Math.min(barWidth / 2, 4 * strokeScale);
          ctx.beginPath();
          ctx.roundRect(x, yTop, barWidth, h * 2, radius);
          ctx.fill();

          // Highlight top/bottom caps on bass energy
          if (amp > 0.2) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x + barWidth / 2, yTop, barWidth * 0.6, 0, Math.PI * 2);
            ctx.arc(x + barWidth / 2, center.y + h, barWidth * 0.6, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.restore();
      }

      // --- DRAW 7: WEAVE HORIZONTAL WATER SPIKES (WATER SURFACE SPIKES & WATER REFLECTION) ---
      else if (options.visualizationMode === 'weave-horizontal-liquid') {
        const baseLineWidth = normalLineWidth * (options.lineWidth < 1.8 ? 1.0 : 2.5);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // Set waterline horizon at 54% of canvas height (balanced horizon allowing water reflection to fit cleanly inside lower region)
        const waterlineY = Math.floor(canvas.height * 0.54);

        const margin = canvas.width * 0.04;
        const drawWidth = canvas.width - (margin * 2);
        const totalColumns = Math.min(84, totalSymmetricPoints);
        const colWidth = drawWidth / totalColumns;
        const maxAmpHeight = (canvas.height * 0.22) * options.sensitivity;

        // 1. WATER BACKGROUND TINT (Lower region y >= waterlineY)
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, waterlineY, canvas.width, canvas.height - waterlineY);
        ctx.clip();

        // Background image reflection if present
        if (options.backgroundImageUrl && bgImgRef.current) {
          const bgImg = bgImgRef.current;
          ctx.save();
          ctx.translate(0, waterlineY);
          ctx.scale(1, -1);
          ctx.translate(0, -waterlineY);

          const imgAspect = bgImg.width / bgImg.height;
          const canvasAspect = canvas.width / canvas.height;
          let dw = canvas.width;
          let dh = canvas.height;
          let dx = 0;
          let dy = 0;
          if (imgAspect > canvasAspect) {
            dw = canvas.height * imgAspect;
            dx = (canvas.width - dw) / 2;
          } else {
            dh = canvas.width / imgAspect;
            dy = (canvas.height - dh) / 2;
          }

          ctx.drawImage(bgImg, dx, dy, dw, dh);
          ctx.restore();
        }

        // Overlay dark blue water depth gradient on lower region
        const waterGrad = ctx.createLinearGradient(0, waterlineY, 0, canvas.height);
        waterGrad.addColorStop(0, 'rgba(5, 14, 28, 0.75)');
        waterGrad.addColorStop(0.4, 'rgba(3, 10, 22, 0.88)');
        waterGrad.addColorStop(1, 'rgba(1, 4, 12, 0.98)');
        ctx.fillStyle = waterGrad;
        ctx.fillRect(0, waterlineY, canvas.width, canvas.height - waterlineY);

        ctx.restore(); // Restore lower half water clip

        // 2. DOWNWARD WATER SPIKES REFLECTION (IN WATER BELOW waterlineY)
        ctx.save();
        if (useNativeShadow) {
          ctx.shadowBlur = getCappedShadowBlur(10);
          ctx.shadowColor = `${currentPreset.primary}cc`;
        }

        for (let i = 0; i < totalColumns; i++) {
          const idx = Math.floor((i / totalColumns) * totalSymmetricPoints);
          const amp = symmetricData[idx];
          const x = margin + i * colWidth + colWidth / 2;

          // Water ripple displacement for reflection
          const waterRipple = Math.sin(rotationPhase.current * 3.5 + (i / totalColumns) * Math.PI * 6) * (3.5 * strokeScale);
          const reflHeight = (amp * maxAmpHeight * 0.78) + (5 * strokeScale);
          const reflY = waterlineY + reflHeight;

          const spikeWidth = Math.max(1.5 * strokeScale, colWidth * 0.75);

          // Reflected downward spike gradient
          const reflGrad = ctx.createLinearGradient(x, waterlineY, x + waterRipple, reflY);
          reflGrad.addColorStop(0, `${currentPreset.primary}dd`);
          reflGrad.addColorStop(0.5, `${currentPreset.secondary}88`);
          reflGrad.addColorStop(1, '#00f0ff00');

          ctx.strokeStyle = reflGrad;
          ctx.lineWidth = spikeWidth;
          ctx.globalAlpha = 0.70;

          ctx.beginPath();
          ctx.moveTo(x, waterlineY);
          ctx.lineTo(x + waterRipple, reflY);
          ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
        ctx.restore();

        // 3. RENDER UPWARD WATER SPIKES (STANDING CLEANLY ON WATER SURFACE ABOVE waterlineY)
        ctx.save();
        if (useNativeShadow) {
          ctx.shadowBlur = getCappedShadowBlur(12);
          ctx.shadowColor = currentPreset.primary;
        }

        for (let i = 0; i < totalColumns; i++) {
          const idx = Math.floor((i / totalColumns) * totalSymmetricPoints);
          const amp = symmetricData[idx];
          const x = margin + i * colWidth + colWidth / 2;

          const spikeHeight = amp * maxAmpHeight + (5 * strokeScale);
          const spikeY = waterlineY - spikeHeight;
          const spikeWidth = Math.max(1.5 * strokeScale, colWidth * 0.75);

          // Upward spike gradient
          const spikeGrad = ctx.createLinearGradient(x, waterlineY, x, spikeY);
          spikeGrad.addColorStop(0, currentPreset.primary);
          spikeGrad.addColorStop(0.6, currentPreset.secondary);
          spikeGrad.addColorStop(1, '#ffffff');

          ctx.strokeStyle = spikeGrad;
          ctx.lineWidth = spikeWidth;

          ctx.beginPath();
          ctx.moveTo(x, waterlineY);
          ctx.lineTo(x, spikeY);
          ctx.stroke();

          // Glowing tip dot at apex of each spike
          if (amp > 0.08) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x, spikeY, Math.max(1.5 * strokeScale, spikeWidth * 0.7), 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();

        // 4. CLEAN STRAIGHT WATER SURFACE HORIZON LINE AT waterlineY
        ctx.save();
        if (useNativeShadow) {
          ctx.shadowBlur = getCappedShadowBlur(10);
          ctx.shadowColor = '#00f0ff';
        }

        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2.0 * strokeScale;
        ctx.beginPath();
        ctx.moveTo(margin, waterlineY);
        ctx.lineTo(canvas.width - margin, waterlineY);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.0 * strokeScale;
        ctx.globalAlpha = 0.8;
        ctx.stroke();

        ctx.restore();

        // 5. MAIN CENTRAL CIRCULAR IMAGE & REFLECTION (ONLY IF CENTER IMAGE EXISTS)
        if (options.centerImageUrl && centerImgRef.current) {
          const centerImg = centerImgRef.current;
          const shouldRotate = options.rotateCenterImage !== false;
          // Smooth continuous spinning synchronized with audio playback and visualizer state
          const spinAngle = shouldRotate ? coverSpinAngle.current : 0;
          const baseRadius = (Math.min(canvas.width, canvas.height) * 0.15) * options.radius;
          const dynamicRadius = baseRadius * (1.0 + currentBassEnergy * 0.10);
          const discRadius = Math.max(12, dynamicRadius * 0.70);

          // Position top image cleanly in sky region above water horizon
          const imgCenterY = Math.max(discRadius + 16 * strokeScale, waterlineY * 0.45);

          // Compute aspect-ratio dimensions centered around (0, 0)
          const imgAspect = centerImg.width / centerImg.height;
          let sWidth = discRadius * 2;
          let sHeight = discRadius * 2;
          if (imgAspect > 1) {
            sWidth = discRadius * 2 * imgAspect;
          } else if (imgAspect < 1) {
            sHeight = (discRadius * 2) / imgAspect;
          }

          // Subtle ambient aura glow behind the top disc
          ctx.save();
          const topGlowGrad = ctx.createRadialGradient(center.x, imgCenterY, discRadius * 0.5, center.x, imgCenterY, discRadius * 1.4);
          topGlowGrad.addColorStop(0, `${currentPreset.primary}44`);
          topGlowGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = topGlowGrad;
          ctx.beginPath();
          ctx.arc(center.x, imgCenterY, discRadius * 1.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // --- A. TOP CENTRAL IMAGE (Smooth vinyl rotation) ---
          ctx.save();
          ctx.translate(center.x, imgCenterY);
          ctx.rotate(spinAngle);

          ctx.save();
          ctx.beginPath();
          ctx.arc(0, 0, discRadius, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(centerImg, -sWidth / 2, -sHeight / 2, sWidth, sHeight);
          ctx.restore();

          ctx.restore(); // restore rotation & translation

          // Glowing border ring around top disc
          ctx.save();
          if (useNativeShadow) {
            ctx.shadowBlur = options.glowIntensity * 16 * bassFlashScale * resolutionScale;
            ctx.shadowColor = currentPreset.primary;
          }
          ctx.strokeStyle = currentPreset.primary;
          ctx.lineWidth = 2.5 * strokeScale;
          ctx.beginPath();
          ctx.arc(center.x, imgCenterY, discRadius, 0, Math.PI * 2);
          ctx.stroke();

          // Inner pinhole spindle
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(center.x, imgCenterY, 3 * strokeScale, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // --- B. WATER REFLECTION OF CENTRAL IMAGE (Clean mirror copy without red line artifacts) ---
          const reflCenterY = waterlineY + (waterlineY - imgCenterY);

          ctx.save();
          ctx.beginPath();
          ctx.rect(0, waterlineY, canvas.width, canvas.height - waterlineY);
          ctx.clip(); // Clip reflection inside water region

          // Water ripple subtle horizontal displacement
          const waterXShift = Math.sin(rotationPhase.current * 3.0) * (2.0 * strokeScale);

          // 1. Dark water backing disc so downward spikes do not bleed red lines through the reflection
          ctx.save();
          ctx.fillStyle = 'rgba(3, 10, 22, 0.88)';
          ctx.beginPath();
          ctx.arc(center.x + waterXShift, reflCenterY, discRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // 2. Clear mirrored central image synchronized with top disc rotation
          ctx.save();
          ctx.translate(center.x + waterXShift, reflCenterY);
          ctx.scale(1, -1);
          ctx.rotate(spinAngle);

          ctx.globalAlpha = 0.75; // Clean, high-clarity water reflection

          ctx.save();
          ctx.beginPath();
          ctx.arc(0, 0, discRadius, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(centerImg, -sWidth / 2, -sHeight / 2, sWidth, sHeight);
          ctx.restore();

          ctx.restore(); // restore transform

          // 3. Clean subtle water rim ring matching aquatic horizon (no red lines)
          ctx.save();
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.50)';
          ctx.lineWidth = 1.8 * strokeScale;
          ctx.beginPath();
          ctx.arc(center.x + waterXShift, reflCenterY, discRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          ctx.restore(); // restore water clip
        }
      }

      // --- DRAW 8: WEAVE HORIZONTAL SPECTRUM (DUAL HORIZON) ---
      else if (options.visualizationMode === 'weave-horizontal-spectrum') {
        const baseLineWidth = normalLineWidth * (options.lineWidth < 1.8 ? 1.0 : 2.0);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        const margin = canvas.width * 0.05;
        const drawWidth = canvas.width - (margin * 2);
        const points = totalSymmetricPoints;

        const topPath: { x: number; y: number; amp: number }[] = [];
        const bottomPath: { x: number; y: number; amp: number }[] = [];

        const maxAmpHeight = (canvas.height * 0.22) * options.sensitivity;

        for (let i = 0; i <= points; i++) {
          const idx = i % points;
          const amp = symmetricData[idx];
          const x = margin + (i / points) * drawWidth;
          
          const centerDist = Math.abs(x - center.x) / (drawWidth / 2);
          const envelope = 1.0 - Math.pow(centerDist, 2) * 0.4;

          const h = amp * maxAmpHeight * envelope;
          const yTop = center.y - 8 * strokeScale - h;
          const yBottom = center.y + 8 * strokeScale + h;

          topPath.push({ x, y: yTop, amp });
          bottomPath.push({ x, y: yBottom, amp });
        }

        ctx.save();
        if (useNativeShadow) {
          ctx.shadowBlur = getCappedShadowBlur(12);
          ctx.shadowColor = currentPreset.primary;
        }
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 * strokeScale;
        ctx.beginPath();
        ctx.moveTo(margin, center.y);
        ctx.lineTo(canvas.width - margin, center.y);
        ctx.stroke();

        ctx.strokeStyle = currentPreset.primary;
        ctx.lineWidth = baseLineWidth;
        ctx.beginPath();
        topPath.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
        ctx.stroke();

        ctx.strokeStyle = currentPreset.secondary;
        ctx.lineWidth = baseLineWidth;
        ctx.beginPath();
        bottomPath.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
        ctx.stroke();

        topPath.forEach((ptTop, i) => {
          if (i % 2 === 0 && ptTop.amp > 0.05) {
            const ptBottom = bottomPath[i];
            const rodGrad = ctx.createLinearGradient(ptTop.x, ptTop.y, ptBottom.x, ptBottom.y);
            rodGrad.addColorStop(0, currentPreset.primary);
            rodGrad.addColorStop(0.5, '#ffffff');
            rodGrad.addColorStop(1, currentPreset.secondary);

            ctx.strokeStyle = rodGrad;
            ctx.lineWidth = Math.max(1, baseLineWidth * 0.6);
            ctx.beginPath();
            ctx.moveTo(ptTop.x, ptTop.y);
            ctx.lineTo(ptBottom.x, ptBottom.y);
            ctx.stroke();
          }
        });

        ctx.restore();
      }

      // --- DRAW 9: AURA RING PULSE (LIVING AUDIO-REACTIVE ENERGY AURA) ---
      else if (options.visualizationMode === 'aura-pulse') {
        const baseLineWidth = normalLineWidth * (options.lineWidth < 1.8 ? 1.0 : 1.7);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        const bassEnergy = pulseSmoothedBass.current;
        const midEnergy = pulseSmoothedMids.current;
        const highEnergy = pulseSmoothedTreble.current;
        const overallEnergy = pulseSmoothedEnergy.current;
        const bassPunch = pulseBassPunch.current;
        const wavePhase = pulseWaveFlowPhase.current;

        // Instantaneous raw kick from FFT low bins for zero-latency physical beat impacts
        const rawKick = Math.min(1.0, (((dataArray[1] || 0) + (dataArray[2] || 0) + (dataArray[3] || 0)) / (3 * 255)) * options.sensitivity);
        const liveBass = Math.max(bassEnergy, rawKick * 0.95);
        // Combined kick punch surge (fast rising attack + physical spring recoil)
        const kickSurge = bassPunch * 0.38 + liveBass * 0.30;

        // Controlled palette hierarchy: Electric Cyan, Hot Pink, Violet, Soft White
        const primaryColor = currentPreset.primary || '#00f0ff';
        const secondaryColor = currentPreset.secondary || '#ff2d78';
        const violetColor = '#a855f7';
        const whiteHighlight = '#ffffff';

        // 1. BASELINE & SCALING
        // Living breathing oscillation: gentle and organic baseline drift
        const livingBreath = Math.sin(wavePhase * 0.75) * 0.020;

        // BASS & BEATS: controls main ring physical expansion (kick drums trigger immediate punch outward)
        const bassExpansion = kickSurge * dynamicRadius;
        // OVERALL: controls overall aura scale and brightness
        const overallScale = 1.0 + overallEnergy * 0.18;

        // Baseline radius with dynamic beat expansion
        const baselineRadius = dynamicRadius * (0.95 + livingBreath);
        const currentRingRadius = (baselineRadius + bassExpansion) * overallScale;

        // High resolution smooth circular contour (256 points for silky smoothness without spikes)
        const points = 256;
        const halfPoints = 128;

        // 2. LAYER 4: VOLUMETRIC OUTER GLOW (Aura brightness and scale controlled by OVERALL and BASS)
        const outerFieldRadius = currentRingRadius * (1.45 + overallEnergy * 0.50 + kickSurge * 0.35);
        const volumetricGlow = ctx.createRadialGradient(
          center.x, center.y, currentRingRadius * 0.55,
          center.x, center.y, outerFieldRadius
        );
        const glowA1 = Math.min(0.55, 0.10 + overallEnergy * 0.40 + kickSurge * 0.20);
        const glowA2 = Math.min(0.40, 0.06 + midEnergy * 0.32);
        const glowA3 = Math.min(0.28, 0.03 + liveBass * 0.22);
        volumetricGlow.addColorStop(0, `rgba(0, 240, 255, ${glowA1})`);
        volumetricGlow.addColorStop(0.40, `rgba(168, 85, 247, ${glowA2})`);
        volumetricGlow.addColorStop(0.75, `rgba(255, 45, 120, ${glowA3})`);
        volumetricGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.save();
        ctx.fillStyle = volumetricGlow;
        ctx.beginPath();
        ctx.arc(center.x, center.y, outerFieldRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 3. LAYER 3: PERSISTENT AUDIO-REACTIVE PARTICLE AURA (76 reusable buffer particles)
        // With natural orbital movement and responsive beat expansion
        const isTransient = isTransientRef.current;
        const particlesList = persistentAuraParticles.current;

        ctx.save();
        for (let i = 0; i < particlesList.length; i++) {
          const p = particlesList[i];

          // Initialize particle distance on first frame if needed
          if (p.currentDist === 0) {
            p.currentDist = currentRingRadius * p.baseDistRatio;
          }

          // Target distance scales with audio energy and bass
          const targetDist = currentRingRadius * (p.baseDistRatio + overallEnergy * 0.18 + kickSurge * 0.25);

          // Orbit motion: visibly active, graceful orbit speed modulated by music energy
          const speedMultiplier = isPlaying ? (1.0 + overallEnergy * 1.5 + liveBass * 0.7) : 0.45;
          p.angle += p.orbitSpeed * speedMultiplier;

          // Bass hit: outward radial impulse
          if (kickSurge > 0.06 || bassPunch > 0.03) {
            const push = (bassPunch * 5.5 + liveBass * 2.8) * (p.type === 'small' ? 1.25 : 0.95);
            p.radialVel += push;
          }

          // Strong transient: temporary particle burst
          if (isTransient) {
            p.radialVel += (4.5 + (i % 5) * 0.9);
          }

          // Spring return force pulling particles back toward target baseline after a beat
          const springK = 0.09;
          const damping = 0.80;
          const distDiff = targetDist - p.currentDist;
          p.radialVel += distDiff * springK;
          p.radialVel *= damping;
          p.currentDist += p.radialVel;

          // Clamp distances so particles remain within the surrounding aura
          const minDist = currentRingRadius * 0.98;
          const maxDist = currentRingRadius * 1.85;
          if (p.currentDist < minDist) {
            p.currentDist = minDist;
            p.radialVel = 0;
          } else if (p.currentDist > maxDist) {
            p.currentDist = maxDist;
            p.radialVel *= -0.4;
          }

          // High frequencies: subtle micro-movement on smaller particles
          let highJitter = 0;
          if (p.type === 'small' && highEnergy > 0.08) {
            highJitter = Math.sin(p.jitterSeed + wavePhase * 3.5) * (highEnergy * 3.0 * strokeScale);
          }

          // Dynamic radial breath
          const radialBreath = Math.sin(p.jitterSeed + wavePhase * 1.2) * (3.5 * strokeScale);

          // Particle Cartesian position
          const px = center.x + Math.cos(p.angle) * (p.currentDist + highJitter + radialBreath);
          const py = center.y + Math.sin(p.angle) * (p.currentDist + highJitter + radialBreath);

          // Alpha visibility: soft in quiet moments, glowing when music plays
          let alpha = p.baseAlpha;
          if (!isPlaying || overallEnergy < 0.03) {
            alpha = (i % 2 === 0) ? p.baseAlpha * 0.35 : 0.15;
          } else {
            alpha *= (0.45 + overallEnergy * 0.55);
          }

          if (alpha > 0.03) {
            ctx.globalAlpha = Math.min(1.0, alpha);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(px, py, p.size * strokeScale, 0, Math.PI * 2);
            ctx.fill();

            // Diamond highlight sparkle at core of highlight particles
            if (p.type === 'highlight' || (p.type === 'medium' && liveBass > 0.35)) {
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(px, py, Math.max(0.7, p.size * 0.45 * strokeScale), 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
        ctx.restore();

        const cache = auraRingPointsCache.current;
        const cacheX = cache.x;
        const cacheY = cache.y;
        const cacheEnergy = cache.energy;
        const secX = cache.secX;
        const secY = cache.secY;

        // 4. LAYER 2: SECONDARY SOFT ATMOSPHERIC AURA RING (Smoothly rotating behind the primary ring)
        // Restores the original silky smooth circular rotating contour ("ghoomti hui") with rich audio reactivity
        ctx.save();
        if (useNativeShadow) {
          ctx.shadowBlur = getCappedShadowBlur(8 + Math.floor(overallEnergy * 14 + kickSurge * 10));
          ctx.shadowColor = violetColor;
        }
        const secAlpha = Math.min(0.78, 0.28 + overallEnergy * 0.40 + kickSurge * 0.22);
        ctx.strokeStyle = `rgba(168, 85, 247, ${secAlpha})`;
        ctx.lineWidth = Math.max(1.1 * strokeScale, baseLineWidth * (0.75 + overallEnergy * 0.35 + kickSurge * 0.25));
        ctx.beginPath();

        // Expands dynamically outward behind the primary ring on bass kicks!
        const secondaryRadius = currentRingRadius * (1.14 + kickSurge * 0.08);
        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2;
          const symIndex = i <= halfPoints ? i : points - i;
          const normProgress = symIndex / halfPoints;
          const binIndex = Math.min(numBins - 1, Math.floor(normProgress * 38));
          const rawAudio = (dataArray[binIndex] || 0) / 255;
          const smoothAudio = smoothedData.current[binIndex] || 0;
          const audioAmp = (rawAudio * 0.65 + smoothAudio * 0.35) * options.sensitivity;

          // Flowing out-of-phase harmonic waves - smoothly rotating around the circle ("ghoomti hui")!
          // Wave height expands noticeably when mids, vocals, and bass are playing
          const waveRot1 = Math.sin(angle * 3 + wavePhase * 1.1) * (0.04 + midEnergy * 0.14);
          const waveRot2 = Math.cos(angle * 5 - wavePhase * 0.7) * (0.026 + midEnergy * 0.09);
          const bassLobe = Math.cos(angle * 2) * (liveBass * 0.08 + bassPunch * 0.08);
          const audioLift = audioAmp * 0.10;

          const harmonicDeform = waveRot1 + waveRot2 + bassLobe + audioLift;
          const r = secondaryRadius * (1.0 + harmonicDeform);
          const x = center.x + Math.cos(angle) * r;
          const y = center.y + Math.sin(angle) * r;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // 5. LAYER 1: PRIMARY LIVING ORGANIC ENERGY RING (Genuinely Audio-Reactive & Smoothly Rotating)
        // Restores the original beloved silky-smooth continuous rotating wave ribbon ("ghoomti hui")
        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2;
          const symIndex = i <= halfPoints ? i : points - i;
          const normProgress = symIndex / halfPoints; // 0 to 1

          // Real FFT bin interpolation across bins 1 to 44
          const binFloat = 1 + normProgress * 42;
          const b0 = Math.floor(binFloat);
          const b1 = Math.min(numBins - 1, b0 + 1);
          const frac = binFloat - b0;
          const rawBinAmp = ((dataArray[b0] || 0) * (1 - frac) + (dataArray[b1] || 0) * frac) / 255;
          const smoothBinAmp = ((smoothedData.current[b0] || 0) * (1 - frac) + (smoothedData.current[b1] || 0) * frac);
          // Snappy raw audio hit + smooth continuity
          const audioAmp = (rawBinAmp * 0.68 + smoothBinAmp * 0.32) * options.sensitivity;

          // Natural organic undulations that smoothly flow and rotate around the perimeter ("ghoomti hui"):
          // 1. Primary mid-range travelling lobes (3 lobes, rotating forward with wavePhase)
          const wave3 = Math.sin(angle * 3 + wavePhase * 1.3) * (0.045 + midEnergy * 0.16);
          // 2. Secondary counter-flowing undulating lobes (5 lobes, rotating in counter-phase)
          const wave5 = Math.cos(angle * 5 - wavePhase * 0.85) * (0.028 + midEnergy * 0.10);
          // 3. Bilateral bass pulsation lobes (2 lobes, pulses on kicks)
          const bassLobe = Math.cos(angle * 2) * (liveBass * 0.10 + bassPunch * 0.14);
          // 4. Real frequency amplitude displacement from FFT (reacts directly to audio peaks)
          const freqLift = audioAmp * (0.16 + overallEnergy * 0.12);
          // 5. Fine treble shimmer (cymbals, snares, and hi-hats)
          const highShimmer = Math.sin(angle * 14 + wavePhase * 2.2) * (highEnergy * 0.030);

          // Total deformation for this angle (smooth, organic, continuous, never jagged)
          const totalDeform = wave3 + wave5 + bassLobe + freqLift + highShimmer;
          const r = currentRingRadius * (1.0 + totalDeform);

          cacheX[i] = center.x + Math.cos(angle) * r;
          cacheY[i] = center.y + Math.sin(angle) * r;
          cacheEnergy[i] = totalDeform;
        }

        // A. Inner Translucent Body Fill
        ctx.beginPath();
        for (let i = 0; i <= points; i++) {
          if (i === 0) ctx.moveTo(cacheX[i], cacheY[i]);
          else ctx.lineTo(cacheX[i], cacheY[i]);
        }
        ctx.closePath();

        const auraFillGrad = ctx.createRadialGradient(
          center.x, center.y, currentRingRadius * 0.65,
          center.x, center.y, currentRingRadius * 1.20
        );
        const fillOpacity = Math.min(0.60, 0.12 + overallEnergy * 0.40 + kickSurge * 0.20);
        auraFillGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        auraFillGrad.addColorStop(0.45, `rgba(0, 240, 255, ${fillOpacity * 0.45})`);
        auraFillGrad.addColorStop(0.75, `rgba(255, 45, 120, ${fillOpacity * 0.75})`);
        auraFillGrad.addColorStop(1, `rgba(168, 85, 247, ${fillOpacity})`);
        ctx.fillStyle = auraFillGrad;
        ctx.fill();

        // B. Primary Glowing Ring Contour Stroke
        ctx.save();
        if (useNativeShadow) {
          // Stronger glow on strong beats
          const glowBlur = 10 + Math.floor(overallEnergy * 18 + kickSurge * 14);
          ctx.shadowBlur = getCappedShadowBlur(glowBlur);
          ctx.shadowColor = primaryColor;
        }

        const strokeGrad = ctx.createLinearGradient(
          center.x - currentRingRadius, center.y - currentRingRadius,
          center.x + currentRingRadius, center.y + currentRingRadius
        );
        strokeGrad.addColorStop(0, primaryColor);
        strokeGrad.addColorStop(0.35, secondaryColor);
        strokeGrad.addColorStop(0.70, violetColor);
        strokeGrad.addColorStop(1, primaryColor);

        ctx.strokeStyle = strokeGrad;
        // Stroke width brightens and thickens on beats
        ctx.lineWidth = baseLineWidth * (1.0 + overallEnergy * 0.50 + kickSurge * 0.40);
        ctx.beginPath();
        for (let i = 0; i <= points; i++) {
          if (i === 0) ctx.moveTo(cacheX[i], cacheY[i]);
          else ctx.lineTo(cacheX[i], cacheY[i]);
        }
        ctx.closePath();
        ctx.stroke();

        // C. Brilliant White Highlights along Peak Energy Crests
        if (overallEnergy > 0.06 || kickSurge > 0.08) {
          ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.95, 0.45 + overallEnergy * 0.50 + kickSurge * 0.30)})`;
          ctx.lineWidth = Math.max(1.3 * strokeScale, baseLineWidth * 0.70);
          ctx.beginPath();
          let inHighlight = false;
          for (let i = 0; i <= points; i++) {
            if (cacheEnergy[i] > 0.12) {
              if (!inHighlight) {
                ctx.moveTo(cacheX[i], cacheY[i]);
                inHighlight = true;
              } else {
                ctx.lineTo(cacheX[i], cacheY[i]);
              }
            } else {
              inHighlight = false;
            }
          }
          ctx.stroke();
        }
        ctx.restore();

        // 6. LAYER 0: INNER FOCAL RING (Clean, circular anchor for central artwork)
        ctx.save();
        if (useNativeShadow) {
          ctx.shadowBlur = getCappedShadowBlur(5 + Math.floor(overallEnergy * 8 + kickSurge * 6));
          ctx.shadowColor = `${primaryColor}aa`;
        }
        // Subtly reacts to bass punch while maintaining pure circular geometry
        const innerRingRadius = currentRingRadius * (0.86 - kickSurge * 0.04);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.90)';
        ctx.lineWidth = Math.max(1.2 * strokeScale, baseLineWidth * (0.55 + kickSurge * 0.20));
        ctx.beginPath();
        ctx.arc(center.x, center.y, innerRingRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // --- DRAW 10: AURA 3D WAVE (FULL-WIDTH SPLIT-LEVEL LIQUID OCEAN 3D WAVE & CYBER TOPOGRAPHY) ---
      else if (options.visualizationMode === 'aura-3d-wave') {
        const baseLineWidth = normalLineWidth * (options.lineWidth < 1.8 ? 1.0 : 1.7);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // High-Fidelity Cyber-Grid Palette (Electric Cyan, Hot Magenta/Pink, Deep Ocean Violet, Warm Gold, Soft White)
        const primaryColor = currentPreset.primary || '#00f0ff';
        const secondaryColor = currentPreset.secondary || '#ff2d78';
        const violetColor = '#a855f7';
        const whiteHighlight = '#ffffff';

        // Camera Flat Perspective View:
        // Flat distant horizon at ~58% height, foreground line raised to ~74% height
        const waterHorizonY = canvas.height * 0.58;
        const foregroundWaterY = canvas.height * 0.74;
        const waterDepthSpan = foregroundWaterY - waterHorizonY;
        const maxWaveHeight = (canvas.height * 0.11) * options.sensitivity;

        // Wave resolution: Full-width coverage spanning far past left and right screen borders
        const depthLayers = 26; // Dense wave depth slices from horizon to foreground
        const waveCols = 70;   // High resolution horizontal audio sampling
        const startX = -canvas.width * 0.22;
        const endX = canvas.width * 1.22;
        const totalWidth = endX - startX;

        // Store 3D soundwave mesh surface nodes: oceanMesh[layer][col]
        const oceanMesh: {
          x: number;
          y: number;
          yBase: number;
          audioAmp: number;
          crestEnergy: number;
          depthRatio: number;
          depthAlpha: number;
        }[][] = [];

        for (let l = 0; l < depthLayers; l++) {
          const layerMesh: {
            x: number;
            y: number;
            yBase: number;
            audioAmp: number;
            crestEnergy: number;
            depthRatio: number;
            depthAlpha: number;
          }[] = [];

          const isLastLine = (l === depthLayers - 1);
          // Flat, deep perspective depth ratio: dense horizontal compression at horizon, wide foreground
          const depthRatio = Math.pow((l + 1) / depthLayers, 1.80);
          const yBase = waterHorizonY + depthRatio * waterDepthSpan;
          const depthAlpha = Math.min(1.0, 0.20 + depthRatio * 0.80);

          // Perspective motion scaling: Front lines react with full kick punch, distant layers scaled for depth
          const perspectiveMotionScale = 0.35 + depthRatio * 0.65;

          // Wave travel phase across depth for energetic rolling wave bounce
          const layerFlowPhase = auraWaveTravelPhase.current - (depthLayers - l) * 0.16;

          for (let c = 0; c < waveCols; c++) {
            const colRatio = c / (waveCols - 1);
            const x = startX + colRatio * totalWidth;

            // Direct panoramic audio frequency mapping across 3D space:
            // Center is deep bass & kicks, flanks are vocals & instruments, outer edges are high treble
            const distCenter = Math.abs(colRatio - 0.5) * 2.0; // 0 at center, 1 at edges
            const binIdx = Math.min(numBins - 1, Math.floor(Math.pow(distCenter, 1.1) * (numBins * 0.55)));

            // Live instantaneous FFT reading for ZERO-LATENCY real-time audio punch
            const liveRawBin = (dataArray[binIdx] || 0) / 255 * options.sensitivity;
            const smoothBin = (smoothedData.current[binIdx] || 0) * options.sensitivity;
            const liveColAmp = liveRawBin * 0.70 + smoothBin * 0.30;
            const audioAmp = liveColAmp;

            // Dynamic Wave Bounce Engine (Real-time wave reaction in 100% lockstep with the music):
            // 1. Primary Rolling Swell (Bass & kick driven)
            const mainSwell = Math.sin(colRatio * Math.PI * 2.8 + layerFlowPhase) * 0.5 + 0.5;
            
            // 2. Fluid Cross-Chop (Mids & vocals driven)
            const crossChop = Math.cos(colRatio * Math.PI * 5.8 - layerFlowPhase * 1.3) * (0.04 + auraSmoothedMids.current * 0.16);
            
            // 3. Harmonic Capillary Ripples (Treble/highs driven)
            const capillaryRipples = Math.sin(colRatio * Math.PI * 12.0 + layerFlowPhase * 2.2) * (0.02 + auraSmoothedTreble.current * 0.08);

            // 4. Real-time beat kick punch (Immediate physical surge on drum hits)
            const kickPunch = (distCenter < 0.45 ? (1.0 - distCenter / 0.45) : 0) * 
              (isTransient ? 0.38 : (currentBassEnergy > 0.35 ? (currentBassEnergy - 0.35) * 0.40 : 0)) * 
              auraSmoothedBass.current;

            // 5. Base Physical Displacement & Real-Time Beat Bounce
            const swellHeight = (audioAmp * 0.65 + auraSmoothedBass.current * 0.50 + kickPunch) * maxWaveHeight * perspectiveMotionScale;
            const baseDisplacement = swellHeight * (0.35 + mainSwell * 0.65) + (crossChop + capillaryRipples) * (maxWaveHeight * 0.55) * perspectiveMotionScale;

            // 6. Dynamic Beat Splash & Impact Ripple Reaction ("Pani uchhalna" / Stone ripple bounce)
            let splashDisplacement = 0;
            const activeSplashes = auraSplashImpacts.current;
            for (let s = 0; s < activeSplashes.length; s++) {
              const sp = activeSplashes[s];
              const dx = (colRatio - sp.xNorm);
              const dz = (depthRatio - sp.zNorm);
              const distSq = dx * dx * 3.2 + dz * dz;
              const dist = Math.sqrt(distSq);

              const progress = sp.age / sp.maxAge;
              const riseFactor = sp.age < sp.riseFrames
                ? Math.sin((sp.age / sp.riseFrames) * (Math.PI / 2))
                : Math.cos(((sp.age - sp.riseFrames) / Math.max(1, sp.maxAge - sp.riseFrames)) * (Math.PI / 2));

              // Erupting bounce peak & expanding concentric ripple ring
              const geyserSpike = Math.exp(-distSq * 75.0) * riseFactor * sp.intensity * (maxWaveHeight * 0.70);
              const rippleExpansion = sp.age * 0.018;
              const rippleDist = dist - rippleExpansion;
              const rippleRing = Math.exp(-Math.abs(rippleDist) * 16.0) * Math.sin(rippleDist * 32.0) * Math.max(0, 1.0 - progress) * sp.intensity * (6 * strokeScale);

              splashDisplacement += geyserSpike + rippleRing;
            }

            let totalDisplacement = 0;

            if (isLastLine) {
              // Sabse aage wali aakhiri line: Real-time dynamic response locked to song beat with clean smooth contour
              const frontLiveLift = (audioAmp * 0.60 + auraSmoothedBass.current * 0.50 + kickPunch) * maxWaveHeight * perspectiveMotionScale;
              const frontSwell = Math.sin(colRatio * Math.PI * 2.8 + layerFlowPhase) * (maxWaveHeight * 0.22) * perspectiveMotionScale;
              totalDisplacement = Math.min(maxWaveHeight * 1.35, frontLiveLift * (0.45 + mainSwell * 0.55) + frontSwell);
            } else {
              // ALL OTHER 3D WAVE LAYERS: Full dynamic real-time bounce with ripples and splashes across inner & outer sides!
              totalDisplacement = Math.min(maxWaveHeight * 1.55, baseDisplacement + splashDisplacement);
            }

            const y = yBase - totalDisplacement;
            const crestEnergy = Math.max(0, totalDisplacement / Math.max(1, maxWaveHeight * perspectiveMotionScale));

            layerMesh.push({
              x,
              y,
              yBase,
              audioAmp,
              crestEnergy,
              depthRatio,
              depthAlpha,
            });
          }
          oceanMesh.push(layerMesh);
        }

        ctx.save();
        ctx.shadowBlur = 0; // Guaranteed zero blur overhead for 60fps locked rendering

        // --- 1. SOLID DEEP CYBER ABYSS BODY (Covers background image beneath the wave mesh so background image ONLY shows ABOVE the waves in the sky) ---
        const backRow = oceanMesh[0];
        const foregroundRow = oceanMesh[depthLayers - 1];

        ctx.beginPath();
        ctx.moveTo(backRow[0].x, backRow[0].y);
        for (let c = 1; c < waveCols; c++) {
          ctx.lineTo(backRow[c].x, backRow[c].y);
        }
        ctx.lineTo(canvas.width + 60, canvas.height + 60);
        ctx.lineTo(-60, canvas.height + 60);
        ctx.closePath();

        // 100% Opaque solid base so the background image NEVER shows below the wave horizon
        ctx.fillStyle = '#06010f';
        ctx.fill();

        // Rich neon liquid gradient across the wave basin
        const abyssGrad = ctx.createLinearGradient(0, waterHorizonY, 0, canvas.height);
        abyssGrad.addColorStop(0, `${violetColor}44`);
        abyssGrad.addColorStop(0.35, `${secondaryColor}38`);
        abyssGrad.addColorStop(0.70, `${primaryColor}24`);
        abyssGrad.addColorStop(1, '#06010f');
        ctx.fillStyle = abyssGrad;
        ctx.fill();

        // --- 2. LIQUID SURFACE DEPTH RIBBONS (Back to Front Layers) ---
        for (let l = 1; l < depthLayers; l++) {
          const prevRow = oceanMesh[l - 1];
          const currRow = oceanMesh[l];
          const depthAlpha = currRow[0].depthAlpha;
          const depthRatio = currRow[0].depthRatio;

          // Ribbon fill between successive wave rows
          ctx.beginPath();
          ctx.moveTo(prevRow[0].x, prevRow[0].y);
          for (let c = 1; c < waveCols; c++) {
            ctx.lineTo(prevRow[c].x, prevRow[c].y);
          }
          for (let c = waveCols - 1; c >= 0; c--) {
            ctx.lineTo(currRow[c].x, currRow[c].y);
          }
          ctx.closePath();

          const liquidFill = ctx.createLinearGradient(0, prevRow[0].y, 0, currRow[0].y);
          liquidFill.addColorStop(0, `${primaryColor}14`);
          liquidFill.addColorStop(0.50, `${violetColor}${Math.floor(depthAlpha * 40).toString(16).padStart(2, '0')}`);
          liquidFill.addColorStop(1, `${secondaryColor}${Math.floor(depthAlpha * 55).toString(16).padStart(2, '0')}`);
          ctx.fillStyle = liquidFill;
          ctx.fill();

          // Transverse luminous sound crest contour line
          ctx.beginPath();
          ctx.moveTo(currRow[0].x, currRow[0].y);
          for (let c = 1; c < waveCols; c++) {
            ctx.lineTo(currRow[c].x, currRow[c].y);
          }

          const crestGrad = ctx.createLinearGradient(currRow[0].x, 0, currRow[waveCols - 1].x, 0);
          crestGrad.addColorStop(0, primaryColor);
          crestGrad.addColorStop(0.25, secondaryColor);
          crestGrad.addColorStop(0.50, violetColor);
          crestGrad.addColorStop(0.75, secondaryColor);
          crestGrad.addColorStop(1, primaryColor);

          ctx.strokeStyle = crestGrad;
          ctx.lineWidth = Math.max(0.85 * strokeScale, baseLineWidth * (0.35 + depthRatio * 0.65));
          ctx.globalAlpha = depthAlpha * 0.90;
          ctx.stroke();
        }

        // --- 3. FLOWING LONGITUDINAL SOUND PERSPECTIVE STREAMLINES ---
        for (let c = 0; c < waveCols; c += 3) {
          ctx.beginPath();
          const colGrad = ctx.createLinearGradient(0, waterHorizonY, 0, foregroundWaterY);
          colGrad.addColorStop(0, `${primaryColor}10`);
          colGrad.addColorStop(0.35, `${violetColor}28`);
          colGrad.addColorStop(0.75, `${secondaryColor}48`);
          colGrad.addColorStop(1, `${primaryColor}68`);

          ctx.strokeStyle = colGrad;
          ctx.lineWidth = Math.max(0.6 * strokeScale, baseLineWidth * 0.28);
          ctx.globalAlpha = 0.60;

          for (let l = 0; l < depthLayers; l++) {
            const pt = oceanMesh[l][c];
            if (l === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();
        }

        // --- 4. GLOWING SOUND MESH NODES ---
        for (let l = 0; l < depthLayers; l += 2) {
          const row = oceanMesh[l];
          const depthAlpha = row[0].depthAlpha;
          const depthRatio = row[0].depthRatio;

          for (let c = 0; c < waveCols; c += 2) {
            const pt = row[c];
            const nodeRadius = (0.70 + depthRatio * 1.4) * strokeScale;

            ctx.beginPath();
            ctx.arc(pt.x, pt.y, nodeRadius, 0, Math.PI * 2);
            ctx.fillStyle = c % 4 === 0 ? primaryColor : secondaryColor;
            ctx.globalAlpha = depthAlpha * 0.70;
            ctx.fill();
          }
        }

        // --- 5. SURFACE FINISH (Pure clean wave surface with zero stray particles) ---
        ctx.globalAlpha = 1.0;
        ctx.restore();

        // --- 9. SUBTLE FLOATING LP FOCAL BADGE (Positioned high in sky so it never blocks the water surface) ---
        if (options.centerImageUrl && centerImgRef.current) {
          const centerImg = centerImgRef.current;
          const shouldRotate = options.rotateCenterImage !== false;
          const spinAngle = (isPlaying && shouldRotate) ? coverSpinAngle.current : 0;
          const discRadius = Math.max(14, (Math.min(canvas.width, canvas.height) * 0.11) * options.radius);
          const discCenterY = Math.max(discRadius + 16 * strokeScale, waterHorizonY * 0.38);

          ctx.save();
          // Radiant aura halo behind floating disc
          const discGlow = ctx.createRadialGradient(
            center.x, discCenterY, discRadius * 0.70,
            center.x, discCenterY, discRadius * 1.50
          );
          discGlow.addColorStop(0, `${primaryColor}45`);
          discGlow.addColorStop(0.45, `${violetColor}25`);
          discGlow.addColorStop(0.85, `${secondaryColor}0a`);
          discGlow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = discGlow;
          ctx.beginPath();
          ctx.arc(center.x, discCenterY, discRadius * 1.50, 0, Math.PI * 2);
          ctx.fill();

          // Draw disc image
          ctx.save();
          ctx.translate(center.x, discCenterY);
          ctx.rotate(spinAngle);
          ctx.translate(-center.x, -discCenterY);

          const imgAspect = centerImg.width / centerImg.height;
          let sWidth = discRadius * 2;
          let sHeight = discRadius * 2;
          let sx = center.x - discRadius;
          let sy = discCenterY - discRadius;

          if (imgAspect > 1) {
            sWidth = discRadius * 2 * imgAspect;
            sx = center.x - sWidth / 2;
          } else if (imgAspect < 1) {
            sHeight = (discRadius * 2) / imgAspect;
            sy = discCenterY - sHeight / 2;
          }

          ctx.save();
          ctx.beginPath();
          ctx.arc(center.x, discCenterY, discRadius, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(centerImg, sx, sy, sWidth, sHeight);
          ctx.restore();

          ctx.restore(); // restore rotation

          // Glowing border ring
          ctx.strokeStyle = `${primaryColor}ee`;
          ctx.lineWidth = 2.0 * strokeScale;
          ctx.beginPath();
          ctx.arc(center.x, discCenterY, discRadius, 0, Math.PI * 2);
          ctx.stroke();

          // Subtle inner rim highlight
          ctx.strokeStyle = `${whiteHighlight}88`;
          ctx.lineWidth = 1.0 * strokeScale;
          ctx.beginPath();
          ctx.arc(center.x, discCenterY, discRadius - 2 * strokeScale, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Restore neon shadow before rendering particles so they don't drag frame rate down
      ctx.restore();

      // --- PARTICLE UPDATE AND RENDER ENGINE (NEBULA BLAST / GLOWING STARDUST PARTICLES) ---
      // Clear all particles immediately if song is stopped/paused or not in particle-blast mode!
      if (!isPlaying || options.visualizationMode !== 'particle-blast') {
        particles.current = [];
      }

      // This renders the dynamic particle blast ring exploding outwards in 360 degrees
      if (options.visualizationMode === 'particle-blast' && particles.current.length > 0) {
        // High density pool for fine glowing particles while maintaining 60fps
        if (particles.current.length > 350) {
          particles.current = particles.current.slice(-350);
        }

        ctx.save();
        // Additive blending makes overlapping glowing particles radiate brilliantly without dimness!
        ctx.globalCompositeOperation = 'lighter';

        particles.current.forEach((p) => {
          p.life++;
          p.x += p.vx;
          p.y += p.vy;

          // Natural air resistance & gentle drift
          p.vx *= 0.965;
          p.vy *= 0.965;

          // Smooth natural fade: full brightness at start, gently dissolving at the end
          const lifeFraction = p.life / p.maxLife;
          const fade = Math.max(0, 1.0 - lifeFraction);
          const twinkle = p.twinkleSpeed ? (0.85 + 0.15 * Math.sin(p.life * p.twinkleSpeed * 10)) : 1.0;
          p.alpha = fade * twinkle;

          // Micro particle radius stays crisp (does not shrink to zero)
          const currentRadius = Math.max(0.7 * strokeScale, p.size * (0.6 + 0.4 * (1.0 - lifeFraction)));

          // Clean, crisp vibrant micro-particle body (NO aura bubble ring!)
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
          ctx.fill();

          // Brilliant sparkling diamond pinpoint center on sparks and active particles
          if (p.isSpark || p.size > 1.3 * strokeScale) {
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0.4, currentRadius * 0.45), 0, Math.PI * 2);
            ctx.fill();
          }
        });
        ctx.restore();

        // Clean up dead particles
        particles.current = particles.current.filter((p) => p.life < p.maxLife);
      }

      // Request next animation frame if playing
      animationFrameRef.current = requestAnimationFrame(renderFrame);
    };

    renderFrame();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyserNode, isPlaying, options]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black rounded-3xl" id="canvas-container">
      <canvas
        ref={canvasRef}
        id="visualizer-main-canvas"
        className="w-full h-full object-cover transition-opacity duration-300"
      />
    </div>
  );
}
