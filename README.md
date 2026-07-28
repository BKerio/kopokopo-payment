# SmartPOS Payment Demo

A full-stack payment demo that integrates M-Pesa Daraja and KopoKopo for STK Push payments, webhook handling, transaction tracking, and real-time updates.

This project is split into two parts:

- a Node.js/Express backend that talks to Safaricom and KopoKopo APIs
- a React + TypeScript frontend that lets users pay and review transactions

## What this project does

- Initiates M-Pesa STK Push payments through the Daraja API
- Initiates KopoKopo incoming payments and polls their status
- Receives and validates webhook callbacks from KopoKopo
- Stores transaction records in MongoDB
- Streams real-time updates to the UI using Socket.IO
- Provides a simple UI for paying via either provider and viewing transaction history

## Tech stack

### Backend
- Node.js + Express + TypeScript
- Mongoose for MongoDB persistence
- Socket.IO for real-time events
- Axios for API communication
- dotenv for environment configuration

### Frontend
- React + TypeScript + Vite
- Tailwind CSS
- React Router
- Axios + Socket.IO client

## Project structure

```text
backend/
  src/
    index.ts
    models/
    routes/
    services/

client/
  src/
    components/
    pages/
```

## Prerequisites

Before you get started, make sure you have:

- Node.js 18+ and npm
- MongoDB running locally or a MongoDB Atlas connection string
- Valid credentials for:
  - Safaricom Daraja (M-Pesa)
  - KopoKopo

## Environment variables

Create a `.env` file inside the `backend` directory with values similar to the following:

```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/smartpos
CLIENT_ORIGIN=http://localhost:5173

# M-Pesa Daraja
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your_passkey
TILL_NO=your_till_number
MPESA_TRANSACTIONTYPE=CustomerPayBillOnline
MPESA_CALLBACK_URL=http://your-public-url/api/stkpush/callback
MPESA_BASE_URL=https://sandbox.safaricom.co.ke

# KopoKopo
KOPOKOPO_CLIENT_ID=your_client_id
KOPOKOPO_CLIENT_SECRET=your_client_secret
KOPOKOPO_API_KEY=your_api_key
KOPOKOPO_BASE_URL=https://sandbox.kopokopo.com
KOPOKOPO_TILL_NUMBER=your_till_number
KOPOKOPO_CALLBACK_URL=http://your-public-url/api/kopokopo/payment/callback
KOPOKOPO_WEBHOOK_URL=http://your-public-url/api/kopokopo/webhooks
```

Create a `.env` file inside the `client` directory with:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

## Getting started

### 1. Install dependencies

```bash
cd backend
npm install

cd ../client
npm install
```

### 2. Start the backend

```bash
cd backend
npm run dev
```

The API will be available at:

- http://localhost:5000/
- http://localhost:5000/api/...

### 3. Start the frontend

In a second terminal:

```bash
cd client
npm run dev
```

Open http://localhost:5173 to use the app.

## API overview

### M-Pesa endpoints

- `POST /api/stkpush` - initiate STK Push
- `POST /api/stkpush/callback` - receive Safaricom callback
- `GET /api/stkpush/status/:checkoutRequestId` - fetch payment status from MongoDB
- `GET /api/transactions` - list recent M-Pesa transactions

### KopoKopo endpoints

- `POST /api/kopokopo/stkpush` - initiate an incoming payment
- `GET /api/kopokopo/status` - query current payment status
- `POST /api/kopokopo/payment/callback` - receive payment callback
- `POST /api/kopokopo/webhooks` - receive generic KopoKopo webhook events
- `POST /api/kopokopo/subscribe-webhooks` - register webhook subscriptions
- `GET /api/kopokopo/transactions` - list recent KopoKopo transactions

## Usage

1. Open the landing page and choose either M-Pesa or KopoKopo.
2. Enter a phone number and amount.
3. Complete the payment flow on your phone.
4. Watch the UI update as callbacks and webhook events arrive.
5. Review transaction history from the transaction screens.

## Build for production

```bash
cd backend
npm run build

cd ../client
npm run build
```

## Notes

- The backend uses MongoDB to persist payment state, so a live database connection is required for transaction history.
- For real callbacks, expose your local backend to the internet (for example with ngrok or similar) so Safaricom and KopoKopo can reach your webhook URLs.
- The current setup is intended as a development/demo integration and should be hardened before production use.

## License

This project currently uses the ISC license declared in the backend package metadata.
