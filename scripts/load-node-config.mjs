import {
  FEISHU_APP_ID,
  FEISHU_APP_SECRET,
  FEISHU_BITABLE_APP_TOKEN,
  FEISHU_TABLE_ID,
  FEISHU_TABLE_B_ID,
} from "../lib/secrets.js";
import { DEFAULT_FIELD_NAMES } from "../lib/config.js";

export function loadNodeConfig() {
  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
    throw new Error("请在 lib/secrets.js 中配置 FEISHU_APP_ID / FEISHU_APP_SECRET");
  }
  if (!FEISHU_BITABLE_APP_TOKEN || !FEISHU_TABLE_ID || !FEISHU_TABLE_B_ID) {
    throw new Error("请在 lib/secrets.js 中配置 Bitable App Token 与表 C/B Table ID");
  }

  return {
    appId: FEISHU_APP_ID,
    appSecret: FEISHU_APP_SECRET,
    appToken: FEISHU_BITABLE_APP_TOKEN,
    tableId: FEISHU_TABLE_ID,
    tableBId: FEISHU_TABLE_B_ID,
    fieldNames: { ...DEFAULT_FIELD_NAMES },
  };
}
