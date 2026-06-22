# FinTrack — Manual Setup Guide

**Purpose:** Steps Krishna must perform manually (outside Claude Code) — account creation, API keys, cloud provisioning. Claude Code cannot do these for you since they require browser-based account actions and credential handling.

> Keep all secrets out of git. Everything below ends up in a `.env` file that is gitignored from Sprint 1 onward.

---

## 1. MongoDB Atlas (Required before Sprint 1)

1. Go to https://www.mongodb.com/cloud/atlas/register and create a free account (or log in).
2. Create a new **free M0 cluster** (any region close to you, e.g. Mumbai `ap-south-1` for lowest latency to EC2 if you'll also host EC2 in Mumbai).
3. Database Access → Add New Database User:
   - Username/password authentication
   - Save the username and password somewhere safe
   - Role: "Read and write to any database" (sufficient for this project's single-database design)
4. Network Access → Add IP Address:
   - For development: Add `0.0.0.0/0` (allow from anywhere) — acceptable for a college project; tighten later if desired
   - For production (after Sprint 1, once EC2 exists): you can restrict to your EC2's public IP
5. Get your connection string: Database → Connect → Drivers → Python → copy the `mongodb+srv://...` URI.
6. **You will need this for:** `MONGODB_URI` in `.env` (Sprint 1).
7. Database name to use: `Fintrack` (single database, per TRD.md).

**Checklist:**
- [ ] Cluster created
- [ ] Database user created, credentials saved
- [ ] Network access configured
- [ ] Connection string copied

---

## 2. GitHub Repository (Required before Sprint 1)

1. Create a new **empty** repository (no README/gitignore/license — Claude Code will scaffold these in Sprint 1) named `fintrack` (or your preference).
2. Note the repo URL (HTTPS or SSH, whichever you normally use).
3. No need to clone it locally yet — Sprint 1 will initialize the monorepo and you'll push it.

**Checklist:**
- [ ] Empty repo created
- [ ] Repo URL noted

---

## 3. Gmail App Password (Required before Sprint 2)

Used for sending OTP emails and budget alert emails via SMTP.

1. Use a Gmail account (can be a dedicated one for this project, recommended over your personal one).
2. Enable 2-Step Verification on that Google account if not already enabled: https://myaccount.google.com/security
3. Go to https://myaccount.google.com/apppasswords
4. Create a new App Password (select "Mail" as the app, "Other" as device — name it "FinTrack").
5. Copy the 16-character generated password (you won't be able to see it again).
6. **You will need this for:** `GMAIL_USER` and `GMAIL_APP_PASSWORD` in `.env` (Sprint 2).

**Checklist:**
- [ ] Gmail account chosen
- [ ] 2-Step Verification enabled
- [ ] App Password generated and saved

---

## 4. Google Cloud Vision API (Required before Sprint 4)

Used for OCR receipt scanning.

1. Go to https://console.cloud.google.com/ and create a new project (e.g. "fintrack-ocr").
2. Enable billing on the project — **Google requires a billing account even for free-tier usage**, but you will not be charged unless you exceed 1,000 units/month, and you can set a budget alert.
3. Enable the **Cloud Vision API**: https://console.cloud.google.com/apis/library/vision.googleapis.com
4. Create credentials:
   - Go to APIs & Services → Credentials → Create Credentials → API Key
   - (Recommended) Restrict the key to only the Cloud Vision API for security
5. Copy the API key.
6. **You will need this for:** `GOOGLE_VISION_API_KEY` in `.env` (Sprint 4).
7. **Optional safeguard:** Set a budget alert in Billing → Budgets & Alerts (e.g. alert at $1) so you're notified if usage ever exceeds free tier.

**Checklist:**
- [ ] GCP project created
- [ ] Billing enabled (with budget alert set)
- [ ] Cloud Vision API enabled
- [ ] API key created and saved

---

## 5. AWS Account & EC2 (Required before Sprint 10, can be done earlier)

1. Create/use an AWS account: https://aws.amazon.com/ (free tier eligible if account is < 12 months old, or use AWS Free Tier "Always Free" t2.micro hours if your account is older — check current eligibility on the AWS Free Tier page since this changes).
2. Launch an EC2 instance:
   - AMI: Ubuntu 22.04 LTS
   - Instance type: t2.micro (free-tier eligible)
   - Key pair: create a new one, download the `.pem` file, **save it securely** (you'll need it to SSH in)
   - Security Group: allow inbound on:
     - Port 22 (SSH) — restrict to your IP if possible
     - Port 80 (HTTP)
     - Port 443 (HTTPS) — only needed if you set up SSL later
3. Once launched, note the **public IPv4 address** (or allocate an Elastic IP so it doesn't change on restart — recommended).
4. **You will need this for:** Sprint 10 deployment steps, and for `NEXT_PUBLIC_API_BASE_URL` / `NEXT_PUBLIC_WS_URL` in the frontend `.env`.

**Checklist:**
- [ ] AWS account ready
- [ ] EC2 t2.micro instance launched (Ubuntu 22.04)
- [ ] Key pair `.pem` downloaded and saved securely
- [ ] Security group allows ports 22, 80 (443 optional)
- [ ] Elastic IP allocated (recommended) or public IP noted

---

## 6. Vercel Account (Required before Sprint 10)

1. Create a Vercel account at https://vercel.com/ (sign in with GitHub for easiest repo linking).
2. No project needs to be created yet — Sprint 10 will walk through importing the `frontend/` folder of the monorepo as a Vercel project (Vercel supports monorepos with a configurable root directory).

**Checklist:**
- [ ] Vercel account created and linked to GitHub

---

## 7. Summary: What You'll Have Before Each Sprint

| Before Sprint | You need ready |
|---|---|
| Sprint 1 | MongoDB Atlas URI, empty GitHub repo |
| Sprint 2 | Gmail App Password |
| Sprint 4 | Google Cloud Vision API key |
| Sprint 10 | EC2 instance + key pair, Vercel account |

Everything else (3, 5, 6, 7, 8, 9) requires no new manual setup — they build on infrastructure already in place.

---

## 8. Secrets Checklist (fill this in as you go, keep it OFF git)

```
MONGODB_URI=
MONGODB_DB_NAME=Fintrack
JWT_SECRET=                      (generate with: openssl rand -hex 32)
GMAIL_USER=
GMAIL_APP_PASSWORD=
GOOGLE_VISION_API_KEY=
EC2_PUBLIC_IP=
EC2_KEY_PAIR_PATH=
GITHUB_REPO_URL=
VERCEL_PROJECT_URL=              (filled in after Sprint 10 deploy)
```

---

*End of Manual-Setup.md*
