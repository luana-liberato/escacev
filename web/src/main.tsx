import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/components/AuthProvider';
import { ToastProvider } from '@/components/ToastProvider';
import App from '@/App';
import './index.css';

// AuthProvider dentro do BrowserRouter: as telas de sessão navegam (Navigate,
// useNavigate) e precisam do contexto de rotas acima delas.
//
// ToastProvider por fora de tudo: o toast é o canal de confirmação do sistema
// inteiro, e é fixo na viewport — não pertence a rota nenhuma.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ToastProvider>
  </StrictMode>,
);
