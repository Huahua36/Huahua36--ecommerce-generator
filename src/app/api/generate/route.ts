import { NextRequest, NextResponse } from 'next/server';

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
    
    const imagePrompts = formData.get('imagePrompts');
    const prompt = imagePrompts ? JSON.parse(imagePrompts as string) : {};
    const productDescription: string = prompt.productDescription || '商品';
    const sellingPoints: string = prompt.sellingPoints || '实用';

    const titles = [
      generateTitle(productDescription, sellingPoints),
      generateTitle(productDescription, sellingPoints),
      generateTitle(productDescription, sellingPoints),
    ];

    const uniqueTitles = [...new Set(titles)].slice(0, 3);
    while (uniqueTitles.length < 3) {
      uniqueTitles.push(`宝藏单品！${productDescription}用了都说好`);
    }

    return NextResponse.json({
      titles: uniqueTitles,
      images: {},
      success: true
    });

  } catch (error) {
    console.error('生成失败:', error);
    return NextResponse.json({
      titles: [
        '宝藏好物！这款商品用了都说好',
        '性价比之王！错过后悔一整年',
        '明星同款！买它绝对不会错',
      ],
      images: {},
      success: true
    });
  }
}
