from typing import List, Dict, Any
from search.es_client import es
from config import settings

def search_trains(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Full-text search across train_name, source_city, dest_city,
    train_number, source_code, dest_code.
    fuzziness=AUTO: tolerates up to 2 typos on words ≥6 chars.
    Only returns is_active=true trains.
    """
    body = {
        'query': {
            'bool': {
                'must': {
                    'multi_match': {
                        'query': query,
                        'fields': [
                            'train_name^3',    # 3x boost for name match
                            'train_number^4',  # Highest boost for exact number
                            'source_city^2',
                            'dest_city^2',
                            'source_code',
                            'dest_code',
                        ],
                        'fuzziness': 'AUTO',
                        'operator': 'or',
                    }
                },
                'filter': [
                    {'term': {'is_active': True}}
                ],
            }
        },
        'size': limit,
    }
    resp = es.search(index=settings.ES_TRAINS_INDEX, body=body)
    return [hit['_source'] for hit in resp['hits']['hits']]

def search_stations(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Search stations by code prefix (NDL ➔ NDLS, score boost 4×)
    OR full-text on name/city with fuzziness.
    Useful for autocomplete dropdowns.
    """
    body = {
        'query': {
            'bool': {
                'should': [
                    {'prefix': {'code': {'value': query.upper(), 'boost': 4}}},
                    {
                        'multi_match': {
                            'query': query,
                            'fields': ['name^2', 'city'],
                            'fuzziness': 'AUTO',
                        }
                    },
                ]
            }
        },
        'size': limit,
    }
    resp = es.search(index=settings.ES_STATIONS_INDEX, body=body)
    return [hit['_source'] for hit in resp['hits']['hits']]