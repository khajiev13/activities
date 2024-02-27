from azure.storage.blob import BlobServiceClient, BlobClient, ContainerClient
from dotenv import load_dotenv
import os

def delete_picture(image_url):
    load_dotenv()
    AZURE_STORAGE_CONNECTION_STRING = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
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