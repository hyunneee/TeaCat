import { useNavigate } from 'react-router-dom';
import { AdminStadiumWorkspace, useStadiumEditor } from '@/features/stadium';
import { ROUTES } from '@/shared/constants';

export function AdminStadiumPage() {
  const navigate = useNavigate();
  const controller = useStadiumEditor();
  return (
    <AdminStadiumWorkspace
      controller={controller}
      onExit={() => navigate(ROUTES.ADMIN)}
    />
  );
}
