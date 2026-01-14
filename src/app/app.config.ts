import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi, HTTP_INTERCEPTORS } from '@angular/common/http';
import { routes } from './app.routes';
import { UserIdHeaderInterceptor } from './core/http/user-id.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),

    // ✅ enable interceptors registered via DI
    provideHttpClient(withInterceptorsFromDi()),

    // ✅ register your interceptor
    { provide: HTTP_INTERCEPTORS, useClass: UserIdHeaderInterceptor, multi: true },
  ]
};
