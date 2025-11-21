import React, { useEffect, useMemo, useState } from "react";

type WeatherResponse = {
  location: string;
  description: string;
  temperature: number | null;
  feels_like: number | null;
  humidity: number | null;
  wind_speed: number | null;
  icon: string | null;
  sunrise: number | null;
  sunset: number | null;
  timestamp: number | null;
  timezone_offset: number | null;
  units: string;
  resolved_at: string;
};

type ScanArtifact = {
  id: string;
  kind: string;
  status: string;
  bytes: number;
  created_at: string;
};

type ScanSession = {
  id: string;
  label: string;
  status: string;
  device_type: string;
  platform: string;
  created_at: string;
  artifacts: ScanArtifact[];
};

function formatTemperature(value: number | null, units: string) {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }

  const suffix = units === "metric" ? "°C" : units === "imperial" ? "°F" : "K";
  return `${Math.round(value)}${suffix}`;
}

function formatWindSpeed(speed: number | null, units: string) {
  if (speed === null || Number.isNaN(speed)) {
    return "—";
  }
  const suffix = units === "metric" ? "m/s" : units === "imperial" ? "mph" : "m/s";
  return `${Math.round(speed)} ${suffix}`;
}

function formatDate(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

function formatSunEvent(
  unix: number | null,
  offset: number | null,
  label: string
) {
  if (!unix) {
    return `${label}: —`;
  }
  const timezoneOffset = offset ?? 0;
  const date = new Date((unix + timezoneOffset) * 1000);
  return `${label}: ${formatDate(date, {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function resolveWeatherIcon(iconCode: string | null) {
  if (!iconCode) {
    return null;
  }
  return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
}

export function Dashboard() {
  const plantTasks = [
    { id: 1, name: "Mist the ferns to boost humidity", status: "Today" },
    { id: 2, name: "Rotate monstera toward the window", status: "Today" },
    { id: 3, name: "Check soil moisture for snake plant", status: "Tomorrow" },
    { id: 4, name: "Fertilize pothos cuttings", status: "Friday" },
  ];

  const plantMetrics = [
    { label: "Hydration", value: 72 },
    { label: "Light Exposure", value: 86 },
    { label: "Nutrients", value: 64 },
    { label: "Growth Rate", value: 58 },
  ];

  const upcomingHighlights = [
    "Propagation tray check-in",
    "Repotting window for fiddle leaf fig",
    "Quarterly soil refresh for herbs",
  ];

  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [weatherError, setWeatherError] = useState<string>("");
  const [weatherLoading, setWeatherLoading] = useState<boolean>(true);
  const [scanSessions, setScanSessions] = useState<ScanSession[]>([]);
  const [scanError, setScanError] = useState<string>("");
  const [scanLoading, setScanLoading] = useState<boolean>(true);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const intervalId = window.setInterval(tick, 1000);
    tick();
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchWeather() {
      try {
        setWeatherLoading(true);
        setWeatherError("");
        const response = await fetch("/api/weather/", {
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          const message =
            errorBody?.detail ||
            `Failed to load weather data (status ${response.status}).`;
          throw new Error(message);
        }

        const body = (await response.json()) as WeatherResponse;
        setWeather(body);
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
        setWeatherError((error as Error).message);
      } finally {
        setWeatherLoading(false);
      }
    }

    fetchWeather();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchSessions() {
      try {
        setScanLoading(true);
        setScanError("");
        const response = await fetch("/api/scans/sessions/", {
          signal: controller.signal,
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(
            body?.detail || `Failed to load scans (status ${response.status}).`
          );
        }
        const body = (await response.json()) as ScanSession[];
        setScanSessions(body);
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
        setScanError((error as Error).message);
      } finally {
        setScanLoading(false);
      }
    }

    fetchSessions();
    return () => controller.abort();
  }, []);

  const formattedTime = useMemo(
    () =>
      formatDate(now, {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      }),
    [now]
  );

  const formattedDate = useMemo(
    () =>
      formatDate(now, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    [now]
  );

  const weatherHighlights = useMemo(() => {
    if (!weather) {
      return [];
    }

    return [
      formatSunEvent(weather.sunrise, weather.timezone_offset, "Sunrise"),
      formatSunEvent(weather.sunset, weather.timezone_offset, "Sunset"),
      `Humidity: ${
        weather.humidity !== null ? `${weather.humidity}%` : "—"
      }`,
      `Wind: ${formatWindSpeed(weather.wind_speed, weather.units)}`,
    ];
  }, [weather]);

  const weatherIconSrc = resolveWeatherIcon(weather?.icon ?? null);

  const formattedScans = useMemo(
    () =>
      scanSessions.map((session) => {
        const primaryArtifact = session.artifacts.find(
          (artifact) => artifact.kind === "processed_mesh"
        );
        const fallbackArtifact = session.artifacts[0];
        const artifact = primaryArtifact || fallbackArtifact;
        return {
          id: session.id,
          label: session.label || "Untitled scan",
          status: session.status,
          device:
            session.device_type ||
            (session.platform ? session.platform.toUpperCase() : "Unknown"),
          createdAt: new Date(session.created_at),
          artifact,
        };
      }),
    [scanSessions]
  );

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div>
          <h1 className="logo">heyday</h1>
          <p className="sidebar-subtitle">Plant care command center</p>
        </div>

        <section className="panel">
          <h2 className="panel-title">Today&apos;s to-do</h2>
          <ul className="task-list">
            {plantTasks.map((task) => (
              <li key={task.id} className="task-item">
                <div className="task-status" aria-hidden="true" />
                <div>
                  <p className="task-name">{task.name}</p>
                  <p className="task-meta">{task.status}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2 className="panel-title">Upcoming highlights</h2>
          <ul className="highlight-list">
            {upcomingHighlights.map((item) => (
              <li key={item} className="highlight-item">
                <span aria-hidden="true">•</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <button className="button secondary-button" type="button">
          Add task
        </button>
      </aside>

      <main className="main-content">
        <header className="top-bar">
          <div>
            <p className="subtitle">Dashboard</p>
            <h2 className="page-title">Greenhouse overview</h2>
          </div>
          <div className="time-panel">
            <p className="current-time">{formattedTime}</p>
            <p className="current-date">{formattedDate}</p>
          </div>
        </header>

        <section className="cards-grid primary-grid">
          <article className="card weather-card">
            <h3 className="card-title">Local weather</h3>
            {weatherLoading ? (
              <div className="weather-loading" aria-live="polite">
                <div className="spinner" aria-hidden="true" />
                <p>Fetching weather…</p>
              </div>
            ) : weatherError ? (
              <div className="weather-error" role="alert">
                <p>{weatherError}</p>
              </div>
            ) : weather ? (
              <>
                <div className="weather-now">
                  <div>
                    <p className="temperature">
                      {formatTemperature(weather.temperature, weather.units)}
                    </p>
                    <p className="condition">
                      {weather.description || "Current conditions"}
                    </p>
                    {weather.feels_like !== null && (
                      <p className="feels-like">
                        Feels like{" "}
                        {formatTemperature(weather.feels_like, weather.units)}
                      </p>
                    )}
                    <p className="location">{weather.location}</p>
                  </div>
                  <div className="weather-icon-wrapper" aria-hidden="true">
                    {weatherIconSrc ? (
                      <img
                        className="weather-icon"
                        src={weatherIconSrc}
                        alt=""
                      />
                    ) : (
                      <div className="weather-icon-fallback">⛅️</div>
                    )}
                  </div>
                </div>
                <ul className="weather-highlights">
                  {weatherHighlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="weather-error">Weather data is unavailable.</p>
            )}
          </article>

          <article className="card metrics-card">
            <h3 className="card-title">Plant health index</h3>
            <div className="chart-grid">
              {plantMetrics.map((metric) => (
                <div key={metric.label} className="chart-bar">
                  <div className="bar-label">
                    <span>{metric.label}</span>
                    <span>{metric.value}%</span>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${metric.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="card status-card">
            <h3 className="card-title">Environment snapshot</h3>
            <div className="status-list">
              <div>
                <p className="status-label">Grow lights</p>
                <p className="status-value success">On · 12 hrs remaining</p>
              </div>
              <div>
                <p className="status-label">Water reservoir</p>
                <p className="status-value warning">45% · Refill soon</p>
              </div>
              <div>
                <p className="status-label">Air quality</p>
                <p className="status-value">Good · 98% purity</p>
              </div>
            </div>
          </article>
        </section>

        <section className="cards-grid secondary-grid">
          <article className="card scan-card">
            <div className="card-header">
              <div>
                <p className="subtitle">Spatial capture</p>
                <h3 className="card-title">Room scans</h3>
              </div>
              <button className="button compact-button" type="button">
                New scan
              </button>
            </div>
            {scanLoading ? (
              <div className="scan-empty">Loading sessions…</div>
            ) : scanError ? (
              <div className="scan-error" role="alert">
                {scanError}
              </div>
            ) : formattedScans.length === 0 ? (
              <div className="scan-empty">
                No scans yet. Trigger a capture from the mobile app to see it
                land here.
              </div>
            ) : (
              <ul className="scan-list">
                {formattedScans.map((scan) => (
                  <li key={scan.id} className="scan-row">
                    <div>
                      <p className="scan-label">{scan.label}</p>
                      <p className="scan-meta">
                        {scan.device} ·{" "}
                        {scan.createdAt.toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="scan-badges">
                      {scan.artifact ? (
                        <span className="status-badge muted">
                          {scan.artifact.kind.replace("_", " ")} ·{" "}
                          {scan.artifact.bytes
                            ? `${Math.round(scan.artifact.bytes / 1024 / 1024)} MB`
                            : "pending"}
                        </span>
                      ) : (
                        <span className="status-badge muted">Awaiting upload</span>
                      )}
                      <span
                        className={`status-badge ${scan.status === "ready" ? "success" : "pending"}`}
                      >
                        {scan.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="card placeholder-card">
            <h3 className="card-title">Room-by-room overview</h3>
            <p className="placeholder-text">
              Compare the health of plants in different spaces across your home.
            </p>
          </article>

          <article className="card placeholder-card">
            <h3 className="card-title">Upcoming deliveries</h3>
            <p className="placeholder-text">
              Nutrient orders, planter shipments, and soil restocks will surface
              here.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
