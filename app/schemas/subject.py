"""Subject schemas."""

from pydantic import BaseModel


class SubjectRead(BaseModel):
    sub_id: str
    name: str

    model_config = {"from_attributes": True}
