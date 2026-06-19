from database import SessionLocal
from models import Train, Station
from search.indexer import index_train, index_station
from search.es_client import create_indices

db = SessionLocal()
try:
    # 1. Initialize mapping templates
    create_indices()
    
    # 2. Query and index all trains from PostgreSQL
    trains = db.query(Train).all()
    for t in trains:
        index_train(t)
    print(f'Indexed {len(trains)} trains successfully.')
    
    # 3. Query and index all stations from PostgreSQL
    stations = db.query(Station).all()
    for s in stations:
        index_station(s)
    print(f'Indexed {len(stations)} stations successfully.')
    
    print('Elasticsearch seeding complete!')

finally:
    db.close()  # Always release the database connection back to the pool