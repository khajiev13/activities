from azure.storage.blob import BlobServiceClient, BlobClient, ContainerClient
from dotenv import load_dotenv
from django.utils.text import slugify

import os
load_dotenv()
AZURE_STORAGE_CONNECTION_STRING = os.getenv('AZURE_STORAGE_CONNECTION_STRING')

def delete_picture(image_url):
    
    # Get the file name from the image_url
    file_name = image_url
    # Remove the beginning url since we do not need it
    start_index = file_name.find('app/') + 4
    # Get the file name after app/
    file_name = file_name[start_index:]
    print(file_name)
    blob_service_client = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
    blob_client = blob_service_client.get_blob_client(os.getenv('AZURE_CONTAINER'), file_name)

    try:
        blob_client.delete_blob()
        print("Image of the organization deleted from storage.")
        return 1
    except Exception as e:
        print(f"An error occurred: {e}")
        return 0
    

def create_image(image, folder_name):
    if image:
        # Get the base name of the image file and the extension
        base_name, extension = os.path.splitext(image.name)
        # Sanitize the base name using Django's slugify function
        sanitized_base_name = slugify(base_name)
        # Form the new image name
        sanitized_image_name = sanitized_base_name + extension
        file_name = f'media/images/{folder_name}/' + sanitized_image_name

        # Create a blob client using the local file name as the name for the blob
        blob_service_client = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
        blob_client = blob_service_client.get_blob_client(os.getenv('AZURE_CONTAINER'), file_name)

        # Upload the created file
        blob_client.upload_blob(image.read())
        file_url = blob_client.url
        return file_url
    else:
        return None