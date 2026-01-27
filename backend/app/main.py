from fastapi import FastAPI
from fastapi import FastAPI
from app.api.routes.user import router as user_router

app = FastAPI(title="Setlive API")

@app.get("/")
def health():
    return {"status": "ok"}

app = FastAPI()

app.include_router(user_router)