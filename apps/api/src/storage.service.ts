import { Injectable } from "@nestjs/common";
import { createStorage, type StorageDriver } from "@meshforge/storage";

@Injectable()
export class StorageService {
  readonly driver: StorageDriver = createStorage();
}
