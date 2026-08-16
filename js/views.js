/* ==========================================================================
   CineScope — views
   --------------------------------------------------------------------------
   One function per route. Each renders a skeleton immediately, fetches, then
   swaps in real content. A render token guards against a slow response from
   an abandoned route painting over a newer page.
   ========================================================================== */

(function (global) {
  "use strict";

  var api = global.CineScopeApi;
  var store = global.CineScopeStore;
  var ui = global.CineScopeUI;
  var el = ui.el;
  var icon = ui.icon;

  var SORT_OPTIONS = [
    { value: "popularity.desc", label: "Popularity" },
    { value: "vote_average.desc", label: "Top rated" },
    { value: "primary_release_date.desc", label: "Newest releases" },
    { value: "revenue.desc", label: "Highest grossing" },
    { value: "title.asc", label: "Title (A–Z)" }
  ];

  var RATING_OPTIONS = [
    { value: "", label: "Any rating" },
    { value: "9", label: "9.0+ Excellent" },
    { value: "8", label: "8.0+ Great" },
    { value: "7", label: "7.0+ Good" },
    { value: "6", label: "6.0+ Decent" }
  ];

  /* --------------------------------------------------------- render token
     Bumped on every navigation. A fetch resolving with a stale token is
     dropped instead of being painted. */

  var renderToken = 0;

  /** Set while the My List view is mounted; released when any view takes over. */
  var myListSubscription = null;

  function nextToken() {
    renderToken += 1;
    if (myListSubscription) {
      store.off("watchlist:change", myListSubscription);
      myListSubscription = null;
    }
    return renderToken;
  }

  function isStale(token) {
    return token !== renderToken;
  }

  /* -------------------------------------------------------------- helpers */

  function mount(container, node) {
    ui.clear(container);
    container.appendChild(node);
  }

  function yearOptions() {
    var options = [{ value: "", label: "Any year" }];
    var thisYear = new Date().getFullYear();
    // TMDB's upcoming window runs slightly ahead of the current year.
    for (var year = thisYear + 1; year >= 1950; year -= 1) {
      options.push({ value: String(year), label: String(year) });
    }
    return options;
  }

  function selectField(config) {
    var select = el("select", { class: "select", id: config.id, "aria-label": config.label });

    config.options.forEach(function (option) {
      var node = el("option", { value: option.value, text: option.label });
      if (String(option.value) === String(config.value)) node.selected = true;
      select.appendChild(node);
    });

    select.addEventListener("change", function () {
      config.onChange(select.value);
    });

    return el("div", { class: "field" }, [
      el("label", { class: "field__label t-body-sm", for: config.id, text: config.label }),
      select,
      icon(config.iconName || "expand_more", "field__icon")
    ]);
  }

  /**
   * The genre / year / rating / sort controls, built fresh for each host so
   * the sticky bar and the mobile drawer can each own a copy.
   *
   * @param {string} prefix  Keeps element ids unique between the two hosts.
   */
  function filterFields(prefix, filters, onChange) {
    var genreOptions = [{ value: "", label: "All genres" }].concat(
      store.getGenres().map(function (genre) {
        return { value: String(genre.id), label: genre.name };
      })
    );

    return [
      selectField({
        id: prefix + "-genre",
        label: "Genre",
        iconName: "movie",
        value: filters.genre,
        options: genreOptions,
        onChange: function (value) { onChange({ genre: value, page: 1 }); }
      }),
      selectField({
        id: prefix + "-year",
        label: "Year",
        iconName: "calendar_today",
        value: filters.year,
        options: yearOptions(),
        onChange: function (value) { onChange({ year: value, page: 1 }); }
      }),
      selectField({
        id: prefix + "-rating",
        label: "Rating",
        iconName: "star",
        value: filters.rating,
        options: RATING_OPTIONS,
        onChange: function (value) { onChange({ rating: value, page: 1 }); }
      })
    ];
  }

  function sortField(prefix, filters, onChange) {
    return selectField({
      id: prefix + "-sort",
      label: "Sort by",
      iconName: "sort",
      value: filters.sort,
      options: SORT_OPTIONS,
      onChange: function (value) { onChange({ sort: value, page: 1 }); }
    });
  }

  /** Removable chips describing the filters currently in effect. */
  function activeFilters(filters, onChange) {
    var chips = [];

    function chip(label, patch) {
      return el("span", { class: "filterchip" }, [
        el("span", { class: "t-label", text: label }),
        el(
          "button",
          {
            class: "filterchip__remove",
            type: "button",
            "aria-label": "Remove filter " + label,
            onclick: function () { onChange(patch); }
          },
          [icon("close", "icon--xs")]
        )
      ]);
    }

    if (filters.genre) {
      chips.push(chip(store.genreName(filters.genre) || "Genre", { genre: "", page: 1 }));
    }
    if (filters.year) {
      chips.push(chip(filters.year, { year: "", page: 1 }));
    }
    if (filters.rating) {
      chips.push(chip(filters.rating + "+", { rating: "", page: 1 }));
    }

    if (!chips.length) return null;

    return el("section", { class: "activefilters", "aria-label": "Active filters" }, [
      el("span", { class: "t-body-sm muted", text: "Active filters:" }),
      chips,
      el(
        "button",
        {
          class: "linkbtn t-body-sm",
          type: "button",
          onclick: function () { onChange({ genre: "", year: "", rating: "", page: 1 }); }
        },
        ["Clear all"]
      )
    ]);
  }

  /** Numbered pagination, windowed around the current page. */
  function pagination(current, total, onGo) {
    if (total <= 1) return null;

    var nav = el("nav", { class: "pagination", "aria-label": "Pagination" });

    function pageButton(page, label) {
      var isCurrent = page === current;
      return el(
        "button",
        {
          class: "pagebtn",
          type: "button",
          "aria-label": "Go to page " + page,
          "aria-current": isCurrent ? "page" : null,
          onclick: function () { onGo(page); }
        },
        [String(label || page)]
      );
    }

    function arrow(page, label, iconName, disabled) {
      return el(
        "button",
        {
          class: "pagebtn",
          type: "button",
          "aria-label": label,
          disabled: disabled || null,
          onclick: function () { if (!disabled) onGo(page); }
        },
        [icon(iconName, "icon--sm")]
      );
    }

    nav.appendChild(arrow(current - 1, "Previous page", "chevron_left", current <= 1));

    var pages = [];
    var start = Math.max(1, current - 1);
    var end = Math.min(total, current + 1);

    if (start > 1) pages.push(1);
    if (start > 2) pages.push("gap");
    for (var page = start; page <= end; page += 1) pages.push(page);
    if (end < total - 1) pages.push("gap");
    if (end < total) pages.push(total);

    pages.forEach(function (entry) {
      if (entry === "gap") {
        nav.appendChild(el("span", { class: "pagination__gap", "aria-hidden": "true", text: "…" }));
      } else {
        nav.appendChild(pageButton(entry));
      }
    });

    nav.appendChild(arrow(current + 1, "Next page", "chevron_right", current >= total));

    return nav;
  }

  /* ---------------------------------------------------------- home view */

  function heroBlock(movie) {
    var backdrop = api.backdropUrl(movie);

    var media = el("div", { class: "hero__media" });
    if (backdrop) {
      media.style.backgroundImage = "url('" + backdrop + "')";
    } else {
      media.style.background = "linear-gradient(140deg, var(--surface-high), var(--surface))";
    }

    var meta = el("div", { class: "hero__meta t-label" });
    if (movie.year) meta.appendChild(el("span", { text: movie.year }));

    var genres = store.genreNames(movie.genreIds, 1);
    if (genres.length) {
      if (meta.childNodes.length) meta.appendChild(el("span", { class: "hero__dot" }));
      meta.appendChild(el("span", { class: "metachip", text: genres[0] }));
    }

    var rating = ui.formatRating(movie.rating);
    if (rating) {
      if (meta.childNodes.length) meta.appendChild(el("span", { class: "hero__dot" }));
      meta.appendChild(
        el("span", { class: "hero__rating" }, [icon("star", "icon--fill icon--xs"), rating + "/10"])
      );
    }

    var saveButton = el(
      "button",
      { class: "btn btn--ghost", type: "button" },
      []
    );

    function syncSave() {
      var saved = store.isSaved(movie.id);
      ui.clear(saveButton);
      saveButton.appendChild(icon(saved ? "check" : "add"));
      saveButton.appendChild(document.createTextNode(saved ? "In My List" : "Add to My List"));
      saveButton.setAttribute("aria-pressed", saved ? "true" : "false");
    }

    saveButton.addEventListener("click", function () {
      store.toggleWatchlist(movie);
    });

    ui.registerWatchlistNode(saveButton, movie.id, syncSave);

    var body = el("div", { class: "hero__body" }, [
      el("span", { class: "t-label hero__eyebrow", text: "Featured" }),
      el("h1", { class: "t-display", text: movie.title }),
      meta,
      movie.overview
        ? el("p", { class: "t-body hero__overview clamp-3", text: movie.overview })
        : null,
      el("div", { class: "hero__actions" }, [
        el("a", { class: "btn btn--primary", href: "#/movie/" + movie.id }, [
          icon("play_arrow", "icon--fill"),
          "View Details"
        ]),
        saveButton
      ])
    ]);

    return el("section", { class: "hero", "aria-label": "Featured movie" }, [media, body]);
  }

  function home(container) {
    var token = nextToken();

    mount(
      container,
      el("div", {}, [
        ui.skeletonHero(),
        el("div", { class: "wrap stack", style: "padding-top:32px" }, [
          ui.skeletonSection(ui.skeletonRail(6)),
          ui.skeletonSection(ui.skeletonGrid(12))
        ])
      ])
    );

    // allSettled, not all: one failing section must not blank the whole page.
    // If TMDB has trouble with a single endpoint we still show everything else,
    // and only fall back to a full-page error when nothing at all loaded.
    Promise.allSettled([
      store.loadGenres(),
      api.trending(),
      api.popular(),
      api.topRated(),
      api.upcoming()
    ])
      .then(function (settled) {
        if (isStale(token)) return;

        function itemsOf(result) {
          return result.status === "fulfilled" && result.value ? result.value.items || [] : [];
        }

        var trending = itemsOf(settled[1]);
        var popular = itemsOf(settled[2]);
        var topRated = itemsOf(settled[3]);
        var upcoming = itemsOf(settled[4]);

        // Nothing usable came back — surface the first real failure.
        if (!trending.length && !popular.length && !topRated.length && !upcoming.length) {
          var firstRejection = settled.slice(1).find(function (r) { return r.status === "rejected"; });
          throw (firstRejection && firstRejection.reason) ||
          new api.ApiError(api.ERROR_KINDS.INVALID, "No sections returned data");
        }

        // Prefer a featured title that actually has a backdrop to sit behind.
        var featured =
          trending.find(function (movie) { return movie.backdropPath && movie.overview; }) ||
          trending[0] ||
          popular[0];

        var sections = el("div", { class: "wrap stack", style: "padding-top:32px" });

        if (trending.length) {
          sections.appendChild(
            ui.section("Trending Now", ui.rail(trending), { iconName: "local_fire_department" })
          );
        }

        if (popular.length) {
          sections.appendChild(
            ui.section("Popular Movies", ui.posterGrid(popular.slice(0, 12)), {
              href: "#/discover?sort=popularity.desc",
              linkText: "View all"
            })
          );
        }

        if (topRated.length) {
          sections.appendChild(
            ui.section("Top Rated", ui.rail(topRated, { ranked: true }), {
              iconName: "military_tech",
              href: "#/discover?sort=vote_average.desc",
              linkText: "View all"
            })
          );
        }

        if (upcoming.length) {
          sections.appendChild(
            ui.section("Upcoming", ui.rail(upcoming), {
              iconName: "event_upcoming",
              href: "#/discover?sort=primary_release_date.desc",
              linkText: "View all"
            })
          );
        }

        var page = el("div", {}, [featured ? heroBlock(featured) : null, sections]);
        mount(container, page);
      })
      .catch(function (err) {
        if (isStale(token)) return;
        mount(
          container,
          el("div", { class: "wrap" }, [
            ui.errorBlock(err, function () { home(container); }, { headingTag: "h1" })
          ])
        );
      });
  }

  /* ------------------------------------------------- discover / genre */

  /**
   * Shared implementation behind #/discover and #/genres/:id — both are a
   * filtered grid over TMDB's discover endpoint.
   */
  function browse(container, options) {
    var token = nextToken();
    var opts = options || {};
    var filters = opts.filters;

    var head = el("header", { class: "pagehead" }, [
      el("h1", { class: "t-display", text: opts.title }),
      opts.description ? el("p", { class: "t-body", text: opts.description }) : null
    ]);

    var resultsHost = el("div", {}, [ui.skeletonGrid(15)]);
    var status = el("p", {
      class: "visually-hidden",
      role: "status",
      "aria-live": "polite"
    });

    function onChange(patch) {
      opts.onFilterChange(patch);
    }

    var mobileFilterBtn = el(
      "button",
      {
        class: "pillbtn",
        type: "button",
        id: "open-filters",
        onclick: function () {
          openFilterDrawer(filters, onChange);
        }
      },
      [icon("tune", "icon--sm"), "Filters"]
    );

    // Both controls are always in the DOM; CSS decides which one is visible,
    // so a resize across the 768px breakpoint needs no re-render.
    var bar = el("section", { class: "filterbar only-desktop", "aria-label": "Filters" }, [
      el("div", { class: "filterbar__group" }, filterFields("bar", filters, onChange)),
      el("div", { class: "filterbar__sort" }, [sortField("bar", filters, onChange)])
    ]);

    var mobileBar = el("div", { class: "results__actions only-mobile" }, [mobileFilterBtn]);

    var page = el("div", { class: "wrap stack", style: "padding-top:32px" }, [
      head,
      mobileBar,
      bar,
      activeFilters(filters, onChange),
      status,
      resultsHost
    ]);

    mount(container, page);

    api
      .discover({
        genre: filters.genre,
        year: filters.year,
        minRating: filters.rating,
        sort: filters.sort,
        page: filters.page
      })
      .then(function (result) {
        if (isStale(token)) return;
        ui.clear(resultsHost);

        if (!result.items.length) {
          resultsHost.appendChild(
            ui.stateBlock({
              iconName: "movie",
              title: "No movies match those filters",
              body: "Try widening the year range or clearing a filter to see more results.",
              actionText: "Clear filters",
              onAction: function () { onChange({ genre: "", year: "", rating: "", page: 1 }); }
            })
          );
          status.textContent = "No movies found.";
          return;
        }

        status.textContent =
          result.totalResults.toLocaleString("en-US") +
          " movies found. Page " + result.page + " of " + result.totalPages + ".";

        resultsHost.appendChild(ui.posterGrid(result.items, { variant: "tile" }));

        var pager = pagination(result.page, result.totalPages, function (page) {
          onChange({ page: page });
        });
        if (pager) resultsHost.appendChild(pager);
      })
      .catch(function (err) {
        if (isStale(token)) return;
        ui.clear(resultsHost);
        resultsHost.appendChild(
          ui.errorBlock(err, function () { browse(container, opts); })
        );
      });
  }

  function discover(container, query, navigate) {
    var filters = {
      genre: query.genre || "",
      year: query.year || "",
      rating: query.rating || "",
      sort: query.sort || "popularity.desc",
      page: Math.max(1, Number(query.page) || 1)
    };

    store.loadGenres().catch(function () { return []; }).then(function () {
      browse(container, {
        title: "Discover Movies",
        description:
          "Browse an extensive catalogue of cinematic experiences by genre, rating and release date to find your next favourite film.",
        filters: filters,
        onFilterChange: function (patch) {
          navigate("#/discover", Object.assign({}, filters, patch));
        }
      });
    });
  }

  function genreList(container) {
    var token = nextToken();

    mount(
      container,
      el("div", { class: "wrap stack", style: "padding-top:32px" }, [
        el("div", { class: "sk sk--title" }),
        ui.skeletonGrid(8)
      ])
    );

    store
      .loadGenres()
      .then(function (genres) {
        if (isStale(token)) return;

        var chips = el("div", { class: "activefilters" });
        genres.forEach(function (genre) {
          chips.appendChild(
            el("a", { class: "chip", href: "#/genres/" + genre.id, text: genre.name })
          );
        });

        mount(
          container,
          el("div", { class: "wrap stack", style: "padding-top:32px" }, [
            el("header", { class: "pagehead" }, [
              el("h1", { class: "t-display", text: "Genres" }),
              el("p", {
                class: "t-body",
                text: "Pick a genre to browse everything in the catalogue that fits it."
              })
            ]),
            chips
          ])
        );
      })
      .catch(function (err) {
        if (isStale(token)) return;
        mount(
          container,
          el("div", { class: "wrap" }, [
            ui.errorBlock(err, function () { genreList(container); }, { headingTag: "h1" })
          ])
        );
      });
  }

  function genre(container, genreId, query, navigate) {
    var filters = {
      genre: String(genreId),
      year: query.year || "",
      rating: query.rating || "",
      sort: query.sort || "popularity.desc",
      page: Math.max(1, Number(query.page) || 1)
    };

    store.loadGenres().catch(function () { return []; }).then(function () {
      var name = store.genreName(genreId);

      browse(container, {
        title: name ? name + " Movies" : "Genre",
        description: name
          ? "Everything in the catalogue tagged " + name + "."
          : "Browse this genre.",
        filters: filters,
        onFilterChange: function (patch) {
          var next = Object.assign({}, filters, patch);
          // Changing the genre dropdown navigates to that genre's own page.
          if (patch.genre !== undefined && String(patch.genre) !== String(genreId)) {
            if (!patch.genre) {
              navigate("#/discover", { year: next.year, rating: next.rating, sort: next.sort });
              return;
            }
            navigate("#/genres/" + patch.genre, {
              year: next.year,
              rating: next.rating,
              sort: next.sort
            });
            return;
          }
          navigate("#/genres/" + genreId, next);
        }
      });
    });
  }

  /* -------------------------------------------------------- search view */

  /**
   * In-page search form. The top-nav field is hidden below 768px, so the
   * search route carries its own submit-based form for small screens.
   */
  function searchForm(term, navigate) {
    var input = el("input", {
      class: "input",
      id: "page-search-input",
      type: "search",
      name: "q",
      value: term || "",
      placeholder: "Search movies, genres, actors…",
      autocomplete: "off"
    });

    var form = el("form", { class: "field field--search", role: "search" }, [
      el("label", { class: "visually-hidden", for: "page-search-input", text: "Search movies" }),
      input,
      icon("search", "field__icon")
    ]);

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var value = input.value.trim();
      if (!value) {
        input.focus();
        return;
      }
      navigate("#/search", { q: value });
    });

    return form;
  }

  function search(container, query, navigate) {
    var token = nextToken();
    var term = (query.q || "").trim();
    var page = Math.max(1, Number(query.page) || 1);

    if (!term) {
      mount(
        container,
        el("div", { class: "wrap wrap--narrow stack", style: "padding-top:32px" }, [
          el("header", { class: "pagehead" }, [
            el("h1", { class: "t-display", text: "Search" }),
            el("p", { class: "t-body", text: "Find any film in the TMDB catalogue by title." })
          ]),
          searchForm("", navigate),
          ui.stateBlock({
            iconName: "search",
            title: "Search CineScope",
            body: "Type a film title above and press Enter to find it.",
            actionText: "Browse Discover instead",
            actionHref: "#/discover"
          })
        ])
      );
      return;
    }

    var status = el("p", { class: "visually-hidden", role: "status", "aria-live": "polite" });
    var resultsHost = el("div", {}, [ui.skeletonGrid(12)]);

    var header = el("div", { class: "results__head" }, [
      el("div", {}, [
        el("p", { class: "t-body-sm muted", text: "Search results for" }),
        el("h1", { class: "t-headline", text: '"' + term + '"' }),
        el("p", { class: "t-body-sm muted", id: "result-count", text: "Searching…" })
      ]),
      el("div", { class: "results__actions" }, [
        el("a", { class: "pillbtn", href: "#/discover" }, [
          icon("filter_list", "icon--sm"),
          "Filters"
        ])
      ])
    ]);

    mount(
      container,
      el("div", { class: "wrap stack", style: "padding-top:32px" }, [
        searchForm(term, navigate),
        header,
        status,
        resultsHost
      ])
    );

    api
      .search(term, page)
      .then(function (result) {
        if (isStale(token)) return;

        var count = document.getElementById("result-count");
        ui.clear(resultsHost);

        if (!result.items.length) {
          if (count) count.textContent = "0 results found";
          status.textContent = "No results for " + term + ".";
          resultsHost.appendChild(
            ui.stateBlock({
              iconName: "search",
              title: "No matches for “" + term + "”",
              body: "Check the spelling, try a shorter phrase, or browse by genre instead.",
              actionText: "Browse Discover",
              actionHref: "#/discover"
            })
          );
          return;
        }

        var label =
          result.totalResults.toLocaleString("en-US") +
          (result.totalResults === 1 ? " result found" : " results found");

        if (count) count.textContent = label;
        status.textContent = label + ". Page " + result.page + " of " + result.totalPages + ".";

        resultsHost.appendChild(ui.posterGrid(result.items, { variant: "tile" }));

        var pager = pagination(result.page, result.totalPages, function (nextPage) {
          navigate("#/search", { q: term, page: nextPage });
        });
        if (pager) resultsHost.appendChild(pager);
      })
      .catch(function (err) {
        if (isStale(token)) return;
        ui.clear(resultsHost);
        resultsHost.appendChild(
          ui.errorBlock(err, function () { search(container, query, navigate); })
        );
      });
  }

  /* -------------------------------------------------------- detail view */

  function detailPanels(movie) {
    var panels = [];

    /* Cast */
    if (movie.cast.length) {
      var castRail = el("div", { class: "castrail no-scrollbar" });

      movie.cast.forEach(function (person) {
        var photoUrl = api.profileUrl(person);
        var photo = el("div", { class: "castcard__photo" }, [
          photoUrl
            ? el("img", {
              src: photoUrl,
              alt: "Photo of " + person.name,
              loading: "lazy",
              decoding: "async"
            })
            : icon("person")
        ]);

        castRail.appendChild(
          el("div", { class: "castcard" }, [
            photo,
            el("div", {}, [
              el("p", { class: "castcard__name", text: person.name }),
              person.character
                ? el("p", { class: "castcard__role", text: person.character })
                : null
            ])
          ])
        );
      });

      panels.push(
        el("div", { class: "panel bento__wide" }, [
          el("div", { class: "panel__head" }, [el("h2", { class: "t-headline", text: "Top Cast" })]),
          castRail
        ])
      );
    }

    /* Facts */
    var facts = [];
    function fact(label, value) {
      if (!value) return;
      facts.push(
        el("div", {}, [
          el("span", { class: "fact__label", text: label }),
          el("span", { class: "fact__value", text: value })
        ])
      );
    }

    fact("Status", movie.status);
    fact("Director", movie.director);
    fact("Release date", ui.formatDate(movie.releaseDate));
    fact("Budget", ui.formatMoney(movie.budget));
    fact("Revenue", ui.formatMoney(movie.revenue));

    if (facts.length || movie.companies.length) {
      var factPanel = el("div", { class: "panel" }, [
        el("h2", { class: "t-title", text: "Details" }),
        facts.length ? el("div", { class: "factlist" }, facts) : null
      ]);

      if (movie.companies.length) {
        factPanel.appendChild(
          el("div", { class: "panel__foot" }, [
            el("span", { class: "fact__label", text: "Production" }),
            el(
              "div",
              { class: "companies" },
              movie.companies.slice(0, 6).map(function (name) {
                return el("span", { class: "company", text: name });
              })
            )
          ])
        );
      }

      panels.push(factPanel);
    }

    return panels;
  }

  function movieDetail(container, id) {
    var token = nextToken();

    mount(container, ui.skeletonDetail());

    Promise.all([store.loadGenres().catch(function () { return []; }), api.movie(id)])
      .then(function (results) {
        if (isStale(token)) return;
        var movie = results[1];

        document.title = movie.title + " — CineScope";

        /* Hero */
        var backdrop = api.backdropUrl(movie);
        var media = el("div", { class: "detail__backdrop" });
        if (backdrop) {
          media.style.backgroundImage = "url('" + backdrop + "')";
        } else {
          media.style.background = "linear-gradient(140deg, var(--surface-high), var(--surface))";
        }

        var hero = el("section", { class: "detail__hero", "aria-hidden": "true" }, [media]);

        /* Poster */
        var posterUrl = api.posterUrl(movie, true);
        var poster = el("div", { class: "detail__poster" }, [
          posterUrl
            ? el("img", {
              class: "card__img",
              src: posterUrl,
              alt: "Poster for " + movie.title,
              style: "position:static;height:100%",
              decoding: "async"
            })
            : el("div", { class: "card__fallback", style: "position:static;height:100%" }, [
              icon("image_not_supported"),
              el("span", { class: "t-body-sm", text: movie.title })
            ])
        ]);

        /* Meta row */
        var meta = el("div", { class: "detail__meta t-body-sm" });

        var rating = ui.formatRating(movie.rating);
        if (rating) {
          meta.appendChild(
            el("span", { class: "detail__score" }, [
              icon("star", "icon--fill icon--xs"),
              el("b", { text: rating })
            ])
          );
        }

        var runtime = ui.formatRuntime(movie.runtime);
        if (runtime) {
          meta.appendChild(
            el("span", { class: "detail__metaitem" }, [icon("schedule", "icon--xs"), runtime])
          );
        }

        if (movie.year) {
          meta.appendChild(
            el("span", { class: "detail__metaitem" }, [icon("calendar_month", "icon--xs"), movie.year])
          );
        }

        /* Actions */
        var saveButton = el("button", { class: "btn btn--primary", type: "button" }, []);

        function syncSave() {
          var saved = store.isSaved(movie.id);
          ui.clear(saveButton);
          saveButton.appendChild(icon(saved ? "check" : "add", "icon--fill"));
          saveButton.appendChild(document.createTextNode(saved ? "In My List" : "Add to My List"));
          saveButton.setAttribute("aria-pressed", saved ? "true" : "false");
        }

        saveButton.addEventListener("click", function () {
          store.toggleWatchlist(movie);
        });

        ui.registerWatchlistNode(saveButton, movie.id, syncSave);

        var trailerButton = el(
          "button",
          {
            class: "btn btn--ghost",
            type: "button",
            onclick: function () { openTrailer(movie); }
          },
          [icon("play_arrow", "icon--fill"), "Watch Trailer"]
        );

        if (!movie.trailer) {
          trailerButton.setAttribute("aria-describedby", "no-trailer-note");
        }

        var info = el("div", { class: "detail__info" }, [
          el("h1", { class: "t-display", text: movie.title }),
          movie.tagline ? el("p", { class: "t-title detail__tagline", text: "“" + movie.tagline + "”" }) : null,
          meta,
          movie.genres.length
            ? el(
              "div",
              { class: "detail__genres" },
              movie.genres.map(function (genreItem) {
                return el("a", {
                  class: "tag",
                  href: "#/genres/" + genreItem.id,
                  text: genreItem.name
                });
              })
            )
            : null,
          el("p", {
            class: "t-body detail__overview",
            text: movie.overview || "No synopsis has been published for this title yet."
          }),
          el("div", { class: "detail__actions" }, [saveButton, trailerButton]),
          !movie.trailer
            ? el("p", {
              class: "t-body-sm muted",
              id: "no-trailer-note",
              text: "No trailer is available for this title."
            })
            : null
        ]);

        var lead = el("div", { class: "wrap wrap--narrow" }, [
          el("div", { class: "detail__lead" }, [poster, info])
        ]);

        /* Panels + similar */
        var body = el("div", { class: "wrap wrap--narrow stack", style: "padding-top:48px" });

        var panels = detailPanels(movie);
        if (panels.length) body.appendChild(el("section", { class: "bento" }, panels));

        if (movie.similar.length) {
          body.appendChild(ui.section("Similar Movies", ui.rail(movie.similar)));
        }

        mount(container, el("div", {}, [hero, lead, body]));
      })
      .catch(function (err) {
        if (isStale(token)) return;

        var notFound = err && err.kind === api.ERROR_KINDS.NOT_FOUND;

        // The router optimistically set "Loading…" — replace it, or the tab
        // title lies about the state of the page.
        document.title = notFound ? "Movie not found — CineScope" : "Couldn't load — CineScope";

        mount(
          container,
          el("div", { class: "wrap", style: "padding-top:32px" }, [
            notFound
              ? ui.stateBlock({
                variant: "error",
                iconName: "error",
                headingTag: "h1",
                title: "We couldn't find that movie",
                body: "This title isn't in the catalogue. It may have been removed, or the link may be wrong.",
                actionText: "Back to Home",
                actionHref: "#/"
              })
              : ui.errorBlock(err, function () { movieDetail(container, id); }, { headingTag: "h1" })
          ])
        );
      });
  }

  /* ------------------------------------------------------- my list view */

  function myList(container) {
    nextToken();

    function render() {
      var entries = store.getWatchlist();

      if (!entries.length) {
        mount(
          container,
          el("div", { class: "wrap wrap--narrow stack", style: "padding-top:32px" }, [
            el("header", { class: "pagehead" }, [
              el("h1", { class: "t-display", text: "My List" }),
              el("p", { class: "t-body", text: "Movies you've saved for later." })
            ]),
            ui.stateBlock({
              iconName: "movie",
              title: "Your list is empty",
              body: "Save movies you want to watch later and they'll appear here.",
              actionText: "Discover Movies",
              actionHref: "#/discover"
            })
          ])
        );
        return;
      }

      var grid = el("div", { class: "poster-grid" });
      entries.forEach(function (entry) {
        grid.appendChild(ui.savedCard(entry));
      });

      mount(
        container,
        el("div", { class: "wrap wrap--narrow stack", style: "padding-top:32px" }, [
          el("header", { class: "pagehead" }, [
            el("h1", { class: "t-display", text: "My List" }),
            el("p", {
              class: "t-body",
              text:
                entries.length +
                (entries.length === 1 ? " movie saved for later." : " movies saved for later.")
            })
          ]),
          grid
        ])
      );
    }

    // Removing a card mutates the collection this page *is*, so the grid has
    // to rebuild — otherwise a removed poster lingers and emptying the list
    // never reveals the empty state.
    myListSubscription = render;
    store.on("watchlist:change", myListSubscription);

    // Genre names decorate the saved cards; render immediately either way.
    store.loadGenres().catch(function () { return []; }).then(render);
    render();
  }

  /* ------------------------------------------------------- not found */

  function notFound(container) {
    nextToken();
    mount(
      container,
      el("div", { class: "wrap", style: "padding-top:32px" }, [
        ui.stateBlock({
          variant: "error",
          iconName: "error",
          headingTag: "h1",
          title: "Page not found",
          body: "That link doesn't lead anywhere in CineScope.",
          actionText: "Back to Home",
          actionHref: "#/"
        })
      ])
    );
  }

  /* ------------------------------------------------------ trailer modal */

  var modalState = { releaseFocus: null, movie: null };

  function openTrailer(movie) {
    var modal = document.getElementById("trailer-modal");
    var videoHost = document.getElementById("trailer-video");
    var badges = document.getElementById("trailer-badges");
    var title = document.getElementById("trailer-modal-title");
    var saveBtn = document.getElementById("trailer-watchlist");

    modalState.movie = movie;
    title.textContent = movie.title;

    ui.clear(videoHost);
    ui.clear(badges);

    if (movie.trailer) {
      // The key was validated against /^[A-Za-z0-9_-]{6,20}$/ at parse time,
      // so it is safe to interpolate into the embed URL here.
      var iframe = el("iframe", {
        src:
          "https://www.youtube-nocookie.com/embed/" +
          encodeURIComponent(movie.trailer.key) +
          "?autoplay=1&rel=0&modestbranding=1",
        title: movie.title + " trailer",
        allow: "accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture",
        allowfullscreen: true,
        referrerpolicy: "strict-origin-when-cross-origin"
      });
      videoHost.appendChild(iframe);
      badges.appendChild(el("span", { class: "badge", text: movie.trailer.type || "Trailer" }));
      badges.appendChild(el("span", { class: "badge", text: "YouTube" }));
    } else {
      videoHost.appendChild(
        el("div", { class: "modal__unavailable" }, [
          icon("videocam_off"),
          el("p", { class: "t-title", text: "No trailer available" }),
          el("p", {
            class: "t-body-sm",
            text: "TMDB doesn't have a trailer for this title yet."
          })
        ])
      );
      badges.appendChild(el("span", { class: "badge", text: "Unavailable" }));
    }

    function syncSave() {
      var saved = store.isSaved(movie.id);
      ui.clear(saveBtn);
      saveBtn.appendChild(icon(saved ? "check" : "add", "icon--sm"));
      saveBtn.appendChild(el("span", { text: saved ? "In My List" : "Watchlist" }));
      saveBtn.setAttribute("aria-pressed", saved ? "true" : "false");
    }

    saveBtn.onclick = function () {
      store.toggleWatchlist(movie);
    };

    ui.registerWatchlistNode(saveBtn, movie.id, syncSave);

    modal.hidden = false;
    modal.dataset.open = "true";
    document.body.dataset.modalOpen = "true";
    modalState.releaseFocus = ui.trapFocus(document.getElementById("trailer-dialog"));
  }

  function closeTrailer() {
    var modal = document.getElementById("trailer-modal");
    if (!modal || modal.dataset.open !== "true") return;

    // Removing the iframe is what actually stops playback.
    ui.clear(document.getElementById("trailer-video"));

    modal.dataset.open = "false";
    modal.hidden = true;
    delete document.body.dataset.modalOpen;

    if (modalState.releaseFocus) {
      modalState.releaseFocus();
      modalState.releaseFocus = null;
    }
    modalState.movie = null;
  }

  /* ------------------------------------------------------ filter drawer */

  var drawerState = { releaseFocus: null };

  function openFilterDrawer(filters, onChange) {
    var drawer = document.getElementById("filter-drawer");
    var body = document.getElementById("filter-drawer-body");

    ui.clear(body);

    var fields = el(
      "div",
      { class: "stack", style: "gap:16px" },
      filterFields("drawer", filters, function (patch) {
        closeFilterDrawer();
        onChange(patch);
      }).concat([
        sortField("drawer", filters, function (patch) {
          closeFilterDrawer();
          onChange(patch);
        }),
        el(
          "button",
          {
            class: "btn btn--ghost btn--full",
            type: "button",
            onclick: function () {
              closeFilterDrawer();
              onChange({ genre: "", year: "", rating: "", page: 1 });
            }
          },
          ["Clear all filters"]
        )
      ])
    );

    body.appendChild(fields);

    drawer.hidden = false;
    drawer.dataset.open = "true";
    document.body.dataset.modalOpen = "true";
    drawerState.releaseFocus = ui.trapFocus(document.getElementById("filter-panel"));
  }

  function closeFilterDrawer() {
    var drawer = document.getElementById("filter-drawer");
    if (!drawer || drawer.dataset.open !== "true") return;

    drawer.dataset.open = "false";
    drawer.hidden = true;
    if (document.getElementById("trailer-modal").dataset.open !== "true") {
      delete document.body.dataset.modalOpen;
    }

    if (drawerState.releaseFocus) {
      drawerState.releaseFocus();
      drawerState.releaseFocus = null;
    }
  }

  global.CineScopeViews = {
    home: home,
    discover: discover,
    genreList: genreList,
    genre: genre,
    search: search,
    movieDetail: movieDetail,
    myList: myList,
    notFound: notFound,
    openTrailer: openTrailer,
    closeTrailer: closeTrailer,
    closeFilterDrawer: closeFilterDrawer
  };
})(window);
