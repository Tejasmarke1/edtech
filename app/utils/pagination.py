"""Pagination utilities — offset/limit helpers, Page response model."""

from typing import Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel

T = TypeVar("T")


class PaginationParams:
    """Inject as a dependency to get validated skip/limit query params."""

    def __init__(
        self,
        skip: int = Query(0, ge=0, description="Number of records to skip"),
        limit: int = Query(20, ge=1, le=100, description="Max records to return"),
    ):
        self.skip = skip
        self.limit = limit


class Page(BaseModel, Generic[T]):
    """Generic paginated response wrapper."""

    items: list[T]
    total: int
    skip: int
    limit: int
