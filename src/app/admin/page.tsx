'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Plus,
  Upload,
  Trash2,
  Film,
  KeyRound,
  Sparkles,
  Play,
  Copy,
  Check,
  AlertCircle,
  Folder,
  HelpCircle,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import AdminSettingsModal from '@/components/AdminSettingsModal';
import { R2MovieFile } from '@/lib/r2';

interface RoomItem {
  code: string;
  title: string;
  videoUrl: string;
  createdAt: string;
  createdBy: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminEmail, setAdminEmail] = useState('admin@admin.com');

  // Room Creation state
  const [roomTitle, setRoomTitle] = useState('');
  const [selectedMovieUrl, setSelectedMovieUrl] = useState('');
  const [customVideoUrl, setCustomVideoUrl] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  // Cloudflare R2 movies list & upload
  const [movieFiles, setMovieFiles] = useState<R2MovieFile[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');
  const [showCorsGuide, setShowCorsGuide] = useState(false);

  // Active rooms & settings modal
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [statusError, setStatusError] = useState('');

  useEffect(() => {
    // Authenticate admin session
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          setIsAdmin(true);
          setAdminEmail(data.email);
          loadMoviesList();
          loadRoomsList();
        } else {
          setIsAdmin(false);
        }
      })
      .catch(() => setIsAdmin(false));
  }, []);

  const loadMoviesList = async () => {
    try {
      const res = await fetch('/api/movies/list');
      const data = await res.json();
      if (data.movies) {
        setMovieFiles(data.movies);
        if (data.movies.length > 0 && !selectedMovieUrl) {
          setSelectedMovieUrl(data.movies[0].url);
        }
      }
    } catch {
      // fallback
    }
  };

  const loadRoomsList = async () => {
    try {
      const res = await fetch('/api/rooms/list');
      const data = await res.json();
      if (data.rooms) {
        setRooms(data.rooms);
      }
    } catch {
      // fallback
    }
  };

  // Upload video to Cloudflare R2 (handles files up to 2GB+)
  const handleUploadMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setIsUploading(true);
    setUploadProgress(5);
    const fileSizeMB = (uploadFile.size / (1024 * 1024)).toFixed(1);
    setUploadMessage(`Generating presigned Cloudflare R2 upload URL for ${uploadFile.name} (${fileSizeMB} MB)...`);

    try {
      // Step 1: Request presigned upload URL from server API
      const initRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: uploadFile.name,
          contentType: uploadFile.type || 'video/mp4',
        }),
      });

      const responseText = await initRes.text();
      let initData: { uploadUrl?: string; publicUrl?: string; error?: string } = {};

      try {
        initData = JSON.parse(responseText);
      } catch {
        if (responseText.includes('Request Entity Too Large') || initRes.status === 413) {
          throw new Error('File exceeds Next.js server payload limit. Please use rclone or enable CORS on R2 bucket "stream".');
        }
        throw new Error('Server returned invalid response. Check R2 credentials.');
      }

      if (!initRes.ok) {
        throw new Error(initData.error || 'Presigned URL generation failed');
      }

      if (!initData.uploadUrl) {
        throw new Error('No presigned URL returned from server');
      }

      setUploadProgress(15);
      setUploadMessage(`Uploading ${fileSizeMB} MB directly to Cloudflare R2 storage...`);

      // Step 2: Direct browser PUT upload to Cloudflare R2 presigned S3 URL
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', initData.uploadUrl!, true);
        xhr.setRequestHeader('Content-Type', uploadFile.type || 'video/mp4');

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 85) + 15;
            setUploadProgress(percent);
            const loadedMB = (event.loaded / (1024 * 1024)).toFixed(1);
            setUploadMessage(`Uploaded ${loadedMB} MB of ${fileSizeMB} MB (${percent}%)...`);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`R2 upload status ${xhr.status}. Make sure CORS is allowed on R2 bucket "stream".`));
          }
        };

        xhr.onerror = () => {
          reject(new Error('Browser blocked upload due to Cloudflare R2 CORS. Click "CORS Guide" below or use rclone command.'));
        };

        xhr.send(uploadFile);
      });

      setUploadProgress(100);
      setUploadMessage('Upload completed successfully! Movie added to Cloudflare R2.');
      setUploadFile(null);
      await loadMoviesList();
      if (initData.publicUrl) {
        setSelectedMovieUrl(initData.publicUrl);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setUploadMessage(`Error: ${msg}`);
      if (msg.includes('CORS') || msg.includes('blocked')) {
        setShowCorsGuide(true);
      }
    } finally {
      setIsUploading(false);
    }
  };

  // Delete movie file from Cloudflare R2 `movies` folder
  const handleDeleteMovie = async (key: string) => {
    if (!confirm('Are you sure you want to delete this movie file from Cloudflare R2?')) return;

    try {
      const res = await fetch('/api/movies/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });

      if (res.ok) {
        await loadMoviesList();
      } else {
        alert('Failed to delete movie file');
      }
    } catch {
      alert('Error deleting movie file');
    }
  };

  // Create room with unique 6-digit number and selected movie from drop-down
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusError('');
    setIsCreatingRoom(true);

    const videoUrlToUse = customVideoUrl.trim() || selectedMovieUrl;

    if (!videoUrlToUse) {
      setStatusError('Please select a movie or enter a custom video URL');
      setIsCreatingRoom(false);
      return;
    }

    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: roomTitle.trim() || 'Movie Room',
          videoUrl: videoUrlToUse,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatusError(data.error || 'Failed to create room');
      } else {
        setRoomTitle('');
        setCustomVideoUrl('');
        await loadRoomsList();
        router.push(`/room/${data.room.code}`);
      }
    } catch {
      setStatusError('Error creating room');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        <div className="flex items-center space-x-3">
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span>Verifying Admin Session...</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full glass-card rounded-2xl p-8 border border-white/10 shadow-2xl relative space-y-6">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-purple-600/30 border border-purple-500/40 text-purple-300">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-100">Admin Login</h2>
                <p className="text-xs text-slate-400">Sign in to manage rooms & video assets</p>
              </div>
            </div>

            {statusError && (
              <div className="flex items-center space-x-2 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{statusError}</span>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setStatusError('');
                const form = e.target as HTMLFormElement;
                const email = (form.elements.namedItem('email') as HTMLInputElement).value;
                const password = (form.elements.namedItem('password') as HTMLInputElement).value;

                try {
                  const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email.trim(), password }),
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    setStatusError(data.error || 'Invalid credentials');
                  } else {
                    setIsAdmin(true);
                    setAdminEmail(data.email);
                    loadMoviesList();
                    loadRoomsList();
                  }
                } catch {
                  setStatusError('Authentication failed');
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">
                  Admin Email
                </label>
                <input
                  name="email"
                  type="email"
                  placeholder="Enter admin email"
                  className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">
                  Password
                </label>
                <input
                  name="password"
                  type="password"
                  placeholder="Enter password"
                  className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs py-3 rounded-xl shadow-lg transition-all"
              >
                Sign In as Admin
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {/* Admin Header */}
        <div className="flex items-center justify-between p-6 rounded-2xl glass-panel border border-white/10">
          <div className="flex items-center space-x-4">
            <div className="relative w-14 h-14 rounded-2xl overflow-hidden shadow-xl shadow-purple-500/20">
              <Image src="/logo.png" alt="Logo" fill className="object-cover" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold text-slate-100">Admin Control Panel</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-950 border border-purple-500/40 text-purple-300 text-xs font-semibold">
                  ADMIN
                </span>
              </div>
              <p className="text-xs text-slate-400">Logged in as: {adminEmail}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl border border-slate-700 transition-all"
            >
              <KeyRound className="w-4 h-4 text-purple-400" />
              <span>Change Credentials</span>
            </button>
          </div>
        </div>

        {/* 2-Column Grid: Create Room & Upload Movies */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Column 1: Create Watch Party Room */}
          <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-6">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-purple-600/30 border border-purple-500/40 text-purple-300">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-100">Create New Room</h2>
                <p className="text-xs text-slate-400">Auto-generates unique 6-digit room number</p>
              </div>
            </div>

            {statusError && (
              <div className="flex items-center space-x-2 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4" />
                <span>{statusError}</span>
              </div>
            )}

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">
                  Room Title
                </label>
                <input
                  type="text"
                  value={roomTitle}
                  onChange={(e) => setRoomTitle(e.target.value)}
                  placeholder="e.g. Siccin 4 Movie Night"
                  className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              {/* Movie Dropdown Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">
                  Select Movie from Cloudflare R2 bucket
                </label>
                <select
                  value={selectedMovieUrl}
                  onChange={(e) => setSelectedMovieUrl(e.target.value)}
                  className="w-full bg-slate-900/90 border border-purple-500/40 rounded-xl px-4 py-2.5 text-xs text-purple-200 focus:outline-none focus:border-purple-500 font-medium"
                >
                  {movieFiles.length === 0 ? (
                    <option value="">No movies found in Cloudflare R2 bucket</option>
                  ) : (
                    movieFiles.map((m) => (
                      <option key={m.url} value={m.url}>
                        🎬 {m.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Custom Video URL Fallback */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">
                  OR Custom Video Stream URL (Optional)
                </label>
                <input
                  type="url"
                  value={customVideoUrl}
                  onChange={(e) => setCustomVideoUrl(e.target.value)}
                  placeholder="https://pub-dde59808cc1047d79e1e16a58f627c57.r2.dev/movies/custom.mp4"
                  className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <button
                type="submit"
                disabled={isCreatingRoom}
                className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs py-3.5 rounded-xl shadow-lg shadow-purple-900/50 transition-all disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isCreatingRoom ? 'Creating Room...' : 'Create Room & Get 6-Digit Code'}</span>
              </button>
            </form>
          </div>

          {/* Column 2: Cloudflare R2 Movie Uploader */}
          <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-cyan-600/30 border border-cyan-500/40 text-cyan-300">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-100">Cloudflare R2 Uploader</h2>
                  <p className="text-xs text-slate-400">Upload large movies to bucket <code className="text-cyan-300 font-mono">stream</code></p>
                </div>
              </div>

              <button
                onClick={() => setShowCorsGuide(!showCorsGuide)}
                className="flex items-center space-x-1 text-xs text-cyan-400 hover:text-cyan-300 p-1"
                title="R2 CORS Guide"
              >
                <HelpCircle className="w-4 h-4" />
                <span>CORS Help</span>
              </button>
            </div>

            {/* Quick rclone command helper box */}
            <div className="p-3 rounded-xl bg-slate-900/90 border border-purple-500/30 text-xs text-slate-300 space-y-1">
              <span className="font-bold text-purple-300 block">⚡ Fast CLI Upload (Recommended for 800MB–2GB+):</span>
              <code className="block p-2 rounded-lg bg-black/60 font-mono text-[11px] text-cyan-300 overflow-x-auto select-all">
                rclone copy &quot;[Qfilm.tv].Siccin.4.2017.WEB-DL.720p.mp4&quot; r2:stream/movies/ -P
              </code>
            </div>

            {showCorsGuide && (
              <div className="p-4 rounded-xl bg-purple-950/80 border border-purple-500/40 text-xs text-purple-200 space-y-2">
                <h4 className="font-bold text-purple-300">How to enable Browser Uploads in Cloudflare R2:</h4>
                <ol className="list-decimal list-inside space-y-1 text-[11px]">
                  <li>Open Cloudflare Dashboard ➔ R2 ➔ Bucket <code className="font-mono text-cyan-300">stream</code></li>
                  <li>Click <strong>Settings</strong> ➔ Scroll to <strong>CORS Policy</strong></li>
                  <li>Add Allowed Origins: <code className="font-mono text-cyan-300">*</code> and Allowed Methods: <code className="font-mono text-cyan-300">PUT, GET, HEAD</code></li>
                </ol>
              </div>
            )}

            <form onSubmit={handleUploadMovie} className="space-y-4">
              <div className="border-2 border-dashed border-slate-700 hover:border-purple-500 rounded-2xl p-6 text-center transition-colors">
                <Folder className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="r2-file-input"
                />
                <label
                  htmlFor="r2-file-input"
                  className="cursor-pointer text-xs font-semibold text-purple-400 hover:text-purple-300 block"
                >
                  {uploadFile ? `${uploadFile.name} (${(uploadFile.size / (1024 * 1024)).toFixed(1)} MB)` : 'Click to select movie file'}
                </label>
                <p className="text-[10px] text-slate-500 mt-1">Supports MP4, MKV, WebM video files</p>
              </div>

              {uploadMessage && (
                <div className="text-xs text-cyan-300 p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-500/30 break-words">
                  {uploadMessage}
                </div>
              )}

              {isUploading && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-400 h-full transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!uploadFile || isUploading}
                className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-cyan-600 text-white font-bold text-xs py-3 rounded-xl transition-all disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                <span>{isUploading ? 'Uploading to R2...' : 'Upload Movie to R2'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Cloudflare R2 Movies Folder Manager */}
        <section className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Film className="w-5 h-5 text-purple-400" />
              <h3 className="text-base font-bold text-slate-100">
                Cloudflare R2 Bucket Movies ({movieFiles.length})
              </h3>
            </div>
          </div>

          <div className="divide-y divide-slate-800/80">
            {movieFiles.map((m) => (
              <div key={m.key} className="py-3 flex items-center justify-between">
                <div className="flex items-center space-x-3 min-w-0">
                  <span className="text-lg">🎬</span>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-slate-200 block truncate">
                      {m.name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block truncate">
                      {m.url}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleDeleteMovie(m.key)}
                    className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/60 rounded-lg transition-colors"
                    title="Delete movie file from Cloudflare R2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Existing Active Rooms Table */}
        <section className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
          <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
            <span>Active Watch Rooms</span>
            <span className="px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 text-xs font-mono">
              {rooms.length}
            </span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map((r) => (
              <div
                key={r.code}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-mono font-bold text-purple-300 block">
                    #{r.code}
                  </span>
                  <span className="text-xs font-bold text-slate-200 block truncate max-w-[150px]">
                    {r.title}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => copyCode(r.code)}
                    className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
                    title="Copy Code"
                  >
                    {copiedCode === r.code ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <Link
                    href={`/room/${r.code}`}
                    className="p-2 text-purple-400 hover:text-purple-300 hover:bg-purple-950/60 rounded-lg"
                    title="Enter Room"
                  >
                    <Play className="w-4 h-4 fill-current" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Change Credentials Modal */}
      <AdminSettingsModal
        isOpen={isSettingsOpen}
        currentEmail={adminEmail}
        onClose={() => setIsSettingsOpen(false)}
        onUpdated={(newEmail) => setAdminEmail(newEmail)}
      />
    </div>
  );
}
