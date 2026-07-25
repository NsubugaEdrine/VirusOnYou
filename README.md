# VirusOnYou

Web-based malware detection and threat intelligence platform for analyzing Android applications and devices. Built with React, Supabase, and deployed on Vercel.

## Tech Stack

- **Frontend**: React 19 + Vite + TypeScript
- **Styling**: Tailwind CSS with Material Design 3 theme system
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

### Setup

1. Clone the repo and install dependencies:
   ```bash
   git clone <repo-url>
   cd VirusOnYou
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your Supabase credentials:
   ```bash
   cp .env.example .env
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous/public key |

## Deploying to Vercel

1. Push to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add environment variables in the Vercel dashboard
4. Deploy — Vercel auto-detects the Vite framework

## Database

Tables are managed via Supabase migrations. RLS policies enforce:

- **Authenticated users**: full CRUD on all tables
- **Anonymous users**: read-only access

Key tables: `scans`, `devices`, `permissions`, `network_indicators`, `components`, `threat_intel`.

## Project Structure

```
/
├── src/
│   ├── components/    # Layout, nav, protected route
│   ├── lib/           # Supabase client, auth context, types
│   └── pages/         # Dashboard, scans, devices, threat intel, settings, auth
├── index.html
├── vercel.json
└── package.json
```

## Security

- All tables have Row Level Security enabled
- Auth required for write operations
- Secrets must never be committed to source control
