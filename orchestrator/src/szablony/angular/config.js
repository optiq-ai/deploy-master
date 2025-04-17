// Angular template configuration
module.exports = {
  name: 'angular',
  displayName: 'Angular Application',
  description: 'Template for Angular applications with Angular Router and NgRx',
  icon: 'angular-logo.png',
  buildCommand: 'ng build --prod',
  startCommand: 'ng serve',
  defaultPort: 4200,
  dependencies: [
    '@angular/animations',
    '@angular/common',
    '@angular/compiler',
    '@angular/core',
    '@angular/forms',
    '@angular/platform-browser',
    '@angular/platform-browser-dynamic',
    '@angular/router',
    '@ngrx/store',
    '@ngrx/effects',
    '@ngrx/entity',
    '@ngrx/store-devtools',
    'rxjs',
    'tslib',
    'zone.js'
  ],
  devDependencies: [
    '@angular-devkit/build-angular',
    '@angular/cli',
    '@angular/compiler-cli',
    '@types/jasmine',
    '@types/node',
    'jasmine-core',
    'karma',
    'karma-chrome-launcher',
    'karma-coverage',
    'karma-jasmine',
    'karma-jasmine-html-reporter',
    'typescript'
  ],
  files: [
    {
      path: 'src/app/app.module.ts',
      content: `import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';

import { AppComponent } from './app.component';
import { HomeComponent } from './home/home.component';
import { AboutComponent } from './about/about.component';

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    AboutComponent
  ],
  imports: [
    BrowserModule,
    RouterModule.forRoot([
      { path: '', component: HomeComponent },
      { path: 'about', component: AboutComponent },
      { path: '**', redirectTo: '' }
    ]),
    StoreModule.forRoot({}),
    EffectsModule.forRoot([]),
    StoreDevtoolsModule.instrument({
      maxAge: 25
    })
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
`
    },
    {
      path: 'src/app/app.component.ts',
      content: `import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'DeployMaster Angular App';
}
`
    },
    {
      path: 'src/app/app.component.html',
      content: `<div class="container">
  <header>
    <h1>{{ title }}</h1>
    <nav>
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">Home</a> |
      <a routerLink="/about" routerLinkActive="active">About</a>
    </nav>
  </header>
  <main>
    <router-outlet></router-outlet>
  </main>
  <footer>
    <p>Powered by DeployMaster</p>
  </footer>
</div>
`
    },
    {
      path: 'src/app/app.component.css',
      content: `.container {
  font-family: Arial, sans-serif;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

header {
  text-align: center;
  margin-bottom: 30px;
}

nav {
  margin: 20px 0;
}

nav a {
  margin: 0 10px;
  text-decoration: none;
  color: #333;
}

nav a.active {
  font-weight: bold;
  color: #1976d2;
}

footer {
  margin-top: 50px;
  text-align: center;
  color: #666;
}
`
    },
    {
      path: 'src/app/home/home.component.ts',
      content: `import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
  constructor() { }
}
`
    },
    {
      path: 'src/app/home/home.component.html',
      content: `<div class="home-container">
  <img src="assets/angular-logo.png" alt="Angular Logo" class="logo">
  <h2>Welcome to Your Angular App</h2>
  <p>This application was deployed using DeployMaster.</p>
  <p>Start editing to see your changes!</p>
</div>
`
    },
    {
      path: 'src/app/home/home.component.css',
      content: `.home-container {
  text-align: center;
  padding: 20px;
}

.logo {
  width: 150px;
  margin-bottom: 20px;
}

h2 {
  color: #1976d2;
}
`
    },
    {
      path: 'src/app/about/about.component.ts',
      content: `import { Component } from '@angular/core';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.css']
})
export class AboutComponent {
  constructor() { }
}
`
    },
    {
      path: 'src/app/about/about.component.html',
      content: `<div class="about-container">
  <h2>About This App</h2>
  <p>This is an Angular application template provided by DeployMaster.</p>
  <p>It includes Angular Router for navigation and NgRx for state management.</p>
  <p>Features included:</p>
  <ul>
    <li>Component-based architecture</li>
    <li>Routing with Angular Router</li>
    <li>State management with NgRx</li>
    <li>Responsive design</li>
  </ul>
</div>
`
    },
    {
      path: 'src/app/about/about.component.css',
      content: `.about-container {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

h2 {
  color: #1976d2;
}

ul {
  margin-top: 20px;
  padding-left: 20px;
}

li {
  margin-bottom: 10px;
}
`
    }
  ],
  dockerConfig: {
    baseImage: 'node:16-alpine',
    exposedPort: 4200,
    healthCheckPath: '/',
    environmentVariables: [
      'NODE_ENV=production'
    ]
  }
}
