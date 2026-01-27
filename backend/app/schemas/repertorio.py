from pydantic import BaseModel


class RepertorioBase(BaseModel):
    nome: str


class RepertorioCreate(RepertorioBase):
    user_id: int


class RepertorioResponse(RepertorioBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True
