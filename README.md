# 🚬 Cigarette Inventory System

A full-stack inventory management app for tracking cigarette product sales and stock, built with **HTML/CSS/JS + Node.js + Express + MongoDB Atlas**, deployable to **Vercel** for free.

---

## 📁 Folder Structure

```
cigarette-inventory/
├── public/
│   ├── index.html       # Main UI
│   ├── style.css        # Styles
│   └── script.js        # Frontend logic
├── api/
│   ├── models/
│   │   ├── Product.js   # Mongoose Product model
│   │   └── History.js   # Mongoose History model
│   └── routes/
│       ├── products.js  # GET /api/products, PATCH /api/products/:id
│       └── history.js   # POST /api/submit, GET /api/history, DELETE /api/history
├── server.js            # Express entry point
├── package.json
├── vercel.json          # Vercel deployment config
├── .env.example         # Environment variable template
├── .gitignore
└── README.md
```

---

## ⚙️ API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | Get all products (seeds defaults on first run) |
| PATCH | `/api/products/:id` | Update price or stock for a product |
| POST | `/api/submit` | Submit sold quantities, deduct from stock, save history |
| GET | `/api/history` | Get all past submission records |
| DELETE | `/api/history?id=<id>` | Delete a specific history record |

### POST /api/submit — Request Body
```json
{
  "date": "2026-04-09",
  "items": [
    { "productId": "<mongoId>", "sold": 5 },
    { "productId": "<mongoId>", "sold": 2 }
  ]
}
```

---

## 🚀 Local Setup

### 1. Prerequisites
- Node.js v18+ installed
- A free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account

### 2. Clone / download the project
```bash
git clone https://github.com/YOUR_USERNAME/cigarette-inventory.git
cd cigarette-inventory
```

### 3. Install dependencies
```bash
npm install
```

### 4. Set up MongoDB Atlas
1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) and create a free account.
2. Create a **free shared cluster** (M0 tier).
3. Create a **database user** (username + password — save these).
4. Under **Network Access**, click **Add IP Address → Allow Access From Anywhere** (`0.0.0.0/0`).
5. Click **Connect → Connect your application** and copy the connection string.

### 5. Configure environment variables
```bash
cp .env.example .env
```

Edit `.env`:
```
MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/cigarette_inventory?retryWrites=true&w=majority
PORT=3000
```

### 6. Run the development server
```bash
npm run dev       # with hot-reload via nodemon
# or
npm start         # plain node
```

Open **http://localhost:3000** in your browser.

> **First run:** The app auto-seeds the 10 default products in MongoDB.

---

## ☁️ Deploy to Vercel (Free)

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Push your code to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/cigarette-inventory.git
git push -u origin main
```

### 3. Deploy via Vercel CLI
```bash
vercel login
vercel
```

Follow the prompts. When asked about the project root, select the current directory.

### 4. Add environment variable on Vercel
```bash
vercel env add MONGODB_URI
```
Paste your MongoDB connection string when prompted. Then redeploy:
```bash
vercel --prod
```

### Alternative: Deploy via Vercel Dashboard
1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import your GitHub repository
3. Under **Environment Variables**, add `MONGODB_URI` with your connection string
4. Click **Deploy**

---

## 🖥️ Usage Guide

1. **Select a date** using the date picker in the header.
2. **Enter sold quantities** for each product in the SOLD column.
   - Stock highlights turn **yellow** when ≤5 units remain.
   - Stock highlights turn **red** when a product is out of stock.
   - Input turns red if you enter more than available stock.
3. **Click SAVE** to submit — sold quantities are deducted from stock and saved to history.
4. **Click RESET** to clear the form without saving.
5. **Click EXPORT CSV** to download all history as a `.csv` file.
6. In the **History section**, click **VIEW** to see item-level detail, or **DEL** to delete a record.

---

## 🛠️ Customising Products

To change prices or stock levels, use the PATCH API:
```bash
curl -X PATCH https://YOUR_URL/api/products/<PRODUCT_ID> \
  -H "Content-Type: application/json" \
  -d '{"price": 180, "stock": 50}'
```
Or update directly in MongoDB Atlas via the web interface.

---

## 📦 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | HTML5, CSS3, Vanilla JS (ES2022) |
| Backend | Node.js 18+, Express 4 |
| Database | MongoDB Atlas (Mongoose ODM) |
| Hosting | Vercel (free tier) |
| Fonts | Barlow Condensed, Share Tech Mono (Google Fonts) |
