export function homeProjectCount(value) {
  const count = Number(value);
  return Number.isInteger(count) && count >= 5 ? count : 5;
}

export function videoPreviewSource(src) {
  return src.split('#', 1)[0] + '#t=0.2';
}
