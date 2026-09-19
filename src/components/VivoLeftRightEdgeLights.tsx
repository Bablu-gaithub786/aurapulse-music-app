import React, { useRef, useEffect } from 'react';
import { AudioStats } from '../types';

interface VivoLeftRightEdgeLightsProps {
  presetId: 'vivo-soundwave' | 'vivo-sour' | 'vivo-aurora' | 'vivo-rgb-spectrum' | string;
  stats: AudioStats;
  isPlaying: boolean;
  thicknessPx?: number;
  glowBlur?: number;
  speedVal?: number;
  customColor?: string;
  isInsidePhonePreview?: boolean;
}

interface WaveNode {
  yRatio: number;
  currentAmp: number;
  targetAmp: number;
  velocity: number;
  freqWeight: number; // Mapped frequency band index
  hue: number;
  intensity: number;
}

interface SparkleParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  maxAlpha: number;
  size: number;
  color: string;
  life: number;
}

export default function VivoLeftRightEdgeLights({
  presetId,
  stats,
  isPlaying,
  thicknessPx = 4,
  glowBlur = 18,
  speedVal = 3,
  customColor,
  isInsidePhonePreview = false
}: VivoLeftRightEdgeLightsProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Normalize preset: Sound Wave, Aurora, or Reactive RGB Spectrum
  const mode = (presetId === 'vivo-aurora') 
    ? 'vivo-aurora' 
    : (presetId === 'vivo-rgb-spectrum' ? 'vivo-rgb-spectrum' : 'vivo-soundwave');

  // Live state reference for 60 FPS animation loop
  const liveStateRef = useRef({
    mode,
    stats,
    isPlaying,
    thicknessPx,
    glowBlur,
    speedVal,
    customColor,
    isInsidePhonePreview
  });

  useEffect(() => {
    liveStateRef.current = {
      mode,
      stats,
      isPlaying,
      thicknessPx,
      glowBlur,
      speedVal,
      customColor,
      isInsidePhonePreview
    };
  }, [mode, stats, isPlaying, thicknessPx, glowBlur, speedVal, customColor, isInsidePhonePreview]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId: number;

    // Physical elastic nodes for left and right edges (64 nodes for high fidelity)
    const NODE_COUNT = 64;
    const createNodes = (): WaveNode[] => {
      const nodes: WaveNode[] = [];
      for (let i = 0; i <= NODE_COUNT; i++) {
        const yRatio = i / NODE_COUNT;
        const freqWeight = Math.min(31, Math.floor(yRatio * 31));
        nodes.push({
          yRatio,
          currentAmp: 0,
          targetAmp: 0,
          velocity: 0,
          freqWeight,
          hue: 180,
          intensity: 0
        });
      }
      return nodes;
    };

    const leftNodes = createNodes();
    const rightNodes = createNodes();

    // Dynamic micro-particles for kick impacts
    let particles: SparkleParticle[] = [];

    // Real audio-driven physics state trackers
    let prevBass = 0.0;
    let prevVol = 0.0;
    let kickImpulse = 0.0;
    let vocalRipple = 0.0;
    let smoothBassEnergy = 0.0;
    let smoothMidEnergy = 0.0;
    let smoothTrebleEnergy = 0.0;
    let smoothGlobalVol = 0.0;
    let chromaticPhase = 0.0;
    let discoRunnerPhase = 0.0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (rect.width > 0 && rect.height > 0) {
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
      }
    };

    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      const {
        mode: currentMode,
        stats: currentStats,
        isPlaying: currentIsPlaying,
        thicknessPx: currentThickness,
        glowBlur: currentGlow,
        speedVal: currentSpeed,
        isInsidePhonePreview: isPreview
      } = liveStateRef.current;

      const w = canvas.width;
      const h = canvas.height;

      if (w === 0 || h === 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, w, h);

      // -------------------------------------------------------------------------
      // 1. HIGH-ENERGY REAL-TIME AUDIO SPECTRUM EXTRACTION
      // -------------------------------------------------------------------------
      const freqBands = currentStats.frequencyBands || [];
      const hasRealBands = freqBands.length > 0;

      const rawVol = currentIsPlaying ? Math.max(0.0, Math.min(1.0, currentStats.volume)) : 0.0;
      const rawBass = currentIsPlaying 
        ? (currentStats.bassLevel !== undefined ? currentStats.bassLevel : (currentStats.bassEnergy ? 0.9 : rawVol * 0.85)) 
        : 0.0;
      const rawMid = currentIsPlaying 
        ? (currentStats.midLevel !== undefined ? currentStats.midLevel : rawVol * 0.85) 
        : 0.0;
      const rawTreble = currentIsPlaying 
        ? (currentStats.trebleLevel !== undefined ? currentStats.trebleLevel : rawVol * 0.6) 
        : 0.0;

      if (currentIsPlaying) {
        // Fast energetic attack (0.44) and smooth musical release (0.24)
        smoothGlobalVol += (rawVol - smoothGlobalVol) * 0.44;
        smoothBassEnergy += (rawBass - smoothBassEnergy) * 0.48;
        smoothMidEnergy += (rawMid - smoothMidEnergy) * 0.40;
        smoothTrebleEnergy += (rawTreble - smoothTrebleEnergy) * 0.38;

        // Advance chromatic color wave phase proportionally to music pace
        chromaticPhase += (0.015 + rawVol * 0.035) * (currentSpeed || 3) * 0.35;
        discoRunnerPhase += (0.006 + smoothGlobalVol * 0.022 + kickImpulse * 0.035) * (currentSpeed || 3) * 0.40;

        // Detect real physical kick surge (Transient attack delta)
        const bassDelta = Math.max(0, rawBass - prevBass);
        const volDelta = Math.max(0, rawVol - prevVol);
        if (currentStats.isTransient || bassDelta > 0.07 || (rawBass > 0.52 && volDelta > 0.05)) {
          kickImpulse = Math.min(1.6, kickImpulse + 0.95 + bassDelta * 2.4);
        } else {
          kickImpulse *= 0.82; // Snappy exponential settling
        }

        // Vocal & Melody flutter (harmonic ripples)
        vocalRipple = smoothMidEnergy * 0.88 + smoothTrebleEnergy * 0.38;

        prevBass = rawBass;
        prevVol = rawVol;
      } else {
        smoothGlobalVol *= 0.65;
        smoothBassEnergy *= 0.65;
        smoothMidEnergy *= 0.65;
        smoothTrebleEnergy *= 0.65;
        kickImpulse *= 0.60;
        vocalRipple *= 0.60;
        prevBass = 0;
        prevVol = 0;
      }

      const isMobilePreview = isPreview || w < 480;
      const scaleFactor = isMobilePreview ? (w / 240) : Math.min(1.4, w / 750);

      // Edge stroke line thickness
      const edgeStroke = Math.max(1.8, currentThickness * scaleFactor * (isMobilePreview ? 0.75 : 0.95));
      const blurAmount = Math.max(3.0, currentGlow * scaleFactor * 0.75);

      // =========================================================================
      // 1. VIVO RGB DISCO (Full Screen 360° Real-Time Audio-Reactive Disco Mode)
      //    - Discrete Sound-Reactive Equalizer Blocks on 4 Borders
      //    - High-Speed Beat-Chasing Laser Comet Runner
      //    - White-Hot Transient Strobe Bursts on Drops
      // =========================================================================
      if (currentMode === 'vivo-rgb-spectrum') {
        ctx.save();

        // 1. DYNAMIC COLOR SPECTRUM MAPPINGS (Sharp Disco Club Hue Jumps)
        const bassHue = (0 + smoothBassEnergy * 45 + kickImpulse * 50) % 360; // Fiery Crimson & Orange
        const midHue = (120 + smoothMidEnergy * 90 + chromaticPhase * 30) % 360; // Electric Cyan, Emerald, Gold
        const trebleHue = (270 + smoothTrebleEnergy * 100) % 360; // Violet, Hot Pink, Magenta
        const accentHue = (50 + smoothBassEnergy * 40 + smoothMidEnergy * 50) % 360;

        // High dynamic contrast: Dims down in silence, EXPLODES on beats
        const discoIntensity = currentIsPlaying 
          ? Math.min(1.0, 0.40 + smoothGlobalVol * 0.60 + kickImpulse * 0.75) 
          : 0.18;

        const strokeOffset = edgeStroke / 2 + (isMobilePreview ? 1.5 : 2);
        const cornerRadius = (isMobilePreview ? 24 : 18) * scaleFactor;
        const r = Math.max(4, Math.min(cornerRadius, (w - strokeOffset * 2) / 2, (h - strokeOffset * 2) / 2));

        const drawPerimeterPath = () => {
          ctx.beginPath();
          ctx.moveTo(strokeOffset + r, strokeOffset);
          ctx.lineTo(w - strokeOffset - r, strokeOffset);
          ctx.arcTo(w - strokeOffset, strokeOffset, w - strokeOffset, strokeOffset + r, r);
          ctx.lineTo(w - strokeOffset, h - strokeOffset - r);
          ctx.arcTo(w - strokeOffset, h - strokeOffset, w - strokeOffset - r, h - strokeOffset, r);
          ctx.lineTo(strokeOffset + r, h - strokeOffset);
          ctx.arcTo(strokeOffset, h - strokeOffset, strokeOffset, h - strokeOffset - r, r);
          ctx.lineTo(strokeOffset, strokeOffset + r);
          ctx.arcTo(strokeOffset, strokeOffset, strokeOffset + r, strokeOffset, r);
          ctx.closePath();
        };

        // 2. FULL 4-CORNER HIGH-SPEED DISCO GRADIENT
        const fullGrad = ctx.createLinearGradient(0, 0, w, h);
        fullGrad.addColorStop(0.0, `hsla(${trebleHue}, 100%, 65%, ${discoIntensity})`);
        fullGrad.addColorStop(0.25, `hsla(${midHue}, 100%, 55%, ${discoIntensity})`);
        fullGrad.addColorStop(0.50, `hsla(${accentHue}, 100%, 55%, ${discoIntensity})`);
        fullGrad.addColorStop(0.75, `hsla(${(midHue + 60) % 360}, 100%, 50%, ${discoIntensity})`);
        fullGrad.addColorStop(1.0, `hsla(${bassHue}, 100%, 55%, ${discoIntensity})`);

        // Dominant shadow color for outer club neon halo
        const dominantShadow = (smoothBassEnergy > smoothMidEnergy && smoothBassEnergy > smoothTrebleEnergy)
          ? `hsl(${bassHue}, 100%, 50%)`
          : (smoothMidEnergy > smoothTrebleEnergy ? `hsl(${midHue}, 100%, 50%)` : `hsl(${trebleHue}, 100%, 60%)`);

        // 3. BACKGROUND PERIMETER LASER RAIL (Ambient Neon Glow)
        ctx.save();
        drawPerimeterPath();
        ctx.strokeStyle = fullGrad;
        ctx.lineWidth = edgeStroke * (1.2 + kickImpulse * 0.9);
        ctx.shadowColor = dominantShadow;
        ctx.shadowBlur = blurAmount * (1.3 + kickImpulse * 1.0);
        ctx.globalAlpha = Math.min(1.0, discoIntensity * 0.95);
        ctx.stroke();
        ctx.restore();

        // 4. BEAT STROBE FLASH (White-Hot core beam that strobes on kick drops)
        if (currentIsPlaying && (kickImpulse > 0.20 || smoothBassEnergy > 0.40)) {
          ctx.save();
          drawPerimeterPath();
          ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.95, kickImpulse * 0.85)})`;
          ctx.lineWidth = Math.max(1.2, edgeStroke * 0.7);
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = blurAmount * 0.8;
          ctx.stroke();
          ctx.restore();
        }

        // =========================================================================
        // 5. DISCRETE SOUND EQUALIZER SPIKES WITH SUBTLE 1-2% ELASTIC BEAT BOUNCE
        //    (Snappy physical micro-bounce on song rhythm & kick hits)
        // =========================================================================
        if (currentIsPlaying && smoothGlobalVol > 0.02) {
          ctx.save();

          // A. BOTTOM BORDER: SUB-BASS & KICK EQUALIZER SPIKES (Upward 1-2% micro-bounce)
          const botBarCount = 12;
          const botStartX = w * 0.15;
          const botEndX = w * 0.85;
          const botStepX = (botEndX - botStartX) / (botBarCount - 1);
          const maxBotBarHeight = (isMobilePreview ? 12 : 24) * scaleFactor;

          for (let i = 0; i < botBarCount; i++) {
            const barX = botStartX + i * botStepX;
            // Center-weighted bass power with elastic micro-bounce
            const centerWeight = Math.sin((i / (botBarCount - 1)) * Math.PI);
            
            // Subtle 1-2% harmonic bounce wave across bars
            const microBounce = Math.sin(chromaticPhase * 3.0 + i * 0.65) * 0.08 * smoothBassEnergy;
            const barAudioPower = Math.min(1.2, (smoothBassEnergy * 1.15 + kickImpulse * 0.95 + microBounce) * centerWeight);
            
            if (barAudioPower > 0.06) {
              // Snappy elastic expansion on kick hits
              const elasticMultiplier = 1.0 + kickImpulse * 0.22 + Math.max(0, microBounce);
              const barH = Math.min(maxBotBarHeight * 1.25, barAudioPower * maxBotBarHeight * elasticMultiplier);
              const barHue = (0 + i * 8 + smoothBassEnergy * 35 + kickImpulse * 20) % 360;

              ctx.save();
              ctx.fillStyle = `hsla(${barHue}, 100%, 60%, ${0.78 + barAudioPower * 0.22})`;
              ctx.shadowColor = `hsl(${barHue}, 100%, 55%)`;
              ctx.shadowBlur = (6 + kickImpulse * 6) * scaleFactor;
              
              // Draw upward pulsing discrete equalizer spike from bottom edge
              const blockW = Math.max(2.5, botStepX * 0.62);
              ctx.fillRect(barX - blockW / 2, h - strokeOffset - barH, blockW, barH);
              
              // Floating / Bouncing white peak cap on beats
              const peakOffset = (kickImpulse > 0.3 ? 1.5 * scaleFactor : 0);
              ctx.fillStyle = barAudioPower > 0.45 ? '#ffffff' : `hsla(${barHue}, 100%, 85%, 0.9)`;
              ctx.fillRect(barX - blockW / 2, h - strokeOffset - barH - peakOffset, blockW, Math.max(1.5, 2.2 * scaleFactor));
              ctx.restore();
            }
          }

          // B. LEFT & RIGHT BORDERS: VOCALS & MELODY EQUALIZER SPIKES (Inward subtle micro-bounce)
          const sideBarCount = 14;
          const sideStartY = h * 0.12;
          const sideEndY = h * 0.88;
          const sideStepY = (sideEndY - sideStartY) / (sideBarCount - 1);
          const maxSideBarWidth = (isMobilePreview ? 12 : 24) * scaleFactor;

          for (let i = 0; i < sideBarCount; i++) {
            const barY = sideStartY + i * sideStepY;
            const progress = i / (sideBarCount - 1);
            
            // Map individual frequency bands with organic ripple bounce
            let barAudioPower = 0;
            const sideBounce = Math.sin(progress * 8.0 + chromaticPhase * 2.5) * 0.07 * smoothMidEnergy;
            
            if (hasRealBands) {
              const bandIdx = Math.min(freqBands.length - 1, Math.floor(progress * freqBands.length));
              barAudioPower = Math.min(1.2, (freqBands[bandIdx] || 0) * 1.35 + smoothMidEnergy * 0.35 + sideBounce);
            } else {
              barAudioPower = Math.min(1.2, (smoothMidEnergy * 1.15 + vocalRipple * 0.4 + sideBounce));
            }

            if (barAudioPower > 0.06) {
              const elasticMultiplier = 1.0 + kickImpulse * 0.18 + Math.max(0, sideBounce);
              const barW = Math.min(maxSideBarWidth * 1.25, barAudioPower * maxSideBarWidth * elasticMultiplier);
              const barHue = (130 + progress * 90 + smoothMidEnergy * 45 + kickImpulse * 25) % 360;
              const blockH = Math.max(2.5, sideStepY * 0.58);

              // Left side block with bouncy cap
              ctx.save();
              ctx.fillStyle = `hsla(${barHue}, 100%, 55%, ${0.78 + barAudioPower * 0.22})`;
              ctx.shadowColor = `hsl(${barHue}, 100%, 55%)`;
              ctx.shadowBlur = (6 + kickImpulse * 5) * scaleFactor;
              ctx.fillRect(strokeOffset, barY - blockH / 2, barW, blockH);

              // Right side block
              ctx.fillStyle = `hsla(${(barHue + 40) % 360}, 100%, 55%, ${0.78 + barAudioPower * 0.22})`;
              ctx.shadowColor = `hsl(${(barHue + 40) % 360}, 100%, 55%)`;
              ctx.fillRect(w - strokeOffset - barW, barY - blockH / 2, barW, blockH);

              // White cap on peaks with subtle bounce
              const peakOffset = (kickImpulse > 0.25 ? 1.5 * scaleFactor : 0);
              ctx.fillStyle = barAudioPower > 0.50 ? '#ffffff' : `hsla(${barHue}, 100%, 85%, 0.9)`;
              ctx.fillRect(strokeOffset + barW - (2 * scaleFactor) + peakOffset, barY - blockH / 2, 2.2 * scaleFactor, blockH);
              ctx.fillRect(w - strokeOffset - barW - peakOffset, barY - blockH / 2, 2.2 * scaleFactor, blockH);
              ctx.restore();
            }
          }

          // C. TOP BORDER: HIGH TREBLE & SNARE STROBE SPIKES (Downward snappy micro-bounce)
          const topBarCount = 10;
          const topStartX = w * 0.18;
          const topEndX = w * 0.82;
          const topStepX = (topEndX - topStartX) / (topBarCount - 1);
          const maxTopBarHeight = (isMobilePreview ? 9 : 18) * scaleFactor;

          for (let i = 0; i < topBarCount; i++) {
            const barX = topStartX + i * topStepX;
            const topBounce = Math.cos(i * 0.8 + chromaticPhase * 3.2) * 0.08 * smoothTrebleEnergy;
            const barAudioPower = Math.min(1.2, smoothTrebleEnergy * 1.35 + vocalRipple * 0.35 + topBounce);

            if (barAudioPower > 0.08) {
              const elasticMultiplier = 1.0 + kickImpulse * 0.20 + Math.max(0, topBounce);
              const barH = Math.min(maxTopBarHeight * 1.25, barAudioPower * maxTopBarHeight * elasticMultiplier);
              const barHue = (270 + i * 12 + smoothTrebleEnergy * 55 + kickImpulse * 30) % 360;
              const blockW = Math.max(2.5, topStepX * 0.52);

              ctx.save();
              ctx.fillStyle = `hsla(${barHue}, 100%, 65%, ${0.82 + barAudioPower * 0.18})`;
              ctx.shadowColor = `hsl(${barHue}, 100%, 65%)`;
              ctx.shadowBlur = (6 + kickImpulse * 5) * scaleFactor;
              ctx.fillRect(barX - blockW / 2, strokeOffset, blockW, barH);

              // Top white cap
              ctx.fillStyle = barAudioPower > 0.50 ? '#ffffff' : `hsla(${barHue}, 100%, 85%, 0.9)`;
              ctx.fillRect(barX - blockW / 2, strokeOffset + barH, blockW, Math.max(1.5, 2.0 * scaleFactor));
              ctx.restore();
            }
          }

          ctx.restore();
        }

        // =========================================================================
        // 6. SOUND-REACTIVE ORBITING LASER COMET RUNNER (Disco Tracer)
        // =========================================================================
        if (currentIsPlaying && smoothGlobalVol > 0.03) {
          ctx.save();
          const perimeterLength = 2 * (w + h);
          const currentPos = (discoRunnerPhase % 1.0) * perimeterLength;
          
          // Map distance along perimeter to (x, y)
          let runnerX = 0;
          let runnerY = 0;
          let runnerColor = '#00f0ff';

          if (currentPos < w) {
            // Top edge (moving left to right)
            runnerX = currentPos;
            runnerY = strokeOffset;
            runnerColor = '#ff00aa';
          } else if (currentPos < w + h) {
            // Right edge (moving top to bottom)
            runnerX = w - strokeOffset;
            runnerY = currentPos - w;
            runnerColor = '#00f0ff';
          } else if (currentPos < 2 * w + h) {
            // Bottom edge (moving right to left)
            runnerX = w - (currentPos - (w + h));
            runnerY = h - strokeOffset;
            runnerColor = '#ff0033';
          } else {
            // Left edge (moving bottom to top)
            runnerX = strokeOffset;
            runnerY = h - (currentPos - (2 * w + h));
            runnerColor = '#39ff14';
          }

          // Draw bright pulsing disco comet head
          const runnerRadius = Math.max(2.5, (3.5 + kickImpulse * 3.0 + smoothGlobalVol * 2.0) * scaleFactor);
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = runnerColor;
          ctx.shadowBlur = blurAmount * (1.5 + kickImpulse * 1.2);
          ctx.beginPath();
          ctx.arc(runnerX, runnerY, runnerRadius, 0, Math.PI * 2);
          ctx.fill();

          // Second smaller runner on opposite side for energetic DJ club feel
          const oppPos = ((discoRunnerPhase + 0.5) % 1.0) * perimeterLength;
          let oppX = 0;
          let oppY = 0;
          let oppColor = '#ffaa00';

          if (oppPos < w) {
            oppX = oppPos;
            oppY = strokeOffset;
            oppColor = '#00ff88';
          } else if (oppPos < w + h) {
            oppX = w - strokeOffset;
            oppY = oppPos - w;
            oppColor = '#ff0055';
          } else if (oppPos < 2 * w + h) {
            oppX = w - (oppPos - (w + h));
            oppY = h - strokeOffset;
            oppColor = '#00d2ff';
          } else {
            oppX = strokeOffset;
            oppY = h - (oppPos - (2 * w + h));
            oppColor = '#ffea00';
          }

          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = oppColor;
          ctx.shadowBlur = blurAmount * 1.4;
          ctx.beginPath();
          ctx.arc(oppX, oppY, runnerRadius * 0.85, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }

        // =========================================================================
        // 7. BEAT DROP INWARD DISCO WASH REFLECTION
        // =========================================================================
        if (currentIsPlaying && (kickImpulse > 0.28 || smoothBassEnergy > 0.48)) {
          const washDepth = (isMobilePreview ? 22 : 40) * scaleFactor * (0.6 + kickImpulse * 0.6);
          
          ctx.save();
          // Bottom kick blast
          const botWash = ctx.createLinearGradient(0, h, 0, h - washDepth);
          botWash.addColorStop(0.0, `hsla(${bassHue}, 100%, 55%, ${0.45 * kickImpulse})`);
          botWash.addColorStop(1.0, 'transparent');
          ctx.fillStyle = botWash;
          ctx.fillRect(0, h - washDepth, w, washDepth);

          // Top treble flash
          const topWash = ctx.createLinearGradient(0, 0, 0, washDepth);
          topWash.addColorStop(0.0, `hsla(${trebleHue}, 100%, 65%, ${0.35 * kickImpulse})`);
          topWash.addColorStop(1.0, 'transparent');
          ctx.fillStyle = topWash;
          ctx.fillRect(0, 0, w, washDepth);

          // Left/Right melody glow
          const leftWash = ctx.createLinearGradient(0, 0, washDepth, 0);
          leftWash.addColorStop(0.0, `hsla(${midHue}, 100%, 50%, ${0.30 * kickImpulse})`);
          leftWash.addColorStop(1.0, 'transparent');
          ctx.fillStyle = leftWash;
          ctx.fillRect(0, 0, washDepth, h);

          const rightWash = ctx.createLinearGradient(w, 0, w - washDepth, 0);
          rightWash.addColorStop(0.0, `hsla(${accentHue}, 100%, 55%, ${0.30 * kickImpulse})`);
          rightWash.addColorStop(1.0, 'transparent');
          ctx.fillStyle = rightWash;
          ctx.fillRect(w - washDepth, 0, washDepth, h);
          ctx.restore();
        }

        ctx.restore();

        // 8. DISCO MICRO SPARKLES ON TRANSIENT DROPS
        if (currentIsPlaying && kickImpulse > 0.45 && particles.length < 24) {
          const edgeSide = Math.floor(Math.random() * 4); // 0=Top, 1=Right, 2=Bottom, 3=Left
          let spawnX = 0;
          let spawnY = 0;
          let pVx = 0;
          let pVy = 0;

          if (edgeSide === 0) {
            spawnX = Math.random() * w;
            spawnY = Math.random() * 6 * scaleFactor;
            pVx = (Math.random() - 0.5) * 1.4;
            pVy = Math.random() * 1.5;
          } else if (edgeSide === 1) {
            spawnX = w - Math.random() * 6 * scaleFactor;
            spawnY = Math.random() * h;
            pVx = -Math.random() * 1.5;
            pVy = (Math.random() - 0.5) * 1.4;
          } else if (edgeSide === 2) {
            spawnX = Math.random() * w;
            spawnY = h - Math.random() * 6 * scaleFactor;
            pVx = (Math.random() - 0.5) * 1.4;
            pVy = -Math.random() * 1.5;
          } else {
            spawnX = Math.random() * 6 * scaleFactor;
            spawnY = Math.random() * h;
            pVx = Math.random() * 1.5;
            pVy = (Math.random() - 0.5) * 1.4;
          }

          const randomDiscoColor = ['#ff0055', '#00f0ff', '#39ff14', '#ffea00', '#b000ff', '#ff3300', '#ffffff'][Math.floor(Math.random() * 7)];

          particles.push({
            x: spawnX,
            y: spawnY,
            vx: pVx,
            vy: pVy,
            alpha: 1.0,
            maxAlpha: 0.95,
            size: Math.max(1.5, (2.2 + Math.random() * 2.2) * scaleFactor),
            color: randomDiscoColor,
            life: 22 + Math.random() * 16
          });
        }

        // Render sparkles
        particles = particles.filter(p => p.life > 0);
        particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.life--;
          p.alpha = (p.life / 25) * p.maxAlpha;

          ctx.save();
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 6;
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      }

      // =========================================================================
      // 2. VIVO SOUND WAVE (Official Silk Wave)
      // =========================================================================
      else if (currentMode === 'vivo-soundwave') {
        const maxWaveDepth = (isMobilePreview ? 30 : 65) * scaleFactor;

        const updateSoundWaveNodes = (nodes: WaveNode[], isLeft: boolean) => {
          for (let i = 0; i <= NODE_COUNT; i++) {
            const node = nodes[i];
            const yProg = node.yRatio;

            const centerBell = Math.sin(yProg * Math.PI);
            const envelope = Math.pow(centerBell, 1.6);

            if (currentIsPlaying && (smoothGlobalVol > 0.008 || kickImpulse > 0.008)) {
              let nodeFreqPower = 0.0;
              if (hasRealBands) {
                const bandIdx = Math.min(freqBands.length - 1, Math.max(0, Math.floor(yProg * freqBands.length)));
                nodeFreqPower = Math.min(1.4, (freqBands[bandIdx] || 0) * 1.35);
              } else {
                nodeFreqPower = (yProg > 0.35 && yProg < 0.75) 
                  ? (smoothBassEnergy * 1.25 + smoothMidEnergy * 0.4) 
                  : (smoothMidEnergy * 1.1 + smoothTrebleEnergy * 0.5);
              }

              const kickPunch = kickImpulse * Math.exp(-Math.pow((yProg - 0.52) / 0.22, 2)) * 1.25;
              const vocalFlutter = vocalRipple * Math.sin(yProg * 12.0 + (isLeft ? 0 : Math.PI)) * 0.38;

              const realAudioMagnitude = Math.max(0, (nodeFreqPower * 0.95 + kickPunch + vocalFlutter));
              node.targetAmp = Math.min(maxWaveDepth, realAudioMagnitude * envelope * maxWaveDepth);
            } else {
              node.targetAmp = 0;
            }

            const tension = 0.48;
            const damping = 0.65;
            const force = (node.targetAmp - node.currentAmp) * tension;
            node.velocity = (node.velocity + force) * damping;
            node.currentAmp += node.velocity;

            if (!currentIsPlaying && Math.abs(node.currentAmp) < 0.05) {
              node.currentAmp = 0;
              node.velocity = 0;
            }
          }

          for (let pass = 0; pass < 2; pass++) {
            for (let i = 1; i < nodes.length - 1; i++) {
              const avg = (nodes[i - 1].currentAmp + nodes[i + 1].currentAmp) * 0.5;
              nodes[i].currentAmp = nodes[i].currentAmp * 0.60 + avg * 0.40;
            }
          }
        };

        updateSoundWaveNodes(leftNodes, true);
        updateSoundWaveNodes(rightNodes, false);

        const drawSilkWaveEdge = (nodes: WaveNode[], isLeft: boolean) => {
          ctx.save();

          const vertGrad = ctx.createLinearGradient(0, 0, 0, h);
          vertGrad.addColorStop(0.0, '#00f7ff'); // Bright Cyan Top
          vertGrad.addColorStop(0.28, '#0088ff'); // Cobalt Electric Blue
          vertGrad.addColorStop(0.55, '#0044ff'); // Deep Blue Center
          vertGrad.addColorStop(0.78, '#8b00ff'); // Neon Purple
          vertGrad.addColorStop(1.0, '#ff00aa'); // Hot Magenta Bottom

          const ribbonGrad = isLeft
            ? ctx.createLinearGradient(0, 0, maxWaveDepth * 1.35, 0)
            : ctx.createLinearGradient(w, 0, w - maxWaveDepth * 1.35, 0);

          const alphaMultiplier = currentIsPlaying 
            ? Math.min(1.0, 0.4 + smoothGlobalVol * 0.45 + kickImpulse * 0.35) 
            : 0.25;

          ribbonGrad.addColorStop(0.0, `rgba(0, 247, 255, ${0.60 * alphaMultiplier})`);
          ribbonGrad.addColorStop(0.35, `rgba(0, 85, 255, ${0.40 * alphaMultiplier})`);
          ribbonGrad.addColorStop(0.75, `rgba(139, 0, 255, ${0.20 * alphaMultiplier})`);
          ribbonGrad.addColorStop(1.0, 'rgba(255, 0, 170, 0.0)');

          const points: { x: number; y: number }[] = nodes.map(node => {
            const y = node.yRatio * h;
            const x = isLeft ? node.currentAmp : (w - node.currentAmp);
            return { x, y };
          });

          if (currentIsPlaying && (smoothGlobalVol > 0.04 || kickImpulse > 0.04)) {
            ctx.beginPath();
            if (isLeft) {
              ctx.moveTo(0, 0);
              for (let i = 0; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
              }
              ctx.lineTo(0, h);
            } else {
              ctx.moveTo(w, 0);
              for (let i = 0; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
              }
              ctx.lineTo(w, h);
            }
            ctx.closePath();
            ctx.fillStyle = ribbonGrad;
            ctx.fill();
          }

          ctx.save();
          ctx.shadowColor = '#00f7ff';
          ctx.shadowBlur = blurAmount * (1.1 + kickImpulse * 0.5);
          ctx.strokeStyle = vertGrad;
          ctx.lineWidth = edgeStroke + (kickImpulse > 0.2 ? 1.0 : 0.0);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const midX = (prev.x + curr.x) / 2;
            const midY = (prev.y + curr.y) / 2;
            ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
          }
          ctx.stroke();
          ctx.restore();

          if (currentIsPlaying && smoothMidEnergy > 0.12) {
            ctx.save();
            ctx.shadowColor = '#b000ff';
            ctx.shadowBlur = blurAmount * 0.7;
            ctx.strokeStyle = vertGrad;
            ctx.lineWidth = Math.max(1.2, edgeStroke * 0.55);
            ctx.globalAlpha = Math.min(0.95, 0.45 + smoothMidEnergy * 0.55);

            ctx.beginPath();
            for (let i = 0; i < nodes.length; i++) {
              const node = nodes[i];
              const y = node.yRatio * h;
              const innerOffset = node.currentAmp * 0.60;
              const innerX = isLeft ? innerOffset : (w - innerOffset);

              if (i === 0) ctx.moveTo(innerX, y);
              else ctx.lineTo(innerX, y);
            }
            ctx.stroke();
            ctx.restore();
          }

          ctx.save();
          ctx.strokeStyle = vertGrad;
          ctx.lineWidth = edgeStroke;
          ctx.shadowColor = '#00f7ff';
          ctx.shadowBlur = blurAmount * 0.8;
          ctx.beginPath();
          if (isLeft) {
            ctx.moveTo(0, 0);
            ctx.lineTo(0, h);
          } else {
            ctx.moveTo(w, 0);
            ctx.lineTo(w, h);
          }
          ctx.stroke();
          ctx.restore();

          ctx.restore();
        };

        drawSilkWaveEdge(leftNodes, true);
        drawSilkWaveEdge(rightNodes, false);

        if (currentIsPlaying && kickImpulse > 0.45 && particles.length < 16) {
          const spawnY = (0.38 + Math.random() * 0.32) * h;
          const isLeft = Math.random() > 0.5;
          particles.push({
            x: isLeft ? (Math.random() * 8 + 2) * scaleFactor : w - (Math.random() * 8 + 2) * scaleFactor,
            y: spawnY,
            vx: (isLeft ? 1 : -1) * (0.4 + Math.random() * 0.6),
            vy: (Math.random() - 0.5) * 1.0,
            alpha: 1.0,
            maxAlpha: 0.90,
            size: Math.max(1.4, (2.0 + Math.random() * 1.8) * scaleFactor),
            color: Math.random() > 0.4 ? '#00f7ff' : '#ff00aa',
            life: 22 + Math.random() * 14
          });
        }

        particles = particles.filter(p => p.life > 0);
        particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.life--;
          p.alpha = (p.life / 28) * p.maxAlpha;

          ctx.save();
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 5;
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      }

      // =========================================================================
      // 3. VIVO AURORA (Atmospheric Breathing Aura)
      // =========================================================================
      else if (currentMode === 'vivo-aurora') {
        const maxAuroraDepth = (isMobilePreview ? 26 : 55) * scaleFactor;
        const steps = 48;

        const drawAuroraEdge = (isLeft: boolean) => {
          ctx.save();

          const vertGrad = ctx.createLinearGradient(0, 0, 0, h);
          vertGrad.addColorStop(0.0, '#00ff99'); // Emerald Mint Top
          vertGrad.addColorStop(0.30, '#00ffcc'); // Neon Electric Teal
          vertGrad.addColorStop(0.65, '#00e5ff'); // Bright Aqua Center
          vertGrad.addColorStop(1.0, '#0077ff'); // Azure Indigo Bottom

          const auraGrad = isLeft
            ? ctx.createLinearGradient(0, 0, maxAuroraDepth * 1.5, 0)
            : ctx.createLinearGradient(w, 0, w - maxAuroraDepth * 1.5, 0);

          const alphaMultiplier = currentIsPlaying 
            ? Math.min(1.0, 0.45 + smoothGlobalVol * 0.45 + kickImpulse * 0.35) 
            : 0.35;

          auraGrad.addColorStop(0.0, `rgba(0, 255, 204, ${0.60 * alphaMultiplier})`);
          auraGrad.addColorStop(0.35, `rgba(0, 229, 255, ${0.40 * alphaMultiplier})`);
          auraGrad.addColorStop(0.75, `rgba(0, 119, 255, ${0.18 * alphaMultiplier})`);
          auraGrad.addColorStop(1.0, 'rgba(0, 255, 204, 0.0)');

          const auraPoints: { x: number; y: number }[] = [];
          for (let i = 0; i <= steps; i++) {
            const yProg = i / steps;
            const y = yProg * h;

            const centerBell = Math.sin(yProg * Math.PI);
            const envelope = Math.pow(centerBell, 1.5);

            let depth = 0;
            if (currentIsPlaying && (smoothGlobalVol > 0.015 || kickImpulse > 0.015)) {
              const audioPush = (smoothBassEnergy * 0.75 + smoothMidEnergy * 0.55 + kickImpulse * 0.65);
              const naturalContour = 0.85 + 0.15 * Math.sin(yProg * 8.0);
              depth = Math.min(maxAuroraDepth, audioPush * naturalContour * envelope * maxAuroraDepth);
            } else {
              depth = 0;
            }

            const x = isLeft ? depth : (w - depth);
            auraPoints.push({ x, y });
          }

          if (currentIsPlaying && (smoothGlobalVol > 0.03 || kickImpulse > 0.03)) {
            ctx.beginPath();
            if (isLeft) {
              ctx.moveTo(0, 0);
              for (let i = 0; i <= steps; i++) {
                ctx.lineTo(auraPoints[i].x, auraPoints[i].y);
              }
              ctx.lineTo(0, h);
            } else {
              ctx.moveTo(w, 0);
              for (let i = 0; i <= steps; i++) {
                ctx.lineTo(auraPoints[i].x, auraPoints[i].y);
              }
              ctx.lineTo(w, h);
            }
            ctx.closePath();
            ctx.fillStyle = auraGrad;
            ctx.fill();
          }

          ctx.save();
          ctx.shadowColor = '#00ffcc';
          ctx.shadowBlur = blurAmount * (1.2 + kickImpulse * 0.4);
          ctx.strokeStyle = vertGrad;
          ctx.lineWidth = edgeStroke + (kickImpulse > 0.2 ? 0.8 : 0.0);
          ctx.lineCap = 'round';

          ctx.beginPath();
          ctx.moveTo(auraPoints[0].x, auraPoints[0].y);
          for (let i = 1; i <= steps; i++) {
            const prev = auraPoints[i - 1];
            const curr = auraPoints[i];
            const midX = (prev.x + curr.x) / 2;
            const midY = (prev.y + curr.y) / 2;
            ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
          }
          ctx.stroke();
          ctx.restore();

          ctx.save();
          ctx.strokeStyle = vertGrad;
          ctx.lineWidth = edgeStroke;
          ctx.shadowColor = '#00ffcc';
          ctx.shadowBlur = blurAmount * 0.85;
          ctx.beginPath();
          if (isLeft) {
            ctx.moveTo(0, 0);
            ctx.lineTo(0, h);
          } else {
            ctx.moveTo(w, 0);
            ctx.lineTo(w, h);
          }
          ctx.stroke();
          ctx.restore();

          ctx.restore();
        };

        drawAuroraEdge(true);
        drawAuroraEdge(false);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{
          filter: isInsidePhonePreview ? 'none' : 'contrast(1.1) brightness(1.08)'
        }}
      />
    </div>
  );
}
