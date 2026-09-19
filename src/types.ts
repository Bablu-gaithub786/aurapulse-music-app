export interface VisualizerOptions {
  sensitivity: number;
  lineWidth: number;
  radius: number;
  glowIntensity: number;
  fullCoverage: boolean;
  colorTheme: string;
  visualizationMode: 'spikes' | 'liquid-wave' | 'bar-chart' | 'particle-blast' | 'dj-wings' | 'weave-horizontal-spectrum' | 'weave-horizontal-bars' | 'weave-horizontal-liquid' | 'aura-pulse' | 'aura-3d-wave';
  audioSource: 'none' | 'microphone' | 'file' | 'synth-phonk' | 'synth-ambient';
  useAgc: boolean;
  useDynamicEasing: boolean;
  backgroundImageUrl: string | null;
  centerImageUrl: string | null;
  bgBlur: number;
  bgOpacity: number;
  symmetry?: 'none' | 'bottom' | 'horizontal' | 'quad' | 'radial';
  aspectRatio?: '9:16' | '1:1' | '16:9';
  bgBlurStyle?: 'circle' | 'full';
  bgRoundness?: number;
  exportDimensions?: { width: number; height: number };
  rotateCenterImage?: boolean;
  rotateWaves?: boolean;
  customColorEnabled?: boolean;
  customColor?: string;
  vivoT4LightStyle?: 'dynamic-ring' | 'neon-pulse' | 'laser-halo' | 'cosmic-star';
  vivoT4LightColor?: string;
  ambientEdgeEnabled?: boolean;
  ambientEdgeStyle?: 'dynamic-rgb-flow' | 'vivo-reactive' | 'rotating-gradient' | 'pulsing-neon' | 'dual-laser' | 'corner-beams' | 'aurora-flow';
  ambientEdgePreset?: 'dynamic-rainbow' | 'clockwise-rgb' | 'toxic-aurora' | 'sunset-glow' | 'vivo-soundwave' | 'vivo-sour' | 'vivo-aurora' | 'vivo-rgb-spectrum' | 'none';
  ambientEdgeColor?: string;
  ambientEdgeGlow?: number;
  ambientEdgeSpeed?: number;
  ambientEdgeWidth?: number;
  ambientEdgeMode?: 'vivo-music' | 'dynamic-flow';
  ambientEdgeAudioReactive?: boolean;
  ambientEdgeTriggerCondition?: 'screen-off-music' | 'always-screen-on-off';
}

export interface AudioStats {
  volume: number;
  rms: number;
  currentGain: number;
  isTransient: boolean;
  bassEnergy: boolean;
  easingFactor: number;
  bpm: number;
  frequencyBands?: number[];
  bassLevel?: number;
  midLevel?: number;
  trebleLevel?: number;
  rawWaveform?: number[];
}

export interface ColorPreset {
  name: string;
  id: string;
  primary: string;
  secondary: string;
  glow: string;
  background: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  {
    name: "Cyber Punk",
    id: "cyberpunk",
    primary: "#ff007f", // Hot Pink
    secondary: "#00ffff", // Cyan
    glow: "rgba(255, 0, 127, 0.8)",
    background: "from-slate-950 via-purple-950 to-slate-950"
  },
  {
    name: "Aura Blue",
    id: "aurablue",
    primary: "#00d2ff", // Electric Blue
    secondary: "#00f5a0", // Seafoam
    glow: "rgba(0, 210, 255, 0.8)",
    background: "from-zinc-950 via-cyan-950 to-zinc-950"
  },
  {
    name: "Toxic Green",
    id: "toxicgreen",
    primary: "#39ff14", // Neon Green
    secondary: "#00ffcc", // Neon Aqua
    glow: "rgba(57, 255, 20, 0.8)",
    background: "from-neutral-950 via-emerald-950 to-neutral-950"
  },
  {
    name: "Sunset Flare",
    id: "sunset",
    primary: "#ff4e50", // Coral Pink
    secondary: "#f9d423", // Gold Yellow
    glow: "rgba(255, 78, 80, 0.8)",
    background: "from-stone-950 via-red-950 to-stone-950"
  },
  {
    name: "Ethereal Violet",
    id: "violet",
    primary: "#b000ff", // Purple
    secondary: "#ff00bb", // Violet Magenta
    glow: "rgba(176, 0, 255, 0.8)",
    background: "from-zinc-950 via-violet-950 to-zinc-950"
  },
  {
    name: "Solid Red",
    id: "solidred",
    primary: "#ff0033",
    secondary: "#ff0033",
    glow: "rgba(255, 0, 51, 0.85)",
    background: "from-zinc-950 via-red-950/20 to-zinc-950"
  },
  {
    name: "Solid Blue",
    id: "solidblue",
    primary: "#0066ff",
    secondary: "#0066ff",
    glow: "rgba(0, 102, 255, 0.85)",
    background: "from-zinc-950 via-blue-950/20 to-zinc-950"
  },
  {
    name: "Solid Purple",
    id: "solidpurple",
    primary: "#9900ff",
    secondary: "#9900ff",
    glow: "rgba(153, 0, 255, 0.85)",
    background: "from-zinc-950 via-purple-950/20 to-zinc-950"
  },
  {
    name: "Solid Orange",
    id: "solidorange",
    primary: "#ff5e00",
    secondary: "#ff5e00",
    glow: "rgba(255, 94, 0, 0.85)",
    background: "from-zinc-950 via-orange-950/15 to-zinc-950"
  },
  {
    name: "Solid Cyan",
    id: "solidcyan",
    primary: "#00f0ff",
    secondary: "#00f0ff",
    glow: "rgba(0, 240, 255, 0.85)",
    background: "from-zinc-950 via-cyan-950/20 to-zinc-950"
  }
];
