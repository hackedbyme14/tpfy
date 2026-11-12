// lib/api.js

const SEARCH_ENDPOINT = "https://saavn.dev/api/search/songs";

/**
 * Decode common HTML entities that Saavn's API leaves in track/artist names.
 */
export function decodeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * Pick the best available artwork URL from Saavn's `image` array.
 * Saavn typically returns three qualities ([0]=low, [1]=medium, [2]=high).
 */
export function pickImageUrl(imageArr) {
  if (!Array.isArray(imageArr) || imageArr.length === 0) return "";
  return (
    imageArr[2]?.url ||
    imageArr[imageArr.length - 1]?.url ||
    imageArr[0]?.url ||
    ""
  );
}

/**
 * Pick the best available stream URL from Saavn's `downloadUrl` array.
 * Index 4 is typically the highest bitrate; fall back to the last entry.
 */
export function pickStreamUrl(downloadUrlArr) {
  if (!Array.isArray(downloadUrlArr) || downloadUrlArr.length === 0) return "";
  return (
    downloadUrlArr[4]?.url ||
    downloadUrlArr[downloadUrlArr.length - 1]?.url ||
    downloadUrlArr[0]?.url ||
    ""
  );
}

/**
 * Normalize one raw Saavn song object into the shape the UI expects.
 * Returns null when no playable stream URL can be resolved, so callers
 * can filter out unplayable results.
 */
export function normalizeTrack(raw) {
  try {
    const streamUrl = pickStreamUrl(raw?.downloadUrl);
    if (!streamUrl) return null;

    const artists =
      raw?.artists?.primary
        ?.map((a) => a?.name)
        .filter(Boolean)
        .join(", ") ||
      raw?.primaryArtists ||
      raw?.artist ||
      "Unknown Artist";

    return {
      id: raw?.id ?? streamUrl,
      name: decodeHtml(raw?.name || raw?.title || "Untitled Track"),
      artist: decodeHtml(artists),
      image: pickImageUrl(raw?.image),
      duration: Number(raw?.duration) || 0,
      streamUrl,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch and normalize search results from the Saavn API.
 * Always returns an array (empty on failure) — never throws to the caller
 * unless `throwOnError` is explicitly set to true.
 *
 * @param {string} query - search term
 * @param {object} [options]
 * @param {number} [options.limit=20] - max results
 * @param {boolean} [options.throwOnError=false]
 * @returns {Promise<Array>}
 */
export async function searchSongs(query, options = {}) {
  const { limit = 20, throwOnError = false } = options;
  const trimmed = (query || "").trim();
  if (!trimmed) return [];

  try {
    const url = `${SEARCH_ENDPOINT}?query=${encodeURIComponent(trimmed)}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Saavn API request failed (${res.status})`);

    const json = await res.json();
    const rawSongs = json?.data?.results || [];

    return rawSongs.map(normalizeTrack).filter((track) => track !== null);
  } catch (err) {
    if (throwOnError) throw err;
    return [];
  }
}

/**
 * Format a duration in seconds as "m:ss". Used by both the grid and the
 * player bar for consistent time display.
 */
export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
