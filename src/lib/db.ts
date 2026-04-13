import { getSupabaseClient } from '@/lib/supabase-client';

/**
 * Database helper functions for user management and membership validation
 */

// Admin credentials
const ADMIN_PHONE = '19511999559';
const ADMIN_PASSWORD = 'Gaoqian888';

// Types
export interface User {
  id: number | string;
  phone: string;
  password?: string;
  isAdmin?: boolean;
  isMember: boolean;
  memberExpireAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MemberOrder {
  id: number | string;
  userId: number | string;
  phone: string;
  amount: string;
  status: 'pending' | 'paid' | 'expired';
  paymentMethod?: string;
  paymentAccount?: string;
  createdAt?: string;
  paidAt?: string;
}

/**
 * Verify login credentials
 */
export async function verifyLogin(phone: string, password: string): Promise<{ 
  success: boolean; 
  user?: User; 
  error?: string;
  isAdmin?: boolean;
}> {
  // Trim inputs
  const cleanPhone = phone.trim();
  const cleanPassword = password.trim();
  
  // Check if admin login
  if (cleanPhone === ADMIN_PHONE && cleanPassword === ADMIN_PASSWORD) {
    return {
      success: true,
      isAdmin: true,
      user: {
        id: 'admin',
        phone: ADMIN_PHONE,
        password: ADMIN_PASSWORD,
        isAdmin: true,
        isMember: true,
        memberExpireAt: '2099-12-31',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  }

  // Check regular user
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone', cleanPhone)
      .eq('password', cleanPassword)
      .single();

    if (!error && data) {
      return {
        success: true,
        isAdmin: false,
        user: data as User,
      };
    }
  } catch {
    // Database query failed, check temp storage
  }

  // Check temp storage (fallback for when database is not available)
  if (globalThis.tempUsers) {
    const tempUser = globalThis.tempUsers.get(cleanPhone);
    if (tempUser && tempUser.password === cleanPassword) {
      return {
        success: true,
        isAdmin: false,
        user: tempUser,
      };
    }
  }

  return { success: false, error: '手机号或密码错误' };
}

/**
 * Check if user has valid membership
 */
export async function checkMembership(userId: string | number): Promise<{
  isValid: boolean;
  expiredAt?: Date;
  remainingDays?: number;
}> {
  // Admin always has valid membership
  if (userId === 'admin') {
    return {
      isValid: true,
      expiredAt: new Date('2099-12-31'),
      remainingDays: 99999,
    };
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('isMember, memberExpireAt')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return { isValid: false };
    }

    const user = data as Partial<User>;
    const now = new Date();
    const expiredAt = user.memberExpireAt ? new Date(user.memberExpireAt) : null;

    if (user.isMember && expiredAt && expiredAt > now) {
      const remainingMs = expiredAt.getTime() - now.getTime();
      const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
      return {
        isValid: true,
        expiredAt,
        remainingDays,
      };
    }

    return { isValid: false };
  } catch {
    return { isValid: false };
  }
}

/**
 * Register a new user
 */
export async function registerUser(phone: string, password: string): Promise<{
  success: boolean;
  user?: User;
  error?: string;
}> {
  try {
    const supabase = getSupabaseClient();

    // Check if phone already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('phone', phone)
      .single();

    if (existing) {
      return { success: false, error: '该手机号已注册' };
    }

    // Create new user
    const { data, error } = await supabase
      .from('users')
      .insert({
        phone,
        password,
        isMember: false,
      })
      .select()
      .single();

    if (error || !data) {
      return { success: false, error: '注册失败，请稍后重试' };
    }

    return { success: true, user: data as User };
  } catch {
    return { success: false, error: '注册失败，请稍后重试' };
  }
}

/**
 * Create a membership order
 */
export async function createMemberOrder(userId: string | number): Promise<{
  success: boolean;
  order?: MemberOrder;
  error?: string;
}> {
  try {
    const supabase = getSupabaseClient();
    
    // Get user phone
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('phone')
      .eq('id', userId)
      .single();
    
    if (userError || !userData) {
      return { success: false, error: '用户不存在' };
    }

    const { data, error } = await supabase
      .from('member_orders')
      .insert({
        userId: Number(userId),
        phone: (userData as { phone: string }).phone,
        amount: '3.88',
        status: 'pending',
        paymentMethod: 'alipay',
        paymentAccount: ADMIN_PHONE,
      })
      .select()
      .single();

    if (error || !data) {
      return { success: false, error: '创建订单失败' };
    }

    return { success: true, order: data as MemberOrder };
  } catch {
    return { success: false, error: '创建订单失败' };
  }
}

/**
 * Update order status (for manual verification by admin)
 */
export async function updateOrderStatus(orderId: string | number, status: 'paid' | 'expired'): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = getSupabaseClient();

    // Get order details
    const { data: order, error: fetchError } = await supabase
      .from('member_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return { success: false, error: '订单不存在' };
    }

    // Update order status
    const updateData: Record<string, unknown> = {
      status,
      updatedAt: new Date().toISOString(),
    };

    if (status === 'paid') {
      updateData.paidAt = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('member_orders')
      .update(updateData)
      .eq('id', orderId);

    if (updateError) {
      return { success: false, error: '更新订单失败' };
    }

    // If paid, update user membership
    if (status === 'paid') {
      const memberOrder = order as MemberOrder;
      const expiredAt = new Date();
      expiredAt.setMonth(expiredAt.getMonth() + 1);

      await supabase
        .from('users')
        .update({
          isMember: true,
          memberExpireAt: expiredAt.toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .eq('id', memberOrder.userId);
    }

    return { success: true };
  } catch {
    return { success: false, error: '更新订单失败' };
  }
}

/**
 * Get user's orders
 */
export async function getUserOrders(userId: string | number): Promise<MemberOrder[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('member_orders')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data as MemberOrder[];
  } catch {
    return [];
  }
}

/**
 * Get all pending orders (for admin)
 */
export async function getPendingOrders(): Promise<MemberOrder[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('member_orders')
      .select('*, users(phone)')
      .eq('status', 'pending')
      .order('createdAt', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data as MemberOrder[];
  } catch {
    return [];
  }
}

export { ADMIN_PHONE };
