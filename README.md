#How the project works
![How Eventopia works](https://www.overleaf.com/project/6629b9c686c014db86644276/file/66387aa2da26bc4906a66c80)

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
