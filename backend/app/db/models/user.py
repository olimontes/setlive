from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.db.base import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)

    repertorios = relationship(
        "Repertorio",
        back_populates="user",
        cascade="all, delete"
    )

    pedidos = relationship(
        "Pedido",
        back_populates="user",
        cascade="all, delete"
    )
