# Use an official Python runtime as a parent image
FROM python:3.12-slim
#FROM docker.1panel.dev/library/python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV RUN_NEOMODEL_INSTALL_LABELS 'false' 


# Set the working directory in the container to /app
WORKDIR /app

COPY ./requirements.txt /app/requirements.txt
# Install any needed packages specified in requirements.txt
RUN pip install -r requirements.txt
# RUN python manage.py makemigrations
# RUN python manage.py migrate
# RUN neomodel_install_labels users.models achievements.models teams.models substitutions.models states.models roles.models score_infos.models organizations.models colors.models competitions.models cities.models categories.models activities.models cities.models
# Expose the port server is running on
# Add the current directory files (on your machine) to the container
COPY . /app/
EXPOSE 8000

# Start the server
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]


