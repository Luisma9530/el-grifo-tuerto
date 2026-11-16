import React from 'react';
import { parseInline } from '../utils/richText';

/** Renders narration text with **bold** and *italic* (line breaks are kept by the parent's CSS). */
export default function RichText({ text }) {
  return parseInline(text).map((token, i) => {
    if (token.type === 'bold') return <strong key={i} className="font-bold">{token.text}</strong>;
    if (token.type === 'italic') return <em key={i}>{token.text}</em>;
    return <React.Fragment key={i}>{token.text}</React.Fragment>;
  });
}
