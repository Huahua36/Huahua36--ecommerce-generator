import { NextRequest, NextResponse } from 'next/server';
import { ImageGenerationClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

// 支持的图片尺寸配置
const SUPPORTED_SIZES: Record<string, { apiSize: string; displaySize: string }> = {
  '1340x1787': { apiSize: '2560x3413', displaySize: '1340×1787' },
  '800x800': { apiSize: '2560x2560', displaySize: '800×800' },
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const prompt = formData.get('prompt') as string;
    const imageKey = formData.get('imageKey') as string;
    const imageSizeKey = formData.get('imageSize') as string || '1340x1787';

    if (!imageFile || !prompt) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 获取图片尺寸配置
    const sizeConfig = SUPPORTED_SIZES[imageSizeKey] || SUPPORTED_SIZES['1340x1787'];

    // Convert image to base64
    const imageBuffer = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const mimeType = imageFile.type || 'image/jpeg';
    const dataUri = `data:${mimeType};base64,${base64Image}`;

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();

    // Generate single image using image-to-image
    const imageClient = new ImageGenerationClient(config, customHeaders);
    
    // 使用 API 支持的尺寸
    const apiImageSize = sizeConfig.apiSize;

    const response = await imageClient.generate({
      prompt,
      image: dataUri,
      size: apiImageSize,
      watermark: false,
    });
    
    const helper = imageClient.getResponseHelper(response);
    
    if (helper.success && helper.imageUrls.length > 0) {
      return NextResponse.json({ 
        imageUrl: helper.imageUrls[0],
        imageKey,
        imageSize: sizeConfig.displaySize,
      });
    }
    
    throw new Error('Image generation failed');
  } catch (error) {
    console.error('Regenerate failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '重新生成失败' },
      { status: 500 }
    );
  }
}
