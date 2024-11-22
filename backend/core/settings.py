from pathlib import Path
import os
from neomodel import config
from datetime import timedelta
import dj_database_url
from dotenv import load_dotenv
from subprocess import call

load_dotenv()


config.NEO4J_PASSWORD = os.getenv('NEO4J_PASSWORD')
config.NEO4J_USERNAME = os.getenv('NEO4J_USERNAME')
config.DATABASE_URL = os.getenv('NEO4J_BOLT_URL')


# you are free to add this configurations
NEOMODEL_SIGNALS = True
NEOMODEL_FORCE_TIMEZONE = False
NEOMODEL_ENCRYPTED_CONNECTION = True
NEOMODEL_MAX_POOL_SIZE = 50

# neomodel_install_labels core.py activities.models --db neo4j+s://neo4j:JHI6pt17is0ozAbnAY0dfF-UcbP8lt_B_ou9dWAn-DU@bb345263.databases.neo4j.io:7687
# neomodel_remove_labels --db neo4j+s://neo4j:JHI6pt17is0ozAbnAY0dfF-UcbP8lt_B_ou9dWAn-DU@bb345263.databases.neo4j.io:7687
print(config.DATABASE_URL)


DEBUG = os.getenv('DEBUG', '0').lower() in ['true', 't', '1']


# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/4.2/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get('SECRET_KEY')

# SECURITY WARNING: don't run with debug turned on in production!
ALLOWED_HOSTS = [os.environ['WEBSITE_HOSTNAME']
                 ] if 'WEBSITE_HOSTNAME' in os.environ else ['127.0.0.1', 'localhost:3001',
                                                             'http://10.63.155.250:5173/', 'localhost:5173', 'eventopia-backend-due3e9c5bkd3heaf.italynorth-01.azurewebsites.net']
# CSRF_TRUSTED_ORIGINS = ['https://' + os.environ['WEBSITE_HOSTNAME']
#                         ] if 'WEBSITE_HOSTNAME' in os.environ else ['127.0.0.1', 'localhost:3001',
#                                                                     'http://10.63.155.250:5173/', 'localhost:5173', 'eventopia-backend-due3e9c5bkd3heaf.italynorth-01.azurewebsites.net']


if 'CODESPACE_NAME' in os.environ:
    CSRF_TRUSTED_ORIGINS = [
        'https://' + os.getenv("CODESPACE_NAME") + '-8000.' +
        os.getenv("GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN")
    ]

# Application definition

INSTALLED_APPS = [
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_neomodel',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'achievements',
    'activities',
    'chatbot',
    'categories',
    'cities',
    'colors',
    'competitions',
    'countries',
    'leagues',
    'locations',
    'organizations',
    'join_requests',
    'roles',
    'score_infos',
    'substitutions',
    'teams',
    'users',
    'storages',
    'drf_spectacular',
    
]

REST_FRAMEWORK = {
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'users.authentication.UserAuthentication',
        'users.authentication.CustomJWTAuthentication'

    )
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'Eventopia',
    'DESCRIPTION': 'Eventopia API provides the documentation about the whole API endpoints.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    # OTHER SETTINGS
    'AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'SWAGGER_UI_SETTINGS': {
        'persistAuthorization': True,
    },
    'SERVE_INCLUDE_SCHEMA': True,
    'SCHEMA_PATH_PREFIX': '/api/v1',
    'SERVE_AUTHENTICATION_CLASSES': [
        'users.authentication.UserAuthentication',
        'users.authentication.CustomJWTAuthentication',
    ],
    'SECURITY_DEFINITIONS': {
        'Bearer': {
            'type': 'apiKey',
            'name': 'Authorization',
            'in': 'header',
            'description': 'Format: Bearer <your_token>'
        }
    },
    'SECURITY': [{'Bearer': []}]
}


SIMPLE_JWT = {
    'TOKEN_BACKEND': 'users.authentication.CustomRefreshToken',
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": False,

    "ALGORITHM": "HS256",
    "VERIFYING_KEY": "",
    "AUDIENCE": None,
    "ISSUER": None,
    "JSON_ENCODER": None,
    "JWK_URL": None,
    "LEEWAY": 0,

    "AUTH_HEADER_TYPES": ("Bearer", "JWT"),
    "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",
    "USER_AUTHENTICATION_RULE": "rest_framework_simplejwt.authentication.default_user_authentication_rule",

    "AUTH_TOKEN_CLASSES": ("rest_framework_simplejwt.tokens.AccessToken",),
    "TOKEN_TYPE_CLAIM": "token_type",
    "TOKEN_USER_CLASS": "rest_framework_simplejwt.models.TokenUser",

    "JTI_CLAIM": "jti",

    "SLIDING_TOKEN_REFRESH_EXP_CLAIM": "refresh_exp",
    "SLIDING_TOKEN_LIFETIME": timedelta(minutes=5),
    "SLIDING_TOKEN_REFRESH_LIFETIME": timedelta(days=1),

    "TOKEN_OBTAIN_SERIALIZER": "rest_framework_simplejwt.serializers.TokenObtainPairSerializer",
    "TOKEN_REFRESH_SERIALIZER": "rest_framework_simplejwt.serializers.TokenRefreshSerializer",
    "TOKEN_VERIFY_SERIALIZER": "rest_framework_simplejwt.serializers.TokenVerifySerializer",
    "TOKEN_BLACKLIST_SERIALIZER": "rest_framework_simplejwt.serializers.TokenBlacklistSerializer",
    "SLIDING_TOKEN_OBTAIN_SERIALIZER": "rest_framework_simplejwt.serializers.TokenObtainSlidingSerializer",
    "SLIDING_TOKEN_REFRESH_SERIALIZER": "rest_framework_simplejwt.serializers.TokenRefreshSlidingSerializer",
}

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',  # Add this
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',  # Add this
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]


SESSION_ENGINE = "django.contrib.sessions.backends.cache"
ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]


WSGI_APPLICATION = 'core.wsgi.application'


# Database
# https://docs.djangoproject.com/en/4.2/ref/settings/#databases
ON_DEPLOYMENT = os.environ.get('ON_DEPLOYMENT')
ON_DEPLOYMENT = False

if ON_DEPLOYMENT:
    SESSION_ENGINE = "django.contrib.sessions.backends.cache"
    STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
    STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
    STATIC_URL = '/static/'  # Add this line
    conn_str = os.environ.get('AZURE_POSTGRESQL_CONNECTIONSTRING')

    if conn_str:
        print("Connection string found")
        conn_str_params = {pair.split('=')[0]: pair.split(
            '=')[1] for pair in conn_str.split(' ')}
        print(conn_str_params)
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.postgresql',
                'NAME': conn_str_params['dbname'],
                'HOST': conn_str_params['host'],
                'USER': conn_str_params['user'],
                'PASSWORD': conn_str_params['password'],
            }
        }
    else:
        print("No connection string found")
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.postgresql',
                'NAME': os.environ.get('DBNAME'),
                'HOST': os.environ.get('DBHOST'),
                'USER': os.environ.get('DBUSER'),
                'PASSWORD': os.environ.get('DBPASS'),
            }
        }

    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": os.environ.get('AZURE_REDIS_CONNECTIONSTRING'),
            "OPTIONS": {
                "CLIENT_CLASS": "django_redis.client.DefaultClient",
                "COMPRESSOR": "django_redis.compressors.zlib.ZlibCompressor",
            },
        }
    }

else:
    DATABASE_URL = 'sqlite:///' + os.path.join(BASE_DIR, 'db.sqlite3')
    STATIC_URL = '/static/'
    STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
    DATABASES = {'default': dj_database_url.config(default=DATABASE_URL)}
    DEBUG = True
# heroku addons:create heroku-postgresql:hobby-dev


# Password validation
# https://docs.djangoproject.com/en/4.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Run neomodel_install_labels command
if os.getenv('RUN_NEOMODEL_INSTALL_LABELS', 'true').lower() == 'true':
    call([
        'neomodel_install_labels',
        'users.models',
        'achievements.models',
        'teams.models',
        'substitutions.models',
        'states.models',
        'roles.models',
        'score_infos.models',
        'organizations.models',
        'colors.models',
        'competitions.models',
        'cities.models',
        'categories.models',
        'activities.models'
    ])

AUTHENTICATION_BACKENDS = ['users.authentication.UserAuthentication']
# Internationalization
# https://docs.djangoproject.com/en/4.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True

# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/4.2/howto/static-files/


# Define DEFAULT_FILE_STORAGE and STATICFILES_STORAGE
# Define the Azure storage configurations
AZURE_ACCOUNT_NAME = os.getenv("AZURE_ACCOUNT_NAME")
AZURE_ACCOUNT_KEY = os.getenv("AZURE_ACCOUNT_KEY")
AZURE_CONTAINER = os.getenv("AZURE_CONTAINER")



# Azure Storage configuration
DEFAULT_FILE_STORAGE = 'storages.backends.azure_storage.AzureStorage'
STATICFILES_STORAGE = 'storages.backends.azure_storage.AzureStorage'


# Default primary key field type
# https://docs.djangoproject.com/en/4.2/ref/settings/#default-auto-field


DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

CORS_ORIGIN_ALLOW_ALL = True


LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose'
        },
        'file': {
            'class': 'logging.FileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'debug.log'),
            'formatter': 'verbose',
        }
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': os.getenv('DJANGO_LOG_LEVEL', 'INFO'),
            'propagate': True,
        },
    },
}

# Ensure logs directory exists
os.makedirs(os.path.join(BASE_DIR, 'logs'), exist_ok=True)
