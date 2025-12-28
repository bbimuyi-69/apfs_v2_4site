import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  console.log('[authGuard] url=', state.url, 'isLoggedIn=', auth.isLoggedIn);

  if (auth.isLoggedIn && auth.user?.isActive) {
    return true;
  }

  // ✅ return UrlTree instead of calling router.navigate()
  return router.createUrlTree(['/user-login'], {
    queryParams: { next: state.url }
  });
};
