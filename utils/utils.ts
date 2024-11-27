import { Page, Response } from "playwright";

export async function responseHandler(
  response: Response,
  handler: (data: any) => any
) {
  if (response.status() != 200) {
    throw "请求失败, 状态码: " + response.status();
  }
  const res = await response.json();
  if (res?.err_no !== 0) {
    throw res?.err_msg ?? "未知请求错误";
  }
  const data = res?.data ?? {};
  return handler(data);
}

export function waitForResponseHelper(page: Page, url: string) {
  console.log('page = ', page.url(), '\n url = ', url)
  return page.waitForResponse((response) => response.url().startsWith(url), {
    timeout: 30000,
  });
}

