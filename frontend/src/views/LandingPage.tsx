import React, { useState } from "react";

export function LandingPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim()) {
      return;
    }

    setSubmitted(true);
    setEmail("");
  };

  return (
    <div className="landing-page">
      <header className="hero">
        <h1 className="logo">heyday</h1>
        <p className="tagline">
          Tools that help knowledge workers capture, surface, and remember what matters.
        </p>
      </header>

      <section className="signup">
        <form className="signup-form" onSubmit={handleSubmit}>
          <label className="visually-hidden" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            type="email"
            className="input"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <button className="button" type="submit">
            Notify me
          </button>
        </form>
        {submitted && (
          <p className="confirmation">Thanks! We will be in touch soon.</p>
        )}
      </section>

      <div className="login-redirect">
        <a className="button secondary-button" href="/dashboard/">
          Continue to dashboard
        </a>
      </div>
    </div>
  );
}

export default LandingPage;
