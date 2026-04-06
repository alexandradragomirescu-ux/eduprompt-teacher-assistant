import { useState, useRef } from "react";

const loadPdfJs = () => new Promise((resolve, reject) => {
  if (window.pdfjsLib) return resolve(window.pdfjsLib);
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  s.onload = () => {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    resolve(window.pdfjsLib);
  };
  s.onerror = () => reject(new Error("PDF load failed"));
  document.head.appendChild(s);
});

const extractPdf = async (buf) => {
  const lib = await loadPdfJs();
  const pdf = await lib.getDocument({ data: buf }).promise;
  let t = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const p = await pdf.getPage(i);
    const c = await p.getTextContent();
    t += c.items.map(x => x.str).join(" ") + "\n\n";
  }
  return t.trim();
};

export default function App() {
  const [source, setSource] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [prompt, setPrompt] = useState("");
  const [copied, setCopied] = useState(false);
  const [grilaCount, setGrilaCount] = useState(5);
  const [analizaCount, setAnalizaCount] = useState(3);
  const pdfRef = useRef(null);
  const promptRef = useRef(null);

  const handlePdf = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const text = await extractPdf(await file.arrayBuffer());
      if (text.length < 30) {
        setError("PDF-ul nu conține text extractibil.");
      } else {
        setSource(text);
        setSourceName(file.name);
      }
    } catch (err) {
      setError("Eroare PDF: " + err.message);
    }
    setUploading(false);
  };

  const buildPrompt = (type) => {
    if (!source.trim()) return;
    const content = source.substring(0, 3000);
    const trunc = source.length > 3000 ? "\n(text trunchiat)" : "";

    const prompts = {
      all: `Generează materiale didactice complete în română pe baza materialului de mai jos:
- Sinteza materialului
- 8 întrebări de verificare
- ${grilaCount} itemi grilă (A/B/C/D) cu răspunsuri la final
- ${analizaCount} exerciții de analiză
- Fișe diferențiate (🟢 Bază, 🟡 Mediu, 🔴 Avansat — câte 3 exerciții)

MATERIAL:
${content}${trunc}`,
      sinteza: `Generează SINTEZA MATERIALULUI și 8 ÎNTREBĂRI DE VERIFICARE în română:\n\n${content}${trunc}`,
      grila: `Generează ${grilaCount} ITEMI GRILĂ (A/B/C/D) cu răspunsuri, în română:\n\n${content}${trunc}`,
      analiza: `Generează ${analizaCount} EXERCIȚII DE ANALIZĂ în română:\n\n${content}${trunc}`,
      fise: `Generează FIȘE DIFERENȚIATE pe 3 niveluri (🟢🟡🔴, câte 3 exerciții) în română:\n\n${content}${trunc}`,
    };

    setPrompt(prompts[type]);
    setCopied(false);
    setTimeout(() => {
      promptRef.current?.select();
      promptRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const selectAll = () => {
    promptRef.current?.select();
    try {
      document.execCommand("copy");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const tabs = [
    { key: "all", label: "✦ Toate materialele", main: true },
    { key: "sinteza", label: "📄 Sinteza", main: false },
    { key: "grila", label: `☑️ Grilă (${grilaCount})`, main: false },
    { key: "analiza", label: `🧠 Analiză (${analizaCount})`, main: false },
    { key: "fise", label: "📋 Fișe", main: false },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f3", fontFamily: "'Source Sans 3', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Source+Sans+3:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      <header style={{ padding: "18px 24px 12px", borderBottom: "3px solid #c4a265", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: "#c4a265", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 17 }}>📋</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 19, fontFamily: "'Playfair Display', serif", fontWeight: 800, color: "#2a1f0f" }}>EduPrompt Teacher Assistant</h1>
            <p style={{ margin: 0, fontSize: 11.5, color: "#8a7e6e" }}>Generator inteligent de materiale didactice</p>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 820, margin: "0 auto", padding: "32px 20px 50px" }}>

        {/* Step 1 */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#c4a265", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>1</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#2a1f0f" }}>Adaugă materialul sursă</span>
          </div>

          <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #e0d8c8", overflow: "hidden" }}>
            {sourceName && (
              <div style={{ padding: "7px 18px", background: "rgba(106,176,112,0.06)", borderBottom: "1px solid #f0ebe0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#3a6a3d", fontWeight: 500 }}>✅ {sourceName} — {(source.length/1000).toFixed(1)}k caractere extrase</span>
                <span onClick={() => { setSource(""); setSourceName(""); setPrompt(""); }} style={{ fontSize: 11, color: "#b43c3c", cursor: "pointer" }}>✕ Șterge</span>
              </div>
            )}
            <textarea
              value={source}
              onChange={e => { setSource(e.target.value); setSourceName(""); setPrompt(""); }}
              placeholder="Lipește aici textul lecției din manual sau orice sursă...\n\nSau apasă „📄 Încarcă PDF" de mai jos."
              rows={8}
              style={{ width: "100%", border: "none", outline: "none", padding: "18px 20px", fontSize: 14, lineHeight: 1.65, color: "#2a1f0f", resize: "vertical", boxSizing: "border-box", background: "transparent" }}
            />
            <div style={{ padding: "8px 18px 12px", borderTop: "1px solid #f0ebe0", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: "#a09888" }}>{source.length.toLocaleString()} car.</span>
              <button onClick={() => pdfRef.current?.click()} disabled={uploading} style={{
                display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 8,
                border: "1px solid #c4a265", background: "#fff", fontSize: 13, color: "#a8893e", cursor: "pointer", fontWeight: 500,
              }}>
                {uploading ? "⏳ Se procesează..." : "📄 Încarcă PDF"}
              </button>
              <input ref={pdfRef} type="file" accept=".pdf" onChange={handlePdf} style={{ display: "none" }} />
            </div>
            {error && (
              <div style={{ padding: "6px 18px 10px" }}>
                <span style={{ fontSize: 12, color: "#a03030" }}>⚠️ {error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Step 2 */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ width: 28, height: 28, borderRadius: "50%", background: source.trim() ? "#c4a265" : "#ddd", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>2</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: source.trim() ? "#2a1f0f" : "#bbb" }}>Alege ce vrei să generezi</span>
          </div>

          {/* Counters */}
          <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <Ct label="Itemi grilă" value={grilaCount} onChange={setGrilaCount} color="#6ab070" />
            <Ct label="Exerciții analiză" value={analizaCount} onChange={setAnalizaCount} color="#d47fa6" />
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => buildPrompt(t.key)} disabled={!source.trim()} style={{
                padding: t.main ? "11px 22px" : "9px 16px", borderRadius: t.main ? 12 : 20,
                border: "none", cursor: source.trim() ? "pointer" : "default",
                background: t.main
                  ? (source.trim() ? "linear-gradient(135deg, #c4a265, #a8893e)" : "#ddd")
                  : (source.trim() ? "#fff" : "#f5f5f5"),
                color: t.main ? "#fff" : (source.trim() ? "#6b5a3d" : "#bbb"),
                fontSize: 13, fontWeight: t.main ? 700 : 500,
                boxShadow: t.main && source.trim() ? "0 2px 10px rgba(196,162,101,0.3)" : "none",
                border: t.main ? "none" : `1.5px solid ${source.trim() ? "rgba(196,162,101,0.3)" : "#eee"}`,
              }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Step 3 — Prompt output */}
        {prompt && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: "#c4a265", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>3</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#2a1f0f" }}>Copiază și lipește în chat</span>
            </div>

            <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #c4a265", overflow: "hidden" }}>
              <div style={{
                padding: "10px 18px", background: "rgba(196,162,101,0.08)",
                borderBottom: "1px solid rgba(196,162,101,0.2)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontSize: 13, color: "#6b5a3d", fontWeight: 600 }}>
                  {copied ? "✅ Copiat!" : "👇 Click pe casetă → Ctrl+A → Ctrl+C → lipește în chat"}
                </span>
                <button onClick={selectAll} style={{
                  padding: "5px 14px", borderRadius: 8, border: "1px solid #c4a265",
                  background: copied ? "rgba(106,176,112,0.1)" : "#fff",
                  fontSize: 12, color: copied ? "#2d6a30" : "#a8893e",
                  cursor: "pointer", fontWeight: 600,
                }}>
                  {copied ? "✅ Copiat" : "📋 Copiază tot"}
                </button>
              </div>
              <textarea
                ref={promptRef}
                value={prompt}
                readOnly
                onClick={() => promptRef.current?.select()}
                rows={6}
                style={{
                  width: "100%", border: "none", outline: "none",
                  padding: "14px 18px", fontSize: 12.5, lineHeight: 1.5,
                  color: "#4a3f2f", background: "#fffdf8",
                  resize: "vertical", boxSizing: "border-box",
                  fontFamily: "monospace",
                }}
              />
            </div>
          </div>
        )}
      </main>

      <footer style={{ padding: "14px 24px", borderTop: "1px solid #e8e0d0", background: "#fff", textAlign: "center" }}>
        <span style={{ fontSize: 12, color: "#8a7e6e" }}>Feedback: </span>
        <a href="mailto:teacherassistanteduprompt@gmail.com" style={{ fontSize: 12, color: "#a8893e", fontWeight: 600, textDecoration: "none", borderBottom: "1px dashed #c4a265" }}>
          teacherassistanteduprompt@gmail.com
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

function Ct({ label, value, onChange, color }) {
  const b = { width: 24, height: 24, borderRadius: "50%", border: "1.5px solid #e0d8c8", background: "#fff", fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#5a5044", lineHeight: 1 };
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", borderRadius: 18, padding: "4px 12px", border: "1px solid #e8e0d0", fontSize: 12.5 }}>
      <span style={{ width: 14, height: 14, borderRadius: 3, background: color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#fff" }}>✓</span>
      <span style={{ color: "#5a5044" }}>{label}:</span>
      <button onClick={() => onChange(Math.max(1, value - 1))} style={b}>–</button>
      <span style={{ fontWeight: 700, minWidth: 16, textAlign: "center" }}>{value}</span>
      <button onClick={() => onChange(Math.min(20, value + 1))} style={b}>+</button>
    </div>
  );
}
