---
description: Repository Information Overview
alwaysApply: true
---

# E-Commerce Backend Information

## Summary
RESTful API backend for an e-commerce platform built with Express.js and Prisma ORM. The application provides endpoints for product management, user authentication, shopping cart, orders, payments (Stripe integration), and admin functionalities. Uses PostgreSQL as the database with JWT-based authentication and bcrypt for password hashing.

## Structure
- **index.js**: Main Express server entry point with route definitions and middleware setup
- **routes/**: 13 route files handling different API domains (users, products, orders, payments, etc.)
- **prisma/**: Database schema, migrations, and seed script
- **.env**: Environment configuration for database, JWT, Stripe keys, and CORS settings

## Language & Runtime
**Language**: JavaScript (Node.js)  
**Type**: ES Modules (`"type": "module"`)  
**Runtime**: Node.js (version not explicitly specified)  
**Package Manager**: npm

## Dependencies
**Main Dependencies**:
- **@prisma/client** (^6.18.0): ORM for database operations
- **express** (^5.1.0): Web framework
- **bcrypt** (^5.1.1): Password hashing
- **jsonwebtoken** (^9.0.2): JWT authentication
- **cors** (^2.8.5): Cross-Origin Resource Sharing middleware
- **dotenv** (^17.2.3): Environment variable management
- **multer** (^2.0.2): File upload handling
- **stripe** (^20.0.0): Payment processing integration
- **zod** (^4.1.13): Schema validation

**Development Dependencies**:
- **nodemon** (^3.1.10): Development server auto-reload
- **prisma** (^6.18.0): Database toolkit CLI
- **stripe-cli** (^0.1.0): Stripe command-line tool

## Build & Installation

```bash
npm install
npm run postinstall  # Automatically generates Prisma client
```

## Database Setup

```bash
npm run migrate      # Run Prisma migrations
npm run seed         # Execute seed script for initial data
npm run studio       # Open Prisma Studio for database visualization
```

## Usage

```bash
npm run dev          # Start development server with nodemon (port 3000)
npm start            # Start production server
```

The API runs on `http://localhost:3000` with base paths `/api/*` for all endpoints.

## Main Files & Resources

**Entry Point**: `index.js` (82 lines)
- Configures Express app with CORS, middleware, and route mounts
- Manages Stripe webhook handling with raw body parsing
- Serves static product images from `/uploads/products`
- Implements health check endpoint at `/api/health`

**Database Configuration**: `prisma/schema.prisma`
- PostgreSQL database provider
- Defines domain models for e-commerce entities
- Migration history tracked in `prisma/migrations/`

**Routes**: 13 specialized route modules handling:
- User authentication and profiles
- Product catalog and variants
- Shopping cart management
- Order processing
- Payment and Stripe webhook integration
- Wishlist functionality
- Admin operations
- Product images and search

**Configuration**: `.env` file containing:
- PostgreSQL connection string
- JWT secret key
- Stripe API keys and webhook secret
- Frontend URL for post-payment redirects
- CORS allowed origins

## API Endpoints

All endpoints prefixed with `/api/`:
- `/users` - User management and authentication
- `/products` - Product catalog
- `/variants` - Product variants
- `/product-images` - Product image management
- `/cart` - Shopping cart operations
- `/orders` - Order management
- `/addresses` - Address book
- `/wishlist` - Wishlist management
- `/categories` - Product categories
- `/brands` - Brand management
- `/search` - Product search
- `/admin` - Administrative operations
- `/payment` - Payment processing and Stripe webhooks
