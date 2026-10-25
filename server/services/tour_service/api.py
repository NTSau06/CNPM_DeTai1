from fastapi import APIRouter, HTTPException, Request, Response, status

from services.common.errors import PlaceValidationError, ServiceUnavailableError
from services.common.schemas import Tour, TourCollection, TourCreate
from services.tour_service.application import TourPlanner

router = APIRouter()


def planner(request: Request) -> TourPlanner:
    return request.app.state.planner


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "tour-service"}


@router.get("/internal/v1/tours", response_model=TourCollection)
def list_tours(request: Request) -> TourCollection:
    return planner(request).list_tours()


@router.post(
    "/internal/v1/tours", response_model=Tour, status_code=status.HTTP_201_CREATED
)
async def create_tour(payload: TourCreate, request: Request) -> Tour:
    try:
        return await planner(request).create_tour(payload)
    except PlaceValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except ServiceUnavailableError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@router.delete("/internal/v1/tours/{tour_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tour(tour_id: str, request: Request) -> Response:
    planner(request).delete_tour(tour_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
