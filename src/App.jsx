import { useState, useRef } from "react";

export default function App() {
  const [text, setText] = useState("");
  const [grilaCount, setGrilaCount] = useState(5);
  const [analizaCount, setAnalizaCount] = useState(3);
  const [activeTab, setActiveTab] = useState("sinteza");
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const imgRef = useRef(null);

  const generate = async (type) => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError("");
    setActiveTab(type === "all" ? "sinteza" : type);

    const instructions = {
      all: `Generează materiale didactice complete în română:\n1. SINTEZA MATERIALULUI\n2. 8 ÎNTREBĂRI DE VERIFICARE\n3. ${grilaCount} ITEMI GRILĂ (A/B/C/D) + răspunsuri\n4. ${analizaCount} EXERCIȚII DE ANALIZĂ\n5. FIȘE DIFERENȚIATE (🟢Bază 🟡Mediu 🔴Avansat, câte 3)`,
      sinteza: "Generează SINTEZA MATERIALULUI și 8 ÎNTREBĂRI DE VERIFICARE în română.",
      grila: `Generează ${grilaCount} ITEMI GRILĂ (A/B/C/D) cu răspunsuri la final, în română.`,
      analiza: `Generează ${analizaCount} EXERCIȚII DE ANALIZĂ aprofundată, în română.`,
      fise: "Generează FIȘE DIFERENȚIATE pe 3 niveluri (🟢Bază 🟡Mediu 🔴Avansat, câte 3-4 exerciții), în română.",
    };

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `${instructions[type]}\n\nMATERIAL:\n${text.substring(0, 3000)}`
          }]
        })
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`Server: ${response.status} ${errText.substring(0, 100)}`);
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      const result = data.content?.map(c => c.text || "").join("") || "";
      if (!result) throw new Error("Răspuns gol");

      if (type === "all") {
        setResults({ sinteza: result, grila: result, analiza: result, fise: result });
      } else {
        setResults(prev => ({ ...prev, [type]: result }));
      }
    } catch (err) {
      setError(err.message || "Eroare necunoscută");
    } finally {
      setLoading(false);
    }
  };

  const fmt = (t) => {
    if (!t) return "";
    return t
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/^### (.*$)/gm, '<h3 style="margin:16px 0 6px;font-size:1.1em;color:#4a3f2f">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 style="margin:20px 0 8px;font-size:1.2em;color:#3a2f1f;border-bottom:1px solid #e8e0d0;padding-bottom:5px">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 style="margin:22px 0 10px;font-size:1.3em;color:#2a1f0f">$1</h1>')
      .replace(/^- (.*$)/gm, '<div style="padding-left:16px;margin:3px 0">• $1</div>')
      .replace(/^\d+\. (.*$)/gm, (m, p1) => `<div style="padding-left:20px;margin:3px 0">${m.match(/^\d+/)[0]}. ${p1}</div>`)
      .replace(/\n\n/g, '<div style="height:10px"></div>')
      .replace(/\n/g, "<br/>");
  };

  const tabs = [
    { key: "sinteza", label: "Sinteza materialului & Întrebări", icon: "📄" },
    { key: "grila", label: `Itemi grilă (${grilaCount})`, icon: "☑️" },
    { key: "analiza", label: `Exerciții de analiză (${analizaCount})`, icon: "🧠" },
    { key: "fise", label: "Fișe diferențiate", icon: "📋" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f3", fontFamily: "'Source Sans 3', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=Source+Sans+3:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      <header style={{ padding: "20px 32px 14px", borderBottom: "3px solid #c4a265", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "#c4a265", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20 }}>📋</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontFamily: "'Playfair Display', serif", fontWeight: 800, color: "#2a1f0f" }}>EduPrompt Teacher Assistant</h1>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#8a7e6e" }}>Generator inteligent de materiale didactice</p>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px 60px", textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 34, fontWeight: 800, color: "#2a1f0f", margin: "0 0 14px", lineHeight: 1.25 }}>
          Transformă orice lecție în resurse complete
        </h2>
        <p style={{ fontSize: 15, color: "#7a7060", margin: "0 auto 32px", lineHeight: 1.6, maxWidth: 600 }}>
          Introdu textul educațional sau încarcă o imagine cu lecția. Voi genera automat:
          sinteza materialului, întrebări, itemi grilă, exerciții de analiză și fișe diferențiate.
        </p>

        {/* Input */}
        <div style={{ background: "#fff", borderRadius: 18, border: "1.5px solid #e0d8c8", boxShadow: "0 4px 24px rgba(42,31,15,0.04)", overflow: "hidden", textAlign: "left" }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={`Lipește aici textul lecției, sau trage/lipește o imagine (Ctrl+V)...\n\nExemplu: Revoluția Industrială a reprezentat o perioadă de transformare majoră în Europa, începând cu a doua jumătate a secolului al XVIII-lea...`}
            rows={8}
            style={{ width: "100%", border: "none", outline: "none", padding: "24px 28px 12px", fontSize: 15, lineHeight: 1.7, color: "#2a1f0f", resize: "vertical", boxSizing: "border-box", background: "transparent" }}
          />
          <div style={{ padding: "10px 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #f0ebe0", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 12.5, color: "#a09888" }}>{text.length.toLocaleString()} caractere</span>
              <button onClick={() => imgRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid #e0d8c8", background: "#fff", fontSize: 13, color: "#5a5044", cursor: "pointer" }}>
                🖼️ Adaugă imagine
              </button>
              <input ref={imgRef} type="file" accept="image/*" onChange={e => {
                const f = e.target.files?.[0]; if (!f) return;
                setText(prev => prev + `\n[Imagine: ${f.name}]`);
                e.target.value = "";
              }} style={{ display: "none" }} />
            </div>
            <button onClick={() => generate("all")} disabled={!text.trim() || loading} style={{
              padding: "12px 28px", borderRadius: 12, border: "none", cursor: text.trim() && !loading ? "pointer" : "default",
              background: text.trim() && !loading ? "linear-gradient(135deg, #c4a265, #a8893e)" : "#ddd",
              color: "#fff", fontSize: 14.5, fontWeight: 700,
              boxShadow: text.trim() && !loading ? "0 3px 12px rgba(196,162,101,0.35)" : "none",
            }}>
              {loading ? "⏳ Se generează..." : "✦ Generează toate materialele"}
            </button>
          </div>
        </div>

        {/* Counters */}
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
          <Ctr label="Itemi grilă" value={grilaCount} onChange={setGrilaCount} color="#6ab070" />
          <Ctr label="Exerciții analiză" value={analizaCount} onChange={setAnalizaCount} color="#d47fa6" />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 24, flexWrap: "wrap" }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => { setActiveTab(t.key); if (!results[t.key]) generate(t.key); }} style={{
              padding: "9px 18px", borderRadius: 20,
              border: activeTab === t.key ? "1.5px solid #c4a265" : "1.5px solid transparent",
              background: activeTab === t.key ? "rgba(196,162,101,0.08)" : "transparent",
              fontSize: 13.5, cursor: "pointer",
              color: activeTab === t.key ? "#6b5a3d" : "#8a7e6e",
              fontWeight: activeTab === t.key ? 600 : 400,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginTop: 20, background: "rgba(200,50,50,0.06)", border: "1px solid rgba(200,50,50,0.15)", borderRadius: 12, padding: "14px 20px", textAlign: "left" }}>
            <div style={{ fontSize: 13, color: "#a03030", fontWeight: 600, marginBottom: 6 }}>⚠️ Eroare: {error}</div>
            <div style={{ fontSize: 12.5, color: "#7a4040", lineHeight: 1.5 }}>
              Alternativă: copiază textul din casetă și lipește-l direct în conversația cu Claude, apoi scrie ce vrei să generezi.
            </div>
          </div>
        )}

        {/* Results */}
        {results[activeTab] && !loading && (
          <div style={{ marginTop: 28, background: "#fff", borderRadius: 16, border: "1px solid #e8e0d0", boxShadow: "0 2px 16px rgba(42,31,15,0.04)", padding: "28px 32px", textAlign: "left", minHeight: 200 }}>
            <div style={{ fontSize: 14.5, lineHeight: 1.75, color: "#3a3020" }} dangerouslySetInnerHTML={{ __html: fmt(results[activeTab]) }} />
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ marginTop: 28, background: "#fff", borderRadius: 16, border: "1px solid #e8e0d0", padding: "60px 32px", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid #e8e0d0", borderTopColor: "#c4a265", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
            <span style={{ fontSize: 14, color: "#8a7e6e" }}>Se generează materialele...</span>
          </div>
        )}
      </main>

      <footer style={{ padding: "20px 32px", borderTop: "1px solid #e8e0d0", background: "#fff", textAlign: "center" }}>
        <span style={{ fontSize: 13, color: "#8a7e6e" }}>Feedback sau sugestii? </span>
        <a href="mailto:teacherassistanteduprompt@gmail.com" style={{ fontSize: 13, color: "#a8893e", fontWeight: 600, textDecoration: "none", borderBottom: "1px dashed #c4a265" }}>
          ✉ teacherassistanteduprompt@gmail.com
        </a>
      </footer>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        textarea::placeholder { color: #b0a898; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}

function Ctr({ label, value, onChange, color }) {
  const b = { width: 28, height: 28, borderRadius: "50%", border: "1.5px solid #e0d8c8", background: "#fff", fontSize: 16, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#5a5044", lineHeight: 1 };
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", borderRadius: 24, padding: "6px 16px", border: "1px solid #e8e0d0", fontSize: 13.5 }}>
      <span style={{ width: 18, height: 18, borderRadius: 4, background: color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff" }}>✓</span>
      <span style={{ color: "#5a5044" }}>{label}:</span>
      <button onClick={() => onChange(Math.max(1, value - 1))} style={b}>–</button>
      <span style={{ fontWeight: 700, minWidth: 20, textAlign: "center", color: "#2a1f0f" }}>{value}</span>
      <button onClick={() => onChange(Math.min(20, value + 1))} style={b}>+</button>
    </div>
  );
}
