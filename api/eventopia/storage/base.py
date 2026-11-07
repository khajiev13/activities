from abc import ABC, abstractmethod


class ObjectStorage(ABC):
    @abstractmethod
    async def put(self, key: str, data: bytes, content_type: str) -> None:
        raise NotImplementedError

    @abstractmethod
    async def delete(self, key: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def public_url(self, key: str) -> str:
        raise NotImplementedError

    async def close(self) -> None:
        """Release owned resources, if any."""
