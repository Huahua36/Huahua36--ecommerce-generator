import { NextRequest, NextResponse } from 'next/server';

// 爆款标题模板库
const TEMPLATES = {
  surprises: [
    '99%的买家都不知道',
    '老外疯抢的',
    '被严重低估的',
    '明星都在用的',
    '小红书爆火的',
  ],
  regulars: [
    '居然只要',
    '性价比逆天的',
    '神仙颜值的',
    '用了就离不开的',
  ],
  reasons: [
    '进口品质国产价格',
    '用了就知道多值',
    '买完不后悔系列',
    '用了再也不换其他',
    '错过等一年',
  ],
};

function generateTitle(product: string, points: string): string {
  const surprise = TEMPLATES.surprises[Math.floor(Math.random() * TEMPLATES.surprises.length)];
  const regular = TEMPLATES.regulars[Math.floor(Math.random() * TEMPLATES.regulars.length)];
  const reason = TEMPLATES.reasons[Math.floor(Math.random() * TEMPLATES.reasons.length)];
  
  return `${surprise}${product}，${regular}${points}，${reason}`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const imagePrompts = formData.get('imageP
