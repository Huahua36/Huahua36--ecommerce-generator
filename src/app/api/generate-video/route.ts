import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, VideoGenerationClient, Config, HeaderUtils, S3Storage } from 'coze-coding-dev-sdk';

// 初始化对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

// 视频类型配置
const VIDEO_TYPE_CONFIG: Record<string, {
  label: string;
  promptTemplate: string;
}> = {
  'functional': {
    label: '功能型/工具类',
    promptTemplate: 'A person naturally demonstrating the product in a real-life usage scenario. Natural hand movements, smooth and relaxed operation. Casual and confident demeanor. Professional but authentic demonstration style. The person moves naturally and fluidly, showing how to use the product with ease.',
  },
  'apparel': {
    label: '鞋服/饰品/彩妆类',
    promptTemplate: 'A model wearing the product with natural, relaxed posture. Moving gracefully with confident body language. Natural walking motion, turning slowly to show different angles. Relaxed shoulders, natural arm swing. Professional fashion presentation with authentic movement. Shot from neck down, no face visible.',
  },
  'decor': {
    label: '装饰摆设类',
    promptTemplate: 'The product displayed in a beautiful home environment. Camera slowly panning around the product showing different angles. Warm ambient lighting creating cozy atmosphere. Smooth camera movement, cinematic quality. Showcasing the decorative effect and aesthetic appeal.',
  },
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const videoType = formData.get('videoType') as string || 'apparel';
    const videoRatio = formData.get('videoRatio') as string || '3:4';
    const customPrompt = formData.get('prompt') as string || '';
    const productAnalysis = formData.get('productAnalysis') as string || '';

    if (!imageFile) {
      return NextResponse.json(
        { error: '请上传商品图片' },
        { status: 400 }
      );
    }

    // 将图片转换为 buffer
    const imageBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(imageBuffer);
    const mimeType = imageFile.type || 'image/jpeg';

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();

    // 1. 先上传图片到对象存储，获取签名 URL
    console.log('正在上传图片到对象存储...');
    const imageKey = await storage.uploadFile({
      fileContent: buffer,
      fileName: `video-input/${Date.now()}.jpg`, // 统一使用jpg格式
      contentType: 'image/jpeg', // 统一使用jpg的contentType
    });
    
    // 生成签名 URL（有效期 1 小时，足够视频生成使用）
    const imageUrl = await storage.generatePresignedUrl({
      key: imageKey,
      expireTime: 3600,
    });
    console.log('图片上传成功，已生成签名 URL');

    // dataUri 用于 LLM 分析（LLM 支持 base64）
    const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;

    // 如果没有产品分析，先分析图片
    let analysis = productAnalysis;
    if (!analysis) {
      const llmClient = new LLMClient(config, customHeaders);
      
      const analyzeMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string | any[] }> = [
        {
          role: 'system',
          content: 'You are an e-commerce product expert. Analyze the product image and identify: product type, key features, selling points, and ideal use case. Provide a concise description in English for video generation.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this product for video creation. What is the product? What are its key features? How should it be demonstrated?',
            },
            {
              type: 'image_url',
              image_url: {
                url: dataUri,
                detail: 'high',
              },
            },
          ],
        },
      ];

      const analyzeResponse = await llmClient.invoke(analyzeMessages, {
        temperature: 0.7,
        model: 'doubao-seed-1-6-vision-250815',
      });

      analysis = analyzeResponse.content;
    }

    // 构建视频提示词
    const typeConfig = VIDEO_TYPE_CONFIG[videoType] || VIDEO_TYPE_CONFIG['apparel'];
    
    // 视频生成最佳实践提示词
    const qualityEnhancers = [
      'Smooth, natural motion without stiffness',
      'Professional quality, high resolution output',
      'Natural lighting, realistic environment',
      'Authentic human movement and body language',
    ];

    let videoPrompt: string;
    if (customPrompt.trim()) {
      videoPrompt = `${typeConfig.promptTemplate} ${qualityEnhancers.join('. ')}. ${customPrompt.trim()}`;
    } else {
      videoPrompt = `${typeConfig.promptTemplate} ${qualityEnhancers.join('. ')}.`;
    }

    // 生成视频 - 使用图片 URL 作为第一帧
    const videoClient = new VideoGenerationClient(config, customHeaders);
    
    const content = [
      {
        type: 'image_url' as const,
        image_url: {
          url: imageUrl, // 使用签名 URL，而非 base64 data URI
        },
        role: 'first_frame' as const,
      },
      {
        type: 'text' as const,
        text: videoPrompt,
      },
    ];

    // 视频时长：API 支持 4-12 秒，设置 10 秒作为默认
    // 视频比例：支持 3:4 或 1:1
    const ratio = (videoRatio === '1:1' ? '1:1' : '3:4') as '3:4' | '1:1';
    
    console.log('开始生成视频:', {
      videoType,
      ratio,
      duration: 10,
      promptLength: videoPrompt.length,
      imageUrl: imageUrl.substring(0, 100) + '...',
    });

    const response = await videoClient.videoGeneration(content, {
      model: 'doubao-seedance-1-5-pro-251215',
      duration: 10, // 最大支持的合理时长
      ratio, // 支持 3:4 或 1:1
      resolution: '1080p', // 高清分辨率
      watermark: false,
      generateAudio: false, // 不生成音频，静音视频
    });

    console.log('视频生成响应:', {
      videoUrl: response.videoUrl ? '已获取' : '未获取',
      status: response.response?.status,
      error: response.response?.error_message,
    });

    if (!response.videoUrl) {
      const errorMsg = response.response?.error_message || '视频生成失败，API未返回视频URL';
      throw new Error(errorMsg);
    }

    return NextResponse.json({
      success: true,
      videoUrl: response.videoUrl,
      videoType: typeConfig.label,
      prompt: videoPrompt,
    });
  } catch (error) {
    console.error('视频生成失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '视频生成失败，请稍后重试' },
      { status: 500 }
    );
  }
}
