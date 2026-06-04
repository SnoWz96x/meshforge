import { Controller, Get } from "@nestjs/common";
import { HealthService } from "./health.service.js";

@Controller("health")
export class HealthController {
  // Injeção por construtor — só funciona se os metadados de decorator forem emitidos.
  constructor(private readonly health: HealthService) {}

  @Get()
  get() {
    return this.health.status();
  }
}
