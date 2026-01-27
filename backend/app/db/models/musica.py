from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class Musica(Base):
    __tablename__ = "musicas"

    id = Column(Integer, primary_key=True)
    titulo = Column(String, nullable=False)
    artista = Column(String, nullable=False)
    tom = Column(String)

    repertorio_id = Column(Integer, ForeignKey("repertorios.id"))
    repertorio = relationship("Repertorio", back_populates="musicas")
