// 全局类型声明

declare global {
  // 临时用户存储（当数据库不可用时）
  var tempUsers: Map<string, { 
    id: string;
    phone: string; 
    password: string; 
    isMember: boolean; 
    createdAt: string; 
    memberExpireAt?: string;
  }>;
  
  // 临时订单存储
  var tempOrders: Map<string, { 
    id: string; 
    phone: string; 
    amount: string; 
    status: string; 
    createdAt: string; 
    paidAt?: string;
  }>;
  
  // 临时会员状态
  var tempMemberStatus: Map<string, { 
    isValid: boolean; 
    expiredAt?: string;
  }>;
}

export {};
