import { Routes } from '@angular/router';
import { LandingComponent } from './pages/landing/landing.component';
import { LayoutComponent } from './components/layout/layout.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { EtlComponent } from './pages/etl/etl.component';
import { MongodbComponent } from './pages/mongodb/mongodb.component';
import { Neo4jComponent } from './pages/neo4j/neo4j.component';
import { BuscadorComponent } from './pages/buscador/buscador.component';

export const routes: Routes = [
  {
    path: '',
    component: LandingComponent,
    pathMatch: 'full',
  },
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'etl', component: EtlComponent },
      { path: 'mongodb', component: MongodbComponent },
      { path: 'neo4j', component: Neo4jComponent },
      { path: 'buscador', component: BuscadorComponent },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
