import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import { getToken } from './authToken';
import type { ApiResponse } from './types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

/**
 * Erro vindo da API, já traduzido. `message` é o texto EM PORTUGUÊS que a API
 * mandou — a API é a dona da mensagem de erro; a UI exibe, não reescreve.
 *
 * `status` permite a tela distinguir os casos que o back usa de propósito:
 * 401 (token ausente/expirado), 403 (não é admin DESTE ministério — a guarda
 * escopada), 404 (inexistente ou de outro tenant), 409 (duplicata / bloqueio por
 * dado em uso).
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

const client = axios.create({ baseURL: API_URL });

// Injeta o JWT em toda request autenticada. O institutionId vai DENTRO do token —
// nunca em body ou query (Seção 4.5 da raiz).
client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Callback disparado quando a API devolve 401 (token ausente, inválido ou
 * expirado). O contexto de autenticação registra aqui o "derrubar a sessão", em
 * vez de o `services/` conhecer roteamento.
 */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

/**
 * Traduz qualquer falha do axios em ApiError. A API erra sempre no shape
 * `{ success, data: null, message }`, então a mensagem útil vem de `message`;
 * o fallback cobre o que não vem da API (rede fora, CORS, servidor derrubado).
 */
function toApiError(error: unknown): ApiError {
  if (!(error instanceof AxiosError)) {
    return new ApiError('Erro inesperado ao falar com o servidor', 0);
  }

  const status = error.response?.status ?? 0;
  if (status === 0) {
    return new ApiError('Não foi possível conectar ao servidor', 0);
  }

  if (status === 401 && onUnauthorized) {
    onUnauthorized();
  }

  const message = (error.response?.data as ApiResponse<null> | undefined)?.message;
  return new ApiError(message ?? 'Erro inesperado ao falar com o servidor', status);
}

/**
 * Desembrulha o envelope: a chamada devolve `data` puro. O shape
 * `{ success, data, message }` NÃO escapa daqui.
 */
async function request<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await client.request<ApiResponse<T>>(config);
    return response.data.data;
  } catch (error) {
    throw toApiError(error);
  }
}

/**
 * Variante que preserva a `message` de sucesso, para os poucos casos em que ela
 * é informação e não decoração — o lote de alocação é o exemplo: a API resume ali
 * quantos foram criados, falharam e aguardam confirmação.
 */
async function requestWithMessage<T>(
  config: AxiosRequestConfig,
): Promise<{ data: T; message: string }> {
  try {
    const response = await client.request<ApiResponse<T>>(config);
    return { data: response.data.data, message: response.data.message };
  } catch (error) {
    throw toApiError(error);
  }
}

export const http = {
  get: <T>(url: string, params?: unknown) => request<T>({ method: 'GET', url, params }),
  post: <T>(url: string, data?: unknown) => request<T>({ method: 'POST', url, data }),
  put: <T>(url: string, data?: unknown) => request<T>({ method: 'PUT', url, data }),
  patch: <T>(url: string, data?: unknown) => request<T>({ method: 'PATCH', url, data }),
  del: <T>(url: string, params?: unknown) => request<T>({ method: 'DELETE', url, params }),
  withMessage: requestWithMessage,
};

/** URL de início do login com Google. É NAVEGAÇÃO do browser, não XHR — o Google precisa da janela. */
export const googleLoginUrl = `${API_URL}/auth/google`;
