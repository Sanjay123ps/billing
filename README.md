# 🌿 Ayini Billing System — Backend

A full-stack billing system for Ayini Home Products with Node.js + Express + SQLite.

## Quick Start

### 1. Install Node.js
Download from https://nodejs.org (LTS version recommended)

### 2. Install dependencies
```
cd ayini-billing-backend
npm install
```

### 3. Start the server
```
node server.js
```

### 4. Open in browser
Go to: http://localhost:5000

**Default Login:**
- Username: `admin`
- Password: `ayini123`

---

## Project Structure

```
ayini-billing-backend/
├── server.js          ← Main entry point
├── db.js              ← Database init, helpers, product seed
├── .env               ← Config (port, JWT secret)
├── ayini.db           ← SQLite database (auto-created on first run)
├── middleware/
│   └── auth.js        ← JWT auth middleware
├── routes/
│   ├── auth.js        ← Login, change password
│   ├── products.js    ← Product CRUD + stock management
│   ├── bills.js       ← Bill creation, listing
│   └── reports.js     ← Sales summary, daily, top products
└── public/            ← Frontend files (served by Express)
    ├── index.html     ← Billing page
    ├── inventory.html ← Inventory management
    ├── reports.html   ← Sales reports
    ├── login.html     ← Login page
    ├── style.css      ← Stylesheet
    ├── api.js         ← API client (fetch wrapper)
    ├── billing.js     ← Billing page JS
    ├── inventory.js   ← Inventory page JS
    └── reports.js     ← Reports page JS
```

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login with username & password |
| POST | /api/auth/change-password | Change password (auth required) |
| GET  | /api/auth/me | Get current user info |

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | /api/products | List all products |
| GET    | /api/products?cat=Oil+Items | Filter by category |
| GET    | /api/products?search=ragi | Search by name |
| POST   | /api/products | Add new product (admin) |
| PUT    | /api/products/:id | Update product (admin) |
| PATCH  | /api/products/:id/stock | Adjust stock |
| DELETE | /api/products/:id | Delete product (admin) |

### Bills
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | /api/bills | List all bills |
| GET    | /api/bills/:id | Get bill with items |
| POST   | /api/bills | Create bill + deduct stock |
| DELETE | /api/bills/:id | Delete bill |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | /api/reports/summary | Overall stats |
| GET    | /api/reports/daily?days=30 | Daily revenue chart |
| GET    | /api/reports/top-products | Best selling products |
| GET    | /api/reports/payment-breakdown | Cash/UPI/Card split |
| GET    | /api/reports/category-sales | Revenue by category |

## Change Password
After logging in, you can change the admin password from:
```
POST /api/auth/change-password
{ "currentPassword": "ayini123", "newPassword": "yournewpassword" }
```

## Data Storage
All data is saved in `ayini.db` (SQLite file). This file is auto-created on first run.
**Back up `ayini.db` regularly** to keep your billing data safe.
