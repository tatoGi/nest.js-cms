# NestJS + Prisma CMS Backend - Project Structure

## Overview
This is a professional, production-ready CMS backend following SOLID principles, clean architecture, and industry best practices.

## Architecture Overview

### Layered Architecture
```
┌─────────────────────────────────────┐
│       Controllers (HTTP Layer)       │  ← Routes, Validation, Swagger
├─────────────────────────────────────┤
│      Services (Business Logic)      │  ← Application logic, orchestration
├─────────────────────────────────────┤
│    Repository (Data Access Layer)   │  ← Database queries, data mapping
├─────────────────────────────────────┤
│         Prisma ORM + Database        │  ← PostgreSQL
└─────────────────────────────────────┘
```

### Module-Based Structure
Each feature is organized as a self-contained module with:
- **Controller** - HTTP endpoints
- **Service** - Business logic
- **Repository** - Database operations
- **DTOs** - Data validation
- **Interfaces** - Type definitions

## Directory Structure Explained

### `/src/common/`
Shared utilities used across multiple modules.

#### `decorators/`
Custom decorators for cleaner code:
- `@Public()` - Mark routes as public (no auth required)
- `@Roles(Role.ADMIN)` - Require specific roles
- `@GetUser()` - Extract user from request

#### `filters/`
Exception handling:
- `HttpExceptionFilter` - Catch and format HTTP errors consistently

#### `guards/`
Request authorization:
- `JwtAuthGuard` - Verify JWT tokens
- `RolesGuard` - Check user roles

#### `interfaces/`
Shared TypeScript interfaces

### `/src/config/`
Configuration modules.

#### `prisma/`
- `prisma.service.ts` - Manages database connection lifecycle
- `prisma.module.ts` - Global module for database access

### `/src/modules/`
Feature modules implementing specific functionality.

#### `auth/`
Authentication and authorization:
- **Strategy**: JWT-based authentication
- **Endpoints**: `/register`, `/login`
- **Features**: Password hashing, token generation

#### `users/`
User management:
- **CRUD operations** for users
- **Role-based access control**
- **Password management**

#### `posts/`
Blog/article management:
- **Full CRUD** with relationships
- **Slug-based routing**
- **Status management** (draft/published/archived)
- **Author tracking**
- **Categories and tags**

#### `categories/`
Content categorization:
- Hierarchical organization
- Slug-based URLs

#### `tags/`
Content tagging system (to be implemented)

#### `pages/`
Static page management (to be implemented)

#### `media/`
File upload and management (to be implemented)

## Key Design Patterns

### 1. Repository Pattern
Separates data access from business logic.

```typescript
// Repository handles database queries
class PostsRepository {
  async create(data) { /* Prisma query */ }
  async findAll() { /* Prisma query */ }
}

// Service uses repository
class PostsService {
  constructor(private repo: PostsRepository) {}
  async create(dto) {
    // Business logic here
    return this.repo.create(dto);
  }
}
```

### 2. Dependency Injection
All dependencies are injected via constructor:
```typescript
@Injectable()
export class PostsService {
  constructor(
    private readonly postsRepository: PostsRepository,
  ) {}
}
```

### 3. DTO (Data Transfer Object) Pattern
Input validation and type safety:
```typescript
export class CreatePostDto {
  @IsString()
  title: string;
  
  @IsOptional()
  @IsString()
  excerpt?: string;
}
```

### 4. Guard Pattern
Authorization checks:
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
async deleteUser() { }
```

## SOLID Principles Implementation

### Single Responsibility Principle
Each class has one reason to change:
- Controllers handle HTTP
- Services handle business logic
- Repositories handle data access

### Open/Closed Principle
Code is open for extension, closed for modification:
- New features added via new modules
- Existing code rarely changes

### Liskov Substitution Principle
Interfaces allow substitution:
- PrismaService implements OnModuleInit
- Services can be mocked for testing

### Interface Segregation Principle
Specific interfaces for specific needs:
- Separate DTOs for create/update/response
- Role-specific guards

### Dependency Inversion Principle
Depend on abstractions, not concretions:
- Services depend on interfaces
- Repository pattern abstracts database

## Data Flow Example

```
1. Client Request
   POST /api/v1/posts
   Body: { title, content, ... }
   
2. Controller Layer
   ↓ @Body() createPostDto: CreatePostDto
   ↓ Validation (class-validator)
   ↓ Extract user from JWT
   
3. Service Layer
   ↓ Business logic validation
   ↓ Check slug uniqueness
   ↓ Call repository
   
4. Repository Layer
   ↓ Prisma query
   ↓ Database transaction
   
5. Response
   ↑ Return created post
   ↑ Format response
   ↑ Send to client
```

## Authentication Flow

```
1. User Registration/Login
   ↓ POST /auth/register or /login
   ↓ Validate credentials
   ↓ Hash password (bcrypt)
   ↓ Generate JWT token
   ↓ Return token + user data

2. Authenticated Request
   ↓ Include: Authorization: Bearer <token>
   ↓ JwtAuthGuard validates token
   ↓ JwtStrategy decodes payload
   ↓ User attached to request
   ↓ RolesGuard checks permissions
   ↓ Route handler executes
```

## Database Schema Relationships

```
User
 ├─── Posts (1:many)
 └─── Pages (1:many)

Post
 ├─── Author (many:1) → User
 ├─── Category (many:1) → Category
 └─── Tags (many:many) → Tag

Category
 └─── Posts (1:many)

Tag
 └─── Posts (many:many)
```

## API Response Format

### Success Response
```json
{
  "id": "uuid",
  "title": "Post Title",
  "content": "...",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### Error Response
```json
{
  "statusCode": 400,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/posts",
  "method": "POST",
  "message": "Validation failed",
  "error": "Bad Request"
}
```

## Security Features

1. **Password Hashing** - bcrypt with salt rounds
2. **JWT Authentication** - Secure token-based auth
3. **Role-Based Access Control** - Admin/Editor/Viewer roles
4. **Input Validation** - class-validator on all inputs
5. **SQL Injection Prevention** - Prisma parameterized queries
6. **CORS Configuration** - Configurable origins
7. **Environment Variables** - Sensitive data in .env

## Performance Considerations

1. **Database Indexes** - On frequently queried fields
2. **Pagination** - skip/take parameters
3. **Selective Field Loading** - Prisma select/include
4. **Connection Pooling** - Prisma manages connections
5. **Transaction Support** - For complex operations

## Testing Strategy

```
Unit Tests
 ├─── Service logic
 ├─── Repository queries
 └─── Utility functions

Integration Tests
 ├─── Controller endpoints
 ├─── Database operations
 └─── Authentication flow

E2E Tests
 └─── Complete user flows
```

## Extensibility

To add a new feature module:

1. Create module directory: `/src/modules/feature/`
2. Generate files:
   - `feature.module.ts`
   - `feature.controller.ts`
   - `feature.service.ts`
   - `feature.repository.ts`
   - `dto/feature.dto.ts`
3. Add to `app.module.ts`
4. Update Prisma schema if needed
5. Run migrations

## Best Practices Followed

✅ TypeScript strict mode
✅ ESLint + Prettier for code quality
✅ Environment-based configuration
✅ Comprehensive error handling
✅ Swagger documentation
✅ Git-friendly structure
✅ Docker support
✅ Database migrations
✅ Separation of concerns
✅ DRY principle
✅ Consistent naming conventions
✅ Modular architecture

## Next Steps for Production

- [ ] Add logging (Winston/Pino)
- [ ] Implement caching (Redis)
- [ ] Add rate limiting
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure CI/CD pipeline
- [ ] Add comprehensive tests
- [ ] Implement search functionality
- [ ] Add file upload with S3
- [ ] Set up backup strategy
- [ ] Add health check endpoints
- [ ] Implement audit logging
- [ ] Add API versioning
