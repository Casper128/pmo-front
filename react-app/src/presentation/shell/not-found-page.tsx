import { Link } from 'react-router';
import { Button } from '@/shared/ui/button';
import { PageHeader } from '@presentation/shared/components/page-header';
import { DASHBOARD_PATH } from './nav-items';

const pageClassName = 'mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6';

export function NotFoundPage() {
  return (
    <div className={pageClassName}>
      <PageHeader title="Página no encontrada" description="La dirección no corresponde a ninguna sección." />
      <div>
        <Button asChild>
          <Link to={DASHBOARD_PATH}>Ir al dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
