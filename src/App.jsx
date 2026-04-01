import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `Rolul tău: Ești un asistent specializat în educație și formare, care ajută profesorii și formatorii să creeze rapid materiale didactice de calitate. Numele tău este EduPrompt Teacher Assistant.

Scopul aplicației: Primești de la utilizator un text educațional (lecție, fragment din programă, suport de curs) și generezi automat resurse complete pentru predare și evaluare.

Instrucțiuni generale: Pentru fiecare material primit, vei genera întotdeauna următoarele, într-un format clar, structurat și ușor de copiat:

1. **Rezumatul lecției** – concis, 5–7 rânduri
2. **5 întrebări de verificare a înțelegerii** – întrebări deschise, cu răspunsuri așteptate
3. **5 itemi grilă** – întrebări cu variante de răspuns (A, B, C, D) și răspunsul corect marcat
4. **3 exerciții de analiză** – activități care solicită gândire critică, aplicare sau interpretare
5. **O fișă de lucru pe două niveluri de dificultate** – una pentru nivel mediu, una pentru nivel avansat
6. **O temă pentru acasă** – scurtă, relevantă și aplicabilă

La finalul răspunsului, adaugă o scurtă evaluare a eficienței procesului (timp estimat economisit, calitate, observații).

Formatează răspunsul folosind Markdown clar, cu headere, liste numerotate și bold pentru secțiuni. Fii detaliat și profesionist.`;

const OPTION_PROMPTS = {
  1: "Adaptează materialele generate anterior pe niveluri de dificultate: nivel de bază (pentru elevi cu dificultăți de învățare), nivel mediu și nivel avansat (pentru elevi performanți). Păstrează formatul Markdown clar.",
  2: "Transformă conținutul generat anterior într-un mini-test de 10 minute cu barem de corectare detaliat. Include: 5 itemi grilă (câte 1 punct fiecare), 2 întrebări cu răspuns scurt (câte 1.5 puncte fiecare) și 1 subiect de tip eseu scurt (2 puncte). Total: 10 puncte. Se acordă 1 punct din oficiu. Adaugă baremul complet.",
  3: "Analizează critic materialele generate anterior și oferă feedback constructiv: ce este bine, ce poate fi îmbunătățit, sugestii concrete de reformulare, potențiale probleme pedagogice și recomandări de bune practici.",
  4: "Generează o nouă fișă de lucru pe o temă conexă/complementară celei originale, păstrând același format și nivel de calitate."
};

/* ── tiny markdown→HTML ── */
function md(text) {
  if (!text) return "";
  let h = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^---$/gm, '<hr/>')
    .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>');
  // wrap consecutive <li> in <ul>
  h = h.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  // paragraphs
  h = h.split(/\n{2,}/).map(p => {
    p = p.trim();
    if (/^<[hul]/.test(p) || /^<hr/.test(p)) return p;
    return `<p>${p.replace(/\n/g, '<br/>')}</p>`;
  }).join('');
  return h;
}

/* ── icons ── */
const BookIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
);
const SparkleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/>
  </svg>
);
const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
  </svg>
);
const LoaderIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
      <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
    </path>
  </svg>
);

const FONTS_URL = "https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap";

export default function EduPromptApp() {
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState([]); // {role, content}
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [phase, setPhase] = useState("input"); // input | result
  const [loadingMsg, setLoadingMsg] = useState(0);
  const resultRef = useRef(null);

  const loadingMessages = [
    "Analizez conținutul lecției...",
    "Formulez întrebările de verificare...",
    "Construiesc itemii de tip grilă...",
    "Pregătesc exercițiile de analiză...",
    "Finalizez fișele de lucru...",
    "Ultimele retușuri la materiale..."
  ];

  useEffect(() => {
    if (!loading) return;
    const iv = setInterval(() => setLoadingMsg(p => (p + 1) % loadingMessages.length), 2800);
    return () => clearInterval(iv);
  }, [loading]);

  async function callAPI(userContent, history = []) {
    setLoading(true);
    setError("");
    setLoadingMsg(0);
    try {
      const msgs = [...history, { role: "user", content: userContent }];
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: msgs
        })
      });
      if (!res.ok) throw new Error(`Eroare API: ${res.status}`);
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("\n") || "Nu s-a primit răspuns.";
      const newMessages = [...msgs, { role: "assistant", content: text }];
      setMessages(newMessages);
      setResult(text);
      setPhase("result");
      setTimeout(() => resultRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 100);
    } catch (e) {
      setError(e.message || "Eroare necunoscută.");
    } finally {
      setLoading(false);
    }
  }

  function handleGenerate() {
    if (!inputText.trim()) return;
    callAPI(`Iată textul lecției pe care doresc să-l prelucrezi:\n\n${inputText}`);
  }

  function handleOption(opt) {
    callAPI(OPTION_PROMPTS[opt], messages);
  }

  function handleCopy() {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleReset() {
    setPhase("input");
    setResult("");
    setMessages([]);
    setInputText("");
    setError("");
  }

  return (
    <>
      <link href={FONTS_URL} rel="stylesheet" />
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
          --bg: #FAF7F2;
          --surface: #FFFFFF;
          --ink: #1A1A2E;
          --ink2: #4A4A6A;
          --accent: #B8621B;
          --accent2: #D4881C;
          --accent-soft: #FFF3E6;
          --border: #E8E2D8;
          --green: #2D8F5E;
          --green-soft: #E8F5EE;
          --blue: #2563EB;
          --blue-soft: #EFF6FF;
          --purple: #7C3AED;
          --purple-soft: #F3EEFF;
          --red: #DC2626;
          --red-soft: #FEF2F2;
          --radius: 12px;
          --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
          --shadow-lg: 0 4px 20px rgba(0,0,0,0.08), 0 8px 32px rgba(0,0,0,0.04);
          --font-display: 'DM Serif Display', Georgia, serif;
          --font-body: 'Plus Jakarta Sans', -apple-system, sans-serif;
        }
        html, body, #root { height: 100%; }
        body { background: var(--bg); font-family: var(--font-body); color: var(--ink); }

        .app-shell {
          display: flex; flex-direction: column;
          height: 100vh; max-height: 100vh; overflow: hidden;
          background: var(--bg);
        }

        /* ── header ── */
        .header {
          display: flex; align-items: center; gap: 14px;
          padding: 16px 28px;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .header-logo {
          width: 44px; height: 44px; border-radius: 10px;
          background: linear-gradient(135deg, var(--accent), var(--accent2));
          display: flex; align-items: center; justify-content: center;
          color: white; flex-shrink: 0;
        }
        .header h1 {
          font-family: var(--font-display); font-size: 1.35rem;
          font-weight: 400; color: var(--ink); line-height: 1.2;
        }
        .header p {
          font-size: 0.78rem; color: var(--ink2); margin-top: 1px;
        }
        .header-actions { margin-left: auto; display: flex; gap: 8px; }
        .btn-ghost {
          padding: 8px 14px; border-radius: 8px;
          border: 1px solid var(--border); background: var(--surface);
          font-family: var(--font-body); font-size: 0.8rem;
          color: var(--ink2); cursor: pointer; transition: all 0.15s;
        }
        .btn-ghost:hover { background: var(--accent-soft); color: var(--accent); border-color: var(--accent); }

        /* ── main area ── */
        .main { flex: 1; overflow: hidden; display: flex; flex-direction: column; }

        /* ── INPUT PHASE ── */
        .input-phase {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 32px 24px; overflow-y: auto;
        }
        .input-hero {
          text-align: center; max-width: 640px; margin-bottom: 28px;
        }
        .input-hero h2 {
          font-family: var(--font-display); font-size: 2rem;
          font-weight: 400; color: var(--ink); margin-bottom: 10px;
        }
        .input-hero p { color: var(--ink2); font-size: 0.92rem; line-height: 1.6; }
        .input-card {
          width: 100%; max-width: 720px;
          background: var(--surface); border-radius: var(--radius);
          border: 1px solid var(--border); box-shadow: var(--shadow);
          overflow: hidden;
        }
        .input-card textarea {
          width: 100%; min-height: 220px; padding: 20px 22px;
          border: none; outline: none; resize: vertical;
          font-family: var(--font-body); font-size: 0.92rem;
          line-height: 1.7; color: var(--ink); background: transparent;
        }
        .input-card textarea::placeholder { color: #B0A898; }
        .input-footer {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 18px; border-top: 1px solid var(--border);
          background: #FDFCFA;
        }
        .char-count { font-size: 0.75rem; color: var(--ink2); }
        .btn-generate {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 10px 22px; border-radius: 8px; border: none;
          background: linear-gradient(135deg, var(--accent), var(--accent2));
          color: white; font-family: var(--font-body); font-size: 0.88rem;
          font-weight: 600; cursor: pointer; transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(184,98,27,0.25);
        }
        .btn-generate:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(184,98,27,0.35); }
        .btn-generate:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        .features-row {
          display: flex; gap: 14px; flex-wrap: wrap; justify-content: center;
          max-width: 720px; margin-top: 24px;
        }
        .feature-chip {
          display: flex; align-items: center; gap: 6px;
          padding: 6px 14px; border-radius: 20px;
          font-size: 0.75rem; font-weight: 500;
        }
        .fc-1 { background: var(--accent-soft); color: var(--accent); }
        .fc-2 { background: var(--green-soft); color: var(--green); }
        .fc-3 { background: var(--blue-soft); color: var(--blue); }
        .fc-4 { background: var(--purple-soft); color: var(--purple); }

        /* ── RESULT PHASE ── */
        .result-phase {
          flex: 1; display: flex; flex-direction: column; overflow: hidden;
        }
        .result-toolbar {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 24px; border-bottom: 1px solid var(--border);
          background: var(--surface); flex-shrink: 0; flex-wrap: wrap;
        }
        .result-toolbar .label {
          font-size: 0.78rem; font-weight: 600; color: var(--ink2);
          text-transform: uppercase; letter-spacing: 0.05em; margin-right: 6px;
        }
        .opt-btn {
          padding: 7px 14px; border-radius: 7px; border: 1px solid var(--border);
          background: var(--surface); font-family: var(--font-body);
          font-size: 0.78rem; color: var(--ink); cursor: pointer;
          transition: all 0.15s; white-space: nowrap;
        }
        .opt-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
        .opt-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .result-scroll {
          flex: 1; overflow-y: auto; padding: 28px 24px;
        }
        .result-content {
          max-width: 780px; margin: 0 auto;
          background: var(--surface); border-radius: var(--radius);
          border: 1px solid var(--border); box-shadow: var(--shadow);
          padding: 32px 36px;
        }
        .result-content h1 { font-family: var(--font-display); font-size: 1.5rem; color: var(--accent); margin: 28px 0 12px; font-weight: 400; }
        .result-content h2 { font-family: var(--font-display); font-size: 1.25rem; color: var(--accent); margin: 24px 0 10px; font-weight: 400; }
        .result-content h3 { font-family: var(--font-display); font-size: 1.1rem; color: var(--ink); margin: 20px 0 8px; font-weight: 400; }
        .result-content p { font-size: 0.9rem; line-height: 1.75; color: var(--ink); margin-bottom: 10px; }
        .result-content strong { color: var(--accent); font-weight: 600; }
        .result-content em { color: var(--ink2); }
        .result-content ul { padding-left: 20px; margin-bottom: 12px; }
        .result-content li { font-size: 0.9rem; line-height: 1.7; color: var(--ink); margin-bottom: 4px; }
        .result-content hr { border: none; border-top: 1px solid var(--border); margin: 20px 0; }

        .copy-bar {
          display: flex; justify-content: flex-end; gap: 8px;
          margin-bottom: 16px;
        }
        .btn-copy {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 14px; border-radius: 7px; border: 1px solid var(--border);
          background: var(--surface); font-family: var(--font-body);
          font-size: 0.78rem; cursor: pointer; transition: all 0.15s;
          color: var(--ink2);
        }
        .btn-copy:hover { border-color: var(--green); color: var(--green); }
        .btn-copy.copied { border-color: var(--green); color: var(--green); background: var(--green-soft); }

        /* ── loading overlay ── */
        .loading-overlay {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 18px;
          padding: 40px;
        }
        .spinner-ring {
          width: 56px; height: 56px; border-radius: 50%;
          border: 3px solid var(--border);
          border-top-color: var(--accent);
          animation: spin 0.9s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .loading-text {
          font-size: 0.95rem; color: var(--ink2);
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }

        /* ── error ── */
        .error-box {
          max-width: 500px; margin: 24px auto; padding: 16px 20px;
          background: var(--red-soft); border: 1px solid #FCA5A5;
          border-radius: var(--radius); color: var(--red);
          font-size: 0.88rem; text-align: center;
        }

        /* ── responsive ── */
        @media (max-width: 600px) {
          .header { padding: 12px 16px; }
          .header h1 { font-size: 1.1rem; }
          .input-hero h2 { font-size: 1.5rem; }
          .input-phase { padding: 20px 14px; }
          .result-scroll { padding: 16px 10px; }
          .result-content { padding: 20px 18px; }
          .result-toolbar { padding: 8px 12px; }
          .features-row { gap: 8px; }
        }
      `}</style>

      <div className="app-shell">
        {/* HEADER */}
        <header className="header">
          <div className="header-logo"><BookIcon /></div>
          <div>
            <h1>EduPrompt Teacher Assistant</h1>
            <p>Generator inteligent de materiale didactice</p>
          </div>
          {phase === "result" && (
            <div className="header-actions">
              <button className="btn-ghost" onClick={handleReset}>✦ Lecție nouă</button>
            </div>
          )}
        </header>

        <div className="main">
          {/* ── LOADING ── */}
          {loading && (
            <div className="loading-overlay">
              <div className="spinner-ring" />
              <div className="loading-text">{loadingMessages[loadingMsg]}</div>
            </div>
          )}

          {/* ── ERROR ── */}
          {error && !loading && (
            <div style={{ padding: "20px" }}>
              <div className="error-box">
                ⚠ {error}
                <br /><br />
                <button className="btn-ghost" onClick={() => setError("")}>Încearcă din nou</button>
              </div>
            </div>
          )}

          {/* ── INPUT PHASE ── */}
          {phase === "input" && !loading && !error && (
            <div className="input-phase">
              <div className="input-hero">
                <h2>Transformă orice lecție în resurse complete</h2>
                <p>
                  Introdu textul educațional și voi genera automat: rezumat, întrebări de verificare,
                  itemi grilă, exerciții de analiză, fișe de lucru diferențiate și temă pentru acasă.
                </p>
              </div>

              <div className="input-card">
                <textarea
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder={'Lipeste aici textul lectiei, fragmentul din programa sau suportul de curs...\n\nExemplu: Revolutia Industriala a reprezentat o perioada de transformare majora in Europa, incepand cu a doua jumatate a secolului al XVIII-lea...'}
                />
                <div className="input-footer">
                  <span className="char-count">{inputText.length} caractere</span>
                  <button
                    className="btn-generate"
                    onClick={handleGenerate}
                    disabled={!inputText.trim() || loading}
                  >
                    <SparkleIcon /> Generează materiale
                  </button>
                </div>
              </div>

              <div className="features-row">
                <span className="feature-chip fc-1">📝 Rezumat &amp; Întrebări</span>
                <span className="feature-chip fc-2">✅ Itemi grilă</span>
                <span className="feature-chip fc-3">🧠 Exerciții de analiză</span>
                <span className="feature-chip fc-4">📄 Fișe diferențiate</span>
              </div>
            </div>
          )}

          {/* ── RESULT PHASE ── */}
          {phase === "result" && !loading && !error && (
            <div className="result-phase">
              <div className="result-toolbar">
                <span className="label">Opțiuni:</span>
                <button className="opt-btn" onClick={() => handleOption(1)} disabled={loading}>
                  🎯 Adaptează pe niveluri
                </button>
                <button className="opt-btn" onClick={() => handleOption(2)} disabled={loading}>
                  ⏱ Mini-test 10 min cu barem
                </button>
                <button className="opt-btn" onClick={() => handleOption(3)} disabled={loading}>
                  💡 Feedback îmbunătățiri
                </button>
                <button className="opt-btn" onClick={() => handleOption(4)} disabled={loading}>
                  📋 Fișă nouă, altă temă
                </button>
              </div>

              <div className="result-scroll" ref={resultRef}>
                <div style={{ maxWidth: 780, margin: "0 auto" }}>
                  <div className="copy-bar">
                    <button className={`btn-copy${copied ? " copied" : ""}`} onClick={handleCopy}>
                      {copied ? <><CheckIcon /> Copiat!</> : <><CopyIcon /> Copiază tot</>}
                    </button>
                  </div>
                  <div
                    className="result-content"
                    dangerouslySetInnerHTML={{ __html: md(result) }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
