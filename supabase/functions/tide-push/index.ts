// 潮汐釣魚村：推播通知（Supabase Edge Function，名稱 tide-push）
// - action 'pub'：回傳公開金鑰（玩家訂閱用）；金鑰第一次執行時自動產生，存在 push_vapid（只有伺服器讀得到）
// - action 'test'：要登入，送一則「通知開啟成功」給自己
// - action 'flush'：只給排程叫（header x-cron-secret 要跟 push_secret 表裡的一樣），把 push_queue 裡還沒送的通知送出去
// 部署時把「Verify JWT」關掉（這支程式自己檢查登入和密碼）
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const GAME_URL = "https://a20051024941024-ctrl.github.io/tide-village/";
let keys: { pub: string; priv: string } | null = null;

async function getKeys() {
  if (keys) return keys;
  let { data } = await db.from("push_vapid").select("pub,priv").eq("id", 1).maybeSingle();
  if (!data) {
    const k = webpush.generateVAPIDKeys();
    await db.from("push_vapid").insert({ id: 1, pub: k.publicKey, priv: k.privateKey });
    ({ data } = await db.from("push_vapid").select("pub,priv").eq("id", 1).maybeSingle());
  }
  keys = data as { pub: string; priv: string };
  webpush.setVapidDetails("mailto:noreply@tide-village.app", keys.pub, keys.priv);
  return keys;
}

type Sub = { endpoint: string; sub: unknown; prefs: Record<string, boolean> | null };
async function sendSubs(subs: Sub[], kind: string, msg: { title: string; body: string }) {
  let sent = 0;
  for (const s of subs) {
    if (s.prefs && s.prefs[kind] === false) continue;
    try {
      await webpush.sendNotification(s.sub as webpush.PushSubscription, JSON.stringify({ ...msg, kind, url: GAME_URL }));
      sent++;
      await db.from("push_subs").update({ last_at: new Date().toISOString() }).eq("endpoint", s.endpoint);
    } catch (e) {
      const sc = (e as { statusCode?: number })?.statusCode;
      if (sc === 404 || sc === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint);
    }
  }
  return sent;
}

// 合併過的通知：改成「賣出 3 件」「3 位朋友來玩」這樣
function textOf(q: { kind: string; title: string; body: string; n: number; amt: number }) {
  if (q.n > 1 && q.kind === "design") return { title: "👕 你的設計賣出了", body: `你的設計賣出 ${q.n} 件${q.amt > 0 ? `，+${q.amt} 金幣` : ""}` };
  if (q.n > 1 && q.kind === "visit") return { title: "🏝 有人來你的小島", body: `有 ${q.n} 位朋友來你的小島玩了` };
  return { title: q.title || "潮汐釣魚村", body: q.body || "" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const body = await req.json().catch(() => ({}));
    const k = await getKeys();
    if (body.action === "pub") return json({ pub: k.pub });
    if (body.action === "flush") {
      const { data: sec } = await db.from("push_secret").select("secret").eq("id", 1).maybeSingle();
      if (!sec || req.headers.get("x-cron-secret") !== sec.secret) return json({ error: "forbidden" }, 403);
      const { data: qs } = await db.from("push_queue").select("id,uid,kind,title,body,n,amt").is("sent_at", null).order("id").limit(200);
      let sent = 0, all: Sub[] | null = null;
      for (const q of qs || []) {
        // 個人通知：同一種 10 分鐘內只送一次，這段時間的事先留著（資料庫會合併成一則），時間到了再送；全服的馬上送
        if (q.uid) {
          const { data: last } = await db.from("push_queue").select("sent_at").eq("uid", q.uid).eq("kind", q.kind).not("sent_at", "is", null).order("sent_at", { ascending: false }).limit(1).maybeSingle();
          if (last && Date.now() - Date.parse(last.sent_at) < 10 * 60 * 1000) continue;
        }
        await db.from("push_queue").update({ sent_at: new Date().toISOString() }).eq("id", q.id);
        if (q.uid) {
          const { data: subs } = await db.from("push_subs").select("endpoint,sub,prefs").eq("uid", q.uid);
          sent += await sendSubs((subs || []) as Sub[], q.kind, textOf(q));
        } else {
          if (!all) { const { data } = await db.from("push_subs").select("endpoint,sub,prefs").limit(5000); all = (data || []) as Sub[]; }
          sent += await sendSubs(all, q.kind, textOf(q));
        }
      }
      return json({ sent, n: (qs || []).length });
    }
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await db.auth.getUser(jwt);
    const me = u?.user?.id;
    if (!me) return json({ error: "not signed in" }, 401);
    if (body.action === "test") {
      const { data: subs } = await db.from("push_subs").select("endpoint,sub,prefs").eq("uid", me);
      const sent = await sendSubs((subs || []) as Sub[], "test", { title: "🔔 通知開啟成功", body: "有人釣到紅鯊、大賽快開始、設計賣出、有人來你的小島時，會這樣通知你。" });
      return json({ sent });
    }
    return json({ error: "bad action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
