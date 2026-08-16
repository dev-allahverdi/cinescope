/* ==========================================================================
   CineScope — application state
   --------------------------------------------------------------------------
   Three concerns live here, all of them persistent or shared:
     • the watchlist ("My List"), backed by localStorage
     • the theme preference, backed by localStorage
     • the genre lookup table, fetched once per session

   Storage is treated as hostile input: it is user-writable, survives across
   versions of this app, and may contain anything. Every read validates.
   ========================================================================== */

(function (global) {
  "use strict";

  var CONFIG = global.CineScopeConfig;

  /* ------------------------------------------------------ tiny event bus */

  var listeners = {};

  function on(event, handler) {
    (listeners[event] = listeners[event] || []).push(handler);
  }

  function off(event, handler) {
    var bucket = listeners[event];
    if (!bucket) return;
    var index = bucket.indexOf(handler);
    if (index !== -1) bucket.splice(index, 1);
  }

  function emit(event, payload) {
    (listeners[event] || []).forEach(function (handler) {
      try {
        handler(payload);
      } catch (err) {
        // A broken subscriber must not take down the dispatch loop.
        console.error("[cinescope] listener failed for " + event, err);
      }
    });
  }

  /* ------------------------------------------------------ safe storage */

  function readRaw(key) {
    try {
      return global.localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function writeRaw(key, value) {
    try {
      global.localStorage.setItem(key, value);
      return true;
    } catch (err) {
      // Quota exceeded or storage disabled — the app stays usable, the change
      // just doesn't survive a reload.
      console.warn("[cinescope] could not persist " + key, err);
      return false;
    }
  }

  /* ---------------------------------------------------------- watchlist */

  /**
   * Only the fields needed to rebuild a card without another API call.
   * Anything else is re-fetched from the movie detail endpoint on demand.
   */
  function toEntry(movie) {
    return {
      id: Number(movie.id),
      title: String(movie.title || "Untitled"),
      posterPath: typeof movie.posterPath === "string" ? movie.posterPath : "",
      year: String(movie.year || ""),
      rating: Number(movie.rating) || 0,
      genreIds: Array.isArray(movie.genreIds)
        ? movie.genreIds.map(Number).filter(Number.isFinite).slice(0, 4)
        : [],
      addedAt: Number(movie.addedAt) || Date.now()
    };
  }

  function isValidEntry(entry) {
    return (
      entry &&
      typeof entry === "object" &&
      Number.isFinite(Number(entry.id)) &&
      Number(entry.id) > 0
    );
  }

  var watchlist = [];
  var watchlistIds = new Set();

  /**
   * Reads and repairs the stored list. A corrupted blob is discarded rather
   * than thrown at the user; partially corrupted entries are dropped
   * individually so one bad record can't wipe a whole list.
   */
  function loadWatchlist() {
    var raw = readRaw(CONFIG.watchlistKey);
    if (!raw) {
      watchlist = [];
      watchlistIds = new Set();
      return;
    }

    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.warn("[cinescope] my-list was unreadable and has been reset");
      watchlist = [];
      watchlistIds = new Set();
      persistWatchlist();
      return;
    }

    if (!Array.isArray(parsed)) {
      watchlist = [];
      watchlistIds = new Set();
      persistWatchlist();
      return;
    }

    var seen = new Set();
    var cleaned = [];

    parsed.forEach(function (entry) {
      if (!isValidEntry(entry)) return;
      var normalised = toEntry(entry);
      if (seen.has(normalised.id)) return;
      seen.add(normalised.id);
      cleaned.push(normalised);
    });

    watchlist = cleaned;
    watchlistIds = seen;

    // Rewrite whenever normalising changed anything — dropped records, but
    // also coerced field types within a surviving record.
    if (JSON.stringify(cleaned) !== raw) persistWatchlist();
  }

  function persistWatchlist() {
    writeRaw(CONFIG.watchlistKey, JSON.stringify(watchlist));
  }

  function getWatchlist() {
    // Newest first — matches the "saved for later" reading order.
    return watchlist.slice().sort(function (a, b) {
      return b.addedAt - a.addedAt;
    });
  }

  function isSaved(id) {
    return watchlistIds.has(Number(id));
  }

  function addToWatchlist(movie) {
    var entry = toEntry(movie);
    if (!isValidEntry(entry) || watchlistIds.has(entry.id)) return false;

    watchlist.push(entry);
    watchlistIds.add(entry.id);
    persistWatchlist();
    emit("watchlist:change", { id: entry.id, saved: true, title: entry.title });
    return true;
  }

  function removeFromWatchlist(id) {
    var numericId = Number(id);
    if (!watchlistIds.has(numericId)) return false;

    var removed = watchlist.find(function (entry) {
      return entry.id === numericId;
    });

    watchlist = watchlist.filter(function (entry) {
      return entry.id !== numericId;
    });
    watchlistIds.delete(numericId);
    persistWatchlist();
    emit("watchlist:change", {
      id: numericId,
      saved: false,
      title: removed ? removed.title : ""
    });
    return true;
  }

  /** @returns {boolean} the state *after* toggling. */
  function toggleWatchlist(movie) {
    if (isSaved(movie.id)) {
      removeFromWatchlist(movie.id);
      return false;
    }
    addToWatchlist(movie);
    return true;
  }

  /* -------------------------------------------------------------- theme */

  function getTheme() {
    var stored = readRaw(CONFIG.themeKey);
    if (stored === "light" || stored === "dark") return stored;
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function setTheme(theme) {
    var next = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    writeRaw(CONFIG.themeKey, next);
    emit("theme:change", next);
    return next;
  }

  function toggleTheme() {
    return setTheme(getTheme() === "dark" ? "light" : "dark");
  }

  /* ------------------------------------------------------------- genres */

  var genreList = null;
  var genreMap = new Map();
  var genrePromise = null;

  /** Fetched at most once per session; every caller shares the same promise. */
  function loadGenres() {
    if (genreList) return Promise.resolve(genreList);
    if (genrePromise) return genrePromise;

    genrePromise = global.CineScopeApi.genres()
      .then(function (list) {
        genreList = list;
        genreMap = new Map(
          list.map(function (genre) {
            return [genre.id, genre.name];
          })
        );
        return genreList;
      })
      .catch(function (err) {
        // Genre names are decoration, not content — a failure here must not
        // break a page that otherwise loaded fine.
        genrePromise = null;
        throw err;
      });

    return genrePromise;
  }

  function genreName(id) {
    return genreMap.get(Number(id)) || "";
  }

  function genreNames(ids, limit) {
    if (!Array.isArray(ids)) return [];
    return ids
      .map(genreName)
      .filter(Boolean)
      .slice(0, limit || 2);
  }

  function getGenres() {
    return genreList || [];
  }

  /* ------------------------------------------------------------- export */

  loadWatchlist();

  global.CineScopeStore = {
    on: on,
    off: off,
    emit: emit,

    getWatchlist: getWatchlist,
    isSaved: isSaved,
    addToWatchlist: addToWatchlist,
    removeFromWatchlist: removeFromWatchlist,
    toggleWatchlist: toggleWatchlist,
    watchlistCount: function () {
      return watchlist.length;
    },

    getTheme: getTheme,
    setTheme: setTheme,
    toggleTheme: toggleTheme,

    loadGenres: loadGenres,
    getGenres: getGenres,
    genreName: genreName,
    genreNames: genreNames
  };
})(window);
