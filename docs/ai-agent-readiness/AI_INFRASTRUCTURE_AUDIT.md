# QAVRIL LABS — AI & LLM Infrastructure Audit

**Document ID:** QAVRIL-AUDIT-004  
**Author:** Principal AI Systems Architect & AI Agent Engineer  
**Date:** November 5, 2026  
**Status:** Comprehensive Model Tier & RAG Audit  

---

## 1. Existing AI Implementations Discovered

Our codebase inspection identified four distinct AI implementations across different applications:

### 1. Zyno Construction Copilot (`E:\Port\Construction`)
- **Service Layer:** `src/core/services/ai.service.js` (Node.js Axios client).
- **Controller & Routes:** `copilot.controller.js` and `copilot.routes.js`.
- **Target Model:** Ollama `gemma4:31b-cloud` (Default host: `http://127.0.0.1:11434`, timeout 120s).
- **Key Features:**
  - Structured JSON completion mode with automatic markdown wrapper stripping.
  - Multimodal media analysis (`analyzeMedia`) accepting base64 images for construction site defect classification.
  - Graceful fallback simulator (`_fallbackResponse`) returning valid mock domain structures if Ollama is offline.
  - Streaming output endpoint using Server-Sent Events (SSE) at `POST /api/v1/projects/:projectId/copilot/stream`.
- **Server-Side Guardrails:**
  - *Identity Protection:* Strictly enforces "I'm Zyno Intelligence Copilot."
  - *Prompt Injection Defense:* Detects and halts attempts to reveal system instructions or jailbreak ("ignore previous instructions", "system prompt", "dan mode").
  - *Domain Scoping:* Rejects off-topic inquiries (creative writing, games, crypto, medical advice).
  - *External Web Refusal:* Explicitly blocks web browsing requests ("External web retrieval is disabled... operates exclusively from authorized ERP project records").

### 2. Scrapper RAG Neural Engine (`E:\Port\Scrapper RAG Chatbot`)
- **Service Layer:** `backend/rag_engine.py` and `backend/main.py` (FastAPI).
- **Framework:** LangChain (`langchain_ollama`, `langchain_community`, `langchain_chroma`).
- **Target Model:** `ChatOllama(model="gemma4:31b-cloud", temperature=0.7)`.
- **Embedding Model:** HuggingFace `all-MiniLM-L6-v2` with `RecursiveCharacterTextSplitter` (chunk size: 1000, overlap: 200).
- **Vector Database:** ChromaDB persisted locally at `data/chroma/`.
- **Configuration & State Machine:** Driven by `bot_config.json`:
  - 8 lifecycle states (`START`, `INTENT_IDENTIFIED`, `INPUT_COLLECTION`, `PROCESSING`, `SOLUTION_GENERATION`, `CONFIRMATION`, `COMPLETION`, `ERROR_HANDLING`).
  - Intent classification rules (`web_scraping`, `file_processing`, `transactional`, `informational`).
  - Smart UI rendering tags (`<ui_table>`, `<ui_card>`, `<ui_code>`) parsed by the frontend.

### 3. Real-Time Multimodal Voice Agent (`E:\Port\Voice Agent`)
- **Service Layer:** `backend/agent.py` (Python).
- **Framework:** LiveKit Voice Agent Framework.
- **Components:** Deepgram STT + OpenAI `gpt-4o` LLM + ElevenLabs TTS.
- **Function Calling & RAG:** Implements `@agent.llm.function(name="lookup_knowledge_base")` for real-time tool calling during voice calls.

### 4. Enterprise ERP Copilot (`E:\Port\Enterprise Copilot for ERPCRM`)
- **Client Application:** React 19 + Vite.
- **Libraries:** `@google/generative-ai` (Gemini SDK) + `chromadb` JavaScript client.
- **Status:** Frontend UI prototype with invoice context inspection sidebar; backend server logic pending.

---

## 2. Ollama & Cloud Model Infrastructure Assessment

QAVRIL LABS has designated four preferred cloud LLM architectures:
1. `deepseek-v4.1-flash:cloud` — Fast reasoning, math, and code generation.
2. `glm-5.3-flash:cloud` — Multilingual processing and bilingual enterprise context.
3. `gemma4:31b-cloud` — General reasoning, structured JSON output, and complex domain extraction.
4. `minimax-m2.7:cloud` — Long-context synthesis and conversational workflows.

### Operational State on Host Machine:
- **Local Ollama Daemon:** Local daemon (`http://127.0.0.1:11434`) was not actively listening during this audit turn. Applications gracefully degrade to built-in domain fallbacks.
- **Cloud Model Invocation:** Ollama Cloud model tags (`:cloud`) require authenticated access to Ollama Cloud infrastructure or proxy tunnels.

> [!CRITICAL]
> **Credential Guardrail:** If an Ollama API key, token, or cloud endpoint credential needs to be added, updated, or rotated, **ask the user first**. Never generate, assume, or hardcode API keys in repositories or configuration files.

---

## 3. Infrastructure Gap Assessment for Autonomous Agents

We evaluated the current codebase against the enterprise requirements for a production-grade AI Agent platform:

| Core AI Capability | Current Codebase Status | Existing Evidence | Technical Gap | Recommended Architecture |
|---|---|---|---|---|
| **Central LLM Gateway** | **Missing** | Ad-hoc Axios calls in Node; separate LangChain calls in Python | No unified routing, retry, or fallback between providers | Build centralized FastAPI AI Model Gateway |
| **Model Selection Mechanism** | **Missing** | Hardcoded model strings (`gemma4:31b-cloud`) | Cannot dynamically select models based on task complexity | Gateway routing layer with model capability tiers |
| **Provider Fallback** | **Partial** | Mock JSON simulator in Construction; basic try/catch in Python | Cannot switch to secondary LLM provider if primary fails | Gateway fallback chain (e.g. DeepSeek -> Gemma -> Cloud) |
| **Prompt Management** | **Partial** | Hardcoded strings in controllers; JSON template in Scrapper | Prompts tightly coupled to code; no versioning | Dedicated prompt registry with versioning & variable schemas |
| **Conversation Memory** | **Partial** | In-memory session arrays; ephemeral Chroma collections | Conversations lost across process restarts | Persistent PostgreSQL / Redis session memory store |
| **Agent State Management** | **Missing** | Hardcoded state enum in `bot_config.json` | No checkpointing, resumable workflows, or distributed state | LangGraph state graph with persistent storage |
| **Tool Registry & Execution** | **Missing** | Single LiveKit function call; no ERP tool calling | Models cannot query or mutate ERP modules safely | Typed Tool Registry with parameter validation & permissions |
| **Human-in-the-Loop** | **Missing** | No approval pause/resume mechanism | Autonomous actions could execute without supervisor sign-off | Async approval inbox with webhook/WebSocket notifications |
| **Token & Cost Tracking** | **Missing** | None | No visibility into token consumption, costs, or quotas | Ingress/egress token accounting logged per tenant in DB |
| **Evaluation Framework** | **Missing** | None | No automated regression benchmarks for prompt drift | Automated test harness evaluating structured agent outputs |
