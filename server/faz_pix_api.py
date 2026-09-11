import hashlib
import hmac
import json
import os
import re
import threading
import uuid
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from zoneinfo import ZoneInfo

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
SUPPORT_GOAL = Decimal("500.00")
SUPPORT_DATA_FILE = Path(os.environ.get("SUPPORT_DATA_FILE", "/var/lib/faz-pix/support.json"))
SUPPORT_DATA_LOCK = threading.Lock()
SUPPORT_TIMEZONE = ZoneInfo("America/Sao_Paulo")

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


def load_support_data() -> dict:
    try:
        data = json.loads(SUPPORT_DATA_FILE.read_text(encoding="utf-8"))
        if isinstance(data, dict) and isinstance(data.get("payments"), dict):
            return data
    except (OSError, ValueError, TypeError):
        pass
    return {"payments": {}}


def save_support_data(data: dict) -> None:
    SUPPORT_DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary = SUPPORT_DATA_FILE.with_suffix(".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    os.chmod(temporary, 0o600)
    temporary.replace(SUPPORT_DATA_FILE)


def current_support_month() -> str:
    return datetime.now(SUPPORT_TIMEZONE).strftime("%Y-%m")


def record_approved_payment(payment: dict) -> None:
    if payment.get("status") != "approved":
        return
    if not str(payment.get("external_reference", "")).startswith("faz-support-"):
        return
    payment_id = str(payment.get("id", ""))
    try:
        amount = Decimal(str(payment.get("transaction_amount", "0"))).quantize(Decimal("0.01"))
    except InvalidOperation:
        return
    if not payment_id.isdigit() or amount <= 0:
        return
    with SUPPORT_DATA_LOCK:
        data = load_support_data()
        data["payments"][payment_id] = {
            "amount": str(amount),
            "month": current_support_month(),
        }
        save_support_data(data)


def support_summary() -> dict:
    month = current_support_month()
    with SUPPORT_DATA_LOCK:
        data = load_support_data()
        raised = sum(
            (
                Decimal(str(value.get("amount", "0")))
                for value in data["payments"].values()
                if isinstance(value, dict) and value.get("month") == month
            ),
            Decimal("0.00"),
        )
        supporters = sum(
            1
            for value in data["payments"].values()
            if isinstance(value, dict) and value.get("month") == month
        )
    return {
        "raised": float(raised),
        "goal": float(SUPPORT_GOAL),
        "supporters": supporters,
        "month": month,
    }


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


@app.get("/support")
async def get_support_summary():
    return support_summary()


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
            "description": "Apoio voluntário ao Faz agora!",
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
    record_approved_payment(result)
    return {"status": result.get("status", "pending")}


@app.post("/webhook/mercadopago")
async def mercado_pago_webhook(request: Request):
    payment_id = request.query_params.get("data.id") or request.query_params.get("id")
    if not payment_id:
        try:
            payload = await request.json()
            payment_id = str(payload.get("data", {}).get("id", ""))
        except (ValueError, TypeError):
            payment_id = ""
    if payment_id and str(payment_id).isdigit():
        # A notificação nunca aprova um pagamento sozinha: a confirmação é
        # consultada diretamente no Mercado Pago antes de entrar no progresso.
        result = await mercado_pago("GET", f"/v1/payments/{payment_id}")
        record_approved_payment(result)
    return {"received": True}
