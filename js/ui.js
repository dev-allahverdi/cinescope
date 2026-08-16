/* ==========================================================================
   CineScope — UI primitives
   --------------------------------------------------------------------------
   Every element in the app is built here with createElement + textContent.
   innerHTML is never used with API-derived content, so a movie title, cast
   name or company name containing markup renders as text and nothing else.
   ========================================================================== */

(function (global) {
  "use strict";

  var api = global.CineScopeApi;
  var store = global.CineScopeStore;

  /* ------------------------------------------------------- DOM builders */

  /**
   * el("div", { class: "card", onclick: fn }, [child, "text"])
   * Attribute values are set via setAttribute; text children via textContent.
   */
  function el(tag, props, children) {
    var node = document.createElement(tag);

    Object.keys(props || {}).forEach(function (key) {
      var value = props[key];
      if (value === null || value === undefined || value === false) return;

      if (key === "class") {
        node.className = value;
      } else if (key === "text") {
        node.textContent = String(value);
      } else if (key === "dataset") {
        Object.keys(value).forEach(function (dataKey) {
          node.dataset[dataKey] = String(value[dataKey]);
        });
      } else if (key.slice(0, 2) === "on" && typeof value === "function") {
        node.addEventListener(key.slice(2), value);
      } else if (value === true) {
        node.setAttribute(key, "");
      } else {
        node.setAttribute(key, String(value));
      }
    });

    appendChildren(node, children);
    return node;
  }

  function appendChildren(node, children) {
    if (children === null || children === undefined) return;

    if (Array.isArray(children)) {
      children.forEach(function (child) {
        appendChildren(node, child);
      });
      return;
    }

    if (children instanceof Node) {
      node.appendChild(children);
      return;
    }

    node.appendChild(document.createTextNode(String(children)));
  }

  function icon(name, className) {
    return el("span", {
      class: "icon" + (className ? " " + className : ""),
      "aria-hidden": "true",
      text: name
    });
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  /* ------------------------------------------------------------ formatters */

  function formatRuntime(minutes) {
    var total = Number(minutes) || 0;
    if (total <= 0) return "";
    var hours = Math.floor(total / 60);
    var mins = total % 60;
    if (!hours) return mins + "m";
    return hours + "h " + (mins ? mins + "m" : "").trim();
  }

  function formatRating(rating) {
    var value = Number(rating) || 0;
    return value > 0 ? value.toFixed(1) : "";
  }

  function formatMoney(amount) {
    var value = Number(amount) || 0;
    if (value <= 0) return "";
    return "$" + value.toLocaleString("en-US");
  }

  function formatDate(iso) {
    if (typeof iso !== "string" || iso.length < 10) return "";
    var parsed = new Date(iso + "T00:00:00");
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  /* ------------------------------------------------------------- images */

  /**
   * Builds the poster area for a card. When TMDB has no poster we render a
   * typographic fallback rather than a broken image frame.
   */
  function posterMedia(movie, options) {
    var opts = options || {};
    var url = api.posterUrl(movie, opts.large);

    if (!url) {
      return el("div", { class: "card__fallback" }, [
        icon("image_not_supported"),
        el("span", { class: "t-body-sm", text: movie.title })
      ]);
    }

    return el("img", {
      class: "card__img",
      src: url,
      alt: "Poster for " + movie.title,
      loading: opts.eager ? "eager" : "lazy",
      decoding: "async"
    });
  }

  /* ------------------------------------------------------------- cards */

  /**
   * The rail / grid movie card: 2:3 poster, score badge, hover overlay with
   * the title, year and a watchlist toggle.
   *
   * @param {object} movie
   * @param {object} [options] { rank, eager, onToggle }
   */
  function movieCard(movie, options) {
    var opts = options || {};

    var overlayRow = el("div", { class: "card__row" }, [
      el("span", { class: "t-label", text: movie.year || "—" }),
      watchlistToggle(movie, "card__action")
    ]);

    var overlay = el("div", { class: "card__overlay" }, [
      el("span", { class: "t-title card__title truncate", text: movie.title }),
      overlayRow
    ]);

    var children = [posterMedia(movie, { eager: opts.eager }), cardLink(movie), overlay];

    var score = formatRating(movie.rating);
    if (score) {
      children.push(
        el("span", { class: "card__score" }, [icon("star", "icon--fill"), score])
      );
    }

    if (opts.rank) {
      children.push(el("span", { class: "card__rank", text: "#" + opts.rank }));
    }

    return el("article", { class: "card" }, children);
  }

  /** The stretched anchor covering a card. Kept a sibling of the controls. */
  function cardLink(movie, className) {
    return el("a", {
      class: className || "card__link",
      href: "#/movie/" + movie.id,
      "aria-label": movie.title + (movie.year ? ", " + movie.year : "")
    });
  }

  /**
   * Search-results variant: poster plus a persistent caption block, so the
   * title is readable without hovering.
   */
  function movieTile(movie, options) {
    var opts = options || {};

    var poster = el("div", { class: "card" }, [
      posterMedia(movie, { eager: opts.eager }),
      el("div", { class: "card__overlay" }, [watchlistToggle(movie, "card__action")]),
      formatRating(movie.rating)
        ? el("span", { class: "card__score" }, [icon("star", "icon--fill"), formatRating(movie.rating)])
        : null
    ]);

    var caption = el("div", { class: "card-tile__caption" }, [
      el("span", { class: "t-title card-tile__title truncate", text: movie.title }),
      el("div", { class: "card-tile__meta t-body-sm" }, [
        el("span", { text: movie.year || "—" }),
        el("span", { class: "tag", text: store.genreNames(movie.genreIds, 1)[0] || "Movie" })
      ])
    ]);

    return el("article", { class: "card-tile" }, [
      poster,
      caption,
      cardLink(movie, "card-tile__link")
    ]);
  }

  /**
   * My List variant: adds visible genre tags and an explicit Remove action,
   * matching the my-list screen.
   */
  function savedCard(entry) {
    var tags = store.genreNames(entry.genreIds, 2).map(function (name) {
      return el("span", { class: "tag", text: name });
    });

    var remove = el(
      "button",
      {
        class: "btn btn--ghost btn--sm btn--full",
        type: "button",
        "aria-label": "Remove " + entry.title + " from My List",
        onclick: function (event) {
          event.preventDefault();
          event.stopPropagation();
          store.removeFromWatchlist(entry.id);
        }
      },
      [icon("remove", "icon--sm"), "Remove"]
    );

    var overlay = el("div", { class: "card__overlay" }, [
      el("span", { class: "t-title card__title truncate", text: entry.title }),
      tags.length ? el("div", { class: "card__tags" }, tags) : null,
      remove
    ]);

    return el("article", { class: "card" }, [posterMedia(entry), cardLink(entry), overlay]);
  }

  /* ------------------------------------------------- watchlist controls

     A single store subscription keeps every on-screen control in sync. The
     alternative — one subscription per card — leaks a listener for every card
     ever rendered, since cards are discarded on each navigation. Instead each
     control tags itself with data-watchlist-id and hangs its own re-render
     function off the node, which is collected along with the DOM. */

  function registerWatchlistNode(node, movieId, sync) {
    node.dataset.watchlistId = String(Number(movieId));
    node._cinescopeSync = sync;
    sync();
    return node;
  }

  store.on("watchlist:change", function (change) {
    var selector = '[data-watchlist-id="' + Number(change.id) + '"]';
    Array.prototype.forEach.call(document.querySelectorAll(selector), function (node) {
      if (typeof node._cinescopeSync === "function") node._cinescopeSync();
    });
  });

  /**
   * The circular add/remove control that appears on cards. It reflects saved
   * state through aria-pressed and re-labels itself on every change.
   */
  function watchlistToggle(movie, className) {
    var button = el("button", {
      class: className,
      type: "button"
    });

    function sync() {
      var saved = store.isSaved(movie.id);
      button.setAttribute("aria-pressed", saved ? "true" : "false");
      button.setAttribute(
        "aria-label",
        (saved ? "Remove " : "Add ") + movie.title + (saved ? " from" : " to") + " My List"
      );
      clear(button);
      button.appendChild(icon(saved ? "check" : "add", "icon--sm"));
    }

    button.addEventListener("click", function (event) {
      // The control sits inside a link — don't navigate.
      event.preventDefault();
      event.stopPropagation();
      store.toggleWatchlist(movie);
    });

    return registerWatchlistNode(button, movie.id, sync);
  }

  /* -------------------------------------------------------- collections */

  function posterGrid(movies, options) {
    var opts = options || {};
    var grid = el("div", { class: "poster-grid" });

    movies.forEach(function (movie, index) {
      var card = opts.variant === "tile"
        ? movieTile(movie, { eager: index < 6 })
        : movieCard(movie, {
          eager: index < 6,
          rank: opts.ranked ? index + 1 : null
        });
      grid.appendChild(card);
    });

    return grid;
  }

  function rail(movies, options) {
    var opts = options || {};
    var track = el("div", { class: "rail no-scrollbar" });

    movies.forEach(function (movie, index) {
      track.appendChild(
        movieCard(movie, { eager: index < 4, rank: opts.ranked ? index + 1 : null })
      );
    });

    return track;
  }

  /**
   * @param {string} title
   * @param {Node} body
   * @param {object} [options] { iconName, href, linkText }
   */
  function section(title, body, options) {
    var opts = options || {};

    var heading = el("h2", { class: "t-headline section__title" }, [
      title,
      opts.iconName ? icon(opts.iconName) : null
    ]);
    if (opts.iconName) heading.querySelector(".icon").style.color = "var(--accent)";

    var head = el("div", { class: "section__head" }, [
      heading,
      opts.href ? el("a", { class: "section__link t-body-sm", href: opts.href, text: opts.linkText || "View all" }) : null
    ]);

    return el("section", { class: "section" }, [head, body]);
  }

  /* --------------------------------------------------------- skeletons */

  function skeletonGrid(count) {
    var grid = el("div", { class: "poster-grid" });
    for (var i = 0; i < (count || 12); i += 1) {
      grid.appendChild(el("div", { class: "sk sk--poster" }));
    }
    return grid;
  }

  function skeletonRail(count) {
    var track = el("div", { class: "rail no-scrollbar" });
    for (var i = 0; i < (count || 8); i += 1) {
      track.appendChild(el("div", { class: "sk sk--poster" }));
    }
    return track;
  }

  function skeletonHero() {
    return el("div", { class: "sk sk--hero" }, [
      el("div", { class: "sk-hero__body" }, [
        el("div", { class: "sk sk--title" }),
        el("div", { class: "sk sk--text", style: "width:40%" }),
        el("div", { class: "sk sk--text", style: "width:70%" }),
        el("div", { class: "sk-row" }, [
          el("div", { class: "sk sk--btn" }),
          el("div", { class: "sk sk--btn" })
        ])
      ])
    ]);
  }

  function skeletonSection(bodyNode) {
    return el("section", { class: "section" }, [
      el("div", { class: "sk sk--heading" }),
      bodyNode
    ]);
  }

  function skeletonCast(count) {
    var track = el("div", { class: "castrail no-scrollbar" });
    for (var i = 0; i < (count || 6); i += 1) {
      track.appendChild(
        el("div", { class: "castcard" }, [
          el("div", { class: "sk sk--avatar" }),
          el("div", { class: "sk sk--text", style: "width:70px" })
        ])
      );
    }
    return track;
  }

  function skeletonDetail() {
    return el("div", {}, [
      skeletonHero(),
      el("div", { class: "wrap wrap--narrow stack", style: "padding-top:24px" }, [
        el("div", { class: "sk sk--title" }),
        el("div", { class: "sk sk--text", style: "width:50%" }),
        el("div", { class: "sk sk--text", style: "width:90%" }),
        skeletonSection(skeletonCast(6)),
        skeletonSection(skeletonRail(6))
      ])
    ]);
  }

  /* ------------------------------------------------------------- states */

  /**
   * @param {object} options { iconName, title, body, actionText, onAction,
   *                           actionHref, variant, headingTag }
   *
   * headingTag defaults to h2. Pass "h1" when the block *is* the page — an
   * error or not-found screen still needs a top-level heading.
   */
  function stateBlock(options) {
    var opts = options || {};

    var action = null;
    if (opts.actionHref) {
      action = el("a", { class: "btn btn--primary btn--pill", href: opts.actionHref }, [
        opts.actionIcon ? icon(opts.actionIcon) : null,
        opts.actionText || "Continue"
      ]);
    } else if (opts.onAction) {
      action = el(
        "button",
        { class: "btn btn--primary btn--pill", type: "button", onclick: opts.onAction },
        [opts.actionIcon ? icon(opts.actionIcon) : null, opts.actionText || "Try again"]
      );
    }

    var block = el(
      "div",
      { class: "state" + (opts.variant === "error" ? " state--error" : "") },
      [
        el("div", { class: "state__icon" }, [icon(opts.iconName || "movie", "icon--fill")]),
        el(opts.headingTag || "h2", {
          class: opts.headingTag === "h1" ? "t-display" : "t-headline",
          text: opts.title || "Nothing here"
        }),
        el("p", { class: "t-body state__body", text: opts.body || "" }),
        action
      ]
    );

    if (opts.variant === "error") {
      return el("div", { class: "state-wrap" }, [block]);
    }

    return block;
  }

  /**
   * Renders an ApiError using only vetted copy — the raw message never
   * reaches the DOM.
   */
  function errorBlock(err, onRetry, options) {
    var copy = api.describeError(err);
    var isMissingKey = err && err.kind === api.ERROR_KINDS.MISSING_KEY;

    return stateBlock({
      variant: "error",
      iconName: "error",
      headingTag: (options && options.headingTag) || "h2",
      title: copy.title,
      body: copy.body,
      actionText: isMissingKey ? null : "Try again",
      actionIcon: isMissingKey ? null : "refresh",
      onAction: isMissingKey ? null : onRetry
    });
  }

  /* ------------------------------------------------------------- toasts */

  var toastHost = null;

  function toast(message, variant) {
    if (!toastHost) toastHost = document.getElementById("toasts");
    if (!toastHost) return;

    var node = el("div", { class: "toast" + (variant === "error" ? " toast--error" : "") }, [
      icon(variant === "error" ? "error" : "check", "icon--sm"),
      el("span", { class: "t-body-sm", text: message })
    ]);

    toastHost.appendChild(node);

    setTimeout(function () {
      node.dataset.leaving = "true";
      setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, 220);
    }, 2600);
  }

  /* -------------------------------------------------------- focus trap */

  var FOCUSABLE = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "iframe",
    '[tabindex]:not([tabindex="-1"])'
  ].join(",");

  function focusableWithin(container) {
    return Array.prototype.filter.call(
      container.querySelectorAll(FOCUSABLE),
      function (node) {
        return node.offsetParent !== null || node.tagName === "IFRAME";
      }
    );
  }

  /**
   * Keeps Tab inside `container` until released. Returns a teardown function
   * that also restores focus to wherever it was before.
   */
  function trapFocus(container) {
    var previouslyFocused = document.activeElement;

    function onKeydown(event) {
      if (event.key !== "Tab") return;

      var items = focusableWithin(container);
      if (!items.length) {
        event.preventDefault();
        return;
      }

      var first = items[0];
      var last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeydown, true);

    var items = focusableWithin(container);
    if (items.length) items[0].focus();

    return function release() {
      document.removeEventListener("keydown", onKeydown, true);
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }

  global.CineScopeUI = {
    el: el,
    icon: icon,
    clear: clear,

    formatRuntime: formatRuntime,
    formatRating: formatRating,
    formatMoney: formatMoney,
    formatDate: formatDate,

    posterMedia: posterMedia,
    registerWatchlistNode: registerWatchlistNode,
    movieCard: movieCard,
    movieTile: movieTile,
    savedCard: savedCard,
    watchlistToggle: watchlistToggle,
    posterGrid: posterGrid,
    rail: rail,
    section: section,

    skeletonGrid: skeletonGrid,
    skeletonRail: skeletonRail,
    skeletonHero: skeletonHero,
    skeletonSection: skeletonSection,
    skeletonCast: skeletonCast,
    skeletonDetail: skeletonDetail,

    stateBlock: stateBlock,
    errorBlock: errorBlock,
    toast: toast,
    trapFocus: trapFocus
  };
})(window);
