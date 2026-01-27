from app.db.session import SessionLocal
from app.db.models.user import User

db = SessionLocal()
db.add(User(email="test@test.com", password="123"))
db.commit()
print("Inserido com sucesso")

