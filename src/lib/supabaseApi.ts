import { supabase } from './supabaseClient';

const supabaseApi = {
  // USERS CRUD
  async fetchUsers() {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    return data;
  },
  async createUser(user: any) {
    const { data, error } = await supabase.from('users').insert([user]).select();
    if (error) throw error;
    return data?.[0];
  },
  async updateUser(id: string, updates: any) {
    const { data, error } = await supabase.from('users').update(updates).eq('id', id).select();
    if (error) throw error;
    return data?.[0];
  },
  async deleteUser(id: string) {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // MATES CRUD
  async fetchMates(userId: string) {
    const { data, error } = await supabase
      .from('mates')
      .select('*, mate:users!mates_mate_id_fkey(*)')
      .eq('user_id', userId);
    if (error) throw error;
    return data;
  },
  async createMate(mate: any) {
    const { data, error } = await supabase.from('mates').insert([mate]).select();
    if (error) throw error;
    return data?.[0];
  },
  async updateMate(id: string, updates: any) {
    const { data, error } = await supabase.from('mates').update(updates).eq('id', id).select();
    if (error) throw error;
    return data?.[0];
  },
  async deleteMate(id: string) {
    const { error } = await supabase.from('mates').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // NUJS CRUD
  async fetchNUJs(userId: string) {
    const { data, error } = await supabase
      .from('nujs')
      .select('*')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`);
    if (error) throw error;
    return data;
  },
  async createNUJ(nuj: any) {
    const { data, error } = await supabase.from('nujs').insert([nuj]).select();
    if (error) throw error;
    return data?.[0];
  },
  async updateNUJ(id: string, updates: any) {
    const { data, error } = await supabase.from('nujs').update(updates).eq('id', id).select();
    if (error) throw error;
    return data?.[0];
  },
  async deleteNUJ(id: string) {
    const { error } = await supabase.from('nujs').delete().eq('id', id);
    if (error) throw error;
    return true;
  },
};

export default supabaseApi;