import fs from 'fs';
import csv from 'csv-parser';
import { PrismaClient } from '@prisma/client';

export abstract class BaseImporter {
  protected prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async processFile(filePath: string) {
    console.log(`Iniciando importación desde: ${filePath}`);
    const results: any[] = [];

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data: any) => results.push(data))
        .on('end', async () => {
          console.log(`Leídas ${results.length} filas.`);
          try {
            await this.importData(results);
            resolve(true);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error: any) => reject(error));
    });
  }

  protected abstract importData(data: any[]): Promise<void>;

  protected async disconnect() {
    await this.prisma.$disconnect();
  }
}
