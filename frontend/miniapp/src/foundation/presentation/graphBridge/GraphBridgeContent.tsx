import { Fragment } from 'react';

import {
  PresentationGraphContentError,
  isResolvedPresentationGraphContentOwned,
  type ResolvedPresentationGraphContent,
} from './content';

export type PresentationGraphBridgeContentProps = Readonly<{
  content: ResolvedPresentationGraphContent;
}>;

export function PresentationGraphBridgeContent({
  content,
}: PresentationGraphBridgeContentProps) {
  if (!isResolvedPresentationGraphContentOwned(content)) {
    throw new PresentationGraphContentError('INVALID_GRAPH_CONTENT');
  }
  if (content.lines.length === 1) {
    return content.text;
  }
  return (
    <>
      {content.lines.map((line, index) => (
        <Fragment key={`${index}:${line}`}>
          {index === 0 ? null : <br />}
          {line}
        </Fragment>
      ))}
    </>
  );
}
