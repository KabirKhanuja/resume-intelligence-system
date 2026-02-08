# Resume Intelligence System

A comprehensive system for analyzing and ranking student resumes against job descriptions using AI and vector embeddings.

## Project Structure

- **apps/web**: Frontend application (Next.js, React, Tailwind)
- **apps/api**: Backend API (Node.js, Express, Prisma)
- **infra/embeddings**: Python embedding server (FastAPI, Sentence Transformers)
- **packages/**: Shared logic and libraries

## Getting Started

### Prerequisites

- Node.js (v18+)
- Python (3.9+)
- npm / yarn / pnpm

### 1. Run the Frontend

The frontend handles the Student and TPO interfaces.

```bash
cd apps/web
npm install
npm run dev
```
> Runs on [http://localhost:3000](http://localhost:3000)

### 2. Run the Backend API

The backend handles file parsing, database interactions, and business logic.

```bash
cd apps/api
npm install
npm run dev
```
> Runs on [http://localhost:8000](http://localhost:8000) (default)

### Clearing the dev database (optional)

If you want to remove all resumes/drives/jobs/logs and start fresh:

```bash
cd apps/api
npm run db:clear
```

If Prisma Studio was open while you reset/delete the DB file, restart Studio so it reconnects to the new database.

### 3. Run the Embeddings Server (Python)

The Python server generates embeddings when called.

```bash
cd infra/embeddings
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```
> Runs on [http://localhost:8001](http://localhost:8001)

### 4. Run the Embedding Worker (Node)

Resume uploads enqueue embedding jobs into the DB. This worker consumes those jobs and writes embeddings back to `Resume.embedding`.

```bash
cd ../..
npm run embeddings:worker
```

To process the queue once and exit:

```bash
npm run embeddings:once
```

## Architecture Overview

1. **Student** uploads resume -> **Frontend** sends to **Backend**.
2. **Backend** parses PDF/DOCX and sends text to **Embedding Worker**.
3. **Worker** returns vector embeddings.
4. **Backend** stores data and runs comparison logic.
5. **TPO** uploads JD -> similar embedding & search flow for ranking.
