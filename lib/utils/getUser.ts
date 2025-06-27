import { createClient } from "../supabase/client";

export const getUser = async () => {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if(error) return null;
    return user;
}