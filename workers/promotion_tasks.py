from datetime import date
from workers.celery_app import celery_app
from database import SessionLocal
from repositories.booking_repo import PassengerRepository
from models import BookingStatusEnum
from workers.notification_tasks import send_waitlist_promotion
from cache.seat_cache import invalidate_seat_cache

@celery_app.task(name='workers.promotion_tasks.run_waitlist_promotion')
def run_waitlist_promotion(
    train_id: str,
    seat_class_id: str,
    journey_date: str,
    freed_confirmed: int,
    freed_rac: int,
) -> dict:
    """
    Background task: promote passengers up the queue after a cancellation.
    freed_confirmed: how many CONFIRMED seats were freed by the cancellation.
    freed_rac: how many RAC slots were freed.
    
    For each freed CONFIRMED slot:
    1. Promote first RAC passenger ➔ CONFIRMED
    2. Promote first WL passenger ➔ RAC
    
    For each freed RAC slot (no confirmed freed):
    1. Promote first WL passenger ➔ RAC
    """
    db = SessionLocal()
    promoted = {'confirmed': 0, 'rac': 0}
    
    try:
        pax_repo = PassengerRepository(db)
        jdate = date.fromisoformat(journey_date)
        
        # ── Promote for each freed CONFIRMED slot ──────────────────────
        for _ in range(freed_confirmed):
            # Step 1: RAC ➔ CONFIRMED
            rac = pax_repo.get_next_rac_passenger(train_id, seat_class_id, jdate)
            if rac:
                rac.status = BookingStatusEnum.CONFIRMED
                rac.booking.status = BookingStatusEnum.CONFIRMED
                db.flush()
                promoted['confirmed'] += 1
                
                send_waitlist_promotion.delay(
                    rac.booking.user.email,
                    rac.booking.user.full_name,
                    rac.booking.pnr, 
                    'CONFIRMED'
                )
            
            # Step 2: WL ➔ RAC (fills the RAC slot vacated above)
            wl = pax_repo.get_next_waitlist_passenger(train_id, seat_class_id, jdate)
            if wl:
                wl.status = BookingStatusEnum.RAC
                wl.waitlist_number = None
                wl.booking.status = BookingStatusEnum.RAC
                db.flush()
                promoted['rac'] += 1
                
                send_waitlist_promotion.delay(
                    wl.booking.user.email,
                    wl.booking.user.full_name,
                    wl.booking.pnr, 
                    'RAC'
                )

        # ── Promote for each freed RAC slot ────────────────────────────
        for _ in range(freed_rac):
            wl = pax_repo.get_next_waitlist_passenger(train_id, seat_class_id, jdate)
            if wl:
                wl.status = BookingStatusEnum.RAC
                wl.waitlist_number = None
                wl.booking.status = BookingStatusEnum.RAC
                db.flush()
                promoted['rac'] += 1
                
                send_waitlist_promotion.delay(
                    wl.booking.user.email,
                    wl.booking.user.full_name,
                    wl.booking.pnr, 
                    'RAC'
                )
        
        db.commit()
        
        # Bust seat cache — counts changed due to promotion cascade
        invalidate_seat_cache(train_id, seat_class_id, journey_date)
        return promoted

    except Exception as exc:
        db.rollback()
        raise exc
    finally:
        db.close()  # Always release connection back to pool