from fastapi import FastAPI
from app.api.routes.user import router as user_router
from app.api.routes.repertorio import router as repertorio_router

app = FastAPI()  # 👈 cria primeiro
app.include_router(repertorio_router)



@app.get("/")
def health():
    return {"status": "ok"}

app.include_router(user_router, prefix="/users", tags=["Users"])