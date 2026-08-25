import { BadRequestException, Injectable } from '@nestjs/common';
import { parseOffice } from 'officeparser';

@Injectable()
export class DocumentContentExtractor {
  async extract(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
    const extension = fileName.toLowerCase().split('.').pop() ?? '';
    if (['txt', 'csv'].includes(extension) || ['text/plain', 'text/csv'].includes(mimeType))
      return this.limit(buffer.toString('utf8'));
    if (['docx', 'xlsx', 'pptx', 'pdf'].includes(extension)) {
      try {
        const ast = await parseOffice(buffer, {
          ocr: false,
          extractAttachments: false,
          includeRawContent: false,
          outputErrorToConsole: false,
        });
        return this.limit(ast.toText());
      } catch (error) {
        throw new BadRequestException({
          code: 'AI_REVIEW_UNSUPPORTED_FILE',
          message: '文件内容无法可靠提取，请转人工审核',
          details: { fileName, reason: error instanceof Error ? error.message : String(error) },
        });
      }
    }
    throw new BadRequestException({
      code: 'AI_REVIEW_UNSUPPORTED_FILE',
      message: '该文件类型暂不支持 AI 审核，请转人工审核',
      details: { fileName, mimeType },
    });
  }
  private limit(content: string) {
    return content.split('\u0000').join('').slice(0, 120_000);
  }
}
