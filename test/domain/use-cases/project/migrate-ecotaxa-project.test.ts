import { MigrateEcotaxaProject } from '../../../../src/domain/use-cases/project/migrate-ecotaxa-project';
import { UserUpdateModel } from '../../../../src/domain/entities/user';
import { PublicProjectResponseModel } from '../../../../src/domain/entities/project';
import { SearchResult } from '../../../../src/domain/entities/search';
import { PublicSampleModel } from '../../../../src/domain/entities/sample';
import { ProjectRepository } from '../../../../src/domain/interfaces/repositories/project-repository';
import { SampleRepository } from '../../../../src/domain/interfaces/repositories/sample-repository';
import { PrivilegeRepository } from '../../../../src/domain/interfaces/repositories/privilege-repository';
import { UserRepository } from '../../../../src/domain/interfaces/repositories/user-repository';
import { EcotaxaAccountRepository } from '../../../../src/domain/interfaces/repositories/ecotaxa_account-repository';
import { MockProjectRepository } from '../../../mocks/project-mock';
import { MockSampleRepository } from '../../../mocks/sample-mock';
import { MockPrivilegeRepository } from '../../../mocks/privilege-mock';
import { MockUserRepository, MockEcotaxaAccountRepository } from '../../../mocks/user-mock';

describe('Migrate EcoTaxa Project Use Case', () => {
    let mockUserRepository: UserRepository;
    let mockProjectRepository: ProjectRepository;
    let mockSampleRepository: SampleRepository;
    let mockPrivilegeRepository: PrivilegeRepository;
    let mockEcotaxaAccountRepository: EcotaxaAccountRepository;

    beforeEach(() => {
        jest.clearAllMocks();
        mockUserRepository = new MockUserRepository();
        mockProjectRepository = new MockProjectRepository();
        mockSampleRepository = new MockSampleRepository();
        mockPrivilegeRepository = new MockPrivilegeRepository();
        mockEcotaxaAccountRepository = new MockEcotaxaAccountRepository();
    });

    test('matches samples already marked as imported when they exist in EcoTaxa', async () => {
        const current_user: UserUpdateModel = { user_id: 1 };
        const project = {
            project_id: 10,
            project_creation_utc_date_time: '2026-05-12 12:43:47',
            root_folder_path: 'remote/ftp_plankton/Ecotaxa_Data_to_import/uvp5_sn002zd_omer_2',
            project_title: 'uvp5_sn002zd_omer_2',
            project_acronym: 'omer',
            project_description: 'eee',
            cruise: 'sn002zd_omer_2',
            ship: 'europe',
            data_owner_name: 'lars stemmann',
            data_owner_email: 'lars.stemmann@sorbonne-universite.fr',
            operator_name: 'lars stemmann',
            operator_email: 'lars.stemmann@sorbonne-universite.fr',
            chief_scientist_name: 'lars stemmann',
            chief_scientist_email: 'lars.stemmann@sorbonne-universite.fr',
            override_depth_offset: 0,
            enable_descent_filter: true,
            privacy_duration: 2,
            visible_duration: 24,
            public_duration: 36,
            instrument_model: 'UVP5Z',
            serial_number: '002zd',
            ecotaxa_project_id: 18890,
            ecotaxa_project_name: 'uvp5_sn002zd_omer_2',
            ecotaxa_instance_id: 3,
            last_backup_utc_date_time: null,
        } as PublicProjectResponseModel;

        const ecotaxaSamples = [
            { sampleid: 101, orig_id: 'omer2_1' },
            { sampleid: 102, orig_id: 'omer2_2' },
        ];

        const ecopartSamples: SearchResult<PublicSampleModel> = {
            total: 4,
            items: [
                { sample_id: 1, sample_name: 'omer2_1', ecotaxa_sample_imported: true } as PublicSampleModel,
                { sample_id: 2, sample_name: 'omer2_2', ecotaxa_sample_imported: true } as PublicSampleModel,
                { sample_id: 3, sample_name: 'omer2_3', ecotaxa_sample_imported: false } as PublicSampleModel,
                { sample_id: 4, sample_name: 'omer2_4', ecotaxa_sample_imported: false } as PublicSampleModel,
            ],
        };

        jest.spyOn(mockUserRepository, 'ensureUserCanBeUsed').mockResolvedValueOnce(undefined);
        jest.spyOn(mockUserRepository, 'isAdmin').mockResolvedValueOnce(true);
        jest.spyOn(mockProjectRepository, 'getProject').mockResolvedValue(project);
        jest.spyOn(mockProjectRepository, 'ensureEcotaxaProjectNotLinkedToAnotherEcopartProject').mockResolvedValueOnce(undefined);
        jest.spyOn(mockProjectRepository, 'standardUpdateProject').mockResolvedValueOnce(1);
        jest.spyOn(mockProjectRepository, 'toPublicProject').mockReturnValue(project);
        jest.spyOn(mockPrivilegeRepository, 'getPublicPrivileges').mockResolvedValueOnce({} as never);
        jest.spyOn(mockSampleRepository, 'standardGetSamples').mockResolvedValueOnce(ecopartSamples);
        jest.spyOn(mockSampleRepository, 'createManyEcoTaxaSamples').mockResolvedValueOnce(2);
        jest.spyOn(mockEcotaxaAccountRepository, 'getOneEcoTaxaInstance').mockResolvedValueOnce({ ecotaxa_instance_id: 3, ecotaxa_instance_url: 'https://ecotaxa.example/' } as any);
        jest.spyOn(mockEcotaxaAccountRepository, 'getEcotaxaGenericAccountForInstance').mockResolvedValueOnce({ ecotaxa_account_token: 'token' } as any);
        jest.spyOn(mockEcotaxaAccountRepository, 'linkEcotaxaProjectWithTransientCredentials').mockResolvedValueOnce({ ecotaxa_project_id: 18890, ecotaxa_project_name: 'uvp5_sn002zd_omer_2' });
        jest.spyOn(mockEcotaxaAccountRepository, 'api_ecotaxa_get_samples_in_project').mockResolvedValueOnce(ecotaxaSamples);

        const useCase = new MigrateEcotaxaProject(
            mockUserRepository,
            mockProjectRepository,
            mockSampleRepository,
            mockPrivilegeRepository,
            mockEcotaxaAccountRepository,
        );

        const result = await useCase.execute(current_user, 10, {
            ecotaxa_project_id: 18890,
            ecotaxa_instance_id: 3,
            ecotaxa_user_login: 'admin@example.org',
            ecotaxa_user_password: 'secret',
        });

        expect(result.matched_samples).toEqual(['omer2_1', 'omer2_2']);
        expect(result.unmatched_samples).toEqual(['omer2_3', 'omer2_4']);
        expect(result.ecotaxa_only_samples).toEqual([]);
        expect(mockSampleRepository.standardGetSamples).toHaveBeenCalledWith(
            expect.objectContaining({
                filter: [{ field: 'project_id', operator: '=', value: 10 }],
            }),
        );
    });
});