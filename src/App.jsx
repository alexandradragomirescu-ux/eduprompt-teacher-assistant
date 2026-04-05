import { useState, useRef, useEffect, useCallback } from "react";

const SYSTEM_PROMPT = `Rolul tău: Ești un asistent specializat în educație și formare, care ajută profesorii și formatorii să creeze rapid materiale didactice de calitate. Numele tău este EduPrompt Teacher Assistant.

Scopul aplicației: Primești de la utilizator un text educațional (lecție, fragment din programă, suport de curs) SAU o imagine cu textul lecției și generezi automat resurse complete pentru predare și evaluare.

Dacă primești o imagine, mai întâi transcrie/extrage conținutul educațional din imagine, apoi generează materialele.

Instrucțiuni generale: Pentru fiecare material primit, vei genera întotdeauna următoarele, într-un format clar, structurat și ușor de copiat:

1. **Rezumatul lecției** – concis, 5–7 rânduri
2. **5 întrebări de verificare a înțelegerii** – întrebări deschise, cu răspunsuri așteptate
3. **5 itemi grilă** – întrebări cu variante de răspuns (A, B, C, D) și răspunsul corect marcat
4. **3 exerciții de analiză** – activități care solicită gândire critică, aplicare sau interpretare
5. **O fișă de lucru pe două niveluri de dificultate** – una pentru nivel mediu, una pentru nivel avansat
6. **O temă pentru acasă** – scurtă, relevantă și aplicabilă

La finalul răspunsului, adaugă o scurtă evaluare a eficienței procesului (timp estimat economisit, calitate, observații).

Formatează răspunsul folosind Markdown clar, cu headere, liste numerotate și bold pentru secțiuni. Fii detaliat și profesionist. Răspunde DOAR în limba română.`;

const FOCUSED_PROMPTS = {
  rezumat: `Ești un profesor expert. Dacă primești o imagine, mai întâi extrage conținutul educațional din ea. Apoi generează DOAR:
1. **Rezumatul lecției** – concis, 5–7 rânduri
2. **5 întrebări de verificare a înțelegerii** – întrebări deschise, cu răspunsuri așteptate

Formatează răspunsul folosind Markdown clar. Răspunde DOAR în limba română.`,

  grila: (num) => `Ești un profesor expert. Dacă primești o imagine, mai întâi extrage conținutul educațional din ea. Apoi generează EXACT ${num} ITEMI GRILĂ.

Fiecare item trebuie să aibă:
- Întrebarea
- 4 variante de răspuns (A, B, C, D)
- Răspunsul corect marcat cu ✔️

Formatează răspunsul folosind Markdown clar. Răspunde DOAR în limba română.`,

  analiza: (num) => `Ești un profesor expert. Dacă primești o imagine, mai întâi extrage conținutul educațional din ea. Apoi generează EXACT ${num} EXERCIȚII DE ANALIZĂ complexe.

Exercițiile trebuie să solicite gândire critică, aplicare sau interpretare. Include exerciții variate: comparație, argumentare, sinteză, evaluare.

Pentru fiecare exercițiu include:
- Titlul exercițiului
- Cerința detaliată
- Indicații pentru rezolvare

Formatează răspunsul folosind Markdown clar. Răspunde DOAR în limba română.`,

  fise: `Ești un profesor expert. Dacă primești o imagine, mai întâi extrage conținutul educațional din ea. Apoi generează DOAR FIȘE DE LUCRU DIFERENȚIATE pe 3 niveluri:

1. **Nivel de bază** (pentru elevii care au nevoie de sprijin suplimentar) – exerciții simple, cu suport
2. **Nivel mediu** (pentru majoritatea elevilor) – exerciții moderate
3. **Nivel avansat** (pentru elevii performanți) – exerciții provocatoare, de aprofundare

Fiecare fișă trebuie să conțină 3-4 exerciții.

Formatează răspunsul folosind Markdown clar. Răspunde DOAR în limba română.`
};

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
  h = h.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  h = h.split(/\n{2,}/).map(p => {
    p = p.trim();
    if (/^<[hul]/.test(p) || /^<hr/.test(p)) return p;
    return `<p>${p.replace(/\n/g, '<br/>')}</p>`;
  }).join('');
  return h;
}

/* ── DOCX download (HTML→Word-compatible .doc) ── */
function downloadAsDocx(markdownText) {
  const htmlContent = md(markdownText);
  const docTemplate = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.6;color:#1a1a2e;padding:40px}h1{font-size:18pt;color:#B8621B;margin-top:24pt;margin-bottom:8pt;border-bottom:2px solid #E8E2D8;padding-bottom:6pt}h2{font-size:15pt;color:#B8621B;margin-top:20pt;margin-bottom:6pt}h3{font-size:13pt;color:#1a1a2e;margin-top:16pt;margin-bottom:6pt}p{margin-bottom:6pt}strong{color:#B8621B}ul{padding-left:20pt;margin-bottom:8pt}li{margin-bottom:3pt}hr{border:none;border-top:1px solid #E8E2D8;margin:16pt 0}</style></head><body><div style="text-align:center;margin-bottom:24pt;padding-bottom:16pt;border-bottom:3px solid #B8621B"><h1 style="border-bottom:none;font-size:20pt;margin-bottom:4pt">EduPrompt Teacher Assistant</h1><p style="color:#4A4A6A;font-size:10pt">Materiale didactice generate automat</p></div>${htmlContent}<div style="margin-top:32pt;padding-top:12pt;border-top:2px solid #E8E2D8;text-align:center"><p style="color:#4A4A6A;font-size:9pt">Generat cu EduPrompt Teacher Assistant</p></div></body></html>`;

  try {
    const blob = new Blob([docTemplate], { type: 'application/msword' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const now = new Date();
    const d = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
    link.setAttribute('download', 'materiale-didactice-' + d + '.doc');
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 100);
  } catch (err) {
    alert('Eroare la descărcare: ' + err.message);
  }
}
  h1 {
    font-family: 'Georgia', serif;
    font-size: 18pt;
    color: #B8621B;
    margin-top: 24pt;
    margin-bottom: 8pt;
    border-bottom: 2px solid #E8E2D8;
    padding-bottom: 6pt;
  }
  h2 {
    font-family: 'Georgia', serif;
    font-size: 15pt;
    color: #B8621B;
    margin-top: 20pt;
    margin-bottom: 6pt;
  }
  h3 {
    font-family: 'Georgia', serif;
    font-size: 13pt;
    color: #1a1a2e;
    margin-top: 16pt;
    margin-bottom: 6pt;
  }
  p {
    font-size: 11pt;
    margin-bottom: 6pt;
  }
  strong {
    color: #B8621B;
  }
  ul {
    padding-left: 20pt;
    margin-bottom: 8pt;
  }
  li {
    font-size: 11pt;
    margin-bottom: 3pt;
    line-height: 1.6;
  }
  hr {
    border: none;
    border-top: 1px solid #E8E2D8;
    margin: 16pt 0;
  }
</style>
</head>
<body>
<div style="text-align: center; margin-bottom: 24pt; padding-bottom: 16pt; border-bottom: 3px solid #B8621B;">
  <h1 style="border-bottom: none; color: #B8621B; font-size: 20pt; margin-bottom: 4pt;">EduPrompt Teacher Assistant</h1>
  <p style="color: #4A4A6A; font-size: 10pt;">Materiale didactice generate automat</p>
</div>
${htmlContent}
<div style="margin-top: 32pt; padding-top: 12pt; border-top: 2px solid #E8E2D8; text-align: center;">
  <p style="color: #4A4A6A; font-size: 9pt;">Generat cu EduPrompt Teacher Assistant</p>
</div>
</body>
</html>`;

  const blob = new Blob(['\ufeff', docTemplate], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  a.download = `materiale-didactice-${dateStr}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const ImageIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
  </svg>
);
const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const FONTS_URL = "https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap";

export default function EduPromptApp() {
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState([]);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [phase, setPhase] = useState("input");
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [activeChip, setActiveChip] = useState(null);
  const [numGrila, setNumGrila] = useState(5);
  const [numAnaliza, setNumAnaliza] = useState(3);
  const [imageData, setImageData] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const resultRef = useRef(null);
  const fileInputRef = useRef(null);

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

  const processImage = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 20 * 1024 * 1024) {
      setError("Imaginea este prea mare. Limita este 20MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const base64 = dataUrl.split(",")[1];
      setImageData({ base64, mediaType: file.type, preview: dataUrl, name: file.name });
    };
    reader.readAsDataURL(file);
  }, []);

  useEffect(() => {
    const handlePaste = (e) => {
      if (phase !== "input") return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          processImage(item.getAsFile());
          return;
        }
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [phase, processImage]);

  function buildUserContent(promptText) {
    const parts = [];
    if (imageData) {
      parts.push({
        type: "image",
        source: { type: "base64", media_type: imageData.mediaType, data: imageData.base64 }
      });
    }
    parts.push({ type: "text", text: promptText });
    return parts;
  }

  async function callAPI(userContent, systemPrompt, history = []) {
    setLoading(true);
    setError("");
    setLoadingMsg(0);
    try {
      const msgs = [...history, { role: "user", content: userContent }];
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: systemPrompt,
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
    if (!inputText.trim() && !imageData) return;
    setActiveChip(null);
    const prompt = inputText.trim()
      ? `Iată textul lecției pe care doresc să-l prelucrezi:\n\n${inputText}`
      : "Analizează imaginea atașată care conține textul lecției și generează materialele didactice.";
    callAPI(buildUserContent(prompt), SYSTEM_PROMPT);
  }

  function handleFocusedGenerate(type) {
    if (!inputText.trim() && !imageData) return;
    setActiveChip(type);
    let systemPrompt;
    if (type === "grila") systemPrompt = FOCUSED_PROMPTS.grila(numGrila);
    else if (type === "analiza") systemPrompt = FOCUSED_PROMPTS.analiza(numAnaliza);
    else systemPrompt = FOCUSED_PROMPTS[type];
    const prompt = inputText.trim()
      ? `Iată textul lecției:\n\n${inputText}`
      : "Analizează imaginea atașată care conține textul lecției.";
    callAPI(buildUserContent(prompt), systemPrompt);
  }

  function handleOption(opt) {
    callAPI(OPTION_PROMPTS[opt], SYSTEM_PROMPT, messages);
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
    setActiveChip(null);
    setImageData(null);
  }

  function handleDragOver(e) { e.preventDefault(); setDragOver(true); }
  function handleDragLeave(e) { e.preventDefault(); setDragOver(false); }
  function handleDrop(e) {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processImage(file);
  }

  const hasInput = inputText.trim() || imageData;

  return (
    <>
      <link href={FONTS_URL} rel="stylesheet" />
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
          --bg: #FAF7F2; --surface: #FFFFFF; --ink: #1A1A2E; --ink2: #4A4A6A;
          --accent: #B8621B; --accent2: #D4881C; --accent-soft: #FFF3E6;
          --border: #E8E2D8; --green: #2D8F5E; --green-soft: #E8F5EE;
          --blue: #2563EB; --blue-soft: #EFF6FF; --purple: #7C3AED; --purple-soft: #F3EEFF;
          --red: #DC2626; --red-soft: #FEF2F2; --radius: 12px;
          --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
          --font-display: 'DM Serif Display', Georgia, serif;
          --font-body: 'Plus Jakarta Sans', -apple-system, sans-serif;
        }
        html, body, #root { height: 100%; }
        body { background: var(--bg); font-family: var(--font-body); color: var(--ink); }
        .app-shell { display: flex; flex-direction: column; height: 100vh; max-height: 100vh; overflow: hidden; background: var(--bg); }

        .header { display: flex; align-items: center; gap: 14px; padding: 16px 28px; background: var(--surface); border-bottom: 1px solid var(--border); flex-shrink: 0; }
        .header-logo { width: 44px; height: 44px; border-radius: 10px; background: linear-gradient(135deg, var(--accent), var(--accent2)); display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; }
        .header h1 { font-family: var(--font-display); font-size: 1.35rem; font-weight: 400; color: var(--ink); line-height: 1.2; }
        .header p { font-size: 0.78rem; color: var(--ink2); margin-top: 1px; }
        .header-actions { margin-left: auto; display: flex; gap: 8px; }
        .btn-ghost { padding: 8px 14px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); font-family: var(--font-body); font-size: 0.8rem; color: var(--ink2); cursor: pointer; transition: all 0.15s; }
        .btn-ghost:hover { background: var(--accent-soft); color: var(--accent); border-color: var(--accent); }

        .main { flex: 1; overflow: hidden; display: flex; flex-direction: column; }

        .input-phase { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 24px; overflow-y: auto; }
        .input-hero { text-align: center; max-width: 640px; margin-bottom: 28px; }
        .input-hero h2 { font-family: var(--font-display); font-size: 2rem; font-weight: 400; color: var(--ink); margin-bottom: 10px; }
        .input-hero p { color: var(--ink2); font-size: 0.92rem; line-height: 1.6; }

        .input-card { width: 100%; max-width: 720px; background: var(--surface); border-radius: var(--radius); border: 1px solid var(--border); box-shadow: var(--shadow); overflow: hidden; transition: border-color 0.2s; }
        .input-card.drag-over { border-color: var(--accent); border-style: dashed; background: var(--accent-soft); }
        .input-card textarea { width: 100%; min-height: 180px; padding: 20px 22px; border: none; outline: none; resize: vertical; font-family: var(--font-body); font-size: 0.92rem; line-height: 1.7; color: var(--ink); background: transparent; }
        .input-card textarea::placeholder { color: #B0A898; }

        .image-preview-bar { display: flex; align-items: center; gap: 10px; padding: 10px 18px; border-top: 1px solid var(--border); background: var(--blue-soft); }
        .image-thumb { width: 56px; height: 56px; border-radius: 8px; object-fit: cover; border: 1px solid var(--border); }
        .image-info { flex: 1; }
        .image-info .name { font-size: 0.82rem; font-weight: 600; color: var(--ink); }
        .image-info .hint { font-size: 0.72rem; color: var(--ink2); margin-top: 2px; }
        .image-remove { width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--red); transition: all 0.15s; }
        .image-remove:hover { background: var(--red-soft); border-color: var(--red); }

        .input-footer { display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; border-top: 1px solid var(--border); background: #FDFCFA; gap: 10px; flex-wrap: wrap; }
        .footer-left { display: flex; align-items: center; gap: 10px; }
        .char-count { font-size: 0.75rem; color: var(--ink2); }
        .btn-upload { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 7px; border: 1px solid var(--border); background: var(--surface); font-family: var(--font-body); font-size: 0.78rem; color: var(--ink2); cursor: pointer; transition: all 0.15s; }
        .btn-upload:hover { border-color: var(--blue); color: var(--blue); background: var(--blue-soft); }

        .btn-generate { display: inline-flex; align-items: center; gap: 8px; padding: 10px 22px; border-radius: 8px; border: none; background: linear-gradient(135deg, var(--accent), var(--accent2)); color: white; font-family: var(--font-body); font-size: 0.88rem; font-weight: 600; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 8px rgba(184,98,27,0.25); }
        .btn-generate:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(184,98,27,0.35); }
        .btn-generate:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        .features-row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; max-width: 720px; margin-top: 24px; }
        .feature-chip { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; border: 2px solid transparent; cursor: pointer; transition: all 0.2s; font-family: var(--font-body); }
        .feature-chip:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .feature-chip:active { transform: scale(0.97); }
        .feature-chip:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
        .fc-1 { background: var(--accent-soft); color: var(--accent); }
        .fc-1:hover { border-color: var(--accent); }
        .fc-2 { background: var(--green-soft); color: var(--green); }
        .fc-2:hover { border-color: var(--green); }
        .fc-3 { background: var(--blue-soft); color: var(--blue); }
        .fc-3:hover { border-color: var(--blue); }
        .fc-4 { background: var(--purple-soft); color: var(--purple); }
        .fc-4:hover { border-color: var(--purple); }

        .num-controls-row { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; max-width: 720px; margin-top: 16px; }
        .num-control { display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 6px 14px; font-family: var(--font-body); transition: border-color 0.2s; }
        .num-control:hover { border-color: var(--accent); }
        .num-label { font-size: 0.78rem; color: var(--ink2); font-weight: 500; white-space: nowrap; }
        .num-btn { width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg); cursor: pointer; font-size: 1rem; color: var(--ink2); display: flex; align-items: center; justify-content: center; font-family: var(--font-body); transition: all 0.15s; line-height: 1; }
        .num-btn:hover { background: var(--accent); color: white; border-color: var(--accent); }
        .num-btn:active { transform: scale(0.9); }
        .num-value { min-width: 28px; text-align: center; font-size: 1.05rem; font-weight: 700; color: var(--ink); font-family: var(--font-display); }

        .result-phase { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .result-toolbar { display: flex; align-items: center; gap: 8px; padding: 10px 24px; border-bottom: 1px solid var(--border); background: var(--surface); flex-shrink: 0; flex-wrap: wrap; }
        .result-toolbar .label { font-size: 0.78rem; font-weight: 600; color: var(--ink2); text-transform: uppercase; letter-spacing: 0.05em; margin-right: 6px; }
        .opt-btn { padding: 7px 14px; border-radius: 7px; border: 1px solid var(--border); background: var(--surface); font-family: var(--font-body); font-size: 0.78rem; color: var(--ink); cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .opt-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
        .opt-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .result-scroll { flex: 1; overflow-y: auto; padding: 28px 24px; }
        .result-content { max-width: 780px; margin: 0 auto; background: var(--surface); border-radius: var(--radius); border: 1px solid var(--border); box-shadow: var(--shadow); padding: 32px 36px; text-align: left; }
        .result-content h1 { font-family: var(--font-display); font-size: 1.5rem; color: var(--accent); margin: 28px 0 12px; font-weight: 400; text-align: left; }
        .result-content h2 { font-family: var(--font-display); font-size: 1.25rem; color: var(--accent); margin: 24px 0 10px; font-weight: 400; text-align: left; }
        .result-content h3 { font-family: var(--font-display); font-size: 1.1rem; color: var(--ink); margin: 20px 0 8px; font-weight: 400; text-align: left; }
        .result-content p { font-size: 0.9rem; line-height: 1.75; color: var(--ink); margin-bottom: 10px; text-align: left; }
        .result-content strong { color: var(--accent); font-weight: 600; }
        .result-content em { color: var(--ink2); }
        .result-content ul { padding-left: 20px; margin-bottom: 12px; text-align: left; }
        .result-content li { font-size: 0.9rem; line-height: 1.7; color: var(--ink); margin-bottom: 4px; text-align: left; }
        .result-content hr { border: none; border-top: 1px solid var(--border); margin: 20px 0; }

        .copy-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
        .btn-copy, .btn-download {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 14px; border-radius: 7px; border: 1px solid var(--border);
          background: var(--surface); font-family: var(--font-body);
          font-size: 0.78rem; cursor: pointer; transition: all 0.15s; color: var(--ink2);
        }
        .btn-copy:hover { border-color: var(--green); color: var(--green); }
        .btn-copy.copied { border-color: var(--green); color: var(--green); background: var(--green-soft); }
        .btn-download:hover { border-color: var(--blue); color: var(--blue); background: var(--blue-soft); }

        .generated-label { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 6px; font-size: 0.72rem; font-weight: 600; }

        .loading-overlay { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; padding: 40px; }
        .spinner-ring { width: 56px; height: 56px; border-radius: 50%; border: 3px solid var(--border); border-top-color: var(--accent); animation: spin 0.9s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .loading-text { font-size: 0.95rem; color: var(--ink2); animation: pulse 2s ease-in-out infinite; }
        @keyframes pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }

        .error-box { max-width: 500px; margin: 24px auto; padding: 16px 20px; background: var(--red-soft); border: 1px solid #FCA5A5; border-radius: var(--radius); color: var(--red); font-size: 0.88rem; text-align: center; }

        .drop-hint { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; color: var(--accent); gap: 8px; }
        .drop-hint-text { font-size: 0.95rem; font-weight: 600; }
        .drop-hint-sub { font-size: 0.78rem; color: var(--ink2); }

        @media (max-width: 600px) {
          .header { padding: 12px 16px; }
          .header h1 { font-size: 1.1rem; }
          .input-hero h2 { font-size: 1.5rem; }
          .input-phase { padding: 20px 14px; }
          .result-scroll { padding: 16px 10px; }
          .result-content { padding: 20px 18px; }
          .result-toolbar { padding: 8px 12px; }
          .features-row { gap: 8px; }
          .num-controls-row { gap: 8px; }
        }
      `}</style>

      <div className="app-shell">
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
          {loading && (
            <div className="loading-overlay">
              <div className="spinner-ring" />
              <div className="loading-text">{loadingMessages[loadingMsg]}</div>
            </div>
          )}

          {error && !loading && (
            <div style={{ padding: "20px" }}>
              <div className="error-box">
                ⚠ {error}<br /><br />
                <button className="btn-ghost" onClick={() => setError("")}>Încearcă din nou</button>
              </div>
            </div>
          )}

          {phase === "input" && !loading && !error && (
            <div className="input-phase">
              <div className="input-hero">
                <h2>Transformă orice lecție în resurse complete</h2>
                <p>
                  Introdu textul educațional sau încarcă o imagine cu lecția. Voi genera automat:
                  rezumat, întrebări, itemi grilă, exerciții de analiză și fișe diferențiate.
                </p>
              </div>

              <div
                className={`input-card${dragOver ? " drag-over" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {dragOver ? (
                  <div className="drop-hint">
                    <ImageIcon />
                    <div className="drop-hint-text">Lasă imaginea aici</div>
                    <div className="drop-hint-sub">Acceptă JPG, PNG, GIF, WebP</div>
                  </div>
                ) : (
                  <textarea
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    placeholder={'Lipește aici textul lecției, sau trage/lipește o imagine (Ctrl+V)...\n\nExemplu: Revoluția Industrială a reprezentat o perioadă de transformare majoră în Europa, începând cu a doua jumătate a secolului al XVIII-lea...'}
                  />
                )}

                {imageData && (
                  <div className="image-preview-bar">
                    <img src={imageData.preview} alt="Preview" className="image-thumb" />
                    <div className="image-info">
                      <div className="name">📷 {imageData.name || "Imagine lipită"}</div>
                      <div className="hint">Imaginea va fi analizată de AI</div>
                    </div>
                    <button className="image-remove" onClick={() => setImageData(null)} title="Șterge imaginea">
                      <XIcon />
                    </button>
                  </div>
                )}

                <div className="input-footer">
                  <div className="footer-left">
                    <span className="char-count">{inputText.length} caractere</span>
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
                      onChange={(e) => { if (e.target.files?.[0]) processImage(e.target.files[0]); e.target.value = ""; }} />
                    <button className="btn-upload" onClick={() => fileInputRef.current?.click()}>
                      <ImageIcon /> {imageData ? "Schimbă imaginea" : "Adaugă imagine"}
                    </button>
                  </div>
                  <button className="btn-generate" onClick={handleGenerate} disabled={!hasInput || loading}>
                    <SparkleIcon /> Generează toate materialele
                  </button>
                </div>
              </div>

              <div className="num-controls-row">
                <div className="num-control">
                  <span className="num-label">✅ Itemi grilă:</span>
                  <button className="num-btn" onClick={() => setNumGrila(n => Math.max(2, n - 1))}>−</button>
                  <span className="num-value">{numGrila}</span>
                  <button className="num-btn" onClick={() => setNumGrila(n => Math.min(20, n + 1))}>+</button>
                </div>
                <div className="num-control">
                  <span className="num-label">🧠 Exerciții analiză:</span>
                  <button className="num-btn" onClick={() => setNumAnaliza(n => Math.max(1, n - 1))}>−</button>
                  <span className="num-value">{numAnaliza}</span>
                  <button className="num-btn" onClick={() => setNumAnaliza(n => Math.min(12, n + 1))}>+</button>
                </div>
              </div>

              <div className="features-row">
                <button className="feature-chip fc-1" onClick={() => handleFocusedGenerate("rezumat")} disabled={!hasInput || loading}>
                  📝 Rezumat &amp; Întrebări
                </button>
                <button className="feature-chip fc-2" onClick={() => handleFocusedGenerate("grila")} disabled={!hasInput || loading}>
                  ✅ Itemi grilă ({numGrila})
                </button>
                <button className="feature-chip fc-3" onClick={() => handleFocusedGenerate("analiza")} disabled={!hasInput || loading}>
                  🧠 Exerciții de analiză ({numAnaliza})
                </button>
                <button className="feature-chip fc-4" onClick={() => handleFocusedGenerate("fise")} disabled={!hasInput || loading}>
                  📄 Fișe diferențiate
                </button>
              </div>
            </div>
          )}

          {phase === "result" && !loading && !error && (
            <div className="result-phase">
              <div className="result-toolbar">
                <span className="label">Opțiuni:</span>
                <button className="opt-btn" onClick={() => handleOption(1)} disabled={loading}>🎯 Adaptează pe niveluri</button>
                <button className="opt-btn" onClick={() => handleOption(2)} disabled={loading}>⏱ Mini-test 10 min cu barem</button>
                <button className="opt-btn" onClick={() => handleOption(3)} disabled={loading}>💡 Feedback îmbunătățiri</button>
                <button className="opt-btn" onClick={() => handleOption(4)} disabled={loading}>📋 Fișă nouă, altă temă</button>
              </div>

              <div className="result-scroll" ref={resultRef}>
                <div style={{ maxWidth: 780, margin: "0 auto" }}>
                  <div className="copy-bar">
                    {activeChip && (
                      <span className={`generated-label ${
                        activeChip === "rezumat" ? "fc-1" : activeChip === "grila" ? "fc-2" :
                        activeChip === "analiza" ? "fc-3" : "fc-4"
                      }`}>
                        {activeChip === "rezumat" && "📝 Rezumat & Întrebări"}
                        {activeChip === "grila" && `✅ ${numGrila} Itemi grilă`}
                        {activeChip === "analiza" && `🧠 ${numAnaliza} Exerciții de analiză`}
                        {activeChip === "fise" && "📄 Fișe diferențiate"}
                      </span>
                    )}
                    <div style={{ flex: 1 }} />
                    <button className="btn-download" onClick={() => downloadAsDocx(result)}>
                      <DownloadIcon /> Descarcă DOC
                    </button>
                    <button className={`btn-copy${copied ? " copied" : ""}`} onClick={handleCopy}>
                      {copied ? <><CheckIcon /> Copiat!</> : <><CopyIcon /> Copiază tot</>}
                    </button>
                  </div>
                  <div className="result-content" dangerouslySetInnerHTML={{ __html: md(result) }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
