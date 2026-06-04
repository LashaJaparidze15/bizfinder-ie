export default function HomePage() {
  return (
    <main className="container">
      <h1>Find any Irish business</h1>
      <p className="muted">Search by name, type, town, or phone number.</p>

      <form className="search-form" action="/search" method="get">
        <input name="q" placeholder="e.g. hotel, plumber, cafe" aria-label="Search term" />
        <input name="county" placeholder="County (optional)" aria-label="County" />
        <button type="submit">Search</button>
      </form>

      <form className="search-form" action="/search" method="get" style={{ marginTop: 4 }}>
        <input name="phone" placeholder="Reverse lookup: phone number" aria-label="Phone number" />
        <button type="submit">Look up</button>
      </form>
    </main>
  );
}
