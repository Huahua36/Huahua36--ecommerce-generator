import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Temu 上新助手',
    template: '%s | Temu 上新助手',
  },
  description:
    'AI 驱动的电商内容生成工具，一键生成爆款标题和营销素材',
  keywords: [
    'Temu',
    '电商',
    '标题生成',
    'AI',
    '营销图片',
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`antialiased`}>
        {children}
      </body>
    </html>
  );
}
