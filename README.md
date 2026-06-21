# FinTrack

Personal finance tracker + bill-splitter for small groups.

## Tech Stack
- **Backend:** FastAPI, MongoDB, Python 3.11+
- **Frontend:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
- **Real-time:** WebSockets
- **OCR:** Google Cloud Vision API

## Structure
```
FinTrack_System/
├── backend/          # FastAPI backend
├── frontend/         # Next.js frontend
├── tests/            # Playwright E2E tests
├── docs/             # Architecture documentation
├── docker-compose.yml
└── nginx.conf
```

## Development
See `docs/Implementation-Plan.md` for sprint roadmap.

## Setup
1. Copy `.env.example` to `.env` and fill in values
2. Backend: `cd backend && pip install -r requirements.txt && uvicorn main:app --reload`
3. Frontend: `cd frontend && npm install && npm run dev`
4. Tests: `cd tests && npm install && npx playwright test`

## Deployment
- **Backend:** AWS EC2 (Docker)
- **Frontend:** Vercel
