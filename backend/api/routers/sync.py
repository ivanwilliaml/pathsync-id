"""Sync, the in-app assistant (pathsync.sync_agent). Read-only, scoped to the signed-in student."""
from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from pathsync.db import ProductEvent, Student
from pathsync.i18n import tr
from pathsync.security import db_session, rate_limit, student_access
from pathsync.sync_agent import SyncBusy, chat, sync_configured

from ..common import recommend_for

router = APIRouter(prefix="/api", tags=["sync"])


class Message(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., max_length=4000)


class ChatIn(BaseModel):
    messages: list[Message] = Field(..., min_length=1, max_length=40)


@router.get("/sync/status")
def status():
    return {"enabled": sync_configured()}


@router.post("/students/{sid}/sync", dependencies=[Depends(rate_limit("sync", 20))])
def sync_chat(body: ChatIn, st: Student = Depends(student_access), s: Session = Depends(db_session)):
    if not sync_configured():
        raise HTTPException(503, tr("Sync is not switched on on this server yet.", "Sync belum diaktifkan di server ini."))
    if body.messages[-1].role != "user":
        raise HTTPException(400, tr("The last message must be the question.", "Pesan terakhir harus pertanyaanmu."))
    st = s.merge(st)
    try:
        turn = chat(s, st, [m.model_dump() for m in body.messages], recommend_for)
    except SyncBusy as e:
        raise HTTPException(429, tr(f"Sync is busy right now. Try again in {e.seconds} seconds.",
                                    f"Sync lagi ramai. Coba lagi dalam {e.seconds} detik.")) from None
    except (httpx.HTTPError, KeyError, ValueError):
        raise HTTPException(502, tr("Sync could not answer just now. Try again in a moment.",
                                    "Sync belum bisa menjawab sekarang. Coba lagi sebentar lagi.")) from None
    s.add(ProductEvent(name="sync_asked", student_id=st.id, props={"cards": ",".join(c["type"] for c in turn.cards)[:100]}))
    s.commit()
    return {"reply": turn.reply, "cards": turn.cards}
