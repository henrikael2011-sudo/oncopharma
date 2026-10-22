import { Controller, Get, Module, ServiceUnavailableException } from '@nestjs/common';
import { ClinicalController } from './clinical.controller';
import { DatabaseService } from './database.service';
import { AuthGuard } from './auth.guard';
import { WorkflowController } from './workflow.controller';
import { CareController } from './care.controller';
import { MedicalRequestsController } from './medical-requests.controller';
import { ClinicalWorkController } from './clinical-work.controller';
import { MedTranscriptionController } from './med-transcription.controller';
import { PublicRegistrationController, RegistrationController } from './registration.controller';
import { HospitalPanelController } from './hospital-panel.controller';

@Controller('health')
class HealthController {
  @Get() status() { return { service: 'oncopharma-api', status: 'alive', clinicalOperationsEnabled: false }; }
}
@Controller('ready')
class ReadyController {
  constructor(private readonly db: DatabaseService) {}
  @Get() async ready() { if (!(await this.db.ready())) throw new ServiceUnavailableException('Banco indisponível'); return { databaseReady: true, clinicalOperationsEnabled: false }; }
}
@Module({ controllers: [MedicalRequestsController, HealthController, ReadyController, ClinicalController, WorkflowController, CareController, ClinicalWorkController, MedTranscriptionController, PublicRegistrationController, RegistrationController, HospitalPanelController], providers: [DatabaseService, AuthGuard] })
export class AppModule {}
