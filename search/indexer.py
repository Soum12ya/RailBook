from search.es_client import es
from config import settings
from models import Train, Station

def index_train(train: Train) -> None:
    """Add or update a train document. Called after POST /trains."""
    doc = {
        'id': train.id,
        'train_number': train.train_number,
        'train_name': train.train_name,
        'source_city': train.source_station.city,
        'source_code': train.source_station.code,
        'dest_city': train.destination_station.city,
        'dest_code': train.destination_station.code,
        'departure_time': train.departure_time,
        'arrival_time': train.arrival_time,
        'days_of_week': train.days_of_week,
        'is_active': train.is_active,
    }
    es.index(index=settings.ES_TRAINS_INDEX, id=train.id, document=doc)

def update_train_status(train_id: str, is_active: bool) -> None:
    """Partial update — only change the is_active flag in ES."""
    es.update(
        index=settings.ES_TRAINS_INDEX,
        id=train_id,
        doc={'is_active': is_active}
    )

def index_station(station: Station) -> None:
    """Add or update a station document. Called after POST /stations."""
    doc = {
        'id': station.id,
        'code': station.code,
        'name': station.name,
        'city': station.city,
        'state': station.state,
        'zone': station.zone or '',
    }
    es.index(index=settings.ES_STATIONS_INDEX, id=station.id, document=doc)