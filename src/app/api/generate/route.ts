import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File;
    
    if (!image) {
      return NextResponse.json({ error: '请上传图片' }, { status: 400 });
    }

    const API_KEY = process.env.COZE_API_KEY;
    const BOT_ID = process.env.COZE_BOT_ID;

    if (!API_KEY || !BOT_ID) {
      return NextResponse.json({ error: '环境变量未配置' }, { status: 500 });
    }

    // 读取商品分析提示词
    const imagePrompts = formData.get('imagePrompts');
    const prompt = imagePrompts ? JSON.parse(imagePrompts as string) : {};
    const productDescription = prompt.productDescription || '商品';
    const sellingPoints = prompt.sellingPoints || '优质商品';

    // 调用 Coze API
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
            content: `分析这个商品图片，生成3个电商爆款标题，格式要求：\n1. 每个标题包含：反常现象 + 常规现象 + 具体原因\n2. 标题要吸引人，能引发好奇\n3. 适合Temu/跨境电商平台\n\n商品信息：${productDescription}\n卖点：${sellingPoints}`,
            type: 'text'
          }
        ]
      })
    });

    const chatData = await chatResponse.json();
    
    if (chatData.code !== 0) {
      return NextResponse.json({ error: chatData.msg || 'Coze API 调用失败' }, { status: 500 });
    }

    const chatId = chatData.data.chat_id;
    const conversationId = chatData.data.conversation_id;

    // 轮询获取结果
    let result = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const retrieveResponse = await fetch(
        `https://api.coze.com/v3/chat/retrieve?chat_id=${chatId}&conversation_id=${conversationId}`,
        {
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
          }
        }
      );
      
      result = await retrieveResponse.json();
      
      if (result.data?.status === 'completed') {
        break;
      }
    }

    // 提取标题
    const messages = result.data?.messages || [];
    const assistantMessage = messages.find((m: any) => m.role === 'assistant');
    let titles: string[] = [];
    
    if (assistantMessage?.content) {
      const content = assistantMessage.content;
      const lines = content.split('\n').filter((line: string) => line.trim());
      titles = lines.slice(0, 3).map((line: string) => {
        return line.replace(/^\d+[\.\)、]\s*/, '').trim();
      });
    }

    if (titles.length === 0) {
      titles = [
        '99%买家不知道的秘密！这款商品竟然...',
        '老板亏本卖！看到价格我震惊了',
        '为什么都在买？看完你就明白了'
      ];
    }

    return NextResponse.json({
      titles,
      images: {},
      success: true
    });

  } catch (error: any) {
    console.error('生成失败:', error);
    return NextResponse.json({ 
      error: error.message || '生成失败',
      titles: [
        '99%买家不知道的秘密！这款商品竟然...',
        '老板亏本卖！看到价格我震惊了', 
        '为什么都在买？看完你就明白了'
      ],
      images: {}
    }, { status: 200 });
  }
}
