from elasticsearch import Elasticsearch
from config import settings

# Module-level client — shared across requests
es = Elasticsearch(settings.ELASTICSEARCH_URL, request_timeout=5)

# ── Trains index mapping ───────────────────────────────────────────────
TRAINS_MAPPING = {
    'mappings': {
        'properties': {
            'id': {'type': 'keyword'},
            'train_number': {'type': 'keyword'},
            'train_name': {
                'type': 'text', 
                'analyzer': 'standard',
                'fields': {'keyword': {'type': 'keyword'}}
            },
            'source_city': {'type': 'text', 'analyzer': 'standard'},
            'source_code': {'type': 'keyword'},
            'dest_city': {'type': 'text', 'analyzer': 'standard'},
            'dest_code': {'type': 'keyword'},
            'departure_time': {'type': 'keyword'},
            'arrival_time': {'type': 'keyword'},
            'days_of_week': {'type': 'integer'},
            'is_active': {'type': 'boolean'},
        }
    },
    'settings': {
        'number_of_shards': 1,
        'number_of_replicas': 0,  # Single-node dev — no replicas needed
    }
}

# ── Stations index mapping ─────────────────────────────────────────────
STATIONS_MAPPING = {
    'mappings': {
        'properties': {
            'id': {'type': 'keyword'},
            'code': {'type': 'keyword'},
            'name': {
                'type': 'text', 
                'analyzer': 'standard',
                'fields': {'keyword': {'type': 'keyword'}}
            },
            'city': {'type': 'text', 'analyzer': 'standard'},
            'state': {'type': 'text'},
            'zone': {'type': 'keyword'},
        }
    },
    'settings': {
        'number_of_shards': 1, 
        'number_of_replicas': 0
    }
}

def create_indices() -> None:
    """
    Create ES indices if they do not already exist.
    Safe to call on every startup — idempotent.
    """
    if not es.indices.exists(index=settings.ES_TRAINS_INDEX):
        es.indices.create(index=settings.ES_TRAINS_INDEX, body=TRAINS_MAPPING)
        print(f'Created ES index: {settings.ES_TRAINS_INDEX}')
        
    if not es.indices.exists(index=settings.ES_STATIONS_INDEX):
        es.indices.create(index=settings.ES_STATIONS_INDEX, body=STATIONS_MAPPING)
        print(f'Created ES index: {settings.ES_STATIONS_INDEX}')