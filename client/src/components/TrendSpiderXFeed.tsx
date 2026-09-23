import { useEffect, useRef } from "react";
import { ExternalLink, MessageCircle } from "lucide-react";

declare global {
  interface Window {
    twttr?: { widgets?: { load: (element?: HTMLElement) => void } };
  }
}

const WIDGET_SCRIPT_ID = "x-widgets-script";

export function TrendSpiderXFeed() {
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadWidget = () => {
      if (feedRef.current) window.twttr?.widgets?.load(feedRef.current);
    };
    const existing = document.getElementById(WIDGET_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.twttr?.widgets) loadWidget();
      else existing.addEventListener("load", loadWidget, { once: true });
      return () => existing.removeEventListener("load", loadWidget);
    }

    const script = document.createElement("script");
    script.id = WIDGET_SCRIPT_ID;
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    script.charset = "utf-8";
    script.addEventListener("load", loadWidget, { once: true });
    document.body.appendChild(script);
    return () => script.removeEventListener("load", loadWidget);
  }, []);

  return (
    <section className="rounded-lg border glass-panel overflow-hidden" style={{ background: "var(--terminal-surface)", borderColor: "var(--terminal-border)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--terminal-border)" }}>
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4" style={{ color: "var(--terminal-cyan)" }} />
          <h3 className="text-xs font-bold tracking-wider uppercase" style={{ color: "var(--text-secondary)" }}>TrendSpider Market Charts</h3>
          <span className="text-[10px] font-bold tracking-wider" style={{ color: "var(--text-muted)" }}>PUBLIC X FEED</span>
        </div>
        <a href="https://x.com/TrendSpider" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold uppercase" style={{ color: "var(--terminal-cyan)" }}>Open on X <ExternalLink className="w-3 h-3" /></a>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5">
        <div className="xl:col-span-1 p-4 border-b xl:border-b-0 xl:border-r" style={{ borderColor: "var(--terminal-border)" }}>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>Public charts and market observations posted by TrendSpider.</p>
          <p className="text-[10px] leading-relaxed mt-3" style={{ color: "var(--text-muted)" }}>These posts are not personalized alerts and do not affect the market-quality score. X may require cookies or sign-in to display its embedded timeline.</p>
        </div>
        <div ref={feedRef} className="xl:col-span-4 min-h-[420px] max-h-[620px] overflow-y-auto p-3" style={{ background: "var(--terminal-bg)" }}>
          <a
            className="twitter-timeline"
            data-theme="dark"
            data-chrome="noheader nofooter noborders transparent"
            data-dnt="true"
            data-height="580"
            data-tweet-limit="8"
            href="https://twitter.com/TrendSpider"
          >
            View TrendSpider’s latest public market charts on X
          </a>
        </div>
      </div>
    </section>
  );
}
