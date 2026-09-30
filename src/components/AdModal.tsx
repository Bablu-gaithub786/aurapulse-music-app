import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Sparkles, X, CheckCircle, ShieldCheck, Crown, Film, Volume2, VolumeX, AlertCircle } from 'lucide-react';

export interface AdModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  totalAdsRequired: number;
  rewardType: 'unlock_effect' | 'export_video' | 'change_song';
  targetItemName?: string;
  directPlay?: boolean;
  onAdCompleted: () => void;
  onOpenPremium: () => void;
  onClose: () => void;
}

const SAMPLE_ADS = [
  {
    sponsor: "Vivo V40 Pro 5G",
    tagline: "Zeiss Cinematic Portrait Camera with Aura Light",
    cta: "Explore Now",
    bgGradient: "from-blue-900 via-indigo-950 to-black",
    badge: "Official Sponsor",
    themeColor: "#00f0ff",
    duration: 5,
  },
  {
    sponsor: "Spotify Premium",
    tagline: "3 Months Free Ad-Free Music & Offline Listening",
    cta: "Claim Offer",
    bgGradient: "from-emerald-950 via-zinc-950 to-black",
    badge: "Music Partner",
    themeColor: "#1db954",
    duration: 5,
  },
  {
    sponsor: "AuraPulse Pro VIP",
    tagline: "Remove all ads, unlock all 4K exports & Vivo dynamic effects forever!",
    cta: "Upgrade ₹99/mo",
    bgGradient: "from-amber-950 via-zinc-950 to-black",
    badge: "VIP Upgrade",
    themeColor: "#f59e0b",
    duration: 4,
  }
];

export default function AdModal({
  isOpen,
  title,
  description,
  totalAdsRequired,
  rewardType,
  targetItemName,
  directPlay,
  onAdCompleted,
  onOpenPremium,
  onClose
}: AdModalProps) {
  const isAutoAd = directPlay !== undefined ? directPlay : (rewardType === 'export_video' || rewardType === 'change_song');
  const [isWatchingAd, setIsWatchingAd] = useState(isAutoAd);
  const [completedCount, setCompletedCount] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(5);
  const [progressPercent, setProgressPercent] = useState(0);

  const activeAd = SAMPLE_ADS[completedCount % SAMPLE_ADS.length];
  const adStartTimeRef = useRef<number>(0);
  const completedRef = useRef(completedCount);
  completedRef.current = completedCount;

  // Initialize or reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setCompletedCount(0);
      completedRef.current = 0;
      if (isAutoAd) {
        setIsWatchingAd(true);
        adStartTimeRef.current = Date.now();
        setSecondsRemaining(SAMPLE_ADS[0].duration);
        setProgressPercent(0);
      } else {
        setIsWatchingAd(false);
        setSecondsRemaining(SAMPLE_ADS[0].duration);
        setProgressPercent(0);
      }
    }
  }, [isOpen, isAutoAd]);

  // Timestamp-based accurate progress loop: works even if screen was turned off or tab went to sleep!
  useEffect(() => {
    if (!isOpen || !isWatchingAd) return;

    const adTotalMs = activeAd.duration * 1000;
    if (adStartTimeRef.current === 0) {
      adStartTimeRef.current = Date.now();
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - adStartTimeRef.current;
      const pct = Math.min(100, (elapsed / adTotalMs) * 100);
      const remaining = Math.max(0, Math.ceil((adTotalMs - elapsed) / 1000));

      setProgressPercent(pct);
      setSecondsRemaining(remaining);

      if (elapsed >= adTotalMs) {
        clearInterval(interval);
        const nextCompleted = completedRef.current + 1;
        setCompletedCount(nextCompleted);
        completedRef.current = nextCompleted;

        if (nextCompleted >= totalAdsRequired) {
          setIsWatchingAd(false);
          setTimeout(() => {
            onAdCompleted();
          }, 350);
        } else {
          if (isAutoAd) {
            // Next ad
            adStartTimeRef.current = Date.now();
            const nextAd = SAMPLE_ADS[nextCompleted % SAMPLE_ADS.length];
            setSecondsRemaining(nextAd.duration);
            setProgressPercent(0);
          } else {
            setIsWatchingAd(false);
          }
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen, isWatchingAd, completedCount, activeAd.duration, totalAdsRequired, isAutoAd, onAdCompleted]);

  const handleStartWatchAd = () => {
    adStartTimeRef.current = Date.now();
    const nextAd = SAMPLE_ADS[completedCount % SAMPLE_ADS.length];
    setSecondsRemaining(nextAd.duration);
    setProgressPercent(0);
    setIsWatchingAd(true);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-md bg-[#0e0e13] border border-zinc-700/80 rounded-2xl p-5 sm:p-6 shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden text-white"
        >
          {/* Subtle Ambient Top Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-12 bg-gradient-to-b from-cyan-500/20 to-transparent blur-xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer z-30"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {!isWatchingAd ? (
            /* ================= VIEW 1: PROMPT TO WATCH AD OR UPGRADE VIP ================= */
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
                {rewardType === 'unlock_effect' ? (
                  <Sparkles className="w-7 h-7" />
                ) : (
                  <Film className="w-7 h-7" />
                )}
              </div>

              <div>
                <h3 className="text-lg font-bold text-white tracking-wide">
                  {title}
                </h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto leading-relaxed">
                  {description}
                </p>
              </div>

              {/* Ads Progress Indicator */}
              <div className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-left">
                  <Film className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-zinc-200 block">
                      Watch Video Ads ({completedCount}/{totalAdsRequired})
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {totalAdsRequired - completedCount} more required to unlock
                    </span>
                  </div>
                </div>

                <div className="flex space-x-1">
                  {Array.from({ length: totalAdsRequired }).map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-3 h-3 rounded-full border transition-all ${
                        idx < completedCount
                          ? 'bg-cyan-400 border-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.8)]'
                          : 'bg-zinc-800 border-zinc-600'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* ACTION 1: WATCH AD BUTTON */}
              <button
                onClick={handleStartWatchAd}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 flex items-center justify-center space-x-2 transition-all cursor-pointer transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>
                  {completedCount === 0 ? "Watch Short Ad (5s)" : `Watch Ad ${completedCount + 1} of ${totalAdsRequired}`}
                </span>
              </button>

              <div className="relative w-full flex items-center justify-center my-1">
                <div className="w-full border-t border-zinc-800" />
                <span className="absolute bg-[#0e0e13] px-2 text-[10px] uppercase font-mono text-zinc-500">
                  OR NO ADS WITH VIP
                </span>
              </div>

              {/* ACTION 2: UPGRADE TO VIP PREMIUM */}
              <button
                onClick={() => {
                  onClose();
                  onOpenPremium();
                }}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-500/25 to-yellow-500/15 border border-amber-500/50 hover:border-amber-400 text-amber-300 font-bold text-xs flex items-center justify-between transition-all cursor-pointer group"
              >
                <div className="flex items-center space-x-2">
                  <Crown className="w-4 h-4 text-amber-400 group-hover:rotate-12 transition-transform" />
                  <span>Get VIP Pass (No Ads)</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-amber-400 text-black font-black text-[10px]">
                  ₹99 / Month
                </span>
              </button>
            </div>
          ) : (
            /* ================= VIEW 2: ACTIVE AD SIMULATION / PLAYBACK ================= */
            <div className={`rounded-xl bg-gradient-to-b ${activeAd.bgGradient} p-5 border border-zinc-700/80 flex flex-col items-center text-center space-y-4`}>
              {/* Ad Header */}
              <div className="w-full flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-white/10 text-[9px] uppercase font-mono tracking-widest text-zinc-300 border border-white/10">
                  {activeAd.badge} • Ad {completedCount + 1} of {totalAdsRequired}
                </span>

                <div className="px-2.5 py-0.5 rounded-full bg-black/60 border border-zinc-600 text-xs font-mono font-bold text-cyan-400 flex items-center space-x-1">
                  <span>Ad ends in {secondsRemaining}s</span>
                </div>
              </div>

              {/* Ad Animated Graphic Frame */}
              <div className="w-full h-36 rounded-xl bg-black/50 border border-white/10 flex flex-col items-center justify-center p-4 relative overflow-hidden">
                <div 
                  className="absolute inset-0 opacity-20 animate-pulse"
                  style={{
                    background: `radial-gradient(circle, ${activeAd.themeColor} 0%, transparent 70%)`
                  }}
                />

                <div className="relative z-10 flex flex-col items-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                    <Sparkles className="w-6 h-6" style={{ color: activeAd.themeColor }} />
                  </div>
                  <h4 className="text-base font-bold text-white tracking-wide">
                    {activeAd.sponsor}
                  </h4>
                  <p className="text-[11px] text-zinc-300 max-w-xs text-center font-normal">
                    {activeAd.tagline}
                  </p>
                </div>
              </div>

              {/* Real-time Countdown Progress Bar (Timestamp Synced) */}
              <div className="w-full h-2 bg-zinc-850 rounded-full overflow-hidden border border-zinc-700/60 p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full transition-all duration-100 ease-linear shadow-[0_0_10px_rgba(6,182,212,0.8)]"
                  style={{
                    width: `${progressPercent}%`
                  }}
                />
              </div>

              <div className="w-full flex items-center justify-between pt-0.5 text-[10px] text-zinc-400 font-mono">
                <span>Auto-unlocking in {secondsRemaining}s...</span>
                <button
                  onClick={() => {
                    onClose();
                    onOpenPremium();
                  }}
                  className="text-amber-400 hover:text-amber-300 font-bold flex items-center space-x-1 cursor-pointer transition-colors"
                >
                  <Crown className="w-3 h-3 text-amber-400" />
                  <span>VIP Skip Ads</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
