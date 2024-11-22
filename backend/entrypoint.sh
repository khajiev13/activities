#!/bin/bash
python manage.py spectacular --file schema.yml
python manage.py runserver 0.0.0.0:8000