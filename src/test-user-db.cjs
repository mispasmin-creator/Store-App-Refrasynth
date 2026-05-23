const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://uayzjufjncmvszutiboc.supabase.co";
const SUPABASE_KEY = 'sb_publishable_tv7fGzNxIXQuFD7uJ5OcGQ_IY63AIX3';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
    try {
        const { data, error } = await supabase
            .from('user')
            .select('*')
            .limit(1);

        if (error) throw error;
        console.log("COLUMNS:");
        if (data && data.length > 0) {
            console.log(Object.keys(data[0]));
            console.log("SAMPLE RECORD:", data[0]);
        } else {
            console.log("No users found");
        }
    } catch (e) {
        console.error(e);
    }
}

test();
