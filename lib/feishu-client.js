/**
 * 飞书 Bitable HTTP 客户端（Node / 脚本用，无 chrome 依赖）
 */

const TOKEN_URL =
  "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal";

export async function getTenantAccessToken(appId, appSecret) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const data = await response.json();
  if (!response.ok || data.code !== 0) {
    throw new Error(data.msg || `获取 Token 失败 (HTTP ${response.status})`);
  }
  return data.tenant_access_token;
}

async function parseFeishuResponse(response) {
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok || data?.code !== 0) {
    throw new Error(data?.msg || `飞书接口失败 (HTTP ${response.status})`);
  }
  return data;
}

export async function listAllBitableRecords({ token, appToken, tableId, pageSize = 500 }) {
  const items = [];
  let pageToken = undefined;

  do {
    const params = new URLSearchParams({ page_size: String(pageSize) });
    if (pageToken) params.set("page_token", pageToken);

    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records?${params}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await parseFeishuResponse(response);
    items.push(...(data.data?.items || []));
    pageToken = data.data?.page_token;
    if (!data.data?.has_more) break;
  } while (pageToken);

  return items;
}

export async function searchBitableRecords({
  token,
  appToken,
  tableId,
  filter,
  pageSize = 500,
}) {
  const items = [];
  let pageToken = undefined;

  do {
    const body = { filter, page_size: pageSize };
    if (pageToken) body.page_token = pageToken;

    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records/search`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await parseFeishuResponse(response);
    items.push(...(data.data?.items || []));
    pageToken = data.data?.page_token;
    if (!data.data?.has_more) break;
  } while (pageToken);

  return items;
}

export async function updateBitableRecord({ token, appToken, tableId, recordId, fields }) {
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records/${encodeURIComponent(recordId)}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fields }),
  });

  return parseFeishuResponse(response);
}

export async function createBitableRecord({ token, appToken, tableId, fields }) {
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fields }),
  });

  return parseFeishuResponse(response);
}
