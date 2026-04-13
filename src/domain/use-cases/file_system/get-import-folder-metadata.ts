import fs from 'node:fs/promises';
import path from 'path';
import { GetImportFolderMetadataUseCase } from '../../interfaces/use-cases/file_system/get-import-folder-metadata';
import { ProjectMetadataModel, ProjectMetadataPersonModel } from '../../entities/project';
import { UserRepository } from '../../interfaces/repositories/user-repository';

export class GetImportFolderMetadata implements GetImportFolderMetadataUseCase {
    importFolderPath: string;
    userRepository: UserRepository;

    constructor(importFolderPath: string, userRepository: UserRepository) {
        this.importFolderPath = importFolderPath;
        this.userRepository = userRepository;
    }

    async execute(folder_path: string): Promise<ProjectMetadataModel> {
        // Validate the folder_path is within the import folder
        const fullPath = path.resolve(folder_path);
        const basePath = path.resolve(this.importFolderPath);
        if (!fullPath.startsWith(basePath)) {
            throw new Error('Invalid folder path');
        }

        // Detect instrument type based on directory structure
        const instrumentType = await this.detectInstrumentType(fullPath);

        // Read cruise_info.txt
        const cruiseInfo = await this.readCruiseInfo(fullPath);

        // Read header file for cruise and ship
        const headerInfo = await this.readHeaderFirstLine(fullPath);

        // Deduce instrument model from type + serial number
        const serialNumber = cruiseInfo?.sn || headerInfo?.serialNumber || null;
        const instrumentModel = this.deduceInstrumentModel(instrumentType, serialNumber);

        // Lookup users by email
        const dataOwner = await this.buildPersonModel(cruiseInfo?.do_name, cruiseInfo?.do_email);
        const operator = await this.buildPersonModel(cruiseInfo?.op_name, cruiseInfo?.op_email);
        const chiefScientist = await this.buildPersonModel(cruiseInfo?.cs_name, cruiseInfo?.cs_email);

        return {
            project_acronym: cruiseInfo?.acron || null,
            project_description: cruiseInfo?.description || null,
            cruise: headerInfo?.cruise || cruiseInfo?.acron || null,
            ship: headerInfo?.ship || null,
            serial_number: serialNumber,
            instrument_model: instrumentModel,
            data_owner: dataOwner,
            operator: operator,
            chief_scientist: chiefScientist,
        };
    }

    private async detectInstrumentType(folderPath: string): Promise<'UVP5' | 'UVP6' | null> {
        try {
            await fs.access(path.join(folderPath, 'ecodata'));
            return 'UVP6';
        } catch {
            // Not UVP6
        }
        try {
            await fs.access(path.join(folderPath, 'work'));
            return 'UVP5';
        } catch {
            // Not UVP5
        }
        return null;
    }

    private deduceInstrumentModel(instrumentType: 'UVP5' | 'UVP6' | null, serialNumber: string | null): string | null {
        if (!instrumentType) return null;

        if (instrumentType === 'UVP6' && serialNumber) {
            const snUpper = serialNumber.toUpperCase();
            if (snUpper.endsWith('LP')) return 'UVP6LP';
            if (snUpper.endsWith('MHF')) return 'UVP6MHF';
            if (snUpper.endsWith('MHP')) return 'UVP6MHP';
            if (snUpper.endsWith('HF')) return 'UVP6HF';
        }

        if (instrumentType === 'UVP5' && serialNumber) {
            const snLower = serialNumber.toLowerCase();
            if (snLower.endsWith('hd')) return 'UVP5HD';
            if (snLower.endsWith('sd')) return 'UVP5SD';
            if (snLower.endsWith('zd')) return 'UVP5Z';
        }

        return null;
    }

    private async readCruiseInfo(folderPath: string): Promise<Record<string, string> | null> {
        const cruiseInfoPath = path.join(folderPath, 'config', 'cruise_info.txt');
        try {
            const content = await fs.readFile(cruiseInfoPath, 'utf8');
            const result: Record<string, string> = {};
            const lines = content.split(/\r\n|\n|\r/);
            for (const line of lines) {
                const trimmed = line.trim();
                // Skip section headers and empty lines
                if (!trimmed || trimmed.startsWith('[') || trimmed.startsWith(';') || trimmed.startsWith('#')) continue;
                const eqIndex = trimmed.indexOf('=');
                if (eqIndex > 0) {
                    const key = trimmed.substring(0, eqIndex).trim();
                    const value = trimmed.substring(eqIndex + 1).trim();
                    if (key && value) {
                        result[key] = value;
                    }
                }
            }
            return result;
        } catch {
            return null;
        }
    }

    private async readHeaderFirstLine(folderPath: string): Promise<{ cruise: string; ship: string; serialNumber: string } | null> {
        const metaPath = path.join(folderPath, 'meta');
        try {
            const files = await fs.readdir(metaPath);
            const headerFile = files.find(f => f.includes('header') && f.endsWith('.txt') && !f.includes('backup'));
            if (!headerFile) return null;

            const content = await fs.readFile(path.join(metaPath, headerFile), 'utf8');
            const lines = content.trim().split(/\r\n|\n|\r/);
            if (lines.length < 2) return null;

            // First data row (line index 1)
            const fields = lines[1].split(';');

            // Extract serial number from filename pattern: uvp5_header_sn002zd_omer_2.txt or uvp6_header_sn000241lp_*.txt
            const snMatch = headerFile.match(/sn([^_]+)/i);
            const serialNumber = snMatch ? snMatch[1] : '';

            return {
                cruise: fields[0] || '',
                ship: fields[1] || '',
                serialNumber: serialNumber,
            };
        } catch {
            return null;
        }
    }

    private async buildPersonModel(name: string | undefined, email: string | undefined): Promise<ProjectMetadataPersonModel | null> {
        if (!name && !email) return null;

        let ecopartUserId: number | null = null;
        if (email) {
            try {
                const user = await this.userRepository.getUser({ email });
                if (user) {
                    ecopartUserId = user.user_id;
                }
            } catch {
                // User not found, leave as null
            }
        }

        return {
            name: name || '',
            email: email || '',
            ecopart_user_id: ecopartUserId,
        };
    }
}
