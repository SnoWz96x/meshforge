import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { GalleryService } from "./gallery.service.js";

@Controller("gallery")
export class GalleryController {
  constructor(private readonly gallery: GalleryService) {}

  @Get()
  list(
    @Query("search") search?: string,
    @Query("limit") limit?: string,
    @Query("source") source?: string,
  ) {
    return this.gallery.list(search, limit ? Number(limit) : 60, source);
  }

  @Get("sources")
  sources() {
    return this.gallery.sources();
  }

  @Post("import")
  import(@Body() body: { projectId?: string; source?: string; url?: string; name?: string }) {
    return this.gallery.import(
      body?.projectId ?? "",
      body?.source ?? "cc0",
      body?.url ?? "",
      body?.name ?? "modelo",
    );
  }
}
