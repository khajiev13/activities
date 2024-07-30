# How the project works
![Eventopia Architecture](https://github.com/khajiev13/activities/assets/57835288/204d5a52-e7f6-4f25-94d4-17290876a848)

![neo4j_schema ](https://github.com/khajiev13/activities/assets/57835288/80da7af6-be52-4a7e-acb5-6efe5483fd64)

![frontend_diagram](https://github.com/khajiev13/activities/assets/57835288/50fa585a-3fcb-4c8c-8218-ce5ba3bc8314)

![high_level_structure](https://github.com/khajiev13/activities/assets/57835288/dbf6d788-e2ca-4221-ae87-240938776516)

#Design of Frontend:
##Technologies that are used:

        • React: A popular JavaScript library chosen for its widespread adoption and component-based architecture. This approach facilitates modular development and eases maintenance, making it ideal for large-scale applications.
        • Vite: Employed to streamline the development process and handle the complexities of module bundling, traditionally managed by tools like Webpack and Rollup. Vite enhances the development experience with fast, hot module replacement and acts as a front-end build tool that significantly outperforms older techniques.
        • TypeScript: An open-source language that builds on JavaScript by adding static type definitions. TypeScript’s type-checking feature aids in developing reliable code by ensuring type correctness throughout the application.
        • UI Components:
– Shadcn: An open-source library that provides pre-designed, visually appealing components built with Tailwind CSS for styling and ease of customization.
– Aceternity: Built on top of Shadcn, this library leverages the same styling approach provided by Tailwind CSS to offer additional customized components.
        • MapTiler JavaScript SDK: Manages mapping functionalities, facilitating the rendering of maps and management of geographic data. This SDK allows users to interact with the map, select locations, and retrieve corresponding latitude and longitude coordinates.
        • Zod: Utilized for form and component schema validation, enhancing the robustness of user input handling within the application.
        • Axios: Used for making HTTP requests (GET, POST, etc.) to communicate with the server, ensuring efficient data fetching and submission.

#Design of Backend (Server API)
##Technologies that are used:

        • Azure Storage
– Utilized for managing and storing large files or data objects that do not fit well
into a traditional relational or graph database.
– Provides scalable cloud storage solutions, ensuring data availability and durability.
        • SQLite
– Serves as a lightweight, disk-based database.
– Employed to store JSON Web Tokens (JWTs) used in the application’s authentication processes.
– Facilitates efficient local storage without the need for a separate server process.
– Manages both access and refresh tokens for secure token-based authentication.
        • Neo4j
– A graph database management system that excels in storing and querying data
with complex relationships and high levels of interconnectedness.
– Manages the application’s core data, allowing for efficient relationship queries and enhanced data insights.
        • Django Rest Framework
– Serializers: Handle data serialization and validation.
– Views: Manage request handling and business logic.
– URLs: Map endpoints to the corresponding views for routing purposes.
– JWT Middleware: Facilitates token-based authentication by handling access and refresh tokens, ensuring secure user authentication.
        • Neomodel
– An Object Graph Mapper (OGM) for the Neo4j graph database.
– Built on the powerful py2neo, it simplifies working with Neo4j by providing a high-level abstraction for nodes and relationships.
– AllowsyoutointeractwithyourNeo4jdatabaselikeyouwouldwithatraditional database in Django.
– ProvidesasimpleandintuitiveAPIforcreating, retrieving, updating, and deleting nodes and relationships.
– Supports Neo4j’s powerful graph querying language, Cypher, allowing you to perform complex queries and operations on your graph data.






# Getting the Project

To get a copy of the project, run the following command:

```bash
git clone https://github.com/khajiev13/activities.git
```

# Frontend Application

This is the frontend for our application, built with React Typescript and Tailwind CSS.

## Prerequisites

- Node.js
- npm

## Setup

First, navigate to the `frontend` directory:

```bash
cd frontend
```

Then, install the dependencies: (Note: You may need to use `--legacy-peer-deps`. We are using Lottie, which is not yet compatible with latest version of react but it should be fine.

```bash
npm install
```

## Running the Application

After installing the dependencies, you can start the application with:

```bash
npm run dev
```

This will start the React application on a local development server, usually at `http://localhost:3000`.

# Backend Application

This is the backend for our application, built with Django.

## Prerequisites

- Python
- pip

## Setup

1.  Navigate to the `backend` directory:

```bash
cd backend
```

2.  Create a virtual environment:

        ```bash
        python -m venv venv
        ```

3.  Activate the virtual environment:

On Windows:

```bash
venv\Scripts\activate
```

On macOS/Linux:

```bash
source venv/bin/activate
```

4.  Install the dependencies:

```bash
pip install -r requirements.txt
```

## Environment Variables

You will need to set up the following environment variables. Please replace `your_value` with the actual values that will be provided privately.

```bash
export NEO4J_BOLT_URL="ask_me_privately"
export NEO4J_PASSWORD= ask_me_privately
export NEO4J_USERNAME=neo4j
```

## Running the Application

After setting up the environment variables, you can start the application with:

```bash
python manage.py runserver
```

This will start the Django application on a local development server, usually at `http://localhost:8000`.

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
