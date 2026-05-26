#!/usr/bin/env node
/**
 * 方案 B 全量：从表 C 聚合 status 计数，回写表 B（覆盖当日计数，用于纠偏）
 *
 * 用法：
 *   node scripts/rollup-table-b.mjs              # 默认：最近 7 天
 *   node scripts/rollup-table-b.mjs --today      # 仅今天
 *   node scripts/rollup-table-b.mjs --days 30    # 最近 30 天
 *   node scripts/rollup-table-b.mjs --all        # 全表 C（慎用）
 *   node scripts/rollup-table-b.mjs --dry-run    # 只打印不写入
 */

import { loadNodeConfig } from "./load-node-config.mjs";
import { rollupTableBFromTableC, getLocalDayStartMs } from "../lib/rollup-table-b.js";

function parseArgs(argv) {
  const options = {
    dryRun: false,
    days: 7,
    all: false,
    today: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--all") options.all = true;
    else if (arg === "--today") options.today = true;
    else if (arg === "--days") {
      options.days = Number(argv[i + 1]) || 7;
      i += 1;
    }
  }

  return options;
}

function getSinceUntilMs(cli) {
  const todayStart = getLocalDayStartMs(Date.now());

  if (cli.all) {
    return { sinceDayStartMs: undefined, untilDayStartMs: undefined };
  }

  if (cli.today) {
    return { sinceDayStartMs: todayStart, untilDayStartMs: todayStart };
  }

  const sinceDayStartMs = todayStart - (cli.days - 1) * 86400000;
  return { sinceDayStartMs, untilDayStartMs: todayStart };
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  const range = getSinceUntilMs(cli);
  const config = loadNodeConfig();

  console.log("BridgeX · 表 C → 表 B 全量聚合");
  console.log(
    cli.all
      ? "范围: 全表"
      : `范围: ${new Date(range.sinceDayStartMs).toISOString().slice(0, 10)} ~ ${new Date(range.untilDayStartMs).toISOString().slice(0, 10)}`
  );
  if (cli.dryRun) console.log("模式: dry-run（不写入飞书）");

  const result = await rollupTableBFromTableC(config, {
    ...range,
    dryRun: cli.dryRun,
  });

  console.log("\n完成");
  console.log(`  表 C 扫描行数: ${result.tableCScanned}`);
  console.log(`  聚合桶 (账户×日): ${result.buckets}`);
  console.log(`  更新表 B: ${result.updated}`);
  console.log(`  新建表 B: ${result.created}`);
  console.log(`  跳过: ${result.skipped}`);

  if (cli.dryRun && result.details.length) {
    console.log("\n明细（前 20 条）:");
    for (const row of result.details.slice(0, 20)) {
      console.log(
        `  ${row.day} | ${row.accountId} | sent=${row.counts.connectSent} accepted=${row.counts.connectAccepted} msg=${row.counts.messagesSent} reply=${row.counts.repliesReceived} → ${row.action}`
      );
    }
  }
}

main().catch((error) => {
  console.error("失败:", error.message || error);
  process.exit(1);
});
