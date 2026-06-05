import { Controller, Get, Param, Post, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { AssetsService } from "./assets.service.js";

// Tipo mínimo do arquivo do Multer (evita depender de @types/multer).
interface UploadedImage {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

@Controller()
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Post("projects/:projectId/assets")
  @UseInterceptors(FileInterceptor("file"))
  async upload(@Param("projectId") projectId: string, @UploadedFile() file: UploadedImage) {
    const ext = file.originalname.split(".").pop() ?? "png";
    return this.assets.uploadImage(projectId, file.buffer, ext);
  }

  @Get("assets/:id")
  async download(@Param("id") id: string, @Res() res: Response) {
    const { asset, stream, mime } = await this.assets.open(id);
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `inline; filename="${asset.id}.${asset.format}"`);
    stream.pipe(res);
  }
}
