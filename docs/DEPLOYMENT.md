# LoopForge Deployment Plan

## Goal

Deploy LoopForge as a fast web game with optional room-based multiplayer that can support early public traffic without turning the project into an infrastructure-heavy MMO.

## Current Server

Hetzner VPS:

- 2 vCPU
- 8 GB RAM
- 80 GB local disk
- 20 TB outbound traffic

This is enough for the first serious multiplayer version if the game uses small rooms, compact state updates, and conservative tick rates.

## Target Architecture

```txt
Player Browser
  ->
Static Frontend Build
  ->
Solo Game Runtime OR WebSocket Live Arena Client
  ->
Caddy/Nginx Reverse Proxy
  ->
Node.js Multiplayer Backend
  ->
Room-Based Authoritative Arena Simulation
```

## Runtime Separation

- Codex: remote builder/operator used to inspect the server, edit code, run tests, and document deployment.
- Hermes: optional behind-the-scenes design/config/research system.
- Game runtime: public frontend plus lightweight multiplayer backend.

Players should not depend on Codex or Hermes being live.

## Initial Multiplayer Settings

Recommended starting values:

```env
MAX_PLAYERS_PER_ROOM=8
SERVER_TICK_RATE=15
MAX_ACTIVE_ROOMS=25
SOFT_CONCURRENT_PLAYER_TARGET=200
```

These should be configurable and tuned after profiling.

## Backend Rules

The multiplayer server should be authoritative for:

- player position validation
- judge/enemy movement
- shard spawning
- shard collection
- attacks
- damage
- scoring
- match timer
- upgrade selection/results

The client should send:

- movement input
- aim direction
- attack intent
- upgrade choice

The client should not be trusted to directly award score, kills, shard pickups, or damage.

## Recommended Stack

First version:

- Node.js backend under `/server`
- Colyseus or a minimal WebSocket server
- PM2 for process management
- Caddy or Nginx for HTTPS and WebSocket reverse proxy
- Static Vite build served by Caddy/Nginx or a static host

Optional later:

- Redis for presence/matchmaking across multiple processes
- Postgres for persistent stats or analytics
- separate frontend hosting on Vercel/Cloudflare Pages

## Deployment Checklist

Before changing deployment:

```bash
lscpu
free -h
df -h
uname -a
node -v
npm -v
git status
git branch -vv
git remote -v
```

Build/test baseline:

```bash
npm install
npm test
npm run build
```

Process inspection:

```bash
pm2 list || true
docker ps || true
systemctl --type=service --state=running
ss -tulpn
```

## PM2 Expectations

The backend should run under PM2 with a stable process name such as:

```bash
pm2 start server/index.js --name loopforge-multiplayer
pm2 save
pm2 status
pm2 logs loopforge-multiplayer
```

Exact commands should be updated once the actual backend entrypoint exists.

## Reverse Proxy Expectations

The public domain should support:

```txt
https://yourdomain.com        -> frontend
wss://yourdomain.com/socket  -> multiplayer backend
```

or:

```txt
https://play.yourdomain.com   -> frontend
wss://api.yourdomain.com     -> multiplayer backend
```

Use Caddy or Nginx to terminate HTTPS and proxy WebSocket connections to the local Node server.

## Fallback Requirement

If multiplayer connection fails:

- show a clear message
- do not block the player
- route them to solo mode
- keep the game playable for judges and new players

## Codex Server Prompt

```txt
We are on a Hetzner Ubuntu server for the LoopForge project.

Server specs:
- 2 vCPU
- 8 GB RAM
- 80 GB local disk
- 20 TB outbound traffic

Goal:
Prepare this server to host an optional room-based multiplayer backend for the existing Vite/React/ThreeJS browser game. Do not break the existing game. Do not remove Hermes-related files unless explicitly asked.

First, inspect the environment:
- OS/version
- CPU/RAM/disk
- Node/npm versions
- repo location
- current git status
- running processes
- open ports
- whether nginx/caddy/docker/pm2 are installed

Then report findings before making changes.

Target architecture:
- Keep the frontend build static and fast.
- Add a separate multiplayer server under /server if not already present.
- Use Node.js with Colyseus or a minimal WebSocket server.
- Use PM2 to run the backend process.
- Use Nginx or Caddy as reverse proxy with HTTPS.
- Keep single-player mode working if multiplayer is unavailable.
- Do not add login, accounts, chat, persistent profiles, payments, or heavy database requirements.

Initial multiplayer settings:
- 8 players per room
- 15 server ticks per second
- target stable 100-200 concurrent players first
- keep room size and tick rate configurable

Deployment goals:
- npm install
- npm test if tests exist
- npm run build
- backend starts cleanly
- backend survives restart with PM2
- document exact commands in docs/DEPLOYMENT.md

Important:
Make small, reversible changes.
Before modifying files, show a plan.
After changes, show files changed, commands run, test results, and any remaining manual DNS/HTTPS steps.
```
