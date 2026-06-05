import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { z } from "zod";
import { ProjectsService } from "./projects.service.js";
import { ZodValidationPipe } from "../zod.pipe.js";

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});
type CreateProject = z.infer<typeof createProjectSchema>;

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  create(@Body(new ZodValidationPipe(createProjectSchema)) body: CreateProject) {
    return this.projects.create(body.name, body.description);
  }

  @Get()
  list() {
    return this.projects.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.projects.get(id);
  }

  @Patch(":id")
  rename(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(createProjectSchema)) body: CreateProject,
  ) {
    return this.projects.rename(id, body.name, body.description);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.projects.remove(id);
  }
}
