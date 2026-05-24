import { Routes } from '@angular/router';
import { ScheduleComponent } from './schedule/schedule.component';
import { MonthlyServicesViewComponent } from './monthly-services-view/monthly-services-view.component';

export const routes: Routes = [
  { path: '', component: ScheduleComponent },
  { path: 'monthly', component: MonthlyServicesViewComponent }
];
