from fastapi import APIRouter


class ApiView:
    def __init__(self) -> None:
        self.router = APIRouter()
