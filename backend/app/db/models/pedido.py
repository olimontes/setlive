from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base_class import Base

class Pedido(Base):
    __tablename__ = "pedidos"

    id = Column(Integer, primary_key=True)
    nome_musica = Column(String, nullable=False)
    artista = Column(String)

    criado_em = Column(DateTime, default=datetime.utcnow)

    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User", back_populates="pedidos")
