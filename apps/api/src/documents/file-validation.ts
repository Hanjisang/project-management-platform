import { BadRequestException } from '@nestjs/common';
import { extname, posix } from 'node:path';

export const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
]);

export const SOP_TEMPLATE_MIME_TYPES = new Set([
  ...DOCUMENT_MIME_TYPES,
  'application/zip',
  'application/x-7z-compressed',
]);

const EXTENSIONS_BY_MIME: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'application/zip': ['.zip'],
  'application/x-7z-compressed': ['.7z'],
};

interface UploadPolicy {
  allowedMimeTypes: ReadonlySet<string>;
  maxBytes: number;
  errorPrefix: string;
  label: string;
}

export function validateUploadedFile(
  file: Express.Multer.File | undefined,
  policy: UploadPolicy,
): asserts file is Express.Multer.File {
  if (!file)
    throw new BadRequestException({
      code: `${policy.errorPrefix}_FILE_REQUIRED`,
      message: `请选择${policy.label}`,
    });
  if (file.size <= 0 || file.size > policy.maxBytes)
    throw new BadRequestException({
      code: `${policy.errorPrefix}_SIZE_INVALID`,
      message: `${policy.label}大小必须在 ${Math.floor(policy.maxBytes / 1024 / 1024)}MB 以内`,
    });
  if (!policy.allowedMimeTypes.has(file.mimetype))
    throw new BadRequestException({
      code: `${policy.errorPrefix}_MIME_NOT_ALLOWED`,
      message: `不支持该${policy.label}类型`,
    });
  const fileName = safeOriginalFileName(file.originalname);
  const extension = extname(fileName).toLowerCase();
  if (
    !EXTENSIONS_BY_MIME[file.mimetype]?.includes(extension) ||
    !matchesContent(file.mimetype, file.buffer)
  )
    throw new BadRequestException({
      code: `${policy.errorPrefix}_CONTENT_MISMATCH`,
      message: `${policy.label}内容与声明的文件类型不一致`,
    });
}

export function safeOriginalFileName(input: string): string {
  const latin1Decoded = Buffer.from(input, 'latin1').toString('utf8');
  const normalizedInput = latin1Decoded.includes('\uFFFD') ? input : latin1Decoded;
  const fileName = posix.basename(normalizedInput.replaceAll('\\', '/')).trim();
  const containsControlCharacter = [...fileName].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
  if (!fileName || fileName === '.' || fileName === '..' || containsControlCharacter)
    throw new BadRequestException({
      code: 'FILE_NAME_INVALID',
      message: '文件名不合法',
    });
  return fileName;
}

function matchesContent(mimeType: string, buffer: Buffer): boolean {
  if (mimeType === 'application/pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (mimeType === 'image/png')
    return buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === 'image/jpeg')
    return (
      buffer.length >= 4 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer.at(-2) === 0xff &&
      buffer.at(-1) === 0xd9
    );
  if (mimeType === 'application/x-7z-compressed')
    return buffer.subarray(0, 6).equals(Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]));
  if (mimeType === 'application/zip') return isZip(buffer);
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.ms-powerpoint'
  )
    return buffer
      .subarray(0, 8)
      .equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  if (mimeType.includes('wordprocessingml')) return isOpenXml(buffer, 'word/');
  if (mimeType.includes('spreadsheetml')) return isOpenXml(buffer, 'xl/');
  if (mimeType.includes('presentationml')) return isOpenXml(buffer, 'ppt/');
  if (mimeType === 'text/plain' || mimeType === 'text/csv') return isUtf8Text(buffer);
  return false;
}

function isZip(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    ((buffer[2] === 0x03 && buffer[3] === 0x04) ||
      (buffer[2] === 0x05 && buffer[3] === 0x06) ||
      (buffer[2] === 0x07 && buffer[3] === 0x08))
  );
}

function isOpenXml(buffer: Buffer, directory: string): boolean {
  if (!isZip(buffer)) return false;
  const directoryBytes = Buffer.from(directory, 'ascii');
  const contentTypes = Buffer.from('[Content_Types].xml', 'ascii');
  return buffer.includes(directoryBytes) && buffer.includes(contentTypes);
}

function isUtf8Text(buffer: Buffer): boolean {
  if (buffer.includes(0)) return false;
  return !buffer.toString('utf8').includes('\uFFFD');
}
