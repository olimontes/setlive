from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base

class PlaylistImportada(Base):
    __tablename__ = "playlists_importadas"

    id = Column(Integer, primary_key=True)
    nome = Column(String, nullable=False)
    plataforma = Column(String)  # spotify, youtube, etc

    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User")
