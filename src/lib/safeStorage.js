/** 避免无痕模式 / 禁用存储时 localStorage 抛错导致整页白屏 */
export function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
