/**
 * 危险数据库脚本（清库、重新 seed、批量改数据）的保护闸。
 *
 * 用法：在脚本最前面调用 assertDangerousScriptAllowed('force-nuke', url)
 *
 * 规则：
 * 1. 必须显式设置 CONFIRM_DANGEROUS_DB_SCRIPT=yes 才会运行；
 * 2. 只要数据库地址不是本地文件（file:...），就视为生产库，默认拒绝；
 *    确实要对远程库运行时，还需要额外设置 ALLOW_PRODUCTION_DB=yes-i-am-sure。
 */
export function isLocalDatabaseUrl(url: string | undefined | null): boolean {
  const value = String(url || '').trim();
  return value === '' || value.startsWith('file:') || value === ':memory:';
}

export function assertDangerousScriptAllowed(scriptName: string, databaseUrl: string | undefined | null): void {
  const confirmed = String(process.env.CONFIRM_DANGEROUS_DB_SCRIPT || '').trim().toLowerCase() === 'yes';
  if (!confirmed) {
    console.error(
      `[${scriptName}] 拒绝运行：这是会修改/删除数据的危险脚本。\n` +
        `如确认要运行，请设置环境变量 CONFIRM_DANGEROUS_DB_SCRIPT=yes`,
    );
    process.exit(1);
  }

  if (!isLocalDatabaseUrl(databaseUrl)) {
    const allowProd = String(process.env.ALLOW_PRODUCTION_DB || '').trim() === 'yes-i-am-sure';
    if (!allowProd) {
      let host = '(unknown)';
      try {
        host = new URL(String(databaseUrl)).host;
      } catch {
        // ignore
      }
      console.error(
        `[${scriptName}] 拒绝运行：DATABASE_URL 指向远程数据库 ${host}（视为生产库）。\n` +
          `如果你真的要对它运行，请再设置 ALLOW_PRODUCTION_DB=yes-i-am-sure（请先备份）。`,
      );
      process.exit(1);
    }
    console.warn(`[${scriptName}] ⚠️ 正在对远程数据库 ${databaseUrl} 运行危险脚本！`);
  }
}
