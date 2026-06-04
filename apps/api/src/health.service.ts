import { Injectable } from "@nestjs/common";

@Injectable()
export class HealthService {
  status(): { status: string; service: string; time: string } {
    return { status: "ok", service: "meshforge-api", time: new Date().toISOString() };
  }
}
