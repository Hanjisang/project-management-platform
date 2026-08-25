import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  safeOriginalFileName,
  SOP_TEMPLATE_MIME_TYPES,
  validateUploadedFile,
} from './file-validation';

function file(name: string, mimetype: string, buffer: Buffer): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: name,
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    buffer,
    destination: '',
    filename: '',
    path: '',
    stream: undefined as never,
  };
}

function validate(input: Express.Multer.File): void {
  validateUploadedFile(input, {
    allowedMimeTypes: SOP_TEMPLATE_MIME_TYPES,
    maxBytes: 50 * 1024 * 1024,
    errorPrefix: 'SOP_TEMPLATE',
    label: '模板文件',
  });
}

describe('uploaded file validation', () => {
  it.each([
    ['demo.pdf', 'application/pdf', Buffer.from('%PDF-1.7\n')],
    ['demo.txt', 'text/plain', Buffer.from('hello')],
    ['demo.csv', 'text/csv', Buffer.from('a,b\n1,2')],
    ['demo.zip', 'application/zip', Buffer.from([0x50, 0x4b, 0x03, 0x04])],
    ['demo.7z', 'application/x-7z-compressed', Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])],
    [
      'demo.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      Buffer.concat([
        Buffer.from([0x50, 0x4b, 0x03, 0x04]),
        Buffer.from('[Content_Types].xml word/'),
      ]),
    ],
    [
      'demo.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      Buffer.concat([
        Buffer.from([0x50, 0x4b, 0x03, 0x04]),
        Buffer.from('[Content_Types].xml xl/'),
      ]),
    ],
  ])('accepts content-verified %s', (name, mimeType, content) => {
    expect(() => validate(file(name, mimeType, content))).not.toThrow();
  });

  it('rejects a fake PDF even when MIME and extension claim PDF', () => {
    expect(() => validate(file('fake.pdf', 'application/pdf', Buffer.from('not a pdf')))).toThrow(
      BadRequestException,
    );
  });

  it('rejects extension and MIME mismatches', () => {
    expect(() => validate(file('fake.txt', 'application/pdf', Buffer.from('%PDF-1.7')))).toThrow(
      BadRequestException,
    );
  });

  it('reduces user paths to a safe display file name', () => {
    expect(safeOriginalFileName('../../folder/template.docx')).toBe('template.docx');
    expect(safeOriginalFileName('C:\\folder\\template.xlsx')).toBe('template.xlsx');
  });

  it('restores UTF-8 names decoded as latin1 by multipart parsers', () => {
    const mojibake = Buffer.from('接口验收单.docx').toString('latin1');
    expect(safeOriginalFileName(mojibake)).toBe('接口验收单.docx');
  });
});
