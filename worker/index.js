export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/tmdb/")) {
      return env.ASSETS.fetch(request);
    }

    if (request.method !== "GET") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: {
          Allow: "GET",
        },
      });
    }

    if (!env.TMDB_READ_TOKEN) {
      return Response.json(
        { error: "TMDB token is not configured." },
        { status: 500 }
      );
    }

    const tmdbPath = url.pathname.replace("/api/tmdb/", "");

    const tmdbUrl = new URL(
      `https://api.themoviedb.org/3/${tmdbPath}`
    );

    url.searchParams.forEach((value, key) => {
      if (key !== "api_key") {
        tmdbUrl.searchParams.append(key, value);
      }
    });

    try {
      const response = await fetch(tmdbUrl, {
        headers: {
          Authorization: `Bearer ${env.TMDB_READ_TOKEN}`,
          Accept: "application/json",
        },
      });

      return new Response(response.body, {
        status: response.status,
        headers: {
          "Content-Type":
            response.headers.get("Content-Type") ||
            "application/json",
          "Cache-Control": "public, max-age=60",
        },
      });
    } catch {
      return Response.json(
        { error: "Unable to reach TMDB." },
        { status: 502 }
      );
    }
  },
};