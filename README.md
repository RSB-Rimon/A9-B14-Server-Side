# SalonBook – Server

SalonBook Server is the backend REST API for the SalonBook salon appointment booking platform. It is built with Node.js, Express.js, and MongoDB. It handles salon services, appointments, user-related operations, and Stripe payment processing.

## Live API

salon-bok-server.vercel.app

## Features

- RESTful API for salon services.
- MongoDB database integration.
- Appointment creation and management.
- Appointment confirmation and cancellation.
- Customer and admin-related operations.
- Server-side role-based authorization.
- Stripe Checkout integration.
- Stripe webhook verification.
- Secure payment transaction recording.
- Idempotent Stripe webhook processing.
- ImgBB image hosting integration.
- Error handling and API responses.
- Environment-based configuration.

## Technology Stack

- Node.js
- Express.js
- JavaScript
- MongoDB
- REST API
- Stripe
- ImgBB
- Vercel

## Installation

Clone the repository:

```bash
git clone <SERVER_REPOSITORY_URL>
```

Navigate to the project directory:

```bash
cd salon-Bok-server
```

Install dependencies:

```bash
npm install
```

## Environment Variables

Create a `.env` file in the project root and configure the following variables:

```env
PORT=
MONGODB_URI=
CLIENT_URL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

Use your own credentials and URLs. Never commit `.env` or expose secret values.

## Run Locally

Start the server using the development script:

```bash
npm run dev
```

The API will run at:

```text
http://localhost:5000
```

## Related Repository

**Client Repository:** `<CLIENT_REPOSITORY_URL>`

## Payment Security

- Stripe Checkout is used to process appointment payments.
- Webhook signatures are verified before processing payment events.
- Payment status is updated only after a verified webhook event.
- Transaction recording uses the Checkout Session ID to prevent duplicate records during webhook retries.

## Deployment

The backend API is deployed on Vercel.

**Production API:** https://salon-bok-server.vercel.app
