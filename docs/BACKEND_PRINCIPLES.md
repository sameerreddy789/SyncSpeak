# Backend Principles — General Concepts, Applied to SyncSpeak

This document explains, at a foundational level, **what a backend is, how a
request travels across the internet to reach it, and why backend logic must not
live in the frontend.** Each concept is paired with how SyncSpeak embodies it.

> For the project-specific architecture (routes, hooks, data flows), see
> [`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md). This file is the *why*.

---

## 1. What Is a Backend?

In its traditional definition, a **backend** is a computer process that is
listening for requests — over HTTP, WebSockets, gRPC, or any other protocol —
on an open port (typically `80` for HTTP or `443` for HTTPS) that is reachable
over the internet.

Clients and other frontends connect to it to **send data** and **receive data**.
We call it a *server* because it **serves** content: static files (images,
HTML, JavaScript), dynamic JSON, or computed results. It also **accepts** data
when a client sends something to be stored or processed.

> **In SyncSpeak:** the backend is the Next.js server. Its `/api/analyze` and
> `/api/recovery` route handlers are server processes listening for HTTP POST
> requests, accepting script text / speech context, and serving back structured
> JSON produced by the AI.

---

## 2. How a Request Travels: The Full Lifecycle

A request doesn't go straight from a browser to application code. It hops through
several layers of infrastructure first. Tracing a typical production backend:

```
Browser
  │  1. Resolve domain name
  ▼
DNS Server  ── (A record → IP address, or CNAME → another domain)
  │  2. Hand back the server's IP
  ▼
Server host (e.g. an AWS EC2 instance)
  │  3. Request hits the host's IP
  ▼
Firewall / Security Group  ── (allow ports 80 / 443, block the rest)
  │  4. Only permitted ports pass through
  ▼
Reverse Proxy (e.g. nginx)  ── (terminates SSL, routes by domain, redirects 80→443)
  │  5. Forwards to the app's local port
  ▼
Application Server  (Node process on localhost:3001)
  │  6. Business logic runs, talks to DB / other services
  ▼
Response travels the same path back to the browser
```

### The layers, explained

- **DNS** — maps a human domain name to an IP address via *A records* (point to
  IP) or *CNAME records* (point to another domain). Without this, the browser
  wouldn't know where to send the request.
- **Security group / firewall** — the host's gatekeeper. If ports `80`/`443`
  aren't explicitly allowed, the request is blocked *before* it ever reaches the
  application. Every other port stays closed to the internet.
- **Reverse proxy (nginx)** — a server that sits *in front of* other servers so
  redirects, SSL certificates (via tools like Certbot), and domain-based routing
  can be managed centrally. It takes inbound traffic on `80`/`443` and forwards
  it to the app's *local* port (e.g. `localhost:3001`).
- **Process manager (pm2)** — keeps the Node process running and restarts it on
  crash.

From the instance's point of view, the application just listens on localhost and
the reverse proxy + DNS + domain make it reachable over the internet.

> **In SyncSpeak (deployed):** when hosted on Vercel (or similar), most of these
> layers are managed for you. Vercel provides the DNS record, the TLS
> certificate (the modern Certbot-equivalent), the edge network, and routes
> inbound HTTPS to your Next.js serverless functions. You don't run nginx or pm2
> yourself — but the *same hops* still happen, just abstracted away. Your
> `/api/*` handlers are the application server at the end of that chain.

---

## 3. Why We Need Backends (At All)

Stripped to one word, the purpose of a backend is **data**: the need to *fetch*
it, *receive* it, and *persist* it — and to perform every action that deals with
data for many users from a **centralised** place.

A concrete example: you tap "Like" on a friend's post. Between your tap and your
friend receiving a notification, a server must:

1. Receive the request and identify *who* you are.
2. **Persist** the like action in a database.
3. Look up *whose* post it was.
4. Trigger a notification to that user.

Each user's app only ever shows *their* personalised view. But a single
centralised server must hold **all** users' state so it can connect these
interactions. No single client has the full picture.

> **In SyncSpeak:** this is exactly why saved scripts live in **Firestore**
> (a centralised, shared database) rather than only in each user's browser.
> Firestore (`users/{uid}/scripts/{id}`) is the shared source of truth that lets
> a user's scripts follow them across devices and survive a browser clear. The
> `localStorage` fallback is a convenience for local use, not the real data
> layer.

---

## 4. Why Backend Logic Can't Live in the Frontend

It's tempting to ask: *the browser is also a computer — why not connect to the
database, call the AI, and do everything from the client? Wouldn't distributing
work everywhere be faster?* It's a great question, and the answer has four parts.

### 4.1 Security

Browser runtimes are **sandboxed** — deliberately isolated from the operating
system, the file system, and processes. Client code can only access limited
resources (the DOM, browser APIs like `localStorage`/`cookies`, and approved
external APIs). A backend, by contrast, routinely needs to read **environment
variables** and the **file system** (e.g. writing log files). The browser
forbids both.

This sandboxing exists for good reason: browsers download and execute code from
*remote servers* on the user's machine. Without isolation, any website could
read your files and exfiltrate sensitive data.

> **In SyncSpeak:** the `OPENROUTER_API_KEY` is a secret. It is read from
> `process.env` **server-side only** (no `NEXT_PUBLIC_` prefix) in `ai.ts`. If
> the key were used from the client, it would be embedded in the JavaScript
> bundle shipped to every visitor and trivially stolen. The Next.js API routes
> exist precisely so this secret never crosses into the sandboxed browser.

### 4.2 External APIs & CORS

Browsers enforce **CORS** (Cross-Origin Resource Sharing): JavaScript on
`example.com` can only fetch resources from the same origin unless the remote
API explicitly returns the right CORS headers. Backends have no such
restriction and routinely call *many* external services.

> **In SyncSpeak:** rather than calling OpenRouter (a third-party origin)
> directly from the browser — which would depend on OpenRouter's CORS policy and
> leak the key — the client calls our **same-origin** `/api/analyze` route. That
> route, running on the server (no CORS rules apply), makes the outbound call to
> OpenRouter. This is the standard "API proxy" pattern and solves both the CORS
> and the key-exposure problems at once.

### 4.3 Databases & Connection Pooling

Server runtimes ship with **native database drivers** (e.g. `pg` for Postgres,
the Firestore SDK) that can open **socket connections**, handle **binary data**,
and maintain **persistent connections**. Browsers cannot do these things.

Backend servers manage a **connection pool** — a reusable set of open database
connections — so that they don't create and destroy a connection on every single
request. A backend handling thousands of requests per second would overwhelm the
database if it reconnected each time. Even if a browser *could* connect, every
single user would open their own connection and flood the database server.

> **In SyncSpeak:** the **Firebase Admin / Firestore SDK** is used server-side
> in `firestore.ts`. Reads/writes go through Firebase's managed connection layer
> rather than each browser opening a direct socket. The client uses a *public*
> Firebase config (safe to expose) plus **Security Rules** for authorisation —
> the data layer stays centralised and pooled.

### 4.4 Computing Power

Frontend code runs on whatever the user happens to have — a flagship phone, a
10-year-old laptop, or a single-core machine with 256 MB of RAM. Push heavy
business logic there and it will lag or break under load.

A backend is a **centralised** machine whose memory and CPU you can scale up on
demand to serve many clients. Expensive work (AI inference, large data
processing) belongs on hardware you control.

> **In SyncSpeak:** AI analysis is genuinely heavy — a long script means a large
> prompt and seconds of model compute. That work is offloaded to OpenRouter's
> GPUs via our server route, *not* the speaker's laptop. The only thing that
> runs on the client is the lightweight semantic matcher (O(window) per speech
> result), which is cheap enough for any device.

---

## 5. Summary

| Principle | What it means | Where it shows up in SyncSpeak |
|-----------|---------------|--------------------------------|
| Backend = a listening process | A process serving/accepting data on a port | Next.js `/api/*` route handlers |
| Request hops through layers | DNS → firewall → reverse proxy → app | Managed by Vercel (DNS, TLS, edge, routing) |
| Backend exists for data | Fetch / receive / persist, centrally | Firestore `users/{uid}/scripts` |
| Secrets need the server | Env vars & filesystem are server-only | `OPENROUTER_API_KEY` read only in `ai.ts` |
| CORS blocks cross-origin calls | Browser JS can't call arbitrary APIs | Client → same-origin `/api/analyze` → OpenRouter |
| Databases need drivers + pools | Persistent server-side connections | Firestore SDK used from the server |
| Compute belongs off the client | Scale heavy work on hardware you control | AI inference via OpenRouter, not the browser |

The throughline: **keep privileged, heavy, or shared-state work on a centralised
server, and let the browser do only what it's good at — rendering UI and
capturing lightweight input.** SyncSpeak's architecture follows this split at
every boundary.
