
// define an example of project entities to use in the tests

import { PublicPrivilege } from "../../src/domain/entities/privilege"
import { MinimalUserModel } from "../../src/domain/entities/user"

export const publicPrivileges: PublicPrivilege = {
    project_id: 1,
    managers: [{ user_id: 1 } as MinimalUserModel],
    members: [],
    contact: { user_id: 1 } as MinimalUserModel
}