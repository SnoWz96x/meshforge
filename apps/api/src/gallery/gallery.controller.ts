import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { GalleryService } from "./gallery.service.js";

@Controller("gallery")
export class GalleryController {
  constructor(private readonly gallery: GalleryService) {}

  @Get()
  list(@Query("search") search?: string, @Query("limit") limit?: string) {
    return this.gallery.list(search, limit ? Number(limit) : 60);
  }

  @Post("import")
  import(@Body() body: { projectId?: string; url?: string; name?: string }) {
    return this.gallery.import(body?.projectId ?? "", body?.url ?? "", body?.name ?? "modelo");
  }
}
