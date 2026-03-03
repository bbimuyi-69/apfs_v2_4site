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
import { TimelinessReportComponent } from './features/reports/timeliness-report/timeliness-report';



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
    // Admin routes
    {
        path: 'admin',
        canActivate: [authGuard],
        loadComponent: () => import('./features/admin/admin-home/admin-home').then(m => m.AdminHome),
    },
    {
        path: 'admin/users',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./features/admin/admin-users/admin-users').then(m => m.AdminUsers),
    },
    {
        path: 'admin/users/:id/edit',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./components/user/request-new-user-form/request-new-user-form')
                .then(m => m.RequestNewUserForm) // <-- use your real exported class name
    },
    {
        path: 'admin/lookups',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./features/admin/admin-lookup/admin-lookup').then(m => m.AdminLookup),
    },
    // Organization Management
    {
        path: 'admin/organization',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./features/admin/admin-organization/admin-organization')
                .then(m => m.AdminOrganization),
    },

    {
        path: 'admin/organization/new',
        loadComponent: () => import('./features/admin/admin-organization-form/admin-organization-form').then(m => m.AdminOrganizationFormComponent),
    },
    {
        path: 'admin/organization/:id/edit',
        loadComponent: () => import('./features/admin/admin-organization-form/admin-organization-form').then(m => m.AdminOrganizationFormComponent),
    },

    /*{
        path: 'admin/organization/:id/edit',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./features/admin/admin-organization/admin-organization-edit')
                .then(m => m.AdminOrganizationEdit),
    },*/
    // End Organization Management







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


    {
        path: 'admin/offices',
        loadComponent: () =>
            import('./features/admin/admin-offices/admin-offices')
                .then(m => m.AdminOfficesComponent)
    },
    {
        path: 'admin/offices/:id/edit',
        loadComponent: () =>
            import('./features/admin/admin-office-form/admin-office-form')
                .then(m => m.AdminOfficeFormComponent)
    },
    {
        path: 'admin/offices/new',
        loadComponent: () =>
            import('./features/admin/admin-office-form/admin-office-form')
                .then(m => m.AdminOfficeFormComponent)
    },
    {
        path: 'reports/timeliness-report',
        loadComponent: () =>
            import('./features/reports/timeliness-report/timeliness-report')
                .then(m => m.TimelinessReportComponent)
    },




    { path: '**', redirectTo: 'welcome' },
];
