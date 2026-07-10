from abc import ABC, abstractmethod
from sqlalchemy.orm import Session


class CredentialServiceBase(ABC):
    @staticmethod
    @abstractmethod
    def get_config(db: Session):
        pass

    @staticmethod
    @abstractmethod
    def push_credentials(db: Session) -> int:
        pass

    @staticmethod
    @abstractmethod
    def pull_credentials(db: Session) -> int:
        pass

    @classmethod
    def register(cls, registry: dict[str, type["CredentialServiceBase"]]):
        registry[cls.__name__.replace("Service", "").lower()] = cls
