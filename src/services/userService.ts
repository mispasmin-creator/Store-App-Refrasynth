import { supabase } from '@/lib/supabase';
import { allPermissionKeys, type UserPermissions } from '@/types/sheets';

/**
 * User Service
 * Handles all Supabase operations for user management and administration.
 */

export interface UserRecord extends UserPermissions {
    id: number;
    timestamp: string;
}

/**
 * Fetch all users from Supabase
 */
export async function fetchUsers(): Promise<UserRecord[]> {
    try {
        const { data, error } = await supabase
            .from('user')
            .select('*')
            .order('timestamp', { ascending: false });

        if (error) throw error;

        return (data || []).map((r: any) => {
            const user: any = {
                id: r.id,
                timestamp: r.timestamp || '',
                username: r.user_name || '',
                password: r.password || '',
                name: r.name || '',
                firmNameMatch: r.firm_name_match || '',
                department: r.department || '',
                rowIndex: r.id, // Using ID as a fallback for rowIndex since it's used in and out of tables
            };

            // Map each permission key from snake_case in DB to camelCase in UserPermissions
            allPermissionKeys.forEach((key) => {
                const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
                const value = r[dbKey];

                // Handle "true"/"TRUE"/true results
                user[key] = value === true ||
                    (typeof value === 'string' && value.toLowerCase() === 'true');
            });

            return user as UserRecord;
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
    }
}

/**
 * Create a new user in Supabase
 */
export async function createUser(userData: Partial<UserPermissions>) {
    try {
        const dbRow: any = {
            user_name: userData.username,
            name: userData.name,
            password: userData.password,
            firm_name_match: userData.firmNameMatch || '',
            department: (userData.department || '').trim(),
            timestamp: new Date().toISOString(),
        };

        // Map camelCase permissions to snake_case for DB
        allPermissionKeys.forEach(key => {
            const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            const value = userData[key as keyof UserPermissions];
            dbRow[dbKey] = String(value || false).toUpperCase();
        });

        const { data, error } = await supabase
            .from('user')
            .insert([dbRow])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
}

/**
 * Update an existing user in Supabase
 */
export async function updateUser(id: number, userData: Partial<UserPermissions>) {
    try {
        const dbRow: any = {
            user_name: userData.username,
            name: userData.name,
            password: userData.password,
            firm_name_match: userData.firmNameMatch || '',
            department: (userData.department || '').trim(),
        };

        // Map camelCase permissions to snake_case for DB
        allPermissionKeys.forEach(key => {
            const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            const value = userData[key as keyof UserPermissions];
            if (value !== undefined) {
                dbRow[dbKey] = String(value).toUpperCase();
            } else {
                dbRow[dbKey] = 'FALSE';
            }
        });

        const { error } = await supabase
            .from('user')
            .update(dbRow)
            .eq('id', id);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error updating user:', error);
        throw error;
    }
}

/**
 * Delete a user from Supabase
 */
export async function deleteUser(id: number) {
    try {
        const { error } = await supabase
            .from('user')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error deleting user:', error);
        throw error;
    }
}
/**
 * Authenticate a user with username and password
 */
export async function authenticateUser(username: string, password: string): Promise<UserRecord | null> {
    try {
        const { data, error } = await supabase
            .from('user')
            .select('*')
            .eq('user_name', username)
            .eq('password', password)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // No rows found
            throw error;
        }

        if (!data) return null;

        const r = data;
        const user: any = {
            id: r.id,
            timestamp: r.timestamp || '',
            username: r.user_name || '',
            password: r.password || '',
            name: r.name || '',
            firmNameMatch: r.firm_name_match || '',
            department: r.department || '',
            rowIndex: r.id,
        };

        // Map permission keys
        allPermissionKeys.forEach((key) => {
            const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            const value = r[dbKey];
            user[key] = value === true ||
                (typeof value === 'string' && value.toLowerCase() === 'true');
        });

        return user as UserRecord;
    } catch (error) {
        console.error('Error authenticating user:', error);
        return null;
    }
}
/**
 * Fetch a user by username (for session restoration)
 */
export async function getUserByUsername(username: string): Promise<UserRecord | null> {
    try {
        const { data, error } = await supabase
            .from('user')
            .select('*')
            .eq('user_name', username)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }

        if (!data) return null;

        const r = data;
        const user: any = {
            id: r.id,
            timestamp: r.timestamp || '',
            username: r.user_name || '',
            password: r.password || '',
            name: r.name || '',
            firmNameMatch: r.firm_name_match || '',
            department: r.department || '',
            rowIndex: r.id,
        };

        // Map permission keys
        allPermissionKeys.forEach((key) => {
            const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            const value = r[dbKey];
            user[key] = value === true ||
                (typeof value === 'string' && value.toLowerCase() === 'true');
        });

        return user as UserRecord;
    } catch (error) {
        console.error('Error fetching user by username:', error);
        return null;
    }
}

/**
 * Departments a department user can be tied to (from indents and the master list).
 */
export async function fetchDepartments(): Promise<string[]> {
    try {
        const [indents, master] = await Promise.all([
            supabase.from('indent').select('department'),
            supabase.from('master').select('department'),
        ]);
        const names = [...(indents.data || []), ...(master.data || [])]
            .map((r: any) => String(r.department || '').trim().toUpperCase())
            .filter(Boolean);
        return Array.from(new Set(names)).sort();
    } catch (error) {
        console.error('Error fetching departments:', error);
        return [];
    }
}
