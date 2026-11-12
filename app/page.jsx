"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ----------------------------- Inline Icons ----------------------------- */
const IconPlay = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M8 5v14l11-7z" />
  </svg>
);
const IconPause = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
  </svg>
);
const IconNext = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M6 5l10 7-10 7V5zM18 5h2v14h-2z" />
  </svg>
);
const IconPrev = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18 5L8 12l10 7V5zM4 5h2v14H4z" />
  </svg>
);
const IconSearch = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </svg>
);
const IconLoader = ({ className = "w-5 h-5 animate-spin" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M12 2a10 10 0 1 0 10 10" strokeLinecap="round" />
  </svg>
);
const IconMusicNote = ({ className = "w-8 h-8" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

/* ----------------------------- Equalizer bars ---------------------------- */
function EqualizerBars() {
  return (
    <div className="flex items-end gap-[2px] h-4">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[3px] bg-[#E8A33D] rounded-sm animate-eq"
          style={{
            animationDelay: `${i * 0.15}s`,
            height: "100%",
          }}
        />
      ))}
      <style jsx>{`
        @keyframes eq {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
        .animate-eq {
          animation: eq 0.9s ease-in-out infinite;
          transform-origin: bottom;
        }
      `}</style>
    </div>
  );
}

/* ------------------------------- Helpers --------------------------------- */
function formatTime(sec) {
  if (!sec || isNaN(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function bestQualityUrl(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  // saavn.dev returns ascending quality order; pick the last (highest) with a valid url
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] && arr[i].url) return arr[i].url;
  }
  return null;
}

function parseSong(raw) {
  try {
    const title = raw?.name || raw?.title || "Unknown Title";
    const primaryArtists =
      raw?.artists?.primary?.map((a) => a.name).filter(Boolean).join(", ") ||
      raw?.artists?.all?.map((a) => a.name).filter(Boolean).join(", ") ||
      raw?.primaryArtists ||
      "Unknown Artist";
    const image = bestQualityUrl(raw?.image) || raw?.image || null;
    const streamUrl = bestQualityUrl(raw?.downloadUrl);
    const duration = Number(raw?.duration) || 0;

    if (!streamUrl) return null;

    return {
      id: raw?.id || `${title}-${Math.random().toString(36).slice(2)}`,
      title,
      artist: primaryArtists,
      image,
      streamUrl,
      duration,
    };
  } catch {
    return null;
  }
}

const GENRE_CHIPS = [
  "Malayalam hits",
  "Tamil love songs",
  "Vineeth Sreenivasan",
  "Ilaiyaraaja",
  "AR Rahman",
];

const DEFAULT_QUERY = "Malayalam hits";

// Multiple mirrors of the same unofficial JioSaavn API shape.
// If one is down/rate-limited/blocked, the next is tried automatically.
const API_BASES = [
  "https://saavn.dev/api/search/songs",
  "https://shnwazdev-jiosaavn-apii.vercel.app/api/search/songs",
];

async function fetchWithTimeout(url, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// Tries each API base in order; returns the first one that yields a
// successful response with at least one playable, parsed song.
async function fetchSongsWithFallback(q) {
  let lastError = null;

  for (const base of API_BASES) {
    try {
      const url = `${base}?query=${encodeURIComponent(q)}&limit=30`;
      const res = await fetchWithTimeout(url, 8000);

      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status} from ${base}`);
        continue;
      }

      let json;
      try {
        json = await res.json();
      } catch {
        lastError = new Error(`Bad JSON from ${base}`);
        continue;
      }

      const results =
        json?.data?.results || json?.data?.songs || json?.results || [];
      const parsed = results.map(parseSong).filter(Boolean);

      if (parsed.length > 0) {
        return { songs: parsed, error: null };
      }
      lastError = new Error(`No playable results from ${base}`);
    } catch (err) {
      lastError = err;
      // continue to next base (network error, timeout/abort, CORS, etc.)
    }
  }

  return { songs: [], error: lastError };
}

/* -------------------------------- Main App -------------------------------- */
export default function Page() {
  const [query, setQuery] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [currentIndex, setCurrentIndex] = useState(-1);
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef(null);
  const songsRef = useRef([]);
  const indexRef = useRef(-1);

  /* --------------------------- Init audio element -------------------------- */
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onEnded = () => handleNext(true);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => {
      setBuffering(false);
      setIsPlaying(true);
    };
    const onPause = () => setIsPlaying(false);
    const onError = () => {
      setBuffering(false);
      setErrorMsg("Playback error — skipping track.");
      handleNext(true);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
      audio.pause();
      audio.src = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    songsRef.current = songs;
  }, [songs]);

  useEffect(() => {
    indexRef.current = currentIndex;
  }, [currentIndex]);

  /* --------------------------------- Search -------------------------------- */
  const runSearch = useCallback(async (q) => {
    if (!q || !q.trim()) return;
    setLoading(true);
    setErrorMsg("");
    setQuery(q);

    const { songs: parsed, error } = await fetchSongsWithFallback(q);

    if (parsed.length > 0) {
      setSongs(parsed);
      setErrorMsg("");
    } else {
      setSongs([]);
      setErrorMsg(
        error
          ? "Couldn't load songs right now. The music service may be busy or temporarily unreachable."
          : "No playable results found for that search."
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    runSearch(DEFAULT_QUERY);
    setInputValue("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchSubmit = (e) => {
    e?.preventDefault?.();
    const q = inputValue.trim();
    if (q) {
      runSearch(q);
    }
  };

  const handleChipClick = (chip) => {
    setInputValue(chip);
    runSearch(chip);
  };

  const handleRetry = () => {
    runSearch(query || DEFAULT_QUERY);
  };

  /* ------------------------------- Playback -------------------------------- */
  const loadAndPlay = useCallback((song, index) => {
    const audio = audioRef.current;
    if (!audio || !song) return;
    setCurrentSong(song);
    setCurrentIndex(index);
    setCurrentTime(0);
    setDuration(song.duration || 0);
    setBuffering(true);
    audio.src = song.streamUrl;
    audio.currentTime = 0;
    audio
      .play()
      .then(() => {
        setIsPlaying(true);
        setBuffering(false);
      })
      .catch(() => {
        setIsPlaying(false);
        setBuffering(false);
        setErrorMsg("Tap play again — playback was blocked by the browser.");
      });
  }, []);

  const handleCardClick = (song, index) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (currentIndex === index && currentSong) {
      togglePlayPause();
      return;
    }
    loadAndPlay(song, index);
  };

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setErrorMsg("Playback blocked — tap play again."));
    }
  };

  const handleNext = useCallback(
    (auto = false) => {
      const list = songsRef.current;
      const idx = indexRef.current;
      if (!list || list.length === 0) return;
      const nextIdx = idx + 1 < list.length ? idx + 1 : 0;
      loadAndPlay(list[nextIdx], nextIdx);
    },
    [loadAndPlay]
  );

  const handlePrev = useCallback(() => {
    const list = songsRef.current;
    const idx = indexRef.current;
    if (!list || list.length === 0) return;
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const prevIdx = idx - 1 >= 0 ? idx - 1 : list.length - 1;
    loadAndPlay(list[prevIdx], prevIdx);
  }, [loadAndPlay]);

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const newTime = Number(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  /* --------------------------------- Render -------------------------------- */
  return (
    <div className="min-h-screen bg-[#121826] text-white flex flex-col">
      {/* Sticky Top Bar */}
      <header className="sticky top-0 z-20 bg-[#121826]/95 backdrop-blur border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 rounded-full bg-[#E8A33D] flex items-center justify-center text-[#121826]">
              <IconMusicNote className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold tracking-tight hidden sm:block">
              Hishamify
            </span>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <IconSearch className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Search songs, artists, movies..."
                className="w-full bg-[#1B2333] text-white placeholder-white/40 rounded-full pl-10 pr-4 py-3 outline-none ring-1 ring-white/5 focus:ring-[#E8A33D] transition text-base"
              />
            </div>
            <button
              type="submit"
              className="bg-[#E8A33D] text-[#121826] font-semibold px-5 py-3 rounded-full active:scale-95 transition shrink-0"
            >
              Search
            </button>
          </form>
        </div>

        {/* Genre / Artist Chips */}
        <div className="flex gap-2 overflow-x-auto mt-3 pb-1 no-scrollbar">
          {GENRE_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => handleChipClick(chip)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition active:scale-95 ${
                query === chip
                  ? "bg-[#E8A33D] text-[#121826]"
                  : "bg-[#1B2333] text-white/80 ring-1 ring-white/5"
              }`}
            >
              {chip}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-5 pb-40">
        {errorMsg && !loading && (
          <div className="mb-4 bg-[#1B2333] border border-[#E8A33D]/30 text-[#E8A33D] text-sm rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <span>{errorMsg}</span>
            <button
              onClick={handleRetry}
              className="shrink-0 bg-[#E8A33D] text-[#121826] font-semibold text-xs px-4 py-2 rounded-full active:scale-95 transition"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-white/60 gap-3">
            <IconLoader className="w-8 h-8 animate-spin text-[#E8A33D]" />
            <span>Loading tracks...</span>
          </div>
        ) : songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-white/40 gap-3 text-center px-4">
            <IconMusicNote className="w-10 h-10" />
            <span>
              {errorMsg || "No songs to show. Try a search above."}
            </span>
            <button
              onClick={handleRetry}
              className="mt-2 bg-[#E8A33D] text-[#121826] font-semibold text-sm px-5 py-2.5 rounded-full active:scale-95 transition"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {songs.map((song, index) => {
              const isActive = currentIndex === index;
              return (
                <button
                  key={song.id}
                  onClick={() => handleCardClick(song, index)}
                  className={`group relative bg-[#1B2333] rounded-2xl p-3 text-left transition active:scale-95 ring-1 ${
                    isActive
                      ? "ring-[#E8A33D] shadow-lg shadow-[#E8A33D]/10"
                      : "ring-white/5 hover:ring-white/15"
                  }`}
                >
                  <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-[#121826] mb-3">
                    {song.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={song.image}
                        alt={song.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/20">
                        <IconMusicNote className="w-10 h-10" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      {isActive && isPlaying ? (
                        <IconPause className="w-8 h-8 text-white" />
                      ) : (
                        <IconPlay className="w-8 h-8 text-white" />
                      )}
                    </div>
                    {isActive && (
                      <div className="absolute bottom-2 right-2 bg-[#121826]/80 rounded-full px-2 py-1">
                        {buffering ? (
                          <IconLoader className="w-4 h-4 text-[#E8A33D]" />
                        ) : isPlaying ? (
                          <EqualizerBars />
                        ) : null}
                      </div>
                    )}
                  </div>
                  <p
                    className={`text-sm font-semibold truncate ${
                      isActive ? "text-[#E8A33D]" : "text-white"
                    }`}
                  >
                    {song.title}
                  </p>
                  <p className="text-xs text-white/50 truncate mt-0.5">
                    {song.artist}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Fixed Bottom Player Bar */}
      {currentSong && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#1B2333] border-t border-white/5 shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
          {/* Progress bar */}
          <div className="px-4 pt-2 flex items-center gap-2">
            <span className="text-[11px] text-white/50 w-10 text-right tabular-nums">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step="0.1"
              value={Math.min(currentTime, duration || 0)}
              onChange={handleSeek}
              className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-[#E8A33D] bg-white/10"
              style={{
                background: duration
                  ? `linear-gradient(to right, #E8A33D ${
                      (currentTime / duration) * 100
                    }%, rgba(255,255,255,0.1) ${
                      (currentTime / duration) * 100
                    }%)`
                  : "rgba(255,255,255,0.1)",
              }}
            />
            <span className="text-[11px] text-white/50 w-10 tabular-nums">
              {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#121826] shrink-0">
              {currentSong.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentSong.image}
                  alt={currentSong.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/20">
                  <IconMusicNote className="w-5 h-5" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-white">
                {currentSong.title}
              </p>
              <p className="text-xs text-white/50 truncate">
                {currentSong.artist}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handlePrev}
                className="p-3 text-white/70 hover:text-white active:scale-90 transition"
                aria-label="Previous"
              >
                <IconPrev className="w-6 h-6" />
              </button>

              <button
                onClick={togglePlayPause}
                className="p-3 bg-[#E8A33D] rounded-full text-[#121826] active:scale-90 transition mx-1"
                aria-label="Play/Pause"
              >
                {buffering ? (
                  <IconLoader className="w-6 h-6" />
                ) : isPlaying ? (
                  <IconPause className="w-6 h-6" />
                ) : (
                  <IconPlay className="w-6 h-6" />
                )}
              </button>

              <button
                onClick={() => handleNext(false)}
                className="p-3 text-white/70 hover:text-white active:scale-90 transition"
                aria-label="Next"
              >
                <IconNext className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background: #e8a33d;
          cursor: pointer;
          border: 2px solid #1b2333;
        }
        input[type="range"]::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background: #e8a33d;
          cursor: pointer;
          border: 2px solid #1b2333;
        }
      `}</style>
    </div>
  );
}
