from sqlalchemy.orm import Session
from app.db.models.repertorio import Repertorio
from app.schemas.repertorio import RepertorioCreate


def create_repertorio(db: Session, repertorio: RepertorioCreate):
    db_rep = Repertorio(**repertorio.dict())
    db.add(db_rep)
    db.commit()
    db.refresh(db_rep)
    return db_rep


def get_repertorios_by_user(db: Session, user_id: int):
    return db.query(Repertorio).filter(Repertorio.user_id == user_id).all()


def get_repertorio(db: Session, repertorio_id: int):
    return db.query(Repertorio).filter(Repertorio.id == repertorio_id).first()


def delete_repertorio(db: Session, repertorio_id: int):
    rep = get_repertorio(db, repertorio_id)
    if rep:
        db.delete(rep)
        db.commit()
    return rep
