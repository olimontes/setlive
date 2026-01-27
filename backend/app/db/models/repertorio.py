from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base_class import Base

class Repertorio(Base):
    __tablename__ = "repertorios"

    id = Column(Integer, primary_key=True)
    nome = Column(String, nullable=False)

    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="repertorios")

    musicas = relationship("Musica", back_populates="repertorio", cascade="all, delete")
