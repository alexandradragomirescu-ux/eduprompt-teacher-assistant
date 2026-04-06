import { useState, useRef } from "react";

export default function App() {
  const [text, setText] = useState("");
  const [grilaCount, setGrilaCount] = useState(5);
  const [analizaCount, setAnalizaCount] = useState(3);
  const [activeTab, setActiveTab] = useState(null);
  const [status, setStatus] = useState("");
  const imgRef = useRef(null);

  const doGenerate = (type) => {
    if (!text.trim()) return;
    setActiveTab(type);
    const short = text.substring(0, 1500);

    const msgs = {
      all: `Generează materiale didactice complete (sinteză, ${grilaCount} grilă, ${analizaCount} analiză, fișe diferențiate 🟢🟡🔴) pentru:\n${short}`,
      sinteza: `Generează sinteza materialului și 8 întrebări pentru:\n${short}`,
      grila: `Generează ${grilaCount} itemi grilă (A/B/C/D) cu răspunsuri pentru:\n${short}`,
      analiza: `Generează ${analizaCount} exerciții de analiză pentru:\n${short}`,
      fise: `Generează fișe diferențiate (🟢Bază 🟡Mediu 🔴Avansat) pentru:\n${short}`,
    };

    try {
      sendPrompt(msgs[type]);
      setStatus("ok");
    } catch {
      setStatus("fail");
    }
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
            <h1 style={{ margin: 0, fontSize: 22, fontFamily: "'Playfair Display', serif", fontWeight: 800, color: "#2a1f0f", letterSpacing: "-0.3px" }}>EduPrompt Teacher Assistant</h1>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#8a7e6e", fontWeight: 400 }}>Generator inteligent de materiale didactice</p>
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

        {status === "ok" && (
          <div style={{ background: "rgba(106,176,112,0.08)", border: "1.5px solid rgba(106,176,112,0.3)", borderRadius: 12, padding: "14px 20px", marginBottom: 20 }}>
            <span style={{ fontSize: 13, color: "#2d6a30", fontWeight: 600 }}>✅ Trimis! Derulează în jos în conversație.</span>
          </div>
        )}

        {/* Textarea card */}
        <div style={{ background: "#fff", borderRadius: 18, border: "1.5px solid #e0d8c8", boxShadow: "0 4px 24px rgba(42,31,15,0.04)", overflow: "hidden", textAlign: "left" }}>
          <textarea
            value={text}
            onChange={e => { setText(e.target.value); setStatus(""); }}
            placeholder={`Lipește aici textul lecției, sau trage/lipește o imagine (Ctrl+V)...\n\nExemplu: Revoluția Industrială a reprezentat o perioadă de transformare majoră în Europa, începând cu a doua jumătate a secolului al XVIII-lea...`}
            rows={8}
            style={{ width: "100%", border: "none", outline: "none", padding: "24px 28px 12px", fontSize: 15, lineHeight: 1.7, fontFamily: "'Source Sans 3', sans-serif", color: "#2a1f0f", resize: "vertical", boxSizing: "border-box", background: "transparent" }}
          />
          <div style={{ padding: "10px 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #f0ebe0", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 12.5, color: "#a09888" }}>{text.length.toLocaleString()} caractere</span>
              <button onClick={() => imgRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid #e0d8c8", background: "#fff", fontSize: 13, color: "#5a5044", cursor: "pointer" }}>
                🖼️ Adaugă imagine
              </button>
              <input ref={imgRef} type="file" accept="image/*" onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  // Show image preview in text area context
                  setText(prev => prev + `\n\n[Imagine atașată: ${file.name}]`);
                };
                reader.readAsDataURL(file);
                e.target.value = "";
              }} style={{ display: "none" }} />
            </div>
            <button onClick={() => doGenerate("all")} disabled={!text.trim()} style={{
              padding: "12px 28px", borderRadius: 12, border: "none", cursor: text.trim() ? "pointer" : "default",
              background: text.trim() ? "linear-gradient(135deg, #c4a265, #a8893e)" : "#ddd",
              color: "#fff", fontSize: 14.5, fontWeight: 700,
              display: "flex", alignItems: "center", gap: 8,
              boxShadow: text.trim() ? "0 3px 12px rgba(196,162,101,0.35)" : "none",
            }}>
              ✦ Generează toate materialele
            </button>
          </div>
        </div>

        {/* Counters */}
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
          <Counter label="Itemi grilă" value={grilaCount} onChange={setGrilaCount} color="#6ab070" />
          <Counter label="Exerciții analiză" value={analizaCount} onChange={setAnalizaCount} color="#d47fa6" />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 24, flexWrap: "wrap" }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => doGenerate(t.key)} disabled={!text.trim()} style={{
              padding: "9px 18px", borderRadius: 20,
              border: activeTab === t.key ? "1.5px solid #c4a265" : "1.5px solid rgba(196,162,101,0.2)",
              background: activeTab === t.key ? "rgba(196,162,101,0.08)" : "transparent",
              fontSize: 13.5, cursor: text.trim() ? "pointer" : "default",
              color: text.trim() ? (activeTab === t.key ? "#6b5a3d" : "#8a7e6e") : "#ccc",
              fontWeight: activeTab === t.key ? 600 : 400,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </main>

      <footer style={{ padding: "20px 32px", borderTop: "1px solid #e8e0d0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "#8a7e6e" }}>Feedback sau sugestii?</span>
        <a href="mailto:teacherassistanteduprompt@gmail.com" style={{ fontSize: 13, color: "#a8893e", fontWeight: 600, textDecoration: "none", borderBottom: "1px dashed #c4a265", paddingBottom: 1 }}>
          ✉ teacherassistanteduprompt@gmail.com
        </a>
      </footer>

      <style>{`
        textarea::placeholder { color: #b0a898; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}

function Counter({ label, value, onChange, color }) {
  const b = { width: 28, height: 28, borderRadius: "50%", border: "1.5px solid #e0d8c8", background: "#fff", fontSize: 16, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#5a5044", lineHeight: 1 };
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", borderRadius: 24, padding: "6px 16px", border: "1px solid #e8e0d0", fontSize: 13.5, fontFamily: "'Source Sans 3', sans-serif" }}>
      <span style={{ width: 18, height: 18, borderRadius: 4, background: color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff" }}>✓</span>
      <span style={{ color: "#5a5044" }}>{label}:</span>
      <button onClick={() => onChange(Math.max(1, value - 1))} style={b}>–</button>
      <span style={{ fontWeight: 700, minWidth: 20, textAlign: "center", color: "#2a1f0f" }}>{value}</span>
      <button onClick={() => onChange(Math.min(20, value + 1))} style={b}>+</button>
    </div>
  );
}
