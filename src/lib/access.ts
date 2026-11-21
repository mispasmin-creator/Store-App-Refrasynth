// A "department user" is tied to one department: they only see pages they are explicitly
// permitted (never the open Dashboard/Tracker pages) and only that department's items.
type AccessUser = { department?: string | null } | null | undefined;

export const userDepartment = (user: AccessUser): string => String(user?.department ?? '').trim().toUpperCase();

export const isDepartmentUser = (user: AccessUser): boolean => {
    const department = userDepartment(user);
    return department !== '' && department !== 'ALL';
};

export const departmentMatches = (user: AccessUser, itemDepartment: unknown): boolean =>
    !isDepartmentUser(user) || String(itemDepartment ?? '').trim().toUpperCase() === userDepartment(user);

const hasGate = (user: unknown, gateKey: string) => {
    const value = (user as Record<string, unknown> | null | undefined)?.[gateKey];
    return value === true || value === 'true';
};

/** Whether this user may open a route; open routes (no gateKey) are closed to department users. */
export const canOpenRoute = (user: AccessUser, gateKey?: string): boolean => {
    if (!gateKey) return !isDepartmentUser(user);
    return hasGate(user, gateKey);
};
