from drf_spectacular.extensions import OpenApiAuthenticationExtension

class UserAuthenticationScheme(OpenApiAuthenticationExtension):
    target_class = 'users.authentication.UserAuthentication'
    name = 'UserAuth'

    def get_security_definition(self, auto_schema):
        return {
            'type': 'apiKey',
            'in': 'header',
            'name': 'Authorization',
            'description': 'User authentication token'
        }

class CustomJWTAuthenticationScheme(OpenApiAuthenticationExtension):
    target_class = 'users.authentication.CustomJWTAuthentication'
    name = 'JWT'

    def get_security_definition(self, auto_schema):
        return {
            'type': 'http',
            'scheme': 'bearer',
            'bearerFormat': 'JWT',
        }