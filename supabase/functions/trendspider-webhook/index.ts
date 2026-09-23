import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function direction(value: unknown): "bullish" | "bearish" | "neutral" {
  const normalized = text(value).toLowerCase();
  if (["bullish", "buy", "long", "entry", "in_position"].includes(normalized)) return "bullish";
  if (["bearish", "sell", "short", "exit", "not_in_position"].includes(normalized)) return "bearish";
  return "neutral";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    const payload = await request.json();
    const expectedSecret = Deno.env.get("TRENDSPIDER_WEBHOOK_SECRET");
    if (!expectedSecret || payload.secret !== expectedSecret) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const symbol = text(payload.symbol).toUpperCase();
    const alertName = text(payload.alert ?? payload.alert_name, "TrendSpider Alert");
    if (!symbol || symbol.length > 20) {
      return Response.json({ error: "A valid symbol is required" }, { status: 400, headers: corsHeaders });
    }

    const numericPrice = Number(payload.price);
    const sanitizedPayload = { ...payload };
    delete sanitizedPayload.secret;
    const record = {
      symbol,
      alert_name: alertName.slice(0, 160),
      event: text(payload.event, "alert_triggered").slice(0, 80),
      direction: direction(payload.direction ?? payload.status),
      price: Number.isFinite(numericPrice) ? numericPrice : null,
      timeframe: text(payload.timeframe).slice(0, 40) || null,
      note: text(payload.note).slice(0, 1000) || null,
      status: text(payload.status, "triggered").slice(0, 80),
      triggered_at: payload.triggered_at || new Date().toISOString(),
      raw_payload: sanitizedPayload,
    };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await supabase.from("trendspider_signals").insert(record).select("id").single();
    if (error) throw error;

    return Response.json({ accepted: true, id: data.id }, { status: 202, headers: corsHeaders });
  } catch (error) {
    console.error("TrendSpider webhook error", error);
    return Response.json({ error: "Invalid webhook payload" }, { status: 400, headers: corsHeaders });
  }
});
