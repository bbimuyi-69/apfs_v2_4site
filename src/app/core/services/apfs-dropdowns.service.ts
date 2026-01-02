import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  COMPONENTS,
  EMPLOYEE_TYPES,
  OFFICES_BY_COMPONENT,
  ROLES_BY_EMPLOYEE_TYPE,
  EmployeeType
} from '../../config/apfs-dropdowns.config';

@Injectable({ providedIn: 'root' })
export class ApfsDropdownsService {
  // Using Observables now makes it easy to swap to HttpClient later.
  getEmployeeTypes(): Observable<EmployeeType[]> {
    return of(EMPLOYEE_TYPES);
  }

  getComponents(): Observable<string[]> {
    return of(COMPONENTS);
  }

  getOfficesForComponent(component: string): Observable<string[]> {
    return of(OFFICES_BY_COMPONENT[component] ?? []);
  }

  getRolesForEmployeeType(employeeType: string): Observable<string[]> {
    // employeeType comes from the form, so treat it as string safely
    const key = employeeType as EmployeeType;
    return of(ROLES_BY_EMPLOYEE_TYPE[key] ?? []);
  }
}
