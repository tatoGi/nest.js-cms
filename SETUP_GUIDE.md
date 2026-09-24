# Quick Start Guide - CMS Backend Setup

## Prerequisites Check

Before starting, ensure you have:
- ✅ Node.js 18+ installed (`node --version`)
- ✅ PostgreSQL 14+ installed OR Docker installed
- ✅ Git installed
- ✅ Code editor (VS Code recommended)

## Step-by-Step Setup

### Step 1: Database Setup (Choose One Option)

#### Option A: Using Docker (Recommended)
```bash
# Start PostgreSQL and pgAdmin
docker-compose up -d

# Verify containers are running
docker ps

# Access pgAdmin at http://localhost:5050
# Email: admin@admin.com
# Password: admin
```

#### Option B: Local PostgreSQL
```bash
# Create database
createdb cms_db

# Or via psql
psql -U postgres
CREATE DATABASE cms_db;
\q
```

### Step 2: Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your settings
nano .env  # or use your preferred editor
```

**Important**: Update these values in `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/cms_db?schema=public"
JWT_SECRET=generate-a-random-secret-key-here
PORT=3001
```

**Generate secure JWT secret**:
```bash
# On Linux/Mac
openssl rand -base64 32

# On Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### Step 3: Install Dependencies

```bash
npm install
```

**Note**: This may take 2-3 minutes depending on your internet connection.

### Step 4: Setup Database Schema

```bash
# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# When prompted, enter migration name: init
```

**Expected output**:
```
✔ Generated Prisma Client
✔ The migration has been created and applied
```

### Step 5: Start Development Server

```bash
npm run start:dev
```

**Expected output**:
```
🚀 Application is running on: http://localhost:3001
📚 API Documentation: http://localhost:3001/api/docs
```

### Step 6: Verify Installation

Open your browser and visit:
- **Swagger UI**: http://localhost:3001/api/docs
- You should see the full API documentation

Try the health check:
```bash
curl http://localhost:3001/api/v1/
```

## Testing the API

### 1. Register a User

```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePass123!",
    "firstName": "Admin",
    "lastName": "User"
  }'
```

**Response** (copy the `accessToken`):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "firstName": "Admin",
    "lastName": "User",
    "role": "EDITOR"
  }
}
```

### 2. Create a Post

```bash
curl -X POST http://localhost:3001/api/v1/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "title": "My First Post",
    "slug": "my-first-post",
    "excerpt": "This is my first post",
    "content": "Full content here...",
    "status": "PUBLISHED"
  }'
```

### 3. Get All Posts

```bash
curl http://localhost:3001/api/v1/posts
```

## Using Swagger UI (Easier Method)

1. Go to http://localhost:3001/api/docs
2. Click "Authorize" button (top right)
3. Enter: `Bearer YOUR_TOKEN`
4. Click "Authorize"
5. Now you can test all endpoints directly from the browser!

## Prisma Studio (Database GUI)

View and edit your database with a visual interface:

```bash
npm run prisma:studio
```

Opens at: http://localhost:5555

## Common Issues & Solutions

### Issue: "Port 3001 already in use"
**Solution**: Change PORT in `.env` file or kill the process:
```bash
# Find process
lsof -i :3001

# Kill process (replace PID)
kill -9 PID
```

### Issue: "Database connection failed"
**Solutions**:
1. Check PostgreSQL is running:
   ```bash
   # Docker
   docker ps
   
   # Local
   pg_isready
   ```

2. Verify DATABASE_URL in `.env`
3. Check credentials

### Issue: "Prisma Client not generated"
**Solution**:
```bash
npm run prisma:generate
```

### Issue: "Migration failed"
**Solution**: Reset database (development only):
```bash
npm run prisma:migrate reset
```

### Issue: NPM install errors
**Solution**: Clear cache and reinstall:
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

## Project Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Start dev server with hot reload |
| `npm run start:prod` | Start production server |
| `npm run build` | Build for production |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:studio` | Open database GUI |
| `npm run lint` | Lint code |
| `npm run format` | Format code |
| `npm test` | Run tests |

## Development Workflow

```bash
# 1. Make changes to code
# Files auto-reload on save

# 2. Add new database field
# Edit prisma/schema.prisma

# 3. Create migration
npm run prisma:migrate

# 4. Test API changes
# Use Swagger UI or Postman

# 5. Check code quality
npm run lint
npm run format
```

## Next Steps

Now that your backend is running:

1. ✅ **Explore the API**
   - Use Swagger UI: http://localhost:3001/api/docs
   - Create users, posts, categories

2. ✅ **Read Documentation**
   - `README.md` - Overview
   - `PROJECT_STRUCTURE.md` - Architecture details

3. ✅ **Build the Frontend**
   - Create Next.js app
   - Connect to this API
   - Build admin panel with React Hook Form

4. ✅ **Customize**
   - Add new modules
   - Modify Prisma schema
   - Add new endpoints

## Getting Help

- Check Swagger docs: http://localhost:3001/api/docs
- Review code comments in source files
- Check Prisma docs: https://www.prisma.io/docs
- NestJS docs: https://docs.nestjs.com

## Production Deployment Checklist

Before deploying to production:

- [ ] Change JWT_SECRET to secure random string
- [ ] Set NODE_ENV=production
- [ ] Use production database
- [ ] Enable CORS for your domain only
- [ ] Set up SSL/HTTPS
- [ ] Configure logging
- [ ] Set up monitoring
- [ ] Create database backups
- [ ] Review security settings
- [ ] Load test the API

## Architecture Diagram

```
┌──────────────┐
│   Client     │
│  (Frontend)  │
└──────┬───────┘
       │ HTTP/REST
       ↓
┌──────────────────────────────────┐
│     NestJS Backend (Port 3001)    │
│                                   │
│  ┌─────────────────────────────┐ │
│  │    Controllers (Routes)      │ │
│  │  /auth /users /posts etc    │ │
│  └───────────┬─────────────────┘ │
│              ↓                    │
│  ┌───────────────────────────┐   │
│  │  Services (Business Logic) │   │
│  └───────────┬───────────────┘   │
│              ↓                    │
│  ┌───────────────────────────┐   │
│  │  Repository (Data Access)  │   │
│  └───────────┬───────────────┘   │
│              ↓                    │
│  ┌───────────────────────────┐   │
│  │     Prisma ORM             │   │
│  └───────────┬───────────────┘   │
└──────────────┼───────────────────┘
               ↓
       ┌───────────────┐
       │  PostgreSQL   │
       │   Database    │
       └───────────────┘
```

## Support

Created following SOLID principles and clean architecture best practices.
Ready for production use with proper configuration.

Happy coding! 🚀
