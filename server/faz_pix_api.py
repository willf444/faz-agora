import hashlib
import hmac
import os
import re
import uuid
from decimal import Decimal, InvalidOperation

import httpx
from fastapi import FastAPI, HTTPException, Query, Request
from pydantic import BaseModel


MP_API_URL = "https://api.mercadopago.com"
MP_ACCESS_TOKEN = os.environ.get("MP_ACCESS_TOKEN", "")
STATUS_SECRET = os.environ.get("STATUS_SECRET", "")
MP_NOTIFICATION_URL = os.environ.get(
    "MP_NOTIFICATION_URL",
    "https://faz.whats.men/webhook/mercadopago",
)
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

app = FastAPI(title="Faz Pix API", docs_url=None, redoc_url=None)


class PixRequest(BaseModel):
    amount: Decimal
    email: str


def payment_status_key(payment_id: str) -> str:
    return hmac.new(
        STATUS_SECRET.encode(),
        payment_id.encode(),
        hashlib.sha256,
    ).hexdigest()


def ensure_configured() -> None:
    if not MP_ACCESS_TOKEN or not STATUS_SECRET:
        raise HTTPException(status_code=503, detail="Serviço temporariamente indisponível.")


async def mercado_pago(method: str, path: str, **kwargs) -> dict:
    headers = {
        "Authorization": f"Bearer {MP_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }
    headers.update(kwargs.pop("headers", {}))
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.request(
                method,
                f"{MP_API_URL}{path}",
                headers=headers,
                **kwargs,
            )
    except httpx.RequestError as error:
        raise HTTPException(status_code=502, detail="Mercado Pago indisponível. Tente novamente.") from error

    data = response.json() if response.content else {}
    if response.is_error:
        message = data.get("message") if isinstance(data, dict) else None
        raise HTTPException(status_code=502, detail=message or "Não foi possível gerar o Pix.")
    return data


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/pix")
async def create_pix(payload: PixRequest):
    ensure_configured()
    try:
        amount = payload.amount.quantize(Decimal("0.01"))
    except InvalidOperation as error:
        raise HTTPException(status_code=400, detail="Valor inválido.") from error

    if amount < Decimal("1.00") or amount > Decimal("1000.00"):
        raise HTTPException(status_code=400, detail="Escolha um valor entre R$ 1 e R$ 1.000.")
    email = payload.email.strip().lower()
    if len(email) > 254 or not EMAIL_PATTERN.match(email):
        raise HTTPException(status_code=400, detail="Informe um e-mail válido.")

    idempotency_key = str(uuid.uuid4())
    result = await mercado_pago(
        "POST",
        "/v1/payments",
        headers={"X-Idempotency-Key": idempotency_key},
        json={
            "transaction_amount": float(amount),
            "description": "Apoio voluntário ao Faz",
            "payment_method_id": "pix",
            "payer": {"email": email},
            "external_reference": f"faz-support-{idempotency_key}",
            "notification_url": MP_NOTIFICATION_URL,
        },
    )
    payment_id = str(result.get("id", ""))
    transaction = result.get("point_of_interaction", {}).get("transaction_data", {})
    qr_code = transaction.get("qr_code", "")
    if not payment_id or not qr_code:
        raise HTTPException(status_code=502, detail="O Mercado Pago não devolveu o código Pix.")

    return {
        "id": payment_id,
        "status": result.get("status", "pending"),
        "statusKey": payment_status_key(payment_id),
        "qrCode": qr_code,
        "qrCodeBase64": transaction.get("qr_code_base64", ""),
    }


@app.get("/pix/{payment_id}")
async def get_pix_status(payment_id: str, key: str = Query(min_length=64, max_length=64)):
    ensure_configured()
    if not payment_id.isdigit() or not hmac.compare_digest(key, payment_status_key(payment_id)):
        raise HTTPException(status_code=404, detail="Pagamento não encontrado.")
    result = await mercado_pago("GET", f"/v1/payments/{payment_id}")
    return {"status": result.get("status", "pending")}


@app.post("/webhook/mercadopago")
async def mercado_pago_webhook(_: Request):
    # A confirmação exibida no app sempre é consultada diretamente na API do
    # Mercado Pago; uma chamada falsa a este endpoint não aprova pagamentos.
    return {"received": True}
