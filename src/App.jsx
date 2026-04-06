import { useState, useRef, useEffect } from "react";

// Load pdf.js
const loadPdfJs = () => {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(window.pdfjsLib);
    };
    s.onerror = () => reject(new Error("Nu s-a putut încărca biblioteca PDF."));
    document.head.appendChild(s);
  });
};

const extractText = async (buf) => {
  const lib = await loadPdfJs();
  const pdf = await lib.getDocument({ data: buf }).promise;
  let t = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const p = await pdf.getPage(i);
    const c = await p.getTextContent();
    t += `\n--- Pagina ${i} ---\n` + c.items.map(x => x.str).join(" ");
  }
  return t.trim();
};

export default function App() {
  const [lesson, setLesson] = useState("");
  const [grilaCount, setGrilaCount] = useState(5);
  const [analizaCount, setAnalizaCount] = useState(3);
  const [books, setBooks] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [sent, setSent] = useState(false);
  const pdfRef = useRef(null);

  const handlePdf = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || file.type !== "application/pdf") return;
    setPdfError("");
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const text = await extractText(buf);
      if (!text || text.length < 50) {
        setPdfError(`PDF-ul „${file.name}" nu conține text extractibil (posibil scanat).`);
        setUploading(false);
        return;
      }
      setBooks(prev => [...prev, {
        id: Date.now(),
        title: file.name.replace(/\.pdf$/i, ""),
        content: text,
        pages: (text.match(/--- Pagina \d+/g) || []).length,
        chars: text.length,
      }]);
    } catch (err) {
      setPdfError(`Eroare la procesarea PDF: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const removeBook = (id) => setBooks(prev => prev.filter(b => b.id !== id));

  const generateAll = () => {
    if (!lesson.trim()) return;
    const bookTitles = books.map(b => b.title).join(", ");
    const booksCtx = books.length > 0
      ? books.map((b, i) => `--- MANUAL ${i + 1}: "${b.title}" ---\n${b.content.substring(0, 12000)}\n--- SFÂRȘIT ---`).join("\n\n")
      : "";

    const bookInstruction = books.length > 0
      ? `\n\n📚 MANUALE DE REFERINȚĂ (bazează-te EXCLUSIV pe ele):\n${booksCtx}\n\n⚠️ Toate materialele TREBUIE extrase din manualele de mai sus (${bookTitles}). Menționează sursele la început.`
      : "";

    const prompt = `Ești un profesor expert. Generează TOATE materialele didactice pentru lecția de mai jos, în limba română, cu markdown:

SUBIECTUL/LECȚIA: ${lesson}
${bookInstruction}

Generează în ordine:
1. **SINTEZA MATERIALULUI** — sinteză clară a lecției
2. **ÎNTREBĂRI DE VERIFICARE** — 6-8 întrebări mixte
3. **ITEMI GRILĂ** — ${grilaCount} întrebări cu 4 variante (A/B/C/D) + răspunsuri la final
4. **EXERCIȚII DE ANALIZĂ** — ${analizaCount} exerciții de analiză aprofundată
5. **FIȘE DIFERENȚIATE** pe 3 niveluri:
   - 🟢 BAZĂ: 3 exerciții simple
   - 🟡 MEDIU: 3 exerciții de aplicare
   - 🔴 AVANSAT: 3 exerciții de analiză/sinteză

Formatează totul clar cu titluri, numerotare și separatoare.`;

    setSent(true);
    if (typeof sendPrompt === "function") {
      sendPrompt(prompt);
    }
  };

  const generateOne = (type) => {
    if (!lesson.trim()) return;
    const bookTitles = books.map(b => b.title).join(", ");
    const booksCtx = books.length > 0
      ? books.map((b, i) => `--- MANUAL ${i + 1}: "${b.title}" ---\n${b.content.substring(0, 12000)}\n--- SFÂRȘIT ---`).join("\n\n")
      : "";

    const bookInstruction = books.length > 0
      ? `\n\n📚 MANUALE DE REFERINȚĂ:\n${booksCtx}\n\n⚠️ Bazează-te EXCLUSIV pe manualele de mai sus (${bookTitles}).`
      : "";

    const types = {
      sinteza: `Generează o SINTEZĂ A MATERIALULUI clară și 8-10 ÎNTREBĂRI de verificare pentru lecția: ${lesson}${bookInstruction}`,
      grila: `Generează ${grilaCount} ITEMI GRILĂ (A/B/C/D) + răspunsuri corecte la final, pentru lecția: ${lesson}${bookInstruction}`,
      analiza: `Generează ${analizaCount} EXERCIȚII DE ANALIZĂ aprofundată pentru lecția: ${lesson}${bookInstruction}`,
      fise: `Generează FIȘE DIFERENȚIATE pe 3 niveluri (🟢 Bază, 🟡 Mediu, 🔴 Avansat) cu 3-4 exerciții per nivel, pentru lecția: ${lesson}${bookInstruction}`,
    };

    setSent(true);
    if (typeof sendPrompt === "function") {
      sendPrompt(`Ești un profesor expert. Răspunde în română cu markdown.\n\n${types[type]}`);
    }
  };

  const tabs = [
    { key: "sinteza", label: "Sinteza materialului & Întrebări", icon: "📄" },
    { key: "grila", label: `Itemi grilă (${grilaCount})`, icon: "☑️" },
    { key: "analiza", label: `Exerciții de analiză (${analizaCount})`, icon: "🧠" },
    { key: "fise", label: "Fișe diferențiate", icon: "📋" },
  ];

  const CBtn = ({ label, value, onChange, color }) => (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      background: "#fff", borderRadius: 24, padding: "6px 16px",
      border: "1px solid #e8e0d0", fontSize: 13.5, fontFamily: "sans",
    }}>
      <span style={{ width: 18, height: 18, borderRadius: 4, background: color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff" }}>✓</span>
      <span style={{ color: "#5a5044" }}>{label}:</span>
      <button onClick={() => onChange(Math.max(1, value - 1))} style={cbtn}>–</button>
      <span style={{ fontWeight: 700, minWidth: 20, textAlign: "center", color: "#2a1f0f" }}>{value}</span>
      <button onClick={() => onChange(Math.min(20, value + 1))} style={cbtn}>+</button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f3", fontFamily: "'Source Sans 3', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Source+Sans+3:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <header style={{ padding: "20px 32px 14px", borderBottom: "3px solid #c4a265", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "#c4a265", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20 }}>📋</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontFamily: "'Playfair Display', serif", fontWeight: 800, color: "#2a1f0f" }}>EduPrompt Teacher Assistant</h1>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#8a7e6e" }}>Generator inteligent de materiale didactice</p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px 60px", textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 34, fontWeight: 800, color: "#2a1f0f", margin: "0 0 14px", lineHeight: 1.25 }}>
          Transformă orice lecție în resurse complete
        </h2>
        <p style={{ fontSize: 15, color: "#7a7060", margin: "0 auto 32px", lineHeight: 1.6, maxWidth: 600 }}>
          Introdu textul educațional sau încarcă un PDF cu lecția. Voi genera automat:
          sinteza materialului, întrebări, itemi grilă, exerciții de analiză și fișe diferențiate.
        </p>

        {/* Sent confirmation */}
        {sent && (
          <div style={{
            background: "rgba(106,176,112,0.08)", border: "1.5px solid rgba(106,176,112,0.3)",
            borderRadius: 14, padding: "16px 24px", marginBottom: 24, textAlign: "left",
            fontFamily: "'Source Sans 3', sans-serif",
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#2d6a30", marginBottom: 6 }}>
              ✅ Cererea a fost trimisă!
            </div>
            <div style={{ fontSize: 13, color: "#4a7a4d", lineHeight: 1.5 }}>
              Materialele sunt generate mai jos, în conversație. Poți derula în jos pentru a le vedea.
            </div>
            <button onClick={() => setSent(false)} style={{
              marginTop: 10, padding: "6px 16px", borderRadius: 8,
              border: "1px solid rgba(106,176,112,0.3)", background: "#fff",
              fontSize: 12.5, color: "#3a6a3d", cursor: "pointer",
              fontFamily: "'Source Sans 3', sans-serif",
            }}>
              ↻ Generează alt material
            </button>
          </div>
        )}

        {/* Textarea */}
        <div style={{
          background: "#fff", borderRadius: 18, border: "1.5px solid #e0d8c8",
          boxShadow: "0 4px 24px rgba(42,31,15,0.04)", overflow: "hidden", textAlign: "left",
        }}>
          <textarea
            value={lesson}
            onChange={e => setLesson(e.target.value)}
            placeholder={books.length > 0
              ? `Scrie titlul lecției (ex: „Substantivul", „Viitorul") sau lipește textul complet.\n\nAI-ul va căuta subiectul în PDF-urile încărcate.`
              : `Lipește aici textul lecției, sau scrie titlul unei lecții...\n\nExemplu: Revoluția Industrială a reprezentat o perioadă de transformare majoră în Europa...\n\n💡 Sfat: Apasă „📄 Adaugă PDF" pentru a încărca un manual de referință.`}
            rows={8}
            style={{
              width: "100%", border: "none", outline: "none",
              padding: "24px 28px 12px", fontSize: 15, lineHeight: 1.7,
              fontFamily: "'Source Sans 3', sans-serif", color: "#2a1f0f",
              resize: "vertical", boxSizing: "border-box", background: "transparent",
            }}
          />

          {/* Bottom bar */}
          <div style={{
            padding: "10px 20px 14px", display: "flex", alignItems: "center",
            justifyContent: "space-between", borderTop: "1px solid #f0ebe0",
            flexWrap: "wrap", gap: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 12.5, color: "#a09888" }}>
                {lesson.length.toLocaleString()} caractere
              </span>
              <button
                onClick={() => pdfRef.current?.click()}
                disabled={uploading}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 8,
                  border: "1px solid #c4a265",
                  background: books.length > 0 ? "rgba(196,162,101,0.08)" : "#fff",
                  fontSize: 13, color: "#a8893e", cursor: "pointer",
                  fontWeight: 500,
                }}>
                {uploading
                  ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span> Se extrage textul...</>
                  : <>📄 Adaugă PDF</>
                }
              </button>
              <input ref={pdfRef} type="file" accept=".pdf" onChange={handlePdf} style={{ display: "none" }} />
            </div>
            <button
              onClick={generateAll}
              disabled={!lesson.trim()}
              style={{
                padding: "12px 28px", borderRadius: 12, border: "none", cursor: "pointer",
                background: lesson.trim() ? "linear-gradient(135deg, #c4a265, #a8893e)" : "#ddd",
                color: "#fff", fontSize: 14.5, fontWeight: 700,
                display: "flex", alignItems: "center", gap: 8,
                boxShadow: lesson.trim() ? "0 3px 12px rgba(196,162,101,0.35)" : "none",
                transition: "all 0.2s",
              }}
            >
              ✦ Generează toate materialele
            </button>
          </div>

          {/* PDF chips */}
          {books.length > 0 && (
            <div style={{
              padding: "8px 20px 12px", borderTop: "1px solid #f0ebe0",
              display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
            }}>
              <span style={{ fontSize: 11.5, color: "#8a7e6e" }}>📚 Materiale de referință:</span>
              {books.map(b => (
                <span key={b.id} style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  background: "rgba(106,176,112,0.08)", border: "1px solid rgba(106,176,112,0.25)",
                  borderRadius: 6, padding: "3px 10px", fontSize: 12, color: "#3a6a3d", fontWeight: 500,
                }}>
                  📄 {b.title}
                  <span style={{ fontSize: 10, color: "#6a9a6d" }}>({b.pages} pag.)</span>
                  <span onClick={() => removeBook(b.id)} style={{ cursor: "pointer", color: "#b43c3c", fontSize: 14, marginLeft: 2 }}>×</span>
                </span>
              ))}
            </div>
          )}

          {/* PDF error */}
          {pdfError && (
            <div style={{ padding: "8px 20px 12px", borderTop: "1px solid #f0ebe0" }}>
              <div style={{
                background: "rgba(200,50,50,0.06)", border: "1px solid rgba(200,50,50,0.15)",
                borderRadius: 8, padding: "8px 14px", fontSize: 12.5, color: "#a03030",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span>⚠️ {pdfError}</span>
                <span onClick={() => setPdfError("")} style={{ cursor: "pointer", color: "#aaa", fontSize: 16 }}>×</span>
              </div>
            </div>
          )}
        </div>

        {/* Counters */}
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
          <CBtn label="Itemi grilă" value={grilaCount} onChange={setGrilaCount} color="#6ab070" />
          <CBtn label="Exerciții analiză" value={analizaCount} onChange={setAnalizaCount} color="#d47fa6" />
        </div>

        {/* Individual tabs */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 24, flexWrap: "wrap" }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => generateOne(t.key)} disabled={!lesson.trim()} style={{
              padding: "9px 18px", borderRadius: 20,
              border: "1.5px solid rgba(196,162,101,0.3)",
              background: "transparent", fontSize: 13.5, cursor: lesson.trim() ? "pointer" : "default",
              color: lesson.trim() ? "#6b5a3d" : "#bbb",
              fontWeight: 500, transition: "all 0.2s",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        padding: "20px 32px", borderTop: "1px solid #e8e0d0", background: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap",
      }}>
        <span style={{ fontSize: 13, color: "#8a7e6e" }}>Feedback sau sugestii?</span>
        <a href="mailto:teacherassistanteduprompt@gmail.com" style={{
          fontSize: 13, color: "#a8893e", fontWeight: 600, textDecoration: "none",
          borderBottom: "1px dashed #c4a265", paddingBottom: 1,
        }}>
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

const cbtn = {
  width: 28, height: 28, borderRadius: "50%",
  border: "1.5px solid #e0d8c8", background: "#fff",
  fontSize: 16, cursor: "pointer",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  color: "#5a5044", lineHeight: 1,
};
