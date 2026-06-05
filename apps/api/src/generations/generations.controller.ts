import { Body, Controller, Get, Param, Post, UsePipes } from "@nestjs/common";
import { createGenerationSchema, type CreateGenerationInput } from "@meshforge/shared-types";
import { GenerationsService } from "./generations.service.js";
import { ZodValidationPipe } from "../zod.pipe.js";

@Controller("generations")
export class GenerationsController {
  constructor(private readonly generations: GenerationsService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createGenerationSchema))
  create(@Body() body: CreateGenerationInput) {
    return this.generations.create(body);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.generations.get(id);
  }

  @Post(":id/cancel")
  cancel(@Param("id") id: string) {
    return this.generations.cancel(id);
  }
}
