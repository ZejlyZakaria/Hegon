import { http, HttpResponse } from "msw";

export const handlers = [
  // TMDB
  http.get("https://api.themoviedb.org/*", () =>
    HttpResponse.json({ results: [], total_results: 0 })
  ),

  // OpenWeather
  http.get("https://api.openweathermap.org/*", () =>
    HttpResponse.json({ main: { temp: 20 }, weather: [{ main: "Clear" }] })
  ),

  // TheSportsDB
  http.get("https://www.thesportsdb.com/*", () =>
    HttpResponse.json({ teams: [], events: [] })
  ),
];
