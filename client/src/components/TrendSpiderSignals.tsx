import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, ExternalLink, Radio, ShieldAlert } from "lucide-react";

type Direction = "bullish" | "bearish" | "neutral";
interface Signal { id: string; symbol: string; alert_name: string; event: string; direction: Direction; price: number | null; timeframe: string | null; note: string | null; status: string; chart_url: string | null; source_url: string | null; triggered_at: string; }
interface Group { symbol: string; latest: Signal; signals: Signal[]; }

const URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const POLL_MS = 10_000;

function color(direction: Direction) {
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
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

function isToday(timestamp: string) {
  const value = new Date(timestamp);
  const now = new Date();
  return value.getFullYear() === now.getFullYear() && value.getMonth() === now.getMonth() && value.getDate() === now.getDate();
}

export function TrendSpiderSignals() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(Boolean(URL && KEY));
  const [error, setError] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | Direction>("all");
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!URL || !KEY) return;
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`${URL}/rest/v1/trendspider_signal_feed?select=*&order=triggered_at.desc&limit=100`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
        if (!response.ok) throw new Error(`Signal feed returned ${response.status}`);
        const next = (await response.json()) as Signal[];
        if (!cancelled) { setSignals(next); setLastSuccess(Date.now()); setError(null); }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Signal feed unavailable");
      } finally { if (!cancelled) setLoading(false); }
    };
    load();
    const interval = window.setInterval(load, POLL_MS);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, []);

  const today = useMemo(() => signals.filter((signal) => isToday(signal.triggered_at)), [signals]);
  const groups = useMemo(() => {
    const visible = filter === "all" ? today : today.filter((signal) => signal.direction === filter);
    const bySymbol = new Map<string, Signal[]>();
    visible.forEach((signal) => bySymbol.set(signal.symbol, [...(bySymbol.get(signal.symbol) || []), signal]));
    return Array.from(bySymbol, ([symbol, items]): Group => ({ symbol, latest: items[0], signals: items }));
  }, [filter, today]);

  useEffect(() => {
    if (!groups.length) setSelectedSymbol(null);
    else if (!selectedSymbol || !groups.some((group) => group.symbol === selectedSymbol)) setSelectedSymbol(groups[0].symbol);
  }, [groups, selectedSymbol]);

  const selected = groups.find((group) => group.symbol === selectedSymbol) || groups[0];
  const configured = Boolean(URL && KEY);
  const stale = lastSuccess !== null && Date.now() - lastSuccess > POLL_MS * 3;
  const feedLabel = error ? "DISCONNECTED" : stale ? "STALE" : configured ? "LIVE" : "SETUP REQUIRED";
  const feedColor = error ? "var(--terminal-red)" : stale || !configured ? "var(--terminal-amber)" : "var(--terminal-green)";
  const counts = useMemo(() => ({ bullish: today.filter((s) => s.direction === "bullish").length, bearish: today.filter((s) => s.direction === "bearish").length, neutral: today.filter((s) => s.direction === "neutral").length }), [today]);

  return (
    <section className="rounded-lg border glass-panel overflow-hidden" style={{ background: "var(--terminal-surface)", borderColor: "var(--terminal-border)" }} data-testid="trendspider-signals">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--terminal-border)" }}>
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4" style={{ color: "var(--terminal-cyan)" }} />
          <h3 className="text-xs font-bold tracking-wider uppercase" style={{ color: "var(--text-secondary)" }}>TrendSpider Alert Gallery</h3>
          <span className="flex items-center gap-1 text-[10px] font-bold tracking-wider" style={{ color: feedColor }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: feedColor }} />{feedLabel}</span>
          <span className="text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>{today.length} TODAY</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(["all", "bullish", "bearish", "neutral"] as const).map((item) => (
            <button key={item} type="button" onClick={() => setFilter(item)} className="px-2 py-1 rounded text-[10px] font-bold uppercase" style={{ color: filter === item ? "var(--terminal-bg)" : "var(--text-muted)", background: filter === item ? "var(--terminal-cyan)" : "var(--chip-bg)" }}>
              {item} {item === "all" ? today.length : counts[item]}
            </button>
          ))}
          <a href="https://trendspider.com/" target="_blank" rel="noreferrer" className="ml-1 p-1 opacity-60 hover:opacity-100" aria-label="Open TrendSpider"><ExternalLink className="w-3.5 h-3.5" /></a>
        </div>
      </div>

      {!configured ? (
        <div className="flex items-start gap-3 p-5 text-xs"><ShieldAlert className="w-4 h-4 mt-0.5" style={{ color: "var(--terminal-amber)" }} /><div><p className="font-bold mb-1" style={{ color: "var(--text-secondary)" }}>Signal receiver is not connected.</p><p style={{ color: "var(--text-muted)" }}>Add the Supabase variables described in TRENDSPIDER_SETUP.md.</p></div></div>
      ) : loading ? (
        <div className="p-5 flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}><Activity className="w-4 h-4 animate-pulse" /> Connecting to signal feed…</div>
      ) : error && !signals.length ? (
        <div className="p-5 text-xs" style={{ color: "var(--terminal-red)" }}>{error}</div>
      ) : !groups.length ? (
        <div className="p-8 text-center"><BarChart3 className="w-7 h-7 mx-auto mb-3 opacity-50" style={{ color: "var(--terminal-cyan)" }} /><p className="text-xs font-bold mb-1" style={{ color: "var(--text-secondary)" }}>No matching alerts today</p><p className="text-[11px]" style={{ color: "var(--text-muted)" }}>New TrendSpider webhook alerts will appear here automatically.</p></div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-5 min-h-[340px]">
          <div className="xl:col-span-3 p-3 border-b xl:border-b-0 xl:border-r" style={{ borderColor: "var(--terminal-border)" }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {(showAll ? groups : groups.slice(0, 6)).map((group) => (
                <button key={group.symbol} type="button" onClick={() => setSelectedSymbol(group.symbol)} className="text-left rounded-md border p-3 min-h-[132px]" style={{ borderColor: selected?.symbol === group.symbol ? color(group.latest.direction) : "var(--terminal-border)", background: selected?.symbol === group.symbol ? "var(--overlay-subtle)" : "var(--terminal-bg)" }}>
                  <div className="flex items-start justify-between gap-2 mb-3"><div><span className="font-bold text-base" style={{ color: "var(--terminal-cyan)" }}>{group.symbol}</span><span className="ml-2 text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>{group.latest.timeframe || "—"}</span></div>{group.signals.length > 1 && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ color: "var(--text-muted)", background: "var(--chip-bg)" }}>{group.signals.length} updates</span>}</div>
                  <p className="text-xs font-medium line-clamp-2 mb-2" style={{ color: "var(--text-secondary)" }}>{group.latest.alert_name}</p>
                  <p className="text-[10px] uppercase font-bold" style={{ color: color(group.latest.direction) }}>{group.latest.direction} · {group.latest.event.replaceAll("_", " ")}</p>
                  <div className="flex justify-between mt-3 text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}><span>{group.latest.price === null ? "No price" : `$${group.latest.price.toLocaleString()}`}</span><span>{relativeTime(group.latest.triggered_at)}</span></div>
                </button>
              ))}
            </div>
            {groups.length > 6 && <button type="button" onClick={() => setShowAll((value) => !value)} className="w-full mt-3 py-2 text-[10px] font-bold uppercase" style={{ color: "var(--terminal-cyan)" }}>{showAll ? "Show fewer" : `Show all ${groups.length} tickers`}</button>}
          </div>

          {selected && <div className="xl:col-span-2 p-4 flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-3"><div><div className="flex items-baseline gap-2"><span className="text-xl font-bold" style={{ color: "var(--terminal-cyan)" }}>{selected.symbol}</span><span className="text-[10px] uppercase" style={{ color: "var(--text-muted)" }}>{selected.latest.timeframe || "Timeframe unavailable"}</span></div><p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{selected.latest.alert_name}</p></div><span className="text-[10px] uppercase font-bold" style={{ color: color(selected.latest.direction) }}>{selected.latest.direction}</span></div>
            {selected.latest.chart_url ? (
              <a href={selected.latest.source_url || selected.latest.chart_url} target="_blank" rel="noreferrer" className="block rounded-md overflow-hidden border mb-3" style={{ borderColor: "var(--terminal-border)" }}><img src={selected.latest.chart_url} alt={`${selected.symbol} TrendSpider chart`} className="w-full max-h-[300px] object-contain" style={{ background: "var(--terminal-bg)" }} /></a>
            ) : (
              <div className="flex-1 min-h-[170px] rounded-md border border-dashed flex flex-col items-center justify-center text-center px-5 mb-3" style={{ borderColor: "var(--terminal-border)", background: "var(--terminal-bg)" }}><BarChart3 className="w-8 h-8 mb-3 opacity-40" style={{ color: "var(--terminal-cyan)" }} /><p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Chart preview not supplied</p><p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Add chart_url to the webhook payload to display an image.</p></div>
            )}
            <div className="space-y-2">{selected.signals.slice(0, 4).map((signal) => <div key={signal.id} className="flex items-start justify-between gap-3 border-t pt-2 text-[10px]" style={{ borderColor: "var(--terminal-border)" }}><div><span className="font-bold uppercase" style={{ color: color(signal.direction) }}>{signal.event.replaceAll("_", " ")}</span>{signal.note && <p className="mt-0.5 line-clamp-1" style={{ color: "var(--text-muted)" }}>{signal.note}</p>}</div><span className="whitespace-nowrap tabular-nums" style={{ color: "var(--text-muted)" }}>{relativeTime(signal.triggered_at)}</span></div>)}</div>
            {selected.latest.source_url && <a href={selected.latest.source_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase" style={{ color: "var(--terminal-cyan)" }}>Open source <ExternalLink className="w-3 h-3" /></a>}
          </div>}
        </div>
      )}
    </section>
  );
}
