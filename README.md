# NEXADMIN — NexPlay Organizer & Admin Control Center

Standalone Control & Management Suite for NexPlay Platform Administrators and Tournament Organizers.

---

## Features

### 👑 Platform Administration
- **System Dashboard**: Real-time platform metrics, daily deposit/withdrawal volume, user holdings, and server health.
- **Tournament Control**: Approve, feature, monitor, or cancel community tournaments.
- **Organizer Applications**: Review, approve, or reject host applications with automated custom claims sync.
- **Dispute Resolution Center**: Interactive adjudication for match disputes and wallet payment disputes.
- **Org Earnings Ledger**: Review and release organizer prize revenue directly into their wallet.
- **Financial Controls**: Payment method setup (eSewa, Khalti, FonePay, Bank Transfer) and manual balance adjustments.
- **Game Engine Configuration**: Custom kill points, placement matrices, and match rules.
- **Media & Assets**: Cloudinary asset upload, categorization, and URL distribution.
- **Discord Automation**: Multi-channel webhooks for automatic tournament and scrim notifications.

### 🏆 Organizer Suite
- **Tournament Host Hub**: Create tournaments, manage rounds, brackets, and groups.
- **Scrims Control Room**: Manage custom rooms, live ID/password broadcast, and slot assignment.
- **Match Room Dispatch**: Issue live match credentials securely to verified players.
- **Roster & Verification**: Review participant in-game IDs, squad check-ins, and team approvals.
- **Live Disputes Resolution**: Instant adjudication overlay for reported match issues.
- **Host Wallet**: Track earnings, tournament profits, and payout status.

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` or create `.env`:
```env
IMGBB_API_KEY=your_imgbb_api_key
VITE_IMGBB_API_KEY=your_imgbb_api_key
FIREBASE_PROJECT_ID=nexplayorg-app
FIREBASE_STORAGE_BUCKET=nexplayorg-app.firebasestorage.app
VITE_RECAPTCHA_SITE_KEY=your_recaptcha_site_key
VITE_MAIN_APP_URL=https://www.nexplayorg.app
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```

---

## Architecture

- **Framework**: React 19 + TypeScript + Vite 6
- **Styling**: Tailwind CSS v4 + Lucide Icons
- **Database & Auth**: Firebase Auth, Cloud Firestore, Realtime Database
- **Backend API**: Connects to the NexPlay API (`/api/*`)
