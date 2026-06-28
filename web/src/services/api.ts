const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

export interface HealthData {
  status: string;
}

export async function getHealth(): Promise<ApiResponse<HealthData>> {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) {
    throw new Error(`API respondeu ${res.status}`);
  }
  return res.json() as Promise<ApiResponse<HealthData>>;
}
