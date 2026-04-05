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
  const [showBookPanel, setShowBookPanel] = useState(false);
  const [bookTitle, setBookTitle] = useState("");
  const [bookContent, setBookContent] = useState("");
  const [expandedBook, setExpandedBook] = useState(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [draggingOver, setDraggingOver] = useState(false);
  const pdfInputRef = useRef(null);

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
          max_tokens: 4000,
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
      setResults(prev => ({ ...prev, [type === "all" ? "sinteza" : type]: `⚠️ Eroare la generare: ${errorMsg}\n\nÎncearcă din nou sau verifică dacă PDF-ul nu e prea mare.` }));
      if (type === "all") setActiveTab("sinteza");
    } finally {
      setLoading(false);
      setLoadingType("");
    }
  };

  const addBook = () => {
    if (!bookTitle.trim() || !bookContent.trim()) return;
    setBooks(prev => [...prev, { id: Date.now(), title: bookTitle.trim(), content: bookContent.trim(), isPdf: false }]);
    setBookTitle("");
    setBookContent("");
  };

  const processPdfFile = (file) => {
    if (!file || file.type !== "application/pdf") return;
    setUploadingPdf(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      const title = bookTitle.trim() || file.name.replace(/\.pdf$/i, "");
      setBooks(prev => [...prev, {
        id: Date.now(),
        title,
        content: `[PDF] ${file.name} — ${(file.size / 1024).toFixed(0)} KB`,
        pdfData: base64,
        isPdf: true,
        fileName: file.name,
        fileSize: file.size,
      }]);
      setBookTitle("");
      setUploadingPdf(false);
    };
    reader.onerror = () => setUploadingPdf(false);
    reader.readAsDataURL(file);
  };

  const handlePdfUpload = (e) => {
    processPdfFile(e.target.files?.[0]);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === "application/pdf") {
      processPdfFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOver(false);
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
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
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

        {/* Books toggle */}
        <button
          onClick={() => setShowBookPanel(!showBookPanel)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 20px", borderRadius: 12,
            border: showBookPanel ? "2px solid #c4a265" : "2px solid #e0d8c8",
            background: showBookPanel ? "rgba(196,162,101,0.08)" : "#fff",
            cursor: "pointer", fontSize: 14, fontWeight: 600,
            color: "#4a3f2f",
            fontFamily: "'Source Sans 3', sans-serif",
            transition: "all 0.2s",
          }}
        >
          <span style={{ fontSize: 18 }}>📚</span>
          Bibliotecă manuale
          {books.length > 0 && (
            <span style={{
              background: "#c4a265", color: "#fff",
              borderRadius: 10, padding: "1px 8px",
              fontSize: 12, fontWeight: 700,
            }}>{books.length}</span>
          )}
        </button>
      </header>

      {/* Books Panel */}
      {showBookPanel && (
        <div style={{
          background: "#fff",
          borderBottom: "1px solid #e8e0d0",
          padding: "24px 32px",
          overflow: "hidden",
        }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{
              display: "flex", alignItems: "flex-start", justifyContent: "space-between",
              marginBottom: 18, flexWrap: "wrap", gap: 8,
            }}>
              <div>
                <h2 style={{
                  margin: 0, fontSize: 18,
                  fontFamily: "'Playfair Display', serif",
                  fontWeight: 700, color: "#2a1f0f",
                }}>📚 Bibliotecă de cărți și manuale</h2>
                <p style={{
                  margin: "4px 0 0", fontSize: 12.5, color: "#8a7e6e",
                }}>Adaugă manuale de referință — conținutul lor va fi folosit automat la generarea materialelor</p>
              </div>
            </div>

            {/* Add book */}
            <div style={{
              background: "#faf8f3",
              borderRadius: 14,
              border: "1.5px dashed #d8d0c0",
              padding: 20, marginBottom: 16,
            }}>
              {/* Title input */}
              <input
                value={bookTitle}
                onChange={e => setBookTitle(e.target.value)}
                placeholder="Titlul manualului (ex: Gramatica limbii române, clasa a VII-a) — opțional pentru PDF"
                style={{
                  width: "100%", padding: "11px 14px",
                  border: "1.5px solid #e0d8c8", borderRadius: 10,
                  fontSize: 13.5, fontFamily: "'Source Sans 3', sans-serif",
                  background: "#fff", outline: "none",
                  boxSizing: "border-box", marginBottom: 12,
                }}
              />

              {/* Drag & Drop PDF Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => !uploadingPdf && pdfInputRef.current?.click()}
                style={{
                  border: draggingOver ? "2.5px dashed #c4a265" : "2px dashed #d8d0c0",
                  borderRadius: 12,
                  padding: "32px 20px",
                  textAlign: "center",
                  cursor: uploadingPdf ? "wait" : "pointer",
                  background: draggingOver ? "rgba(196,162,101,0.08)" : "#fff",
                  transition: "all 0.2s",
                  marginBottom: 12,
                }}
              >
                {uploadingPdf ? (
                  <div style={{ color: "#a8893e" }}>
                    <span style={{ fontSize: 28, display: "block", marginBottom: 8, animation: "spin 1s linear infinite" }}>⏳</span>
                    <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "'Source Sans 3', sans-serif" }}>
                      Se încarcă PDF-ul...
                    </span>
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: 36, display: "block", marginBottom: 8 }}>
                      {draggingOver ? "📥" : "📄"}
                    </span>
                    <span style={{
                      fontSize: 15, fontWeight: 600, color: "#2a1f0f",
                      fontFamily: "'Source Sans 3', sans-serif",
                      display: "block", marginBottom: 4,
                    }}>
                      {draggingOver ? "Eliberează pentru a încărca" : "Trage un fișier PDF aici"}
                    </span>
                    <span style={{
                      fontSize: 13, color: "#8a7e6e",
                      fontFamily: "'Source Sans 3', sans-serif",
                    }}>
                      sau <span style={{ color: "#c4a265", fontWeight: 600, textDecoration: "underline" }}>click pentru a selecta</span> din calculator
                    </span>
                  </>
                )}
              </div>
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handlePdfUpload}
                style={{ display: "none" }}
              />

              {/* Divider */}
              <div style={{
                display: "flex", alignItems: "center", gap: 14,
                margin: "4px 0 12px",
              }}>
                <div style={{ flex: 1, height: 1, background: "#e0d8c8" }} />
                <span style={{ fontSize: 12, color: "#a09888", fontFamily: "'Source Sans 3', sans-serif", fontWeight: 500 }}>SAU lipește text</span>
                <div style={{ flex: 1, height: 1, background: "#e0d8c8" }} />
              </div>

              {/* Text paste area */}
              <textarea
                value={bookContent}
                onChange={e => setBookContent(e.target.value)}
                placeholder="Lipește aici conținutul cărții sau manualului (text copiat din carte digitală, manual scanat etc.)..."
                rows={3}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1.5px solid #e0d8c8", borderRadius: 10,
                  fontSize: 13, fontFamily: "'Source Sans 3', sans-serif",
                  background: "#fff", outline: "none",
                  resize: "vertical", lineHeight: 1.55,
                  boxSizing: "border-box",
                }}
              />
              <button
                onClick={addBook}
                disabled={!bookTitle.trim() || !bookContent.trim()}
                style={{
                  marginTop: 10, padding: "10px 24px", borderRadius: 10,
                  border: "none", cursor: "pointer",
                  background: bookTitle.trim() && bookContent.trim()
                    ? "linear-gradient(135deg, #c4a265, #a8893e)" : "#ddd",
                  color: "#fff", fontSize: 13.5, fontWeight: 600,
                  fontFamily: "'Source Sans 3', sans-serif",
                  transition: "all 0.2s",
                }}
              >
                + Adaugă text manual
              </button>
            </div>

            {/* Book list */}
            {books.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {books.map(b => (
                  <div key={b.id} style={{
                    background: "#faf8f3",
                    borderRadius: 10, padding: "14px 16px",
                    border: "1px solid #e8e0d0",
                  }}>
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "center", gap: 12,
                    }}>
                      <div
                        style={{ flex: 1, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
                        onClick={() => setExpandedBook(expandedBook === b.id ? null : b.id)}
                      >
                        <span style={{ fontSize: 20 }}>{b.isPdf ? "📄" : "📗"}</span>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{
                              fontWeight: 600, fontSize: 14, color: "#2a1f0f",
                              fontFamily: "'Playfair Display', serif",
                            }}>{b.title}</span>
                            {b.isPdf && (
                              <span style={{
                                background: "rgba(196,162,101,0.15)",
                                color: "#a8893e", fontSize: 10, fontWeight: 700,
                                padding: "2px 7px", borderRadius: 4,
                                fontFamily: "'Source Sans 3', sans-serif",
                                letterSpacing: "0.5px",
                              }}>PDF</span>
                            )}
                          </div>
                          <div style={{ fontSize: 11.5, color: "#8a7e6e", marginTop: 2 }}>
                            {b.isPdf
                              ? `${b.fileName} · ${(b.fileSize / 1024).toFixed(0)} KB`
                              : `${b.content.split(/\s+/).length.toLocaleString()} cuvinte · ${b.content.length.toLocaleString()} caractere`
                            }
                          </div>
                        </div>
                        <span style={{
                          fontSize: 11, color: "#c4a265", marginLeft: "auto",
                          fontWeight: 500,
                        }}>
                          {expandedBook === b.id ? "▲ ascunde" : (b.isPdf ? "▼ detalii" : "▼ previzualizare")}
                        </span>
                      </div>
                      <button onClick={() => removeBook(b.id)} style={{
                        background: "rgba(180,60,60,0.06)",
                        border: "1px solid rgba(180,60,60,0.12)",
                        borderRadius: 8, padding: "5px 14px",
                        fontSize: 12.5, color: "#b43c3c",
                        cursor: "pointer", fontWeight: 500,
                        fontFamily: "'Source Sans 3', sans-serif",
                        flexShrink: 0,
                      }}>✕ Șterge</button>
                    </div>
                    {expandedBook === b.id && (
                      <div style={{
                        marginTop: 12, padding: 14,
                        background: "#fff", borderRadius: 8,
                        fontSize: 12.5, color: "#5a5044",
                        lineHeight: 1.65, maxHeight: 180,
                        overflow: "auto", border: "1px solid #e8e0d0",
                        whiteSpace: "pre-wrap",
                      }}>
                        {b.isPdf ? (
                          <div style={{ textAlign: "center", padding: "20px 0", color: "#8a7e6e" }}>
                            <span style={{ fontSize: 32, display: "block", marginBottom: 8 }}>📄</span>
                            Fișier PDF încărcat: <strong>{b.fileName}</strong><br />
                            Conținutul va fi trimis direct la AI pentru procesare.
                          </div>
                        ) : (
                          <>{b.content.substring(0, 3000)}{b.content.length > 3000 ? "\n\n... (conținut trunchiat pentru previzualizare)" : ""}</>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                textAlign: "center", padding: "12px 0 4px", color: "#a09888",
                fontSize: 13,
              }}>
                Niciun manual adăugat încă. Materialele vor fi generate doar pe baza textului lecției.
              </div>
            )}
          </div>
        </div>
      )}

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
              ? `Scrie titlul lecției (ex: „Substantivul", „Verbul — moduri și timpuri", „Propoziția subordonată") sau lipește textul complet al lecției.\n\nAI-ul va căuta subiectul în manualele încărcate și va genera materialele pe baza lor.`
              : `Lipește aici textul lecției, sau scrie titlul unei lecții...\n\nExemplu: Revoluția Industrială a reprezentat o perioadă de transformare majoră în Europa, începând cu a doua jumătate a secolului al XVIII-lea...\n\n💡 Sfat: Încarcă un manual PDF din „Bibliotecă manuale" pentru rezultate bazate pe surse concrete.`}
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
