import { NextRequest, NextResponse } from 'next/server';

const API_KEY = 'pat_FpM87BK5JN6H9ZGGrQkle072RmdYu223B1INtEOzSbeSDNtsmrBYYE2Ml4RhWhrB';
const BOT_ID = '7628579337629040693';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imagePrompts = formData.get('imagePrompts');
    const prompt = imagePrompts ? JSON.parse(imagePrompts as string) : {};
    const productDescription = prompt.productDescription || '商品';

    const chatResponse = await fetch('https://api.coze.com/v3/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bot_id: BOT_ID,
        user_id: 'user_' + Date.now(),
        stream: false,
        auto_save_history: true,
        additional_messages: [],
        messages: [
          {
            role: 'user',
            content: `为这个商品生成图片描述：${productDescription}`,
            type: 'text'
          }
        ]
      })
    });

    const chatData = await chatResponse.json();
    
    return NextResponse.json({
      success: true,
      message: '图片重新生成功能开发中'
    });

  } catch (error: any) {
    console.error('生成失败:', error);
    return NextResponse.json({ 
      error: error.message || '生成失败' 
    }, { status: 200 });
  }
}
