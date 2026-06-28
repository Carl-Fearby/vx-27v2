import Link from "next/link";

export default function MarketingHome() {
  return (
    <main className="marketing-home">
      <img
        className="marketing-logo"
        src="/ui/logo.png"
        alt="VX-27 Power Core"
        width={1024}
        height={1024}
      />
      <section className="marketing-copy" aria-labelledby="marketing-title">
        <p className="marketing-kicker">Prototype deployment</p>
        <h1 id="marketing-title">VX-27</h1>
        <p>
          Tactical sci-fi FPS prototype with Babylon.js rendering, Rust-powered
          game logic, and a growing industrial arena.
        </p>
        <div className="marketing-actions">
          <Link href="/game" className="marketing-play-link">
            Play
          </Link>
          <Link href="/object-editor" className="marketing-play-link marketing-play-link--secondary">
            Object Editor
          </Link>
        </div>
      </section>
    </main>
  );
}
