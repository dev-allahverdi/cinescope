/* ==========================================================================
   CineScope — configuration
   --------------------------------------------------------------------------
   THIS IS THE ONLY PLACE A CREDENTIAL BELONGS.

   CineScope is a static front-end. There is no backend, so any key it uses is
   delivered to the browser and is readable by anyone who opens devtools. That
   is a property of static sites, not a bug to be worked around — a TMDB v3 API
   key is a *public, browser-safe* identifier scoped to read-only endpoints.
   Do not treat it as a secret, do not commit a real one to a public repo, and
   do not build a proxy purely to hide it.

   Two supported ways to supply the key (see README.md → Configuration):

   1. Runtime override — RECOMMENDED, and the only one with zero repo
      footprint. Run this once in the browser console on the running site:

        localStorage.setItem("cinescope:tmdb_key", "YOUR_KEY");
        location.reload();

      The key lives in your browser only. Nothing to edit, nothing to commit,
      nothing to accidentally push.

   2. Edit the placeholder below — convenient for a private local checkout.
      Replace YOUR_TMDB_API_KEY with a real key. If you do this, DO NOT commit
      the change:  git update-index --skip-worktree js/config.js

   The placeholder string is treated as "not configured", so an untouched
   checkout shows the setup message instead of firing broken requests.

   Get a free key: https://www.themoviedb.org/settings/api
   ========================================================================== */

(function (global) {
  "use strict";

  /**
   * ┌──────────────────────────────────────────────────────────────────────┐
   * │  THE ONE LINE TO CHANGE.  Leave as-is to use the localStorage route.  │
   * └──────────────────────────────────────────────────────────────────────┘
   */
  var TMDB_API_KEY = "YOUR_TMDB_API_KEY";

  /** Anything in here is a placeholder, not a credential. */
  var PLACEHOLDERS = ["", "YOUR_TMDB_API_KEY", "YOUR_KEY", "REPLACE_ME"];

  var STORAGE_KEY = "cinescope:tmdb_key";

  function isPlaceholder(value) {
    return PLACEHOLDERS.indexOf(String(value || "").trim()) !== -1;
  }

  function readOverride() {
    try {
      var value = global.localStorage.getItem(STORAGE_KEY);
      return typeof value === "string" ? value.trim() : "";
    } catch (err) {
      // Private mode / storage disabled — fall back to the literal above.
      return "";
    }
  }

  var CONFIG = {
    /** TMDB REST base. v3 endpoints, api_key query auth. */
    apiBase: "https://api.themoviedb.org/3",

    /** TMDB image CDN. Sizes are picked per use-site, never "original" in a grid. */
    imageBase: "https://image.tmdb.org/t/p",

    /** Poster/backdrop/profile widths actually used by the UI. */
    imageSizes: {
      posterCard: "w342",
      posterLarge: "w500",
      backdropHero: "w1280",
      backdropSmall: "w780",
      profile: "w185"
    },

    /** TMDB serves English metadata by default; change to localise the app. */
    language: "en-US",

    /** How long GET responses stay in the in-memory cache (ms). */
    cacheTtl: 5 * 60 * 1000,

    /** Abandon a request after this long so the UI never hangs. */
    requestTimeout: 12000,

    /** localStorage key holding the user's saved movies. */
    watchlistKey: "cinescope:my-list",

    /** localStorage key holding the chosen theme. */
    themeKey: "cinescope:theme",

    /**
     * Resolved at call time so a console override takes effect immediately.
     * The localStorage value wins over the literal above.
     */
    getApiKey: function () {
      var override = readOverride();
      if (!isPlaceholder(override)) return override;
      if (!isPlaceholder(TMDB_API_KEY)) return String(TMDB_API_KEY).trim();
      return "";
    },

    hasApiKey: function () {
      return this.getApiKey().length > 0;
    },

    keyStorageKey: STORAGE_KEY
  };

  global.CineScopeConfig = CONFIG;
})(window);
