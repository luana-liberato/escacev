import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/components/AuthProvider';
import App from '@/App';
import './index.css';

// AuthProvider dentro do BrowserRouter: as telas de sessão navegam (Navigate,
// useNavigate) e precisam do contexto de rotas acima delas.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
