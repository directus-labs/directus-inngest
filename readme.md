# Directus with Inngest Integration

A production-ready(ish) template demonstrating how to integrate Inngest with Directus for handling asynchronous workflows, featuring automated content translation using DeepL and image transformation preprocessing.

## Features

- 🔄 Automated content translation across multiple languages using DeepL
- 🖼️ Automatic image transform pre-generation
- 📊 Background job monitoring with Inngest
- 🚀 Production-ready Docker setup
- 🔒 Type-safe development environment

## Getting Started

**Prerequisites**

- Docker and Docker Compose
- Node.js 22+ and pnpm
- DeepL API key for translations


**Development Setup**

The project consists of several services running in Docker containers:

- Directus (`:8088`) - Headless CMS
- PostgreSQL - Database
- Redis - Cache
- Inngest (`:8288`) - Background job processing


### 1. Install dependencies:

```bash
pnpm i
```

### 2. Create a `.env` file based on the example:

```bash
cp .env.example .env
```

**Directus Admin Token**

This is required for applying the template and generating types.
```
DIRECTUS_TOKEN=your_admin_token
```

**DeepL API Key**

You'll need to create an account on [DeepL](https://www.deepl.com/) for the translation workflow. DeepL does provide 500,000 free characters per month (as of January 2025) which should be more than enough for testing in most projects.
You can get this from the [DeepL API Key](https://www.deepl.com/en/your-account/keys)

```
DEEPL_API_KEY=your_deepl_api_key
```

**Inngest Configuration**

```
INNGEST_DEV=true
INNGEST_EVENT_KEY=your_event_key
INNGEST_SIGNING_KEY=your_signing_key
```

### 3. Start the queue (development)

You need to either run the queue in development mode or build it for production in order for the translation workflow to actually run and the extension to be loaded in Directus.

```bash
pnpm run queue:dev
```

You can also build the queue for production:

```bash
pnpm run queue:build
```

### 4. Start the Docker services

```bash
docker compose up
```
Directus will be available at `http://localhost:8088` and Inngest Dev Server at `http://localhost:8288`.

These ports are configurable in the `docker-compose.yml` file.

Note: The `8088` port is just an arbitray choice because I have too many local Directus instances running on the default port of `8055`.

### 5. Apply the template

This would only be done once, and only if you are applying the template for the first time. Do not repeat this step.

This template provides a multilingual content management foundation using Directus. It includes pre-configured content types for posts with translation support, integrated with DeepL for automated translations. The schema includes essential fields for content management (title, slug, content) along with comprehensive language handling supporting both LTR and RTL text directions.

To apply the template, ensure your Directus instance is fresh and hasn't been configured with any conflicting collections. The template will create the necessary collections for posts, languages, and translations, along with their relationships and field configurations. After application, you can extend the schema further based on your specific needs while maintaining the core multilingual functionality.

```bash
npx directus-template-cli@latest apply -p --directusUrl="http://localhost:8088" --directusToken="admin-token-here" --templateLocation="./directus/template" --templateType="local"
```

### 5. Start the queue (development)

You need to either run the queue in development mode or build it for production in order for the translation workflow to actually run.

```bash
pnpm run queue:dev
```

You can also build the queue for production:

```bash
pnpm run queue:build
```

You may need to restart docker containers for the queue to be picked up as well.

```bash
docker compose restart
```


## Architecture

### Queue System

The project uses Inngest for handling asynchronous tasks. Two main workflows are implemented:

1. **Content Translation**
   - Triggers on post creation/update
   - Automatically translates content using DeepL
   - Supports multiple languages and field types
   - Creates notifications for content editors

2. **Image Transform Pre-generation**
   - Triggers on image upload
   - Generates all configured image transforms

### Directory Structure

```
├── directus/ # Directus configuration and uploads
├── queue/ # Inngest integration
│ ├── src/
│ │ ├── functions/ # Background job implementations
│ │ ├── hooks/ # Directus event hooks to pass events to the queue
│ │ ├── inngest/ # Inngest configuration
│ │ └── utils/ # Shared utilities
├── scripts/ # Development utilities
├── types/ # Generated TypeScript types
└── .env # Environment variables
```

## Configuration

### Translation System

The translation system supports multiple content fields and languages. Configure supported languages in Directus with:

- `code`: Language code (e.g., 'en-US', 'es-ES')
- `name`: Language name (e.g., 'English', 'Spanish')
- `deepl_code`: Corresponding DeepL language code (see [supported languages](https://developers.deepl.com/docs/resources/supported-languages))
- `direction`: Text direction (ltr/rtl)

### Image Transforms

Configure image transform presets in Directus settings. The system will automatically generate these variants when new images are uploaded.

## Development

### Type Generation

After making schema changes in Directus, regenerate TypeScript types:

```bash
pnpm generate:types
```

### Monitoring

Access the Inngest dashboard at `http://localhost:8288` to monitor background jobs and debug workflows.


### Dockerfile

🚧 Coming soon. We'll be adding a Dockerfile to build the Directus instance along with the queue for production.

## Production Considerations

1. Set appropriate environment variables
2. Configure proper CORS settings
3. Remove development-only settings from docker-compose
4. Set up proper logging
5. Configure rate limiting for the translation API
