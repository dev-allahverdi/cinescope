/* ==========================================================================
   CineScope — TMDB client
   --------------------------------------------------------------------------
   Every network call in the app goes through request(). It is responsible for:
     • attaching the API key and language
     • de-duplicating identical in-flight requests
     • caching successful GETs for CONFIG.cacheTtl
     • timing out so the UI never hangs on a dead socket
     • translating any failure into an ApiError with a stable `kind`, so the
       view layer can render the right message without ever seeing raw
       TMDB output.
   ========================================================================== */

(function (global) {
  "use strict";

  var CONFIG = global.CineScopeConfig;

  /* ---------------------------------------------------------------- errors */

  /**
   * @param {string} kind  One of the ERROR_KINDS values.
   * @param {string} message  Developer-facing; never rendered verbatim.
   */
  function ApiError(kind, message) {
    this.name = "ApiError";
    this.kind = kind;
    this.message = message || kind;
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;

  var ERROR_KINDS = {
    MISSING_KEY: "missing-key",
    NETWORK: "network",
    TIMEOUT: "timeout",
    RATE_LIMIT: "rate-limit",
    AUTH: "auth",
    NOT_FOUND: "not-found",
    SERVER: "server",
    INVALID: "invalid-response"
  };

  /** User-facing copy. Raw API messages are deliberately never shown. */
  var ERROR_COPY = {
    "missing-key": {
      title: "API key required",
      body: "CineScope needs a TMDB API key to load movies. See the README for the one-line setup."
    },
    network: {
      title: "You appear to be offline",
      body: "We couldn't reach the movie service. Check your connection and try again."
    },
    timeout: {
      title: "That took too long",
      body: "The movie service didn't respond in time. Please try again."
    },
    "rate-limit": {
      title: "Too many requests",
      body: "We're being rate limited. Wait a few seconds and try again."
    },
    auth: {
      title: "API key rejected",
      body: "The configured TMDB key was refused. Double-check it in the README setup step."
    },
    "not-found": {
      title: "We couldn't find that",
      body: "This title isn't in the catalogue. It may have been removed."
    },
    server: {
      title: "The movie service is having trouble",
      body: "This is on TMDB's side, not yours. Please try again shortly."
    },
    "invalid-response": {
      title: "Something went wrong",
      body: "We received an unexpected response and couldn't display this page."
    }
  };

  function describeError(err) {
    var kind = err && err.kind && ERROR_COPY[err.kind] ? err.kind : "invalid-response";
    return ERROR_COPY[kind];
  }

  /* ---------------------------------------------------------------- cache */

  var cache = new Map();
  var inflight = new Map();

  function cacheGet(key) {
    var hit = cache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > CONFIG.cacheTtl) {
      cache.delete(key);
      return null;
    }
    return hit.value;
  }

  function cacheSet(key, value) {
    cache.set(key, { at: Date.now(), value: value });
  }

  /* -------------------------------------------------------------- request */

  function buildUrl(path, params) {
    var url = new URL(CONFIG.apiBase + path);
    url.searchParams.set("api_key", CONFIG.getApiKey());
    url.searchParams.set("language", CONFIG.language);

    Object.keys(params || {}).forEach(function (key) {
      var value = params[key];
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, String(value));
    });

    return url.toString();
  }

  function statusToKind(status) {
    if (status === 401 || status === 403) return ERROR_KINDS.AUTH;
    if (status === 404) return ERROR_KINDS.NOT_FOUND;
    if (status === 429) return ERROR_KINDS.RATE_LIMIT;
    if (status >= 500) return ERROR_KINDS.SERVER;
    return ERROR_KINDS.INVALID;
  }

  function request(path, params) {
    if (!CONFIG.hasApiKey()) {
      return Promise.reject(new ApiError(ERROR_KINDS.MISSING_KEY, "No TMDB key configured"));
    }

    var url = buildUrl(path, params);

    var cached = cacheGet(url);
    if (cached) return Promise.resolve(cached);

    // Identical concurrent calls share one network round-trip.
    var pending = inflight.get(url);
    if (pending) return pending;

    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
    }, CONFIG.requestTimeout);

    var promise = fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } })
      .catch(function (err) {
        // fetch() only rejects on network failure or abort.
        if (err && err.name === "AbortError") {
          throw new ApiError(ERROR_KINDS.TIMEOUT, "Request aborted after timeout");
        }
        throw new ApiError(ERROR_KINDS.NETWORK, "Network request failed");
      })
      .then(function (response) {
        if (!response.ok) {
          throw new ApiError(statusToKind(response.status), "HTTP " + response.status);
        }
        return response.json().catch(function () {
          throw new ApiError(ERROR_KINDS.INVALID, "Response was not valid JSON");
        });
      })
      .then(function (data) {
        if (!data || typeof data !== "object") {
          throw new ApiError(ERROR_KINDS.INVALID, "Response was not an object");
        }
        cacheSet(url, data);
        return data;
      })
      .finally(function () {
        clearTimeout(timer);
        inflight.delete(url);
      });

    inflight.set(url, promise);
    return promise;
  }

  /* ------------------------------------------------------------- normalise
     TMDB fields are optional far more often than its docs suggest. Everything
     downstream consumes these shapes, so a missing poster or a null title can
     never reach the render layer. */

  function toList(payload) {
    var results = payload && Array.isArray(payload.results) ? payload.results : [];
    return {
      items: results.filter(isRenderableMovie).map(normaliseMovie),
      page: Number(payload && payload.page) || 1,
      totalPages: Math.min(Number(payload && payload.total_pages) || 1, 500),
      totalResults: Number(payload && payload.total_results) || 0
    };
  }

  function isRenderableMovie(raw) {
    return !!raw && typeof raw === "object" && raw.id != null;
  }

  function normaliseMovie(raw) {
    var date = typeof raw.release_date === "string" ? raw.release_date : "";
    return {
      id: Number(raw.id),
      title: str(raw.title || raw.name) || "Untitled",
      overview: str(raw.overview),
      posterPath: str(raw.poster_path),
      backdropPath: str(raw.backdrop_path),
      releaseDate: date,
      year: date.slice(0, 4),
      rating: Number(raw.vote_average) || 0,
      voteCount: Number(raw.vote_count) || 0,
      genreIds: Array.isArray(raw.genre_ids) ? raw.genre_ids.map(Number) : []
    };
  }

  function normaliseDetail(raw) {
    var base = normaliseMovie(raw);

    base.tagline = str(raw.tagline);
    base.runtime = Number(raw.runtime) || 0;
    base.status = str(raw.status);
    base.budget = Number(raw.budget) || 0;
    base.revenue = Number(raw.revenue) || 0;
    base.homepage = str(raw.homepage);

    base.genres = Array.isArray(raw.genres)
      ? raw.genres
          .filter(function (g) { return g && g.id != null; })
          .map(function (g) { return { id: Number(g.id), name: str(g.name) || "Unknown" }; })
      : [];

    // The detail endpoint returns `genres` objects while list endpoints return
    // `genre_ids`. Backfill the ids so a movie saved to My List from its detail
    // page still carries genre tags on its card.
    if (!base.genreIds.length && base.genres.length) {
      base.genreIds = base.genres.map(function (g) { return g.id; });
    }

    base.companies = Array.isArray(raw.production_companies)
      ? raw.production_companies
          .map(function (c) { return str(c && c.name); })
          .filter(Boolean)
      : [];

    var credits = raw.credits || {};
    base.cast = Array.isArray(credits.cast)
      ? credits.cast.slice(0, 12).map(function (person) {
          return {
            id: Number(person.id) || 0,
            name: str(person.name) || "Unknown",
            character: str(person.character),
            profilePath: str(person.profile_path)
          };
        })
      : [];

    base.director = Array.isArray(credits.crew)
      ? (credits.crew.find(function (c) { return c && c.job === "Director"; }) || {}).name || ""
      : "";

    base.trailer = pickTrailer(raw.videos && raw.videos.results);
    base.similar = toList(raw.similar).items;

    return base;
  }

  /**
   * Picks the best YouTube trailer and returns only the video *key*.
   * The key is validated against a strict allowlist pattern before it is ever
   * used to build an embed URL, so a hostile `key` value cannot escape into
   * the iframe src.
   */
  function pickTrailer(videos) {
    if (!Array.isArray(videos)) return null;

    var usable = videos.filter(function (video) {
      return (
        video &&
        video.site === "YouTube" &&
        typeof video.key === "string" &&
        /^[A-Za-z0-9_-]{6,20}$/.test(video.key)
      );
    });

    if (!usable.length) return null;

    var byPreference = ["Trailer", "Teaser", "Clip", "Featurette"];
    for (var i = 0; i < byPreference.length; i += 1) {
      var match = usable.find(function (video) {
        return video.type === byPreference[i] && video.official;
      }) || usable.find(function (video) {
        return video.type === byPreference[i];
      });
      if (match) return { key: match.key, name: str(match.name) || "Trailer", type: match.type };
    }

    return { key: usable[0].key, name: str(usable[0].name) || "Trailer", type: usable[0].type || "Video" };
  }

  function str(value) {
    return typeof value === "string" ? value : "";
  }

  /* ------------------------------------------------------------- images */

  /**
   * TMDB image paths are always a single "/<hash>.<ext>" segment. Anything
   * else is refused rather than concatenated: an absolute or javascript: URL
   * would redirect the <img>, and "//host" or "/../.." would reshape the path
   * even though they stay on the TMDB origin.
   */
  var IMAGE_PATH = /^\/[A-Za-z0-9][A-Za-z0-9_-]*\.(jpg|jpeg|png|webp|svg)$/i;

  function imageUrl(path, size) {
    if (typeof path !== "string" || !IMAGE_PATH.test(path)) return "";
    return CONFIG.imageBase + "/" + encodeURIComponent(size) + path;
  }

  function posterUrl(movie, large) {
    return imageUrl(
      movie && movie.posterPath,
      large ? CONFIG.imageSizes.posterLarge : CONFIG.imageSizes.posterCard
    );
  }

  function backdropUrl(movie, small) {
    return imageUrl(
      movie && movie.backdropPath,
      small ? CONFIG.imageSizes.backdropSmall : CONFIG.imageSizes.backdropHero
    );
  }

  function profileUrl(person) {
    return imageUrl(person && person.profilePath, CONFIG.imageSizes.profile);
  }

  /* ---------------------------------------------------------- endpoints */

  var api = {
    ApiError: ApiError,
    ERROR_KINDS: ERROR_KINDS,
    describeError: describeError,

    imageUrl: imageUrl,
    posterUrl: posterUrl,
    backdropUrl: backdropUrl,
    profileUrl: profileUrl,

    trending: function (page) {
      return request("/trending/movie/week", { page: page || 1 }).then(toList);
    },

    popular: function (page) {
      return request("/movie/popular", { page: page || 1 }).then(toList);
    },

    topRated: function (page) {
      return request("/movie/top_rated", { page: page || 1 }).then(toList);
    },

    upcoming: function (page) {
      return request("/movie/upcoming", { page: page || 1 }).then(toList);
    },

    search: function (query, page) {
      return request("/search/movie", {
        query: query,
        page: page || 1,
        include_adult: "false"
      }).then(toList);
    },

    /**
     * @param {object} filters { genre, year, minRating, sort, page }
     */
    discover: function (filters) {
      var params = {
        page: (filters && filters.page) || 1,
        sort_by: (filters && filters.sort) || "popularity.desc",
        include_adult: "false",
        // Suppress the long tail of unrated entries that would otherwise
        // dominate a rating or vote-count sort.
        "vote_count.gte": filters && filters.sort === "vote_average.desc" ? 200 : 0
      };

      if (filters && filters.genre) params.with_genres = filters.genre;
      if (filters && filters.year) params.primary_release_year = filters.year;
      if (filters && filters.minRating) params["vote_average.gte"] = filters.minRating;

      return request("/discover/movie", params).then(toList);
    },

    genres: function () {
      return request("/genre/movie/list").then(function (payload) {
        var list = payload && Array.isArray(payload.genres) ? payload.genres : [];
        return list
          .filter(function (g) { return g && g.id != null; })
          .map(function (g) { return { id: Number(g.id), name: str(g.name) || "Unknown" }; });
      });
    },

    movie: function (id) {
      var numericId = Number(id);
      if (!Number.isFinite(numericId) || numericId <= 0) {
        return Promise.reject(new ApiError(ERROR_KINDS.NOT_FOUND, "Invalid movie id"));
      }
      return request("/movie/" + numericId, {
        append_to_response: "credits,videos,similar"
      }).then(normaliseDetail);
    }
  };

  global.CineScopeApi = api;
})(window);
