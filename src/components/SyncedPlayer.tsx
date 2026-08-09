'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Radio,
  Tv,
  Film,
  Sparkles,
} from 'lucide-react';

export interface ReactionItem {
  id: string;
  user: { name: string; avatar: string };
  emoji: string;
}

interface SyncedPlayerProps {
  videoUrl: string;
  videoTitle?: string;
  roomId: string;
  isPlaying: boolean;
  currentTime: number;
  reactions?: ReactionItem[];
  onPlay: (time: number) => void;
  onPause: (time: number) => void;
  onSeek: (time: number) => void;
}

export default function SyncedPlayer({
  videoUrl,
  videoTitle = 'Cloudflare R2 Stream',
  roomId,
  isPlaying,
  currentTime,
  reactions = [],
  onPlay,
  onPause,
  onSeek,
}: SyncedPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [localIsPlaying, setLocalIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTheater, setIsTheater] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing'>('synced');

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Restore saved seek position from localStorage if room load starts
  useEffect(() => {
    if (!roomId) return;
    const savedSeekKey = `watch_seek_${roomId}`;
    const savedTime = localStorage.getItem(savedSeekKey);

    if (savedTime && videoRef.current) {
      const parsedTime = parseFloat(savedTime);
      if (!isNaN(parsedTime) && parsedTime > 0) {
        // If server initial currentTime is 0, initialize with saved seek position
        if (currentTime === 0 && videoRef.current.currentTime === 0) {
          videoRef.current.currentTime = parsedTime;
          setProgress(parsedTime);
          onSeek(parsedTime);
        }
      }
    }
  }, [roomId]);

  // Save seek position to localStorage on tab unload / website close
  useEffect(() => {
    const saveCurrentSeek = () => {
      if (videoRef.current && roomId) {
        localStorage.setItem(`watch_seek_${roomId}`, videoRef.current.currentTime.toString());
      }
    };

    window.addEventListener('beforeunload', saveCurrentSeek);
    window.addEventListener('pagehide', saveCurrentSeek);

    return () => {
      saveCurrentSeek();
      window.removeEventListener('beforeunload', saveCurrentSeek);
      window.removeEventListener('pagehide', saveCurrentSeek);
    };
  }, [roomId]);

  // Sync Video Element state with prop updates
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Play/Pause sync
    if (isPlaying && video.paused) {
      video.play().catch(() => {});
      setLocalIsPlaying(true);
    } else if (!isPlaying && !video.paused) {
      video.pause();
      setLocalIsPlaying(false);
    }

    // Drift correction check (if drift > 1.5s)
    if (typeof currentTime === 'number' && Number.isFinite(currentTime)) {
      const drift = Math.abs(video.currentTime - currentTime);
      if (drift > 1.5) {
        setSyncStatus('syncing');
        video.currentTime = currentTime;
        setTimeout(() => setSyncStatus('synced'), 800);
      }
    }
  }, [isPlaying, currentTime]);

  const handleTogglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      onPlay(video.currentTime);
    } else {
      onPause(video.currentTime);
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    const video = videoRef.current;
    if (video) {
      video.currentTime = targetTime;
      setProgress(targetTime);
      localStorage.setItem(`watch_seek_${roomId}`, targetTime.toString());
      onSeek(targetTime);
    }
  };

  const handleSkip = (seconds: number) => {
    const video = videoRef.current;
    if (video) {
      const newTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
      video.currentTime = newTime;
      localStorage.setItem(`watch_seek_${roomId}`, newTime.toString());
      onSeek(newTime);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      setIsMuted(newVol === 0);
    }
  };

  const handleToggleMute = () => {
    if (videoRef.current) {
      const nextMute = !isMuted;
      setIsMuted(nextMute);
      videoRef.current.muted = nextMute;
    }
  };

  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return '00:00';
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = Math.floor(secs % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (localIsPlaying) {
        setShowControls(false);
      }
    }, 3500);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`relative group overflow-hidden bg-black shadow-2xl transition-all duration-300 ${
        isTheater ? 'w-full h-[82vh] rounded-none' : 'w-full aspect-video rounded-2xl border border-white/10'
      }`}
    >
      {/* HTML5 Video Element */}
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-contain cursor-pointer"
        onClick={handleTogglePlay}
        onTimeUpdate={() => {
          if (videoRef.current) {
            const curTime = videoRef.current.currentTime;
            setProgress(curTime);
            // Save seek periodically every 5 seconds
            if (Math.floor(curTime) % 5 === 0) {
              localStorage.setItem(`watch_seek_${roomId}`, curTime.toString());
            }
          }
        }}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration);
            // Check if saved seek exists
            const savedTime = localStorage.getItem(`watch_seek_${roomId}`);
            if (savedTime) {
              const pTime = parseFloat(savedTime);
              if (!isNaN(pTime) && pTime > 0 && pTime < videoRef.current.duration) {
                videoRef.current.currentTime = pTime;
                setProgress(pTime);
              }
            }
          }
        }}
        playsInline
      />

      {/* Floating Reaction Animations Overlay */}
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
        {reactions.map((r) => (
          <div
            key={r.id}
            className="absolute bottom-20 flex flex-col items-center animate-float-up"
            style={{
              left: `${15 + Math.random() * 70}%`,
            }}
          >
            <span className="text-4xl filter drop-shadow-lg mb-1">{r.emoji}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/70 text-slate-200 border border-white/20">
              {r.user.name}
            </span>
          </div>
        ))}
      </div>

      {/* Header Info Overlay */}
      <div
        className={`absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between z-20 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-purple-600/30 border border-purple-500/40 text-purple-300">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 max-w-md truncate">{videoTitle}</h2>
            <p className="text-[11px] text-slate-400">Cloudflare R2 Direct Stream</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Sync Status Badge */}
          <div
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              syncStatus === 'synced'
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                syncStatus === 'synced' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
              }`}
            />
            <span>{syncStatus === 'synced' ? 'SYNCED' : 'ALIGNING...'}</span>
          </div>
        </div>
      </div>

      {/* Player Control Bar Overlay */}
      <div
        className={`absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-20 transition-opacity duration-300 ${
          showControls || !localIsPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Timeline Slider */}
        <div className="mb-3 flex items-center space-x-3">
          <span className="text-xs font-mono text-slate-300 min-w-[50px]">{formatTime(progress)}</span>
          <div className="relative flex-1 group/slider">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={progress}
              onChange={handleSeekChange}
              className="w-full h-1.5 bg-slate-700/80 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:h-2.5 transition-all"
            />
          </div>
          <span className="text-xs font-mono text-slate-400 min-w-[50px]">{formatTime(duration)}</span>
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Play/Pause */}
            <button
              onClick={handleTogglePlay}
              className="p-2.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:scale-105 text-white shadow-lg shadow-purple-900/50 transition-transform"
              title={localIsPlaying ? 'Pause (Synced)' : 'Play (Synced)'}
            >
              {localIsPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            {/* Skip -10s */}
            <button
              onClick={() => handleSkip(-10)}
              className="p-2 text-slate-300 hover:text-white transition-colors"
              title="Skip -10s"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Skip +10s */}
            <button
              onClick={() => handleSkip(10)}
              className="p-2 text-slate-300 hover:text-white transition-colors"
              title="Skip +10s"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Volume */}
            <div className="flex items-center space-x-2 group/vol">
              <button onClick={handleToggleMute} className="p-2 text-slate-300 hover:text-white transition-colors">
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-400"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Speed selector */}
            <select
              value={playbackRate}
              onChange={(e) => handlePlaybackRateChange(parseFloat(e.target.value))}
              className="bg-slate-900/80 border border-slate-700 text-xs text-slate-200 rounded-lg px-2 py-1 focus:outline-none"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1.0x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2.0x</option>
            </select>

            {/* Theater Mode */}
            <button
              onClick={() => setIsTheater(!isTheater)}
              className={`p-2 rounded-lg transition-colors ${
                isTheater ? 'text-purple-400 bg-purple-950/60' : 'text-slate-300 hover:text-white'
              }`}
              title="Theater Mode"
            >
              <Tv className="w-4 h-4" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={handleToggleFullscreen}
              className="p-2 text-slate-300 hover:text-white transition-colors"
              title="Fullscreen"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
