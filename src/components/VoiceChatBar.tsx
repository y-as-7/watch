'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Volume2,
  VolumeX,
  Radio,
  Users,
  AlertCircle,
} from 'lucide-react';
import type { IAgoraRTCClient, IMicrophoneAudioTrack, IRemoteAudioTrack } from 'agora-rtc-sdk-ng';

interface VoiceChatBarProps {
  roomCode: string;
  userId?: string;
  userName?: string;
}

export default function VoiceChatBar({ roomCode, userId = 'guest', userName = 'Guest' }: VoiceChatBarProps) {
  const [isInVoice, setIsInVoice] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [voiceVolume, setVoiceVolume] = useState(1);
  const [isMutedOutput, setIsMutedOutput] = useState(false);
  const [activeSpeakers, setActiveSpeakers] = useState<Set<string>>(new Set());
  const [remoteUserCount, setRemoteUserCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const agoraClientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const remoteTracksRef = useRef<Map<string, IRemoteAudioTrack>>(new Map());

  // Clean up on component unmount AND website/tab close
  useEffect(() => {
    const handleWebsiteCloseVoiceDisconnect = () => {
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }
      if (agoraClientRef.current) {
        agoraClientRef.current.leave().catch(() => {});
        agoraClientRef.current = null;
      }
    };

    window.addEventListener('beforeunload', handleWebsiteCloseVoiceDisconnect);
    window.addEventListener('pagehide', handleWebsiteCloseVoiceDisconnect);

    return () => {
      handleWebsiteCloseVoiceDisconnect();
      window.removeEventListener('beforeunload', handleWebsiteCloseVoiceDisconnect);
      window.removeEventListener('pagehide', handleWebsiteCloseVoiceDisconnect);
    };
  }, []);

  const handleJoinVoice = async () => {
    setIsConnecting(true);
    setErrorMsg(null);

    try {
      // Dynamically import Agora SDK client-side only
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;

      // Create Agora RTC client
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      agoraClientRef.current = client;

      // Enable volume indicator (checks every 200ms)
      client.enableAudioVolumeIndicator();

      // Listen for volume indicators (speaking activity)
      client.on('volume-indicator', (volumes) => {
        const speaking = new Set<string>();
        volumes.forEach((v) => {
          if (v.level > 5) {
            speaking.add(String(v.uid));
          }
        });
        setActiveSpeakers(speaking);
      });

      // Listen for remote users publishing audio
      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === 'audio' && user.audioTrack) {
          user.audioTrack.play();
          user.audioTrack.setVolume(Math.floor(voiceVolume * 100));
          remoteTracksRef.current.set(String(user.uid), user.audioTrack);
          setRemoteUserCount(client.remoteUsers.length);
        }
      });

      // Listen for remote users unpublishing
      client.on('user-unpublished', (user, mediaType) => {
        if (mediaType === 'audio') {
          remoteTracksRef.current.delete(String(user.uid));
          setRemoteUserCount(client.remoteUsers.length);
        }
      });

      client.on('user-joined', () => {
        setRemoteUserCount(client.remoteUsers.length);
      });

      client.on('user-left', (user) => {
        remoteTracksRef.current.delete(String(user.uid));
        setRemoteUserCount(client.remoteUsers.length);
      });

      // Fetch RTC token from backend
      const res = await fetch(`/api/agora/token?channelName=${roomCode}&uid=${encodeURIComponent(userId)}`);
      const data = await res.json();

      if (!data.success || !data.token) {
        throw new Error(data.error || 'Failed to fetch Agora voice token');
      }

      // Join Agora RTC channel
      await client.join(data.appId, roomCode, data.token, userId);

      // Create local microphone audio track
      const localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        AEC: true, // Acoustic Echo Cancellation
        ANS: true, // Automatic Noise Suppression
        AGC: true, // Automatic Gain Control
      });
      localAudioTrackRef.current = localAudioTrack;

      // Publish local audio track
      await client.publish([localAudioTrack]);

      setIsInVoice(true);
      setIsMicMuted(false);
    } catch (err: any) {
      console.error('Failed to join voice chat:', err);
      setErrorMsg(err.message || 'Microphone access denied or connection failed');
      setIsInVoice(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLeaveVoice = async () => {
    try {
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }
      if (agoraClientRef.current) {
        await agoraClientRef.current.leave();
        agoraClientRef.current = null;
      }
    } catch (err) {
      console.error('Error leaving voice chat:', err);
    } finally {
      setIsInVoice(false);
      setIsMicMuted(false);
      setRemoteUserCount(0);
      setActiveSpeakers(new Set());
    }
  };

  const handleToggleMic = async () => {
    if (!localAudioTrackRef.current) return;
    try {
      const nextMuted = !isMicMuted;
      await localAudioTrackRef.current.setEnabled(!nextMuted);
      setIsMicMuted(nextMuted);
    } catch (err) {
      console.error('Failed to toggle mic:', err);
    }
  };

  const handleOutputVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVoiceVolume(val);
    const volPercent = Math.floor((isMutedOutput ? 0 : val) * 100);
    remoteTracksRef.current.forEach((track) => {
      try {
        track.setVolume(volPercent);
      } catch {
        // quiet catch
      }
    });
  };

  const handleToggleMuteOutput = () => {
    const nextMute = !isMutedOutput;
    setIsMutedOutput(nextMute);
    const volPercent = Math.floor((nextMute ? 0 : voiceVolume) * 100);
    remoteTracksRef.current.forEach((track) => {
      try {
        track.setVolume(volPercent);
      } catch {
        // quiet catch
      }
    });
  };

  return (
    <div className="glass-card rounded-2xl p-3 border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
      {/* Left: Status & Active Speakers */}
      <div className="flex items-center space-x-3">
        <div
          className={`p-2 rounded-xl border flex items-center justify-center transition-all ${
            isInVoice
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
              : 'bg-slate-900 border-white/10 text-slate-400'
          }`}
        >
          <Radio className={`w-4 h-4 ${isInVoice ? 'animate-pulse text-emerald-400' : ''}`} />
        </div>

        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-200">Agora Voice Room</span>
            {isInVoice ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 border border-emerald-500/40 text-emerald-300 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>CONNECTED ({remoteUserCount + 1})</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400">
                OFFLINE
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            {isInVoice
              ? activeSpeakers.size > 0
                ? 'Someone is speaking...'
                : `${remoteUserCount} guest${remoteUserCount === 1 ? '' : 's'} in call`
              : 'Join voice to talk with friends'}
          </p>
        </div>
      </div>

      {/* Center/Right: Action Buttons */}
      <div className="flex items-center space-x-2">
        {errorMsg && (
          <div className="hidden sm:flex items-center space-x-1 text-rose-400 text-[11px]">
            <AlertCircle className="w-3.5 h-3.5" />
            <span className="truncate max-w-[150px]">{errorMsg}</span>
          </div>
        )}

        {isInVoice ? (
          <>
            {/* Mic Toggle Button */}
            <button
              onClick={handleToggleMic}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl font-bold transition-all border ${
                isMicMuted
                  ? 'bg-rose-950/80 border-rose-500/50 text-rose-300 hover:bg-rose-900'
                  : 'bg-slate-800 border-white/10 text-emerald-400 hover:bg-slate-700'
              }`}
              title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 animate-bounce" />}
              <span className="hidden xs:inline">{isMicMuted ? 'Muted' : 'Mic On'}</span>
            </button>

            {/* Voice Volume Control */}
            <div className="hidden md:flex items-center space-x-1 px-2 py-1 rounded-xl bg-slate-900/80 border border-white/10">
              <button onClick={handleToggleMuteOutput} className="text-slate-400 hover:text-white p-1">
                {isMutedOutput || voiceVolume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMutedOutput ? 0 : voiceVolume}
                onChange={handleOutputVolumeChange}
                className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                title="Voice Chat Output Volume"
              />
            </div>

            {/* Leave Call Button */}
            <button
              onClick={handleLeaveVoice}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-900/30 transition-all"
            >
              <PhoneOff className="w-4 h-4" />
              <span>Leave</span>
            </button>
          </>
        ) : (
          /* Join Call Button */
          <button
            onClick={handleJoinVoice}
            disabled={isConnecting}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-900/30 transition-all disabled:opacity-50"
          >
            <Phone className="w-4 h-4" />
            <span>{isConnecting ? 'Connecting...' : 'Join Voice Call'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
