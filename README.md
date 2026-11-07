# How the project works

![Eventopia Architecture](https://github.com/khajiev13/activities/assets/57835288/204d5a52-e7f6-4f25-94d4-17290876a848)

![neo4j_schema ](https://github.com/khajiev13/activities/assets/57835288/80da7af6-be52-4a7e-acb5-6efe5483fd64)

![frontend_diagram](https://github.com/khajiev13/activities/assets/57835288/50fa585a-3fcb-4c8c-8218-ce5ba3bc8314)

![high_level_structure](https://github.com/khajiev13/activities/assets/57835288/dbf6d788-e2ca-4221-ae87-240938776516)

# Design of Frontend

## Technologies that are used:

- **React**: A popular JavaScript library chosen for its widespread adoption and component-based architecture. This approach facilitates modular development and eases maintenance, making it ideal for large-scale applications.
- **Vite**: Employed to streamline the development process and handle the complexities of module bundling, traditionally managed by tools like Webpack and Rollup. Vite enhances the development experience with fast, hot module replacement and acts as a front-end build tool that significantly outperforms older techniques.
- **TypeScript**: An open-source language that builds on JavaScript by adding static type definitions. TypeScript’s type-checking feature aids in developing reliable code by ensuring type correctness throughout the application.
- **UI Components**:
  - **Shadcn**: An open-source library that provides pre-designed, visually appealing components built with Tailwind CSS for styling and ease of customization.
  - **Aceternity**: Built on top of Shadcn, this library leverages the same styling approach provided by Tailwind CSS to offer additional customized components.
- **MapTiler JavaScript SDK**: Manages mapping functionalities, facilitating the rendering of maps and management of geographic data. This SDK allows users to interact with the map, select locations, and retrieve corresponding latitude and longitude coordinates.
- **Zod**: Utilized for form and component schema validation, enhancing the robustness of user input handling within the application.
- **Axios**: Used for making HTTP requests (GET, POST, etc.) to communicate with the server, ensuring efficient data fetching and submission.

# Design of Backend (Server API)

## Technologies that are used:

- **Azure Storage**:
  - Utilized for managing and storing large files or data objects that do not fit well into a traditional relational or graph database.
  - Provides scalable cloud storage solutions, ensuring data availability and durability.
- **SQLite**:
  - Serves as a lightweight, disk-based database.
  - Employed to store JSON Web Tokens (JWTs) used in the application’s authentication processes.
  - Facilitates efficient local storage without the need for a separate server process.
  - Manages both access and refresh tokens for secure token-based authentication.
- **Neo4j**:
  - A graph database management system that excels in storing and querying data with complex relationships and high levels of interconnectedness.
  - Manages the application’s core data, allowing for efficient relationship queries and enhanced data insights.
- **Django Rest Framework**:
  - **Serializers**: Handle data serialization and validation.
  - **Views**: Manage request handling and business logic.
  - **URLs**: Map endpoints to the corresponding views for routing purposes.
  - **JWT Middleware**: Facilitates token-based authentication by handling access and refresh tokens, ensuring secure user authentication.
- **Neomodel**:
  - An Object Graph Mapper (OGM) for the Neo4j graph database.
  - Built on the powerful py2neo, it simplifies working with Neo4j by providing a high-level abstraction for nodes and relationships.
  - Allows you to interact with your Neo4j database like you would with a traditional database in Django.
  - Provides a simple and intuitive API for creating, retrieving, updating, and deleting nodes and relationships.
  - Supports Neo4j’s powerful graph querying language, Cypher, allowing you to perform complex queries and operations on your graph data.

# Run locally

Use Docker Compose v2. The local stack runs Neo4j, Silo, the FastAPI API,
the Telegram bot and Vite at [localhost:5173](http://localhost:5173).

1. Copy `.env.dev.example` to `.env.dev` and `api/config.example.yaml` to
   `api/config-dev.yaml`. Run `chmod 600 .env.dev api/config-dev.yaml`.
2. Fill the private files with your existing credentials. Set `APP_UID` in
   `.env.dev` to `id -u`, so the non-root API and bot can read the private YAML.
   Match the Neo4j password and S3 app credentials across both files. Keep
   `bolt://neo4j:7687`, `http://silo:9000`, `/data/auth/eventopia.sqlite3`,
   `app.public_base_url: http://localhost:5173` and `auth.cookie_secure: false`
   in the container YAML. Set the existing Telegram bot token, JWT secret and
   OTP pepper there; never commit these private files.
3. Stop any host bot process for the same token before starting Compose.
   Exactly one poller may run. If moving an existing signup database into
   `auth-data`, first stop its writers, take a consistent SQLite backup,
   inspect the target volume, and preserve that backup before starting API/bot.

Run from the repository root. Use the existing `eventopia-task2` project name
to retain the development Neo4j/Silo volumes:

```bash
docker compose --project-name eventopia-task2 --env-file .env.dev -f compose.dev.yml up -d --build
docker compose --project-name eventopia-task2 --env-file .env.dev -f compose.dev.yml exec api python -m eventopia.seed
curl -fsS http://localhost:5173/api/health/ready
curl -fsS http://localhost:5173/api/teams/search/Rockets/
```

The API entrypoint runs SQLite migrations and Neo4j schema constraints before
starting the server. The seed is safe to rerun and reports `teams=48`.
Dependencies use `uv sync --frozen` and `yarn install --frozen-lockfile`.
Linux Python dependencies live in `/opt/venv`, and Linux Node dependencies in
`web-node-modules`; host `.venv` and `node_modules` stay isolated. API and bot
share the persistent `auth-data` SQLite volume.

Readiness should return `error: 0` and `data: {neo4j: true, sqlite: true}`;
Rockets search should include both Beijing Rockets teams. This verifies the
Vite API proxy. Frontend auth/client updates follow in the next tasks.

To stop services while keeping their data:

```bash
docker compose --project-name eventopia-task2 --env-file .env.dev -f compose.dev.yml stop
```

# Contributing

If you want to contribute to the project, please follow these steps:

1. Fork the repository on GitHub.
2. Clone your fork:

```bash
git clone https://github.com/your-username/activities.git
```

3. Create a new branch for your changes:

```bash
git checkout -b your-branch-name
```

4. Make your changes and commit them to your branch.
5. Push your branch to your fork:

```bash
git push origin your-branch-name
```

6. Go to the GitHub page for your fork, and click the 'New pull request' button to create a new pull request.

Remember to replace your-username and name-of-your-branch with your GitHub username and your chosen branch name, respectively.

# Keeping Your Fork Up to Date

To keep your fork up to date with the original repository, you can add it as an "upstream" remote. Here is how:

1. While in your local repository, add the original repository as an upstream remote:

```bash
git remote add upstream https://github.com/khajiev13/activities.git
```

2. Verify that the upstream repository has been added:

```bash
git remote -v
```

You should see upstream in the output, along with the URL of the original repository. 3. Fetch the latest changes from the upstream repository:

```bash
git fetch upstream
```

4. To merge the updates into your local branch, first make sure you are on the correct branch:

```bash
git checkout your-branch-name
```

5. Then, merge the updates:

```bash
git merge upstream/main
```

Remember to replace your-branch-name with the name of your branch.
