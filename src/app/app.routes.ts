import { Routes } from '@angular/router';

import { UserList } from './components/user/user-list/user-list';
import { About } from './components/common/about/about';
import { Contact } from './components/common/contact/contact';
import { Welcome } from './components/common/welcome/welcome';
import { Rob } from './components/common/rob/rob';
import { Request } from './components/accounts/request/request';
import { RequestNewUserForm } from './components/user/request-new-user-form/request-new-user-form';
import { UserLogin } from './auth/user-login/user-login';
import { Dashboard } from './components/dashboard/dashboard';
import { DashboardV2Page } from './features/dashboard-v2/dashboard-v2.page';
import { authGuard } from './auth/auth-guard';

// ✅ Forecast components
import { ForecastListComponent } from './features/forecast/forecast-list/forecast-list';
import { ForecastRecordComponent } from './features/forecast/forecast-record/components/forecast-record/forecast-record';

export const routes: Routes = [
    { path: '', redirectTo: 'welcome', pathMatch: 'full', data: { title: 'Welcome' } },

    { path: 'about', component: About, data: { title: 'About' } },
    { path: 'contact', component: Contact, data: { title: 'Contact' } },
    { path: 'users', component: UserList, data: { title: 'User List' } },
    { path: 'welcome', component: Welcome, data: { title: 'Welcome' } },
    { path: 'rob', component: Rob, data: { title: 'Rob' } },
    { path: 'request', component: Request, data: { title: 'Request' } },
    { path: 'request-new-user', component: RequestNewUserForm, data: { title: 'Request New User' } },
    { path: 'user-login', component: UserLogin, data: { title: 'User Login' } },

    {
        path: 'dashboard',
        component: Dashboard,
        canActivate: [authGuard],
        data: { title: 'Dashboard' },
    },

    {
        path: 'dashboard-v2',
        component: DashboardV2Page,
        canActivate: [authGuard],
        data: { title: 'Dashboard v2' },
    },

    // =========================
    // Forecast routes
    // =========================

    // Create new forecast record (keep above /forecast and /forecast/:id)
    {
        path: 'forecast/new',
        component: ForecastRecordComponent,
        canActivate: [authGuard],
        data: { title: 'New Forecast Record' },
    },

    // Edit/view existing forecast record
    {
        path: 'forecast/:id',
        component: ForecastRecordComponent,
        canActivate: [authGuard],
        data: { title: 'Forecast Record' },
    },

    // Forecast dashboard (simple list for now)
    {
        path: 'forecast',
        component: ForecastListComponent,
        canActivate: [authGuard],
        data: { title: 'Forecast Dashboard' },
    },

    // Fallback
    { path: '**', redirectTo: 'welcome' },
];
