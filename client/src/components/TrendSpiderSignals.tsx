import { useEffect, useMemo, useState } from "react";
import { Activity, ExternalLink, Radio, ShieldAlert } from "lucide-react";

type SignalDirection = "bullish" | "bearish" | "neutral";

interface TrendSpiderSignal {
  id: string;
  symbol: string;
  alert_name: string;
  event: string;
  direction: SignalDirection;
  price: number | null;
  timeframe: string | null;
  note: string | null;
  status: string;
  triggered_at: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const POLL_INTERVAL_MS = 10_000;

function directionColor(direction: SignalDirection) {
  if (direction === "bullish") return "var(--terminal-green)";
  if (direction === "bearish") return "var(--terminal-red)";
  return "var(--terminal-amber)";
}

function relativeTime(timestamp: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function TrendSpiderSignals() {
  const [signals, setSignals] = useState<TrendSpiderSignal[]>([]);
  const [loading, setLoading] = useState(Boolean(SUPABASE_URL && SUPABASE_ANON_KEY));
  const [error, setError] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState<number | null>(null);
  const [directionFilter, setDirectionFilter] = useState<"all" | SignalDirection>("all");

  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/trendspider_signal_feed?select=*&order=triggered_at.desc&limit=50`,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          },
        );
        if (!response.ok) throw new Error(`Signal feed returned ${response.status}`);
        const nextSignals = (await response.json()) as TrendSpiderSignal[];
        if (!cancelled) {
          setSignals(nextSignals);
          setLastSuccess(Date.now());
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Signal feed unavailable");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const interval = window.setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const visibleSignals = useMemo(
    () => directionFilter === "all" ? signals : signals.filter((signal) => signal.direction === directionFilter),
    [directionFilter, signals],
  );

  const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
  const stale = lastSuccess !== null && Date.now() - lastSuccess > POLL_INTERVAL_MS * 3;
  const feedLabel = error ? "DISCONNECTED" : stale ? "STALE" : configured ? "LIVE" : "SETUP REQUIRED";
  const feedColor = error ? "var(--terminal-red)" : stale || !configured ? "var(--terminal-amber)" : "var(--terminal-green)";

  return (
    <section
      className="rounded-lg border glass-panel overflow-hidden"
      style={{ background: "var(--terminal-surface)", borderColor: "var(--terminal-border)" }}
      data-testid="trendspider-signals"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--terminal-border)" }}>
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4" style={{ color: "var(--terminal-cyan)" }} />
          <h3 className="text-xs font-bold tracking-wider uppercase" style={{ color: "var(--text-secondary)" }}>
            TrendSpider Signals
          </h3>
          <span className="flex items-center gap-1 text-[10px] font-bold tracking-wider" style={{ color: feedColor }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: feedColor }} />
            {feedLabel}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {(["all", "bullish", "bearish", "neutral"] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setDirectionFilter(filter)}
              className="px-2 py-1 rounded text-[10px] font-bold uppercase transition-opacity"
              style={{
                color: directionFilter === filter ? "var(--terminal-bg)" : "var(--text-muted)",
                background: directionFilter === filter ? "var(--terminal-cyan)" : "var(--chip-bg)",
              }}
            >
              {filter}
            </button>
          ))}
          <a
            href="https://trendspider.com/"
            target="_blank"
            rel="noreferrer"
            className="ml-1 p-1 opacity-60 hover:opacity-100"
            aria-label="Open TrendSpider"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {!configured ? (
        <div className="flex items-start gap-3 p-5 text-xs">
          <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--terminal-amber)" }} />
          <div>
            <p className="font-bold mb-1" style={{ color: "var(--text-secondary)" }}>Signal receiver is not connected.</p>
            <p style={{ color: "var(--text-muted)" }}>Add the Supabase URL and anonymous key described in TRENDSPIDER_SETUP.md, then rebuild the dashboard.</p>
          </div>
        </div>
      ) : loading ? (
        <div className="p-5 flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <Activity className="w-4 h-4 animate-pulse" /> Connecting to signal feed…
        </div>
      ) : error && signals.length === 0 ? (
        <div className="p-5 text-xs" style={{ color: "var(--terminal-red)" }}>{error}</div>
      ) : visibleSignals.length === 0 ? (
        <div className="p-5 text-xs" style={{ color: "var(--text-muted)" }}>No matching TrendSpider signals yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-xs">
            <thead style={{ color: "var(--text-muted)", background: "var(--overlay-subtle)" }}>
              <tr className="text-left uppercase tracking-wider">
                <th className="px-4 py-2 font-medium">Symbol</th>
                <th className="px-3 py-2 font-medium">Signal</th>
                <th className="px-3 py-2 font-medium">Event</th>
                <th className="px-3 py-2 font-medium">Timeframe</th>
                <th className="px-3 py-2 font-medium text-right">Price</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Triggered</th>
              </tr>
            </thead>
            <tbody>
              {visibleSignals.map((signal) => (
                <tr key={signal.id} className="border-t" style={{ borderColor: "var(--terminal-border)" }} title={signal.note || undefined}>
                  <td className="px-4 py-2.5 font-bold" style={{ color: "var(--terminal-cyan)" }}>{signal.symbol}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium" style={{ color: "var(--text-secondary)" }}>{signal.alert_name}</div>
                    <div className="uppercase text-[10px] font-bold" style={{ color: directionColor(signal.direction) }}>{signal.direction}</div>
                  </td>
                  <td className="px-3 py-2.5" style={{ color: "var(--text-secondary)" }}>{signal.event.replaceAll("_", " ")}</td>
                  <td className="px-3 py-2.5" style={{ color: "var(--text-muted)" }}>{signal.timeframe || "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>
                    {signal.price === null ? "—" : `$${signal.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}`}
                  </td>
                  <td className="px-3 py-2.5 uppercase text-[10px] font-bold" style={{ color: directionColor(signal.direction) }}>{signal.status}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{relativeTime(signal.triggered_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
