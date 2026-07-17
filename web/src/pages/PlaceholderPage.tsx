import { useLocation } from 'react-router-dom';
import { navItemByPath } from '@/config/navigation';

/**
 * Conteúdo provisório das telas internas, como no protótipo do layout base — a
 * casca já navega e o miolo de cada tela entra nas próximas etapas.
 *
 * Sai assim que a tela real nascer.
 */
export default function PlaceholderPage() {
  const { pathname } = useLocation();
  const page = navItemByPath(pathname);

  return (
    <div className="rounded-[14px] border border-dashed border-line bg-cream px-5 py-10 text-center text-[13.5px] text-muted">
      Conteúdo de {page?.label} entra aqui — próxima etapa.
    </div>
  );
}
