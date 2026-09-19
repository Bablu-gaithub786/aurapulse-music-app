import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Settings, 
  Music, 
  Disc, 
  Activity, 
  Mic, 
  RotateCw,
  Compass,
  Sliders,
  Zap,
  Image,
  Upload,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Eye,
  SlidersHorizontal,
  Layers,
  Palette,
  Sparkles,
  Plus,
  X,
  Maximize2,
  Minimize2,
  Info,
  Smartphone,
  CheckCircle,
  ExternalLink,
  Video,
  ArrowLeft,
  Scissors,
  Crown,
  Lock,
  Film
} from 'lucide-react';

import { VisualizerOptions, AudioStats, COLOR_PRESETS } from './types';
import { ProceduralSynth } from './utils/audioSynth';
import { PRESET_BACKGROUNDS, PRESET_CENTERS } from './data/images';
import { preloadAllPresets } from './utils/imageCache';
import VisualizerCanvas from './components/VisualizerCanvas';
import AmbientEdgeGlow from './components/AmbientEdgeGlow';
import VivoT4AodOverlay from './components/VivoT4AodOverlay';
import VivoMusicLightEffectScreen, { VIVO_PRESETS, LightEffectPreset } from './components/VivoMusicLightEffectScreen';
import InstagramAudioTrimmer from './components/InstagramAudioTrimmer';
import AdModal, { AdModalProps } from './components/AdModal';
import PremiumPlansModal from './components/PremiumPlansModal';
import { 
  getMonetizationState, 
  unlockLifetimeEffect, 
  activatePremiumMonthly, 
  MonetizationState 
} from './utils/monetization';
import { AuthModal } from './components/AuthModal';
import { auth, db, recordUserLogin, UserProfile } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// @ts-ignore
import ysFixWebmDuration from 'fix-webm-duration';

// A highly robust helper to fix missing WebM duration metadata for native browser recorder exports
const fixWebmDurationHelper = (blob: Blob, durationInMs: number, callback: (fixedBlob: Blob) => void) => {
  try {
    const fn = (ysFixWebmDuration as any)?.default || ysFixWebmDuration;
    if (typeof fn === 'function') {
      console.log(`Injecting correct duration metadata: ${durationInMs}ms into WebM Blob`);
      fn(blob, durationInMs, callback);
    } else {
      console.warn("ysFixWebmDuration is not a function/unsupported, using original blob.", fn);
      callback(blob);
    }
  } catch (err) {
    console.error("Error fixing WebM duration metadata:", err);
    callback(blob);
  }
};

const convertWebmToMp4OnServer = async (
  webmBlob: Blob,
  filename: string,
  setIsTranscoding: (val: boolean) => void,
  setTranscodeMessage: (msg: string) => void,
  fallbackSave: (blob: Blob) => void
) => {
  setIsTranscoding(true);
  setTranscodeMessage("Converting WebM to ultra-compatible MP4 for Instagram Reels & WhatsApp... (वीडियो को Reels और WhatsApp के लिए MP4 में बदला जा रहा है...)");
  
  try {
    const formData = new FormData();
    formData.append("video", webmBlob, "recording.webm");

    const response = await fetch("/api/convert-to-mp4", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Server conversion returned status ${response.status}`);
    }

    const mp4Blob = await response.blob();
    const url = URL.createObjectURL(mp4Blob);
    const a = document.createElement('a');
    a.href = url;
    const mp4Filename = filename.replace(/\.(webm|mp4)$/i, '') + '.mp4';
    a.download = mp4Filename;
    a.click();
    console.log("Successfully converted WebM to MP4 and triggered download.");
  } catch (error) {
    console.error("Server-side conversion failed, downloading original WebM as fallback:", error);
    fallbackSave(webmBlob);
  } finally {
    setIsTranscoding(false);
  }
};

const DEFAULT_OPTIONS: VisualizerOptions = {
  sensitivity: 0.5,
  lineWidth: 2.2,
  radius: 0.65,
  glowIntensity: 0.5,
  fullCoverage: true,
  colorTheme: 'cyberpunk',
  visualizationMode: 'spikes',
  audioSource: 'file',
  useAgc: true,
  useDynamicEasing: true,
  backgroundImageUrl: null,
  centerImageUrl: PRESET_CENTERS[0].url,
  bgBlur: 5,
  bgOpacity: 0.30,
  symmetry: 'bottom',
  aspectRatio: '9:16',
  bgBlurStyle: 'circle',
  bgRoundness: 0.0,
  rotateCenterImage: true,
  rotateWaves: true,
  customColorEnabled: false,
  customColor: '#ff0033',
  vivoT4LightStyle: 'dynamic-ring',
  vivoT4LightColor: '#ff007f',
  ambientEdgeEnabled: false,
  ambientEdgeStyle: 'dynamic-rgb-flow',
  ambientEdgeColor: '#00f0ff',
  ambientEdgeGlow: 16,
  ambientEdgeSpeed: 1,
  ambientEdgeWidth: 4,
  ambientEdgeMode: 'dynamic-flow',
  ambientEdgeAudioReactive: false,
};

export default function App() {
  const [options, setOptions] = useState<VisualizerOptions>(DEFAULT_OPTIONS);
  const [activeTab, setActiveTab] = useState<'audio' | 'wave-styles' | 'layouts' | 'glow-fx' | 'backdrops' | 'vivo-edge'>('audio');
  const [isVivoAodActive, setIsVivoAodActive] = useState<boolean>(false);

  const updateOption = <K extends keyof VisualizerOptions>(key: K, value: VisualizerOptions[K]) => {
    setOptions(prev => ({
      ...prev,
      [key]: value
    }));
  };
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>('AuraPulse Demo Groove.mp3');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.8);
  const [isIgnited, setIsIgnited] = useState<boolean>(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [isTranscoding, setIsTranscoding] = useState<boolean>(false);
  const [transcodeMessage, setTranscodeMessage] = useState<string>('');
  const [showExportSuccessModal, setShowExportSuccessModal] = useState<boolean>(false);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState<boolean>(false);
  const [exportQuality, setExportQuality] = useState<'sd' | 'hd' | '4k'>('hd');

  // Monetization & AdMob State
  const [monetization, setMonetization] = useState<MonetizationState>(() => getMonetizationState());
  const [showPremiumModal, setShowPremiumModal] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [isVipAuthFlow, setIsVipAuthFlow] = useState<boolean>(false);

  // Preload all backdrop & center disc images immediately on mount for zero-latency switching
  useEffect(() => {
    preloadAllPresets();
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            setCurrentUser(data);
            if (data.isVIP && !monetization.isPremium) {
              setMonetization(prev => ({
                ...prev,
                isPremium: true,
                premiumExpiryDate: data.vipPurchasedAt || new Date().toISOString()
              }));
            }
          } else {
            // Fresh profile creation
            const profile = await recordUserLogin(firebaseUser);
            if (profile) setCurrentUser(profile);
          }
        } catch (e) {
          console.warn("Auth profile sync fallback:", e);
        }
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, []);
  const [adModalConfig, setAdModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    totalAdsRequired: number;
    rewardType: 'unlock_effect' | 'export_video' | 'change_song';
    directPlay?: boolean;
    pendingAction?: () => void;
    pendingPreset?: LightEffectPreset;
  }>({
    isOpen: false,
    title: '',
    description: '',
    totalAdsRequired: 1,
    rewardType: 'export_video',
    directPlay: false
  });

  const isMp4Supported = typeof MediaRecorder !== 'undefined' && 
    (typeof (MediaRecorder as any).isTypeSupported === 'function') &&
    ((MediaRecorder as any).isTypeSupported('video/mp4;codecs=h264,aac') || 
     (MediaRecorder as any).isTypeSupported('video/mp4;codecs=h264') || 
     (MediaRecorder as any).isTypeSupported('video/mp4'));

  // Track state progress for file sources
  const [trackProgress, setTrackProgress] = useState<number>(0);
  const [trackDuration, setTrackDuration] = useState<number>(0);
  const [currentTimeFormatted, setCurrentTimeFormatted] = useState<string>('0:00');
  const [durationFormatted, setDurationFormatted] = useState<string>('0:00');

  // Audio Trimming State
  const [isTrimEnabled, setIsTrimEnabled] = useState<boolean>(false);
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(0);

  // Waveform Peaks State for vertical audio spikes (80 bars with realistic High/Low dynamics)
  const generateSongStructurePeaks = (count = 80): number[] => {
    const peaks: number[] = [];
    for (let i = 0; i < count; i++) {
      const progress = i / count;
      let baseEnergy = 0.2;
      
      // Realistic song dynamics (Intro, Verse, Build, Drop/Chorus, Breakdown, Outro)
      if (progress < 0.12) {
        baseEnergy = 0.12 + progress * 1.5; // Quiet intro rising
      } else if (progress < 0.32) {
        baseEnergy = 0.25 + 0.3 * Math.sin(i * 0.7) ** 2; // Verse 1 (medium dynamics)
      } else if (progress < 0.42) {
        baseEnergy = 0.35 + (progress - 0.32) * 5.5; // Build up (rising)
      } else if (progress < 0.68) {
        baseEnergy = 0.75 + 0.25 * Math.sin(i * 1.1) ** 2; // DROP / CHORUS (TALL LOUD SPIKES)
      } else if (progress < 0.80) {
        baseEnergy = 0.1 + 0.18 * Math.cos(i * 0.5) ** 2; // Breakdown (LOW QUIET VALLEYS)
      } else {
        baseEnergy = 0.5 * (1 - (progress - 0.80) / 0.20) + 0.08; // Outro fading
      }
      
      const microNoise = 0.12 * Math.sin(i * 4.3) + 0.08 * Math.cos(i * 8.7);
      const finalVal = Math.max(0.06, Math.min(1.0, baseEnergy + microNoise));
      peaks.push(finalVal);
    }
    return peaks;
  };

  const [waveformPeaks, setWaveformPeaks] = useState<number[]>(() => generateSongStructurePeaks(80));
  const [spikeLayout, setSpikeLayout] = useState<'center' | 'bottom'>('center');

  // Helper to calculate effective audio bounds (trimmed or full)
  const getEffectiveAudioBounds = () => {
    const total = trackDuration || (audioElementRef.current?.duration) || 15;
    if (!isTrimEnabled) {
      return { start: 0, end: total, duration: total };
    }
    const start = Math.max(0, Math.min(trimStart, total - 0.5));
    const end = (trimEnd > start) ? Math.min(trimEnd, total) : total;
    const duration = Math.max(0.5, end - start);
    return { start, end, duration };
  };

  // Real-time audio engine stats for the live monitoring display
  const [stats, setStats] = useState<AudioStats>({
    volume: 0,
    rms: 0,
    currentGain: 1.0,
    isTransient: false,
    bassEnergy: false,
    easingFactor: 0.22,
    bpm: 120,
  });

  // Web Audio Nodes references to prevent reinitialization crashes
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const globalGainRef = useRef<GainNode | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const synthRef = useRef<ProceduralSynth | null>(null);

  // Recording engine refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const isExportCancelledRef = useRef<boolean>(false);

  const getOptimalRecorderOptions = (quality: 'sd' | 'hd' | '4k') => {
    const bitrateMap = {
      sd: 2000000,     // 2 Mbps
      hd: 8000000,     // 8 Mbps
      '4k': 24000000   // 24 Mbps (increased for sharp detail at 4K resolution)
    };

    // We prioritize standard MP4 with H.264/AAC for maximum compatibility with mobile galleries (iOS & Android).
    // If the browser does not support native MP4 recording, we fall back to hardware-accelerated WebM formats.
    const preferredMimeTypes = [
      'video/mp4;codecs=h264,aac',
      'video/mp4;codecs=h264,mp3',
      'video/mp4;codecs=h264',
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/webm;codecs=h264,opus',
      'video/webm;codecs=h264',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp8',
      'video/webm'
    ];

    let mimeType = '';
    for (const type of preferredMimeTypes) {
      if (typeof MediaRecorder !== 'undefined' && (MediaRecorder as any).isTypeSupported?.(type)) {
        mimeType = type;
        break;
      }
    }

    if (mimeType) {
      return {
        mimeType,
        videoBitsPerSecond: bitrateMap[quality]
      };
    }

    return {
      videoBitsPerSecond: bitrateMap[quality]
    };
  };

  const startRecording = async () => {
    const canvas = document.getElementById('visualizer-main-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    // Ensure audio engine is initialized and running
    if (!audioContextRef.current) {
      initAudioEngine();
    }
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
      } catch (e) {
        console.warn("Could not resume audio context:", e);
      }
    }

    recordedChunksRef.current = [];
    // Capture canvas stream at 60fps for silky smooth visualizer waves!
    const stream = (canvas as any).captureStream ? (canvas as any).captureStream(60) : null;
    if (!stream) {
      alert("Canvas video recording is not supported on this browser.");
      return;
    }

    // Try merging actual audio if context is running and audio source is active
    if (audioContextRef.current && options.audioSource !== 'none') {
      try {
        const dest = audioContextRef.current.createMediaStreamDestination();
        if (globalGainRef.current) {
          globalGainRef.current.connect(dest);
        }
        const audioTracks = dest.stream.getAudioTracks();
        if (audioTracks.length > 0) {
          audioTracks.forEach(track => stream.addTrack(track));
        }
      } catch (err) {
        console.warn("Failed to merge audio stream into video:", err);
      }
    }

    // Capture the exact start timestamp for fixing duration metadata later
    recordingStartTimeRef.current = Date.now();

    try {
      const recOptions = getOptimalRecorderOptions(exportQuality);
      console.log("Starting recorder with options:", recOptions);
      const recorder = new MediaRecorder(stream, recOptions);
      
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const durationInMs = Date.now() - recordingStartTimeRef.current;
        const extension = recOptions.mimeType?.includes('mp4') ? 'mp4' : 'webm';
        const blobType = recOptions.mimeType || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type: blobType });

        const saveBlob = (finalBlob: Blob) => {
          const url = URL.createObjectURL(finalBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `AuraPulse_Studio_Video_${exportQuality.toUpperCase()}_${Date.now()}.${extension}`;
          a.click();
        };

        if (blobType.includes('webm')) {
          fixWebmDurationHelper(blob, durationInMs, (fixedBlob) => {
            convertWebmToMp4OnServer(
              fixedBlob,
              `AuraPulse_Studio_Video_${exportQuality.toUpperCase()}_${Date.now()}.mp4`,
              setIsTranscoding,
              setTranscodeMessage,
              saveBlob
            );
          });
        } else {
          saveBlob(blob);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100);
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start MediaRecorder:", err);
      // Fallback without codec specified
      try {
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };
        recorder.onstop = () => {
          const durationInMs = Date.now() - recordingStartTimeRef.current;
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });

          const saveBlob = (finalBlob: Blob) => {
            const url = URL.createObjectURL(finalBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `AuraPulse_Studio_Video_${exportQuality.toUpperCase()}_${Date.now()}.webm`;
            a.click();
          };

          fixWebmDurationHelper(blob, durationInMs, (fixedBlob) => {
            convertWebmToMp4OnServer(
              fixedBlob,
              `AuraPulse_Studio_Video_${exportQuality.toUpperCase()}_${Date.now()}.mp4`,
              setIsTranscoding,
              setTranscodeMessage,
              saveBlob
            );
          });
        };
        mediaRecorderRef.current = recorder;
        recorder.start(100);
        setIsRecording(true);
      } catch (fallbackErr) {
        alert("Could not start screen recorder in this environment.");
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Actual internal video export implementation
  const executeAutomatedExport = async () => {
    const canvas = document.getElementById('visualizer-main-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    isExportCancelledRef.current = false;
    recordedChunksRef.current = [];

    // 1. Calculate and set high-res export dimensions
    const ratio = options.aspectRatio || '9:16';
    let targetWidth = 1080;
    let targetHeight = 1920;

    if (exportQuality === 'sd') {
      if (ratio === '9:16') { targetWidth = 720; targetHeight = 1280; }
      else if (ratio === '1:1') { targetWidth = 720; targetHeight = 720; }
      else { targetWidth = 1280; targetHeight = 720; }
    } else if (exportQuality === 'hd') {
      if (ratio === '9:16') { targetWidth = 1080; targetHeight = 1920; }
      else if (ratio === '1:1') { targetWidth = 1080; targetHeight = 1080; }
      else { targetWidth = 1920; targetHeight = 1080; }
    } else if (exportQuality === '4k') {
      if (ratio === '9:16') { targetWidth = 2160; targetHeight = 3840; }
      else if (ratio === '1:1') { targetWidth = 2160; targetHeight = 2160; }
      else { targetWidth = 3840; targetHeight = 2160; }
    }

    // Determine recording duration using trimmed audio bounds
    const bounds = getEffectiveAudioBounds();
    const totalDuration = bounds.duration;
    const startOffset = bounds.start;

    setIsExporting(true);
    setExportProgress(0);

    // Set export dimensions in options
    setOptions(prev => ({
      ...prev,
      exportDimensions: { width: targetWidth, height: targetHeight }
    }));

    // Pause audio first if playing to prepare for complete track playback
    if (isPlaying) {
      if (options.audioSource === 'file' && audioElementRef.current) {
        audioElementRef.current.pause();
      }
      setIsPlaying(false);
    }
    
    if (audioElementRef.current && options.audioSource === 'file') {
      audioElementRef.current.currentTime = startOffset;
    }

    // Ensure audio engine is initialized and running
    if (!audioContextRef.current) {
      initAudioEngine();
    }
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
      } catch (e) {
        console.warn("Could not resume audio context:", e);
      }
    }

    // Wait 400ms for canvas to resize and settle down
    await new Promise(resolve => setTimeout(resolve, 400));

    // Start recording
    recordedChunksRef.current = [];
    const exportStartTime = Date.now();
    const stream = (canvas as any).captureStream ? (canvas as any).captureStream(60) : null;
    if (!stream) {
      alert("Canvas video recording is not supported on this browser.");
      setOptions(prev => ({ ...prev, exportDimensions: undefined }));
      setIsExporting(false);
      return;
    }

    // Try merging actual audio from the GainNode
    if (audioContextRef.current && options.audioSource !== 'none') {
      try {
        const dest = audioContextRef.current.createMediaStreamDestination();
        if (globalGainRef.current) {
          globalGainRef.current.connect(dest);
        }
        const audioTracks = dest.stream.getAudioTracks();
        if (audioTracks.length > 0) {
          audioTracks.forEach(track => stream.addTrack(track));
        }
      } catch (err) {
        console.warn("Failed to merge audio stream into video:", err);
      }
    }

    try {
      const recOptions = getOptimalRecorderOptions(exportQuality);
      console.log("Starting automated recorder with options:", recOptions);
      const recorder = new MediaRecorder(stream, recOptions);
      
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        restoreSpeakerOutput();
        if (isExportCancelledRef.current) {
          recordedChunksRef.current = [];
          console.log("Export was cancelled by user; ignoring recorded chunks.");
          return;
        }

        const durationInMs = Date.now() - exportStartTime;
        const extension = recOptions.mimeType?.includes('mp4') ? 'mp4' : 'webm';
        const blobType = recOptions.mimeType || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type: blobType });

        const saveBlob = (finalBlob: Blob) => {
          const url = URL.createObjectURL(finalBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `AuraPulse_Studio_Video_${exportQuality.toUpperCase()}_${ratio.replace(':', '_')}_${Date.now()}.${extension}`;
          a.click();
        };

        if (blobType.includes('webm')) {
          fixWebmDurationHelper(blob, durationInMs, (fixedBlob) => {
            convertWebmToMp4OnServer(
              fixedBlob,
              `AuraPulse_Studio_Video_${exportQuality.toUpperCase()}_${ratio.replace(':', '_')}_${Date.now()}.mp4`,
              setIsTranscoding,
              setTranscodeMessage,
              saveBlob
            );
          });
        } else {
          saveBlob(blob);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100);
      
      // Mute background speaker output during rendering so song does not play aloud!
      muteSpeakerOutput();

      // Ensure audio element is ready for playback
      if (options.audioSource === 'file' && audioElementRef.current) {
        audioElementRef.current.muted = false;
        if (audioElementRef.current.volume === 0) {
          audioElementRef.current.volume = 1.0;
        }
        audioElementRef.current.currentTime = startOffset;
        audioElementRef.current.play().catch(e => console.error("Audio autoplay failed:", e));
        setIsPlaying(true);
      } else {
        setIsPlaying(true);
      }

      // Track progress
      const startTime = Date.now();
      const progressTimer = setInterval(() => {
        let elapsed = 0;
        if (options.audioSource === 'file' && audioElementRef.current) {
          elapsed = Math.max(0, audioElementRef.current.currentTime - startOffset);
        } else {
          elapsed = (Date.now() - startTime) / 1000;
        }

        const pct = Math.min(100, Math.floor((elapsed / totalDuration) * 100));
        setExportProgress(pct);

        // Check completion condition
        const isEnded = (options.audioSource === 'file' && audioElementRef.current)
          ? (audioElementRef.current.ended || audioElementRef.current.currentTime >= bounds.end - 0.1 || elapsed >= totalDuration - 0.1)
          : (elapsed >= totalDuration);

        if (isEnded) {
          clearInterval(progressTimer);
          
          // Stop media recorder with a short delay to ensure final audio packets flush
          setTimeout(() => {
            if (recorder && recorder.state !== 'inactive') {
              recorder.stop();
            }

            // Reset playback
            if (audioElementRef.current) {
              audioElementRef.current.pause();
              audioElementRef.current.currentTime = startOffset;
            }
            setIsPlaying(false);
            restoreSpeakerOutput();

            // Restore normal rendering sizes
            setOptions(prev => ({ ...prev, exportDimensions: undefined }));
            setIsExporting(false);
            if (!isExportCancelledRef.current) {
              setShowExportSuccessModal(true);
            }
          }, 250);
        }
      }, 150);

      (window as any)._exportTimer = progressTimer;

    } catch (err) {
      console.error("Failed to start automated recorder, trying fallback...", err);
      try {
        const recorder = new MediaRecorder(stream);
        
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          restoreSpeakerOutput();
          if (isExportCancelledRef.current) {
            recordedChunksRef.current = [];
            console.log("Export was cancelled by user; ignoring recorded chunks.");
            return;
          }

          const durationInMs = Date.now() - exportStartTime;
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });

          const saveBlob = (finalBlob: Blob) => {
            const url = URL.createObjectURL(finalBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `AuraPulse_Studio_Video_${exportQuality.toUpperCase()}_${ratio.replace(':', '_')}_${Date.now()}.webm`;
            a.click();
          };

          fixWebmDurationHelper(blob, durationInMs, (fixedBlob) => {
            convertWebmToMp4OnServer(
              fixedBlob,
              `AuraPulse_Studio_Video_${exportQuality.toUpperCase()}_${ratio.replace(':', '_')}_${Date.now()}.mp4`,
              setIsTranscoding,
              setTranscodeMessage,
              saveBlob
            );
          });
        };

        mediaRecorderRef.current = recorder;
        recorder.start(100);

        muteSpeakerOutput();

        if (options.audioSource === 'file' && audioElementRef.current) {
          audioElementRef.current.currentTime = startOffset;
          audioElementRef.current.play().catch(e => console.error(e));
          setIsPlaying(true);
        } else {
          setIsPlaying(true);
        }

        const startTime = Date.now();
        const progressTimer = setInterval(() => {
          let elapsed = 0;
          if (options.audioSource === 'file' && audioElementRef.current) {
            elapsed = Math.max(0, audioElementRef.current.currentTime - startOffset);
          } else {
            elapsed = (Date.now() - startTime) / 1000;
          }

          const pct = Math.min(100, Math.floor((elapsed / totalDuration) * 100));
          setExportProgress(pct);

          const isEnded = (options.audioSource === 'file' && audioElementRef.current)
            ? (audioElementRef.current.ended || audioElementRef.current.currentTime >= bounds.end - 0.1 || elapsed >= totalDuration - 0.1)
            : (elapsed >= totalDuration);

          if (isEnded) {
            clearInterval(progressTimer);
            if (recorder && recorder.state !== 'inactive') {
              recorder.stop();
            }
            if (audioElementRef.current) {
              audioElementRef.current.pause();
              audioElementRef.current.currentTime = startOffset;
            }
            setIsPlaying(false);
            restoreSpeakerOutput();
            setOptions(prev => ({ ...prev, exportDimensions: undefined }));
            setIsExporting(false);
            if (!isExportCancelledRef.current) {
              setShowExportSuccessModal(true);
            }
          }
        }, 150);

        (window as any)._exportTimer = progressTimer;

      } catch (fallbackErr) {
        alert("Could not start video capture. Please try another browser.");
        restoreSpeakerOutput();
        setOptions(prev => ({ ...prev, exportDimensions: undefined }));
        setIsExporting(false);
      }
    }
  };

  // Entry point for Automated Video Export with AdMob Monetization Rule:
  // - Premium User: Direct export (0 ads)
  // - Free User: Direct sponsored message before export begins
  const startAutomatedExport = () => {
    if (monetization.isPremium) {
      executeAutomatedExport();
      return;
    }

    setAdModalConfig({
      isOpen: true,
      title: `Preparing ${exportQuality.toUpperCase()} Video Export`,
      description: 'Sponsored message playing before high-fidelity video rendering begins.',
      totalAdsRequired: 1,
      rewardType: 'export_video',
      directPlay: true,
      pendingAction: () => executeAutomatedExport()
    });
  };

  const muteSpeakerOutput = () => {
    if (analyserRef.current && audioContextRef.current) {
      try {
        analyserRef.current.disconnect(audioContextRef.current.destination);
      } catch (err) {
        console.warn("Mute speaker output error:", err);
      }
    }
  };

  const restoreSpeakerOutput = () => {
    if (analyserRef.current && audioContextRef.current) {
      try {
        analyserRef.current.disconnect();
        analyserRef.current.connect(audioContextRef.current.destination);
      } catch (err) {
        console.warn("Restore speaker output error:", err);
      }
    }
  };

  const cancelAutomatedExport = () => {
    isExportCancelledRef.current = true;
    if ((window as any)._exportTimer) {
      clearInterval((window as any)._exportTimer);
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    recordedChunksRef.current = [];
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      const bounds = getEffectiveAudioBounds();
      audioElementRef.current.currentTime = bounds.start;
    }
    setIsPlaying(false);
    restoreSpeakerOutput();
    setOptions(prev => ({ ...prev, exportDimensions: undefined }));
    setIsExporting(false);
    setIsTranscoding(false);
  };

  // Interval for updating audio progress bar
  const progressIntervalRef = useRef<number | null>(null);

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Lazy Initialization of Audio Context on Click event
  const initAudioEngine = () => {
    if (audioContextRef.current) return;

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ latencyHint: 'interactive' });
    const analyser = ctx.createAnalyser();
    analyser.smoothingTimeConstant = 0.20; // Matches requested low smoothing constant
    analyser.fftSize = 256;

    const globalGain = ctx.createGain();
    globalGain.gain.value = volume;

    // Create a single hidden HTMLAudioElement for local file playback
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    // Load a royalty-free beat as default
    audio.src = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
    audioElementRef.current = audio;

    // Single creation of MediaElement source linked to this audio element
    const sourceNode = ctx.createMediaElementSource(audio);

    // Connect unattenuated audio stream directly to analyser so visualizer receives pristine frequency data
    // Then connect analyser to globalGain (for volume control) and then to destination (speakers)
    sourceNode.connect(analyser);
    analyser.connect(globalGain);
    globalGain.connect(ctx.destination);

    audioContextRef.current = ctx;
    analyserRef.current = analyser;
    globalGainRef.current = globalGain;
    sourceNodeRef.current = sourceNode;

    audio.onended = () => {
      setIsPlaying(false);
    };

    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setTrackDuration(audio.duration);
        setDurationFormatted(formatTime(audio.duration));
        setTrimStart(0);
        setTrimEnd(audio.duration);
      }
    };

    audio.ondurationchange = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setTrackDuration(audio.duration);
        setDurationFormatted(formatTime(audio.duration));
        setTrimStart(0);
        setTrimEnd(audio.duration);
      }
    };

    audio.ontimeupdate = () => {
      setTrackProgress(audio.currentTime);
      setCurrentTimeFormatted(formatTime(audio.currentTime));
    };

    setAudioContext(ctx);
    setAnalyserNode(analyser);
  };

  const stopCurrentSource = () => {
    // 1. Pause local audio element
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }

    // 2. Release and stop live microphone streams
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    if (micSourceRef.current) {
      micSourceRef.current.disconnect();
      micSourceRef.current = null;
    }

    setIsPlaying(false);
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  // Start micro-microphone feed
  const startMicrophone = async () => {
    try {
      initAudioEngine();
      const ctx = audioContextRef.current!;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      stopCurrentSource();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const micSource = ctx.createMediaStreamSource(stream);
      // Connect microphone ONLY to analyser, NOT to globalGain/speakers to prevent howling feedback!
      micSource.connect(analyserRef.current!);
      micSourceRef.current = micSource;

      setIsPlaying(true);
      setAudioFileName('Live Microphone Input');
    } catch (err) {
      console.warn('Microphone stream access error:', err);
      // Fallback gracefully to demo audio file source if microphone permission is denied
      setOptions(prev => ({ ...prev, audioSource: 'file' }));
      if (!audioFileName) {
        setAudioFileName('AuraPulse Demo Groove.mp3');
      }
    }
  };

  // Start procedural real-time synthesizer (zero-CORS guaranteed audio)
  const startSynth = (preset: 'phonk' | 'ambient') => {
    try {
      initAudioEngine();
      const ctx = audioContextRef.current!;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      stopCurrentSource();
      if (!synthRef.current) {
        synthRef.current = new ProceduralSynth(ctx, analyserRef.current!);
      }
      synthRef.current.setPreset(preset);
      synthRef.current.start();
      setIsPlaying(true);
      setAudioFileName(preset === 'phonk' ? 'Phonk Beat Demo (Live Synth)' : 'Ambient Melody (Live Synth)');
    } catch (err) {
      console.warn('Synthesizer start error:', err);
    }
  };

  // Handle source parameter flips
  useEffect(() => {
    if (!audioContextRef.current) return;

    stopCurrentSource();

    if (options.audioSource === 'microphone') {
      startMicrophone();
    } else if (options.audioSource === 'synth-phonk') {
      startSynth('phonk');
    } else if (options.audioSource === 'synth-ambient') {
      startSynth('ambient');
    } else if (options.audioSource === 'file') {
      if (audioElementRef.current && audioElementRef.current.src) {
        setAudioFileName(audioFileName || 'Uploaded Audio File');
      } else {
        setAudioFileName('AuraPulse Demo Groove.mp3');
      }
    }
  }, [options.audioSource]);

  // Handle Play/Pause clicks
  const togglePlay = async () => {
    if (!isIgnited) {
      setIsIgnited(true);
    }

    initAudioEngine();
    const ctx = audioContextRef.current!;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    if (isPlaying) {
      // Pause active feeds
      if (options.audioSource === 'file' && audioElementRef.current) {
        audioElementRef.current.pause();
      } else if (options.audioSource === 'microphone') {
        stopCurrentSource();
      } else if (options.audioSource === 'synth-phonk' || options.audioSource === 'synth-ambient') {
        if (synthRef.current) synthRef.current.stop();
      }
      setIsPlaying(false);
    } else {
      // Resume or start active feeds
      if (options.audioSource === 'file') {
        if (audioElementRef.current) {
          if (!audioElementRef.current.src) {
            audioElementRef.current.src = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
            setAudioFileName('AuraPulse Demo Groove.mp3');
          }
          const bounds = getEffectiveAudioBounds();
          if (audioElementRef.current.currentTime < bounds.start || audioElementRef.current.currentTime >= bounds.end) {
            audioElementRef.current.currentTime = bounds.start;
          }
          const playPromise = audioElementRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              if (error.name !== 'AbortError') {
                console.warn('Playback error:', error);
              }
            });
          }
          setIsPlaying(true);
        }
      } else if (options.audioSource === 'microphone') {
        startMicrophone();
      } else if (options.audioSource === 'synth-phonk') {
        startSynth('phonk');
      } else if (options.audioSource === 'synth-ambient') {
        startSynth('ambient');
      }
    }
  };

  // Manage file uploads with Ad trigger for free users (1 ad on song change / new upload)
  const processUploadedSong = async (file: File) => {
    initAudioEngine();
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
    stopCurrentSource();

    // Extract audio waveform peaks for vertical spikes (khade spikes) with high/low volume contrast
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const decodedData = await audioCtx.decodeAudioData(arrayBuffer);
      const channelData = decodedData.getChannelData(0);
      const samples = 80;
      const blockSize = Math.floor(channelData.length / samples);
      const rawEnergies: number[] = [];
      let maxEnergy = 0.0001;

      for (let i = 0; i < samples; i++) {
        let maxVal = 0;
        let sumSq = 0;
        const offset = i * blockSize;
        for (let j = 0; j < blockSize; j++) {
          const val = Math.abs(channelData[offset + j] || 0);
          if (val > maxVal) maxVal = val;
          sumSq += val * val;
        }
        const rms = Math.sqrt(sumSq / Math.max(1, blockSize));
        const combined = maxVal * 0.75 + rms * 0.25;
        rawEnergies.push(combined);
        if (combined > maxEnergy) maxEnergy = combined;
      }

      // Scale peaks so max is 1.0, preserving contrast between loud & quiet parts
      const peaks = rawEnergies.map(e => {
        const ratio = e / maxEnergy;
        // Exponential scaling enhances contrast between quiet drops (~5%) and loud bass drops (100%)
        const scaled = Math.pow(ratio, 1.25);
        return Math.max(0.05, Math.min(1.0, scaled));
      });

      setWaveformPeaks(peaks);
      audioCtx.close();
    } catch (e) {
      console.warn("Could not decode audio for spikes, fallback to song structure peaks:", e);
      setWaveformPeaks(generateSongStructurePeaks(80));
    }

    const fileUrl = URL.createObjectURL(file);
    if (audioElementRef.current) {
      audioElementRef.current.src = fileUrl;
      
      audioElementRef.current.onloadedmetadata = () => {
        if (audioElementRef.current) {
          const d = audioElementRef.current.duration;
          if (d && !isNaN(d) && isFinite(d)) {
            setTrackDuration(d);
            setDurationFormatted(formatTime(d));
            setTrimStart(0);
            setTrimEnd(d);
          }
        }
      };

      audioElementRef.current.ondurationchange = () => {
        if (audioElementRef.current) {
          const d = audioElementRef.current.duration;
          if (d && !isNaN(d) && isFinite(d)) {
            setTrackDuration(d);
            setDurationFormatted(formatTime(d));
            setTrimStart(0);
            setTrimEnd(d);
          }
        }
      };

      audioElementRef.current.ontimeupdate = () => {
        if (audioElementRef.current) {
          setTrackProgress(audioElementRef.current.currentTime);
          setCurrentTimeFormatted(formatTime(audioElementRef.current.currentTime));
        }
      };

      const playPromise = audioElementRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          if (error.name !== 'AbortError') {
            console.warn('Playback error:', error);
          }
        });
      }
      setIsPlaying(true);
      setOptions(prev => ({ ...prev, audioSource: 'file' }));
      setAudioFileName(file.name);
    }
  };

  const handleFileUpload = (file: File) => {
    if (monetization.isPremium) {
      processUploadedSong(file);
      return;
    }

    // Direct ad plays before new song analysis starts (no 'Watch Ad' button)
    setAdModalConfig({
      isOpen: true,
      title: `Analyzing "${file.name}"`,
      description: 'Playing sponsored message before music analysis starts.',
      totalAdsRequired: 1,
      rewardType: 'change_song',
      directPlay: true,
      pendingAction: () => processUploadedSong(file)
    });
  };

  // Audio seeking timeline slider controller
  const handleSeek = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioElementRef.current && options.audioSource === 'file') {
      audioElementRef.current.currentTime = val;
      setTrackProgress(val);
      setCurrentTimeFormatted(formatTime(val));
    }
  };

  // Global sound volume slider controller
  const handleVolumeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (globalGainRef.current) {
      globalGainRef.current.gain.value = val;
    }
    if (isMuted && val > 0) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      if (globalGainRef.current) globalGainRef.current.gain.value = volume;
      setIsMuted(false);
    } else {
      if (globalGainRef.current) globalGainRef.current.gain.value = 0;
      setIsMuted(true);
    }
  };

  // Track progress ticker for file sources
  useEffect(() => {
    if (isPlaying && options.audioSource === 'file') {
      progressIntervalRef.current = window.setInterval(() => {
        if (audioElementRef.current) {
          const current = audioElementRef.current.currentTime;
          const bounds = getEffectiveAudioBounds();
          if (current >= bounds.end) {
            audioElementRef.current.currentTime = bounds.start;
          } else if (current < bounds.start - 0.5) {
            audioElementRef.current.currentTime = bounds.start;
          }
          setTrackProgress(audioElementRef.current.currentTime);
          setCurrentTimeFormatted(formatTime(audioElementRef.current.currentTime));
        }
      }, 200);
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPlaying, options.audioSource, isTrimEnabled, trimStart, trimEnd, trackDuration]);

  // Clean up nodes on unmount
  useEffect(() => {
    return () => {
      stopCurrentSource();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  let activeColorPreset = COLOR_PRESETS.find(p => p.id === options.colorTheme) || COLOR_PRESETS[0];
  if (options.customColorEnabled && options.customColor) {
    activeColorPreset = {
      name: "Custom Solid Color",
      id: "custom",
      primary: options.customColor,
      secondary: options.customColor,
      glow: options.customColor,
      background: "from-zinc-950 via-zinc-900/10 to-zinc-950"
    };
  }

  const renderAudioPanel = () => {
    return (
      <div className="space-y-4 flex flex-col" id="panel-audio">
        <div>
          <span className="block text-[10px] text-zinc-500 uppercase font-black tracking-wider mb-2">Select Sound Source</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => updateOption('audioSource', 'microphone')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-150 cursor-pointer ${
                options.audioSource === 'microphone'
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)] scale-[1.01]'
                  : 'bg-zinc-900/60 border-zinc-850 text-zinc-400 hover:border-zinc-800 hover:text-zinc-200'
              }`}
            >
              <Mic className="w-5 h-5 text-emerald-400 mb-1.5 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-wider">Live Mic</span>
              <span className="text-[7px] text-zinc-500 mt-0.5 font-semibold">Uses device microphone</span>
            </button>

            <button
              onClick={() => {
                updateOption('audioSource', 'file');
                setTimeout(() => {
                  document.getElementById('bottom-audio-uploader')?.click();
                }, 50);
              }}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-150 cursor-pointer ${
                options.audioSource === 'file'
                  ? 'bg-cyan-500/15 border-cyan-500/60 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)] scale-[1.01]'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white'
              }`}
            >
              <Music className="w-5 h-5 text-cyan-400 mb-1.5" />
              <span className="text-[10px] font-black uppercase tracking-wider">Audio File</span>
              <span className="text-[7px] text-zinc-400 mt-0.5 font-semibold">Upload local MP3 / WAV</span>
            </button>
          </div>
        </div>

        <input
          type="file"
          accept="audio/*"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileUpload(e.target.files[0]);
            }
          }}
          className="hidden"
          id="bottom-audio-uploader"
        />

        {options.audioSource === 'file' && audioFileName && (
          <div className="space-y-2">
            <span className="block text-[10px] text-zinc-500 uppercase font-black tracking-wider mb-1">Active Music Track</span>
            <div className="p-2.5 bg-zinc-900/60 border border-zinc-850 rounded-lg flex items-center justify-between gap-2.5">
              <div className="flex items-center space-x-2 truncate">
                <div className="w-6 h-6 rounded bg-violet-500/10 flex items-center justify-center shrink-0">
                  <Disc className="w-3.5 h-3.5 text-violet-400 animate-spin" style={{ animationDuration: '6s' }} />
                </div>
                <div className="truncate">
                  <span className="block text-[10px] font-bold text-zinc-200 truncate leading-none">{audioFileName}</span>
                  <span className="text-[8px] text-zinc-500 font-mono mt-1 block">{durationFormatted || 'Demo Stream'}</span>
                </div>
              </div>
              {audioElementRef.current?.src && !audioElementRef.current.src.includes("SoundHelix-Song-1.mp3") && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    stopCurrentSource();
                    if (audioElementRef.current) {
                      audioElementRef.current.src = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
                      setAudioFileName('AuraPulse Demo Groove.mp3');
                    }
                  }}
                  className="p-1.5 rounded bg-zinc-950 text-zinc-500 hover:text-red-400 hover:bg-zinc-900 transition-colors shrink-0 cursor-pointer flex items-center justify-center"
                  title="Reset to default demo track"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* AUDIO TRIMMER CONTROLLER */}
        {options.audioSource === 'file' && (
          <div className="space-y-3 p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400">
                  <Scissors className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="block text-[11px] font-bold text-zinc-100 leading-tight">Audio Trimmer</span>
                  <span className="block text-[8px] text-zinc-400 font-medium">Reels & Story Waveform Cropper</span>
                </div>
              </div>
              <button
                onClick={() => {
                  const nextVal = !isTrimEnabled;
                  setIsTrimEnabled(nextVal);
                  if (nextVal && (trimEnd === 0 || trimEnd <= trimStart) && trackDuration > 0) {
                    setTrimStart(0);
                    setTrimEnd(trackDuration);
                  }
                }}
                className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Toggle Audio Trimming"
              >
                {isTrimEnabled ? (
                  <ToggleRight className="w-7 h-7 text-pink-500" />
                ) : (
                  <ToggleLeft className="w-7 h-7 text-zinc-650" />
                )}
              </button>
            </div>

            {isTrimEnabled && (
              <InstagramAudioTrimmer
                trackDuration={trackDuration}
                trackProgress={trackProgress}
                trimStart={trimStart}
                trimEnd={trimEnd || trackDuration}
                waveformPeaks={waveformPeaks}
                isPlaying={isPlaying}
                audioFileName={audioFileName}
                onUpdateTrim={(start, end) => {
                  setTrimStart(start);
                  setTrimEnd(end);
                }}
                onSeek={(time) => {
                  if (audioElementRef.current && options.audioSource === 'file') {
                    audioElementRef.current.currentTime = time;
                    setTrackProgress(time);
                  }
                }}
                onTogglePlay={async () => {
                  initAudioEngine();
                  if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                    await audioContextRef.current.resume();
                  }
                  if (audioElementRef.current) {
                    if (isPlaying) {
                      audioElementRef.current.pause();
                      setIsPlaying(false);
                    } else {
                      // If current progress is outside trim range, jump to trimStart
                      if (trackProgress < trimStart || trackProgress >= (trimEnd || trackDuration)) {
                        audioElementRef.current.currentTime = trimStart;
                        setTrackProgress(trimStart);
                      }
                      audioElementRef.current.play().then(() => setIsPlaying(true)).catch(e => console.warn(e));
                    }
                  }
                }}
              />
            )}
          </div>
        )}

        {/* Physics Switcher Toggles */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/40 border border-zinc-850/40">
            <div>
              <span className="block text-[10px] font-bold text-zinc-200 leading-tight">Vibe AGC Boost</span>
              <span className="block text-[8px] text-zinc-500 leading-none mt-0.5">Auto level gain</span>
            </div>
            <button
              onClick={() => updateOption('useAgc', !options.useAgc)}
              className="text-zinc-400 hover:text-white transition-colors duration-150 cursor-pointer"
            >
              {options.useAgc ? (
                <ToggleRight className="w-7 h-7 text-pink-500" />
              ) : (
                <ToggleLeft className="w-7 h-7 text-zinc-650" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/40 border border-zinc-850/40">
            <div>
              <span className="block text-[10px] font-bold text-zinc-200 leading-tight">Dynamic Easing</span>
              <span className="block text-[8px] text-zinc-500 leading-none mt-0.5">Transient adaptive</span>
            </div>
            <button
              onClick={() => updateOption('useDynamicEasing', !options.useDynamicEasing)}
              className="text-zinc-400 hover:text-white transition-colors duration-150 cursor-pointer"
            >
              {options.useDynamicEasing ? (
                <ToggleRight className="w-7 h-7 text-cyan-400" />
              ) : (
                <ToggleLeft className="w-7 h-7 text-zinc-650" />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderWaveStylesPanel = () => {
    return (
      <div className="space-y-4 flex flex-col animate-fade-in" id="panel-wave-styles">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="block text-[10px] text-zinc-400 uppercase font-black tracking-wider">Select Visualization Mode</span>
            <span className="text-[8px] font-mono text-cyan-400 font-bold uppercase tracking-widest">10 Pro Modes</span>
          </div>
          
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { 
                id: 'spikes', 
                label: 'Radial Spikes', 
                desc: '360° laser rays',
                isCircle: true,
                badge: '360° CIRCLE',
                svg: (isActive: boolean) => (
                  <svg viewBox="0 0 100 36" className="w-full h-8 overflow-visible">
                    <circle cx="50" cy="18" r="6" fill="#09090b" stroke="#00f0ff" strokeWidth="1.5" />
                    {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(angle => {
                      const rad = (angle * Math.PI) / 180;
                      const x1 = 50 + Math.cos(rad) * 7.5;
                      const y1 = 18 + Math.sin(rad) * 7.5;
                      const len = (angle % 60 === 0) ? 14 : 11;
                      const x2 = 50 + Math.cos(rad) * len;
                      const y2 = 18 + Math.sin(rad) * len;
                      return <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke={angle % 60 === 0 ? "#ff2a5f" : "#00f0ff"} strokeWidth="1.6" strokeLinecap="round" opacity={isActive ? "1" : "0.7"} />;
                    })}
                  </svg>
                )
              },
              { 
                id: 'liquid-wave', 
                label: 'Liquid Ring', 
                desc: '360° fluid wave',
                isCircle: true,
                badge: '360° CIRCLE',
                svg: (isActive: boolean) => (
                  <svg viewBox="0 0 100 36" className="w-full h-8 overflow-visible">
                    <circle cx="50" cy="18" r="14" fill="none" stroke="#a855f7" strokeWidth="1" strokeDasharray="2,2" opacity={isActive ? "0.6" : "0.3"} />
                    <path d="M 50 4 C 58 4 63 10 65 18 C 67 26 58 32 50 32 C 42 32 33 26 35 18 C 37 10 42 4 50 4 Z" fill="none" stroke="#06b6d4" strokeWidth="2" opacity={isActive ? "1" : "0.8"} />
                    <circle cx="50" cy="18" r="6" fill="#09090b" stroke="#a855f7" strokeWidth="1.5" />
                  </svg>
                )
              },
              { 
                id: 'dj-wings', 
                label: 'DJ Wings', 
                desc: 'Vinyl disc wings',
                isCircle: true,
                badge: '360° CIRCLE',
                svg: (isActive: boolean) => (
                  <svg viewBox="0 0 100 36" className="w-full h-8 overflow-visible">
                    <path d="M 12 18 Q 32 6 50 18 Q 68 6 88 18 Q 68 30 50 18 Q 32 30 12 18 Z" fill="#d946ef" opacity={isActive ? "0.4" : "0.18"} />
                    <path d="M 16 18 Q 33 10 50 18 Q 67 10 84 18" fill="none" stroke="#00f0ff" strokeWidth="1.5" opacity={isActive ? "1" : "0.7"} />
                    <path d="M 16 18 Q 33 26 50 18 Q 67 26 84 18" fill="none" stroke="#d946ef" strokeWidth="1.5" opacity={isActive ? "1" : "0.7"} />
                    <circle cx="50" cy="18" r="8" fill="#09090b" stroke="#3b82f6" strokeWidth="1.8" />
                    <circle cx="50" cy="18" r="2" fill="#ffffff" />
                  </svg>
                )
              },
              { 
                id: 'bar-chart', 
                label: 'Radial Bars', 
                desc: '360° EQ rods',
                isCircle: true,
                badge: '360° CIRCLE',
                svg: (isActive: boolean) => (
                  <svg viewBox="0 0 100 36" className="w-full h-8 overflow-visible">
                    <circle cx="50" cy="18" r="6" fill="#09090b" stroke="#f43f5e" strokeWidth="1.5" />
                    {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, i) => {
                      const rad = (angle * Math.PI) / 180;
                      const x1 = 50 + Math.cos(rad) * 7.5;
                      const y1 = 18 + Math.sin(rad) * 7.5;
                      const len = 10 + (i % 3) * 2.5;
                      const x2 = 50 + Math.cos(rad) * len;
                      const y2 = 18 + Math.sin(rad) * len;
                      return <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i % 2 === 0 ? "#10b981" : "#f59e0b"} strokeWidth="1.8" strokeLinecap="round" opacity={isActive ? "1" : "0.7"} />;
                    })}
                  </svg>
                )
              },
              { 
                id: 'particle-blast', 
                label: 'Nebula Blast', 
                desc: '360° dot burst',
                isCircle: true,
                badge: '360° CIRCLE',
                svg: (isActive: boolean) => (
                  <svg viewBox="0 0 100 36" className="w-full h-8 overflow-visible">
                    <circle cx="50" cy="18" r="6" fill="#d946ef" opacity="0.3" />
                    <circle cx="50" cy="18" r="3" fill="#ffffff" />
                    {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => {
                      const rad = (angle * Math.PI) / 180;
                      return (
                        <g key={angle}>
                          <circle cx={50 + Math.cos(rad) * 8} cy={18 + Math.sin(rad) * 8} r="1.2" fill="#38bdf8" opacity={isActive ? "1" : "0.7"} />
                          <circle cx={50 + Math.cos(rad) * 14} cy={18 + Math.sin(rad) * 14} r="1.6" fill="#f43f5e" opacity={isActive ? "1" : "0.7"} />
                        </g>
                      );
                    })}
                  </svg>
                )
              },
              { 
                id: 'weave-horizontal-spectrum', 
                label: 'Horizon Weave', 
                desc: 'Linear dual wave',
                isCircle: false,
                badge: 'HORIZONTAL',
                svg: (isActive: boolean) => (
                  <svg viewBox="0 0 100 36" className="w-full h-8 overflow-visible">
                    <line x1="5" y1="18" x2="95" y2="18" stroke="#3b82f6" strokeWidth="1" strokeDasharray="3,3" opacity={isActive ? "0.6" : "0.3"} />
                    <path d="M 5 18 L 15 8 L 25 14 L 35 4 L 45 12 L 55 2 L 65 14 L 75 6 L 85 12 L 95 18" fill="none" stroke="#f43f5e" strokeWidth="1.8" opacity={isActive ? "1" : "0.7"} />
                    <path d="M 5 18 L 15 28 L 25 22 L 35 32 L 45 24 L 55 34 L 65 22 L 75 30 L 85 24 L 95 18" fill="none" stroke="#00d2ff" strokeWidth="1.8" opacity={isActive ? "1" : "0.7"} />
                  </svg>
                )
              },
              { 
                id: 'weave-horizontal-bars', 
                label: 'Bars Wave', 
                desc: 'Linear spectrum',
                isCircle: false,
                badge: 'HORIZONTAL',
                svg: (isActive: boolean) => (
                  <svg viewBox="0 0 100 36" className="w-full h-8 overflow-visible">
                    <line x1="5" y1="18" x2="95" y2="18" stroke="#ef4444" strokeWidth="1" opacity={isActive ? "0.8" : "0.4"} />
                    <rect x="10" y="10" width="2.5" height="16" rx="1.2" fill="#ef4444" opacity={isActive ? "1" : "0.7"} />
                    <rect x="18" y="6" width="2.5" height="24" rx="1.2" fill="#ef4444" opacity={isActive ? "1" : "0.7"} />
                    <rect x="26" y="12" width="2.5" height="12" rx="1.2" fill="#ef4444" opacity={isActive ? "1" : "0.7"} />
                    <rect x="34" y="2" width="2.5" height="32" rx="1.2" fill="#ef4444" opacity={isActive ? "1" : "0.7"} />
                    <rect x="42" y="8" width="2.5" height="20" rx="1.2" fill="#ef4444" opacity={isActive ? "1" : "0.7"} />
                    <rect x="50" y="4" width="2.5" height="28" rx="1.2" fill="#ef4444" opacity={isActive ? "1" : "0.7"} />
                    <rect x="58" y="10" width="2.5" height="16" rx="1.2" fill="#ef4444" opacity={isActive ? "1" : "0.7"} />
                    <rect x="66" y="1" width="2.5" height="34" rx="1.2" fill="#ef4444" opacity={isActive ? "1" : "0.7"} />
                    <rect x="74" y="12" width="2.5" height="12" rx="1.2" fill="#ef4444" opacity={isActive ? "1" : "0.7"} />
                    <rect x="82" y="8" width="2.5" height="20" rx="1.2" fill="#ef4444" opacity={isActive ? "1" : "0.7"} />
                  </svg>
                )
              },
              { 
                id: 'weave-horizontal-liquid', 
                label: 'Water Spikes', 
                desc: 'Linear reflections',
                isCircle: false,
                badge: 'HORIZONTAL',
                svg: (isActive: boolean) => (
                  <svg viewBox="0 0 100 36" className="w-full h-8 overflow-visible">
                    <defs>
                      <linearGradient id="svg-grad-waterspikes" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#38bdf8" />
                        <stop offset="100%" stopColor="#ec4899" />
                      </linearGradient>
                    </defs>
                    <line x1="5" y1="18" x2="95" y2="18" stroke="#00f0ff" strokeWidth="1.5" opacity={isActive ? "1" : "0.7"} />
                    <path d="M 12 18 L 12 8 M 24 18 L 24 4 M 36 18 L 36 12 M 48 18 L 48 2 M 60 18 L 60 10 M 72 18 L 72 5 M 84 18 L 84 11" stroke="url(#svg-grad-waterspikes)" strokeWidth="2.5" strokeLinecap="round" opacity={isActive ? "1" : "0.8"} />
                    <path d="M 12 18 L 14 26 M 24 18 L 26 30 M 36 18 L 38 23 M 48 18 L 50 32 M 60 18 L 62 24 M 72 18 L 74 29 M 84 18 L 86 24" stroke="#00f0ff" strokeWidth="2" strokeLinecap="round" opacity={isActive ? "0.6" : "0.3"} strokeDasharray="1,1" />
                  </svg>
                )
              },
              { 
                id: 'aura-pulse', 
                label: 'Aura Pulse', 
                desc: 'Living energy aura',
                isCircle: true,
                badge: '360° AURA',
                svg: (isActive: boolean) => (
                  <svg viewBox="0 0 100 36" className="w-full h-8 overflow-visible">
                    <circle cx="50" cy="18" r="16" fill="#a855f7" opacity={isActive ? "0.22" : "0.1"} />
                    <circle cx="50" cy="18" r="13" fill="none" stroke="#d946ef" strokeWidth="1" strokeDasharray="2,2" opacity={isActive ? "0.7" : "0.4"} />
                    <path d="M 50 4 C 59 5 64 12 65 18 C 66 25 58 31 50 32 C 41 31 34 25 35 18 C 36 11 41 5 50 4 Z" fill="none" stroke="#00f0ff" strokeWidth="2" opacity={isActive ? "1" : "0.8"} />
                    <circle cx="50" cy="18" r="8" fill="none" stroke="#f43f5e" strokeWidth="1.5" opacity={isActive ? "0.9" : "0.6"} />
                    <circle cx="50" cy="18" r="4" fill="#ffffff" opacity={isActive ? "1" : "0.85"} />
                  </svg>
                )
              },
              { 
                id: 'aura-3d-wave', 
                label: 'Aura 3D Wave', 
                desc: '3D energy mesh',
                isCircle: false,
                badge: '3D MESH',
                svg: (isActive: boolean) => (
                  <svg viewBox="0 0 100 36" className="w-full h-8 overflow-visible">
                    {/* Perspective grid lines */}
                    <line x1="50" y1="6" x2="10" y2="34" stroke="#00f0ff" strokeWidth="1" opacity={isActive ? "0.6" : "0.3"} />
                    <line x1="50" y1="6" x2="32" y2="34" stroke="#00f0ff" strokeWidth="1" opacity={isActive ? "0.6" : "0.3"} />
                    <line x1="50" y1="6" x2="50" y2="34" stroke="#00f0ff" strokeWidth="1" opacity={isActive ? "0.7" : "0.4"} />
                    <line x1="50" y1="6" x2="68" y2="34" stroke="#00f0ff" strokeWidth="1" opacity={isActive ? "0.6" : "0.3"} />
                    <line x1="50" y1="6" x2="90" y2="34" stroke="#00f0ff" strokeWidth="1" opacity={isActive ? "0.6" : "0.3"} />
                    {/* 3D Wave rows */}
                    <path d="M 38 16 Q 50 10 62 16" fill="none" stroke="#38bdf8" strokeWidth="1.2" opacity={isActive ? "0.8" : "0.5"} />
                    <path d="M 26 23 Q 50 14 74 23" fill="none" stroke="#a855f7" strokeWidth="1.6" opacity={isActive ? "0.9" : "0.6"} />
                    <path d="M 12 31 Q 30 20 50 25 Q 70 20 88 31" fill="none" stroke="#f43f5e" strokeWidth="2.2" opacity={isActive ? "1" : "0.8"} />
                    {/* Glowing horizon bead */}
                    <circle cx="50" cy="7" r="2" fill="#ffffff" />
                  </svg>
                )
              }
            ] as const).map((mode) => {
              const isActive = options.visualizationMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => updateOption('visualizationMode', mode.id)}
                  className={`relative p-2 rounded-xl border flex flex-col items-center justify-between transition-all duration-200 text-center select-none overflow-hidden h-[105px] cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-b from-pink-500/20 to-cyan-500/20 border-pink-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.3)] scale-[1.02]'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-850 hover:text-white'
                  }`}
                >
                  <span className={`text-[6.5px] font-mono uppercase tracking-wider px-1 py-0.5 rounded font-black mb-1 ${
                    mode.isCircle ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                  }`}>
                    {mode.badge}
                  </span>

                  <div className="w-full flex-1 flex items-center justify-center mb-1">
                    {mode.svg(isActive)}
                  </div>

                  <div className="mt-auto w-full">
                    <span className="block text-[9px] font-black uppercase tracking-wider leading-none text-zinc-100">{mode.label}</span>
                    <span className="block text-[7px] text-zinc-400 font-semibold leading-none mt-1 truncate">{mode.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="block text-[10px] text-zinc-400 uppercase font-black tracking-wider mb-1.5">Symmetry & Distribution</span>
          <div className="grid grid-cols-4 gap-1">
            {([
              { id: 'quad', label: '4-Quadrant' },
              { id: 'radial', label: 'Radial' },
              { id: 'horizontal', label: 'Horizontal' },
              { id: 'bottom', label: 'Bottom' }
            ] as const).map((sym) => (
              <button
                key={sym.id}
                onClick={() => updateOption('symmetry', options.symmetry === sym.id ? 'none' : sym.id)}
                className={`p-1.5 rounded-lg border text-[9px] font-black uppercase tracking-wider text-center transition-all duration-150 cursor-pointer ${
                  options.symmetry === sym.id
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-md font-bold'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white'
                }`}
              >
                {sym.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderLayoutsPanel = () => {
    return (
      <div className="space-y-3.5 flex flex-col" id="panel-layouts">
        {/* Aspect Ratio Selector */}
        <div>
          <span className="block text-[10px] text-zinc-500 uppercase font-black tracking-wider mb-1.5">Canvas Aspect Ratio (Video Size)</span>
          <div className="grid grid-cols-3 gap-1">
            {([
              { id: '9:16', label: '9:16 (Reel / Short)' },
              { id: '1:1', label: '1:1 (Post)' },
              { id: '16:9', label: '16:9 (YouTube)' }
            ] as const).map((ratio) => (
              <button
                key={ratio.id}
                onClick={() => updateOption('aspectRatio', ratio.id)}
                className={`p-1.5 rounded-lg border text-[9px] font-black uppercase tracking-wider text-center transition-all duration-150 ${
                  (options.aspectRatio || '9:16') === ratio.id
                    ? 'bg-purple-500/15 border-purple-500/50 text-purple-400 shadow-md'
                    : 'bg-zinc-900 border-zinc-850 text-zinc-500 hover:border-zinc-800 hover:text-zinc-300'
                }`}
              >
                {ratio.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sensitivity */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-medium leading-none">
            <span className="text-zinc-400">Audio Sensitivity multiplier</span>
            <span className="font-mono text-cyan-400 font-bold">{options.sensitivity.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.3"
            max="3.5"
            step="0.1"
            value={options.sensitivity}
            onChange={(e) => updateOption('sensitivity', parseFloat(e.target.value))}
            className="w-full accent-cyan-400 bg-zinc-900 rounded-lg appearance-none h-1.5 cursor-pointer"
          />
        </div>

        {/* Thickness */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-medium leading-none">
            <span className="text-zinc-400">Waveform Stroke Thickness</span>
            <span className="font-mono text-pink-400 font-bold">{options.lineWidth.toFixed(1)}px</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="6.0"
            step="0.2"
            value={options.lineWidth}
            onChange={(e) => updateOption('lineWidth', parseFloat(e.target.value))}
            className="w-full accent-pink-500 bg-zinc-900 rounded-lg appearance-none h-1.5 cursor-pointer"
          />
        </div>

        {/* Radius */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-medium leading-none">
            <span className="text-zinc-400">Visualizer Ring Base Radius</span>
            <span className="font-mono text-purple-400 font-bold">{(options.radius * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="1.6"
            step="0.05"
            value={options.radius}
            onChange={(e) => updateOption('radius', parseFloat(e.target.value))}
            className="w-full accent-purple-500 bg-zinc-900 rounded-lg appearance-none h-1.5 cursor-pointer"
          />
        </div>
      </div>
    );
  };

  const renderGlowFxPanel = () => {
    return (
      <div className="space-y-3.5 flex flex-col" id="panel-glow-fx">
        {/* Glow Intensity */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-medium leading-none">
            <span className="text-zinc-400">Neon Glow Aura Intensity</span>
            <span className="font-mono text-yellow-400 font-bold">{(options.glowIntensity * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="2.5"
            step="0.1"
            value={options.glowIntensity}
            onChange={(e) => updateOption('glowIntensity', parseFloat(e.target.value))}
            className="w-full accent-yellow-400 bg-zinc-900 rounded-lg appearance-none h-1.5 cursor-pointer"
          />
        </div>

        {/* Background Opacity */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-medium leading-none">
            <span className="text-zinc-400">Backdrop Asset Opacity</span>
            <span className="font-mono text-pink-400 font-bold">{((options.bgOpacity !== undefined ? options.bgOpacity : 0.30) * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={options.bgOpacity !== undefined ? options.bgOpacity : 0.30}
            onChange={(e) => updateOption('bgOpacity', parseFloat(e.target.value))}
            className="w-full accent-pink-500 bg-zinc-900 rounded-lg appearance-none h-1.5 cursor-pointer"
          />
        </div>

        {/* Background Blur */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-medium leading-none">
            <span className="text-zinc-400">Backdrop Soft Blur Radius</span>
            <span className="font-mono text-cyan-400 font-bold">{(options.bgBlur !== undefined ? options.bgBlur : 5)}px</span>
          </div>
          <input
            type="range"
            min="0"
            max="30"
            step="1"
            value={options.bgBlur !== undefined ? options.bgBlur : 5}
            onChange={(e) => updateOption('bgBlur', parseInt(e.target.value, 10))}
            className="w-full accent-cyan-400 bg-zinc-900 rounded-lg appearance-none h-1.5 cursor-pointer"
          />
        </div>

        {/* Backdrop Circle Shape (Goll Akar) */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-medium leading-none">
            <span className="text-zinc-400">Backdrop Shape (Goll Circle)</span>
            <span className="font-mono text-purple-400 font-bold">
              {((options.bgRoundness !== undefined ? options.bgRoundness : 0.0) * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.01"
            value={options.bgRoundness !== undefined ? options.bgRoundness : 0.0}
            onChange={(e) => updateOption('bgRoundness', parseFloat(e.target.value))}
            className="w-full accent-purple-500 bg-zinc-900 rounded-lg appearance-none h-1.5 cursor-pointer"
          />
          <div className="flex justify-between text-[8px] text-zinc-600 font-mono">
            <span>FULL BACKDROP</span>
            <span>GOLL CIRCLE</span>
          </div>
        </div>
      </div>
    );
  };

  const renderBackdropsPanel = () => {
    return (
      <div className="space-y-3.5 flex flex-col" id="panel-backdrops">
        {/* 1. Neon Palette selector */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="block text-[10px] text-zinc-400 uppercase font-black tracking-wider">Neon Laser Palette</span>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  updateOption('colorTheme', preset.id);
                  updateOption('customColorEnabled', false);
                }}
                className={`flex items-center space-x-1.5 p-1.5 rounded-md border text-[9px] font-bold text-left transition-all duration-150 cursor-pointer ${
                  options.colorTheme === preset.id && !options.customColorEnabled
                    ? 'bg-zinc-900 border-zinc-500 text-white shadow-inner ring-1 ring-zinc-500/40'
                    : 'bg-zinc-950 border-zinc-900 text-zinc-400 hover:border-zinc-850 hover:text-zinc-350'
                }`}
              >
                <div 
                  className="w-2.5 h-2.5 rounded-full shrink-0" 
                  style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})` }}
                />
                <span className="truncate uppercase">{preset.name}</span>
              </button>
            ))}
          </div>

          {/* Single Unified Sleek Custom Color Button */}
          <div className="mt-2">
            <label
              htmlFor="custom-laser-color-picker"
              className={`w-full p-2 rounded-xl border flex items-center justify-between transition-all duration-200 cursor-pointer ${
                options.customColorEnabled
                  ? 'bg-pink-950/30 border-pink-500/80 text-white shadow-[0_0_15px_rgba(236,72,153,0.3)] ring-1 ring-pink-500/50'
                  : 'bg-zinc-950/80 border-zinc-850 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
              title="Pick Custom Laser Color"
            >
              <div className="flex items-center space-x-2.5">
                <div 
                  className="w-6 h-6 rounded-lg border-2 border-white/30 shadow-sm shrink-0 flex items-center justify-center relative overflow-hidden"
                  style={{ backgroundColor: options.customColor || '#ff0033' }}
                >
                  <input
                    type="color"
                    id="custom-laser-color-picker"
                    value={options.customColor || '#ff0033'}
                    onChange={(e) => {
                      updateOption('customColor', e.target.value);
                      updateOption('customColorEnabled', true);
                    }}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  />
                </div>
                <div className="flex flex-col text-left">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-200">Custom Laser Color</span>
                    {options.customColorEnabled && (
                      <span className="px-1.5 py-0.2 rounded bg-pink-500/20 text-pink-400 text-[8px] font-mono font-bold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] font-mono text-zinc-400 uppercase">
                    {options.customColor || '#FF0033'}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-1 text-xs font-bold text-pink-400 bg-pink-500/10 px-2.5 py-1 rounded-lg border border-pink-500/20">
                <Palette className="w-3.5 h-3.5" />
                <span className="text-[9px] uppercase tracking-wide">Pick Color</span>
              </div>
            </label>
          </div>
        </div>

        {/* 2. Preset Background Grid */}
        <div>
          <span className="block text-[10px] text-zinc-500 uppercase font-black tracking-wider mb-1.5">Background Presets</span>
          <div className="grid grid-cols-6 gap-1">
            {PRESET_BACKGROUNDS.map((bg) => (
              <button
                key={bg.name}
                onClick={() => updateOption('backgroundImageUrl', bg.url)}
                className={`relative aspect-square rounded-md overflow-hidden border-2 transition-all ${
                  options.backgroundImageUrl === bg.url 
                    ? 'border-pink-500 scale-95 shadow-[0_0_8px_rgba(236,72,153,0.3)]' 
                    : 'border-zinc-900 hover:border-zinc-800'
                }`}
                title={bg.name}
              >
                <img 
                  src={bg.thumbnail} 
                  alt={bg.name} 
                  referrerPolicy="no-referrer" 
                  className="w-full h-full object-cover pointer-events-none" 
                />
              </button>
            ))}
            {/* Custom Upload BG button */}
            <button
              onClick={() => document.getElementById('bg-file-trigger')?.click()}
              className="aspect-square bg-zinc-900 border-2 border-dashed border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850 rounded-md flex items-center justify-center transition-all text-zinc-400 hover:text-white"
              title="Upload Custom Background"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <input
            type="file"
            id="bg-file-trigger"
            accept="image/*"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (event) => {
                  if (event.target?.result) updateOption('backgroundImageUrl', event.target.result as string);
                };
                reader.readAsDataURL(e.target.files[0]);
              }
            }}
            className="hidden"
          />
        </div>

        {/* 3. Preset Center Disc Grid */}
        <div>
          <span className="block text-[10px] text-zinc-500 uppercase font-black tracking-wider mb-1.5">Center Disc Artwork</span>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
            {PRESET_CENTERS.map((cnt) => (
              <button
                key={cnt.name}
                onClick={() => updateOption('centerImageUrl', cnt.url)}
                className={`relative aspect-square rounded-full overflow-hidden border-2 transition-all ${
                  options.centerImageUrl === cnt.url 
                    ? 'border-cyan-400 scale-95 shadow-[0_0_10px_rgba(34,211,238,0.5)] ring-1 ring-cyan-400/40' 
                    : 'border-zinc-900 hover:border-zinc-700'
                }`}
                title={cnt.name}
              >
                <img 
                  src={cnt.thumbnail} 
                  alt={cnt.name} 
                  referrerPolicy="no-referrer" 
                  className="w-full h-full object-cover pointer-events-none" 
                />
              </button>
            ))}
            {/* Custom Upload Center Disc button */}
            <button
              onClick={() => document.getElementById('center-file-trigger')?.click()}
              className="aspect-square bg-zinc-900 border-2 border-dashed border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850 rounded-full flex items-center justify-center transition-all text-zinc-400 hover:text-white cursor-pointer"
              title="Upload Custom Center"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <input
            type="file"
            id="center-file-trigger"
            accept="image/*"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (event) => {
                  if (event.target?.result) updateOption('centerImageUrl', event.target.result as string);
                };
                reader.readAsDataURL(e.target.files[0]);
              }
            }}
            className="hidden"
          />
        </div>

        {/* Center Rotation Toggle */}
        <div className="flex items-center justify-between p-2 rounded-lg border border-zinc-900 bg-zinc-950/60">
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-zinc-300">Spin Center Circle</span>
            <span className="text-[9px] text-zinc-500">Enable or disable central vinyl disk rotation</span>
          </div>
          <button
            onClick={() => updateOption('rotateCenterImage', options.rotateCenterImage !== false ? false : true)}
            className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
              options.rotateCenterImage !== false ? 'bg-cyan-500' : 'bg-zinc-800'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white shadow-md transform duration-200 ease-in-out ${
                options.rotateCenterImage !== false ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Wave Rotation Toggle */}
        <div className="flex items-center justify-between p-2 rounded-lg border border-zinc-900 bg-zinc-950/60">
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-zinc-300">Spin Waves (Weave Spin)</span>
            <span className="text-[9px] text-zinc-500">Enable or disable outer audio waves rotation</span>
          </div>
          <button
            onClick={() => updateOption('rotateWaves', options.rotateWaves !== false ? false : true)}
            className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
              options.rotateWaves !== false ? 'bg-pink-500' : 'bg-zinc-800'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white shadow-md transform duration-200 ease-in-out ${
                options.rotateWaves !== false ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Quick Clear Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {options.backgroundImageUrl && (
            <button
              onClick={() => updateOption('backgroundImageUrl', null)}
              className="py-1 px-2.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 border border-zinc-850 hover:border-zinc-800 rounded text-[9px] font-bold uppercase transition-all"
            >
              Remove Background
            </button>
          )}
          {options.centerImageUrl && (
            <button
              onClick={() => updateOption('centerImageUrl', null)}
              className="py-1 px-2.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 border border-zinc-850 hover:border-zinc-800 rounded text-[9px] font-bold uppercase transition-all"
            >
              Remove Center Disc
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderVivoEdgePanel = () => {
    return (
      <div className="space-y-3 py-1 animate-fade-in" id="panel-vivo-edge">
        {/* VIP VIVO MUSIC LIGHT EFFECT DEDICATED LAUNCH CARD */}
        <div className="w-full bg-gradient-to-r from-blue-950/80 via-indigo-950/80 to-purple-950/80 border border-cyan-500/40 p-3.5 rounded-2xl shadow-xl space-y-2.5 text-center">
          <div className="flex items-center justify-center space-x-2">
            <Smartphone className="w-4 h-4 text-cyan-400 animate-bounce" />
            <span className="text-xs font-black uppercase text-cyan-200 tracking-wider">
              Dynamic Lights & Music Reactive
            </span>
            <span className="bg-[#0066ff] text-white text-[8px] font-mono font-black px-2 py-0.5 rounded-full shadow-md tracking-wider">
              PRO
            </span>
          </div>

          <p className="text-[10px] text-zinc-300 leading-relaxed px-1">
            Continuous Flowing RGB Laser & Music Reactive Dynamic Lights!
          </p>

          <button
            onClick={() => {
              toggleBrowserFullscreen();
              setIsVivoAodActive(true);
            }}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 active:scale-98 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-[0_0_20px_rgba(0,240,255,0.4)] flex items-center justify-center space-x-2 cursor-pointer transition-all"
          >
            <Sparkles className="w-4 h-4 text-yellow-300 animate-spin" />
            <span>Open Dynamic Lights Studio</span>
          </button>
        </div>

        {/* QUICK DRAWER CONTROLS */}
        <div className="bg-zinc-950/60 border border-zinc-900 rounded-xl p-3 space-y-3">
          {/* Master Power Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-zinc-200">Edge Lights Master Power</span>
              <span className="text-[9px] text-zinc-500">Enable or disable border lights</span>
            </div>
            <button
              onClick={() => updateOption('ambientEdgeEnabled', !options.ambientEdgeEnabled)}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ${
                options.ambientEdgeEnabled ? 'bg-cyan-500' : 'bg-zinc-800'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-md transform duration-200 ease-in-out ${
                  options.ambientEdgeEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">Light Mode Selection</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => {
                  updateOption('ambientEdgeStyle', 'dynamic-rgb-flow');
                  updateOption('ambientEdgeAudioReactive', false);
                  updateOption('ambientEdgeEnabled', true);
                }}
                className={`p-2 rounded-lg border text-left transition-all ${
                  options.ambientEdgeStyle === 'dynamic-rgb-flow' || options.ambientEdgeAudioReactive === false
                    ? 'bg-cyan-950/40 border-cyan-500 text-cyan-300 shadow-sm'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                }`}
              >
                <span className="text-[10px] font-bold block">1. Dynamic RGB Flow</span>
                <span className="text-[8px] opacity-70 block">(फोटो जैसा - Non-Reactive)</span>
              </button>

              <button
                onClick={() => {
                  updateOption('ambientEdgeStyle', 'vivo-reactive');
                  updateOption('ambientEdgeAudioReactive', true);
                  updateOption('ambientEdgeEnabled', true);
                }}
                className={`p-2 rounded-lg border text-left transition-all ${
                  options.ambientEdgeStyle === 'vivo-reactive' || options.ambientEdgeAudioReactive === true
                    ? 'bg-blue-950/40 border-blue-500 text-blue-300 shadow-sm'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                }`}
              >
                <span className="text-[10px] font-bold block">2. Vivo T4 Music</span>
                <span className="text-[8px] opacity-70 block">(गाने पर बीट रिएक्टिव)</span>
              </button>
            </div>
          </div>

          {/* Border Thickness Slider (1-10px) */}
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="text-zinc-300">Border Thickness (मोटाई: 1-10)</span>
              <span className="text-cyan-400 font-mono text-[10px] font-bold">{Math.min(10, Math.max(1, options.ambientEdgeWidth ?? 4))} px</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[8.5px] font-mono text-zinc-500">1px</span>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={Math.min(10, Math.max(1, options.ambientEdgeWidth ?? 4))}
                onChange={(e) => updateOption('ambientEdgeWidth', Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 accent-cyan-400 rounded-lg cursor-pointer"
              />
              <span className="text-[8.5px] font-mono text-zinc-500">10px</span>
            </div>
          </div>

          {/* Light Speed Slider (1-5) */}
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="text-zinc-300">Light Speed (गति: Slow / Fast)</span>
              <span className="text-cyan-400 font-mono text-[10px] font-bold">{options.ambientEdgeSpeed ?? 3}x</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[8.5px] font-mono text-zinc-500">Slow</span>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={options.ambientEdgeSpeed ?? 3}
                onChange={(e) => updateOption('ambientEdgeSpeed', Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 accent-cyan-400 rounded-lg cursor-pointer"
              />
              <span className="text-[8.5px] font-mono text-zinc-500">Fast</span>
            </div>
          </div>

          {/* Glow Spread Slider (4-36px) */}
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="text-zinc-300">Glow Spread (चमक फैलाव)</span>
              <span className="text-cyan-400 font-mono text-[10px] font-bold">{options.ambientEdgeGlow ?? 16} px</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[8.5px] font-mono text-zinc-500">4px</span>
              <input
                type="range"
                min={4}
                max={36}
                step={2}
                value={options.ambientEdgeGlow ?? 16}
                onChange={(e) => updateOption('ambientEdgeGlow', Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 accent-cyan-400 rounded-lg cursor-pointer"
              />
              <span className="text-[8.5px] font-mono text-zinc-500">36px</span>
            </div>
          </div>
        </div>
      </div>
    );
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
      console.warn('Fullscreen toggle failed:', e);
    }
  };

  return (
    <div className="w-screen h-[100dvh] bg-[#020204] text-zinc-100 overflow-hidden font-sans select-none flex items-center justify-center" id="music-visualizer-app">
      
      {/* 1. INITIAL SOUND ACTIVATION DIALOG OVERLAY */}
      <AnimatePresence>
        {!isIgnited && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#05050b]/95 backdrop-blur-2xl px-6 text-center"
            id="igniter-overlay"
          >
            <div className="max-w-md space-y-6">
              <motion.div
                animate={{ scale: [1, 1.05, 1], rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                className="w-24 h-24 mx-auto bg-gradient-to-tr from-pink-500 to-cyan-400 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(236,72,153,0.35)]"
              >
                <Disc className="w-12 h-12 text-white animate-[spin_6s_linear_infinite]" />
              </motion.div>

              <div className="space-y-2">
                <h1 className="font-display font-black text-3xl md:text-4xl tracking-tight leading-tight text-white">
                  AURAPULSE STUDIO
                </h1>
                <p className="text-sm text-zinc-400 font-medium">
                  Experience a studio-grade, dynamic music visualizer with transient-adaptive physics and live AGC vibe matching.
                </p>
              </div>

              <button
                onClick={() => {
                  initAudioEngine();
                  setIsIgnited(true);
                  setOptions(prev => ({ ...prev, audioSource: 'file' }));
                  setTimeout(() => {
                    if (audioElementRef.current) {
                      const playPromise = audioElementRef.current.play();
                      if (playPromise !== undefined) {
                        playPromise.catch(error => {
                          if (error.name !== 'AbortError') {
                            console.warn('Playback error:', error);
                          }
                        });
                      }
                      setIsPlaying(true);
                    }
                  }, 150);
                }}
                className="w-full py-4 px-6 bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-600 hover:to-cyan-600 rounded-2xl text-sm font-bold tracking-wider uppercase text-white shadow-[0_4px_25px_rgba(236,72,153,0.25)] hover:shadow-[0_4px_35px_rgba(236,72,153,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                id="btn-ignite-sound"
              >
                Ignite Audio & Visuals
              </button>
              
              <div className="text-[10px] text-zinc-500 font-mono flex items-center justify-center space-x-1">
                <Activity className="w-3 h-3 text-pink-500" />
                <span>POWERED BY HYDRAULIC CANVAS RENDERING</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop blurred ambient backdrop */}
      <div 
        className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-10 pointer-events-none hidden md:block"
        style={{ backgroundImage: options.backgroundImageUrl ? `url(${options.backgroundImageUrl})` : 'none' }}
      />

      {/* MAIN CONTAINER: Professional Non-Scrolling Mobile Video Editor Layout (height: 100dvh, overflow: hidden) */}
      <div className="w-full max-w-md h-full flex flex-col bg-[#05050a] relative overflow-hidden border-x border-zinc-900 shadow-2xl animate-fade-in" id="editor-container">
        
        {/* UPPER ZONE: Dedicated Non-Scrollable Header */}
        <header className="h-12 border-b border-zinc-900/60 flex items-center justify-between px-4 shrink-0 bg-zinc-950/40 backdrop-blur-md z-10">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-pink-500 to-cyan-500 flex items-center justify-center shadow-md shadow-pink-500/10">
              <Disc className="w-3.5 h-3.5 text-white animate-[spin_4s_linear_infinite]" />
            </div>
            <div>
              <span className="text-xs font-black tracking-wider text-zinc-100 uppercase block leading-none">AURAPULSE</span>
              <span className="text-[8px] text-pink-500 font-mono tracking-widest uppercase block mt-0.5">
                {isPlaying ? '● RECORDING' : '○ STANDBY'}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            {/* User Profile / Login Button */}
            <button
              onClick={() => {
                if (currentUser) {
                  // If already logged in, prompt sign out or show details
                  if (window.confirm(`Logged in as ${currentUser.email}\nLocation: ${currentUser.lastLoginCity || 'India'}\n\nDo you want to log out?`)) {
                    signOut(auth);
                  }
                } else {
                  setIsVipAuthFlow(false);
                  setShowAuthModal(true);
                }
              }}
              className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 hover:border-zinc-700 text-zinc-300 transition-all cursor-pointer flex items-center justify-center"
              title={currentUser ? `Account: ${currentUser.email} (${currentUser.lastLoginCity || 'IN'})` : "Sign In / Create Account"}
              id="header-user-btn"
            >
              {currentUser?.photoURL ? (
                <img src={currentUser.photoURL} alt="Avatar" className="w-4 h-4 rounded-full" />
              ) : currentUser ? (
                <div className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-[9px] flex items-center justify-center">
                  {currentUser.displayName?.[0]?.toUpperCase() || 'U'}
                </div>
              ) : (
                <div className="w-4 h-4 flex items-center justify-center text-zinc-400">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              )}
            </button>

            {/* VIP Upgrade / Status Icon Only */}
            <button
              onClick={() => setShowPremiumModal(true)}
              className={`p-2 rounded-lg border flex items-center justify-center transition-all cursor-pointer shadow-sm ${
                monetization.isPremium
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                  : 'bg-gradient-to-tr from-amber-500/25 to-yellow-500/25 border-amber-500/50 text-amber-300 hover:from-amber-500/40 hover:to-yellow-500/40 hover:scale-105 active:scale-95'
              }`}
              id="header-vip-btn"
              title={monetization.isPremium ? "VIP Pro Active" : "VIP Pro Pass (No Ads)"}
            >
              <Crown className="w-4 h-4 text-amber-400" />
            </button>

            <button
              onClick={() => setShowExportModal(true)}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500/15 to-pink-500/15 border border-cyan-500/30 hover:border-pink-500/50 hover:from-cyan-500/20 hover:to-pink-500/20 text-zinc-200 hover:text-white transition-all duration-150 cursor-pointer flex items-center space-x-1.5 shadow-sm"
              id="header-export-btn"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[10px] font-bold tracking-wider">EXPORT</span>
            </button>
          </div>
        </header>

        {/* UPPER PREVIEW ZONE: Filmora Style Vertical Video Box with Aspect Ratio Framing */}
        <div className="flex-1 flex flex-col justify-center items-center p-2 overflow-hidden bg-[#030306] relative min-h-[46dvh]">
          
          {/* Active Aspect Ratio Indicator Badge */}
          <div className="mb-1 flex items-center justify-center z-10 shrink-0">
            <div className="px-3 py-0.5 rounded-full bg-zinc-900/90 border border-cyan-500/40 text-[8.5px] font-mono font-black uppercase text-cyan-300 tracking-wider flex items-center space-x-1.5 shadow-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>
                {options.aspectRatio === '1:1'
                  ? '1:1 SQUARE FRAME'
                  : options.aspectRatio === '16:9'
                    ? '16:9 WIDESCREEN FRAME'
                    : '9:16 VERTICAL REEL FRAME'}
              </span>
            </div>
          </div>

          {/* Aspect Ratio Video Stage - Large Prominent Preview Box */}
          <div className={`relative transition-all duration-300 rounded-2xl overflow-hidden border-2 border-cyan-500/50 shadow-[0_0_35px_rgba(6,182,212,0.25)] flex flex-col bg-[#05050c] items-center justify-center w-full ${
            options.aspectRatio === '1:1'
              ? 'aspect-square h-full max-h-[48dvh] max-w-[48dvh] mx-auto'
              : options.aspectRatio === '16:9'
                ? 'aspect-[16/9] w-full max-w-[440px] max-h-[44dvh] mx-auto'
                : 'aspect-[9/16] h-full max-h-[50dvh] w-auto mx-auto'
          }`} id="canvas-preview-container">

            {/* Viewfinder Corner Framing Guides (Aspect Ratio Overlay) */}
            <div className="absolute top-2 left-2 w-3.5 h-3.5 border-t-2 border-l-2 border-cyan-400/80 pointer-events-none z-10 rounded-tl-sm" />
            <div className="absolute top-2 right-2 w-3.5 h-3.5 border-t-2 border-r-2 border-cyan-400/80 pointer-events-none z-10 rounded-tr-sm" />
            <div className="absolute bottom-2 left-2 w-3.5 h-3.5 border-b-2 border-l-2 border-cyan-400/80 pointer-events-none z-10 rounded-bl-sm" />
            <div className="absolute bottom-2 right-2 w-3.5 h-3.5 border-b-2 border-r-2 border-cyan-400/80 pointer-events-none z-10 rounded-br-sm" />

            <VisualizerCanvas
              analyserNode={analyserNode}
              audioContext={audioContext}
              options={options}
              onStatsChange={setStats}
              isPlaying={isPlaying}
            />

            {/* FLOATING FULLSCREEN PREVIEW BUTTON (ICON ONLY - IN-APP PURE VIDEO PREVIEW) */}
            <button
              onClick={() => {
                setIsFullscreenPreview(true);
              }}
              className="absolute top-2.5 right-2.5 p-2 rounded-lg bg-black/80 hover:bg-black/95 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 hover:text-white transition-all duration-150 z-20 cursor-pointer flex items-center justify-center shadow-lg backdrop-blur-md hover:scale-105 active:scale-95"
              title="Sound Visualizer Fullscreen Preview"
              id="btn-fullscreen-toggle"
            >
              <Maximize2 className="w-4 h-4 text-cyan-400" />
            </button>

            {/* LIVE EXPORT RECORDING STATUS BADGE */}
            {isRecording && (
              <div className="absolute top-3 left-3 flex items-center space-x-1.5 bg-red-600/90 text-white px-2 py-0.5 rounded-full font-mono text-[8px] tracking-widest font-black animate-pulse z-15 shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-white block" />
                <span>REC LIVE</span>
              </div>
            )}

            {/* SPINNING LP ALBUM ARTWORK DISC INSIDE THE CIRCULAR RIG */}
            {false && (
              <div 
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[85px] h-[85px] rounded-full flex items-center justify-center pointer-events-none z-10"
                id="spinning-disc-holder"
              >
                {/* Subtle pulsing background behind the avatar */}
                <div 
                  className="absolute inset-0 rounded-full transition-transform duration-200"
                  style={{
                    transform: `scale(${1 + (stats.volume * 0.25)})`,
                    background: `radial-gradient(circle, ${activeColorPreset.primary}15 0%, transparent 70%)`
                  }}
                />
                
                {/* The physical vinyl disc spinner */}
                <div 
                  className={`relative w-[70px] h-[70px] rounded-full bg-zinc-950 border-2 border-zinc-850/80 shadow-[0_0_20px_rgba(0,0,0,0.6)] flex items-center justify-center overflow-hidden`}
                  style={{
                    animation: isPlaying ? 'spin 8s linear infinite' : 'none',
                    boxShadow: stats.isTransient ? `0 0 15px ${activeColorPreset.primary}50` : 'none'
                  }}
                >
                  {options.centerImageUrl ? (
                    <>
                      <img 
                        src={options.centerImageUrl} 
                        alt="Center artwork" 
                        className="absolute inset-0 w-full h-full object-cover rounded-full" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 rounded-full border border-white/5 opacity-30 pointer-events-none" />
                      <div className="absolute inset-2 rounded-full border border-white/5 opacity-20 pointer-events-none" />
                      <div className="absolute inset-4 rounded-full border border-white/5 opacity-15 pointer-events-none" />
                      <div className="absolute w-2 h-2 rounded-full bg-black border border-zinc-800/60 z-20" />
                    </>
                  ) : (
                    <>
                      {/* Vinyl grooves patterns */}
                      <div className="absolute inset-2 rounded-full border border-zinc-900 opacity-60" />
                      <div className="absolute inset-4 rounded-full border border-zinc-900 opacity-40" />
                      <div className="absolute inset-6 rounded-full border border-zinc-900 opacity-30" />
                      
                      {/* Center Vinyl Label with dynamic artwork depending on source */}
                      <div className="w-[26px] h-[26px] rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center relative overflow-hidden z-20">
                        {options.audioSource === 'microphone' ? (
                          <div className="w-full h-full bg-purple-600 flex items-center justify-center animate-ping">
                            <Mic className="w-3 text-white" />
                          </div>
                        ) : (
                          <div className="w-full h-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center">
                            <Music className="w-3 text-white" />
                          </div>
                        )}
                        <div className="absolute w-1.5 h-1.5 rounded-full bg-black border border-zinc-850" />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Elegant overlay watermark */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none opacity-40 text-[8px] font-mono tracking-widest text-zinc-400">
              <span className="truncate max-w-[120px]">{audioFileName || 'AURAPULSE'}</span>
              <span>{stats.bpm} BPM</span>
            </div>
          </div>

        </div>

        {/* TIMELINE & PLAYBACK SEEK BAR SECTION */}
        <div className="px-4 py-2.5 bg-zinc-950 border-t border-zinc-900/80 flex flex-col space-y-2 shrink-0" id="editor-timeline">
          <div className="relative flex flex-col space-y-1">
            {options.audioSource === 'file' ? (
              <>
                <input
                  type="range"
                  min="0"
                  max={trackDuration || 100}
                  value={trackProgress}
                  onChange={handleSeek}
                  className="w-full accent-pink-500 bg-zinc-850 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[9px] font-mono text-zinc-500 px-0.5 leading-none">
                  <span>{currentTimeFormatted}</span>
                  <span>{durationFormatted === '0:00' && isPlaying ? 'Buffering...' : durationFormatted}</span>
                </div>
              </>
            ) : (
              <>
                <div className="h-4 flex items-end justify-between px-1 pointer-events-none select-none text-[8px] text-zinc-600 font-mono leading-none">
                  <div className="flex flex-col items-center"><div className="h-1 w-0.5 bg-zinc-800 mb-0.5" /><span>0:00</span></div>
                  <div className="flex flex-col items-center"><div className="h-0.5 w-0.5 bg-zinc-900 mb-0.5" /><span>0:10</span></div>
                  <div className="flex flex-col items-center"><div className="h-0.5 w-0.5 bg-zinc-900 mb-0.5" /><span>0:20</span></div>
                  <div className="flex flex-col items-center"><div className="h-0.5 w-0.5 bg-zinc-900 mb-0.5" /><span>0:30</span></div>
                  <div className="flex flex-col items-center"><div className="h-1 w-0.5 bg-zinc-800 mb-0.5" /><span>LIVE</span></div>
                </div>
                <div className="relative w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
                  <div 
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-pink-500 to-cyan-500 transition-all duration-300"
                    style={{ width: isPlaying ? '100%' : '15%', animation: isPlaying ? 'pulse 2s infinite' : 'none' }}
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 px-1 py-0.5" id="timeline-controls">
            {/* Left Volume / Mute Control with responsive slider width */}
            <div className="flex items-center space-x-2 bg-zinc-900 border border-zinc-750 px-3 py-1.5 rounded-full shadow-md shrink-0">
              <button 
                onClick={toggleMute} 
                className="text-cyan-400 hover:text-cyan-300 transition-colors duration-100 cursor-pointer shrink-0"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 sm:w-28 accent-cyan-400 bg-zinc-800 border border-zinc-700 h-2 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[10px] font-mono font-black text-cyan-300 shrink-0 min-w-[30px] text-right">
                {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
              </span>
            </div>

            {/* Right Shifted Play Button & Status Badge */}
            <div className="flex items-center space-x-2.5 shrink-0 ml-auto">
              <div className="flex flex-col items-end">
                <span className={`text-[9px] font-black uppercase tracking-wider leading-none ${isPlaying ? 'text-pink-400' : 'text-zinc-400'}`}>
                  {isPlaying ? 'PLAYING' : 'PAUSED'}
                </span>
                <span className="text-[7.5px] font-mono text-cyan-400 leading-none mt-1 uppercase">
                  {options.audioSource === 'file' ? 'TRACK' : 'SYNTH'}
                </span>
              </div>

              <button
                onClick={togglePlay}
                className="w-11 h-11 rounded-full bg-gradient-to-tr from-pink-500 to-cyan-400 hover:scale-105 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-pink-500/30 transition-all duration-150 cursor-pointer shrink-0"
                title={isPlaying ? 'Pause' : 'Play'}
                id="btn-main-play-pause"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-current text-white" />
                ) : (
                  <Play className="w-5 h-5 fill-current text-white translate-x-0.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* LOWER CONTROL DOCK: Dynamic Category Tabs */}
        <div className="bg-zinc-950 border-t border-zinc-900/80 flex flex-col flex-1 min-h-0 relative" id="lower-control-dock">
          
          {/* Tabs header bar */}
          <div className="flex items-center overflow-x-auto scrollbar-none border-b border-zinc-900/85 bg-zinc-950 px-2 shrink-0 h-11" id="category-tab-bar">
            <div className="flex space-x-1 w-full justify-between min-w-max">
              <button
                onClick={() => setActiveTab('audio')}
                className={`flex flex-col items-center justify-center px-4 py-1 rounded-lg text-[10px] font-bold tracking-wide transition-all ${
                  activeTab === 'audio' 
                    ? 'text-pink-400 bg-pink-500/10' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Music className="w-3.5 h-3.5 mb-0.5" />
                <span>AUDIO</span>
              </button>

              <button
                onClick={() => setActiveTab('wave-styles')}
                className={`flex flex-col items-center justify-center px-4 py-1 rounded-lg text-[10px] font-bold tracking-wide transition-all ${
                  activeTab === 'wave-styles' 
                    ? 'text-pink-400 bg-pink-500/10' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Eye className="w-3.5 h-3.5 mb-0.5" />
                <span>STYLES</span>
              </button>

              <button
                onClick={() => setActiveTab('layouts')}
                className={`flex flex-col items-center justify-center px-4 py-1 rounded-lg text-[10px] font-bold tracking-wide transition-all ${
                  activeTab === 'layouts' 
                    ? 'text-pink-400 bg-pink-500/10' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 mb-0.5" />
                <span>LAYOUTS</span>
              </button>

              <button
                onClick={() => setActiveTab('glow-fx')}
                className={`flex flex-col items-center justify-center px-4 py-1 rounded-lg text-[10px] font-bold tracking-wide transition-all ${
                  activeTab === 'glow-fx' 
                    ? 'text-pink-400 bg-pink-500/10' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Zap className="w-3.5 h-3.5 mb-0.5" />
                <span>GLOW/FX</span>
              </button>

              <button
                onClick={() => setActiveTab('backdrops')}
                className={`flex flex-col items-center justify-center px-4 py-1 rounded-lg text-[10px] font-bold tracking-wide transition-all ${
                  activeTab === 'backdrops' 
                    ? 'text-pink-400 bg-pink-500/10' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Image className="w-3.5 h-3.5 mb-0.5" />
                <span>BACKDROPS</span>
              </button>

              <button
                onClick={() => setIsVivoAodActive(prev => !prev)}
                className={`flex flex-col items-center justify-center px-3.5 py-1 rounded-lg text-[10px] font-bold tracking-wide transition-all relative cursor-pointer ${
                  isVivoAodActive 
                    ? 'text-cyan-400 bg-cyan-500/20 border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.3)]' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Toggle Dynamic Lights Screen"
              >
                <Smartphone className={`w-3.5 h-3.5 mb-0.5 text-cyan-400 ${isVivoAodActive ? 'animate-bounce' : 'animate-pulse'}`} />
                <span>DYNAMIC LIGHTS</span>
              </button>
            </div>
          </div>

          {/* Tab Sub-panels (compact vertical layouts with small gaps, safe area bottom padding) */}
          <div 
            className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs select-none scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 12px)' }}
            id="active-sub-panel"
          >
            {activeTab === 'audio' && renderAudioPanel()}
            {activeTab === 'wave-styles' && renderWaveStylesPanel()}
            {activeTab === 'layouts' && renderLayoutsPanel()}
            {activeTab === 'glow-fx' && renderGlowFxPanel()}
            {activeTab === 'backdrops' && renderBackdropsPanel()}
          </div>

        </div>

      </div>

      {/* GLOBAL SYSTEM-LEVEL EDGE LIGHTING OVERLAY (Full Viewport Screen Borders) */}
      <AmbientEdgeGlow options={options} stats={stats} isPlaying={isPlaying} />

      {/* VIVO T4 MUSIC LIGHT EFFECT SCREEN OVERLAY */}
      {isVivoAodActive && (
        <VivoMusicLightEffectScreen
          options={options}
          stats={stats}
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          onClose={() => setIsVivoAodActive(false)}
          onUpdateOption={updateOption}
          monetization={monetization}
          onOpenPremium={() => setShowPremiumModal(true)}
          onRequestUnlockEffect={(preset) => {
            if (monetization.isPremium) return;
            const adsCount = preset.id.includes('spectrum') || preset.id.includes('rgb') ? 2 : 1;
            setAdModalConfig({
              isOpen: true,
              title: `Unlock "${preset.name}" Effect`,
              description: `Watch ${adsCount} short sponsored ad${adsCount > 1 ? 's' : ''} to unlock this premium dynamic effect for lifetime use, or upgrade to VIP.`,
              totalAdsRequired: adsCount,
              rewardType: 'unlock_effect',
              directPlay: false,
              pendingPreset: preset,
              pendingAction: () => {
                const updated = unlockLifetimeEffect(preset.id);
                setMonetization(updated);
              }
            });
          }}
        />
      )}

      {/* EXPORT OPTIONS MODAL OVERLAY */}
      <AnimatePresence>
        {showExportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4"
            id="export-modal-overlay"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-sm bg-zinc-950 border border-zinc-850 rounded-2xl overflow-hidden shadow-2xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span className="font-display font-black text-xs tracking-wider uppercase text-zinc-100">Export Media Studio</span>
                </div>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-pink-400 hover:text-pink-300 transition-all cursor-pointer flex items-center space-x-1.5 shadow-md"
                  title="Close / Back"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">BACK ❌</span>
                </button>
              </div>

              {/* VIP Banner / Shortcut in Export Modal */}
              {!monetization.isPremium && (
                <div 
                  onClick={() => {
                    setShowExportModal(false);
                    setShowPremiumModal(true);
                  }}
                  className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/15 border border-amber-500/30 flex items-center justify-between cursor-pointer hover:border-amber-500/50 transition-all"
                >
                  <div className="flex items-center space-x-2">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <div>
                      <span className="block text-[11px] font-bold text-amber-300 leading-tight">VIP Pass ₹99/mo</span>
                      <span className="block text-[8px] text-zinc-400">Zero Ads • Unlimited 4K & All Effects Unlocked</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-black text-[9px] font-black uppercase shadow-sm">
                    Upgrade
                  </span>
                </div>
              )}

              {/* Export Quality Configurator */}
              <div className="bg-zinc-900/45 border border-zinc-850 p-3 rounded-xl space-y-2" id="export-quality-container">
                <div className="flex items-center justify-between">
                  <span className="block text-[9px] font-black uppercase text-zinc-400 tracking-wider">Select Export Quality & Bitrate</span>
                  {monetization.isPremium && (
                    <span className="text-[8px] font-bold text-amber-400 flex items-center space-x-1">
                      <Crown className="w-2.5 h-2.5" />
                      <span>VIP FREE</span>
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { id: 'sd', label: 'SD (720p)', desc: 'Free (0 Ads)' },
                    { id: 'hd', label: 'HD (1080p)', desc: monetization.isPremium ? 'VIP Instant' : '2 Ads / Free' },
                    { id: '4k', label: '4K Ultra HD', desc: monetization.isPremium ? 'VIP Instant' : '3 Ads / Free' }
                  ] as const).map((q) => {
                    const isSelected = exportQuality === q.id;
                    return (
                      <button
                        key={q.id}
                        onClick={() => setExportQuality(q.id)}
                        className={`p-2 rounded-lg border text-center transition-all cursor-pointer flex flex-col justify-between items-center h-14 ${
                          isSelected
                            ? 'bg-cyan-500/10 border-cyan-500/60 text-cyan-400 shadow-md'
                            : 'bg-zinc-950 border-zinc-900 text-zinc-500 hover:border-zinc-800 hover:text-zinc-300'
                        }`}
                        id={`btn-quality-${q.id}`}
                      >
                        <span className="block text-[9px] font-black uppercase leading-tight">{q.label}</span>
                        <span className="block text-[7px] font-semibold text-zinc-500 leading-none mt-1">{q.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2.5">
                {/* Option 1: Snap PNG Screenshot */}
                <button
                  onClick={() => {
                    const canvas = document.getElementById('visualizer-main-canvas') as HTMLCanvasElement;
                    if (canvas) {
                      const dataUrl = canvas.toDataURL('image/png');
                      const link = document.createElement('a');
                      link.download = `AuraPulse_Artwork_${Date.now()}.png`;
                      link.href = dataUrl;
                      link.click();
                      setShowExportModal(false);
                    } else {
                      alert('Canvas not loaded. Please play or select an option first.');
                    }
                  }}
                  className="w-full p-3 bg-zinc-900 border border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-500/10 rounded-xl flex items-center space-x-3 text-left transition-all duration-150 group cursor-pointer shadow-sm"
                  id="btn-capture-png"
                >
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform shrink-0">
                    <Image className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-1.5">
                      <span className="block text-xs font-bold text-zinc-100">Capture PNG Snapshot</span>
                      <span className="text-[7.5px] font-mono font-black uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">1-Click</span>
                    </div>
                    <span className="block text-[8.5px] text-zinc-400 font-medium mt-0.5">Instant lossless high-res artwork image download to gallery</span>
                  </div>
                </button>

                {/* Option 2: Automated High-Res Video Export */}
                <button
                  onClick={() => {
                    setShowExportModal(false);
                    startAutomatedExport();
                  }}
                  className="w-full p-3 bg-zinc-900 border border-pink-500/30 hover:border-pink-400 hover:bg-pink-500/10 rounded-xl flex items-center space-x-3 text-left transition-all duration-150 group cursor-pointer shadow-sm"
                  id="btn-export-video"
                >
                  <div className="w-10 h-10 rounded-lg bg-pink-500/20 text-pink-400 group-hover:scale-105 flex items-center justify-center transition-transform shrink-0">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-1.5">
                      <span className="block text-xs font-bold text-zinc-100">
                        Export {exportQuality === '4k' ? '4K Ultra HD' : exportQuality === 'hd' ? 'HD 1080p' : 'SD 720p'} Video
                      </span>
                      <span className="text-[7.5px] font-mono font-black uppercase px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30">
                        {monetization.isPremium ? 'VIP Instant' : exportQuality === '4k' ? '3 Ads' : exportQuality === 'hd' ? '2 Ads' : 'Free'}
                      </span>
                    </div>
                    <span className="block text-[8.5px] text-zinc-400 font-medium mt-0.5">Automated frame-by-frame rendering with audio sync</span>
                  </div>
                </button>
              </div>

              {/* Guide Method 1: WebM to MP4 Fast Online Converter */}
              <div className="bg-zinc-900/60 border border-zinc-850 p-3 rounded-xl space-y-2 text-left" id="export-guide-method1-card">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-1.5">
                  <div className="flex items-center space-x-1.5 text-cyan-400">
                    <span className="text-[8px] font-mono px-1.5 py-0.5 bg-cyan-500/10 border border-cyan-500/30 rounded font-black text-cyan-300">METHOD 1</span>
                    <span className="text-[10px] font-bold text-zinc-200 uppercase tracking-wide">Free MP4 Converter (WhatsApp / Reels)</span>
                  </div>
                </div>
                
                <p className="text-[9px] text-zinc-400 leading-relaxed font-medium">
                  If video playback shows short length on WhatsApp or Reels, upload your exported file here and convert to universal MP4 in 5 seconds:
                </p>

                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <a
                    href="https://ezgif.com/webm-to-mp4"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 px-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 rounded-lg text-center text-[9.5px] font-bold inline-flex items-center justify-center gap-1 transition-all shadow-sm"
                  >
                    Ezgif MP4 <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href="https://cloudconvert.com/webm-to-mp4"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 px-2 bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 text-pink-300 rounded-lg text-center text-[9.5px] font-bold inline-flex items-center justify-center gap-1 transition-all shadow-sm"
                  >
                    CloudConvert <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="text-[8px] font-mono text-zinc-600 text-center uppercase tracking-widest pt-0.5">
                AuraPulse Audio-Visual Renderer Studio
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AUTOMATED EXPORT PROGRESS DIALOG */}
      <AnimatePresence>
        {isExporting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-lg px-6 text-center"
            id="export-progress-overlay"
          >
            <div className="max-w-xs w-full space-y-6">
              <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                {/* Rotating glow ring */}
                <div className="absolute inset-0 rounded-full border-4 border-zinc-900" />
                <div className="absolute inset-0 rounded-full border-4 border-t-pink-500 border-r-cyan-400 animate-spin" />
                <span className="text-sm font-black text-zinc-100 font-mono">{exportProgress}%</span>
              </div>

              <div className="space-y-1.5">
                <h2 className="font-display font-black text-sm tracking-widest uppercase text-zinc-100">
                  RENDERING HIGHEST QUALITY VIDEO
                </h2>
                <p className="text-[10px] text-zinc-500 font-semibold font-mono uppercase tracking-wider">
                  Quality: {exportQuality.toUpperCase()} • Ratio: {options.aspectRatio || '9:16'}
                </p>
                <p className="text-[9px] text-zinc-400">
                  Drawing every waveform and node frame-by-frame with high-fidelity audio mapping. Please do not close this tab.
                </p>
              </div>

              <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-pink-500 to-cyan-400 h-full transition-all duration-150"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>

              <button
                onClick={cancelAutomatedExport}
                className="w-full py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-red-400 border border-zinc-850 rounded-xl text-[10px] font-bold tracking-wider uppercase transition-colors"
              >
                Cancel Export
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SERVER TRANSCODING OVERLAY */}
      <AnimatePresence>
        {isTranscoding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl px-6 text-center"
            id="transcode-progress-overlay"
          >
            <div className="max-w-sm w-full space-y-6">
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                {/* Rotating glow ring for processing */}
                <div className="absolute inset-0 rounded-full border-4 border-zinc-900/50" />
                <div className="absolute inset-0 rounded-full border-4 border-t-cyan-400 border-b-pink-500 animate-spin" />
                <Video className="w-8 h-8 text-cyan-400 animate-pulse" />
              </div>

              <div className="space-y-3">
                <h2 className="font-display font-black text-sm tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500">
                  CONVERTING TO ULTRA-COMPATIBLE MP4
                </h2>
                <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 text-left">
                  <p className="text-[10px] text-zinc-300 font-medium leading-relaxed">
                    <strong>Direct MP4 Processing:</strong> Converting video into universal <strong>MP4 format</strong> optimized for WhatsApp, Instagram Reels, and mobile phone galleries.
                  </p>
                </div>
                <p className="text-[10px] text-zinc-400 font-semibold font-mono leading-relaxed px-2">
                  {transcodeMessage}
                </p>
                <p className="text-[9px] text-zinc-500">
                  This takes only 5 to 10 seconds. Please keep this browser tab open...
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EXPORT SUCCESS COMPATIBILITY & DURATION GUIDE MODAL */}
      <AnimatePresence>
        {showExportSuccessModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#020205]/95 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto"
            id="export-success-modal"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-950 border border-zinc-850 p-6 rounded-3xl max-w-md w-full text-center relative shadow-2xl space-y-5 my-8"
            >
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center bg-emerald-500/10 border border-emerald-500/30 rounded-full">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
                <Sparkles className="w-4 h-4 text-cyan-400 absolute -top-1 -right-1 animate-bounce" />
              </div>

              <div className="space-y-1.5">
                <h2 className="font-display font-black text-base tracking-wider uppercase text-zinc-100">
                  Export Guide & Solutions 🎬
                </h2>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono">
                  Guaranteed Solutions for Video Playback
                </p>
              </div>

              {/* The 1-second duration explanation */}
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-left space-y-2.5">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                  <h3 className="text-xs font-black text-red-400 uppercase tracking-wider">Why does the video show as 1-second in some apps?</h3>
                </div>
                <div className="text-[10.5px] text-zinc-300 leading-relaxed space-y-1.5 font-medium">
                  <p>
                    <strong>The Cause:</strong> Android Chrome browser records videos using the <strong className="text-red-300">WebM format standard</strong> (even if saved as .mp4).
                  </p>
                  <p>
                    While Chrome and Google Files play the full length seamlessly, apps like <strong>WhatsApp and Instagram Reels</strong> require universal MP4. Sharing WebM files directly can cause those apps to misread the container header and report 1 second.
                  </p>
                </div>
              </div>

              {/* Steps container */}
              <div className="space-y-3.5 text-left">
                <p className="text-[11px] font-black uppercase text-zinc-400 tracking-widest border-b border-zinc-900 pb-1.5">
                  3 Easy Methods to Resolve:
                </p>

                {/* Method 1: WebM to MP4 Online Converter with link buttons */}
                <div className="bg-zinc-900/40 border border-zinc-850 p-3 rounded-xl space-y-2">
                  <div className="flex items-center space-x-2 text-cyan-400">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-cyan-500/10 border border-cyan-500/20 rounded font-black">METHOD 1</span>
                    <span className="text-xs font-bold text-zinc-200">Free Online Converter (Easiest ⭐️)</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-relaxed font-medium">
                    Click any converter button below, upload your downloaded video file, and click <strong>Convert to MP4</strong>. The output MP4 file will play full duration on WhatsApp & Reels!
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <a
                      href="https://ezgif.com/webm-to-mp4"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1.5 px-2 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-300 rounded-lg text-center text-[10px] font-bold inline-flex items-center justify-center gap-1 transition-colors"
                    >
                      Ezgif Converter <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                    <a
                      href="https://cloudconvert.com/webm-to-mp4"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1.5 px-2 bg-pink-500/10 border border-pink-500/30 hover:bg-pink-500/20 text-pink-300 rounded-lg text-center text-[10px] font-bold inline-flex items-center justify-center gap-1 transition-colors"
                    >
                      CloudConvert <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>

                {/* Method 2: Play Store App Offline Option */}
                <div className="bg-zinc-900/40 border border-zinc-850 p-3 rounded-xl space-y-1.5">
                  <div className="flex items-center space-x-2 text-emerald-400">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded font-black">METHOD 2</span>
                    <span className="text-xs font-bold text-zinc-200">Offline Converter App</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-relaxed font-medium">
                    Download any free <strong className="text-emerald-300">"WebM to MP4 Converter"</strong> app from Play Store or App Store. It converts video files on your device offline in seconds.
                  </p>
                </div>

                {/* Method 3: WhatsApp Document trick */}
                <div className="bg-zinc-900/40 border border-zinc-850 p-3 rounded-xl space-y-1.5">
                  <div className="flex items-center space-x-2 text-amber-400">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded font-black">METHOD 3</span>
                    <span className="text-xs font-bold text-zinc-200">Send as WhatsApp Document</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-relaxed font-medium">
                    When sharing on WhatsApp, tap the paperclip icon in chat and select <strong>Document</strong> instead of Gallery. WhatsApp delivers the full uncompressed video!
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col space-y-2">
                <button
                  onClick={() => setShowExportSuccessModal(false)}
                  className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-600 hover:to-cyan-600 text-zinc-950 font-black text-xs tracking-wider uppercase rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  Close & Continue
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FULLSCREEN IMMERSIVE PREVIEW OVERLAY */}
      <AnimatePresence>
        {isFullscreenPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 bg-[#020205] flex items-center justify-center overflow-hidden"
            id="fullscreen-preview-overlay"
          >
            {/* Ambient blurred backdrop background */}
            {options.backgroundImageUrl ? (
              <div 
                className="absolute inset-0 opacity-20 pointer-events-none z-0 filter blur-3xl bg-cover bg-center scale-110"
                style={{
                  backgroundImage: `url(${options.backgroundImageUrl})`
                }}
              />
            ) : (
              <div 
                className="absolute inset-0 opacity-20 pointer-events-none z-0 filter blur-3xl transition-all duration-1000 animate-pulse"
                style={{
                  background: `radial-gradient(circle at 50% 50%, ${activeColorPreset.primary} 0%, ${activeColorPreset.secondary} 40%, transparent 80%)`
                }}
              />
            )}

            {/* LIVE EXPORT RECORDING STATUS BADGE */}
            {isRecording && (
              <div className="absolute top-5 left-5 flex items-center space-x-2 bg-red-600 text-white px-3 py-1 rounded-full font-mono text-[10px] tracking-widest font-black animate-pulse z-20 shadow-lg border border-red-500/50">
                <span className="w-2 h-2 rounded-full bg-white block animate-ping" />
                <span>RECORDING LIVE Visuals</span>
              </div>
            )}

            {/* Aspect-Ratio constrained viewport container */}
            <div className={`relative overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.9)] border-2 border-cyan-500/50 flex items-center justify-center bg-[#030306] z-10 transition-all duration-300 ${
              options.aspectRatio === '1:1'
                ? 'w-[90vw] h-[90vw] max-w-[80vh] max-h-[80vh] aspect-square rounded-2xl'
                : options.aspectRatio === '16:9'
                  ? 'w-[95vw] h-[53.43vw] max-w-[85vw] max-h-[80vh] aspect-[16/9] rounded-2xl'
                  : 'w-[56.25vh] h-[95dvh] max-w-[95vw] max-h-[95vh] aspect-[9/16] rounded-2xl'
            }`} id="fullscreen-ratio-viewport">

              {/* Viewfinder Corner Framing Guides (Aspect Ratio Overlay) */}
              <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-cyan-400/80 pointer-events-none z-10 rounded-tl-sm" />
              <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-cyan-400/80 pointer-events-none z-10 rounded-tr-sm" />
              <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-cyan-400/80 pointer-events-none z-10 rounded-bl-sm" />
              <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-cyan-400/80 pointer-events-none z-10 rounded-br-sm" />
              
              {/* Visualizer Canvas confined inside the ratio viewport */}
              <div className="absolute inset-0 w-full h-full z-0">
                <VisualizerCanvas
                  analyserNode={analyserNode}
                  audioContext={audioContext}
                  options={options}
                  onStatsChange={setStats}
                  isPlaying={isPlaying}
                />
              </div>

              {/* SPINNING LP ALBUM ARTWORK DISC INSIDE THE ASPECT-RATIO PREVIEW VIEW */}
              {false && (
                <div 
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[160px] h-[160px] rounded-full flex items-center justify-center pointer-events-none z-10 animate-fade-in"
                  id="fullscreen-spinning-disc"
                >
                  <div 
                    className="absolute inset-0 rounded-full transition-transform duration-150"
                    style={{
                      transform: `scale(${1 + (stats.volume * 0.35)})`,
                      background: `radial-gradient(circle, ${activeColorPreset.primary}25 0%, transparent 75%)`
                    }}
                  />
                  <div 
                    className="relative w-[130px] h-[130px] rounded-full bg-zinc-950 border-3 border-zinc-850/80 shadow-[0_0_35px_rgba(0,0,0,0.8)] flex items-center justify-center overflow-hidden"
                    style={{
                      animation: isPlaying ? 'spin 10s linear infinite' : 'none',
                      boxShadow: stats.isTransient ? `0 0 30px ${activeColorPreset.primary}70` : 'none'
                    }}
                  >
                    {options.centerImageUrl ? (
                      <>
                        <img 
                          src={options.centerImageUrl} 
                          alt="Center artwork" 
                          className="absolute inset-0 w-full h-full object-cover rounded-full" 
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 rounded-full border border-white/5 opacity-30 pointer-events-none" />
                        <div className="absolute inset-4 rounded-full border border-white/5 opacity-25 pointer-events-none" />
                        <div className="absolute inset-8 rounded-full border border-white/5 opacity-15 pointer-events-none" />
                        <div className="absolute w-4 h-4 rounded-full bg-black border border-zinc-800/60 z-20 shadow-inner" />
                      </>
                    ) : (
                      <>
                        <div className="absolute inset-4 rounded-full border border-zinc-900 opacity-60" />
                        <div className="absolute inset-8 rounded-full border border-zinc-900 opacity-40" />
                        <div className="absolute inset-12 rounded-full border border-zinc-900 opacity-30" />
                        <div className="w-[45px] h-[45px] rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center relative overflow-hidden z-20">
                          {options.audioSource === 'microphone' ? (
                            <div className="w-full h-full bg-purple-600 flex items-center justify-center animate-ping">
                              <Mic className="w-5 text-white" />
                            </div>
                          ) : (
                            <div className="w-full h-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center">
                              <Music className="w-5 text-white" />
                            </div>
                          )}
                          <div className="absolute w-3 h-3 rounded-full bg-black border border-zinc-850" />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* TOP NAVIGATION BAR FOR PREVIEW (Single top-right close/minimize button) */}
            <div className="absolute top-5 right-5 flex items-center z-30 pointer-events-auto">
              <button
                onClick={() => setIsFullscreenPreview(false)}
                className="p-2.5 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 hover:border-zinc-500 text-pink-400 hover:text-pink-300 transition-all cursor-pointer shadow-xl backdrop-blur-md flex items-center justify-center active:scale-95"
                title="Exit Fullscreen Preview"
                id="btn-preview-exit"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* REWARDED ADMOB / SPONSOR ADS MODAL */}
      <AdModal
        isOpen={adModalConfig.isOpen}
        title={adModalConfig.title}
        description={adModalConfig.description}
        totalAdsRequired={adModalConfig.totalAdsRequired}
        rewardType={adModalConfig.rewardType}
        targetItemName={adModalConfig.pendingPreset?.name}
        directPlay={adModalConfig.directPlay}
        onClose={() => {
          setAdModalConfig(prev => ({ ...prev, isOpen: false }));
        }}
        onAdCompleted={() => {
          setAdModalConfig(prev => ({ ...prev, isOpen: false }));
          if (adModalConfig.pendingAction) {
            adModalConfig.pendingAction();
          }
        }}
        onOpenPremium={() => {
          setAdModalConfig(prev => ({ ...prev, isOpen: false }));
          setShowPremiumModal(true);
        }}
      />

      {/* VIP PASS MONTHLY PLAN MODAL (₹99 / Month) */}
      <PremiumPlansModal
        isOpen={showPremiumModal}
        currentUser={currentUser}
        onRequestLogin={() => {
          setIsVipAuthFlow(true);
          setShowAuthModal(true);
        }}
        onClose={() => setShowPremiumModal(false)}
        onActivateSuccess={() => {
          const updated = activatePremiumMonthly();
          setMonetization(updated);
        }}
      />

      {/* FIREBASE AUTHENTICATION & LOGIN MODAL */}
      <AuthModal
        isOpen={showAuthModal}
        isVipFlow={isVipAuthFlow}
        onClose={() => setShowAuthModal(false)}
        onSuccess={(profile) => {
          setCurrentUser(profile);
          if (profile.isVIP) {
            setMonetization(prev => ({
              ...prev,
              isPremium: true,
              premiumExpiryDate: profile.vipPurchasedAt || new Date().toISOString()
            }));
          }
        }}
      />

    </div>
  );
}
