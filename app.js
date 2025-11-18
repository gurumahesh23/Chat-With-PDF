/* ========== STATE ========== */
let filesState = [];
let chunksGlobal = [];
let uploadInProgress = false;

/* ========== DOM ELEMENTS ========== */
const pdfInput = document.getElementById("pdfs");
const uploadBtn = document.getElementById("upload-btn");
const dropzone = document.getElementById("dropzone");
const processBtn = document.getElementById("process-btn");
const statusEl = document.getElementById("status");
const uploaderInfo = document.getElementById("uploader-info");
const debugLog = document.getElementById("debug-log");
const chatBox = document.getElementById("chat-box");
const questionInput = document.getElementById("question");
const sendBtn = document.getElementById("send-btn");
const toastEl = document.getElementById("toast");
const typingTemplate = document.getElementById("typing-template");
const fileListEl = document.getElementById("file-list");
const summaryListEl = document.getElementById("summary-list");
const topChunksEl = document.getElementById("top-chunks");
const previewModal = document.getElementById("chunk-preview");
const previewTitle = document.getElementById("preview-title");
const previewBody = document.getElementById("preview-body");
const closePreviewBtn = document.getElementById("close-preview");
const darkToggle = document.getElementById("dark-toggle");

/* ========== VERIFY ELEMENTS ========== */
console.log("✅ PDF Chat AI initialized");
const requiredElements = {
  pdfInput, uploadBtn, processBtn, sendBtn, darkToggle, chatBox,
  debugLog, questionInput, fileListEl, summaryListEl, topChunksEl
};

Object.entries(requiredElements).forEach(([name, el]) => {
  if (!el) console.error(`❌ ${name} not found`);
});

/* ========== UTILITY FUNCTIONS ========== */
function showToast(msg, duration = 2500) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.style.display = "block";
  setTimeout(() => (toastEl.style.display = "none"), duration);
}

function logStep(msg) {
  if (!debugLog) return;
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = `[${timestamp}] ${msg}`;
  debugLog.textContent += logEntry + "\n";
  debugLog.scrollTop = debugLog.scrollHeight;
}

function addMessage(text, sender) {
  if (!chatBox) return;
  const div = document.createElement("div");
  div.className = `message ${sender}`;
  div.textContent = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

/* ========== HTML ESCAPE ========== */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/* ========== RESPONSE FORMATTER ========== */
function formatBotResponse(text) {
  let html = '<div class="response-formatted">';
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // Check for main headers (###)
    if (trimmed.startsWith('###')) {
      const headerText = trimmed.replace(/^#+\s/, '');
      html += `<h1 class="response-heading-1">${escapeHtml(headerText)}</h1>`;
      i++;
      continue;
    }

    // Check for section headers (##)
    if (trimmed.startsWith('##')) {
      const headerText = trimmed.replace(/^#+\s/, '');
      html += `<h2 class="response-heading-2">${escapeHtml(headerText)}</h2>`;
      i++;
      continue;
    }

    // Check for subheaders (#)
    if (trimmed.startsWith('#')) {
      const headerText = trimmed.replace(/^#+\s/, '');
      html += `<h3 class="response-heading-3">${escapeHtml(headerText)}</h3>`;
      i++;
      continue;
    }

    // Check for numbered lists (1., 2., etc.)
    if (/^\d+\.\s/.test(trimmed)) {
      const num = trimmed.match(/^\d+/)[0];
      const text = trimmed.replace(/^\d+\.\s/, '');
      const formatted = formatInlineMarkdown(text);
      html += `<p class="response-text"><strong>${num}.</strong> ${formatted}</p>`;
      i++;
      continue;
    }

    // Check for bullet points (*)
    if (trimmed.startsWith('*') && !trimmed.startsWith('**')) {
      const bulletText = trimmed.replace(/^\*\s/, '');
      const formatted = formatInlineMarkdown(bulletText);
      html += `<p class="response-text">• ${formatted}</p>`;
      i++;
      continue;
    }

    // Regular paragraphs
    if (trimmed) {
      const formatted = formatInlineMarkdown(trimmed);
      html += `<p class="response-text">${formatted}</p>`;
      i++;
      continue;
    }

    i++;
  }

  html += '</div>';
  return html;
}

/* ========== INLINE MARKDOWN FORMATTER ========== */
function formatInlineMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background: var(--bg-tertiary); padding: 2px 6px; border-radius: 3px;">$1</code>');
}

/* ========== FORMATTED MESSAGE DISPLAY ========== */
function addFormattedMessage(html, sender) {
  if (!chatBox) return;
  const div = document.createElement("div");
  div.className = `message ${sender}`;
  
  if (sender === "bot") {
    div.innerHTML = formatBotResponse(html);
  } else {
    div.innerHTML = escapeHtml(html).replace(/\n/g, "<br>");
  }
  
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

/* ========== DARK MODE ========== */
function applyDarkMode(isDark) {
  if (isDark) {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }
  
  const checkbox = document.querySelector('.toggle-checkbox');
  if (checkbox) {
    checkbox.checked = isDark;
  }
}

function saveDarkModePref(isDark) {
  try {
    localStorage.setItem("pdfchat_dark_mode", isDark ? "1" : "0");
  } catch (e) {
    console.warn("localStorage unavailable:", e.message);
  }
}

function loadDarkModePref() {
  try {
    const stored = localStorage.getItem("pdfchat_dark_mode");
    return stored === "1";
  } catch (e) {
    console.warn("localStorage unavailable:", e.message);
    return false;
  }
}

// Initialize dark mode
applyDarkMode(loadDarkModePref());

if (darkToggle) {
  darkToggle.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark");
    applyDarkMode(isDark);
    saveDarkModePref(isDark);
  });
}

/* ========== UPLOAD HANDLERS ========== */
if (uploadBtn) {
  uploadBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (uploadInProgress) {
      showToast("Upload already in progress");
      return;
    }
    uploadInProgress = true;
    if (pdfInput) pdfInput.click();
    setTimeout(() => (uploadInProgress = false), 300);
  });
}

if (pdfInput) {
  pdfInput.addEventListener("change", function() {
    try {
      const files = Array.from(this.files);
      if (files.length === 0) {
        uploaderInfo.textContent = "No files selected";
        return;
      }
      const fileNames = files.map((f) => f.name).join(", ");
      uploaderInfo.textContent = fileNames;
      logStep(`[FILES] Selected ${files.length} file(s): ${fileNames}`);
    } catch (err) {
      console.error("File selection error:", err);
      showToast("Error selecting files");
      logStep(`[ERROR] File selection failed: ${err.message}`);
    }
  });
}

/* ========== DRAG & DROP ========== */
if (dropzone) {
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.style.opacity = "0.8";
  });

  dropzone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dropzone.style.opacity = "1";
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.style.opacity = "1";
    try {
      const pdfs = Array.from(e.dataTransfer.files).filter((f) => f.type === "application/pdf");
      if (pdfs.length === 0) {
        showToast("Only PDFs allowed");
        return;
      }
      uploaderInfo.textContent = pdfs.map((f) => f.name).join(", ");
      const dt = new DataTransfer();
      pdfs.forEach((f) => dt.items.add(f));
      pdfInput.files = dt.files;
      logStep(`[DROP] ${pdfs.length} PDF(s) dropped`);
    } catch (err) {
      console.error("Drag and drop error:", err);
      showToast("Error processing dropped files");
      logStep(`[ERROR] Drop failed: ${err.message}`);
    }
  });
}

/* ========== PDF EXTRACTION ========== */
async function extractTextFromPDF(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const typed = new Uint8Array(reader.result);
        const pdf = await pdfjsLib.getDocument({ data: typed }).promise;
        let text = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((it) => it.str).join(" ") + "\n";
        }
        resolve(text);
      } catch (err) {
        reject(new Error(`PDF parse failed: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsArrayBuffer(file);
  });
}

/* ========== TEXT CHUNKING ========== */
function chunkText(text, maxChunkSize = 900) {
  const paragraphs = text
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);
  
  const chunks = [];
  let currentChunk = "";
  
  for (const para of paragraphs) {
    if ((currentChunk + "\n" + para).length <= maxChunkSize) {
      currentChunk = currentChunk ? currentChunk + "\n" + para : para;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      
      if (para.length <= maxChunkSize) {
        currentChunk = para;
      } else {
        for (let i = 0; i < para.length; i += maxChunkSize) {
          chunks.push(para.slice(i, i + maxChunkSize));
        }
        currentChunk = "";
      }
    }
  }
  
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

/* ========== FILE LIST RENDERING ========== */
function renderFileList() {
  if (!fileListEl) return;
  fileListEl.innerHTML = "";
  
  filesState.forEach((entry, idx) => {
    const div = document.createElement("div");
    div.className = "file-entry";
    div.role = "listitem";
    div.innerHTML = `
      <div class="name" title="${entry.name}">${escapeHtml(entry.name)}</div>
      <button class="btn-outline summarize-btn" data-idx="${idx}" type="button">Summary</button>
    `;
    fileListEl.appendChild(div);
  });

  document.querySelectorAll(".summarize-btn").forEach((btn) => {
    btn.addEventListener("click", async function() {
      const idx = Number(this.dataset.idx);
      await summarizeFile(idx);
    });
  });
}

/* ========== SUMMARY DISPLAY ========== */
function showSummaryForFile(name, text) {
  if (!summaryListEl) return;
  const safeName = name.replace(/[^a-zA-Z0-9]/g, '_');
  let el = document.getElementById(`summary-${safeName}`);
  
  if (!el) {
    el = document.createElement("div");
    el.id = `summary-${safeName}`;
    el.className = "summary-entry";
    el.role = "listitem";
    summaryListEl.appendChild(el);
  }
  
  el.innerHTML = `<h4>${escapeHtml(name)}</h4><div class="summary-text">${escapeHtml(text)}</div>`;
}

/* ========== FILE SUMMARIZATION ========== */
async function summarizeFile(fileIdx) {
  try {
    const entry = filesState[fileIdx];
    if (!entry) {
      showToast("File not found");
      return;
    }

    showToast(`Summarizing ${entry.name}...`);
    logStep(`[SUMMARY] Starting for ${entry.name}`);

    const sampleChunks = entry.chunks.slice(0, 40);
    if (sampleChunks.length === 0) {
      showToast("No content to summarize");
      logStep(`[ERROR] No chunks found for ${entry.name}`);
      return;
    }

    const content = sampleChunks.join("\n\n");
    const system = "You are a helpful summarizer. Provide a concise summary (3-5 sentences) of the document.";
    const user = `Document: ${entry.name}\n\nContent:\n\n${content}`;

    const resp = await puter.ai.chat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { model: "gpt-4o-mini" }
    );

    if (!resp) {
      throw new Error("Empty response from API");
    }

    const summary = resp?.message?.content || resp?.choices?.[0]?.message?.content || String(resp);
    showSummaryForFile(entry.name, summary);
    logStep(`[SUMMARY] Completed for ${entry.name}`);
    showToast("Summary generated!");
  } catch (err) {
    console.error("Summary error:", err);
    logStep(`[ERROR] ${err.message}`);
    showToast(`Summary failed: ${err.message}`);
  }
}

/* ========== PDF PROCESSING ========== */
async function processPDFs() {
  try {
    const files = Array.from(pdfInput.files);
    if (files.length === 0) {
      showToast("Select PDFs first");
      return;
    }

    processBtn.disabled = true;
    processBtn.textContent = "Processing...";

    filesState = [];
    chunksGlobal = [];
    statusEl.textContent = `Processing ${files.length} file(s)...`;
    logStep(`[START] Processing ${files.length} file(s)`);

    for (const file of files) {
      try {
        statusEl.textContent = `Reading: ${file.name}`;
        logStep(`[PDF] Extracting text from ${file.name}`);
        
        const text = await extractTextFromPDF(file);
        logStep(`[PDF] Extracted ${text.length} characters`);
        
        const chunks = chunkText(text);
        logStep(`[CHUNK] Created ${chunks.length} chunks`);
        
        filesState.push({ file, name: file.name, chunks });
        chunksGlobal.push(...chunks);
      } catch (err) {
        console.error("PDF parse error:", err);
        logStep(`[ERROR] Failed to parse ${file.name}: ${err.message}`);
        showToast(`Failed to parse ${file.name}`);
      }
    }

    renderFileList();
    statusEl.textContent = `Ready: ${chunksGlobal.length} chunks`;
    logStep(`[DONE] Total chunks: ${chunksGlobal.length}`);
    showToast("Processing complete!");
  } catch (err) {
    console.error("Processing error:", err);
    logStep(`[ERROR] Processing failed: ${err.message}`);
    showToast(`Processing failed: ${err.message}`);
  } finally {
    processBtn.disabled = false;
    processBtn.textContent = "Process PDFs";
  }
}

/* ========== CHUNK SELECTION & QA ========== */
async function askQuestion() {
  try {
    const q = questionInput.value.trim();
    if (!q) {
      showToast("Please enter a question");
      return;
    }

    if (chunksGlobal.length === 0) {
      showToast("No documents processed. Upload and process PDFs first.");
      return;
    }

    addMessage(q, "user");
    questionInput.value = "";
    sendBtn.disabled = true;

    logStep(`[QUESTION] ${q}`);
    logStep("[RETRIEVE] Selecting relevant chunks...");

    const maxChunks = Math.min(60, chunksGlobal.length);
    const chunksToSend = chunksGlobal.slice(0, maxChunks);
    const chunksPayload = chunksToSend.map((c, i) => `IDX:${i}\n${c}`).join("\n\n---\n\n");

    // Show typing indicator
    const typing = document.createElement("div");
    typing.className = "message bot";
    typing.appendChild(typingTemplate.content.cloneNode(true));
    chatBox.appendChild(typing);
    chatBox.scrollTop = chatBox.scrollHeight;

    let selectedIndices = [];
    
    // Try keyword matching first (more reliable)
    const qWords = q.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const scores = chunksToSend.map((c, i) => {
      const lc = c.toLowerCase();
      let score = 0;
      for (const w of qWords) {
        if (lc.includes(w)) score += 2;
      }
      return { i, score };
    });
    
    scores.sort((a, b) => b.score - a.score);
    selectedIndices = scores.slice(0, 5).filter(s => s.score > 0).map(s => s.i);
    
    logStep(`[RETRIEVE] Selected ${selectedIndices.length} chunks by keyword matching`);

    // If keyword matching found results, use them; otherwise use API
    if (selectedIndices.length === 0) {
      logStep("[RETRIEVE] No keyword matches, trying AI retrieval...");
      
      const selectSystem = `You are a retrieval system. Given document chunks and a question, return a JSON array of the 3 most relevant chunk indices (0-based) in order of relevance. Return ONLY valid JSON like [5,12,2]. If fewer than 3 relevant chunks exist, return available ones.`;

      const selectMsg = [
        { role: "system", content: selectSystem },
        { role: "user", content: `Question:\n${q}\n\nChunks (index:content):\n\n${chunksPayload}` },
      ];

      try {
        const selResp = await puter.ai.chat(selectMsg, { model: "gpt-4o-mini" });

        if (selResp) {
          const raw = selResp?.message?.content || selResp?.choices?.[0]?.message?.content || String(selResp);
          try {
            selectedIndices = JSON.parse(raw.trim());
            if (!Array.isArray(selectedIndices)) {
              selectedIndices = [];
            }
          } catch (parseErr) {
            logStep("[WARN] AI retrieval returned non-JSON");
          }
        }
      } catch (err) {
        logStep(`[WARN] AI retrieval failed: ${err.message}`);
      }
    }

    const topChunks = selectedIndices
      .map((idx) => chunksToSend[idx] ? { idx, text: chunksToSend[idx] } : null)
      .filter(Boolean);

    // Display top chunks
    topChunksEl.innerHTML = "";
    if (topChunks.length === 0) {
      topChunksEl.innerHTML = `<div class="hint">No relevant chunks found.</div>`;
      logStep("[WARN] No relevant chunks found for answer");
    } else {
      topChunks.forEach((cobj, pos) => {
        const card = document.createElement("div");
        card.className = "chunk-card";
        card.role = "listitem";
        card.dataset.idx = cobj.idx;
        card.innerHTML = `<div class="chunk-snippet"><strong>#${pos + 1}</strong> • ${escapeHtml(cobj.text.slice(0, 160))}...</div>`;
        card.addEventListener("click", () => {
          previewTitle.textContent = `Chunk #${cobj.idx}`;
          previewBody.textContent = cobj.text;
          previewModal.setAttribute("aria-hidden", "false");
        });
        topChunksEl.appendChild(card);
      });
    }

    const context = topChunks.map((t) => t.text).join("\n\n");

    if (!context) {
      typing.remove();
      addFormattedMessage("No relevant content found to answer your question.", "bot");
      logStep("[ANSWER] No context available");
      return;
    }

    const finalSystem = "You are a helpful assistant. Use ONLY the provided context to answer the question. If the answer is not in the context, say 'I don't have information about that in the provided documents.'";
    const finalMessages = [
      { role: "system", content: finalSystem },
      { role: "user", content: `Question: ${q}\n\nContext from documents:\n\n${context}` },
    ];

    let answerText = "No response generated.";
    try {
      const finalResp = await puter.ai.chat(finalMessages, { model: "gpt-4o-mini" });

      if (finalResp) {
        answerText = finalResp?.message?.content || finalResp?.choices?.[0]?.message?.content || String(finalResp);
      }
    } catch (err) {
      console.error("Answer generation error:", err);
      logStep(`[ERROR] Answer generation failed: ${err.message}`);
      answerText = `Error: ${err.message}`;
    }

    typing.remove();
    addFormattedMessage(answerText, "bot");
    logStep(`[ANSWER] Generated answer`);
  } catch (err) {
    console.error("Question processing error:", err);
    showToast(`Error: ${err.message}`);
    logStep(`[ERROR] ${err.message}`);
  } finally {
    sendBtn.disabled = false;
  }
}

/* ========== MODAL HANDLERS ========== */
if (closePreviewBtn) {
  closePreviewBtn.addEventListener("click", () => {
    if (previewModal) previewModal.setAttribute("aria-hidden", "true");
  });
}

if (previewModal) {
  previewModal.addEventListener("click", (e) => {
    if (e.target === previewModal) previewModal.setAttribute("aria-hidden", "true");
  });
}

/* ========== EVENT LISTENERS ========== */
if (processBtn) {
  processBtn.addEventListener("click", processPDFs);
}

if (sendBtn) {
  sendBtn.addEventListener("click", askQuestion);
}

if (questionInput) {
  questionInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !sendBtn.disabled) {
      e.preventDefault();
      askQuestion();
    }
  });
}

/* ========== INITIALIZATION ========== */
logStep("[INIT] PDF Chat AI Ready");
showToast("Ready — Upload PDFs and click Process");