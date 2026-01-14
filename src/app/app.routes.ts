import { Routes } from '@angular/router';

import { UserList } from './components/user/user-list/user-list';
import { About } from './components/common/about/about';
import { Contact } from './components/common/contact/contact';
import { Welcome } from './components/common/welcome/welcome';
import { Rob } from './components/common/rob/rob';
import { Request } from './components/accounts/request/request';
import { RequestNewUserForm } from './components/user/request-new-user-form/request-new-user-form';
import { UserLogin } from './auth/user-login/user-login';
import { DashboardV2Page } from './features/dashboard-v2/dashboard-v2.page';
import { authGuard } from './auth/auth-guard';

// Forecast
import { ForecastListComponent } from './features/forecast/forecast-list/forecast-list';
import { ForecastRecordComponent } from './features/forecast/forecast-record/components/forecast-record/forecast-record';
import { RejectCommentComponent } from './features/forecast/forecast-record/components/reject-comment/reject-comment';
import { ForwardCommentComponent } from './features/forecast/forecast-record/components/forward-comment/forward-comment';



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
        path: 'dashboard-v2',
        component: DashboardV2Page,
        canActivate: [authGuard],
        data: { title: 'Dashboard v2' },
    },

    // =========================
    // Forecast routes
    // =========================

    {
        path: 'forecast/new',
        component: ForecastRecordComponent,
        canActivate: [authGuard],
        data: { title: 'New Forecast Record' },
    },

    {
        path: 'forecast/:id/reject',
        component: RejectCommentComponent,
        canActivate: [authGuard],
        data: { title: 'Reject Comment' },
    },

    {
        path: 'forecast/:id/forward',
        component: ForwardCommentComponent,
        canActivate: [authGuard],
        data: { title: 'Forward Comment' },
    },

    {
        path: 'forecast/:id',
        component: ForecastRecordComponent,
        canActivate: [authGuard],
        data: { title: 'Forecast Record' },
    },

    {
        path: 'forecast',
        component: ForecastListComponent,
        canActivate: [authGuard],
        data: { title: 'Forecast Dashboard' },
    },

    { path: '**', redirectTo: 'welcome' },
];
