import React, { useMemo } from 'react';
import { Platform, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

interface DynamicSvgIconProps {
  svg?: string | null;
  size?: number;
  color?: string;
  fallback?: React.ReactNode;
}

function sanitizeSvg(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/<svg\b([^>]*)>/i, (_match, attrs: string) => {
      const cleanedAttrs = attrs
        .replace(/\s(width|height)=["'][^"']*["']/gi, '')
        .trim();
      return `<svg ${cleanedAttrs} width="100%" height="100%" style="display:block">`;
    });
}

export const DynamicSvgIcon: React.FC<DynamicSvgIconProps> = ({
  svg,
  size = 16,
  color = '#D70F64',
  fallback = null,
}) => {
  const safeSvg = useMemo(() => {
    if (!svg || !svg.includes('<svg')) return '';
    return sanitizeSvg(svg.trim());
  }, [svg]);

  if (!safeSvg) {
    return <>{fallback}</>;
  }

  if (Platform.OS === 'web') {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: size,
            height: size,
            color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          dangerouslySetInnerHTML={{ __html: safeSvg }}
        />
      </View>
    );
  }

  return <SvgXml xml={safeSvg} width={size} height={size} color={color} />;
};
