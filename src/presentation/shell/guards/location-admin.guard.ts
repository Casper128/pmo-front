import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthGateway } from '@application/auth/auth.gateway';
import { environment } from '@env/environment';

export const locationAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthGateway);
  const router = inject(Router);
  const email = String(auth.user()?.email || '')
    .trim()
    .toLowerCase();
  return environment.locationAdminEmails.includes(email)
    ? true
    : router.createUrlTree(['/registros/importar']);
};
