// components/PlayerBar.jsx
"use client";

import { useState, useEffect, useRef } from "react";
import { formatTime } from "../lib/api";

export default function PlayerBar({ queue, currentIndex, setCurrentIndex, onPlayingChange }) {
  const audioRef = useRef(null);
  const playNextRef = useRef(() => {});

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const currentTrack =
    currentIndex >= 0 && currentIndex < queue.length ? queue[currentIndex] : null;

  // Create the single Audio instance once, client-side only.
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.volume = 1;
    audioRef.current = audio;

    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onPlay = () => {
      setIsPlaying(true);
      setIsBuffering(false);
    };
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);
    const onEnded = () => {
      setIsPlaying(false);
      playNextRef.current();
    };
    const onError = () => {
      setIsBuffering(false);
      setIsPlaying(false);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.pause();
      audio.src = "";
    };
  }, []);

  // Notify the parent whenever play state changes (drives the grid's equalizer icon).
  useEffect(() => {
    onPlayingChange?.(isPlaying);
  }, [isPlaying, onPlayingChange]);

  // Load and play whenever the active track changes.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    setIsBuffering(true);
    setCurrentTime(0);
    setDuration(currentTrack.duration || 0);
    audio.src = currentTrack.streamUrl;
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        setIsBuffering(false);
        setIsPlaying(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id]);

  const playNext = () => {
    if (queue.length === 0) return;
    const nextIdx = currentIndex + 1 < queue.length ? currentIndex + 1 : 0;
    setCurrentIndex(nextIdx);
  };

  const playPrevious = () => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    if (queue.length === 0) return;
    const prevIdx = currentIndex - 1 >= 0 ? currentIndex - 1 : queue.length - 1;
    setCurrentIndex(prevIdx);
  };

  // Keep ref current so the 'ended' listener (bound once at mount) always
  // calls the latest playNext, which closes over the latest queue/index.
  useEffect(() => {
    playNextRef.current = playNext;
  });

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (audio.paused) {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          setIsBuffering(false);
          setIsPlaying(false);
        });
      }
    } else {
      audio.pause();
    }
  };

  const seekToRatio = (ratio) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const clamped = Math.min(Math.max(ratio, 0), 1);
    audio.currentTime = clamped * audio.duration;
    setCurrentTime(audio.currentTime);
  };

  const handleVolume = (vol) => {
    const clamped = Math.min(Math.max(vol, 0), 1);
    setVolume(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
  };

  if (!currentTrack) return null;

  const progressRatio = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/5 bg-[#1B2333]/95 shadow-player backdrop-blur">
      {/* Top-edge progress scrubber */}
      <input
        type="range"
        min={0}
        max={1}
        step={0.0001}
        value={progressRatio}
        onChange={(e) => seekToRatio(Number(e.target.value))}
        className="player-scrubber block h-1.5 w-full cursor-pointer appearance-none bg-transparent"
        style={{
          background: `linear-gradient(to right, #E8A33D ${progressRatio * 100}%, #2A3348 ${
            progressRatio * 100
          }%)`,
        }}
      />

      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
        {/* Track info */}
        <div className="flex min-w-0 items-center gap-3 sm:w-64">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[#121826]">
            {currentTrack.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentTrack.image}
                alt={currentTrack.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl text-slate-600">
                ♪
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-100">
              {currentTrack.name}
            </p>
            <p className="truncate text-xs text-slate-400">{currentTrack.artist}</p>
          </div>
        </div>

        {/* Transport controls */}
        <div className="flex flex-1 items-center justify-center gap-5">
          <button
            onClick={playPrevious}
            aria-label="Previous"
            className="flex h-11 w-11 items-center justify-center rounded-full text-slate-300 transition active:scale-90 hover:text-white"
          >
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          <button
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E8A33D] text-[#121826] shadow-lg transition active:scale-90"
          >
            {isBuffering ? (
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#121826]/30 border-t-[#121826]" />
            ) : isPlaying ? (
              <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
              </svg>
            ) : (
              <svg className="h-7 w-7 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button
            onClick={playNext}
            aria-label="Next"
            className="flex h-11 w-11 items-center justify-center rounded-full text-slate-300 transition active:scale-90 hover:text-white"
          >
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 6h2v12h-2zM4.5 6v12l8.5-6z" />
            </svg>
          </button>
        </div>

        {/* Time + volume */}
        <div className="flex items-center gap-3 sm:w-56 sm:justify-end">
          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-400">
            {formatTime(currentTime)}
          </span>
          <span className="text-xs text-slate-600">/</span>
          <span className="w-10 shrink-0 text-xs tabular-nums text-slate-400">
            {formatTime(duration)}
          </span>

          <svg className="h-5 w-5 shrink-0 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2A4.5 4.5 0 0015 7.97v8.05A4.48 4.48 0 0016.5 12z" />
          </svg>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => handleVolume(Number(e.target.value))}
            className="volume-slider h-1.5 w-20 cursor-pointer appearance-none bg-transparent"
            style={{
              background: `linear-gradient(to right, #E8A33D ${volume * 100}%, #2A3348 ${
                volume * 100
              }%)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
