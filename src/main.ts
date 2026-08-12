import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from '@presentation/shell/app.component';
import { appConfig } from '@presentation/shell/app.config';

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
