import React from "react";

export function Dashboard() {
  const plantTasks = [
    { id: 1, name: "Mist the ferns to boost humidity", status: "Today" },
    { id: 2, name: "Rotate monstera toward the window", status: "Today" },
    { id: 3, name: "Check soil moisture for snake plant", status: "Tomorrow" },
    { id: 4, name: "Fertilize pothos cuttings", status: "Friday" },
  ];

  const weatherNow = {
    temperature: "72°",
    condition: "Partly sunny",
    humidity: "61%",
    wind: "4 mph E",
  };

  const weeklyWeather = [
    { day: "Mon", icon: "🌤", high: "75°", low: "64°" },
    { day: "Tue", icon: "🌧", high: "68°", low: "60°" },
    { day: "Wed", icon: "⛅️", high: "70°", low: "61°" },
    { day: "Thu", icon: "🌦", high: "66°", low: "58°" },
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
          <button className="button" type="button">
            Sync devices
          </button>
        </header>

        <section className="cards-grid primary-grid">
          <article className="card weather-card">
            <h3 className="card-title">Local weather</h3>
            <div className="weather-now">
              <div>
                <p className="temperature">{weatherNow.temperature}</p>
                <p className="condition">{weatherNow.condition}</p>
              </div>
              <dl className="weather-metrics">
                <div>
                  <dt>Humidity</dt>
                  <dd>{weatherNow.humidity}</dd>
                </div>
                <div>
                  <dt>Wind</dt>
                  <dd>{weatherNow.wind}</dd>
                </div>
              </dl>
            </div>
            <ul className="forecast">
              {weeklyWeather.map((entry) => (
                <li key={entry.day}>
                  <span className="forecast-day">{entry.day}</span>
                  <span className="forecast-icon" role="img" aria-label="weather">
                    {entry.icon}
                  </span>
                  <span className="forecast-temp">
                    {entry.high} / {entry.low}
                  </span>
                </li>
              ))}
            </ul>
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
          <article className="card placeholder-card">
            <h3 className="card-title">Plant journal</h3>
            <p className="placeholder-text">
              Daily notes, photo uploads, and milestone tracking will appear here.
            </p>
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
              Nutrient orders, planter shipments, and soil restocks will surface here.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
