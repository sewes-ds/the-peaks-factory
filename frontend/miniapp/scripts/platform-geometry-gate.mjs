export const PLATFORM_ROOT_GEOMETRY_CONTRACT = 'PGR-1';

/**
 * Domain-neutral physical geometry inspection used by synthetic, browser-fixture,
 * and production-entrypoint qualification. The function is deliberately
 * self-contained so the exact implementation can also be evaluated through CDP.
 */
export function inspectPlatformGeometry(documentRef = document, windowRef = window, options = {}) {
  const tolerance = options.tolerance ?? 0.5;
  const expectedContract = options.expectedNormalizationContract ?? null;
  const rootSelectors = options.rootSelectors ?? ['#root', '.miniapp-shell', 'main'];
  const failures = [];
  const documentElement = documentRef.documentElement;
  const body = documentRef.body;
  const viewportWidth = documentElement.clientWidth;
  const rect = (element) => {
    const value = element.getBoundingClientRect();
    return {
      left: value.left,
      right: value.right,
      top: value.top,
      bottom: value.bottom,
      width: value.width,
      height: value.height,
    };
  };
  const number = (value) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const label = (element) => {
    if (element.id) return `#${element.id}`;
    const tag = element.tagName.toLowerCase();
    const classes = [...element.classList].slice(0, 3);
    return classes.length === 0 ? tag : `${tag}.${classes.join('.')}`;
  };
  const addFailure = (code, target, details = {}) => {
    failures.push(`${code}:${target}:${JSON.stringify(details)}`);
  };

  const documentMetrics = {
    viewport_inner_width: windowRef.innerWidth,
    document_client_width: viewportWidth,
    document_scroll_width: documentElement.scrollWidth,
    body_client_width: body.clientWidth,
    body_scroll_width: body.scrollWidth,
  };
  if (documentElement.scrollWidth > viewportWidth + tolerance) {
    addFailure('document-scroll-width', 'html', {
      scrollWidth: documentElement.scrollWidth,
      clientWidth: viewportWidth,
    });
  }
  if (body.scrollWidth > viewportWidth + tolerance) {
    addFailure('body-scroll-width', 'body', {
      scrollWidth: body.scrollWidth,
      viewportWidth,
    });
  }

  const htmlStyle = windowRef.getComputedStyle(documentElement);
  const bodyStyle = windowRef.getComputedStyle(body);
  const rootElement = documentRef.querySelector('#root');
  const rootStyle = rootElement === null ? null : windowRef.getComputedStyle(rootElement);
  const actualContract = htmlStyle
    .getPropertyValue('--peaks-platform-root-geometry-contract')
    .trim()
    .replace(/^['"]|['"]$/g, '');
  const normalization = {
    expected_contract: expectedContract,
    actual_contract: actualContract,
    html_margin: [htmlStyle.marginTop, htmlStyle.marginRight, htmlStyle.marginBottom, htmlStyle.marginLeft],
    html_padding: [htmlStyle.paddingTop, htmlStyle.paddingRight, htmlStyle.paddingBottom, htmlStyle.paddingLeft],
    body_margin: [bodyStyle.marginTop, bodyStyle.marginRight, bodyStyle.marginBottom, bodyStyle.marginLeft],
    body_padding: [bodyStyle.paddingTop, bodyStyle.paddingRight, bodyStyle.paddingBottom, bodyStyle.paddingLeft],
    root_margin: rootStyle === null
      ? null
      : [rootStyle.marginTop, rootStyle.marginRight, rootStyle.marginBottom, rootStyle.marginLeft],
    root_padding: rootStyle === null
      ? null
      : [rootStyle.paddingTop, rootStyle.paddingRight, rootStyle.paddingBottom, rootStyle.paddingLeft],
    scrollbar_gutter: htmlStyle.scrollbarGutter,
  };
  if (expectedContract !== null && actualContract !== expectedContract) {
    addFailure('normalization-contract', 'html', { expectedContract, actualContract });
  }
  if (expectedContract !== null) {
    for (const [target, values] of [
      ['html-margin', normalization.html_margin],
      ['html-padding', normalization.html_padding],
      ['body-margin', normalization.body_margin],
      ['body-padding', normalization.body_padding],
      ['root-margin', normalization.root_margin ?? []],
      ['root-padding', normalization.root_padding ?? []],
    ]) {
      if (values.length !== 4 || values.some((value) => number(value) !== 0)) {
        addFailure('normalization-spacing', target, { values });
      }
    }
  }

  const significantElements = [];
  const seen = new Set();
  for (const selector of rootSelectors) {
    for (const element of documentRef.querySelectorAll(selector)) {
      if (!seen.has(element)) {
        seen.add(element);
        significantElements.push(element);
      }
    }
  }
  const significantRoots = significantElements.map((element) => {
    const bounds = rect(element);
    const style = windowRef.getComputedStyle(element);
    const parent = element.parentElement;
    const parentBounds = parent === null ? null : rect(parent);
    const parentStyle = parent === null ? null : windowRef.getComputedStyle(parent);
    const parentContent = parentBounds === null || parentStyle === null
      ? null
      : {
          left: parentBounds.left + number(parentStyle.borderLeftWidth) + number(parentStyle.paddingLeft),
          right: parentBounds.right - number(parentStyle.borderRightWidth) - number(parentStyle.paddingRight),
        };
    const target = label(element);
    if (bounds.left < -tolerance || bounds.right > viewportWidth + tolerance) {
      addFailure('significant-root-viewport-bounds', target, { bounds, viewportWidth });
    }
    const normalFlow = style.position !== 'fixed' && style.position !== 'absolute';
    if (normalFlow && parentContent !== null && (
      bounds.left < parentContent.left - tolerance ||
      bounds.right > parentContent.right + tolerance
    )) {
      addFailure('significant-root-containing-block', target, { bounds, parentContent });
    }
    if (style.transform !== 'none') {
      addFailure('significant-root-transform', target, { transform: style.transform, bounds });
    }
    return {
      target,
      position: style.position,
      transform: style.transform,
      bounds,
      parent_content_bounds: parentContent,
      client_width: element.clientWidth,
      scroll_width: element.scrollWidth,
    };
  });

  const positionedElements = [...documentRef.querySelectorAll('*')]
    .map((element) => ({ element, style: windowRef.getComputedStyle(element) }))
    .filter(({ element, style }) => {
      if (style.position !== 'fixed' && style.position !== 'sticky') return false;
      const bounds = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && bounds.width > 0 && bounds.height > 0;
    });
  const positioned = positionedElements.map(({ element, style }) => {
    const bounds = rect(element);
    const target = label(element);
    if (bounds.left < -tolerance || bounds.right > viewportWidth + tolerance) {
      addFailure('positioned-viewport-bounds', target, {
        position: style.position,
        transform: style.transform,
        bounds,
        viewportWidth,
      });
    }
    return { target, position: style.position, transform: style.transform, bounds };
  });

  return {
    gate: 'PLATFORM_HORIZONTAL_GEOMETRY',
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    tolerance,
    document: documentMetrics,
    normalization,
    significant_roots: significantRoots,
    positioned_elements: positioned,
    horizontal_scroll_capability: 'NOT_DEFINED_NO_CONSUMER',
    failures,
  };
}

export function platformGeometryEvaluationExpression(options = {}) {
  return `(${inspectPlatformGeometry.toString()})(document, window, ${JSON.stringify(options)})`;
}

export function assertPlatformGeometry(snapshot, context = 'platform geometry') {
  if (snapshot.status !== 'PASS') {
    throw new Error(`${context} failed: ${JSON.stringify(snapshot)}`);
  }
  return snapshot;
}
