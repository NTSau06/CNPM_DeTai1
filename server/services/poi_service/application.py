from __future__ import annotations

from services.common.schemas import Place, PlaceCollection
from services.poi_service.repository import PlaceRepository


class PlaceCatalog:
    def __init__(self, repository: PlaceRepository) -> None:
        self.repository = repository

    def list_places(self, category: str | None = None, query: str | None = None) -> PlaceCollection:
        items = self.repository.list(category=category, query=query)
        return PlaceCollection(items=items, total=len(items))

    def get_place(self, place_id: str) -> Place | None:
        return self.repository.get(place_id)

    def get_places(self, place_ids: list[str]) -> list[Place]:
        return self.repository.get_many(place_ids)

    def validate_place_ids(self, place_ids: list[str]) -> list[str]:
        return self.repository.validate_ids(place_ids)
