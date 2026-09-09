const API_URL = 'https://faz.cotas.men';

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || 'Não foi possível conectar ao Mercado Pago.');
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('A conexão demorou demais. Tente novamente.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const supportService = {
  createPix(amount, email) {
    return request('/pix', {
      method: 'POST',
      body: JSON.stringify({ amount, email }),
    });
  },

  getStatus(paymentId, statusKey) {
    return request(`/pix/${encodeURIComponent(paymentId)}?key=${encodeURIComponent(statusKey)}`);
  },
};
