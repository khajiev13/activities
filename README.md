# Frontend Application

This is the frontend for our application, built with React and Tailwind CSS.

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
npm install --legacy-peer-deps
```

## Running the Application

After installing the dependencies, you can start the application with:

    ```bash
    npm start
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
