/* ==========================================================================
   CineScope — hash router
   --------------------------------------------------------------------------
   Hash routing keeps every URL reload-safe on plain static hosting: no server
   rewrite rules, no 404 on refresh, and deep links survive being pasted.

     #/                     home
     #/discover?genre=28…   filtered browse
     #/genres               genre index
     #/genres/28?page=2     one genre
     #/search?q=inception   search results
     #/movie/27205          movie detail
     #/my-list              saved movies
   ========================================================================== */

(function (global) {
  "use strict";

  var views = global.CineScopeViews;

  var container = null;
  var announcer = null;
  var currentKey = "";

  /* ------------------------------------------------------------- parsing */

  /**
   * Splits "#/genres/28?page=2" into { segments: ["genres","28"],
   * query: { page: "2" } }. Malformed input degrades to the home route
   * rather than throwing.
   */
  function parseHash(hash) {
    var raw = String(hash || "").replace(/^#/, "");
    if (raw.charAt(0) === "/") raw = raw.slice(1);

    var queryStart = raw.indexOf("?");
    var pathPart = queryStart === -1 ? raw : raw.slice(0, queryStart);
    var queryPart = queryStart === -1 ? "" : raw.slice(queryStart + 1);

    var segments = pathPart
      .split("/")
      .map(function (segment) {
        try {
          return decodeURIComponent(segment);
        } catch (err) {
          return segment;
        }
      })
      .filter(function (segment) {
        return segment.length > 0;
      });

    var query = {};
    new URLSearchParams(queryPart).forEach(function (value, key) {
      query[key] = value;
    });

    return { segments: segments, query: query };
  }

  function buildHash(path, query) {
    var base = String(path || "#/");
    if (base.charAt(0) !== "#") base = "#" + base;

    var params = new URLSearchParams();
    Object.keys(query || {}).forEach(function (key) {
      var value = query[key];
      if (value === undefined || value === null || value === "") return;
      // Page 1 is the default; keep it out of the URL for cleaner links.
      if (key === "page" && String(value) === "1") return;
      params.set(key, String(value));
    });

    var qs = params.toString();
    return qs ? base + "?" + qs : base;
  }

  function navigate(path, query) {
    var target = buildHash(path, query);
    if (target === global.location.hash) {
      // Same URL — re-render explicitly since hashchange won't fire.
      resolve();
      return;
    }
    global.location.hash = target;
  }

  /* ------------------------------------------------------ chrome updates */

  function syncNavHighlight(activePath) {
    var links = document.querySelectorAll(".navlink, .bottomnav__item");

    Array.prototype.forEach.call(links, function (link) {
      var href = link.getAttribute("href") || "";
      var linkPath = href.replace(/^#/, "").split("?")[0] || "/";
      var isActive = linkPath === activePath;

      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function announce(label) {
    if (!announcer) announcer = document.getElementById("route-announcer");
    if (announcer) announcer.textContent = label + " page loaded";
  }

  /* ------------------------------------------------------------ resolve */

  function resolve() {
    var route = parseHash(global.location.hash);
    var segments = route.segments;
    var query = route.query;
    var head = segments[0] || "";

    // Any open overlay belongs to the page we're leaving.
    views.closeTrailer();
    views.closeFilterDrawer();

    var title = "CineScope — Movie Discovery";
    var navPath = "/";
    var label = "Home";

    if (head === "") {
      views.home(container);
    } else if (head === "discover") {
      navPath = "/discover";
      label = "Discover";
      title = "Discover — CineScope";
      views.discover(container, query, navigate);
    } else if (head === "genres") {
      navPath = "/genres";
      if (segments[1]) {
        label = "Genre";
        title = "Genre — CineScope";
        views.genre(container, segments[1], query, navigate);
      } else {
        label = "Genres";
        title = "Genres — CineScope";
        views.genreList(container);
      }
    } else if (head === "search") {
      navPath = "/discover";
      label = "Search results";
      // Trim first: a whitespace-only query renders the empty prompt, so the
      // tab title must not claim a search is running.
      var searchTerm = (query.q || "").trim();
      title = searchTerm ? 'Search: "' + searchTerm + '" — CineScope' : "Search — CineScope";
      views.search(container, query, navigate);
    } else if (head === "movie" && segments[1]) {
      navPath = "";
      label = "Movie details";
      title = "Loading… — CineScope";
      views.movieDetail(container, segments[1]);
    } else if (head === "my-list") {
      navPath = "/my-list";
      label = "My List";
      title = "My List — CineScope";
      views.myList(container);
    } else {
      navPath = "";
      label = "Page not found";
      title = "Not found — CineScope";
      views.notFound(container);
    }

    document.title = title;
    syncNavHighlight(navPath);
    announce(label);

    // Preserve scroll position when only the query changed within a route
    // (e.g. paging), otherwise start the new page at the top.
    var key = head + "/" + (segments[1] || "");
    if (key !== currentKey) {
      global.scrollTo({ top: 0, behavior: "auto" });
    } else {
      global.scrollTo({ top: 0, behavior: "smooth" });
    }
    currentKey = key;

    if (container) container.focus({ preventScroll: true });
  }

  function start(mainElement) {
    container = mainElement;

    global.addEventListener("hashchange", resolve);

    if (!global.location.hash) {
      global.location.replace("#/");
    }

    resolve();
  }

  global.CineScopeRouter = {
    start: start,
    navigate: navigate,
    buildHash: buildHash,
    parseHash: parseHash
  };
})(window);
