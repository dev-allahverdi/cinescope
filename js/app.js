/* ==========================================================================
   CineScope — bootstrap
   --------------------------------------------------------------------------
   Wires the persistent chrome (nav, theme, search, overlays) to the store and
   router, then starts routing. Listeners are attached once here rather than
   re-bound on every render.
   ========================================================================== */

(function (global) {
  "use strict";

  var store = global.CineScopeStore;
  var ui = global.CineScopeUI;
  var views = global.CineScopeViews;
  var router = global.CineScopeRouter;

  /* --------------------------------------------------------------- theme */

  function syncThemeButton() {
    var button = document.getElementById("theme-toggle");
    var iconNode = document.getElementById("theme-icon");
    if (!button || !iconNode) return;

    var isDark = store.getTheme() === "dark";
    // The control shows the theme you'd switch *to*.
    iconNode.textContent = isDark ? "dark_mode" : "light_mode";
    button.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
    button.setAttribute("aria-pressed", isDark ? "false" : "true");

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", isDark ? "#0a0a0b" : "#f9fafb");
  }

  function initTheme() {
    var button = document.getElementById("theme-toggle");
    if (!button) return;

    button.addEventListener("click", function () {
      store.toggleTheme();
    });

    store.on("theme:change", syncThemeButton);
    syncThemeButton();
  }

  /* -------------------------------------------------------------- search */

  function initSearch() {
    var form = document.getElementById("nav-search-form");
    var input = document.getElementById("nav-search-input");
    var mobileButton = document.getElementById("mobile-search-btn");

    if (form && input) {
      // Submit-based search, per the Stitch design — Enter and the button
      // both go through here, and no request fires while typing.
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        var term = input.value.trim();
        if (!term) {
          input.focus();
          return;
        }
        router.navigate("#/search", { q: term });
        input.blur();
      });
    }

    if (mobileButton) {
      mobileButton.addEventListener("click", function () {
        // On desktop the field is already visible; just focus it.
        if (input && input.offsetParent !== null) {
          input.focus();
          return;
        }
        router.navigate("#/search", {});
      });
    }

    // Keep the field showing whatever the URL is actually searching for.
    function syncSearchInput() {
      if (!input) return;
      var route = router.parseHash(global.location.hash);
      input.value = route.segments[0] === "search" ? (route.query.q || "").trim() : "";
    }

    global.addEventListener("hashchange", syncSearchInput);

    // hashchange does not fire for the initial URL, so a deep link into
    // #/search would otherwise land with an empty nav field.
    syncSearchInput();
  }

  /* ---------------------------------------------------------- nav scroll */

  function initNavScroll() {
    var nav = document.getElementById("topnav");
    if (!nav) return;

    var ticking = false;

    function update() {
      nav.classList.toggle("topnav--scrolled", global.scrollY > 50);
      ticking = false;
    }

    global.addEventListener(
      "scroll",
      function () {
        if (ticking) return;
        ticking = true;
        global.requestAnimationFrame(update);
      },
      { passive: true }
    );

    update();
  }

  /* ------------------------------------------------------------ overlays */

  function initOverlays() {
    var modal = document.getElementById("trailer-modal");
    var closeButton = document.getElementById("trailer-close");
    var drawer = document.getElementById("filter-drawer");
    var drawerClose = document.getElementById("filter-drawer-close");

    if (closeButton) closeButton.addEventListener("click", views.closeTrailer);

    if (modal) {
      modal.addEventListener("click", function (event) {
        // Backdrop click only — never a click inside the dialog.
        if (event.target === modal) views.closeTrailer();
      });
    }

    if (drawerClose) drawerClose.addEventListener("click", views.closeFilterDrawer);

    if (drawer) {
      drawer.addEventListener("click", function (event) {
        if (event.target.hasAttribute("data-drawer-dismiss")) views.closeFilterDrawer();
      });
    }

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      views.closeTrailer();
      views.closeFilterDrawer();
    });
  }

  /* ------------------------------------------------------------- toasts */

  function initWatchlistFeedback() {
    // One subscriber covers every add/remove in the app, so no view has to
    // remember to announce its own change.
    store.on("watchlist:change", function (change) {
      ui.toast(change.saved ? "Added to My List" : "Removed from My List");
    });
  }

  /* ---------------------------------------------------------- key notice */

  function warnIfUnconfigured() {
    if (global.CineScopeConfig.hasApiKey()) return;
    console.warn(
      "[cinescope] No TMDB API key configured. Set one in js/config.js, or run:\n" +
        '  localStorage.setItem("' +
        global.CineScopeConfig.keyStorageKey +
        '", "YOUR_KEY"); location.reload();'
    );
  }

  /* ---------------------------------------------------------------- boot */

  function boot() {
    var main = document.getElementById("main");

    initTheme();
    initSearch();
    initNavScroll();
    initOverlays();
    initWatchlistFeedback();
    warnIfUnconfigured();

    router.start(main);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window);
