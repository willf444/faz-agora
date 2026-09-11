import React from 'react';
import { View } from 'react-native';
import Markdown from 'react-native-markdown-display';

const BASE_STYLES = {
  body: { marginTop: 0, marginBottom: 0 },
  paragraph: { marginTop: 0, marginBottom: 0 },
  heading1: { marginTop: 0, marginBottom: 0 },
  heading2: { marginTop: 0, marginBottom: 0 },
  heading3: { marginTop: 0, marginBottom: 0 },
  bullet_list: { marginTop: 0, marginBottom: 0 },
  ordered_list: { marginTop: 0, marginBottom: 0 },
  list_item: { marginTop: 0, marginBottom: 0 },
};

const mergeStyles = (styles = {}) => {
  const merged = { ...BASE_STYLES, ...styles };
  Object.keys(BASE_STYLES).forEach((key) => {
    merged[key] = { ...BASE_STYLES[key], ...(styles[key] || {}) };
  });
  return merged;
};

export default function ExactMarkdown({ children = '', style = {}, onLinkPress }) {
  const lines = String(children).split('\n');
  const lineHeight = style?.body?.lineHeight || 20;
  const exactStyles = mergeStyles(style);

  return (
    <View>
      {lines.map((line, index) => (
        line === ''
          ? <View key={`blank-${index}`} style={{ height: lineHeight }} />
          : (
            <Markdown key={`line-${index}`} style={exactStyles} onLinkPress={onLinkPress}>
              {line}
            </Markdown>
          )
      ))}
    </View>
  );
}
