# Supplai

![Status](https://img.shields.io/badge/Status-Private%20Beta-blue)
![Tech](https://img.shields.io/badge/Tech-Next.js%20%7C%20Supabase%20%7C%20Gemini%20%7C%20Groq-black)

**Supplai** is a proprietary, intelligent order management platform designed to revolutionize how restaurants handle their supply chains. It replaces chaotic WhatsApp messages and handwritten notes with a streamlined, voice-first AI workflow.

---

## 🎯 The Problem

In a high-pressure kitchen environment, chefs don't have time to sit at a computer to order supplies.

- **Inefficiency**: Orders are scattered across texts, voice notes, and paper scraps.
- **Errors**: "5 tomatoes" might be interpreted as 5 units or 5 kg, leading to waste or shortages.
- **Complexity**: A single "order" often involves products from 5 different suppliers (meat, veg, dry goods, etc.).

## 💡 The Solution

**Supplai** acts as an intelligent intermediary. A chef simply speaks what they need, and the system handles the rest: transcribing, parsing, categorizing, and dispatching orders to the correct suppliers automatically.

---

## ✨ Key Capabilities

### 🎙️ Voice-First Workflow

Powered by **Groq** and **Whisper**, the system offers near-instant transcription.

- **Natural Interaction**: Chefs can speak naturally: _"Order 10 kilos of flour, a box of avocados, and check if we need olive oil."_
- **Hands-Free**: Designed for use in active kitchen environments.

### 🧠 Intelligent Parsing & Classification

Using **Google Gemini 1.5 Flash**, the system understands culinary context.

- **Entity Extraction**: Automatically identifies `Product`, `Quantity`, and `Unit` from unstructured text.
- **Smart Routing**: It knows that _Flour_ goes to the **Dry Goods Supplier** and _Avocados_ go to the **Vegetable Vendor**.
- **Ambiguity Resolution**: If a unit is missing, it flags it for review based on historical data.

### ⚡ Local-First Reliability

Built with **Dexie.js** (IndexedDB), the application is fully functional offline.

- **Zero Latency**: Adding items feels instant.
- **Resilience**: Drafts are saved locally and synced to the cloud (Supabase) only when a connection is stable, ensuring no data is ever lost in a flaky WiFi zone (like a walk-in freezer).

### 📧 Automated Dispatch

- **Supplier Aggregation**: Items are automatically grouped by supplier.
- **One-Click Sending**: A single "Process Order" action triggers individual, formatted emails via **Resend** to each relevant supplier.

---

## 🏗️ Technical Architecture

This project showcases a modern, serverless architecture designed for speed and scalability.

- **Frontend**: Next.js 16 (App Router) with React 19.
- **Styling**: Tailwind CSS 4 for a high-performance, design-system-driven UI.
- **Backend**: Supabase (PostgreSQL) for relational data, Auth, and Realtime subscriptions.
- **AI Layer**:
  - **Groq**: For sub-second audio transcription.
  - **Gemini 1.5**: For complex reasoning and text parsing.
- **Infrastructure**: Deployed on Vercel Edge Network.

## 📚 Internal Documentation

For development team members, detailed documentation is available in the `docs/` directory:

- [**🏗️ System Architecture**](docs/architecture/overview.md): Deep dive into the data flow and component design.
- [**🔌 API Reference**](docs/api/endpoints.md): Internal API endpoints and Server Actions.
- [**🛠️ Developer Guide**](docs/developer/setup.md): Setup, testing, and contribution guidelines.

---

> **Note**: This is a private project. Access to the source code and deployment is restricted to authorized personnel.
