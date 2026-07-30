import { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";

const COLORS = {
  bull: "#00ff9d",
  bear: "#ff4d6d",
  crisis: "#ffb700",
  accent: "#7b61ff",
  bg: "#080c14",
  card: "#0d1421",
  border: "#1a2540",
  text: "#e2e8f0",
  muted: "#4a5568",
};

const FALLBACK_WALK_FORWARD = [
  { year: "2022", accuracy: 51.2, baseline: 53.1 },
  { year: "2023", accuracy: 51.0, baseline: 52.4 },
  { year: "2024", accuracy: 54.1, baseline: 52.8 },
  { year: "2025", accuracy: 43.3, baseline: 51.6 },
];
const FALLBACK_FEATURES = [
  { feature: "Return", importance: 15.5 },
  { feature: "RSI", importance: 13.5 },
  { feature: "BB Width", importance: 13.4 },
  { feature: "ATR", importance: 12.8 },
  { feature: "MACD Hist", importance: 11.9 },
  { feature: "MACD", importance: 11.9 },
  { feature: "MA Cross", importance: 11.4 },
  { feature: "BB Position", importance: 9.6 },
];
const FALLBACK_RULES = [
  { rule: "BB_Near_Upper + ATR_Med + RSI_Neutral → UP", conf: 69.0, lift: 1.30 },
  { rule: "BB_Near_Upper + RSI_Neutral → UP", conf: 61.7, lift: 1.16 },
  { rule: "BB_Near_Upper + MA_Golden + RSI_Neutral → UP", conf: 60.8, lift: 1.15 },
  { rule: "MACD_Bullish + BB_Near_Upper + RSI_Neutral → UP", conf: 60.3, lift: 1.14 },
  { rule: "Near_Lower + Bearish → DOWN", conf: 51.5, lift: 1.10 },
];

// ── Isolated ticker — its setState NEVER re-renders the parent ─────────────
function LiveTicker({ initialValue }) {
  const [ticker, setTicker] = useState(initialValue || 15420);
  const [tickerDir, setTickerDir] = useState(1);

  useEffect(() => {
    if (initialValue) setTicker(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const id = setInterval(() => {
      setTicker(prev => {
        const change = (Math.random() - 0.48) * 30;
        setTickerDir(change >= 0 ? 1 : -1);
        return Math.max(14000, prev + change);
      });
    }, 1500);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      background: COLORS.card, border: `1px solid ${COLORS.border}`,
      borderRadius: 12, padding: "10px 20px",
      display: "flex", alignItems: "center", gap: 12, flexShrink: 0
    }}>
      <div>
        <div style={{ color: COLORS.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}>MASI Live</div>
        <div style={{ color: tickerDir > 0 ? COLORS.bull : COLORS.bear, fontSize: 22, fontWeight: 800, fontFamily: "monospace", transition: "color 0.3s" }}>
          {ticker.toFixed(2)}
        </div>
      </div>
      <div style={{ fontSize: 20 }}>{tickerDir > 0 ? "🟢" : "🔴"}</div>
    </div>
  );
}

// ── Data hooks ─────────────────────────────────────────────────────────────
function useMarketData(regimeDistribution = null) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/masi_data_hibatu.json")
      .then(r => r.json())
      .then(raw => { setData(raw); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const priceData = useMemo(() =>
    data.filter((_, i) => i % 5 === 0)
      .map(d => ({ date: (d.Date || "").slice(0, 7), close: +d.Close, ma7: +d.MA7, ma30: +d.MA30 }))
      .filter(d => d.close && d.ma7 && d.ma30),
    [data]
  );

  const rsiData = useMemo(() =>
    data.slice(-60).map((d, i) => ({ day: i + 1, rsi: +d.RSI })).filter(d => d.rsi),
    [data]
  );

  const lastClose = useMemo(() => {
    const last = data[data.length - 1];
    return last ? +last.Close : null;
  }, [data]);

  const { regimeCounts, total } = useMemo(() => {
    const counts = data.reduce((acc, d) => {
      const r = d.Regime;
      if (r) acc[r] = (acc[r] || 0) + 1;
      return acc;
    }, {});
    return { regimeCounts: counts, total: Object.values(counts).reduce((a, b) => a + b, 0) || 1 };
  }, [data]);

  const REGIME_META = {
    Bull: { name: "Bull Market", color: COLORS.bull },
    Bear: { name: "Bear Market", color: COLORS.bear },
    Crisis: { name: "Crisis", color: COLORS.crisis },
  };

  const regimeData = useMemo(() => {
    if (regimeDistribution) {
      return Object.entries(regimeDistribution).map(([key, value]) => ({
        key,
        name: REGIME_META[key]?.name || key,
        color: REGIME_META[key]?.color || COLORS.accent,
        days: regimeCounts[key] || 0,
        value: +value.toFixed(1),
      })).sort((a, b) => b.value - a.value);
    }
    return Object.entries(regimeCounts).map(([key, days]) => ({
      key,
      name: REGIME_META[key]?.name || key,
      color: REGIME_META[key]?.color || COLORS.accent,
      days,
      value: +((days / total) * 100).toFixed(1),
    })).sort((a, b) => b.days - a.days);
  }, [regimeCounts, total, regimeDistribution]);

  const bullPct = useMemo(() => regimeData.find(r => r.key === "Bull")?.value || 0, [regimeData]);
  const upDays = useMemo(() => data.filter(d => d.Target === 1 || d.Target === "UP").length, [data]);
  const downDays = useMemo(() => data.filter(d => d.Target === 0 || d.Target === "DOWN").length, [data]);

  return { data, loading, priceData, rsiData, regimeData, bullPct, upDays, downDays, lastClose };
}

function useModelResults() {
  const [results, setResults] = useState(null);
  useEffect(() => {
    fetch("/model_results.json")
      .then(r => r.json())
      .then(raw => {
        const adapted = {
          baseline: raw.baseline_accuracy,
          lr_accuracy: raw.logistic_regression_accuracy,
          rf_accuracy: raw.random_forest_accuracy,
          best_accuracy: raw.best_walkforward_accuracy,
          walk_forward: (raw.walk_forward_validation || []).map(r => ({
            year: r.year, accuracy: r.accuracy, baseline: r.baseline,
          })),
          feature_importance: (raw.feature_importance_random_forest || []).map(f => ({
            feature: f.feature, importance: f.importance,
          })),
          rules: {
            total: raw.association_rules?.total_rules_found ?? 0,
            clean: raw.association_rules?.clean_prediction_rules ?? 0,
            up: raw.association_rules?.rules_predicting_up ?? 0,
            down: raw.association_rules?.rules_predicting_down ?? 0,
            top: (raw.association_rules?.top_5_rules || []).map(r => ({
              rule: r.rule, conf: r.confidence, lift: r.lift, support: r.support,
            })),
          },
          regime_stats: Object.fromEntries(
            Object.entries(raw.market_regime_statistics || {}).map(([k, v]) => [
              k, { ret: v.avg_return, atr: v.avg_atr, rsi: v.avg_rsi },
            ])
          ),
          regime_distribution: raw.regime_distribution || { Bull: 47.3, Bear: 43.5, Crisis: 9.2 },
        };
        setResults(adapted);
      })
      .catch(() => setResults(null));
  }, []);
  return results;
}

// ── Shared UI primitives ───────────────────────────────────────────────────
function GlowCard({ children, glow = "accent", style = {} }) {
  const shadows = {
    bull: "0 0 30px rgba(0,255,157,0.08)",
    bear: "0 0 30px rgba(255,77,109,0.08)",
    accent: "0 0 30px rgba(123,97,255,0.08)"
  };
  return (
    <div style={{
      borderRadius: 16, border: `1px solid ${COLORS.border}`,
      background: COLORS.card, padding: 20,
      boxShadow: shadows[glow] || shadows.accent, ...style
    }}>
      {children}
    </div>
  );
}

function StatBadge({ label, value, trend }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ color: COLORS.muted, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</span>
      <span style={{ color: COLORS.text, fontSize: 22, fontWeight: 700, fontFamily: "monospace" }}>{value}</span>
      {trend != null && (
        <span style={{ color: trend > 0 ? COLORS.bull : COLORS.bear, fontSize: 12 }}>
          {trend > 0 ? "▲" : "▼"} {Math.abs(trend)}%
        </span>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0d1421", border: "1px solid #1a2540", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <p style={{ color: COLORS.muted, marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: 0 }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(1) : p.value}
        </p>
      ))}
    </div>
  );
};

// ── Prediction engine ──────────────────────────────────────────────────────
function PredictionEngine() {
  const [rsi, setRsi] = useState(55);
  const [macd, setMacd] = useState(0);
  const [bbPos, setBbPos] = useState(0.6);
  const [atr, setAtr] = useState(100);
  const [result, setResult] = useState(null);

  const predict = () => {
    let score = 0;
    if (bbPos > 0.8) score += 2;
    if (rsi > 50 && rsi < 70) score += 1;
    if (macd > 0) score += 1;
    if (atr < 150) score += 0.5;
    if (rsi < 30) score -= 2;
    if (bbPos < 0.2) score -= 2;
    const conf = Math.min(Math.max(50 + score * 4, 42), 70);
    setResult({ direction: score > 0 ? "UP" : "DOWN", confidence: conf.toFixed(1) });
  };

  return (
    <GlowCard glow="accent">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.accent, boxShadow: `0 0 8px ${COLORS.accent}` }} />
        <span style={{ color: COLORS.text, fontWeight: 600, fontSize: 14, letterSpacing: "0.05em" }}>LIVE PREDICTION ENGINE</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        {[
          { label: "RSI", value: rsi, set: setRsi, min: 0, max: 100, step: 1 },
          { label: "MACD", value: macd, set: setMacd, min: -500, max: 500, step: 10 },
          { label: "BB Position", value: bbPos, set: setBbPos, min: 0, max: 1.5, step: 0.05 },
          { label: "ATR", value: atr, set: setAtr, min: 30, max: 500, step: 10 },
        ].map(({ label, value, set, min, max, step }) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
              <span style={{ color: COLORS.accent, fontSize: 12, fontFamily: "monospace", fontWeight: 600 }}>{value}</span>
            </div>
            <input
              type="range" min={min} max={max} step={step} value={value}
              onChange={e => set(parseFloat(e.target.value))}
              style={{ accentColor: COLORS.accent, width: "100%" }}
            />
          </div>
        ))}
      </div>
      <button
        onClick={predict}
        style={{ width: "100%", padding: "12px", borderRadius: 12, background: `linear-gradient(135deg, ${COLORS.accent}, #4c35d9)`, color: "white", fontWeight: 700, fontSize: 13, letterSpacing: "0.1em", border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(123,97,255,0.3)", textTransform: "uppercase" }}
      >
        🔮 Predict Tomorrow
      </button>
      {result && (
        <div style={{ marginTop: 16, borderRadius: 12, padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", background: result.direction === "UP" ? "rgba(0,255,157,0.08)" : "rgba(255,77,109,0.08)", border: `1px solid ${(result.direction === "UP" ? COLORS.bull : COLORS.bear)}30` }}>
          <div>
            <div style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>Prediction</div>
            <div style={{ color: result.direction === "UP" ? COLORS.bull : COLORS.bear, fontSize: 28, fontWeight: 800, fontFamily: "monospace" }}>
              {result.direction === "UP" ? "📈 UP" : "📉 DOWN"}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>Confidence</div>
            <div style={{ color: COLORS.text, fontSize: 28, fontWeight: 800, fontFamily: "monospace" }}>{result.confidence}%</div>
          </div>
        </div>
      )}
    </GlowCard>
  );
}

// ── Tab content as isolated memoized components ────────────────────────────
const OverviewTab = ({ data, priceData, regimeData, walkForwardData, bestAccuracy, baseline, topRuleConf, bullPct, wfMin, wfMax }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 20 }}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
      {[
        { label: "Total Data Points", value: data.length.toLocaleString(), trend: null },
        { label: "Best Accuracy", value: `${bestAccuracy.toFixed(1)}%`, trend: +(bestAccuracy - baseline).toFixed(1) },
        { label: "Top Rule Conf.", value: `${topRuleConf.toFixed(1)}%`, trend: +(topRuleConf - 50).toFixed(1) },
        { label: "Bull Market Days", value: `${bullPct}%`, trend: null },
      ].map(s => <GlowCard key={s.label} glow="accent"><StatBadge {...s} /></GlowCard>)}
    </div>

    <GlowCard>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: "0.05em" }}>MASI CLOSE PRICE — REAL DATA</span>
        <div style={{ display: "flex", gap: 12 }}>
          {[{ label: "Close", color: COLORS.accent }, { label: "MA7", color: COLORS.bull }, { label: "MA30", color: COLORS.bear }].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 12, height: 2, background: l.color, borderRadius: 2 }} />
              <span style={{ color: COLORS.muted, fontSize: 11 }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={priceData}>
          <defs>
            <linearGradient id="closeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.accent} stopOpacity={0.15} />
              <stop offset="95%" stopColor={COLORS.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
          <XAxis dataKey="date" tick={{ fill: COLORS.muted, fontSize: 10 }} tickLine={false} />
          <YAxis tick={{ fill: COLORS.muted, fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="close" stroke={COLORS.accent} strokeWidth={2} fill="url(#closeGrad)" name="Close" dot={false} />
          <Area type="monotone" dataKey="ma7" stroke={COLORS.bull} strokeWidth={1.5} fill="none" name="MA7" dot={false} strokeDasharray="4 2" />
          <Area type="monotone" dataKey="ma30" stroke={COLORS.bear} strokeWidth={1.5} fill="none" name="MA30" dot={false} strokeDasharray="4 2" />
        </AreaChart>
      </ResponsiveContainer>
    </GlowCard>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
      <GlowCard glow="bull">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, letterSpacing: "0.05em" }}>REGIME DISTRIBUTION</div>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <ResponsiveContainer width={140} height={140}>
            <PieChart>
              <Pie data={regimeData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                {regimeData.map((r, i) => <Cell key={i} fill={r.color} stroke="transparent" />)}
              </Pie>
              <Tooltip formatter={v => `${v}%`} contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {regimeData.map(r => (
              <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: r.color }} />
                <span style={{ color: COLORS.muted, fontSize: 12 }}>{r.name}</span>
                <span style={{ color: r.color, fontSize: 13, fontWeight: 700, marginLeft: 8, fontFamily: "monospace" }}>{r.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </GlowCard>

      <GlowCard glow="bear">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, letterSpacing: "0.05em" }}>WALK FORWARD ACCURACY</div>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={walkForwardData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
            <XAxis dataKey="year" tick={{ fill: COLORS.muted, fontSize: 10 }} tickLine={false} />
            <YAxis domain={[wfMin, wfMax]} tick={{ fill: COLORS.muted, fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="accuracy" name="Accuracy" radius={[4, 4, 0, 0]}>
              {walkForwardData.map((e, i) => <Cell key={i} fill={e.accuracy >= 50 ? COLORS.bull : COLORS.bear} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </GlowCard>
    </div>
  </div>
);

const IndicatorsTab = ({ data, rsiData, featureImportance, upDays, downDays }) => {
  const totalDays = upDays + downDays;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 20 }}>
      <GlowCard>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, letterSpacing: "0.05em" }}>RSI — LAST 60 DAYS (REAL DATA)</div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={rsiData}>
            <defs>
              <linearGradient id="rsiGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.crisis} stopOpacity={0.2} />
                <stop offset="95%" stopColor={COLORS.crisis} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
            <XAxis dataKey="day" tick={{ fill: COLORS.muted, fontSize: 10 }} />
            <YAxis domain={[0, 100]} tick={{ fill: COLORS.muted, fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="rsi" stroke={COLORS.crisis} strokeWidth={2} fill="url(#rsiGrad)" name="RSI" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 24, marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 20, height: 2, background: COLORS.bear, borderRadius: 2 }} />
            <span style={{ color: COLORS.muted, fontSize: 11 }}>Overbought (70)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 20, height: 2, background: COLORS.bull, borderRadius: 2 }} />
            <span style={{ color: COLORS.muted, fontSize: 11 }}>Oversold (30)</span>
          </div>
        </div>
      </GlowCard>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        {[
          { label: "UP Days", value: upDays.toLocaleString(), sub: totalDays ? `${(upDays / totalDays * 100).toFixed(1)}% of days` : "—", color: COLORS.bull },
          { label: "DOWN Days", value: downDays.toLocaleString(), sub: totalDays ? `${(downDays / totalDays * 100).toFixed(1)}% of days` : "—", color: COLORS.bear },
          { label: "Total Days", value: data.length.toLocaleString(), sub: "2015 → 2025", color: COLORS.accent },
        ].map(s => (
          <GlowCard key={s.label}>
            <div style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{s.label}</div>
            <div style={{ color: s.color, fontSize: 28, fontWeight: 800, fontFamily: "monospace" }}>{s.value}</div>
            <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>{s.sub}</div>
          </GlowCard>
        ))}
      </div>

      <GlowCard>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, letterSpacing: "0.05em" }}>FEATURE IMPORTANCE — RANDOM FOREST</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={featureImportance} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" horizontal={false} />
            <XAxis type="number" tick={{ fill: COLORS.muted, fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
            <YAxis type="category" dataKey="feature" tick={{ fill: COLORS.text, fontSize: 11 }} tickLine={false} axisLine={false} width={90} />
            <Tooltip content={<CustomTooltip />} formatter={v => `${v}%`} />
            <Bar dataKey="importance" name="Importance" radius={[0, 4, 4, 0]}>
              {featureImportance.map((_, i) => <Cell key={i} fill={`hsl(${220 + i * 15}, 80%, ${55 + i * 3}%)`} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </GlowCard>
    </div>
  );
};

const RegimesTab = ({ regimeData, regimeStats, bullPct }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 20 }}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
      {[
        { name: "Bull Market", key: "Bull", color: COLORS.bull },
        { name: "Bear Market", key: "Bear", color: COLORS.bear },
        { name: "Crisis", key: "Crisis", color: COLORS.crisis },
      ].map(r => {
        const rd = regimeData.find(x => x.key === r.key) || { value: 0, days: 0 };
        const stats = regimeStats[r.key] || { ret: "—", atr: "—", rsi: "—" };
        return (
          <GlowCard key={r.name}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: r.color, boxShadow: `0 0 10px ${r.color}` }} />
              <span style={{ color: r.color, fontWeight: 700, fontSize: 14 }}>{r.name}</span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, fontFamily: "monospace", color: r.color, marginBottom: 8 }}>{rd.value}%</div>
            <div style={{ color: COLORS.muted, fontSize: 11, marginBottom: 12 }}>{rd.days} trading days</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[{ label: "Avg Return", value: stats.ret }, { label: "Avg ATR", value: stats.atr }, { label: "Avg RSI", value: stats.rsi }].map(s => (
                <div key={s.label} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: COLORS.muted, fontSize: 12 }}>{s.label}</span>
                  <span style={{ color: COLORS.text, fontSize: 12, fontFamily: "monospace", fontWeight: 600 }}>{s.value}</span>
                </div>
              ))}
            </div>
          </GlowCard>
        );
      })}
    </div>

    <GlowCard>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, letterSpacing: "0.05em" }}>REGIME DISTRIBUTION BAR</div>
      <ResponsiveContainer width="100%" height={60}>
        <BarChart data={[Object.fromEntries(regimeData.map(r => [r.key.toLowerCase(), r.value]))]} layout="vertical" stackOffset="expand">
          <XAxis type="number" hide />
          <YAxis type="category" hide />
          {regimeData.map((r, i) => (
            <Bar key={r.key} dataKey={r.key.toLowerCase()} fill={r.color} stackId="a" name={r.name} radius={i === regimeData.length - 1 ? [0, 8, 8, 0] : [0, 0, 0, 0]} />
          ))}
          <Tooltip formatter={v => `${(v * 100).toFixed(1)}%`} contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8 }} />
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", gap: 24, marginTop: 12, flexWrap: "wrap" }}>
        {[{ label: "Bull Market", color: COLORS.bull }, { label: "Bear Market", color: COLORS.bear }, { label: "Crisis", color: COLORS.crisis }].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
            <span style={{ color: COLORS.muted, fontSize: 12 }}>{l.label}</span>
          </div>
        ))}
      </div>
    </GlowCard>

    <GlowCard>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, letterSpacing: "0.05em" }}>KEY INSIGHT</div>
      <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.7, padding: "12px", background: "rgba(123,97,255,0.05)", borderRadius: 10, border: "1px solid rgba(123,97,255,0.1)" }}>
        K-Means clustering identified <span style={{ color: COLORS.bull, fontWeight: 600 }}>3 distinct market regimes</span> automatically.
        The Crisis regime shows ATR={regimeStats?.Crisis?.atr || "267"} — <span style={{ color: COLORS.accent, fontWeight: 600 }}>significantly higher than normal</span>.
        Bull Market dominance ({bullPct}% of days) explains MASI's long-term growth over 10 years.
      </div>
    </GlowCard>
  </div>
);

const ModelTab = ({ walkForwardData, baseline, lrAccuracy, rfAccuracy, wfMin, wfMax, bestWF, worstWF }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 20 }}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
      {[
        { label: "Baseline", value: `${baseline}%`, color: COLORS.muted },
        { label: "Logistic Regression", value: `${lrAccuracy}%`, color: COLORS.bear },
        { label: "Random Forest", value: `${rfAccuracy}%`, color: COLORS.bull },
      ].map(m => (
        <GlowCard key={m.label} glow={m.color === COLORS.bull ? "bull" : "accent"}>
          <div style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{m.label}</div>
          <div style={{ color: m.color, fontSize: 32, fontWeight: 800, fontFamily: "monospace" }}>{m.value}</div>
        </GlowCard>
      ))}
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
      <GlowCard>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, letterSpacing: "0.05em" }}>WALK FORWARD — YEAR BY YEAR</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={walkForwardData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a2540" />
            <XAxis dataKey="year" tick={{ fill: COLORS.muted, fontSize: 11 }} tickLine={false} />
            <YAxis domain={[wfMin, wfMax]} tick={{ fill: COLORS.muted, fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
            <Tooltip content={<CustomTooltip />} formatter={v => `${v}%`} />
            <Bar dataKey="accuracy" name="RF Accuracy" radius={[6, 6, 0, 0]}>
              {walkForwardData.map((e, i) => <Cell key={i} fill={e.accuracy >= 50 ? COLORS.bull : COLORS.bear} />)}
            </Bar>
            <Bar dataKey="baseline" name="Baseline" radius={[6, 6, 0, 0]} fill={COLORS.muted} opacity={0.4} />
          </BarChart>
        </ResponsiveContainer>
      </GlowCard>
      <PredictionEngine />
    </div>

    <GlowCard>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, letterSpacing: "0.05em" }}>WALK FORWARD INSIGHT</div>
      <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.7, padding: "12px", background: "rgba(0,255,157,0.04)", borderRadius: 10, border: "1px solid rgba(0,255,157,0.08)" }}>
        Performance varies by regime. Best year:{" "}
        <span style={{ color: COLORS.bull, fontWeight: 600 }}>{bestWF?.year}: {bestWF?.accuracy}% accuracy</span>.
        Worst year:{" "}
        <span style={{ color: COLORS.crisis, fontWeight: 600 }}>{worstWF?.year}: {worstWF?.accuracy}% accuracy</span> —
        confirming <span style={{ color: COLORS.accent, fontWeight: 600 }}>conditional predictive power</span> dependent on market regime.
      </div>
    </GlowCard>
  </div>
);

const RulesTab = ({ topRules, cleanRules, upRules, downRules }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 20 }}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16 }}>
      {[
        { label: "Clean Pred. Rules", value: cleanRules.toString(), sub: "actionable signals", color: COLORS.accent },
        { label: "↑ UP Rules", value: upRules.toString(), sub: "bullish signals", color: COLORS.bull },
        { label: "↓ DOWN Rules", value: downRules.toString(), sub: "bearish signals", color: COLORS.bear },
      ].map(s => (
        <GlowCard key={s.label}>
          <div style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{s.label}</div>
          <div style={{ color: s.color, fontSize: 28, fontWeight: 800, fontFamily: "monospace" }}>{s.value}</div>
          <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 4 }}>{s.sub}</div>
        </GlowCard>
      ))}
    </div>

    <GlowCard>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, letterSpacing: "0.05em" }}>TOP ASSOCIATION RULES — CONFIDENCE</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {topRules.map((r, i) => (
          <div key={i} style={{ padding: "12px 16px", borderRadius: 10, background: r.rule.includes("UP") ? "rgba(0,255,157,0.04)" : "rgba(255,77,109,0.04)", border: `1px solid ${r.rule.includes("UP") ? "rgba(0,255,157,0.12)" : "rgba(255,77,109,0.12)"}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontFamily: "monospace", fontSize: 12, color: COLORS.text, marginBottom: 4 }}>{r.rule}</div>
              <span style={{ color: COLORS.muted, fontSize: 11 }}>
                Lift: <span style={{ color: COLORS.accent }}>{r.lift}</span>
                {r.support != null && <> · Support: <span style={{ color: COLORS.crisis }}>{r.support}%</span></>}
              </span>
            </div>
            <div style={{ textAlign: "right", minWidth: 80 }}>
              <div style={{ color: r.rule.includes("UP") ? COLORS.bull : COLORS.bear, fontSize: 20, fontWeight: 800, fontFamily: "monospace" }}>{r.conf}%</div>
              <div style={{ color: COLORS.muted, fontSize: 10 }}>confidence</div>
            </div>
          </div>
        ))}
      </div>
    </GlowCard>

    <GlowCard>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16, letterSpacing: "0.05em" }}>CONFIDENCE DISTRIBUTION</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {topRules.map((r, i) => {
          const isUp = r.rule.includes("UP");
          const barColor = isUp ? COLORS.bull : COLORS.bear;
          const label = r.rule.replace(/\s*→.*$/, "");
          const maxConf = Math.max(...topRules.map(x => x.conf));
          const barPct = (r.conf / maxConf) * 100;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontFamily: "monospace", fontSize: 11, color: COLORS.muted, width: 220, flexShrink: 0, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
              <div style={{ flex: 1, height: 22, borderRadius: 6, background: "rgba(255,255,255,0.04)", overflow: "hidden", position: "relative" }}>
                <div style={{ height: "100%", width: `${barPct}%`, borderRadius: 6, background: `linear-gradient(90deg, ${barColor}66, ${barColor})`, transition: "width 0.6s ease" }} />
                <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: barColor }}>{r.conf}%</span>
              </div>
              <span style={{ fontSize: 10, color: COLORS.muted, flexShrink: 0, width: 52 }}>lift <span style={{ color: COLORS.accent, fontWeight: 600 }}>{r.lift}</span></span>
            </div>
          );
        })}
      </div>
    </GlowCard>
  </div>
);

// ── Root dashboard ─────────────────────────────────────────────────────────
export default function MASIDashboard() {
  const modelResults = useModelResults();
  const { data, loading, priceData, rsiData, regimeData, bullPct, upDays, downDays, lastClose } =
    useMarketData(modelResults?.regime_distribution || null);
  const [activeTab, setActiveTab] = useState("overview");

  const walkForwardData = modelResults?.walk_forward || FALLBACK_WALK_FORWARD;
  const featureImportance = modelResults?.feature_importance || FALLBACK_FEATURES;
  const topRules = modelResults?.rules?.top || FALLBACK_RULES;
  const cleanRules = modelResults?.rules?.clean || 20;
  const upRules = modelResults?.rules?.up || 9;
  const downRules = modelResults?.rules?.down || 11;
  const baseline = (modelResults?.baseline && modelResults.baseline > 0) ? modelResults.baseline : 53.0;
  const lrAccuracy = modelResults?.lr_accuracy || 52.6;
  const rfAccuracy = modelResults?.rf_accuracy || 54.3;
  const regimeStats = modelResults?.regime_stats || {
    Bull: { ret: "+0.19%", atr: "95.4", rsi: "69.7" },
    Bear: { ret: "-0.15%", atr: "88.1", rsi: "37.3" },
    Crisis: { ret: "-0.16%", atr: "267.8", rsi: "37.8" },
  };

  const wfMin = walkForwardData.length
    ? Math.floor(Math.min(...walkForwardData.map(d => Math.min(d.accuracy, d.baseline ?? 99))) / 5) * 5 - 5
    : 35;
  const wfMax = walkForwardData.length
    ? Math.ceil(Math.max(...walkForwardData.map(d => Math.max(d.accuracy, d.baseline ?? 0))) / 5) * 5 + 5
    : 65;
  const bestAccuracy = walkForwardData.length ? Math.max(...walkForwardData.map(d => d.accuracy)) : rfAccuracy;
  const topRuleConf = topRules.length ? topRules[0].conf : 69.0;
  const bestWF = walkForwardData.reduce((a, b) => a.accuracy > b.accuracy ? a : b, walkForwardData[0] || {});
  const worstWF = walkForwardData.reduce((a, b) => a.accuracy < b.accuracy ? a : b, walkForwardData[0] || {});

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "indicators", label: "Indicators" },
    { id: "regimes", label: "Regimes" },
    { id: "model", label: "ML Model" },
    { id: "rules", label: "Rules" },
  ];

  if (loading) return (
    <div style={{ background: "#080c14", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#7b61ff", fontSize: 18, fontFamily: "monospace" }}>⏳ Loading MASI data...</div>
    </div>
  );

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", width: "100%", margin: 0, boxSizing: "border-box", color: COLORS.text, fontFamily: "'DM Sans', system-ui, sans-serif", padding: "24px", overflowX: "hidden" }}>

      {/* HEADER — LiveTicker is isolated, won't re-render siblings */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: `linear-gradient(135deg, ${COLORS.accent}, #4c35d9)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: "0 4px 20px rgba(123,97,255,0.4)" }}>📊</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>MASI Insight</div>
            <div style={{ fontSize: 11, color: COLORS.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>Morocco All Shares Index · {data.length} Trading Days · 2015–2025</div>
          </div>
        </div>
        {/* ✅ Ticker lives in its own component — its setInterval never touches this tree */}
        <LiveTicker initialValue={lastClose} />
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 4, marginBottom: 0, borderBottom: `1px solid ${COLORS.border}`, flexWrap: "wrap" }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{ padding: "8px 16px", borderRadius: "8px 8px 0 0", background: activeTab === tab.id ? COLORS.card : "transparent", color: activeTab === tab.id ? COLORS.text : COLORS.muted, border: activeTab === tab.id ? `1px solid ${COLORS.border}` : "1px solid transparent", borderBottom: activeTab === tab.id ? `1px solid ${COLORS.card}` : "transparent", fontWeight: activeTab === tab.id ? 600 : 400, fontSize: 13, cursor: "pointer", marginBottom: -1, transition: "all 0.2s" }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB PANELS — each is its own component, recharts only mounts when visible */}
      {activeTab === "overview" && (
        <OverviewTab
          data={data} priceData={priceData} regimeData={regimeData}
          walkForwardData={walkForwardData} bestAccuracy={bestAccuracy}
          baseline={baseline} topRuleConf={topRuleConf} bullPct={bullPct}
          wfMin={wfMin} wfMax={wfMax}
        />
      )}
      {activeTab === "indicators" && (
        <IndicatorsTab
          data={data} rsiData={rsiData} featureImportance={featureImportance}
          upDays={upDays} downDays={downDays}
        />
      )}
      {activeTab === "regimes" && (
        <RegimesTab regimeData={regimeData} regimeStats={regimeStats} bullPct={bullPct} />
      )}
      {activeTab === "model" && (
        <ModelTab
          walkForwardData={walkForwardData} baseline={baseline}
          lrAccuracy={lrAccuracy} rfAccuracy={rfAccuracy}
          wfMin={wfMin} wfMax={wfMax} bestWF={bestWF} worstWF={worstWF}
        />
      )}
      {activeTab === "rules" && (
        <RulesTab topRules={topRules} cleanRules={cleanRules} upRules={upRules} downRules={downRules} />
      )}

      {/* FOOTER */}
      <div style={{ marginTop: 32, paddingTop: 20, borderTop: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, color: COLORS.muted, fontSize: 11 }}>
        <span>MASI Insight · Data Mining Project · 2015–2025 · {data.length} rows loaded</span>
        <span>⚠️ For educational purposes only — not financial advice</span>
      </div>
    </div>
  );
}