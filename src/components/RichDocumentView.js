import React from 'react';
import { Linking, Text } from 'react-native';

import { normalizeRichDocument } from '../utils/richDocument';

const BODY_LINE_HEIGHT = 20;

export default function RichDocumentView({ document, completed = false, color = '#d4d4d4' }) {
  const blocks = normalizeRichDocument(document).blocks;
  const renderRuns = (runs, blockIndex) => runs.map((run, runIndex) => (
    <Text
      key={`${blockIndex}-${runIndex}`}
      onPress={run.link ? () => Linking.openURL(run.link) : undefined}
      style={{
        fontWeight: run.bold ? '700' : '400',
        fontStyle: run.italic ? 'italic' : 'normal',
        includeFontPadding: false,
        color: run.link ? '#86efac' : color,
        textDecorationLine: run.link ? 'underline' : completed ? 'line-through' : 'none',
      }}
    >
      {run.text}
    </Text>
  ));

  return (
    <Text
      style={{
        color,
        fontSize: 14,
        lineHeight: BODY_LINE_HEIGHT,
        includeFontPadding: false,
        textDecorationLine: completed ? 'line-through' : 'none',
      }}
    >
      {blocks.map((block, index) => {
        const headingLevel = block.type.startsWith('heading') ? Number(block.type.slice(-1)) : 0;
        return (
          <React.Fragment key={`block-${index}`}>
            {index > 0 ? '\n' : null}
            {block.type === 'blank' ? (
              <Text>{'\u200b'}</Text>
            ) : (
              <Text
                style={{
                  color,
                  fontSize: headingLevel === 1 ? 20 : headingLevel === 2 ? 17 : 14,
                  lineHeight: headingLevel === 1 ? 24 : headingLevel === 2 ? 22 : BODY_LINE_HEIGHT,
                  includeFontPadding: false,
                  fontWeight: headingLevel ? '700' : '400',
                  textDecorationLine: completed ? 'line-through' : 'none',
                }}
              >
                {block.type === 'list_item' ? '• ' : null}
                {renderRuns(block.runs, index)}
              </Text>
            )}
          </React.Fragment>
        );
      })}
    </Text>
  );
}
