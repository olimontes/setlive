from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base import Base


class Repertorio(Base):
    __tablename__ = "repertorios"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    user = relationship("User", back_populates="repertorios")
