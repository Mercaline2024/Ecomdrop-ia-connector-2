# Ecomdrop IA Connector - Shopify App

A modern Shopify app built with React Router that connects Shopify stores with Ecomdrop and Dropi platforms, featuring AI-powered configuration and product management capabilities.

## 🚀 Features

- **Product Integration**: Import and sync products between Shopify, Ecomdrop, and Dropi
- **AI Configuration**: Intelligent AI assistant configuration for customer support
- **Order Management**: Automated order processing and flow management
- **Theme Management**: Install and manage Shopify themes programmatically
- **Modern UI**: Beautiful, responsive interface built with Tailwind CSS and shadcn/ui components
- **MySQL Database**: Production-ready MySQL database with Prisma ORM
- **Docker Ready**: Fully containerized for easy deployment

## 🛠️ Tech Stack

### Frontend
- **React Router v7**: Modern routing and data loading
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: High-quality React components built on Radix UI
- **Lucide React**: Beautiful icon library
- **React Phone Number Input**: International phone number input

### Backend
- **Node.js 20+**: Runtime environment
- **React Router Server**: Server-side rendering and API routes
- **Prisma**: Type-safe database ORM
- **MySQL 8.0**: Production database (migrated from SQLite)

### DevOps
- **Docker**: Containerization
- **Docker Compose**: Multi-container orchestration
- **Portainer**: Container management
- **Traefik**: Reverse proxy and load balancer

### Shopify Integration
- **Shopify App Bridge**: Embedded app framework
- **Shopify Admin API**: Product, order, and theme management
- **Shopify Webhooks**: Real-time event handling

## 📋 Prerequisites

Before you begin, you'll need:

1. **Node.js**: Version 20.19+ or 22.12+ ([Download](https://nodejs.org/en/download/))
2. **Shopify Partner Account**: [Create an account](https://partners.shopify.com/signup)
3. **Test Store**: [Development store](https://help.shopify.com/en/partners/dashboard/development-stores#create-a-development-store) or [Shopify Plus sandbox](https://help.shopify.com/en/partners/dashboard/managing-stores/plus-sandbox-store)
4. **Shopify CLI**: [Install globally](https://shopify.dev/docs/apps/tools/cli/getting-started)
   ```shell
   npm install -g @shopify/cli@latest
   ```
5. **MySQL Database**: MySQL 8.0 instance (local or remote)

## 🏗️ Project Structure

```
ecomdrop-ia-connector/
├── app/
│   ├── components/          # React components
│   │   ├── ui/             # shadcn/ui components
│   │   └── modals/         # Custom modal components
│   ├── lib/                # Utility functions and API clients
│   ├── routes/             # React Router routes
│   └── shopify.server.ts   # Shopify authentication
├── prisma/
│   ├── schema.prisma       # Database schema (MySQL)
│   └── migrations/         # Database migrations
├── public/                 # Static assets
├── Dockerfile             # Production Docker image
├── docker-compose.yml     # Docker Compose configuration
└── package.json           # Dependencies and scripts
```

## 🚀 Quick Start

### 1. Clone and Install

```shell
git clone <repository-url>
cd ecomdrop-ia-connector
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Database (MySQL)
DATABASE_URL="mysql://user:password@localhost:3306/shopify_app"

# Shopify API
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_APP_URL=https://your-app-url.com

# Optional: Theme Configuration
THEME_2_5_GIT_REPO=your-repo/theme
THEME_2_5_GIT_BRANCH=main
THEME_2_5_GIT_PROVIDER=github
THEME_2_5_GIT_TOKEN=your_github_token
```

### 3. Setup Database

```shell
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# (Optional) Open Prisma Studio to view data
npx prisma studio
```

### 4. Start Development Server

```shell
shopify app dev
```

Press `P` to open the URL to your app. Once you click install, you can start development.

## 🎨 UI Components

This project uses **shadcn/ui** components built on **Radix UI** and styled with **Tailwind CSS**. The UI is fully customizable and accessible.

### Available Components

- **Button**: Multiple variants and sizes
- **Card**: Container for content sections
- **Dialog**: Modal dialogs
- **Input**: Form inputs with validation
- **Select**: Dropdown selections
- **Badge**: Status indicators
- **Separator**: Visual dividers
- **Textarea**: Multi-line text input

### Styling

The project uses Tailwind CSS with a custom design system:
- **CSS Variables**: For theming and customization
- **Dark Mode**: Supported via class-based dark mode
- **Responsive**: Mobile-first design approach
- **Animations**: Smooth transitions and animations

## 🗄️ Database

### MySQL Configuration

This project uses **MySQL 8.0** as the production database (migrated from SQLite for better scalability and performance).

#### Database Schema

The Prisma schema includes:

- **Session**: Shopify app sessions and authentication
- **ShopConfiguration**: Store-specific settings and API keys
- **ProductAssociation**: Product mappings between platforms
- **AIConfiguration**: AI assistant configuration per store

#### Migration from SQLite

If you're migrating from SQLite:

1. Update `prisma/schema.prisma` datasource to MySQL
2. Run migrations: `npx prisma migrate deploy`
3. Update `DATABASE_URL` environment variable

### Database Providers

For production, consider these MySQL providers:

| Provider | Type | Links |
|----------|------|-------|
| Digital Ocean | Managed MySQL | [Learn more](https://www.digitalocean.com/products/managed-databases-mysql) |
| Planet Scale | Serverless MySQL | [Learn more](https://planetscale.com/) |
| Amazon Aurora | Managed MySQL | [Learn more](https://aws.amazon.com/rds/aurora/) |
| Google Cloud SQL | Managed MySQL | [Learn more](https://cloud.google.com/sql/docs/mysql) |

## 🐳 Docker Deployment

### Build Docker Image

```shell
docker build -t ecomdrop-ia-connector:latest .
```

### Docker Compose

The project includes a `docker-compose.yml` for local development and production deployment:

```shell
# Start services
docker-compose up -d

# View logs
docker-compose logs -f shopify_app

# Stop services
docker-compose down
```

### Production Deployment

For production deployment with Portainer and Traefik, see:
- [DEPLOYMENT.md](../DEPLOYMENT.md) - Complete deployment guide
- [README-DEPLOY.md](../README-DEPLOY.md) - Quick deployment guide
- [VERIFICACION_DEPLOY.md](../VERIFICACION_DEPLOY.md) - Deployment verification

## 📝 Available Scripts

```shell
# Development
npm run dev              # Start development server with Shopify CLI
npm run build            # Build for production
npm run start            # Start production server

# Database
npm run setup            # Generate Prisma Client and run migrations
npx prisma studio        # Open Prisma Studio (database GUI)
npx prisma migrate dev   # Create new migration

# Code Quality
npm run lint             # Run ESLint
npm run typecheck        # TypeScript type checking
```

## 🔐 Authentication

To authenticate and query data, use the `shopify` const exported from `/app/shopify.server.ts`:

```typescript
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    {
      products(first: 25) {
        nodes {
          title
          description
        }
      }
    }`);

  const { data } = await response.json();
  return data.products.nodes;
}
```

## 📚 Key Features Documentation

### Product Management
- Import products from Dropi to Shopify
- Sync product data between platforms
- Manage product associations
- Custom pricing and variant mapping

### AI Configuration
- Configure AI assistant per store
- Customize company information
- Set up payment methods and policies
- Configure FAQs and rules

### Order Processing
- Automated order flow management
- Integration with Ecomdrop workflows
- Abandoned cart handling

### Theme Management
- Install themes from Git repositories
- Theme version management
- Custom theme configuration

## 🐛 Troubleshooting

### Database Tables Don't Exist

If you get an error like:
```
The table `Session` does not exist in the current database.
```

Run the setup script:
```shell
npm run setup
```

This will generate Prisma Client and run all pending migrations.

### MySQL Connection Issues

1. Verify MySQL is running:
   ```shell
   mysql -u root -p
   ```

2. Check DATABASE_URL format:
   ```
   mysql://user:password@host:port/database
   ```

3. Ensure MySQL user has proper permissions:
   ```sql
   GRANT ALL PRIVILEGES ON shopify_app.* TO 'user'@'%';
   FLUSH PRIVILEGES;
   ```

### Port Already in Use

If port 3000 is already in use:
```shell
# Find process using port 3000
lsof -i :3000

# Kill the process or change PORT in .env
PORT=3001 shopify app dev
```

### Build Errors

Clear cache and rebuild:
```shell
rm -rf node_modules .cache build
npm install
npm run build
```

## 🔄 Upgrading

### From SQLite to MySQL

1. Backup your SQLite database
2. Update `prisma/schema.prisma` datasource to MySQL
3. Update `DATABASE_URL` environment variable
4. Run migrations: `npx prisma migrate deploy`
5. (Optional) Migrate data using a script

### Updating Dependencies

```shell
# Update all dependencies
npm update

# Update specific package
npm install package@latest

# Check for outdated packages
npm outdated
```

## 📖 Additional Resources

### React Router
- [React Router Documentation](https://reactrouter.com/home)
- [React Router v7 Migration Guide](https://reactrouter.com/upgrade/v7)

### Shopify
- [Shopify Apps Documentation](https://shopify.dev/docs/apps/getting-started)
- [Shopify App React Router](https://shopify.dev/docs/api/shopify-app-react-router)
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli)
- [Shopify App Bridge](https://shopify.dev/docs/api/app-bridge-library)

### UI Libraries
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)
- [Radix UI](https://www.radix-ui.com/)
- [Lucide Icons](https://lucide.dev/)

### Database
- [Prisma Documentation](https://www.prisma.io/docs)
- [MySQL Documentation](https://dev.mysql.com/doc/)

## 📄 License

This project is private and proprietary.

## 👥 Author

**Elkin Garc-ia**

---

For deployment instructions, see [DEPLOYMENT.md](../DEPLOYMENT.md)
