import { useState, useRef, useCallback } from "react";

const GENERATE_PROMPT = (type, grilaCount, analizaCount, booksContext, bookTitles) => {
  const bookSection = booksContext
    ? `\n\nCONȚINUT DIN CĂRȚI/MANUALE DE REFERINȚĂ:\n${booksContext}\n\n⚠️ INSTRUCȚIUNE CRITICĂ: Bazează-te EXCLUSIV pe conținutul din cărțile/manualele de referință de mai sus. Toate exercițiile, întrebările, definițiile și explicațiile TREBUIE să provină din aceste surse. La începutul răspunsului, menționează scurt: "📚 Surse folosite: ${bookTitles}". Dacă o informație NU se găsește în manuale, precizează explicit acest lucru.`
    : "";

  const pdfNote = bookTitles && !booksContext
    ? `\n\n⚠️ INSTRUCȚIUNE CRITICĂ: Ai atașate manuale PDF de referință (${bookTitles}). Bazează-te EXCLUSIV pe conținutul din aceste manuale PDF. Toate exercițiile, întrebările, definițiile și explicațiile TREBUIE să provină din aceste surse. La începutul răspunsului, menționează scurt: "📚 Surse folosite: ${bookTitles}". Dacă o informație NU se găsește în manuale, precizează explicit acest lucru.`
    : "";

  const prompts = {
    sinteza: `Generează o SINTEZĂ A MATERIALULUI clară a lecției și 8-10 ÎNTREBĂRI de verificare (mixte: deschise și semi-deschise). Formatează frumos cu titluri și numere.${bookSection}${pdfNote}`,
    grila: `Generează exact ${grilaCount} ITEMI GRILĂ (întrebări cu 4 variante de răspuns A/B/C/D). La final, pune răspunsurile corecte. Numerotează-le.${bookSection}${pdfNote}`,
    analiza: `Generează exact ${analizaCount} EXERCIȚII DE ANALIZĂ aprofundată (comparații, studii de caz, eseuri scurte, analiză critică). Numerotează-le și descrie ce se așteaptă de la elev.${bookSection}${pdfNote}`,
    fise: `Generează FIȘE DIFERENȚIATE pe 3 niveluri:
- 🟢 NIVEL BAZĂ (recuperare): exerciții simple, completare, adevărat/fals
- 🟡 NIVEL MEDIU (consolidare): exerciții de aplicare, răspunsuri scurte
- 🔴 NIVEL AVANSAT (performanță): analiză, sinteză, argumentare
Fiecare nivel să aibă 3-4 exerciții.${bookSection}${pdfNote}`,
    all: `Generează TOATE materialele didactice pentru lecția dată:

1. **SINTEZA MATERIALULUI** - sinteză clară a lecției
2. **ÎNTREBĂRI DE VERIFICARE** - 6-8 întrebări mixte
3. **ITEMI GRILĂ** - ${grilaCount} întrebări cu 4 variante (A/B/C/D) + răspunsuri la final
4. **EXERCIȚII DE ANALIZĂ** - ${analizaCount} exerciții de analiză aprofundată
5. **FIȘE DIFERENȚIATE** pe 3 niveluri:
   - 🟢 BAZĂ: 3 exerciții simple
   - 🟡 MEDIU: 3 exerciții de aplicare
   - 🔴 AVANSAT: 3 exerciții de analiză/sinteză

Formatează totul clar cu titluri, numerotare și separatoare.${bookSection}${pdfNote}`,
  };
  return prompts[type] || prompts.all;
};

export default function App() {
  const [lessonText, setLessonText] = useState("");
  const [grilaCount, setGrilaCount] = useState(5);
  const [analizaCount, setAnalizaCount] = useState(3);
  const [activeTab, setActiveTab] = useState("sinteza");
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState("");
  const [usedBooks, setUsedBooks] = useState([]);
  const [books, setBooks] = useState([]);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const pdfInputRef = useRef(null);

  const MAX_PDF_SIZE = 4.5 * 1024 * 1024;

  const buildBooksContext = useCallback(() => {
    const textBooks = books.filter(b => !b.isPdf);
    if (textBooks.length === 0) return "";
    return textBooks.map((b, i) =>
      `--- MANUAL ${i + 1}: "${b.title}" ---\n${b.content.substring(0, 8000)}\n--- SFÂRȘIT ---`
    ).join("\n\n");
  }, [books]);

  const buildPdfBlocks = useCallback(() => {
    return books.filter(b => b.isPdf).map(b => ({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: b.pdfData },
    }));
  }, [books]);

  const generate = async (type) => {
    if (!lessonText.trim()) return;
    setLoading(true);
    setLoadingType(type);
    if (type !== "all") setActiveTab(type);

    try {
      const booksCtx = buildBooksContext();
      const pdfBlocks = buildPdfBlocks();
      const bookTitles = books.map(b => b.title).join(", ");
      const prompt = GENERATE_PROMPT(type, grilaCount, analizaCount, booksCtx, books.length > 0 ? bookTitles : "");

      // Track which books were used
      setUsedBooks(books.map(b => ({ title: b.title, isPdf: b.isPdf })));

      const hasBooks = books.length > 0;
      const hasPdfs = pdfBlocks.length > 0;

      const systemPrompt = hasBooks
        ? `Ești un profesor expert care creează materiale didactice de calitate superioară bazate STRICT pe manualele/cărțile de referință furnizate. Răspunde DOAR în limba română. Formatează răspunsul cu markdown (titluri, liste, bold). IMPORTANT: Toate materialele generate TREBUIE să fie extrase și fundamentate pe conținutul din manualele atașate. La începutul fiecărui răspuns, menționează sursele folosite. Dacă utilizatorul scrie doar un titlu de lecție, caută acel subiect în manualele atașate și generează materialele pe baza conținutului găsit. Dacă o informație NU se găsește în manuale, precizează explicit acest lucru.`
        : `Ești un profesor expert care creează materiale didactice de calitate superioară. Răspunde DOAR în limba română. Formatează răspunsul cu markdown (titluri, liste, bold). Fii creativ, riguros și adaptat nivelului liceal/gimnazial.`;

      // Build the message content
      let messageContent;
      if (hasPdfs) {
        // Array format needed for PDF attachments
        messageContent = [
          ...pdfBlocks,
          { type: "text", text: `Am atașat manuale PDF de referință: ${bookTitles}. Bazează-te EXCLUSIV pe conținutul lor.\n\nSUBIECTUL/LECȚIA: ${lessonText}\n\nINSTRUCȚIUNI:\n${prompt}` }
        ];
      } else {
        // Simple string format - text books context is already in the prompt
        messageContent = `SUBIECTUL/LECȚIA: ${lessonText}\n\nINSTRUCȚIUNI:\n${prompt}`;
      }

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemPrompt,
          messages: [
            { role: "user", content: messageContent }
          ],
        }),
      });
      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error.message || "Eroare API");
      }
      
      const text = data.content?.map(c => c.text || "").join("") || "Nu s-a primit răspuns.";

      if (type === "all") {
        setResults({ sinteza: text, grila: text, analiza: text, fise: text, all: text });
        setActiveTab("sinteza");
      } else {
        setResults(prev => ({ ...prev, [type]: text }));
      }
    } catch (err) {
      const errorMsg = err.message || "Eroare necunoscută";
      const totalPdfSize = books.filter(b => b.isPdf).reduce((s, b) => s + b.fileSize, 0);
      let hint = "Încearcă din nou.";
      if (errorMsg.includes("fetch") && totalPdfSize > 2 * 1024 * 1024) {
        hint = "PDF-ul pare prea mare pentru a fi procesat. Încearcă cu un PDF mai mic (max ~30 pagini) sau extrage doar capitolul relevant.";
      } else if (errorMsg.includes("fetch")) {
        hint = "Verifică conexiunea la internet și încearcă din nou.";
      }
      setResults(prev => ({ ...prev, [type === "all" ? "sinteza" : type]: `⚠️ Eroare la generare: ${errorMsg}\n\n${hint}` }));
      if (type === "all") setActiveTab("sinteza");
    } finally {
      setLoading(false);
      setLoadingType("");
    }
  };

  const processPdfFile = (file) => {
    if (!file || file.type !== "application/pdf") return;
    setPdfError("");

    if (file.size > MAX_PDF_SIZE) {
      setPdfError(`PDF-ul „${file.name}" are ${(file.size / 1024 / 1024).toFixed(1)} MB — limita este 4.5 MB. Folosește un PDF mai mic sau extrage doar capitolul relevant.`);
      return;
    }

    setUploadingPdf(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      const title = file.name.replace(/\.pdf$/i, "");
      setBooks(prev => [...prev, {
        id: Date.now(),
        title,
        content: `[PDF] ${file.name} — ${(file.size / 1024).toFixed(0)} KB`,
        pdfData: base64,
        isPdf: true,
        fileName: file.name,
        fileSize: file.size,
      }]);
      setUploadingPdf(false);
    };
    reader.onerror = () => {
      setUploadingPdf(false);
      setPdfError("Eroare la citirea fișierului. Încearcă din nou.");
    };
    reader.readAsDataURL(file);
  };

  const handlePdfUpload = (e) => {
    processPdfFile(e.target.files?.[0]);
    e.target.value = "";
  };

  const removeBook = (id) => setBooks(prev => prev.filter(b => b.id !== id));

  const formatMd = (text) => {
    if (!text) return "";
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background:rgba(0,0,0,0.06);padding:1px 5px;border-radius:3px;font-size:0.92em">$1</code>')
      .replace(/^#### (.*$)/gm, '<h4 style="margin:14px 0 6px;font-size:1em;color:#6b5a3d">$1</h4>')
      .replace(/^### (.*$)/gm, '<h3 style="margin:18px 0 8px;font-size:1.1em;color:#4a3f2f">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 style="margin:22px 0 10px;font-size:1.25em;color:#3a2f1f;border-bottom:1px solid #e8e0d0;padding-bottom:6px">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 style="margin:24px 0 12px;font-size:1.4em;color:#2a1f0f">$1</h1>')
      .replace(/^- (.*$)/gm, '<div style="padding-left:18px;margin:4px 0;position:relative"><span style="position:absolute;left:4px;color:#c4a265">•</span>$1</div>')
      .replace(/^\d+\. (.*$)/gm, (m, p1) => {
        const num = m.match(/^\d+/)[0];
        return `<div style="padding-left:24px;margin:4px 0;position:relative"><span style="position:absolute;left:0;color:#c4a265;font-weight:600">${num}.</span>${p1}</div>`;
      })
      .replace(/\n\n/g, '<div style="height:12px"></div>')
      .replace(/\n/g, '<br/>');
  };

  const tabs = [
    { key: "sinteza", label: "Sinteza materialului & Întrebări", icon: "📄" },
    { key: "grila", label: `Itemi grilă (${grilaCount})`, icon: "☑️" },
    { key: "analiza", label: `Exerciții de analiză (${analizaCount})`, icon: "🧠" },
    { key: "fise", label: "Fișe diferențiate", icon: "📋" },
  ];

  const counterBtnStyle = {
    width: 28, height: 28, borderRadius: "50%",
    border: "1.5px solid #e0d8c8", background: "#fff",
    fontSize: 16, cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    color: "#5a5044", fontWeight: 400,
    lineHeight: 1,
  };

  const Counter = ({ label, value, onChange, color }) => (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      background: "#fff", borderRadius: 24, padding: "6px 16px",
      border: "1px solid #e8e0d0", fontSize: 13.5,
      fontFamily: "'Source Sans 3', sans-serif",
    }}>
      <span style={{
        width: 18, height: 18, borderRadius: 4, background: color,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, color: "#fff",
      }}>✓</span>
      <span style={{ color: "#5a5044" }}>{label}:</span>
      <button onClick={() => onChange(Math.max(1, value - 1))} style={counterBtnStyle}>–</button>
      <span style={{ fontWeight: 700, minWidth: 20, textAlign: "center", color: "#2a1f0f" }}>{value}</span>
      <button onClick={() => onChange(Math.min(20, value + 1))} style={counterBtnStyle}>+</button>
    </div>
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: "#faf8f3",
      fontFamily: "'Source Sans 3', 'Segoe UI', sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=Source+Sans+3:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <header style={{
        padding: "20px 32px 14px",
        borderBottom: "3px solid #c4a265",
        background: "#fff",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: "#c4a265", display: "flex",
            alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 20,
          }}>📋</div>
          <div>
            <h1 style={{
              margin: 0, fontSize: 22,
              fontFamily: "'Playfair Display', serif",
              fontWeight: 800, color: "#2a1f0f",
              letterSpacing: "-0.3px",
            }}>EduPrompt Teacher Assistant</h1>
            <p style={{
              margin: "2px 0 0", fontSize: 13, color: "#8a7e6e",
              fontWeight: 400,
            }}>Generator inteligent de materiale didactice</p>
          </div>
        </div>
      </header>


      {/* Main */}
      <main style={{
        maxWidth: 900, margin: "0 auto",
        padding: "48px 24px 60px",
        textAlign: "center",
      }}>
        <h2 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 34, fontWeight: 800,
          color: "#2a1f0f", margin: "0 0 14px",
          lineHeight: 1.25,
        }}>
          Transformă orice lecție în resurse complete
        </h2>
        <p style={{
          fontSize: 15, color: "#7a7060",
          margin: "0 auto 32px", lineHeight: 1.6,
          maxWidth: 600,
        }}>
          Introdu textul educațional sau încarcă o imagine cu lecția. Voi genera automat:
          sinteza materialului, întrebări, itemi grilă, exerciții de analiză și fișe diferențiate.
        </p>

        {/* Textarea card */}
        <div style={{
          background: "#fff",
          borderRadius: 18,
          border: "1.5px solid #e0d8c8",
          boxShadow: "0 4px 24px rgba(42,31,15,0.04)",
          overflow: "hidden",
          textAlign: "left",
        }}>
          <textarea
            value={lessonText}
            onChange={e => setLessonText(e.target.value)}
            placeholder={books.length > 0
              ? `Scrie titlul lecției (ex: „Substantivul", „Verbul — moduri și timpuri") sau lipește textul complet al lecției.\n\nAI-ul va căuta subiectul în PDF-urile încărcate și va genera materialele pe baza lor.`
              : `Lipește aici textul lecției, sau scrie titlul unei lecții...\n\nExemplu: Revoluția Industrială a reprezentat o perioadă de transformare majoră în Europa, începând cu a doua jumătate a secolului al XVIII-lea...\n\n💡 Sfat: Apasă „📄 Adaugă PDF" pentru a încărca un manual de referință.`}
            rows={8}
            style={{
              width: "100%", border: "none", outline: "none",
              padding: "24px 28px 12px",
              fontSize: 15, lineHeight: 1.7,
              fontFamily: "'Source Sans 3', sans-serif",
              color: "#2a1f0f", resize: "vertical",
              boxSizing: "border-box", background: "transparent",
            }}
          />
          <div style={{
            padding: "10px 20px 14px",
            display: "flex", alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid #f0ebe0",
            flexWrap: "wrap", gap: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{
                fontSize: 12.5, color: "#a09888",
                fontFamily: "'Source Sans 3', sans-serif",
              }}>
                {lessonText.length.toLocaleString()} caractere
              </span>
              <button style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 14px", borderRadius: 8,
                border: "1px solid #e0d8c8", background: "#fff",
                fontSize: 13, color: "#5a5044", cursor: "pointer",
                fontFamily: "'Source Sans 3', sans-serif",
              }}>
                🖼️ Adaugă imagine
              </button>
              <button
                onClick={() => pdfInputRef.current?.click()}
                disabled={uploadingPdf}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 8,
                  border: "1px solid #c4a265", background: books.length > 0 ? "rgba(196,162,101,0.08)" : "#fff",
                  fontSize: 13, color: "#a8893e", cursor: "pointer",
                  fontFamily: "'Source Sans 3', sans-serif",
                  fontWeight: 500,
                }}>
                {uploadingPdf
                  ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span> Se încarcă...</>
                  : <>📄 Adaugă PDF</>
                }
              </button>
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handlePdfUpload}
                style={{ display: "none" }}
              />
            </div>
            <button
              onClick={() => generate("all")}
              disabled={!lessonText.trim() || loading}
              style={{
                padding: "12px 28px", borderRadius: 12,
                border: "none", cursor: "pointer",
                background: lessonText.trim() && !loading
                  ? "linear-gradient(135deg, #c4a265, #a8893e)" : "#ddd",
                color: "#fff", fontSize: 14.5, fontWeight: 700,
                fontFamily: "'Source Sans 3', sans-serif",
                display: "flex", alignItems: "center", gap: 8,
                boxShadow: lessonText.trim() && !loading
                  ? "0 3px 12px rgba(196,162,101,0.35)" : "none",
                transition: "all 0.2s",
              }}
            >
              {loading && loadingType === "all" ? (
                <>
                  <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span>
                  Se generează...
                </>
              ) : (
                <>✦ Generează toate materialele</>
              )}
            </button>
          </div>
          {/* Loaded PDFs */}
          {books.length > 0 && (
            <div style={{
              padding: "8px 20px 12px",
              borderTop: "1px solid #f0ebe0",
              display: "flex", alignItems: "center", gap: 8,
              flexWrap: "wrap",
            }}>
              <span style={{ fontSize: 11.5, color: "#8a7e6e", fontFamily: "'Source Sans 3', sans-serif" }}>
                📚 Materiale de referință:
              </span>
              {books.map(b => (
                <span key={b.id} style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  background: "rgba(196,162,101,0.1)",
                  border: "1px solid rgba(196,162,101,0.25)",
                  borderRadius: 6, padding: "3px 10px",
                  fontSize: 12, color: "#6b5a3d",
                  fontFamily: "'Source Sans 3', sans-serif",
                  fontWeight: 500,
                }}>
                  📄 {b.title}
                  <span
                    onClick={() => removeBook(b.id)}
                    style={{
                      cursor: "pointer", color: "#b43c3c",
                      fontSize: 14, lineHeight: 1, marginLeft: 2,
                      fontWeight: 400,
                    }}
                  >×</span>
                </span>
              ))}
            </div>
          )}
          {/* PDF error */}
          {pdfError && (
            <div style={{
              padding: "10px 20px 12px",
              borderTop: books.length > 0 ? "none" : "1px solid #f0ebe0",
              display: "flex", alignItems: "center", gap: 8,
              fontFamily: "'Source Sans 3', sans-serif",
            }}>
              <div style={{
                background: "rgba(200,50,50,0.06)",
                border: "1px solid rgba(200,50,50,0.15)",
                borderRadius: 8, padding: "8px 14px",
                fontSize: 12.5, color: "#a03030",
                lineHeight: 1.5, flex: 1,
              }}>
                ⚠️ {pdfError}
              </div>
              <span
                onClick={() => setPdfError("")}
                style={{ cursor: "pointer", color: "#aaa", fontSize: 16 }}
              >×</span>
            </div>
          )}
        </div>

        {/* Counters */}
        <div style={{
          display: "flex", gap: 16,
          justifyContent: "center",
          marginTop: 20, flexWrap: "wrap",
        }}>
          <Counter label="Itemi grilă" value={grilaCount}
            onChange={setGrilaCount} color="#6ab070" />
          <Counter label="Exerciții analiză" value={analizaCount}
            onChange={setAnalizaCount} color="#d47fa6" />
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", gap: 6, justifyContent: "center",
          marginTop: 24, flexWrap: "wrap",
        }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => {
                setActiveTab(t.key);
                if (!results[t.key] && !results.all && lessonText.trim() && !loading) generate(t.key);
              }}
              style={{
                padding: "9px 18px", borderRadius: 20,
                border: activeTab === t.key ? "1.5px solid #c4a265" : "1.5px solid transparent",
                background: activeTab === t.key ? "rgba(196,162,101,0.08)" : "transparent",
                fontSize: 13.5, cursor: "pointer",
                color: activeTab === t.key ? "#6b5a3d" : "#8a7e6e",
                fontWeight: activeTab === t.key ? 600 : 400,
                fontFamily: "'Source Sans 3', sans-serif",
                transition: "all 0.2s",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Results */}
        {(results[activeTab] || results.all || (loading && (loadingType === activeTab || loadingType === "all"))) && (
          <div style={{
            marginTop: 28,
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #e8e0d0",
            boxShadow: "0 2px 16px rgba(42,31,15,0.04)",
            padding: "28px 32px",
            textAlign: "left",
            minHeight: 200,
          }}>
            {loading && (loadingType === activeTab || loadingType === "all") ? (
              <div style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                padding: "60px 0", gap: 16,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: "50%",
                  border: "3px solid #e8e0d0",
                  borderTopColor: "#c4a265",
                  animation: "spin 0.8s linear infinite",
                }} />
                <span style={{
                  fontSize: 14, color: "#8a7e6e",
                  fontFamily: "'Source Sans 3', sans-serif",
                }}>Se generează materialele{books.length > 0 ? " (cu suport din manuale)" : ""}...</span>
              </div>
            ) : (
              <>
                {/* Sources banner */}
                {usedBooks.length > 0 && (
                  <div style={{
                    background: "rgba(106,176,112,0.06)",
                    border: "1px solid rgba(106,176,112,0.2)",
                    borderRadius: 10, padding: "10px 16px",
                    marginBottom: 18,
                    display: "flex", alignItems: "center", gap: 8,
                    flexWrap: "wrap",
                    fontFamily: "'Source Sans 3', sans-serif",
                  }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "#2d6a30" }}>
                      📚 Generat din:
                    </span>
                    {usedBooks.map((b, i) => (
                      <span key={i} style={{
                        background: "#fff",
                        border: "1px solid rgba(106,176,112,0.25)",
                        borderRadius: 6, padding: "3px 10px",
                        fontSize: 12, color: "#3a6a3d", fontWeight: 500,
                      }}>
                        {b.isPdf ? "📄" : "📗"} {b.title}
                      </span>
                    ))}
                  </div>
                )}
                {usedBooks.length === 0 && (results[activeTab] || results.all) && (
                  <div style={{
                    background: "rgba(196,162,101,0.06)",
                    border: "1px solid rgba(196,162,101,0.2)",
                    borderRadius: 10, padding: "10px 16px",
                    marginBottom: 18,
                    fontSize: 12.5, color: "#8a7040",
                    fontFamily: "'Source Sans 3', sans-serif",
                  }}>
                    ⚠️ Generat fără manual de referință — conținutul se bazează pe cunoștințele generale ale AI-ului.
                  </div>
                )}
                <div
                  style={{
                    fontSize: 14.5, lineHeight: 1.75,
                    color: "#3a3020",
                    fontFamily: "'Source Sans 3', sans-serif",
                  }}
                  dangerouslySetInnerHTML={{
                    __html: formatMd(results[activeTab] || results.all || "")
                  }}
                />
              </>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        padding: "20px 32px",
        borderTop: "1px solid #e8e0d0",
        background: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 8, flexWrap: "wrap",
      }}>
        <span style={{
          fontSize: 13, color: "#8a7e6e",
          fontFamily: "'Source Sans 3', sans-serif",
        }}>
          Feedback sau sugestii?
        </span>
        <a
          href="mailto:teacherassistanteduprompt@gmail.com"
          style={{
            fontSize: 13, color: "#a8893e",
            fontFamily: "'Source Sans 3', sans-serif",
            fontWeight: 600, textDecoration: "none",
            borderBottom: "1px dashed #c4a265",
            paddingBottom: 1,
          }}
        >
          ✉ teacherassistanteduprompt@gmail.com
        </a>
      </footer>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        textarea::placeholder { color: #b0a898; }
        input::placeholder { color: #b0a898; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(196,162,101,0.25); border-radius: 3px; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
