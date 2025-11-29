# Masumi Services Docker Compose Setup

This repository contains a Docker Compose configuration to run both the Masumi Registry Service and Masumi Payment Service together and configure the databases

## Prerequisites

- Docker and Docker Compose installed
- A Blockfrost API key (get one from [blockfrost.io](https://blockfrost.io))

## Setup Instructions

1. Copy the environment file template and fill in your values:

   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file and set the following variables:

   - `ADMIN_KEY`: A minimum 15-character secure admin key for both services
   - `ENCRYPTION_KEY`: A minimum 20-character encryption key for the payment service database
   - `BLOCKFROST_API_KEY_PREPROD`: Your Blockfrost API key for preprod network

   **Optionally**

   - `PURCHASE_WALLET_PREPROD_MNEMONIC`: The mnemonic of the wallet used to purchase any agent requests. This needs to have sufficient funds to pay, or be topped up. If you do not provide a mnemonic, a new one will be generated. Please ensure you export them immediately after creation and store them securely.
   - `SELLING_WALLET_PREPROD_MNEMONIC`: The mnemonic of the wallet used to interact with the smart contract. This only needs minimal funds, to cover the CARDANO Network fees. If you do not provide a mnemonic, a new one will be generated. Please ensure you export them immediately after creation and store them securely.
   - `COLLECTION_WALLET_PREPROD_ADDRESS`: The wallet address of the collection wallet. It will receive all payments after a successful and completed purchase (not refund). It does not need any funds, however it is strongly recommended to create it via a hardware wallet or ensure its secret is stored securely. If you do not provide an address, the SELLING_WALLET will be used.

3. Start the services:

   ```bash
   docker compose up -d
   ```

   The services will automatically:

   - Create the required databases
   - Run database migrations
   - Seed the databases (only if they are empty)
   - Start the services

## Services

- Registry Service: Available at http://localhost:3000/docs (for Open-API)
- Payment Service: Available at http://localhost:3001/docs (for Open-API) or http://localhost:3001/admin (for an admin dashboard)
- PostgreSQL: Available at localhost:5432

## Database Credentials

- Username: postgres
- Password: postgres
- Databases: masumi_registry, masumi_payment

## Data Persistence

The setup includes several features to ensure data persistence:

1. **Named Volume**:

   - Database data is stored in a named volume `masumi_postgres_data`
   - This volume persists even when containers are removed
   - Data survives container restarts and updates

2. **Automatic Restart**:

   - All services are configured with `restart: unless-stopped`
   - Services will automatically restart if they crash
   - Services will restart when the system reboots

3. **Database Initialization**:
   - Existing data is preserved during container restarts
   - Seeding only occurs on empty databases

## Database Migration and Seeding

The services automatically handle database setup:

1. The PostgreSQL database is initialized with the required databases
2. Prisma migrations are run automatically
3. The seeding script checks if each database is empty:
   - If empty, it runs the seed script
   - If not empty, it skips seeding, therefore preserving existing data. If you want to reset, remove the volumes and start the services again.
4. The services start and is ready to use

## Managing Data

### Backup

To backup your database:

```bash
docker exec masumi-postgres pg_dumpall -U postgres > backup.sql
```

### Restore

To restore from a backup:

```bash
cat backup.sql | docker exec -i masumi-postgres psql -U postgres
```

## Stopping the Services

To stop all services (data is preserved):

```bash
docker compose down
```

To stop and remove volumes (this will delete all data):

```bash
docker compose down -v
```
