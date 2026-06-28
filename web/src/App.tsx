import { useEffect, useState } from 'react';
import { getHealth } from './services/api';

type ConnState = 'carregando' | 'ok' | 'erro';

const STYLES: Record<ConnState, { dot: string; label: string }> = {
  carregando: { dot: 'bg-amber-400', label: 'Verificando conexão com a API...' },
  ok: { dot: 'bg-emerald-500', label: 'API conectada' },
  erro: { dot: 'bg-red-500', label: 'Sem conexão com a API' },
};

export default function App() {
  const [state, setState] = useState<ConnState>('carregando');
  const [message, setMessage] = useState('');

  useEffect(() => {
    getHealth()
      .then((res) => {
        setState('ok');
        setMessage(res.message);
      })
      .catch(() => {
        setState('erro');
        setMessage('Não foi possível conectar à API em GET /health.');
      });
  }, []);

  const style = STYLES[state];

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-lg ring-1 ring-slate-200 p-8 text-center">
        <h1 className="text-3xl font-bold text-slate-800">Escacev</h1>
        <p className="mt-1 text-sm text-slate-500">Sistema de Gestão de Escalas</p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <span className={`inline-block h-3 w-3 rounded-full ${style.dot}`} />
          <span className="text-sm font-medium text-slate-700">{style.label}</span>
        </div>

        {message && <p className="mt-3 text-xs text-slate-400">{message}</p>}
      </div>
    </main>
  );
}
