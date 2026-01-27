from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.schemas.repertorio import RepertorioCreate, RepertorioResponse
from app.crud.repertorio import (
    create_repertorio,
    get_repertorios_by_user,
    delete_repertorio
)
from app.db.session import SessionLocal

router = APIRouter(prefix="/repertorios", tags=["Repertorios"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/", response_model=RepertorioResponse)
def create(rep: RepertorioCreate, db: Session = Depends(get_db)):
    return create_repertorio(db, rep)


@router.get("/user/{user_id}", response_model=list[RepertorioResponse])
def list_by_user(user_id: int, db: Session = Depends(get_db)):
    return get_repertorios_by_user(db, user_id)


@router.delete("/{repertorio_id}")
def delete(repertorio_id: int, db: Session = Depends(get_db)):
    rep = delete_repertorio(db, repertorio_id)
    if not rep:
        raise HTTPException(status_code=404, detail="Repertório não encontrado")
    return {"ok": True}
