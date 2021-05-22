import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { InfoComponent } from './info/info.component';
import { ReminderComponent } from './reminder/reminder.component';

const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'reminder',
  },
  { path: 'reminder', component: ReminderComponent },
  { path: 'info', component: InfoComponent },
  { path: '*', redirectTo: 'reminder' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { relativeLinkResolution: 'legacy' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
