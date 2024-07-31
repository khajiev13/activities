# How the project works

![Eventopia Architecture](https://github.com/khajiev13/activities/assets/57835288/204d5a52-e7f6-4f25-94d4-17290876a848)

![neo4j_schema ](https://github.com/khajiev13/activities/assets/57835288/80da7af6-be52-4a7e-acb5-6efe5483fd64)

![frontend_diagram](https://github.com/khajiev13/activities/assets/57835288/50fa585a-3fcb-4c8c-8218-ce5ba3bc8314)

![high_level_structure](https://github.com/khajiev13/activities/assets/57835288/dbf6d788-e2ca-4221-ae87-240938776516)

# Distinctiveness and Complexity

It is significanly distincy by the following features:

- **Graph Database**: The application uses a graph database (Neo4j) to store and manage data, allowing for complex relationship queries and enhanced data insights. This approach is distinct from traditional relational databases and offers unique advantages for applications with highly interconnected data.
- **Map Integration**: The application integrates a mapping library (MapTiler JavaScript SDK) to render maps and manage geographic data. Users can interact with the map, select locations, and retrieve corresponding latitude and longitude coordinates. This feature enhances the user experience and provides valuable functionality for location-based applications.
- **Form Validation**: The application uses the Zod library for form and component schema validation, ensuring the robustness of user input handling. This feature enhances data integrity and user experience by validating user input against predefined schemas and constraints.
- **Azure Storage**: The application leverages Azure Storage for managing and storing large files or data objects that do not fit well into traditional databases. This cloud storage solution ensures data availability and durability, providing scalable storage solutions for the application's data needs.
- **SQLite Database**: The application uses SQLite as a lightweight, disk-based database to store JSON Web Tokens (JWTs) for authentication. This database facilitates efficient local storage without the need for a separate server process, ensuring secure token-based authentication for the application.
- **Neomodel OGM**: The application employs Neomodel as an Object Graph Mapper (OGM) for the Neo4j graph database, simplifying interactions with the graph data. Neomodel provides a high-level abstraction for nodes and relationships, allowing users to interact with the Neo4j database like a traditional database in Django. This feature enhances data management and query capabilities for the application.
- **TypeScript**: The application uses TypeScript, an open-source language that builds on JavaScript by adding static type definitions. TypeScript's type-checking feature ensures type correctness throughout the application, enhancing code reliability and maintainability. This approach improves the development experience by providing type safety and error prevention during development.
- **Scalable Architecture**: The application's architecture is designed to be scalable and maintainable, with separate frontend and backend components that communicate through RESTful APIs. This modular architecture allows for independent development and deployment of frontend and backend components, ensuring flexibility and scalability as the application grows.
- **Responsive Design**: The application is designed with a responsive layout that adapts to different screen sizes and devices. This feature enhances the user experience by providing a consistent and optimized interface across various devices, including desktops, tablets, and mobile phones. The responsive design ensures accessibility and usability for a wide range of users.

Complexity:

- **Graph Database Queries**: The application uses complex graph database queries to retrieve and manipulate data stored in Neo4j. These queries involve traversing relationships between nodes and performing operations on graph data, requiring a deep understanding of Cypher, Neo4j's query language. This complexity arises from managing highly interconnected data and optimizing query performance for efficient data retrieval. A lot of documentation of neomodel and neo4j was read to understand how to use it.

- **Schema**: I had to draw the schema from scratch and think about the relationships and started with the endgoal. Coding the schema and connecting frontned and backend was a bit challenging and the reason why I chose database is for activity recommendation later on and the chatbot feature.

- **UI/UX**: I have designed few pages of the application with Figma and coded it and used shadcn ui components too. I have also used the maptiler sdk for the map and it was a bit challenging to integrate it with the application.

- **JWT/SQL/Neo4J**: Connecting the sqlite with neo4j (graph database) was a bit challenging and I had to overwrite so many functions to match the integration with neo4j and SQL.

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

# What’s contained in each file you created.

## Components

- **Navbar**: Renders the main navigation bar of the application.
- **App**: Root component that sets up the theme provider, authentication context, and routing. Includes Navbar, CornerButtons, and Toaster.
- **CornerButtons**: Renders buttons in the corners of the application UI, specific functions depend on context.
- **Toaster**: Manages and displays toast notifications for the application.
- **RenderMap**: Responsible for rendering the map and handling interactions with it. It integrates multiple sub-components for mapping functionalities.
- **BaseMap**: A search bar used to search for teams, activities, and organizations. Includes multiple interactive components.
- **Button**: Generic button component for various interactions within the SearchNavbar.
- **Select**: Dropdown selection component used within the SearchNavbar for various selections.
- **DataTableFacetedFilter**: Provides filtering capabilities within the SearchNavbar for sorting data.
- **Card**: Used to display information in a card layout within the SearchNavbar.
- **Drawer**: A sliding panel used to display more detailed information about selected items on the map.
- **Globe2Icon**: Icon used within the SearchNavbar, often representing global search capabilities.
- **SearchForButtons**: Renders buttons for selecting different search options on the map.
- **ListActivityCard**: Displays a list of activities as cards on the map interface.
- **TeamCard**: Displays information about a specific team in a card format.
- **Teams**: Renders a list of teams, including details for each team displayed in a list format.
- **TeamListingCard**: Displays detailed information about a team within the list of teams.

## Frontend Directory Structure

frontend/src/components:
I have created all the components in each folder, and all of those components refer to the pages page where you can see the pages, and each page consists of different components.

Backend:

## API Endpoints and their corresponding HTTP methods and views

### Organizations (organizations/urls.py)

- **Endpoint:** `''`
  - **HTTP Method:** GET, POST
  - **View:** `OrganizationListCreate`
- **Endpoint:** `'list/'`
  - **HTTP Method:** GET
  - **View:** `ListOrganizations`
- **Endpoint:** `'<str:pk>/'`
  - **HTTP Method:** GET, PUT, DELETE
  - **View:** `OrganizationDetail`
- **Endpoint:** `'country/<str:countries>/'`
  - **HTTP Method:** GET
  - **View:** `OrganizationListCreate`
- **Endpoint:** `'state/<str:states>/'`
  - **HTTP Method:** GET
  - **View:** `OrganizationListCreate`
- **Endpoint:** `'city/<str:cities>/'`
  - **HTTP Method:** GET
  - **View:** `OrganizationListCreate`

### Users (users/urls.py)

- **Endpoint:** `''`
  - **HTTP Method:** GET, POST
  - **View:** `UserListCreateView`
- **Endpoint:** `'<str:username>/'`
  - **HTTP Method:** GET, PUT, DELETE
  - **View:** `UserDetailView`
- **Endpoint:** `'token/get/'`
  - **HTTP Method:** POST
  - **View:** `CustomTokenObtainPairView`
- **Endpoint:** `'token/refresh/'`
  - **HTTP Method:** POST
  - **View:** `TokenRefreshView`
- **Endpoint:** `'token/logout-blacklist/'`
  - **HTTP Method:** POST
  - **View:** `BlacklistTokenView`

### Teams (teams/views.py)

- **Endpoint:** `TeamListCreateView`
  - **HTTP Method:** GET, POST
  - **View:** `TeamListCreateView`
- **Endpoint:** `TeamDetailView`
  - **HTTP Method:** GET, PUT, DELETE
  - **View:** `TeamDetailView`

### Locations (locations/views.py)

- **Endpoint:** `LocationViewSet`
  - **HTTP Method:** GET, POST, PUT, DELETE
  - **View:** `LocationViewSet`
- **Endpoint:** `/countries_states_cities`
  - **HTTP Method:** GET
  - **View:** `countries_states_cities`

### Core (core/urls.py)

- **Includes URLs of all other apps**

### Cities (cities/views.py)

- **Endpoint:** `ChooseCityView`
  - **HTTP Method:** GET
  - **View:** `ChooseCityView`

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
